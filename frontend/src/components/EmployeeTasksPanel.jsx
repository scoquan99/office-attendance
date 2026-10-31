import { useEffect, useState } from 'react';
import { TasksAPI } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function EmployeeTasksPanel({ employeeId }) {
  const { employee: currentUser } = useAuth();
  // Backend chỉ cho xem/sửa việc của chính mình, trừ quản lý — không gọi API khi chắc chắn sẽ bị từ chối
  const canUse = Boolean(currentUser?.isManager) || Number(employeeId) === Number(currentUser?.id);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await TasksAPI.list(employeeId);
      setTasks(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Không tải được danh sách công việc.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canUse) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, canUse]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await TasksAPI.create({ employee_id: employeeId, title: title.trim(), is_priority: priority });
      setTitle('');
      setPriority(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Không thêm được công việc.');
    } finally {
      setSaving(false);
    }
  }

  // Bọc mọi thao tác sửa/xóa: lỗi (ví dụ 403) hiện thành thông báo thay vì là lỗi không được xử lý
  async function runAction(action, fallbackMessage) {
    setError('');
    try {
      await action();
      load();
    } catch (err) {
      setError(err?.response?.data?.error || fallbackMessage);
    }
  }

  function toggleDone(task) {
    return runAction(() => TasksAPI.update(task.id, { is_done: !task.is_done }), 'Không cập nhật được công việc.');
  }

  function togglePriority(task) {
    return runAction(
      () => TasksAPI.update(task.id, { is_priority: !task.is_priority }),
      'Không cập nhật được công việc.'
    );
  }

  function handleDelete(task) {
    if (!window.confirm(`Xóa công việc "${task.title}"?`)) return undefined;
    return runAction(() => TasksAPI.remove(task.id), 'Không xóa được công việc.');
  }

  if (!canUse) {
    return (
      <div className="tasks-panel">
        <div className="empty-row">Chỉ quản lý hoặc chính nhân viên này mới xem được công việc.</div>
      </div>
    );
  }

  const pending = tasks.filter((t) => !t.is_done);
  const done = tasks.filter((t) => t.is_done);

  function assignerLabel(task) {
    if (!task.assigned_by_name) return null;
    return task.assigned_by === currentUser?.id ? 'Bạn' : task.assigned_by_name;
  }

  return (
    <div className="tasks-panel">
      <form className="task-add-row" onSubmit={handleAdd}>
        <input
          className="input"
          placeholder="Thêm công việc mới..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="task-priority-check">
          <input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} />
          Ưu tiên
        </label>
        <button className="btn btn-accent" type="submit" disabled={saving || !title.trim()}>
          + Thêm
        </button>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="empty-row">Đang tải...</div>
      ) : tasks.length === 0 ? (
        <div className="empty-row">Chưa có công việc nào cho nhân viên này</div>
      ) : (
        <>
          {pending.length > 0 && (
            <ul className="task-list">
              {pending.map((task) => (
                <li key={task.id} className={`task-item ${task.is_priority ? 'task-item-priority' : ''}`}>
                  <label className="task-checkbox">
                    <input type="checkbox" checked={task.is_done} onChange={() => toggleDone(task)} />
                    <span>{task.title}</span>
                  </label>
                  <div className="task-item-right">
                    {task.is_priority && <span className="pill pill-warning">Ưu tiên</span>}
                    <button
                      className={`task-star ${task.is_priority ? 'task-star-active' : ''}`}
                      onClick={() => togglePriority(task)}
                      title={task.is_priority ? 'Bỏ đánh dấu ưu tiên' : 'Đánh dấu ưu tiên'}
                    >
                      ★
                    </button>
                    <button className="task-delete" onClick={() => handleDelete(task)} title="Xóa">
                      ✕
                    </button>
                  </div>
                  {assignerLabel(task) && (
                    <div className="task-assigned-by">Giao bởi: {assignerLabel(task)}</div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <>
              <div className="task-section-label">Đã hoàn thành ({done.length})</div>
              <ul className="task-list">
                {done.map((task) => (
                  <li key={task.id} className="task-item task-item-done">
                    <label className="task-checkbox">
                      <input type="checkbox" checked={task.is_done} onChange={() => toggleDone(task)} />
                      <span>{task.title}</span>
                    </label>
                    <div className="task-item-right">
                      <button className="task-delete" onClick={() => handleDelete(task)} title="Xóa">
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
