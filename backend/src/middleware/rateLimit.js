import rateLimit from 'express-rate-limit';

const WINDOW_15_MIN = 15 * 60 * 1000;

function limiter(options) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...options,
  });
}

// Đăng nhập: tối đa 20 lần SAI / 15 phút cho mỗi IP (lần đăng nhập thành công không bị tính).
export const loginIpLimiter = limiter({
  windowMs: WINDOW_15_MIN,
  limit: 20,
  skipSuccessfulRequests: true,
  message: { error: 'Bạn đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});

// Đăng nhập: tối đa 8 lần SAI / 15 phút cho mỗi MÃ NHÂN VIÊN — chặn dò mật khẩu một tài khoản
// ngay cả khi kẻ tấn công đổi IP liên tục.
export const loginAccountLimiter = limiter({
  windowMs: WINDOW_15_MIN,
  limit: 8,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `code:${String(req.body?.employee_code ?? '').trim().toLowerCase().slice(0, 50)}`,
  message: { error: 'Tài khoản này đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});

// Đăng ký: tối đa 10 tài khoản / giờ cho mỗi IP.
export const registerLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: 'Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau.' },
});

// Đổi mật khẩu: tối đa 10 lần SAI mật khẩu hiện tại / 15 phút cho mỗi tài khoản đang đăng nhập — chặn người
// lấy được token dò mật khẩu hiện tại. Phải đặt SAU middleware xác thực (cần req.user).
export const changePasswordLimiter = limiter({
  windowMs: WINDOW_15_MIN,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `uid:${req.user?.id ?? 'anon'}`,
  message: { error: 'Bạn đã nhập sai mật khẩu hiện tại quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});
