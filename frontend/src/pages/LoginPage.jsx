import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(employeeCode, password);
    } catch (err) {
      setError(err?.response?.data?.error || 'Đăng nhập thất bại, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="brand-mark">⏱</span>
          <div>
            <div className="brand-name">VănPhòng</div>
            <div className="brand-sub">Quản lý chấm công</div>
          </div>
        </div>

        <h1>Đăng nhập</h1>

        <label>
          Mã nhân viên
          <input
            className="input"
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            autoFocus
            required
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="alert alert-danger">{error}</div>}

        <button type="submit" className="btn btn-accent login-submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>

        <div className="auth-switch">
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </div>
      </form>
    </div>
  );
}
