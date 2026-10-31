import { Router } from 'express';
import { pool } from '../db.js';
import { isValidDate } from '../utils/validate.js';
import { todayStr } from '../utils/time.js';

const router = Router();

// Nhân viên đang nghỉ (đã được quản lý ghi "Nghỉ phép" / "Nghỉ không phép") và chưa chấm công vào:
// họ không thuộc nhóm "chưa chấm công" — trạng thái thật phải hiển thị và đếm riêng.
const LEAVE_STATUSES = ['Nghỉ phép', 'Nghỉ không phép'];
const isOnLeave = (r) => !r.check_in && LEAVE_STATUSES.includes(r.attendance_status);

// GET /api/dashboard?date=YYYY-MM-DD
// Gom nhóm nhân viên đang làm việc theo phòng ban, kèm trạng thái chấm công
// của ngày được chọn (mặc định hôm nay theo giờ văn phòng) để dễ kiểm soát số lượng & ai đã vào làm.
router.get('/', async (req, res, next) => {
  try {
    const date = req.query.date || todayStr();
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Tham số "date" phải là ngày hợp lệ dạng YYYY-MM-DD' });
    }
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
          on_leave: 0,
          employees: [],
        });
      }
      const g = groups.get(dept);
      g.total += 1;
      if (r.check_in) g.checked_in += 1;
      else if (isOnLeave(r)) g.on_leave += 1;
      else g.not_checked_in += 1;
      if (r.check_out) g.checked_out += 1;

      g.employees.push({
        id: r.id,
        employee_code: r.employee_code,
        full_name: r.full_name,
        position: r.position,
        check_in: r.check_in,
        check_out: r.check_out,
        status: r.check_in
          ? (r.attendance_status || 'Đi làm')
          : isOnLeave(r) ? r.attendance_status : 'Chưa chấm công',
        note: r.note,
      });
    }

    const summary = {
      date,
      total: rows.length,
      checked_in: rows.filter((r) => r.check_in).length,
      not_checked_in: rows.filter((r) => !r.check_in && !isOnLeave(r)).length,
      on_leave: rows.filter(isOnLeave).length,
    };

    const departments = Array.from(groups.values());
    // Nhân viên thường chỉ thấy dòng của chính mình; số liệu tổng hợp cũng chỉ phản ánh dữ liệu họ thấy,
    // tránh lộ quy mô nhân sự và tình trạng chấm công toàn bộ phòng ban.
    if (!req.user.isManager) {
      for (const g of departments) {
        g.employees = g.employees.filter((e) => e.id === req.user.id);
        g.total = g.employees.length;
        g.checked_in = g.employees.filter((e) => e.check_in).length;
        g.checked_out = g.employees.filter((e) => e.check_out).length;
        g.on_leave = g.employees.filter((e) => e.status === 'Nghỉ phép' || e.status === 'Nghỉ không phép').length;
        g.not_checked_in = g.total - g.checked_in - g.on_leave;
      }
      const allEmps = departments.flatMap((g) => g.employees);
      summary.total = allEmps.length;
      summary.checked_in = allEmps.filter((e) => e.check_in).length;
      summary.on_leave = allEmps.filter((e) => e.status === 'Nghỉ phép' || e.status === 'Nghỉ không phép').length;
      summary.not_checked_in = summary.total - summary.checked_in - summary.on_leave;
    }

    res.json({ summary, departments });
  } catch (err) {
    next(err);
  }
});

export default router;
