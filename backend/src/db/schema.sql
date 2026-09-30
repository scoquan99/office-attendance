-- Schema cho hệ thống quản lý nhân sự / chấm công văn phòng

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_code VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  position VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  start_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | inactive
  password_hash VARCHAR(255), -- NULL = nhân viên chưa được cấp tài khoản đăng nhập
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status VARCHAR(30) NOT NULL DEFAULT 'Đi làm', -- Đi làm | Đi trễ | Nghỉ phép | Nghỉ không phép
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_work_date ON attendance(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  is_priority BOOLEAN NOT NULL DEFAULT false,
  is_done BOOLEAN NOT NULL DEFAULT false,
  assigned_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_employee ON tasks(employee_id);
