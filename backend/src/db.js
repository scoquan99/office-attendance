import fs from 'node:fs/promises';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool, types } = pkg;

// Giữ cột DATE (OID 1082) dưới dạng chuỗi 'YYYY-MM-DD'. Mặc định pg biến nó thành Date lúc 00:00 giờ máy chủ,
// rồi JSON.stringify đổi sang UTC → nếu máy chủ không chạy UTC thì ngày bị lệch đi một ngày.
types.setTypeParser(1082, (value) => value);

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'office_attendance',
};

// Kết nối dùng cho mọi request của ứng dụng
export const pool = new Pool({
  ...connection,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('error', (err) => {
  console.error('Lỗi kết nối PostgreSQL:', err);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Áp dụng schema.sql mỗi lần server khởi động. File này chỉ gồm lệnh "IF NOT EXISTS" nên chạy lại bao nhiêu lần
// cũng an toàn và không đụng tới dữ liệu có sẵn. Nhờ vậy database cũ (volume Docker đã tạo từ trước) vẫn
// được nâng cấp tự động, không còn phải chạy tay các file migration rời rạc dễ lệch với schema.
//
// Quyền tối thiểu: mặc định việc này chạy bằng chính tài khoản của ứng dụng (DB_USER) nên tài khoản đó cần quyền tạo/sửa
// bảng. Để ứng dụng chạy với tài khoản CHỈ có quyền đọc/ghi dữ liệu, đặt thêm DB_MIGRATION_USER (và DB_MIGRATION_PASSWORD):
// khi đó chỉ bước khởi tạo này dùng tài khoản migration, còn mọi request vẫn dùng DB_USER. Xem README, mục "Quyền tối thiểu".
export async function initDb({ retries = 20, delayMs = 1500 } = {}) {
  const schemaSql = await fs.readFile(new URL('./db/schema.sql', import.meta.url), 'utf8');

  const migrationUser = process.env.DB_MIGRATION_USER;
  const runner = migrationUser
    ? new Pool({ ...connection, user: migrationUser, password: process.env.DB_MIGRATION_PASSWORD || '', max: 1 })
    : pool;

  // Cảnh báo từ PostgreSQL (ví dụ có dữ liệu trùng nên chưa tạo được ràng buộc duy nhất) được ghi ra log
  const onNotice = (notice) => console.warn('[DB]', notice.message);

  try {
    for (let attempt = 1; ; attempt += 1) {
      let client;
      try {
        client = await runner.connect();
        client.on('notice', onNotice);
        await client.query(schemaSql);
        // Đồng bộ sequence mã nhân viên với mã đã có (kể cả mã nhập tay / dữ liệu mẫu) để mã mới luôn lớn hơn.
        await client.query(
          `SELECT setval('employee_code_seq', GREATEST(m, 1), m > 0)
           FROM (
             SELECT COALESCE(MAX(SUBSTRING(employee_code FROM '^NV([0-9]{1,9})$')::bigint), 0) AS m
             FROM employees
           ) s`
        );
        return;
      } catch (err) {
        if (attempt >= retries) throw err;
        console.warn(`[DB] Chưa sẵn sàng (lần ${attempt}/${retries}): ${err.message}. Thử lại sau ${delayMs}ms...`);
        await sleep(delayMs);
      } finally {
        if (client) {
          client.removeListener('notice', onNotice);
          client.release();
        }
      }
    }
  } finally {
    if (runner !== pool) await runner.end();
  }
}
