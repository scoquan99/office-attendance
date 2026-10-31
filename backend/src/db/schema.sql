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

-- ---------------------------------------------------------------------------
-- Nâng cấp cho database đã có sẵn (an toàn khi chạy lại nhiều lần).
-- File này được backend tự áp dụng mỗi lần khởi động (xem initDb trong src/db.js),
-- nên mọi thay đổi cấu trúc bảng hãy thêm vào đây thay vì tạo thêm file migration riêng.
-- ---------------------------------------------------------------------------
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- true = nhân viên đang dùng mật khẩu tạm do quản lý cấp, bắt buộc phải đổi trước khi dùng hệ thống
ALTER TABLE employees ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Sinh mã nhân viên tự động (NV0001, NV0002...) an toàn khi nhiều người đăng ký cùng lúc
CREATE SEQUENCE IF NOT EXISTS employee_code_seq;

-- Mã nhân viên và email phải duy nhất KHÔNG phân biệt hoa/thường (NV0001 và nv0001 là cùng một mã; một email chỉ
-- thuộc một nhân viên). Nếu database cũ đã có dữ liệu trùng thì bỏ qua (kèm cảnh báo trong log của backend) thay vì
-- làm backend không khởi động được; xử lý dữ liệu trùng rồi khởi động lại để ràng buộc có hiệu lực.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM employees GROUP BY lower(employee_code) HAVING count(*) > 1) THEN
    RAISE WARNING 'Bỏ qua ràng buộc duy nhất cho mã nhân viên: đang có mã trùng nhau khi không phân biệt hoa/thường';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS employees_code_lower_key ON employees (lower(employee_code));
  END IF;

  IF EXISTS (
    SELECT 1 FROM employees WHERE email IS NOT NULL AND email <> '' GROUP BY lower(email) HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'Bỏ qua ràng buộc duy nhất cho email: đang có email trùng nhau';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_key
      ON employees (lower(email)) WHERE email IS NOT NULL AND email <> '';
  END IF;
END $$;
