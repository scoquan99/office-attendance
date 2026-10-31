-- Dữ liệu mẫu (tùy chọn) để test nhanh.
--
-- - Các bảng được tạo bởi schema.sql (Docker nạp schema.sql trước file này; chạy tay thì khởi động backend một lần trước).
-- - Nhân viên mẫu KHÔNG có tài khoản đăng nhập (repo không chứa mật khẩu hay hash mật khẩu nào).
--   Khi cần, quản lý dùng nút "Cấp lại MK" trong trang Nhân sự để cấp mật khẩu tạm.
-- - Phòng ban / chức vụ dùng đúng tên trong backend/src/config/orgStructure.js.
INSERT INTO employees (employee_code, full_name, department, position, phone, email, start_date, status)
VALUES
  ('NV001', 'Nguyễn Văn An', 'Kinh doanh', 'Sales Representative', '0901234567', 'an.nguyen@congty.vn', '2023-03-01', 'active'),
  ('NV002', 'Trần Thị Bình', 'Tài chính – Kế toán', 'Kế toán tổng hợp', '0912345678', 'binh.tran@congty.vn', '2022-06-15', 'active'),
  ('NV003', 'Lê Hoàng Cường', 'IT / Software', 'Backend Developer', '0987654321', 'cuong.le@congty.vn', '2024-01-10', 'active')
ON CONFLICT (employee_code) DO NOTHING;
