// Hạ tầng dùng chung cho các bài test: PostgreSQL THẬT (embedded-postgres, cổng và thư mục tạm riêng) + backend THẬT
// chạy ở cổng riêng. Không đụng tới database của bạn và không cần cài PostgreSQL / Docker.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

export const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Khởi động một PostgreSQL tạm với database tên dbName (UTF-8, vì dữ liệu có tiếng Việt).
export async function startPostgres(dbName) {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oa-pg-'));
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'testpw',
    port,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });
  await server.initialise();
  await server.start();
  await server.createDatabase(dbName);

  return {
    port,
    dbName,
    // Kết nối quản trị (siêu người dùng) để dựng dữ liệu thử; user/password/database có thể ghi đè
    client: (overrides = {}) =>
      new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password: 'testpw', database: dbName, ...overrides }),
    async stop() {
      await server.stop().catch(() => {});
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// Chạy backend thật. env ghi đè biến môi trường mặc định (ví dụ DB_USER, WORK_START_TIME).
export async function startBackend({ pgPort, dbName, env = {} }) {
  const port = await freePort();
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      DB_HOST: '127.0.0.1',
      DB_PORT: String(pgPort),
      DB_USER: 'postgres',
      DB_PASSWORD: 'testpw',
      DB_NAME: dbName,
      JWT_SECRET: 'test-secret-' + 'x'.repeat(40),
      TRUST_PROXY: '1', // để mỗi request giả lập một IP riêng (X-Forwarded-For) mà không dính giới hạn đăng nhập/đăng ký
      OFFICE_TZ: 'Asia/Ho_Chi_Minh',
      ...env,
    },
  });

  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const base = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 120 && !up; i += 1) {
    if (child.exitCode !== null) throw new Error('Backend dừng ngay khi khởi động:\n' + log);
    try {
      up = (await fetch(base + '/api/health')).ok;
    } catch {
      await sleep(250);
    }
  }
  if (!up) {
    child.kill();
    throw new Error('Backend không khởi động được:\n' + log);
  }

  return {
    base,
    log: () => log,
    async stop() {
      child.kill();
      await sleep(300);
    },
  };
}

// Trả về hàm api(method, path, { token, body }) → { status, data, headers, buf }.
// Mỗi request mang một IP giả khác nhau để không bị giới hạn số lần đăng nhập/đăng ký theo IP.
export function makeApi(base) {
  let counter = 1;
  return async function api(method, route, { token, body, ip } = {}) {
    const headers = { 'x-forwarded-for': ip || `10.9.${Math.floor(counter / 250)}.${(counter++ % 250) + 1}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = 'Bearer ' + token;
    const res = await fetch(base + route, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    let data = null;
    try {
      data = JSON.parse(buf.toString('utf8'));
    } catch {
      /* không phải JSON (ví dụ file Excel) */
    }
    return { status: res.status, data, headers: res.headers, buf };
  };
}

// 'YYYY-MM-DD' của hôm nay theo giờ văn phòng
export function officeToday(tz = 'Asia/Ho_Chi_Minh') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  );
}
