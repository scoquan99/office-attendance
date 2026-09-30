import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { isManagerPosition } from '../config/managerPositions.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Middleware bảo vệ route: yêu cầu header Authorization: Bearer <token>
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, employee_code, full_name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
}

// Middleware: chỉ cho phép các chức vụ quản lý (2 chức vụ cao nhất mỗi phòng ban,
// trừ Ban Giám đốc) đi qua. Luôn dùng SAU requireAuth, và luôn tra chức vụ mới nhất
// từ database (không dùng chức vụ lưu trong token) để tránh quyền bị lỗi thời khi
// chức vụ của nhân viên vừa được đổi.
export async function requireManagerRole(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT position FROM employees WHERE id = $1', [req.user.id]);
    const position = rows[0]?.position;
    if (!isManagerPosition(position)) {
      return res.status(403).json({
        error: 'Bạn không có quyền thêm nhân viên. Chỉ các chức vụ quản lý cấp cao của từng phòng ban mới được phép.',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}
