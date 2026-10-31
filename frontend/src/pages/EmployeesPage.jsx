import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmployeesAPI } from '../api.js';
import EmployeeFormModal from '../components/EmployeeFormModal.jsx';
import EmployeeDetailModal from '../components/EmployeeDetailModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import TempPasswordModal from '../components/TempPasswordModal.jsx';

const UNASSIGNED_VALUE = '__unassigned__';
const UNASSIGNED_LABEL = 'Chưa phân ban';

const STATUS_LABEL = { active: 'Đang làm việc', pending: 'Chờ duyệt', inactive: 'Đã nghỉ' };
const STATUS_PILL = { active: 'pill-success', pending: 'pill-warning', inactive: 'pill-danger' };

export default function EmployeesPage() {
  const { employee: currentUser } = useAuth();
  // Quyền quản lý do backend quyết định (cờ isManager khi đăng nhập / GET /api/auth/me), không tự suy ra ở frontend
  const canManageEmployees = Boolean(currentUser?.isManager);

  const [searchParams, setSearchParams] = useSearchParams();
  const departmentFilter = searchParams.get('department') || '';

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [error, setError] = useState('');
  // Mật khẩu tạm vừa được cấp (tạo nhân viên mới / cấp lại) — chỉ hiện một lần
  const [tempPassword, setTempPassword] = useState(null);

  const [allDepartments, setAllDepartments] = useState([]);
  // Số thứ tự yêu cầu mới nhất: gõ tìm kiếm nhanh có thể làm kết quả cũ về sau kết quả mới, phải bỏ kết quả cũ
  const reqRef = useRef(0);

  async function load() {
    const reqId = ++reqRef.current;
    setLoading(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (departmentFilter && departmentFilter !== UNASSIGNED_VALUE) params.department = departmentFilter;

      let data = await EmployeesAPI.list(params);
      if (departmentFilter === UNASSIGNED_VALUE) {
        data = data.filter((e) => !e.department);
      }
      if (reqId !== reqRef.current) return;
      setEmployees(data);
      setError('');
    } catch (err) {
      if (reqId !== reqRef.current) return;
      setError(err?.response?.data?.error || 'Không tải được danh sách nhân viên. Kiểm tra kết nối backend/PostgreSQL.');
    } finally {
      if (reqId === reqRef.current) setLoading(false);
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
    let created = null;
    if (editing) {
      await EmployeesAPI.update(editing.id, data);
    } else {
      created = await EmployeesAPI.create(data);
    }
    setModalOpen(false);
    if (created?.temporary_password) {
      setTempPassword({
        title: 'Đã tạo tài khoản nhân viên',
        name: created.full_name,
        code: created.employee_code,
        password: created.temporary_password,
      });
    }
    load();
    EmployeesAPI.list({})
      .then((data) => setAllDepartments([...new Set(data.map((e) => e.department).filter(Boolean))].sort()))
      .catch(() => {});
  }

  async function handleResetPassword(emp) {
    const message =
      `Cấp lại mật khẩu cho "${emp.full_name}"? ` +
      'Mật khẩu cũ sẽ không dùng được nữa và nhân viên đang đăng nhập sẽ bị đăng xuất.';
    if (!window.confirm(message)) return;
    try {
      const res = await EmployeesAPI.resetPassword(emp.id);
      setTempPassword({
        title: 'Đã cấp lại mật khẩu',
        name: emp.full_name,
        code: emp.employee_code,
        password: res.temporary_password,
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Không cấp lại được mật khẩu.');
    }
  }

  // Duyệt tài khoản tự đăng ký: chuyển 'pending' → 'active' (backend chỉ cho quản lý có bậc cao hơn)
  async function handleApprove(emp) {
    if (!window.confirm(`Duyệt tài khoản của "${emp.full_name}" (${emp.employee_code})? Sau đó họ đăng nhập được ngay.`)) return;
    try {
      await EmployeesAPI.update(emp.id, { status: 'active' });
      load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Không duyệt được tài khoản.');
    }
  }

  // Từ chối đăng ký: chuyển sang 'inactive' (tài khoản không dùng được, vẫn lưu vết)
  async function handleReject(emp) {
    if (!window.confirm(`Từ chối đăng ký của "${emp.full_name}" (${emp.employee_code})?`)) return;
    try {
      await EmployeesAPI.remove(emp.id);
      load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Không từ chối được đăng ký.');
    }
  }

  async function handleDelete(emp) {
    const message =
      `Cho nhân viên "${emp.full_name}" nghỉ việc? ` +
      'Tài khoản sẽ bị vô hiệu hóa và không đăng nhập được nữa; dữ liệu chấm công vẫn được giữ lại.';
    if (!window.confirm(message)) return;
    try {
      await EmployeesAPI.remove(emp.id);
      load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Không thực hiện được thao tác này.');
    }
  }

  const pendingCount = employees.filter((e) => e.status === 'pending').length;

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

      {canManageEmployees && pendingCount > 0 && (
        <div className="alert alert-warning">
          Có <strong>{pendingCount}</strong> tài khoản tự đăng ký đang chờ bạn duyệt (các dòng "Chờ duyệt" bên dưới).
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
                    <span className={`pill ${STATUS_PILL[emp.status] || 'pill-danger'}`}>
                      {STATUS_LABEL[emp.status] || 'Đã nghỉ'}
                    </span>
                  </td>
                  <td className="row-actions">
                    {(canManageEmployees || emp.id === currentUser?.id) && (
                      <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); openEdit(emp); }}>Sửa</button>
                    )}
                    {canManageEmployees && emp.status === 'active' && emp.id !== currentUser?.id && (
                      <>
                        <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); handleResetPassword(emp); }}>Cấp lại MK</button>
                        <button className="btn btn-ghost btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(emp); }}>Cho nghỉ</button>
                      </>
                    )}
                    {canManageEmployees && emp.status === 'pending' && (
                      <>
                        <button className="btn btn-accent" onClick={(e) => { e.stopPropagation(); handleApprove(emp); }}>Duyệt</button>
                        <button className="btn btn-ghost btn-danger" onClick={(e) => { e.stopPropagation(); handleReject(emp); }}>Từ chối</button>
                      </>
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
        />
      )}

      {detailEmployee && (
        <EmployeeDetailModal employee={detailEmployee} onClose={() => setDetailEmployee(null)} />
      )}

      {tempPassword && (
        <TempPasswordModal
          title={tempPassword.title}
          employeeName={tempPassword.name}
          employeeCode={tempPassword.code}
          password={tempPassword.password}
          onClose={() => setTempPassword(null)}
        />
      )}
    </div>
  );
}
