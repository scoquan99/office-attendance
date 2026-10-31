import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import employeesRouter from './routes/employees.js';
import attendanceRouter from './routes/attendance.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import orgRouter from './routes/org.js';
import { requireAuth } from './middleware/auth.js';
import { initDb } from './db.js';
import { todayStr, OFFICE_TZ } from './utils/time.js';

dotenv.config();

const app = express();

// Khi chạy sau reverse proxy (nginx trong docker-compose) đặt TRUST_PROXY=1 để req.ip là IP thật
// của người dùng — nếu không, rate limit sẽ coi mọi người là cùng một IP (của nginx).
if (process.env.TRUST_PROXY) {
  const n = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isInteger(n) ? n : process.env.TRUST_PROXY);
}

app.use(helmet());

// Frontend gọi /api cùng origin (qua nginx hoặc Vite proxy) nên mặc định KHÔNG bật CORS.
// Chỉ khi frontend chạy ở origin khác mới đặt CORS_ORIGIN (nhiều origin cách nhau bằng dấu phẩy).
if (process.env.CORS_ORIGIN) {
  const origins = process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins }));
}

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Múi giờ văn phòng + ngày hôm nay theo giờ văn phòng: để giao diện hiển thị "hôm nay" giống hệt cách server chấm công
app.get('/api/meta', (req, res) => res.json({ timezone: OFFICE_TZ, today: todayStr() }));

// Đăng nhập và danh sách phòng ban/chức vụ không cần token, các route còn lại yêu cầu đã đăng nhập
app.use('/api/auth', authRouter);
app.use('/api/org', orgRouter);
app.use('/api/employees', requireAuth, employeesRouter);
app.use('/api/attendance', requireAuth, attendanceRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/tasks', requireAuth, tasksRouter);

// Middleware xử lý lỗi chung.
// KHÔNG trả err.message về client: lỗi từ PostgreSQL chứa tên bảng/cột. Chỉ ghi log phía server.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Dữ liệu JSON gửi lên không hợp lệ' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn' });
  }

  console.error(err);
  res.status(500).json({ error: 'Lỗi server, vui lòng thử lại sau' });
});

const PORT = process.env.PORT || 4000;

// Áp dụng schema.sql (tự nâng cấp database cũ, đợi Postgres khởi động xong) rồi mới nhận request.
// Không kết nối được sau nhiều lần thử thì dừng hẳn (Docker sẽ tự khởi động lại) thay vì chạy nửa vời.
try {
  await initDb();
} catch (err) {
  console.error('Không thể khởi tạo database:', err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
