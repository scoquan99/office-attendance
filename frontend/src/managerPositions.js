// Danh sách các chức vụ được phép THÊM/XÓA nhân viên.
// Quy tắc: lãnh đạo cao nhất công ty (Ban Giám đốc, trừ vị trí Trợ lý/Thư ký vì
// không phải chức danh ra quyết định), CỘNG 2 chức vụ cao nhất của mỗi phòng ban còn lại.
// Phải khớp với backend/src/config/managerPositions.js.

export const MANAGER_POSITIONS = [
  'Chủ tịch HĐQT / Chủ sở hữu',
  'Tổng Giám đốc (CEO)',
  'Phó Tổng Giám đốc',
  'CFO / Giám đốc Tài chính',
  'Kế toán trưởng',
  'Trưởng phòng Hành chính',
  'Chuyên viên Hành chính',
  'HR Director / HR Manager',
  'Trưởng phòng Nhân sự',
  'Trưởng phòng Mua hàng',
  'Procurement Manager',
  'Sales Director',
  'Trưởng phòng Kinh doanh',
  'Marketing Director / Manager',
  'Digital Marketing Specialist',
  'CSKH Manager',
  'Team Leader',
  'Giám đốc Sản xuất',
  'Trưởng phòng Kỹ thuật',
  'QA Manager',
  'QC Manager',
  'R&D Manager',
  'Product Researcher',
  'CTO',
  'IT Manager',
  'Legal Manager',
  'Internal Control Manager',
];

export function isManagerPosition(position) {
  return !!position && MANAGER_POSITIONS.includes(position);
}
