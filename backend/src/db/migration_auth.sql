-- Migration: thêm chức năng đăng nhập cho database ĐÃ có sẵn dữ liệu.
-- Chạy file này trong Query Tool của pgAdmin, trên database office-attendance
-- (chỉ cần chạy 1 lần).

-- 1) Thêm cột lưu mật khẩu (đã băm) vào bảng employees.
--    NULL = nhân viên đó chưa được cấp tài khoản đăng nhập.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- 2) Cấp tài khoản đăng nhập cho nhân viên Do Hong Quan (mã NV: 2301140082)
--    để bạn kiểm thử. Đăng nhập bằng:
--      Mã nhân viên: 2301140082
--      Mật khẩu:     123456
--    (đây là mật khẩu để test, hãy đổi/xóa khi dùng thật)
UPDATE employees
SET password_hash = '$2b$10$e0X3Ss22wjPRNJ.WZ.hGt.Iy0BPbG3t/4rgejY9AEQw2vkk/Q87q.'
WHERE employee_code = '2301140082';
