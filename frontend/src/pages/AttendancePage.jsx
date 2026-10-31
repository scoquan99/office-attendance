import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { AttendanceAPI, EmployeesAPI } from '../api.js';
import { dateInTz, timeInTz, useOfficeTz } from '../useOfficeTime.js';
import { useAuth } from '../context/AuthContext.jsx';

function statusPillClass(status) {
  if (status === 'Đi làm') return 'pill-success';
  if (status === 'Đi trễ') return 'pill-warning';
  if (status === 'Nghỉ phép') return 'pill-info';
  return 'pill-danger';
}

export default function AttendancePage() {
  const { employee: currentUser } = useAuth();
  // Quyền do backend quyết định (cờ isManager). Nhân viên thường chỉ chấm công cho chính mình.
  const isManager = Boolean(currentUser?.isManager);
  const [now, setNow] = useState(dayjs());
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(currentUser?.id ? String(currentUser.id) : '');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [punchMessage, setPunchMessage] = useState('');

  // "Hôm nay" và đồng hồ theo múi giờ văn phòng do server cấu hình, không theo đồng hồ của trình duyệt
  const tz = useOfficeTz();
  // Số thứ tự yêu cầu mới nhất: đổi bộ lọc nhanh có thể làm kết quả cũ về sau kết quả mới, phải bỏ kết quả cũ
  const reqRef = useRef(0);
  const [filtersReady, setFiltersReady] = useState(false);
  const [filters, setFilters] = useState({ from: '', to: '', employee_id: '', department: '' });

  // Khi đã biết múi giờ văn phòng: đặt mặc định "từ đầu tháng đến hôm nay" rồi mới tải dữ liệu lần đầu
  useEffect(() => {
    if (!tz) return;
    const today = dateInTz(tz);
    setFilters((f) => ({ ...f, from: `${today.slice(0, 7)}-01`, to: today }));
    setFiltersReady(true);
  }, [tz]);

  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    EmployeesAPI.list({ status: 'active' }).then(setEmployees).catch(() => {});
  }, []);

  async function loadRecords() {
    const reqId = ++reqRef.current;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.employee_id) params.employee_id = filters.employee_id;
      if (filters.department) params.department = filters.department;
      const data = await AttendanceAPI.list(params);
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
    if (filtersReady) loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, filtersReady]);

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))],
    [employees]
  );

  async function handleCheckin() {
    if (!selectedEmployee) return setPunchMessage('Vui lòng chọn nhân viên trước.');
    try {
      const row = await AttendanceAPI.checkin(selectedEmployee);
      // Giờ lấy từ bản ghi server trả về (giờ văn phòng), không lấy từ đồng hồ trình duyệt
      setPunchMessage(
        'Đã chấm công vào lúc ' + String(row?.check_in ?? timeInTz(tz)).slice(0, 8) + (row?.status === 'Đi trễ' ? ' (đi trễ)' : '')
      );
      loadRecords();
    } catch (err) {
      setPunchMessage(err?.response?.data?.error || 'Có lỗi khi chấm công vào.');
    }
  }

  async function handleCheckout() {
    if (!selectedEmployee) return setPunchMessage('Vui lòng chọn nhân viên trước.');
    try {
      const row = await AttendanceAPI.checkout(selectedEmployee);
      setPunchMessage('Đã chấm công ra lúc ' + String(row?.check_out ?? timeInTz(tz)).slice(0, 8));
      loadRecords();
    } catch (err) {
      setPunchMessage(err?.response?.data?.error || 'Có lỗi khi chấm công ra.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Xóa bản ghi chấm công này?')) return;
    try {
      await AttendanceAPI.remove(id);
      loadRecords();
    } catch (err) {
      setError(err?.response?.data?.error || 'Không xóa được bản ghi chấm công.');
    }
  }

  async function handleExport() {
    const params = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.employee_id) params.employee_id = filters.employee_id;
    if (filters.department) params.department = filters.department;
    try {
      const blob = await AttendanceAPI.exportXlsx(params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bang-cham-cong_${dateInTz(tz)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Không xuất được file Excel. Vui lòng thử lại.');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Chấm công</h1>
          <p className="page-sub">Theo dõi giờ vào - ra và xuất danh sách để kiểm tra</p>
        </div>
      </header>

      <div className="punch-card">
        <div className="punch-clock">
          <div className="punch-date">{dayjs(dateInTz(tz, now.toDate())).format('dddd, DD/MM/YYYY')}</div>
          <div className="punch-time">{timeInTz(tz, now.toDate())}</div>
        </div>
        <div className="punch-controls">
          <select
            className="input"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            disabled={!isManager}
            title={isManager ? undefined : 'Bạn chỉ được chấm công cho chính mình'}
          >
            <option value="">— Chọn nhân viên —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employee_code} · {e.full_name}
              </option>
            ))}
          </select>
          <div className="punch-buttons">
            <button className="btn btn-punch-in" onClick={handleCheckin}>Chấm công vào</button>
            <button className="btn btn-punch-out" onClick={handleCheckout}>Chấm công ra</button>
          </div>
          {punchMessage && <div className="punch-message">{punchMessage}</div>}
        </div>
      </div>

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
        {/* Nhân viên thường chỉ xem chấm công của chính mình nên không có bộ lọc theo người / phòng ban */}
        {isManager && (
          <>
        <label className="toolbar-field">
          Nhân viên
          <select
            className="input"
            value={filters.employee_id}
            onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))}
          >
            <option value="">Tất cả</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </label>
        <label className="toolbar-field">
          Phòng ban
          <select
            className="input"
            value={filters.department}
            onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
          >
            <option value="">Tất cả</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
          </>
        )}
        {/* Backend chỉ cho quản lý xuất Excel */}
        {isManager && (
          <button className="btn btn-accent" onClick={handleExport}>⬇ Xuất Excel</button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Mã NV</th>
              <th>Họ tên</th>
              <th>Phòng ban</th>
              <th>Giờ vào</th>
              <th>Giờ ra</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="empty-row">Đang tải...</td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-row">Không có dữ liệu trong khoảng thời gian này</td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td>{dayjs(r.work_date).format('DD/MM/YYYY')}</td>
                  <td className="mono">{r.employee_code}</td>
                  <td>{r.full_name}</td>
                  <td>{r.department || '—'}</td>
                  <td className="mono">{r.check_in ? String(r.check_in).slice(0, 5) : '—'}</td>
                  <td className="mono">{r.check_out ? String(r.check_out).slice(0, 5) : '—'}</td>
                  <td><span className={`pill ${statusPillClass(r.status)}`}>{r.status}</span></td>
                  <td>{r.note || '—'}</td>
                  <td className="row-actions">
                    {isManager && (
                      <button className="btn btn-ghost btn-danger" onClick={() => handleDelete(r.id)}>Xóa</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
