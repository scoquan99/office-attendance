// Kiểm thử API bằng backend THẬT + PostgreSQL THẬT (tạm). Chạy: npm test
// Tập trung vào những thứ dễ hỏng âm thầm nhất: ma trận phân quyền (nhân viên / quản lý / các bậc phân cấp),
// luồng đăng ký chờ duyệt, mật khẩu tạm, phạm vi dữ liệu theo vai trò, chấm công và dashboard.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { BACKEND_DIR, startPostgres, startBackend, makeApi, officeToday } from './helpers.mjs';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

const PW = 'Passw0rd!';
const DB_NAME = 'oa_api';

describe('API chấm công (PostgreSQL thật)', () => {
  let pgDb;
  let backend;
  let db;
  let api;
  let seedError = null;
  const S = {}; // trạng thái dùng chung giữa các test (id, token...)

  const login = (code, password = PW) => api('POST', '/api/auth/login', { body: { employee_code: code, password } });
  const regBody = (over = {}) => ({
    full_name: 'Nhân Viên Thử',
    phone: '0911111111',
    email: `nv${Math.random().toString(36).slice(2, 10)}@x.vn`,
    department: 'Kinh doanh',
    position: 'Sales Representative',
    password: PW,
    ...over,
  });
  const idOf = async (code) => (await db.query('SELECT id FROM employees WHERE employee_code = $1', [code])).rows[0]?.id;
  const codeOf = async (id) => (await db.query('SELECT employee_code FROM employees WHERE id = $1', [id])).rows[0]?.employee_code;
  const statusOf = async (id) => (await db.query('SELECT status FROM employees WHERE id = $1', [id])).rows[0]?.status;
  const put = (token, id, body) => api('PUT', `/api/employees/${id}`, { token, body });
  const insertEmployee = async (code, name, dept, pos, withPassword = true) =>
    (
      await db.query(
        `INSERT INTO employees (employee_code, full_name, department, position, phone, email, status, password_hash)
         VALUES ($1,$2,$3,$4,'0900000000',$5,'active',$6) RETURNING id`,
        [code, name, dept, pos, `${code.toLowerCase()}@x.vn`, withPassword ? S.hash : null]
      )
    ).rows[0].id;

  before(async () => {
    pgDb = await startPostgres(DB_NAME);
    db = pgDb.client();
    await db.connect();

    // Đúng như Docker lần đầu: nạp schema.sql rồi seed.sql trên database mới
    await db.query(fs.readFileSync(path.join(BACKEND_DIR, 'src/db/schema.sql'), 'utf8'));
    try {
      await db.query(fs.readFileSync(path.join(BACKEND_DIR, 'src/db/seed.sql'), 'utf8'));
    } catch (err) {
      seedError = err.message;
    }

    backend = await startBackend({ pgPort: pgDb.port, dbName: DB_NAME, env: { WORK_START_TIME: '00:00', LATE_GRACE_MINUTES: '0' } });
    api = makeApi(backend.base);

    S.hash = await bcrypt.hash(PW, 10);
    S.ceoId = await insertEmployee('CEO01', 'Giám Đốc', 'Ban Giám đốc', 'Tổng Giám đốc (CEO)');
    S.ctoId = await insertEmployee('CTO01', 'Trưởng IT', 'IT / Software', 'CTO');
    S.hrmId = await insertEmployee('HRM01', 'Trưởng Nhân Sự', 'Nhân sự', 'Trưởng phòng Nhân sự');
    S.w1Id = await insertEmployee('W001', 'Công Nhân Một', 'Kỹ thuật / Sản xuất', 'Công nhân');
    S.ceo = (await login('CEO01')).data.token;
    S.cto = (await login('CTO01')).data.token;
    S.hrm = (await login('HRM01')).data.token;
  });

  after(async () => {
    await db?.end().catch(() => {});
    await backend?.stop();
    await pgDb?.stop();
  });

  describe('khởi tạo và dữ liệu mẫu', () => {
    it('seed.sql chạy được sau schema.sql (đúng thứ tự Docker)', () => {
      assert.equal(seedError, null);
    });

    it('seed không chứa mật khẩu, dùng đúng phòng ban/chức vụ của hệ thống', async () => {
      const org = await import(pathToFileURL(path.join(BACKEND_DIR, 'src/config/orgStructure.js')).href);
      const rows = (await db.query("SELECT department, position, password_hash FROM employees WHERE employee_code LIKE 'NV0%'")).rows;
      assert.equal(rows.length, 3);
      for (const r of rows) {
        assert.equal(r.password_hash, null);
        assert.equal(org.checkOrgPair(r.department, r.position), null, `${r.department} / ${r.position}`);
      }
      assert.ok(!/\$2[aby]\$/.test(fs.readFileSync(path.join(BACKEND_DIR, 'src/db/seed.sql'), 'utf8')));
    });

    it('nhân viên mẫu không có tài khoản đăng nhập', async () => {
      assert.equal((await login('NV001', 'bat-ky-mat-khau')).status, 401);
    });

    it('/api/org và /api/meta công khai', async () => {
      const org = await api('GET', '/api/org');
      assert.equal(org.status, 200);
      assert.equal(org.data.departments.length, 13);
      const meta = await api('GET', '/api/meta');
      assert.equal(meta.status, 200);
      assert.equal(meta.data.timezone, 'Asia/Ho_Chi_Minh');
      assert.equal(meta.data.today, officeToday());
    });

    it('mọi route dữ liệu đều yêu cầu đăng nhập', async () => {
      for (const route of ['/api/employees', '/api/attendance', '/api/dashboard', '/api/tasks?employee_id=1']) {
        assert.equal((await api('GET', route)).status, 401, route);
      }
      assert.equal((await api('GET', '/api/employees', { token: 'abc.def.ghi' })).status, 401);
    });
  });

  describe('đăng ký chờ duyệt', () => {
    it('đăng ký -> 201, chờ duyệt, KHÔNG trả token; mã tiếp theo sau dữ liệu mẫu là NV0004', async () => {
      const r = await api('POST', '/api/auth/register', { body: regBody({ full_name: 'Người Một', email: 'mot@x.vn' }) });
      assert.equal(r.status, 201);
      assert.equal(r.data.pending, true);
      assert.ok(!('token' in r.data));
      assert.equal(r.data.employee.employee_code, 'NV0004');
      S.firstPending = 'NV0004';
    });

    it('đăng nhập đúng mật khẩu khi chưa duyệt -> 403 ACCOUNT_PENDING; sai mật khẩu -> 401', async () => {
      const ok = await login(S.firstPending);
      assert.equal(ok.status, 403);
      assert.equal(ok.data.code, 'ACCOUNT_PENDING');
      assert.equal((await login(S.firstPending, 'sai-mat-khau-1')).status, 401);
    });

    it('chức vụ quản lý không tự đăng ký được (kể cả thêm khoảng trắng)', async () => {
      const body = { department: 'IT / Software', position: 'CTO' };
      assert.equal((await api('POST', '/api/auth/register', { body: regBody(body) })).status, 403);
      assert.equal((await api('POST', '/api/auth/register', { body: regBody({ department: ' IT / Software ', position: ' CTO ' }) })).status, 403);
    });

    it('từ chối dữ liệu không hợp lệ (cặp phòng ban/chức vụ, phòng ban lạ, mật khẩu ngắn)', async () => {
      assert.equal((await api('POST', '/api/auth/register', { body: regBody({ department: 'Marketing', position: 'CTO' }) })).status, 400);
      assert.equal((await api('POST', '/api/auth/register', { body: regBody({ department: 'Abc' }) })).status, 400);
      assert.equal((await api('POST', '/api/auth/register', { body: regBody({ password: '1234567' }) })).status, 400);
    });

    it('email đã được dùng -> 409, kể cả khác hoa/thường', async () => {
      const r = await api('POST', '/api/auth/register', { body: regBody({ email: 'MOT@x.vn' }) });
      assert.equal(r.status, 409);
      assert.match(r.data.error, /[Ee]mail/);
    });

    it('10 đăng ký đồng thời đều thành công và mã nhân viên không trùng', async () => {
      const results = await Promise.all(Array.from({ length: 10 }, (_, i) => api('POST', '/api/auth/register', { body: regBody({ full_name: 'Song Song ' + i }) })));
      assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.status)));
      const codes = results.map((r) => r.data.employee.employee_code);
      assert.equal(new Set(codes).size, 10);
    });
  });

  describe('duyệt / từ chối đăng ký', () => {
    it('quản lý thấy các tài khoản chờ duyệt', async () => {
      const list = (await api('GET', '/api/employees?status=pending', { token: S.ceo })).data;
      assert.ok(list.length >= 11);
      assert.ok(list.every((e) => e.status === 'pending'));
    });

    it('duyệt (pending -> active) và đăng nhập được, isManager=false', async () => {
      const reg = await api('POST', '/api/auth/register', { body: regBody({ full_name: 'Nhân Viên Hai', phone: '0922222222', email: 'hai@x.vn' }) });
      S.wCode = reg.data.employee.employee_code;
      S.wId = await idOf(S.wCode);
      const approve = await put(S.ceo, S.wId, { status: 'active' });
      assert.equal(approve.status, 200);
      const lg = await login(S.wCode);
      assert.equal(lg.status, 200);
      assert.equal(lg.data.employee.isManager, false);
      S.w = lg.data.token;
    });

    it('không đưa người đang làm quay lại "chờ duyệt"', async () => {
      assert.equal((await put(S.ceo, S.wId, { status: 'pending' })).status, 400);
    });

    it('sửa SĐT của người chờ duyệt bằng form giữ nguyên status=pending vẫn được', async () => {
      const reg = await api('POST', '/api/auth/register', { body: regBody({ full_name: 'Người Chờ', email: 'cho@x.vn' }) });
      S.pCode = reg.data.employee.employee_code;
      S.pId = await idOf(S.pCode);
      const r = await put(S.ceo, S.pId, { employee_code: S.pCode, full_name: 'Người Chờ', department: 'Kinh doanh', position: 'Sales Representative', phone: '0955555555', email: 'cho@x.vn', start_date: '', status: 'pending' });
      assert.equal(r.status, 200);
    });

    it('chưa duyệt thì không cấp được mật khẩu tạm', async () => {
      const r = await api('POST', `/api/employees/${S.pId}/reset-password`, { token: S.ceo });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /chờ duyệt/);
    });

    it('quản lý không tạo được nhân viên với trạng thái "pending"', async () => {
      assert.equal((await api('POST', '/api/employees', { token: S.ceo, body: { employee_code: 'T1', full_name: 'T', status: 'pending' } })).status, 400);
    });

    it('từ chối đăng ký -> 204, tài khoản không đăng nhập được', async () => {
      const reg = await api('POST', '/api/auth/register', { body: regBody({ full_name: 'Bị Từ Chối', email: 'tuchoi@x.vn' }) });
      const code = reg.data.employee.employee_code;
      const id = await idOf(code);
      assert.equal((await api('DELETE', `/api/employees/${id}`, { token: S.ceo })).status, 204);
      assert.equal(await statusOf(id), 'inactive');
      assert.equal((await login(code)).status, 401);
    });

    it('nhân viên thường không duyệt / từ chối được ai', async () => {
      assert.equal((await put(S.w, S.pId, { status: 'active' })).status, 403);
      assert.equal((await api('DELETE', `/api/employees/${S.pId}`, { token: S.w })).status, 403);
    });
  });

  describe('phạm vi dữ liệu theo vai trò', () => {
    it('nhân viên thường: người khác chỉ có mã/tên/phòng ban/chức vụ, bản thân thấy đầy đủ', async () => {
      const list = (await api('GET', '/api/employees', { token: S.w })).data;
      const others = list.filter((e) => e.id !== S.wId);
      assert.ok(others.length > 0);
      for (const e of others) {
        assert.equal(e.phone, null);
        assert.equal(e.email, null);
        assert.equal(e.start_date, null);
        assert.ok(e.employee_code && e.full_name);
      }
      const self = list.find((e) => e.id === S.wId);
      assert.equal(self.phone, '0922222222');
      assert.equal(self.email, 'hai@x.vn');
    });

    it('nhân viên thường không thấy tài khoản chờ duyệt', async () => {
      const list = (await api('GET', '/api/employees', { token: S.w })).data;
      assert.ok(!list.some((e) => e.status === 'pending'));
      assert.equal((await api('GET', '/api/employees?status=pending', { token: S.w })).data.length, 0);
      assert.equal((await api('GET', `/api/employees/${S.pId}`, { token: S.w })).status, 404);
    });

    it('GET /employees/:id: nhân viên thường thấy thông tin công khai; quản lý thấy đầy đủ', async () => {
      const asW = await api('GET', `/api/employees/${S.ceoId}`, { token: S.w });
      assert.equal(asW.status, 200);
      assert.equal(asW.data.phone, null);
      assert.equal((await api('GET', `/api/employees/${S.wId}`, { token: S.ceo })).data.phone, '0922222222');
    });

    it('chấm công: nhân viên thường chỉ xem của chính mình', async () => {
      await db.query("INSERT INTO attendance (employee_id, work_date, check_in, check_out) VALUES ($1, CURRENT_DATE - 1, '08:01', '17:30'), ($2, CURRENT_DATE - 1, '08:10', '17:00')", [S.ceoId, S.wId]);
      const mine = await api('GET', '/api/attendance', { token: S.w });
      assert.equal(mine.status, 200);
      assert.ok(mine.data.length >= 1 && mine.data.every((r) => r.employee_id === S.wId));
      assert.equal((await api('GET', `/api/attendance?employee_id=${S.ceoId}`, { token: S.w })).status, 403);
      const sneaky = await api('GET', '/api/attendance?department=Ban%20Gi%C3%A1m%20%C4%91%E1%BB%91c', { token: S.w });
      assert.ok(sneaky.data.every((r) => r.employee_id === S.wId));
      const all = await api('GET', '/api/attendance', { token: S.ceo });
      assert.ok(new Set(all.data.map((r) => r.employee_id)).size >= 2);
    });

    it('xuất Excel chỉ dành cho quản lý', async () => {
      assert.equal((await api('GET', '/api/attendance/export/xlsx', { token: S.w })).status, 403);
      const r = await api('GET', '/api/attendance/export/xlsx', { token: S.ceo });
      assert.equal(r.status, 200);
      assert.equal(r.buf.subarray(0, 2).toString(), 'PK');
      assert.equal((await api('GET', '/api/attendance/export/xlsx')).status, 401);
    });

    it('work_date trả về dạng chuỗi YYYY-MM-DD (không lệch ngày theo múi giờ)', async () => {
      const all = await api('GET', '/api/attendance', { token: S.ceo });
      assert.ok(all.data.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.work_date)));
    });

    it('dashboard: nhân viên thường chỉ thấy dòng của mình nhưng số liệu tổng hợp giống quản lý', async () => {
      const w = (await api('GET', '/api/dashboard', { token: S.w })).data;
      const c = (await api('GET', '/api/dashboard', { token: S.ceo })).data;
      assert.ok(w.departments.flatMap((d) => d.employees).every((e) => e.id === S.wId));
      assert.deepEqual(w.summary, c.summary);
      assert.equal(c.departments.flatMap((d) => d.employees).length, c.summary.total);
    });

    it('dashboard: ngày sai -> 400; mặc định là hôm nay theo giờ văn phòng', async () => {
      assert.equal((await api('GET', '/api/dashboard?date=2026-13-45', { token: S.ceo })).status, 400);
      assert.equal((await api('GET', '/api/dashboard', { token: S.ceo })).data.summary.date, officeToday());
    });

    it('việc (tasks): chỉ xem / sửa / xóa việc của chính mình', async () => {
      assert.equal((await api('GET', `/api/tasks?employee_id=${S.ceoId}`, { token: S.w })).status, 403);
      const task = await api('POST', '/api/tasks', { token: S.ceo, body: { employee_id: S.ctoId, title: 'Việc của CTO' } });
      assert.equal(task.status, 201);
      assert.equal((await api('PUT', `/api/tasks/${task.data.id}`, { token: S.w, body: { is_done: true } })).status, 403);
      assert.equal((await api('DELETE', `/api/tasks/${task.data.id}`, { token: S.w })).status, 403);
    });
  });

  describe('phân cấp giữa các quản lý', () => {
    it('quản lý bậc thấp không xóa được người cao hơn hoặc ngang bậc, cũng không tự xóa mình', async () => {
      assert.equal((await api('DELETE', `/api/employees/${S.ceoId}`, { token: S.cto })).status, 403);
      assert.equal((await api('DELETE', `/api/employees/${S.hrmId}`, { token: S.cto })).status, 403);
      assert.equal((await api('DELETE', `/api/employees/${S.ctoId}`, { token: S.cto })).status, 400);
    });

    it('cho nghỉ việc là xóa mềm: giữ lịch sử chấm công, token cũ và đăng nhập đều bị chặn', async () => {
      const w1Token = (await login('W001')).data.token;
      await db.query("INSERT INTO attendance (employee_id, work_date, check_in) VALUES ($1, CURRENT_DATE - 2, '08:00')", [S.w1Id]);
      assert.equal((await api('DELETE', `/api/employees/${S.w1Id}`, { token: S.cto })).status, 204);
      assert.equal(await statusOf(S.w1Id), 'inactive');
      assert.equal((await db.query('SELECT count(*)::int n FROM attendance WHERE employee_id = $1', [S.w1Id])).rows[0].n, 1);
      assert.equal((await api('GET', '/api/auth/me', { token: w1Token })).status, 401);
      assert.equal((await login('W001')).status, 401);
    });

    it('không tự đổi chức vụ lên cao hơn, không vô hiệu hóa người ngang bậc', async () => {
      assert.equal((await put(S.cto, S.ctoId, { department: 'Ban Giám đốc', position: 'Tổng Giám đốc (CEO)' })).status, 403);
      assert.equal((await put(S.cto, S.hrmId, { status: 'inactive' })).status, 403);
    });

    it('đổi MÃ ĐĂNG NHẬP: không được với người cao hơn / ngang bậc, được với người thấp hơn và chính mình', async () => {
      assert.equal((await put(S.cto, S.ceoId, { employee_code: 'HACKED1' })).status, 403);
      assert.equal(await codeOf(S.ceoId), 'CEO01');
      assert.equal((await login('CEO01')).status, 200);
      assert.equal((await put(S.cto, S.hrmId, { employee_code: 'HRM99' })).status, 403);
      const lower = await put(S.cto, S.wId, { employee_code: 'W002X' });
      assert.equal(lower.status, 200);
      assert.equal((await login('W002X')).status, 200);
      assert.equal((await login(S.wCode)).status, 401);
      assert.equal((await put(S.cto, S.ctoId, { employee_code: 'CTO02' })).status, 200);
      assert.equal((await login('CTO02')).status, 200);
      assert.equal((await put(S.ceo, S.ctoId, { employee_code: 'CTO01' })).status, 200);
    });

    it('form "Sửa" gửi đủ trường mà không đổi gì nhạy cảm thì không bị 403 oan', async () => {
      const own = await put(S.cto, S.ctoId, { employee_code: 'CTO01', full_name: 'Trưởng IT', department: 'IT / Software', position: 'CTO', phone: '0988888888', email: 'cto01@x.vn', start_date: '', status: 'active' });
      assert.equal(own.status, 200);
      const peer = await put(S.cto, S.hrmId, { employee_code: 'HRM01', full_name: 'Trưởng Nhân Sự', department: 'Nhân sự', position: 'Trưởng phòng Nhân sự', phone: '0977777777', email: 'hrm01@x.vn', start_date: '', status: 'active' });
      assert.equal(peer.status, 200);
      assert.equal((await put(S.cto, S.hrmId, { employee_code: ' HRM01 ' })).status, 200);
    });

    it('đổi phòng ban / chức vụ phải thuộc danh sách chuẩn; nhân viên cũ ngoài danh sách vẫn sửa được trường khác', async () => {
      assert.equal((await put(S.cto, S.wId, { department: 'Abc', position: '' })).status, 400);
      assert.equal((await put(S.cto, S.wId, { department: 'Marketing' })).status, 400); // chức vụ cũ không thuộc ban mới
      assert.equal((await put(S.cto, S.wId, { department: 'Marketing', position: 'Content Writer' })).status, 200);
      const legacy = await insertEmployee('OLD01', 'Nhân Viên Cũ', 'Phòng Cũ', 'Chức Vụ Cũ', false);
      const r = await put(S.cto, legacy, { employee_code: 'OLD01', full_name: 'Nhân Viên Cũ', department: 'Phòng Cũ', position: 'Chức Vụ Cũ', phone: '0900000099', email: '', start_date: '', status: 'active' });
      assert.equal(r.status, 200);
    });

    it('nhân viên thường không sửa được người khác', async () => {
      assert.equal((await put(S.w, S.ceoId, { phone: '1' })).status, 403);
    });
  });

  describe('mật khẩu tạm, đổi và cấp lại mật khẩu', () => {
    it('quản lý tạo nhân viên -> nhận mật khẩu tạm (một lần), không lộ password_hash', async () => {
      const r = await api('POST', '/api/employees', { token: S.ceo, body: { employee_code: 'TEST01', full_name: 'Nhân Viên Mới', department: 'Kỹ thuật / Sản xuất', position: 'Công nhân', email: 'test01@x.vn' } });
      assert.equal(r.status, 201);
      assert.equal(r.data.temporary_password.length, 12);
      assert.ok(!('password_hash' in r.data));
      assert.match(r.headers.get('cache-control') || '', /no-store/);
      S.testId = r.data.id;
      S.temp1 = r.data.temporary_password;
    });

    it('đăng nhập bằng mật khẩu tạm: bị khóa mọi API khác cho tới khi đổi mật khẩu', async () => {
      const lg = await login('TEST01', S.temp1);
      assert.equal(lg.status, 200);
      assert.equal(lg.data.employee.must_change_password, true);
      S.t1 = lg.data.token;
      const blocked = await api('GET', '/api/employees', { token: S.t1 });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.data.code, 'PASSWORD_CHANGE_REQUIRED');
      assert.equal((await api('GET', '/api/auth/me', { token: S.t1 })).status, 200);
    });

    it('đổi mật khẩu: kiểm tra đầu vào, token cũ mất hiệu lực, token mới dùng được', async () => {
      const cp = (cur, nw) => api('POST', '/api/auth/change-password', { token: S.t1, body: { current_password: cur, new_password: nw } });
      assert.equal((await cp('sai-mat-khau-1', 'MatKhauMoi123')).status, 400); // 400 chứ không phải 401 (401 làm giao diện tự đăng xuất)
      assert.equal((await cp(S.temp1, S.temp1)).status, 400);
      assert.equal((await cp(S.temp1, 'abc')).status, 400);
      const ok = await cp(S.temp1, 'MatKhauMoi123');
      assert.equal(ok.status, 200);
      assert.equal((await api('GET', '/api/auth/me', { token: S.t1 })).status, 401);
      assert.equal((await api('GET', '/api/employees', { token: ok.data.token })).status, 200);
      assert.equal((await login('TEST01', 'MatKhauMoi123')).status, 200);
      assert.equal((await login('TEST01', S.temp1)).status, 401);
      S.t2 = ok.data.token;
    });

    it('cấp lại mật khẩu: token cũ của nhân viên bị vô hiệu, phải đổi lại khi đăng nhập', async () => {
      const r = await api('POST', `/api/employees/${S.testId}/reset-password`, { token: S.ceo });
      assert.equal(r.status, 200);
      assert.equal((await api('GET', '/api/auth/me', { token: S.t2 })).status, 401);
      const lg = await login('TEST01', r.data.temporary_password);
      assert.equal(lg.data.employee.must_change_password, true);
    });

    it('cấp lại mật khẩu tuân theo phân cấp', async () => {
      assert.equal((await api('POST', `/api/employees/${S.ceoId}/reset-password`, { token: S.cto })).status, 403);
      assert.equal((await api('POST', `/api/employees/${S.ctoId}/reset-password`, { token: S.hrm })).status, 403);
      assert.equal((await api('POST', `/api/employees/${S.ceoId}/reset-password`, { token: S.ceo })).status, 400);
      assert.equal((await api('POST', '/api/employees/999999/reset-password', { token: S.ceo })).status, 404);
      assert.equal((await api('POST', `/api/employees/${S.testId}/reset-password`, { token: S.w })).status, 403);
    });

    it('quản lý bậc thấp không tạo được nhân viên bậc ngang mình, tạo nhân viên thường thì được', async () => {
      const peer = await api('POST', '/api/employees', { token: S.cto, body: { employee_code: 'BAD01', full_name: 'X', department: 'IT / Software', position: 'CTO' } });
      assert.equal(peer.status, 403);
      const dev = await api('POST', '/api/employees', { token: S.cto, body: { employee_code: 'DEV01', full_name: 'Dev Một', department: 'IT / Software', position: 'Backend Developer', email: 'dev01@x.vn' } });
      assert.equal(dev.status, 201);
    });
  });

  describe('chấm công', () => {
    it('chấm công vào: sau giờ bắt đầu (00:00) thì tự ghi "Đi trễ"; lần 2 bị từ chối; chấm công ra được', async () => {
      const ci = await api('POST', '/api/attendance/checkin', { token: S.w, body: { employee_id: S.wId } });
      assert.equal(ci.status, 200);
      assert.equal(ci.data.status, 'Đi trễ');
      assert.equal((await api('POST', '/api/attendance/checkin', { token: S.w, body: { employee_id: S.wId } })).status, 400);
      assert.equal((await api('POST', '/api/attendance/checkout', { token: S.w, body: { employee_id: S.wId } })).status, 200);
    });

    it('kiểm tra quyền trước khi tra cứu: nhân viên thường không chấm công hộ / dò id người khác', async () => {
      assert.equal((await api('POST', '/api/attendance/checkin', { token: S.w, body: { employee_id: S.ceoId } })).status, 403);
      assert.equal((await api('POST', '/api/attendance/checkin', { token: S.w, body: { employee_id: 999999 } })).status, 403);
      assert.equal((await api('POST', '/api/attendance/checkin', { token: S.ceo, body: { employee_id: 999999 } })).status, 404);
    });

    it('nhân viên đã nghỉ việc không chấm công được', async () => {
      assert.equal((await api('POST', '/api/attendance/checkin', { token: S.ceo, body: { employee_id: S.w1Id } })).status, 400);
    });

    it('tạo / sửa / xóa chấm công thủ công chỉ dành cho quản lý', async () => {
      assert.equal((await api('POST', '/api/attendance', { token: S.w, body: { employee_id: S.wId, work_date: officeToday() } })).status, 403);
      const bad = await api('POST', '/api/attendance', { token: S.ceo, body: { employee_id: S.wId, work_date: '2026-13-45' } });
      assert.equal(bad.status, 400);
      const badTime = await api('POST', '/api/attendance', { token: S.ceo, body: { employee_id: S.wId, work_date: '2026-01-02', check_in: '99:99' } });
      assert.equal(badTime.status, 400);
    });
  });

  describe('dashboard: nghỉ phép', () => {
    it('người đang nghỉ hiển thị đúng trạng thái và được đếm riêng, không bị tính là "chưa chấm công"', async () => {
      const today = officeToday();
      const mk = (code, name) => insertEmployee(code, name, 'Kinh doanh', 'Sales Representative', false);
      const A = await mk('LA01', 'Nghỉ Phép');
      const B = await mk('LB01', 'Nghỉ Không Phép');
      const C = await mk('LC01', 'Chưa Chấm Công');
      const D = await mk('LD01', 'Đã Chấm Công');
      const E = await mk('LE01', 'Dòng Trống');
      const F = await mk('LF01', 'Nghỉ Nhưng Có Giờ Vào');
      const manual = (id, status) => api('POST', '/api/attendance', { token: S.ceo, body: { employee_id: id, work_date: today, status } });
      assert.equal((await manual(A, 'Nghỉ phép')).status, 201);
      assert.equal((await manual(B, 'Nghỉ không phép')).status, 201);
      await db.query("INSERT INTO attendance (employee_id, work_date, check_in, status) VALUES ($1,$2,'08:05','Đi trễ')", [D, today]);
      await db.query("INSERT INTO attendance (employee_id, work_date, status) VALUES ($1,$2,'Đi làm')", [E, today]);
      await db.query("INSERT INTO attendance (employee_id, work_date, check_in, status) VALUES ($1,$2,'09:00','Nghỉ phép')", [F, today]);

      const dash = (await api('GET', '/api/dashboard', { token: S.ceo })).data;
      const byCode = Object.fromEntries(dash.departments.flatMap((d) => d.employees).map((e) => [e.employee_code, e]));
      assert.equal(byCode.LA01.status, 'Nghỉ phép');
      assert.equal(byCode.LB01.status, 'Nghỉ không phép');
      assert.equal(byCode.LC01.status, 'Chưa chấm công');
      assert.equal(byCode.LD01.status, 'Đi trễ');
      assert.equal(byCode.LE01.status, 'Chưa chấm công'); // dòng trống không có giờ vào
      assert.equal(byCode.LF01.status, 'Nghỉ phép'); // có giờ vào nhưng quản lý ghi nghỉ phép: giữ trạng thái

      const s = dash.summary;
      assert.equal(s.on_leave, 2);
      assert.equal(s.checked_in + s.not_checked_in + s.on_leave, s.total);
      assert.equal(s.not_checked_in, dash.departments.flatMap((d) => d.employees).filter((e) => e.status === 'Chưa chấm công').length);
      for (const d of dash.departments) assert.equal(d.checked_in + d.not_checked_in + d.on_leave, d.total);
    });
  });

  describe('mã nhân viên và email duy nhất, không phân biệt hoa/thường', () => {
    it('đăng nhập không phân biệt hoa/thường của mã nhân viên', async () => {
      assert.equal((await login('ceo01')).status, 200);
    });

    it('thêm nhân viên trùng mã (khác hoa/thường) hoặc trùng email -> 409 với thông báo đúng', async () => {
      const dupCode = await api('POST', '/api/employees', { token: S.ceo, body: { employee_code: 'ceo01', full_name: 'Trùng Mã' } });
      assert.equal(dupCode.status, 409);
      assert.match(dupCode.data.error, /Mã nhân viên/);
      const dupMail = await api('POST', '/api/employees', { token: S.ceo, body: { employee_code: 'MAIL01', full_name: 'Trùng Email', email: 'CEO01@x.vn' } });
      assert.equal(dupMail.status, 409);
      assert.match(dupMail.data.error, /[Ee]mail/);
    });

    it('sửa sang mã hoặc email đã có -> 409', async () => {
      assert.equal((await put(S.ceo, S.testId, { employee_code: 'Ceo01' })).status, 409);
      const r = await put(S.ceo, S.testId, { email: 'HRM01@x.vn' });
      assert.equal(r.status, 409);
      assert.match(r.data.error, /[Ee]mail/);
    });

    it('nhiều nhân viên không có email vẫn được (email rỗng không bị coi là trùng)', async () => {
      const a = await api('POST', '/api/employees', { token: S.ceo, body: { employee_code: 'NOMAIL1', full_name: 'Không Email 1' } });
      const b = await api('POST', '/api/employees', { token: S.ceo, body: { employee_code: 'NOMAIL2', full_name: 'Không Email 2' } });
      assert.equal(a.status, 201);
      assert.equal(b.status, 201);
    });
  });

  describe('an toàn', () => {
    it('log của server không lộ mật khẩu', () => {
      const log = backend.log();
      assert.ok(!log.includes(PW) && !log.includes('MatKhauMoi123'));
    });
  });
});
