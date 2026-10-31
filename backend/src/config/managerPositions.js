// Danh sách các chức vụ được phép THÊM/XÓA nhân viên.
// Quy tắc: lãnh đạo cao nhất công ty (Ban Giám đốc, trừ vị trí Trợ lý/Thư ký vì
// không phải chức danh ra quyết định), CỘNG 2 chức vụ cao nhất của mỗi phòng ban còn lại.
// Mọi chức vụ ở đây phải có trong config/orgStructure.js (nguồn duy nhất của danh sách chức vụ).
// Frontend lấy danh sách này qua GET /api/org, không giữ bản sao riêng.
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

// Bậc của chức vụ (càng cao càng quyền lực). Dùng để chặn quản lý vô hiệu hoá / hạ cấp / gán chức vụ
// cho người có bậc BẰNG hoặc CAO HƠN mình.
//   Ban Giám đốc: Chủ tịch (4) > Tổng Giám đốc (3) > Phó Tổng Giám đốc (2)
//   Quản lý các phòng ban: 1  |  Nhân viên thường: 0
const EXECUTIVE_RANKS = {
  'Chủ tịch HĐQT / Chủ sở hữu': 4,
  'Tổng Giám đốc (CEO)': 3,
  'Phó Tổng Giám đốc': 2,
};

export function positionRank(position) {
  if (!position) return 0;
  if (EXECUTIVE_RANKS[position]) return EXECUTIVE_RANKS[position];
  return isManagerPosition(position) ? 1 : 0;
}
