import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { DEPARTMENT_NAMES, positionsForDepartment } from '../orgStructure.js';

const emptyForm = {
  full_name: '',
  phone: '',
  email: '',
  department: '',
  position: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const { register, completeAuth } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { token, employee }

  const positionChoices = useMemo(() => positionsForDepartment(form.department), [form.department]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      const data = await register({
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        department: form.department,
        position: form.position,
        password: form.password,
      });
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Đăng ký thất bại, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    completeAuth(result);
    navigate('/', { replace: true });
  }

  if (result) {
    return (
      <div className="login-screen">
        <div className="login-card register-card">
          <div className="login-brand">
            <span className="brand-mark">⏱</span>
            <div>
              <div className="brand-name">VănPhòng</div>
              <div className="brand-sub">Quản lý chấm công</div>
            </div>
          </div>

          <h1>Đăng ký thành công!</h1>
          <p className="register-success-text">
            Chào mừng <strong>{result.employee.full_name}</strong> — mã nhân viên của bạn là:
          </p>
          <div className="register-success-code">{result.employee.employee_code}</div>
          <p className="register-success-hint">
            Hãy ghi nhớ mã này — dùng cùng mật khẩu vừa tạo để đăng nhập những lần sau.
          </p>

          <button className="btn btn-accent login-submit" onClick={handleContinue}>
            Vào ứng dụng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <form className="login-card register-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="brand-mark">⏱</span>
          <div>
            <div className="brand-name">VănPhòng</div>
            <div className="brand-sub">Quản lý chấm công</div>
          </div>
        </div>

        <h1>Đăng ký tài khoản</h1>

        <label>
          Họ tên
          <input
            className="input"
            value={form.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            autoFocus
            required
          />
        </label>
        <label>
          Số điện thoại
          <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
        </label>
        <label>
          Email
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            required
          />
        </label>
        <label>
          Phòng ban
          <select
            className="input"
            value={form.department}
            onChange={(e) => {
              update('department', e.target.value);
              update('position', '');
            }}
            required
          >
            <option value="">— Chọn phòng ban —</option>
            {DEPARTMENT_NAMES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Chức vụ
          <select
            className="input"
            value={form.position}
            onChange={(e) => update('position', e.target.value)}
            disabled={!form.department}
            required
          >
            <option value="">{form.department ? '— Chọn chức vụ —' : 'Chọn phòng ban trước'}</option>
            {positionChoices.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            required
          />
        </label>
        <label>
          Xác nhận mật khẩu
          <input
            type="password"
            className="input"
            value={form.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
            required
          />
        </label>

        {error && <div className="alert alert-danger">{error}</div>}

        <button type="submit" className="btn btn-accent login-submit" disabled={loading}>
          {loading ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>

        <div className="auth-switch">
          Đã có tài khoản? <Link to="/">Đăng nhập</Link>
        </div>
      </form>
    </div>
  );
}
