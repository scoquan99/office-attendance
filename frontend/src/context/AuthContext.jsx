import { createContext, useContext, useEffect, useState } from 'react';
import { AuthAPI } from '../api.js';

const AuthContext = createContext(null);
const EMPLOYEE_KEY = 'office_attendance_employee';

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(() => {
    const raw = sessionStorage.getItem(EMPLOYEE_KEY);
    return raw ? JSON.parse(raw) : null;
  });
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
      .catch(() => {
        sessionStorage.removeItem(AuthAPI.tokenKey);
        sessionStorage.removeItem(EMPLOYEE_KEY);
        setEmployee(null);
      })
      .finally(() => setReady(true));
  }, []);

  async function login(employeeCode, password) {
    const data = await AuthAPI.login(employeeCode, password);
    sessionStorage.setItem(AuthAPI.tokenKey, data.token);
    sessionStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));
    setEmployee(data.employee);
  }

  async function register(payload) {
    const data = await AuthAPI.register(payload);
    // Chưa tự đăng nhập ngay — để RegisterPage hiển thị mã nhân viên trước
    return data; // { token, employee }
  }

  function completeAuth(data) {
    sessionStorage.setItem(AuthAPI.tokenKey, data.token);
    sessionStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));
    setEmployee(data.employee);
  }

  function logout() {
    sessionStorage.removeItem(AuthAPI.tokenKey);
    sessionStorage.removeItem(EMPLOYEE_KEY);
    setEmployee(null);
  }

  return (
    <AuthContext.Provider value={{ employee, ready, login, register, completeAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
