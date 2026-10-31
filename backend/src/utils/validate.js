// Các hàm kiểm tra dữ liệu đầu vào dùng chung cho các route.

// Ngày dạng YYYY-MM-DD và PHẢI là ngày có thật trên lịch (từ chối 2026-13-45, 2026-02-30...).
export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

// Giờ dạng HH:MM hoặc HH:MM:SS với giờ 00-23, phút/giây 00-59 (từ chối 99:99).
export function isValidTime(value) {
  const match = typeof value === 'string' && value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return false;
  const [, h, m, s] = match;
  return Number(h) <= 23 && Number(m) <= 59 && (s === undefined || Number(s) <= 59);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tên ràng buộc duy nhất của email trong schema.sql (dùng để báo đúng lỗi khi trùng email)
export const EMAIL_UNIQUE_KEY = 'employees_email_lower_key';

// Độ dài tối đa theo đúng giới hạn cột trong schema.sql
export const EMPLOYEE_LIMITS = {
  employee_code: 20,
  full_name: 100,
  department: 100,
  position: 100,
  phone: 20,
  email: 100,
};

// Kiểm tra MỘT trường của nhân viên. Trả về chuỗi lỗi, hoặc null nếu hợp lệ.
// Chuỗi rỗng / null / undefined được coi là "không có giá trị" (việc bắt buộc nhập do route tự kiểm).
export function checkEmployeeField(field, value) {
  if (value === undefined || value === null || value === '') return null;

  if (field === 'start_date') {
    return isValidDate(value) ? null : 'start_date phải là ngày hợp lệ dạng YYYY-MM-DD';
  }

  const max = EMPLOYEE_LIMITS[field];
  if (max === undefined) return null;

  if (typeof value !== 'string') return `${field} phải là chuỗi ký tự`;
  if (value.length > max) return `${field} tối đa ${max} ký tự`;
  if (field === 'email' && !EMAIL_RE.test(value.trim())) return 'Email không hợp lệ';
  return null;
}
