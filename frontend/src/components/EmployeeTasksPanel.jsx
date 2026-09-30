import { useEffect, useState } from 'react';
import { TasksAPI } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function EmployeeTasksPanel({ employeeId }) {
  const { employee: currentUser } = useAuth();
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
      setError('Không tải được danh sách công việc.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

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
      setError('Không thêm được công việc.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task) {
    await TasksAPI.update(task.id, { is_done: !task.is_done });
    load();
  }

  async function togglePriority(task) {
    await TasksAPI.update(task.id, { is_priority: !task.is_priority });
    load();
  }

  async function handleDelete(task) {
    if (!window.confirm(`Xóa công việc "${task.title}"?`)) return;
    await TasksAPI.remove(task.id);
    load();
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
