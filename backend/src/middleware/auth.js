import 'dotenv/config';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { isManagerPosition } from '../config/managerPositions.js';

// Các giá trị mẫu có trong repo (công khai) — tuyệt đối không được dùng làm secret thật.
const PLACEHOLDER_SECRETS = ['dev-secret-change-me', 'change-me-to-a-random-secret'];

const GENERATE_HINT =
  'Tạo secret bằng: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"';

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  // Giá trị mẫu là thông tin công khai trong repo → ai cũng có thể tự ký token giả.
  // Từ chối ở MỌI môi trường (không chỉ production).
  if (secret && PLACEHOLDER_SECRETS.includes(secret)) {
    throw new Error(`JWT_SECRET đang dùng giá trị mẫu công khai. Hãy đặt một chuỗi ngẫu nhiên, dài. ${GENERATE_HINT}`);
  }

  if (secret) {
    return secret;
  }

  if (isProd) {
    // Chạy thật mà thiếu secret thì dừng hẳn, không chạy với secret ai cũng biết.
    throw new Error(`Thiếu JWT_SECRET. Hãy đặt một chuỗi ngẫu nhiên, dài trong biến môi trường. ${GENERATE_HINT}`);
  }

  // Môi trường dev: tạo secret ngẫu nhiên cho mỗi lần khởi động thay vì dùng hằng số đoán được.
  console.warn('[WARNING] JWT_SECRET not set — using temporary random secret (login will be invalid after server restart).');
  return crypto.randomBytes(32).toString('hex');
}

export const JWT_SECRET = resolveJwtSecret();

// "Dấu vân tay" của mật khẩu hiện tại (16 ký tự đầu của SHA-256 trên hash bcrypt, không lộ mật khẩu).
// Được ghi vào token lúc đăng nhập; khi mật khẩu đổi hoặc bị quản lý cấp lại thì dấu vân tay đổi theo
// và mọi token cũ tự mất hiệu lực — người đã lấy được token cũ không dùng tiếp được.
export function passwordFingerprint(passwordHash) {
  return passwordHash ? crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16) : '';
}

// Tạo token đăng nhập. employee cần có: id, employee_code, full_name, password_hash
// Thiết kế JWT:
//   - Thời hạn 7 ngày: phù hợp ứng dụng nội bộ văn phòng, tránh phiền khi phải đăng nhập lại hàng ngày.
//   - Không có refresh token / token revocation list:
//     mọi request đều đối chiếu lại DB trong requireAuth (xem bên dưới), nên tài khoản inactive
//     hoặc đã đổi mật khẩu bị chặn ngay dù token chưa hết hạn — thu hồi quyền gián tiếp hiệu quả.
//     Nếu cần logout tức thì phía server (không chờ token hết hạn), thêm bảng token_blacklist.
export function signToken(employee) {
  return jwt.sign(
    {
      id: employee.id,
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      ph: passwordFingerprint(employee.password_hash),
    },
    JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
}

async function authenticate(req, res, next, { allowPasswordChange }) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT position, status, password_hash, must_change_password FROM employees WHERE id = $1',
      [payload.id]
    );
    const emp = rows[0];
    if (!emp || emp.status !== 'active') {
      return res.status(401).json({ error: 'Tài khoản không còn hiệu lực' });
    }
    // Mật khẩu đã đổi / bị cấp lại sau khi token này được tạo → token cũ không còn dùng được
    if (payload.ph !== passwordFingerprint(emp.password_hash)) {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại' });
    }
    // Đang dùng mật khẩu tạm: chỉ được xem hồ sơ và đổi mật khẩu, mọi chức năng khác bị khóa tới khi đổi
    if (emp.must_change_password && !allowPasswordChange) {
      return res.status(403).json({
        error: 'Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    // req.user: { id, employee_code, full_name, position, isManager, mustChangePassword }
    req.user = {
      ...payload,
      position: emp.position,
      isManager: isManagerPosition(emp.position),
      mustChangePassword: emp.must_change_password,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Middleware bảo vệ route: yêu cầu header Authorization: Bearer <token>.
// Ngoài việc kiểm tra chữ ký token, luôn đối chiếu lại với database để:
//  - chặn tài khoản đã bị vô hiệu hóa / đã bị xóa (token cũ không còn dùng được),
//  - chặn token cũ sau khi mật khẩu đổi,
//  - lấy chức vụ MỚI NHẤT (không dùng chức vụ lưu trong token) để quyền không bị lỗi thời.
export function requireAuth(req, res, next) {
  return authenticate(req, res, next, { allowPasswordChange: false });
}

// Giống requireAuth nhưng vẫn cho đi qua khi tài khoản đang phải đổi mật khẩu.
// CHỈ dùng cho /auth/me và /auth/change-password.
export function requireAuthAllowPasswordChange(req, res, next) {
  return authenticate(req, res, next, { allowPasswordChange: true });
}

// Middleware: chỉ cho phép các chức vụ quản lý (2 chức vụ cao nhất mỗi phòng ban,
// trừ Ban Giám đốc) đi qua. Luôn dùng SAU requireAuth.
export function requireManagerRole(req, res, next) {
  if (!req.user?.isManager) {
    return res.status(403).json({
      error: 'Bạn không có quyền thực hiện thao tác này. Chỉ các chức vụ quản lý cấp cao của từng phòng ban mới được phép.',
    });
  }
  next();
}

// Người dùng chỉ được thao tác trên dữ liệu của CHÍNH MÌNH, trừ khi là quản lý.
export function canAccessEmployee(req, employeeId) {
  return Boolean(req.user?.isManager) || Number(employeeId) === Number(req.user?.id);
}
