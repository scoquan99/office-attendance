import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmployeesAPI } from '../api.js';
import EmployeeFormModal from '../components/EmployeeFormModal.jsx';
import EmployeeDetailModal from '../components/EmployeeDetailModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isManagerPosition } from '../managerPositions.js';

const UNASSIGNED_VALUE = '__unassigned__';
const UNASSIGNED_LABEL = 'Chưa phân ban';

export default function EmployeesPage() {
  const { employee: currentUser } = useAuth();
  const canManageEmployees = isManagerPosition(currentUser?.position);

  const [searchParams, setSearchParams] = useSearchParams();
  const departmentFilter = searchParams.get('department') || '';

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [error, setError] = useState('');

  const [allDepartments, setAllDepartments] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (departmentFilter && departmentFilter !== UNASSIGNED_VALUE) params.department = departmentFilter;

      let data = await EmployeesAPI.list(params);
      if (departmentFilter === UNASSIGNED_VALUE) {
        data = data.filter((e) => !e.department);
      }
      setEmployees(data);
      setError('');
    } catch (err) {
      setError('Không tải được danh sách nhân viên. Kiểm tra kết nối backend/PostgreSQL.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    EmployeesAPI.list({})
      .then((data) => setAllDepartments([...new Set(data.map((e) => e.department).filter(Boolean))].sort()))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, departmentFilter]);

  function updateDepartmentFilter(value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('department', value);
    else next.delete('department');
    setSearchParams(next);
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(emp) {
    setEditing(emp);
    setModalOpen(true);
  }

  async function handleSave(data) {
    if (editing) {
      await EmployeesAPI.update(editing.id, data);
    } else {
      await EmployeesAPI.create(data);
    }
    setModalOpen(false);
    load();
    EmployeesAPI.list({})
      .then((data) => setAllDepartments([...new Set(data.map((e) => e.department).filter(Boolean))].sort()))
      .catch(() => {});
  }

  async function handleDelete(emp) {
    if (!window.confirm(`Xóa nhân viên "${emp.full_name}"? Dữ liệu chấm công liên quan cũng sẽ bị xóa.`)) return;
    await EmployeesAPI.remove(emp.id);
    load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Nhân sự</h1>
          <p className="page-sub">Quản lý danh sách nhân viên trong văn phòng</p>
        </div>
        {canManageEmployees && (
          <button className="btn btn-accent" onClick={openCreate}>
            + Thêm nhân viên
          </button>
        )}
      </header>

      <div className="toolbar">
        <label className="toolbar-field" style={{ flex: 1, minWidth: 240 }}>
          Tìm nhân viên
          <input
            className="input"
            placeholder="Tên hoặc mã nhân viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="toolbar-field">
          Phòng ban
          <select className="input" value={departmentFilter} onChange={(e) => updateDepartmentFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {allDepartments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
            <option value={UNASSIGNED_VALUE}>{UNASSIGNED_LABEL}</option>
          </select>
        </label>
      </div>

      {departmentFilter && (
        <div className="filter-chip">
          Đang lọc theo ban: <strong>{departmentFilter === UNASSIGNED_VALUE ? UNASSIGNED_LABEL : departmentFilter}</strong>
          <button className="filter-chip-clear" onClick={() => updateDepartmentFilter('')}>✕ Bỏ lọc</button>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Mã NV</th>
              <th>Họ tên</th>
              <th>Phòng ban</th>
              <th>Chức vụ</th>
              <th>SĐT</th>
              <th>Email</th>
              <th>Ngày vào làm</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="empty-row">Đang tải...</td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-row">Chưa có nhân viên nào</td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="table-row-clickable" onClick={() => setDetailEmployee(emp)}>
                  <td className="mono">{emp.employee_code}</td>
                  <td>{emp.full_name}</td>
                  <td>{emp.department || '—'}</td>
                  <td>{emp.position || '—'}</td>
                  <td>{emp.phone || '—'}</td>
                  <td>{emp.email || '—'}</td>
                  <td>{emp.start_date ? new Date(emp.start_date).toLocaleDateString('vi-VN') : '—'}</td>
                  <td>
                    <span className={`pill ${emp.status === 'active' ? 'pill-success' : 'pill-danger'}`}>
                      {emp.status === 'active' ? 'Đang làm việc' : 'Đã nghỉ'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); openEdit(emp); }}>Sửa</button>
                    {canManageEmployees && (
                      <button className="btn btn-ghost btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(emp); }}>Xóa</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {modalOpen && (
        <EmployeeFormModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          departmentOptions={allDepartments}
        />
      )}

      {detailEmployee && (
        <EmployeeDetailModal employee={detailEmployee} onClose={() => setDetailEmployee(null)} />
      )}
    </div>
  );
}
