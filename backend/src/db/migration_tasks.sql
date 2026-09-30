-- Migration: thêm bảng "tasks" (công việc cần làm) cho từng nhân viên.
-- Chạy file này trong Query Tool của pgAdmin, trên database office-attendance
-- (chỉ cần chạy 1 lần).

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  is_priority BOOLEAN NOT NULL DEFAULT false,
  is_done BOOLEAN NOT NULL DEFAULT false,
  assigned_by INTEGER REFERENCES employees(id) ON DELETE SET NULL, -- ai giao việc này
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_employee ON tasks(employee_id);
