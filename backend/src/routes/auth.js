import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login { employee_code, password }
router.post('/login', async (req, res, next) => {
  try {
    const { employee_code, password } = req.body;
    if (!employee_code || !password) {
      return res.status(400).json({ error: 'Thiếu mã nhân viên hoặc mật khẩu' });
    }

    const { rows } = await pool.query(
      `SELECT id, employee_code, full_name, department, position, phone, email, status, password_hash
       FROM employees WHERE employee_code = $1`,
      [employee_code]
    );
    const emp = rows[0];

    if (!emp || !emp.password_hash) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc chưa được cấp mật khẩu đăng nhập' });
    }
    if (emp.status !== 'active') {
      return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa' });
    }

    const ok = await bcrypt.compare(password, emp.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Sai mã nhân viên hoặc mật khẩu' });
    }

    const token = jwt.sign(
      { id: emp.id, employee_code: emp.employee_code, full_name: emp.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      employee: {
        id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department: emp.department,
        position: emp.position,
        phone: emp.phone,
        email: emp.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — lấy thông tin người đang đăng nhập từ token
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, employee_code, full_name, department, position, phone, email
       FROM employees WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register — nhân viên mới tự đăng ký tài khoản
router.post('/register', async (req, res, next) => {
  try {
    const { full_name, phone, email, department, position, password } = req.body;

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
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu cần ít nhất 6 ký tự' });
    }

    const employee_code = await generateEmployeeCode();
    const password_hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO employees (employee_code, full_name, department, position, phone, email, start_date, status, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, 'active', $7)
       RETURNING id, employee_code, full_name, department, position, phone, email`,
      [employee_code, full_name.trim(), department, position, phone.trim(), email.trim(), password_hash]
    );
    const emp = rows[0];

    const token = jwt.sign(
      { id: emp.id, employee_code: emp.employee_code, full_name: emp.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, employee: emp });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Có lỗi trùng dữ liệu, vui lòng thử lại' });
    }
    next(err);
  }
});

// Sinh mã nhân viên tự động dạng NV0001, NV0002... không trùng với mã đã có
async function generateEmployeeCode() {
  const { rows } = await pool.query(
    `SELECT employee_code FROM employees WHERE employee_code ~ '^NV[0-9]{4}$' ORDER BY employee_code DESC LIMIT 1`
  );
  let next = rows.length ? parseInt(rows[0].employee_code.slice(2), 10) + 1 : 1;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = 'NV' + String(next).padStart(4, '0');
    const { rows: dup } = await pool.query('SELECT 1 FROM employees WHERE employee_code = $1', [candidate]);
    if (!dup.length) return candidate;
    next += 1;
  }
  throw new Error('Không tạo được mã nhân viên, vui lòng thử lại');
}

export default router;
