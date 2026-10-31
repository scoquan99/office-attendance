import { createContext, useContext, useEffect, useState } from 'react';
import { AuthAPI } from '../api.js';

const AuthContext = createContext(null);
const EMPLOYEE_KEY = 'office_attendance_employee';

// Dữ liệu trong sessionStorage có thể bị hỏng hoặc sửa tay: không để một lần JSON.parse lỗi làm sập cả ứng dụng
function readStoredEmployee() {
  try {
    const raw = sessionStorage.getItem(EMPLOYEE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    sessionStorage.removeItem(EMPLOYEE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(readStoredEmployee);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem(AuthAPI.tokenKey);
    if (!token) {
      setReady(true);
      return;
    }
    AuthAPI.me()
      .then((data) => {
        setEmployee(data);
        sessionStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data));
      })
      .catch((err) => {
        // Chỉ đăng xuất khi server nói rõ phiên không còn hiệu lực (401/403). Lỗi mạng hoặc 5xx là sự cố tạm thời:
        // giữ nguyên phiên để người dùng không bị đăng xuất oan mỗi lần backend khởi động lại.
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          sessionStorage.removeItem(AuthAPI.tokenKey);
          sessionStorage.removeItem(EMPLOYEE_KEY);
          setEmployee(null);
        }
      })
      .finally(() => setReady(true));
  }, []);

  async function login(employeeCode, password) {
    const data = await AuthAPI.login(employeeCode, password);
    sessionStorage.setItem(AuthAPI.tokenKey, data.token);
    sessionStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));
    setEmployee(data.employee);
  }

  // Đăng ký KHÔNG tự đăng nhập: tài khoản mới ở trạng thái chờ quản lý duyệt.
  // Trả về { pending, employee } để RegisterPage hiển thị mã nhân viên.
  async function register(payload) {
    return AuthAPI.register(payload);
  }

  function logout() {
    sessionStorage.removeItem(AuthAPI.tokenKey);
    sessionStorage.removeItem(EMPLOYEE_KEY);
    setEmployee(null);
  }

  // Đổi mật khẩu: backend trả token mới (token cũ hết hiệu lực) nên phải lưu lại ngay, và hạ cờ “bắt buộc đổi”.
  async function changePassword(currentPassword, newPassword) {
    const data = await AuthAPI.changePassword(currentPassword, newPassword);
    const next = { ...employee, must_change_password: false };
    sessionStorage.setItem(AuthAPI.tokenKey, data.token);
    sessionStorage.setItem(EMPLOYEE_KEY, JSON.stringify(next));
    setEmployee(next);
  }

  return (
    <AuthContext.Provider value={{ employee, ready, login, register, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
