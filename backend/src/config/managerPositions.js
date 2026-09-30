// Danh sách các chức vụ được phép THÊM/XÓA nhân viên.
// Quy tắc: lãnh đạo cao nhất công ty (Ban Giám đốc, trừ vị trí Trợ lý/Thư ký vì
// không phải chức danh ra quyết định), CỘNG 2 chức vụ cao nhất của mỗi phòng ban còn lại.
// Phải khớp với danh sách chức vụ trong frontend/src/orgStructure.js.
//
// Ghi chú: một vài phòng ban (Marketing, R&D) trong tài liệu cơ cấu tổ chức chỉ có
// đúng 1 chức vụ quản lý rõ ràng (không có cấp phó/trưởng phòng riêng), nên vị trí
// thứ 2 lấy theo chức danh chuyên viên xếp đầu tiên trong danh sách của phòng đó.

export const MANAGER_POSITIONS = [
  // Ban Giám đốc (lãnh đạo cao nhất công ty)
  'Chủ tịch HĐQT / Chủ sở hữu',
  'Tổng Giám đốc (CEO)',
  'Phó Tổng Giám đốc',
  // Tài chính – Kế toán
  'CFO / Giám đốc Tài chính',
  'Kế toán trưởng',
  // Hành chính
  'Trưởng phòng Hành chính',
  'Chuyên viên Hành chính',
  // Nhân sự
  'HR Director / HR Manager',
  'Trưởng phòng Nhân sự',
  // Mua hàng – Cung ứng
  'Trưởng phòng Mua hàng',
  'Procurement Manager',
  // Kinh doanh
  'Sales Director',
  'Trưởng phòng Kinh doanh',
  // Marketing (chỉ có 1 cấp quản lý rõ ràng trong tài liệu gốc)
  'Marketing Director / Manager',
  'Digital Marketing Specialist',
  // Chăm sóc khách hàng
  'CSKH Manager',
  'Team Leader',
  // Kỹ thuật / Sản xuất
  'Giám đốc Sản xuất',
  'Trưởng phòng Kỹ thuật',
  // QA/QC
  'QA Manager',
  'QC Manager',
  // R&D (chỉ có 1 cấp quản lý rõ ràng trong tài liệu gốc)
  'R&D Manager',
  'Product Researcher',
  // IT / Software
  'CTO',
  'IT Manager',
  // Pháp chế / Kiểm soát nội bộ
  'Legal Manager',
  'Internal Control Manager',
];

export function isManagerPosition(position) {
  return !!position && MANAGER_POSITIONS.includes(position);
}
