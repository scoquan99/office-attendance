import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DashboardAPI } from '../api.js';
import EmployeeDetailModal from '../components/EmployeeDetailModal.jsx';

const UNASSIGNED_LABEL = 'Chưa phân ban';

function statusPillClass(status) {
  if (status === 'Chưa chấm công') return 'pill-danger';
  if (status === 'Đi làm') return 'pill-success';
  if (status === 'Đi trễ') return 'pill-warning';
  if (status === 'Nghỉ phép') return 'pill-info';
  return 'pill-warning';
}

export default function DepartmentsPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ summary: null, departments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailEmployee, setDetailEmployee] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await DashboardAPI.get(date);
      setData(result);
    } catch (err) {
      setError('Không tải được dữ liệu. Kiểm tra kết nối backend/PostgreSQL.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const filteredDepartments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data.departments;
    return data.departments
      .map((dept) => ({
        ...dept,
        employees: dept.employees.filter(
          (e) =>
            e.full_name.toLowerCase().includes(keyword) ||
            e.employee_code.toLowerCase().includes(keyword)
        ),
      }))
      .filter((dept) => dept.employees.length > 0);
  }, [data.departments, search]);

  const isToday = date === dayjs().format('YYYY-MM-DD');

  function goToDepartment(deptName) {
    const value = deptName === UNASSIGNED_LABEL ? '__unassigned__' : deptName;
    navigate(`/employees?department=${encodeURIComponent(value)}`);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Theo phòng ban</h1>
          <p className="page-sub">
            Số lượng nhân sự và tình trạng chấm công {isToday ? 'hôm nay' : `ngày ${dayjs(date).format('DD/MM/YYYY')}`}, chia theo từng ban.
            Nhấp vào một ban để quản lý nhân sự của ban đó.
          </p>
        </div>
      </header>

      <div className="toolbar">
        <label className="toolbar-field">
          Ngày xem
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="toolbar-field" style={{ flex: 1, minWidth: 220 }}>
          Tìm nhân viên
          <input
            className="input"
            placeholder="Tên hoặc mã nhân viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data.summary && (
        <div className="summary-bar">
          <div className="summary-stat">
            <div className="summary-value">{data.summary.total}</div>
            <div className="summary-label">Tổng nhân sự đang làm việc</div>
          </div>
          <div className="summary-stat summary-stat-success">
            <div className="summary-value">{data.summary.checked_in}</div>
            <div className="summary-label">Đã chấm công vào</div>
          </div>
          <div className="summary-stat summary-stat-danger">
            <div className="summary-value">{data.summary.not_checked_in}</div>
            <div className="summary-label">Chưa chấm công</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card"><div className="empty-row">Đang tải...</div></div>
      ) : filteredDepartments.length === 0 ? (
        <div className="card"><div className="empty-row">Không tìm thấy nhân viên phù hợp</div></div>
      ) : (
        <div className="department-grid">
          {filteredDepartments.map((dept) => {
            const pct = dept.total ? Math.round((dept.checked_in / dept.total) * 100) : 0;
            return (
              <div
                className="department-card department-card-clickable"
                key={dept.department}
                role="button"
                tabIndex={0}
                onClick={() => goToDepartment(dept.department)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goToDepartment(dept.department);
                  }
                }}
              >
                <div className="department-card-header">
                  <div>
                    <div className="department-name">{dept.department}</div>
                    <div className="department-count">
                      {dept.checked_in}/{dept.total} đã chấm công
                    </div>
                  </div>
                  <div className="department-badge">{pct}%</div>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <ul className="department-list">
                  {dept.employees.map((emp) => (
                    <li
                      key={emp.id}
                      className="department-list-item department-list-item-clickable"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailEmployee({ ...emp, department: dept.department });
                      }}
                    >
                      <div>
                        <div className="employee-name">{emp.full_name}</div>
                        <div className="employee-meta">
                          {emp.employee_code}
                          {emp.position ? ` · ${emp.position}` : ''}
                        </div>
                      </div>
                      <div className="department-list-right">
                        <span className="mono employee-time">
                          {emp.check_in ? String(emp.check_in).slice(0, 5) : '—'}
                          {emp.check_out ? ` – ${String(emp.check_out).slice(0, 5)}` : ''}
                        </span>
                        <span className={`pill ${statusPillClass(emp.status)}`}>{emp.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="department-card-footer">Quản lý nhân sự của ban này →</div>
              </div>
            );
          })}
        </div>
      )}

      {detailEmployee && (
        <EmployeeDetailModal employee={detailEmployee} onClose={() => setDetailEmployee(null)} />
      )}
    </div>
  );
}
