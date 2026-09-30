-- Dữ liệu mẫu (tùy chọn) để test nhanh
INSERT INTO employees (employee_code, full_name, department, position, phone, email, start_date, status)
VALUES
  ('NV001', 'Nguyễn Văn An', 'Kinh doanh', 'Nhân viên kinh doanh', '0901234567', 'an.nguyen@congty.vn', '2023-03-01', 'active'),
  ('NV002', 'Trần Thị Bình', 'Kế toán', 'Kế toán viên', '0912345678', 'binh.tran@congty.vn', '2022-06-15', 'active'),
  ('NV003', 'Lê Hoàng Cường', 'IT', 'Lập trình viên', '0987654321', 'cuong.le@congty.vn', '2024-01-10', 'active')
ON CONFLICT (employee_code) DO NOTHING;
