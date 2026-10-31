import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { AttendanceAPI } from '../api.js';
import { dateInTz, useOfficeTz } from '../useOfficeTime.js';
import { useAuth } from '../context/AuthContext.jsx';
import EmployeeTasksPanel from './EmployeeTasksPanel.jsx';

const STANDARD_HOURS = 8;

function hoursBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const [h1, m1] = String(checkIn).split(':').map(Number);
  const [h2, m2] = String(checkOut).split(':').map(Number);
  const minutes = h2 * 60 + m2 - (h1 * 60 + m1);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes / 60;
}

function formatHours(hours) {
  if (hours === null || hours === undefined) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function statusPillClass(status) {
  if (status === 'Đi làm') return 'pill-success';
  if (status === 'Đi trễ') return 'pill-warning';
  if (status === 'Nghỉ phép') return 'pill-info';
  return 'pill-danger';
}

export default function EmployeeDetailModal({ employee, onClose }) {
  const { employee: currentUser } = useAuth();
  // Backend chỉ cho xem giờ làm của chính mình, trừ quản lý — không gọi API khi chắc chắn bị từ chối
  const canView = Boolean(currentUser?.isManager) || employee.id === currentUser?.id;
  const [tab, setTab] = useState('hours');
  // "Hôm nay" theo múi giờ văn phòng do server cấu hình; số thứ tự yêu cầu để bỏ kết quả cũ về muộn
  const tz = useOfficeTz();
  const reqRef = useRef(0);
  const [filtersReady, setFiltersReady] = useState(false);
  const [filters, setFilters] = useState({ from: '', to: '' });

  useEffect(() => {
    if (!tz) return;
    const today = dateInTz(tz);
    setFilters({ from: `${today.slice(0, 7)}-01`, to: today });
    setFiltersReady(true);
  }, [tz]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!canView) {
      setLoading(false);
      return;
    }
    const reqId = ++reqRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await AttendanceAPI.list({
        employee_id: employee.id,
        from: filters.from,
        to: filters.to,
      });
      if (reqId !== reqRef.current) return;
      setRecords(data);
    } catch (err) {
      if (reqId !== reqRef.current) return;
      setError(err?.response?.data?.error || 'Không tải được dữ liệu chấm công. Kiểm tra kết nối backend/PostgreSQL.');
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (filtersReady) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, employee.id, filtersReady]);

  const summary = useMemo(() => {
    let totalHours = 0;
    let overtimeHours = 0;
    let completeDays = 0;
    let incompleteDays = 0;

    records.forEach((r) => {
      const h = hoursBetween(r.check_in, r.check_out);
      if (h !== null) {
        totalHours += h;
        overtimeHours += Math.max(0, h - STANDARD_HOURS);
        completeDays += 1;
      } else if (r.check_in && !r.check_out) {
        incompleteDays += 1;
      }
    });

    return { totalHours, overtimeHours, completeDays, incompleteDays };
  }, [records]);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal modal-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div>
            <h2>{employee.full_name}</h2>
            <div className="modal-subtitle">
              {employee.employee_code}
              {employee.department ? ` · ${employee.department}` : ''}
              {employee.position ? ` · ${employee.position}` : ''}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === 'hours' ? 'active' : ''}`}
            onClick={() => setTab('hours')}
          >
            Giờ làm
          </button>
          <button
            className={`modal-tab ${tab === 'tasks' ? 'active' : ''}`}
            onClick={() => setTab('tasks')}
          >
            Công việc
          </button>
        </div>

        {tab === 'tasks' ? (
          <EmployeeTasksPanel employeeId={employee.id} />
        ) : !canView ? (
          <div className="empty-row">Chỉ quản lý hoặc chính nhân viên này mới xem được giờ làm.</div>
        ) : (
          <>
        <div className="toolbar">
          <label className="toolbar-field">
            Từ ngày
            <input
              type="date"
              className="input"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </label>
          <label className="toolbar-field">
            Đến ngày
            <input
              type="date"
              className="input"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </label>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="summary-bar">
          <div className="summary-stat">
            <div className="summary-value">{formatHours(summary.totalHours)}</div>
            <div className="summary-label">Tổng giờ làm trong kỳ</div>
          </div>
          <div className="summary-stat summary-stat-success">
            <div className="summary-value">{formatHours(summary.overtimeHours)}</div>
            <div className="summary-label">Giờ tăng ca (&gt;8h/ngày)</div>
          </div>
          <div className="summary-stat">
            <div className="summary-value">{summary.completeDays}</div>
            <div className="summary-label">Ngày công đầy đủ</div>
          </div>
          {summary.incompleteDays > 0 && (
            <div className="summary-stat summary-stat-danger">
              <div className="summary-value">{summary.incompleteDays}</div>
              <div className="summary-label">Ngày thiếu chấm công ra</div>
            </div>
          )}
        </div>

        <div className="card modal-table-card">
          <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Giờ vào</th>
                <th>Giờ ra</th>
                <th>Số giờ làm</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="empty-row">Đang tải...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={5} className="empty-row">Không có dữ liệu trong khoảng thời gian này</td></tr>
              ) : (
                records.map((r) => {
                  const h = hoursBetween(r.check_in, r.check_out);
                  return (
                    <tr key={r.id}>
                      <td>{dayjs(r.work_date).format('DD/MM/YYYY')}</td>
                      <td className="mono">{r.check_in ? String(r.check_in).slice(0, 5) : '—'}</td>
                      <td className="mono">{r.check_out ? String(r.check_out).slice(0, 5) : '—'}</td>
                      <td className="mono">{formatHours(h)}</td>
                      <td><span className={`pill ${statusPillClass(r.status)}`}>{r.status}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
