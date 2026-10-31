// Cơ cấu Phòng ban → Chức vụ của công ty, trích từ tài liệu
// "Cơ cấu tổ chức công ty hoàn chỉnh" do người dùng cung cấp.
//
// ĐÂY LÀ NGUỒN DUY NHẤT: frontend lấy danh sách này qua GET /api/org (không giữ bản sao riêng),
// và backend dùng chính nó để kiểm tra phòng ban / chức vụ khi đăng ký, thêm, sửa nhân viên.
// Mọi chức vụ trong MANAGER_POSITIONS (managerPositions.js) phải có mặt ở đây.

export const ORG_STRUCTURE = [
  {
    department: 'Ban Giám đốc',
    positions: [
      'Chủ tịch HĐQT / Chủ sở hữu',
      'Tổng Giám đốc (CEO)',
      'Phó Tổng Giám đốc',
      'Trợ lý / Thư ký TGĐ',
    ],
  },
  {
    department: 'Tài chính – Kế toán',
    positions: [
      'CFO / Giám đốc Tài chính',
      'Kế toán trưởng',
      'Kế toán tổng hợp',
      'Kế toán thuế',
      'Kế toán công nợ',
      'Kế toán kho',
      'Kế toán tiền lương',
      'Thủ quỹ',
    ],
  },
  {
    department: 'Hành chính',
    positions: [
      'Trưởng phòng Hành chính',
      'Chuyên viên Hành chính',
      'Nhân viên Văn thư',
      'Lễ tân',
      'Nhân viên Quản lý tài sản',
      'Nhân viên Hậu cần',
    ],
  },
  {
    department: 'Nhân sự',
    positions: [
      'HR Director / HR Manager',
      'Trưởng phòng Nhân sự',
      'Chuyên viên Tuyển dụng',
      'Chuyên viên C&B',
      'Chuyên viên Đào tạo',
      'HR Admin',
    ],
  },
  {
    department: 'Mua hàng – Cung ứng',
    positions: [
      'Trưởng phòng Mua hàng',
      'Procurement Manager',
      'Nhân viên Mua hàng',
      'Chuyên viên Nhà cung cấp',
    ],
  },
  {
    department: 'Kinh doanh',
    positions: [
      'Sales Director',
      'Trưởng phòng Kinh doanh',
      'Sales Manager',
      'Sales Team Leader',
      'Sales Representative',
    ],
  },
  {
    department: 'Marketing',
    positions: [
      'Marketing Director / Manager',
      'Digital Marketing Specialist',
      'Content Writer',
      'SEO Specialist',
      'Social Media Specialist',
      'Graphic Designer',
      'Video Editor',
      'PR/Event Executive',
    ],
  },
  {
    department: 'Chăm sóc khách hàng',
    positions: [
      'CSKH Manager',
      'Team Leader',
      'Customer Service Representative',
      'Customer Success Specialist',
    ],
  },
  {
    department: 'Kỹ thuật / Sản xuất',
    positions: [
      'Giám đốc Sản xuất',
      'Trưởng phòng Kỹ thuật',
      'Quản đốc',
      'Kỹ sư',
      'Kỹ thuật viên',
      'Tổ trưởng sản xuất',
      'Công nhân',
    ],
  },
  {
    department: 'QA/QC',
    positions: ['QA Manager', 'QC Manager', 'QA Specialist', 'QC Inspector'],
  },
  {
    department: 'R&D',
    positions: ['R&D Manager', 'Product Researcher', 'R&D Engineer', 'Lab Technician'],
  },
  {
    department: 'IT / Software',
    positions: [
      'CTO',
      'IT Manager',
      'Software Architect',
      'Backend Developer',
      'Frontend Developer',
      'Mobile Developer',
      'DevOps Engineer',
      'DBA',
      'QA/Tester',
      'IT Support',
      'System Administrator',
    ],
  },
  {
    department: 'Pháp chế / Kiểm soát nội bộ',
    positions: [
      'Legal Manager',
      'Legal Specialist / In-house Lawyer',
      'Internal Control Manager',
      'Internal Control Specialist',
    ],
  },
];

export const DEPARTMENT_NAMES = ORG_STRUCTURE.map((d) => d.department);

export function positionsForDepartment(department) {
  return ORG_STRUCTURE.find((d) => d.department === department)?.positions || [];
}

// Kiểm tra cặp (phòng ban, chức vụ). Chuỗi rỗng / null / undefined = "chưa chọn".
// Trả về chuỗi lỗi, hoặc null nếu hợp lệ.
export function checkOrgPair(department, position) {
  const dep = department || null;
  const pos = position || null;

  if (dep && !DEPARTMENT_NAMES.includes(dep)) return 'Phòng ban không hợp lệ';
  if (pos) {
    if (!dep) return 'Vui lòng chọn phòng ban trước khi chọn chức vụ';
    if (!positionsForDepartment(dep).includes(pos)) return 'Chức vụ không thuộc phòng ban đã chọn';
  }
  return null;
}
