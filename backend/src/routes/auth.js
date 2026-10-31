import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuthAllowPasswordChange, signToken } from '../middleware/auth.js';
import { isManagerPosition } from '../config/managerPositions.js';
import { checkOrgPair } from '../config/orgStructure.js';
import {
  loginIpLimiter,
  loginAccountLimiter,
  registerLimiter,
  changePasswordLimiter,
} from '../middleware/rateLimit.js';
import { checkEmployeeField, EMAIL_UNIQUE_KEY } from '../utils/validate.js';
import { nextEmployeeCode } from '../utils/employeeCode.js';

const router = Router();

const MIN_PASSWORD_LENGTH = 8;
// bcrypt chỉ dùng 72 byte đầu của mật khẩu; giới hạn còn tránh gửi mật khẩu khổng lồ để làm nặng server.
const MAX_PASSWORD_LENGTH = 72;

// POST /api/auth/login { employee_code, password }
router.post('/login', loginIpLimiter, loginAccountLimiter, async (req, res, next) => {
  try {
    const { employee_code, password } = req.body || {};
    if (!employee_code || !password) {
      return res.status(400).json({ error: 'Thiếu mã nhân viên hoặc mật khẩu' });
    }
    if (typeof employee_code !== 'string' || employee_code.length > 20 || String(password).length > MAX_PASSWORD_LENGTH) {
      return res.status(401).json({ error: 'Sai mã nhân viên hoặc mật khẩu' });
    }

    const { rows } = await pool.query(
      `SELECT id, employee_code, full_name, department, position, phone, email, status, password_hash,
              must_change_password
       FROM employees WHERE lower(employee_code) = lower($1)`,
      [employee_code]
    );
    const emp = rows[0];

    // Dùng chung một thông báo cho "không tồn tại / chưa có mật khẩu / sai mật khẩu"
    // để người ngoài không dò được mã nhân viên nào đang có tài khoản.
    if (!emp || !emp.password_hash) {
      return res.status(401).json({ error: 'Sai mã nhân viên hoặc mật khẩu' });
    }

    const ok = await bcrypt.compare(String(password), emp.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Sai mã nhân viên hoặc mật khẩu' });
    }
    // Đã nhập đúng mật khẩu nhưng tài khoản tự đăng ký chưa được quản lý duyệt
    if (emp.status === 'pending') {
      return res.status(403).json({
        error: 'Tài khoản của bạn đang chờ quản lý phê duyệt. Vui lòng quay lại sau khi được duyệt.',
        code: 'ACCOUNT_PENDING',
      });
    }
    if (emp.status !== 'active') {
      return res.status(401).json({ error: 'Sai mã nhân viên hoặc mật khẩu' });
    }

    res.json({
      token: signToken(emp),
      employee: {
        id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department: emp.department,
        position: emp.position,
        phone: emp.phone,
        email: emp.email,
        isManager: isManagerPosition(emp.position),
        must_change_password: emp.must_change_password,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — lấy thông tin người đang đăng nhập từ token
// (vẫn dùng được khi đang phải đổi mật khẩu, để giao diện biết cần hiện màn hình đổi mật khẩu)
router.get('/me', requireAuthAllowPasswordChange, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, employee_code, full_name, department, position, phone, email, must_change_password
       FROM employees WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    res.json({ ...rows[0], isManager: req.user.isManager });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password { current_password, new_password }
// Trả về token MỚI: đổi mật khẩu làm mọi token cũ (kể cả token đang dùng) mất hiệu lực.
router.post('/change-password', requireAuthAllowPasswordChange, changePasswordLimiter, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || typeof new_password !== 'string' || !current_password || !new_password) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' });
    }
    if (new_password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
    }
    if (new_password.length > MAX_PASSWORD_LENGTH || current_password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự` });
    }
    if (new_password === current_password) {
      return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
    }

    const { rows } = await pool.query(
      'SELECT id, employee_code, full_name, password_hash FROM employees WHERE id = $1',
      [req.user.id]
    );
    const emp = rows[0];
    // Dùng 400 (không dùng 401) vì giao diện tự đăng xuất khi nhận 401
    if (!emp || !emp.password_hash || !(await bcrypt.compare(current_password, emp.password_hash))) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE employees SET password_hash = $1, must_change_password = false WHERE id = $2',
      [password_hash, emp.id]
    );

    res.json({ token: signToken({ ...emp, password_hash }) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register — nhân viên mới tự đăng ký tài khoản
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { full_name, phone, email, department, position, password } = req.body || {};

    // Các trường phải là chuỗi và không vượt quá giới hạn cột trong database
    const fields = { full_name, phone, email, department, position };
    for (const [field, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return res.status(400).json({ error: `${field} phải là chuỗi ký tự` });
      }
      const fieldError = checkEmployeeField(field, typeof value === 'string' ? value.trim() : value);
      if (fieldError) return res.status(400).json({ error: fieldError });
    }

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Thiếu họ tên' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Thiếu số điện thoại' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }
    if (!department) {
      return res.status(400).json({ error: 'Vui lòng chọn phòng ban' });
    }
    if (!position) {
      return res.status(400).json({ error: 'Vui lòng chọn chức vụ' });
    }
    // Phòng ban / chức vụ phải nằm trong cơ cấu tổ chức của công ty (danh sách lấy từ GET /api/org).
    // Dùng thống nhất bản đã trim cho kiểm tra, kiểm tra chức vụ quản lý và lưu vào database.
    const dept = department.trim();
    const pos = position.trim();
    const orgError = checkOrgPair(dept, pos);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }
    // Chức vụ quản lý có quyền thêm/xóa nhân viên nên KHÔNG được tự chọn khi đăng ký.
    // Chức vụ này phải do quản lý hiện có cấp (qua màn hình Nhân sự) hoặc gán trực tiếp trong database.
    if (isManagerPosition(pos)) {
      return res.status(403).json({
        error: 'Chức vụ quản lý không thể tự đăng ký. Vui lòng chọn chức vụ khác và nhờ quản lý cập nhật sau.',
      });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự` });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Mã nhân viên lấy từ sequence nên không trùng giữa các lượt đăng ký đồng thời. Nếu vẫn đụng mã
    // (ví dụ quản lý vừa nhập tay đúng mã đó) thì lấy mã mới và thử lại.
    let emp;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const employee_code = await nextEmployeeCode();
      try {
        const { rows } = await pool.query(
          `INSERT INTO employees (employee_code, full_name, department, position, phone, email, start_date, status, password_hash)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, 'pending', $7)
           RETURNING id, employee_code, full_name, department, position, phone, email`,
          [employee_code, full_name.trim(), dept, pos, phone.trim(), email.trim(), password_hash]
        );
        emp = rows[0];
        break;
      } catch (err) {
        // Trùng email thì lấy mã mới thử lại cũng vô ích: báo cho người dùng biết ngay
        if (err.code !== '23505' || err.constraint === EMAIL_UNIQUE_KEY || attempt === 2) throw err;
      }
    }

    // Tài khoản tự đăng ký ở trạng thái 'pending': chưa đăng nhập được và chưa thấy dữ liệu công ty cho tới khi
    // quản lý duyệt (đổi status thành 'active'). Vì vậy KHÔNG trả token ở đây.
    res.status(201).json({
      pending: true,
      employee: {
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department: emp.department,
        position: emp.position,
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error:
          err.constraint === EMAIL_UNIQUE_KEY
            ? 'Email này đã được dùng cho một tài khoản khác'
            : 'Có lỗi trùng dữ liệu, vui lòng thử lại',
      });
    }
    next(err);
  }
});

export default router;
