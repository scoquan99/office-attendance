import { Router } from 'express';
import { ORG_STRUCTURE } from '../config/orgStructure.js';

const router = Router();

// GET /api/org — danh sách phòng ban → chức vụ của công ty.
// Công khai (không cần token) vì trang Đăng ký cần danh sách này trước khi người dùng đăng nhập.
// Chỉ chứa tên phòng ban / chức vụ chung của công ty, không có dữ liệu cá nhân.
// (Quyền quản lý do backend quyết định và trả qua cờ isManager khi đăng nhập / GET /api/auth/me.)
router.get('/', (req, res) => {
  res.json({ departments: ORG_STRUCTURE });
});

export default router;
