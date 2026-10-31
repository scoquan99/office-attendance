import axios from 'axios';

const TOKEN_KEY = 'office_attendance_token';

const api = axios.create({ baseURL: '/api' });

// Gắn token đăng nhập vào mọi request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Nếu token hết hạn/không hợp lệ, xóa phiên và quay lại màn hình đăng nhập
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 từ chính màn hình đăng nhập / đăng ký chỉ có nghĩa "sai thông tin", KHÔNG phải phiên hết hạn:
    // nếu tải lại trang ở đây thì thông báo lỗi bị xóa trước khi người dùng kịp đọc.
    const url = err?.config?.url || '';
    const isAuthAttempt = url.startsWith('/auth/login') || url.startsWith('/auth/register');
    const hadSession = Boolean(sessionStorage.getItem(TOKEN_KEY));
    if (err?.response?.status === 401 && hadSession && !isAuthAttempt) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('office_attendance_employee');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const AuthAPI = {
  tokenKey: TOKEN_KEY,
  login: (employee_code, password) => api.post('/auth/login', { employee_code, password }).then((r) => r.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  // Đổi mật khẩu → backend trả token MỚI (token cũ mất hiệu lực)
  changePassword: (current_password, new_password) =>
    api.post('/auth/change-password', { current_password, new_password }).then((r) => r.data),
};

export const EmployeesAPI = {
  list: (params) => api.get('/employees', { params }).then((r) => r.data),
  get: (id) => api.get(`/employees/${id}`).then((r) => r.data),
  create: (data) => api.post('/employees', data).then((r) => r.data),
  update: (id, data) => api.put(`/employees/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/employees/${id}`),
  // Quản lý cấp lại mật khẩu tạm → { temporary_password } (chỉ hiện một lần)
  resetPassword: (id) => api.post(`/employees/${id}/reset-password`).then((r) => r.data),
};

export const DashboardAPI = {
  get: (date) => api.get('/dashboard', { params: date ? { date } : {} }).then((r) => r.data),
};

export const AttendanceAPI = {
  list: (params) => api.get('/attendance', { params }).then((r) => r.data),
  checkin: (employee_id) => api.post('/attendance/checkin', { employee_id }).then((r) => r.data),
  checkout: (employee_id) => api.post('/attendance/checkout', { employee_id }).then((r) => r.data),
  save: (data) => api.post('/attendance', data).then((r) => r.data),
  remove: (id) => api.delete(`/attendance/${id}`),
  // Tải file Excel qua axios (có gắn Authorization) dưới dạng blob.
  // Không dùng window.open vì trình duyệt không gửi kèm header Authorization.
  exportXlsx: (params) =>
    api.get('/attendance/export/xlsx', { params, responseType: 'blob' }).then((r) => r.data),
};

// Danh sách phòng ban → chức vụ và chức vụ quản lý do backend trả ra (công khai, dùng cả ở trang đăng ký)
export const OrgAPI = {
  get: () => api.get('/org').then((r) => r.data),
};

// Múi giờ văn phòng và "hôm nay" theo server (công khai)
export const MetaAPI = {
  get: () => api.get('/meta').then((r) => r.data),
};

export const TasksAPI = {
  list: (employee_id) => api.get('/tasks', { params: { employee_id } }).then((r) => r.data),
  create: (data) => api.post('/tasks', data).then((r) => r.data),
  update: (id, data) => api.put(`/tasks/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/tasks/${id}`),
};

export default api;
