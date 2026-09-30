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
    if (err?.response?.status === 401) {
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
};

export const EmployeesAPI = {
  list: (params) => api.get('/employees', { params }).then((r) => r.data),
  get: (id) => api.get(`/employees/${id}`).then((r) => r.data),
  create: (data) => api.post('/employees', data).then((r) => r.data),
  update: (id, data) => api.put(`/employees/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/employees/${id}`),
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
  exportUrl: (params) => {
    const qs = new URLSearchParams(params).toString();
    return `/api/attendance/export/xlsx${qs ? `?${qs}` : ''}`;
  },
};

export const TasksAPI = {
  list: (employee_id) => api.get('/tasks', { params: { employee_id } }).then((r) => r.data),
  create: (data) => api.post('/tasks', data).then((r) => r.data),
  update: (id, data) => api.put(`/tasks/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/tasks/${id}`),
};

export default api;
