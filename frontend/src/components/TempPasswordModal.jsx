import { useState } from 'react';

// Hiển thị mật khẩu tạm do hệ thống tạo. Mật khẩu CHỈ hiện đúng một lần (database chỉ lưu bản băm),
// nên đóng hộp thoại này là không xem lại được — muốn có mật khẩu mới phải dùng "Cấp lại mật khẩu".
export default function TempPasswordModal({ title, employeeName, employeeCode, password, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="page-sub">
          Gửi thông tin này cho <strong>{employeeName}</strong> qua kênh riêng. Mật khẩu chỉ hiển thị
          <strong> một lần duy nhất</strong>; nhân viên sẽ phải đổi mật khẩu ngay lần đăng nhập đầu tiên.
        </p>
        <div className="form-grid">
          <label>
            Mã nhân viên (tên đăng nhập)
            <input className="input mono" readOnly value={employeeCode} onFocus={(e) => e.target.select()} />
          </label>
          <label>
            Mật khẩu tạm
            <input className="input mono" readOnly value={password} onFocus={(e) => e.target.select()} />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={copy}>
            {copied ? 'Đã sao chép' : 'Sao chép mật khẩu'}
          </button>
          <button type="button" className="btn btn-accent" onClick={onClose}>
            Đã lưu lại, đóng
          </button>
        </div>
      </div>
    </div>
  );
}
