import { pool } from '../db.js';

// Sinh mã nhân viên NV0001, NV0002... bằng sequence của PostgreSQL.
// nextval() không bao giờ trả cùng một số cho hai người gọi, nên hai lượt đăng ký đồng thời
// không còn đụng mã như cách "đọc mã lớn nhất rồi +1" trước đây. Số vượt 9999 vẫn chạy bình thường (NV10000...).
export async function nextEmployeeCode() {
  // Vòng lặp chỉ để bỏ qua mã đã bị chiếm bởi mã nhập tay (ví dụ quản lý tự gõ NV0042).
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { rows } = await pool.query("SELECT nextval('employee_code_seq') AS n");
    const candidate = 'NV' + String(rows[0].n).padStart(4, '0');
    const { rows: taken } = await pool.query('SELECT 1 FROM employees WHERE lower(employee_code) = lower($1)', [candidate]);
    if (!taken.length) return candidate;
  }
  throw new Error('Không tạo được mã nhân viên, vui lòng thử lại');
}
