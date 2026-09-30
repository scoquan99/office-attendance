import { Router } from 'express';
import ExcelJS from 'exceljs';
import { pool } from '../db.js';

const router = Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function timeStr() {
  return new Date().toTimeString().slice(0, 8);
}

function buildFilters(query) {
  const { from, to, employee_id, department } = query;
  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`a.work_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`a.work_date <= $${params.length}`);
  }
  if (employee_id) {
    params.push(employee_id);
    conditions.push(`a.employee_id = $${params.length}`);
  }
  if (department) {
    params.push(department);
    conditions.push(`e.department = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// GET /api/attendance?from=&to=&employee_id=&department=
router.get('/', async (req, res, next) => {
  try {
    const { where, params } = buildFilters(req.query);
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
router.post('/checkin', async (req, res, next) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'Thiếu employee_id' });

    const { rows } = await pool.query(
      `INSERT INTO attendance (employee_id, work_date, check_in, status)
       VALUES ($1, $2, $3, 'Đi làm')
       ON CONFLICT (employee_id, work_date)
       DO UPDATE SET check_in = COALESCE(attendance.check_in, EXCLUDED.check_in)
       RETURNING *`,
      [employee_id, todayStr(), timeStr()]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/attendance/checkout { employee_id }
router.post('/checkout', async (req, res, next) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'Thiếu employee_id' });

    const { rows } = await pool.query(
      `UPDATE attendance SET check_out = $1
       WHERE employee_id = $2 AND work_date = $3
       RETURNING *`,
      [timeStr(), employee_id, todayStr()]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Nhân viên chưa chấm công vào trong hôm nay' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/attendance  (tạo/sửa thủ công bởi quản trị viên)
router.post('/', async (req, res, next) => {
  try {
    const { employee_id, work_date, check_in, check_out, status, note } = req.body;
    if (!employee_id || !work_date) {
      return res.status(400).json({ error: 'Thiếu employee_id hoặc work_date' });
    }
    const { rows } = await pool.query(
      `INSERT INTO attendance (employee_id, work_date, check_in, check_out, status, note)
       VALUES ($1,$2,$3,$4,COALESCE($5,'Đi làm'),$6)
       ON CONFLICT (employee_id, work_date)
       DO UPDATE SET check_in=$3, check_out=$4, status=COALESCE($5,'Đi làm'), note=$6
       RETURNING *`,
      [employee_id, work_date, check_in || null, check_out || null, status, note || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM attendance WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/export/xlsx?from=&to=&employee_id=&department=
router.get('/export/xlsx', async (req, res, next) => {
  try {
    const { where, params } = buildFilters(req.query);
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
        ...r,
        work_date: r.work_date ? new Date(r.work_date).toLocaleDateString('vi-VN') : '',
      });
    });

    sheet.autoFilter = { from: 'A1', to: 'I1' };

    const fileName = `bang-cham-cong_${todayStr()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;
