import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const MIN_LENGTH = 8;

// forced = true: tài khoản đang dùng mật khẩu tạm → hiện thành MÀN HÌNH riêng, không đóng được,
//                chỉ có thể đổi mật khẩu hoặc đăng xuất.
// forced = false: người dùng chủ động đổi mật khẩu, hiện dạng hộp thoại và có nút Hủy.
export default function ChangePasswordModal({ forced = false, onClose }) {
  const { changePassword, logout } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.next.length < MIN_LENGTH) return setError(`Mật khẩu mới cần ít nhất ${MIN_LENGTH} ký tự.`);
    if (form.next !== form.confirm) return setError('Mật khẩu xác nhận không khớp.');
    if (form.next === form.current) return setError('Mật khẩu mới phải khác mật khẩu hiện tại.');

    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      // Ở chế độ bắt buộc, App tự chuyển sang giao diện chính ngay khi cờ must_change_password được hạ.
      if (!forced) setDone(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Không đổi được mật khẩu, vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  const fields = (
    <>
      <label>
        {forced ? 'Mật khẩu tạm đã được cấp' : 'Mật khẩu hiện tại'}
        <input
          type="password"
          className="input"
          value={form.current}
          onChange={(e) => update('current', e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
      </label>
      <label>
        Mật khẩu mới (tối thiểu {MIN_LENGTH} ký tự)
        <input
          type="password"
          className="input"
          value={form.next}
          onChange={(e) => update('next', e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Nhập lại mật khẩu mới
        <input
          type="password"
          className="input"
          value={form.confirm}
          onChange={(e) => update('confirm', e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      {error && <div className="alert alert-danger">{error}</div>}
    </>
  );

  if (forced) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Đổi mật khẩu</h1>
          <p className="page-sub">
            Bạn đang dùng mật khẩu tạm do quản lý cấp. Hãy đặt mật khẩu mới của riêng bạn để tiếp tục.
          </p>
          {fields}
          <button type="submit" className="btn btn-accent login-submit" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
          <div className="auth-switch">
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Đổi mật khẩu</h2>
        {done ? (
          <>
            <div className="alert alert-success">Đã đổi mật khẩu thành công.</div>
            <div className="form-actions">
              <button type="button" className="btn btn-accent" onClick={onClose}>
                Đóng
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-span">{fields}</div>
            <div className="form-actions form-span">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Hủy
              </button>
              <button type="submit" className="btn btn-accent" disabled={saving}>
                {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
