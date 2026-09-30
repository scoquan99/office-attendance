import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/dashboard?date=YYYY-MM-DD
// Gom nhóm nhân viên đang làm việc theo phòng ban, kèm trạng thái chấm công
// của ngày được chọn (mặc định hôm nay) để dễ kiểm soát số lượng & ai đã vào làm.
router.get('/', async (req, res, next) => {
  try {
    const date = req.query.date || todayStr();
    const { rows } = await pool.query(
      `SELECT e.id, e.employee_code, e.full_name, e.department, e.position,
              a.check_in, a.check_out, a.status AS attendance_status, a.note
       FROM employees e
       LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = $1
       WHERE e.status = 'active'
       ORDER BY COALESCE(e.department, 'zzz_chua_phan_ban') ASC, e.full_name ASC`,
      [date]
    );

    const groups = new Map();
    for (const r of rows) {
      const dept = r.department || 'Chưa phân ban';
      if (!groups.has(dept)) {
        groups.set(dept, {
          department: dept,
          total: 0,
          checked_in: 0,
          checked_out: 0,
          not_checked_in: 0,
          employees: [],
        });
      }
      const g = groups.get(dept);
      g.total += 1;
      if (r.check_in) g.checked_in += 1;
      else g.not_checked_in += 1;
      if (r.check_out) g.checked_out += 1;

      g.employees.push({
        id: r.id,
        employee_code: r.employee_code,
        full_name: r.full_name,
        position: r.position,
        check_in: r.check_in,
        check_out: r.check_out,
        status: r.check_in ? (r.attendance_status || 'Đi làm') : 'Chưa chấm công',
        note: r.note,
      });
    }

    const summary = {
      date,
      total: rows.length,
      checked_in: rows.filter((r) => r.check_in).length,
      not_checked_in: rows.filter((r) => !r.check_in).length,
    };

    res.json({ summary, departments: Array.from(groups.values()) });
  } catch (err) {
    next(err);
  }
});

export default router;
