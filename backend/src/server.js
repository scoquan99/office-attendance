import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import employeesRouter from './routes/employees.js';
import attendanceRouter from './routes/attendance.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Đăng nhập không cần token, các route còn lại yêu cầu đã đăng nhập
app.use('/api/auth', authRouter);
app.use('/api/employees', requireAuth, employeesRouter);
app.use('/api/attendance', requireAuth, attendanceRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/tasks', requireAuth, tasksRouter);

// Middleware xử lý lỗi chung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Lỗi server' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
