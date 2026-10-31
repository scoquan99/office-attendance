import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function Sidebar() {
  const { employee, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const footerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (footerRef.current && !footerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const initials = getInitials(employee?.full_name);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">⏱</span>
        <div>
          <div className="brand-name">VănPhòng</div>
          <div className="brand-sub">Quản lý chấm công</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Chấm công
        </NavLink>
        <NavLink to="/departments" className={({ isActive }) => (isActive ? 'active' : '')}>
          Theo phòng ban
        </NavLink>
        <NavLink to="/employees" className={({ isActive }) => (isActive ? 'active' : '')}>
          Nhân sự
        </NavLink>
      </nav>

      <div className="sidebar-footer" ref={footerRef}>
        {open && (
          <div className="account-popover">
            <div className="account-popover-header">
              <span className="account-avatar account-avatar-lg">{initials}</span>
              <div>
                <div className="account-name">{employee?.full_name}</div>
                <div className="account-code">Mã NV: {employee?.employee_code}</div>
              </div>
            </div>
            <div className="account-popover-details">
              <div className="account-detail-row">
                <span className="account-detail-label">Phòng ban</span>
                <span>{employee?.department || '—'}</span>
              </div>
              <div className="account-detail-row">
                <span className="account-detail-label">Chức vụ</span>
                <span>{employee?.position || '—'}</span>
              </div>
              <div className="account-detail-row">
                <span className="account-detail-label">Điện thoại</span>
                <span>{employee?.phone || '—'}</span>
              </div>
              <div className="account-detail-row">
                <span className="account-detail-label">Email</span>
                <span>{employee?.email || '—'}</span>
              </div>
            </div>
            <button
              className="account-popover-action"
              onClick={() => {
                setOpen(false);
                setChangingPassword(true);
              }}
            >
              Đổi mật khẩu
            </button>
            <button className="account-popover-logout" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        )}

        <button className="sidebar-account-trigger" onClick={() => setOpen((v) => !v)}>
          <span className="account-avatar account-avatar-sm">{initials}</span>
          <span className="sidebar-account-text">
            <span className="sidebar-user-name">{employee?.full_name}</span>
            <span className="sidebar-user-meta">
              {employee?.position || employee?.department || employee?.employee_code}
            </span>
          </span>
          <span className="sidebar-account-chevron">{open ? '⌄' : '⌃'}</span>
        </button>
      </div>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </aside>
  );
}
