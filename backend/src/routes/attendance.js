import { Router } from 'express';
import ExcelJS from 'exceljs';
import { pool } from '../db.js';
import { requireManagerRole, canAccessEmployee } from '../middleware/auth.js';
import { todayStr, timeStr, isLate } from '../utils/time.js';
import { parseId } from '../utils/id.js';
import { isValidDate, isValidTime } from '../utils/validate.js';

const router = Router();

const VALID_STATUS = ['Đi làm', 'Đi trễ', 'Nghỉ phép', 'Nghỉ không phép'];


// Chống "Excel formula injection": ô bắt đầu bằng = + - @ sẽ bị Excel hiểu là công thức.
function safeCell(value) {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY' bằng cách cắt chuỗi, không qua Date nên không bị lệch ngày theo múi giờ máy chủ
function formatDateVN(value) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// Nhân viên thường chỉ được xem chấm công của CHÍNH MÌNH (tự gắn employee_id, bỏ lọc phòng ban); quản lý xem được tất cả.
// Trả về { query } hoặc { status, error } nếu đang cố xem dữ liệu của người khác.
function scopeQueryToUser(req) {
  if (req.user.isManager) return { query: req.query };
  if (req.query.employee_id && parseId(req.query.employee_id) !== req.user.id) {
    return { status: 403, error: 'Bạn chỉ được xem dữ liệu chấm công của chính mình' };
  }
  return { query: { ...req.query, employee_id: String(req.user.id), department: undefined } };
}

// Trả về { where, params } hoặc { error } nếu tham số lọc không hợp lệ
function buildFilters(query) {
  const { from, to, employee_id, department } = query;
  const conditions = [];
  const params = [];

  if (from) {
    if (!isValidDate(from)) return { error: 'Tham số "from" phải là ngày hợp lệ dạng YYYY-MM-DD' };
    params.push(from);
    conditions.push(`a.work_date >= $${params.length}`);
  }
  if (to) {
    if (!isValidDate(to)) return { error: 'Tham số "to" phải là ngày hợp lệ dạng YYYY-MM-DD' };
    params.push(to);
    conditions.push(`a.work_date <= $${params.length}`);
  }
  if (employee_id) {
    const id = parseId(employee_id);
    if (!id) return { error: 'employee_id không hợp lệ' };
    params.push(id);
    conditions.push(`a.employee_id = $${params.length}`);
  }
  if (department) {
    if (typeof department !== 'string' || department.length > 100) {
      return { error: 'department không hợp lệ' };
    }
    params.push(department);
    conditions.push(`e.department = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// Kiểm tra được phép chấm công cho nhân viên này: có quyền, nhân viên tồn tại và còn đang làm việc.
// Trả về { allowed: true } nếu hợp lệ; ngược lại trả về { allowed: false, status, error }.
// Quyền được kiểm tra TRƯỚC mọi truy vấn khác để người không có quyền không dò được dữ liệu của người khác.
// Khi được truyền `client` (transaction), dùng client đó thay vì pool để giữ nguyên phiên giao dịch.
async function checkPunchAllowed(req, employeeId, client) {
  if (!canAccessEmployee(req, employeeId)) {
    return { allowed: false, status: 403, error: 'Bạn chỉ được chấm công cho chính mình' };
  }
  const db = client || pool;
  // FOR SHARE khoá hàng employees trong transaction để đảm bảo trạng thái không thay đổi
  // giữa lúc kiểm tra và lúc ghi attendance.
  const lockClause = client ? 'FOR SHARE' : '';
  const { rows: emptyRows } = await db.query(
    `SELECT status FROM employees WHERE id = $1 ${lockClause}`,
    [employeeId]
  );
  if (!emptyRows.length) {
    return { allowed: false, status: 404, error: 'Không tìm thấy nhân viên' };
  }
  if (emptyRows[0].status !== 'active') {
    return { allowed: false, status: 400, error: 'Nhân viên đã nghỉ việc, không thể chấm công' };
  }
  return { allowed: true };
}

// GET /api/attendance?from=&to=&employee_id=&department=
router.get('/', async (req, res, next) => {
  try {
    const scoped = scopeQueryToUser(req);
    if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
    const { where, params, error } = buildFilters(scoped.query);
    if (error) return res.status(400).json({ error });

    const { rows } = await pool.query(
      `SELECT a.*, e.employee_code, e.full_name, e.department, e.position
       FROM attendance a JOIN employees e ON e.id = a.employee_id
       ${where}
       ORDER BY a.work_date DESC, e.full_name ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/attendance/checkin { employee_id }
// Nhân viên thường chỉ được chấm công cho CHÍNH MÌNH; quản lý được chấm công hộ người khác.
// Toàn bộ kiểm tra quyền + upsert nằm trong MỘT transaction để loại bỏ race condition (TOCTOU).
router.post('/checkin', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const employeeId = parseId(req.body?.employee_id);
    if (!employeeId) return res.status(400).json({ error: 'Thiếu hoặc sai employee_id' });

    await client.query('BEGIN');

    const check = await checkPunchAllowed(req, employeeId, client);
    if (!check.allowed) {
      await client.query('ROLLBACK');
      return res.status(check.status).json({ error: check.error });
    }

    // Tính ngày và giờ một lần duy nhất để tránh lệch khi request đến đúng lúc sang ngày mới
    const today = todayStr();
    const now = timeStr();
    // Trạng thái tự tính theo giờ vào: sau giờ bắt đầu làm việc (WORK_START_TIME + LATE_GRACE_MINUTES) là "Đi trễ".
    // Nếu quản lý đã tạo sẵn bản ghi hôm nay với trạng thái khác (ví dụ "Nghỉ phép") thì giữ nguyên trạng thái đó.
    const status = isLate(now) ? 'Đi trễ' : 'Đi làm';

    // Upsert nguyên tử: tạo bản ghi nếu chưa có, ghi giờ vào nếu chưa chấm công.
    // COALESCE giữ giờ vào cũ nếu đã có → hai request đồng thời không ghi đè nhau.
    const { rows } = await client.query(
      `INSERT INTO attendance (employee_id, work_date, check_in, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (employee_id, work_date)
       DO UPDATE SET
         check_in = COALESCE(attendance.check_in, EXCLUDED.check_in),
         status = CASE
           WHEN attendance.check_in IS NULL AND attendance.status IN ('Đi làm', 'Đi trễ') THEN EXCLUDED.status
           ELSE attendance.status
         END
       RETURNING *`,
      [employeeId, today, now, status]
    );

    await client.query('COMMIT');

    // Nếu giờ vào trả về khác giờ vừa gửi → bản ghi đã có check_in từ trước
    if (rows[0].check_in !== now) {
      return res.status(400).json({ error: 'Nhân viên đã chấm công vào hôm nay' });
    }
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/attendance/checkout { employee_id }
// Toàn bộ kiểm tra quyền + update nằm trong MỘT transaction để loại bỏ race condition (TOCTOU).
router.post('/checkout', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const employeeId = parseId(req.body?.employee_id);
    if (!employeeId) return res.status(400).json({ error: 'Thiếu hoặc sai employee_id' });

    await client.query('BEGIN');

    const check = await checkPunchAllowed(req, employeeId, client);
    if (!check.allowed) {
      await client.query('ROLLBACK');
      return res.status(check.status).json({ error: check.error });
    }

    const today = todayStr();
    const { rows } = await client.query(
      `UPDATE attendance SET check_out = $1
       WHERE employee_id = $2 AND work_date = $3 AND check_in IS NOT NULL AND check_out IS NULL
       RETURNING *`,
      [timeStr(), employeeId, today]
    );

    await client.query('COMMIT');

    if (!rows.length) {
      return res.status(400).json({ error: 'Nhân viên chưa chấm công vào trong hôm nay' });
    }
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/attendance  (tạo/sửa thủ công — CHỈ dành cho quản lý)
router.post('/', requireManagerRole, async (req, res, next) => {
  try {
    const { work_date, check_in, check_out, status, note } = req.body;
    const employeeId = parseId(req.body.employee_id);
    if (!employeeId || !work_date) {
      return res.status(400).json({ error: 'Thiếu employee_id hoặc work_date' });
    }
    if (!isValidDate(work_date)) {
      return res.status(400).json({ error: 'work_date phải là ngày hợp lệ dạng YYYY-MM-DD' });
    }
    if ((check_in && !isValidTime(check_in)) || (check_out && !isValidTime(check_out))) {
      return res.status(400).json({ error: 'Giờ vào/ra phải hợp lệ, dạng HH:MM hoặc HH:MM:SS' });
    }
    if (status && !VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái chấm công không hợp lệ' });
    }
    if (note != null && (typeof note !== 'string' || note.length > 1000)) {
      return res.status(400).json({ error: 'Ghi chú phải là chuỗi tối đa 1000 ký tự' });
    }

    // Kiểm tra nhân viên tồn tại và còn đang làm việc (đồng nhất quy tắc với checkin/checkout)
    const { rows: empRows } = await pool.query('SELECT status FROM employees WHERE id = $1', [employeeId]);
    if (!empRows.length) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    }
    if (empRows[0].status !== 'active') {
      return res.status(400).json({ error: 'Nhân viên đã nghỉ việc, không thể chấm công' });
    }

    // Kiểm tra xem giờ vào có sớm hơn giờ ra không
    const toSeconds = (t) => {
      const parts = t.split(':').map(Number);
      return parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    };
    if (check_in && check_out && toSeconds(check_in) > toSeconds(check_out)) {
      return res.status(400).json({ error: 'Giờ vào phải sớm hơn giờ ra' });
    }

    const { rows } = await pool.query(
      `INSERT INTO attendance (employee_id, work_date, check_in, check_out, status, note)
       VALUES ($1,$2,$3,$4,COALESCE($5,'Đi làm'),$6)
       ON CONFLICT (employee_id, work_date)
       DO UPDATE SET check_in=$3, check_out=$4, status=COALESCE($5,'Đi làm'), note=$6
       RETURNING *`,
      [employeeId, work_date, check_in || null, check_out || null, status || null, note || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    }
    next(err);
  }
});

// DELETE /api/attendance/:id — CHỈ dành cho quản lý
router.delete('/:id', requireManagerRole, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID không hợp lệ' });

    const { rowCount } = await pool.query('DELETE FROM attendance WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/export/xlsx?from=&to=&employee_id=&department=
router.get('/export/xlsx', requireManagerRole, async (req, res, next) => {
  try {
    const scoped = scopeQueryToUser(req);
    if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
    const { where, params, error } = buildFilters(scoped.query);
    if (error) return res.status(400).json({ error });

    const { rows } = await pool.query(
      `SELECT e.employee_code, e.full_name, e.department, e.position,
              a.work_date, a.check_in, a.check_out, a.status, a.note
       FROM attendance a JOIN employees e ON e.id = a.employee_id
       ${where}
       ORDER BY a.work_date ASC, e.full_name ASC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Office Attendance';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Bang cham cong');
    sheet.columns = [
      { header: 'Mã NV', key: 'employee_code', width: 12 },
      { header: 'Họ tên', key: 'full_name', width: 26 },
      { header: 'Phòng ban', key: 'department', width: 18 },
      { header: 'Chức vụ', key: 'position', width: 18 },
      { header: 'Ngày', key: 'work_date', width: 14 },
      { header: 'Giờ vào', key: 'check_in', width: 12 },
      { header: 'Giờ ra', key: 'check_out', width: 12 },
      { header: 'Trạng thái', key: 'status', width: 16 },
      { header: 'Ghi chú', key: 'note', width: 24 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2333' } };

    rows.forEach((r) => {
      sheet.addRow({
        employee_code: safeCell(r.employee_code),
        full_name: safeCell(r.full_name),
        department: safeCell(r.department),
        position: safeCell(r.position),
        work_date: formatDateVN(r.work_date),
        check_in: safeCell(r.check_in),
        check_out: safeCell(r.check_out),
        status: safeCell(r.status),
        note: safeCell(r.note),
      });
    });

    sheet.autoFilter = { from: 'A1', to: 'I1' };

    const fileName = `bang-cham-cong_${todayStr()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;
