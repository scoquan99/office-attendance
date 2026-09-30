import { useMemo, useState } from 'react';
import { DEPARTMENT_NAMES, positionsForDepartment } from '../orgStructure.js';

const empty = {
  employee_code: '',
  full_name: '',
  department: '',
  position: '',
  phone: '',
  email: '',
  start_date: '',
  status: 'active',
};

export default function EmployeeFormModal({ initial, onClose, onSave, departmentOptions = [] }) {
  const [form, setForm] = useState(
    initial
      ? { ...empty, ...initial, start_date: initial.start_date ? String(initial.start_date).slice(0, 10) : '' }
      : empty
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const departmentChoices = useMemo(() => {
    const set = new Set(DEPARTMENT_NAMES);
    departmentOptions.forEach((d) => set.add(d));
    if (form.department) set.add(form.department);
    return Array.from(set);
  }, [departmentOptions, form.department]);

  const positionChoices = useMemo(() => {
    const base = positionsForDepartment(form.department);
    if (form.position && !base.includes(form.position)) return [...base, form.position];
    return base;
  }, [form.department, form.position]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err?.response?.data?.error || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên'}</h2>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Mã nhân viên *
            <input
              required
              className="input"
              value={form.employee_code}
              onChange={(e) => update('employee_code', e.target.value)}
            />
          </label>
          <label>
            Họ tên *
            <input
              required
              className="input"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
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
            >
              <option value="">— Chọn phòng ban —</option>
              {departmentChoices.map((d) => (
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
            >
              <option value="">{form.department ? '— Chọn chức vụ —' : 'Chọn phòng ban trước'}</option>
              {positionChoices.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Số điện thoại
            <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </label>
          <label>
            Ngày vào làm
            <input type="date" className="input" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} />
          </label>
          <label>
            Trạng thái
            <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
              <option value="active">Đang làm việc</option>
              <option value="inactive">Đã nghỉ</option>
            </select>
          </label>

          {error && <div className="alert alert-danger form-span">{error}</div>}

          <div className="form-actions form-span">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-accent" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
