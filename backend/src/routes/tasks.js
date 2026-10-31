import { Router } from 'express';
import { pool } from '../db.js';
import { canAccessEmployee } from '../middleware/auth.js';
import { parseId } from '../utils/id.js';

const router = Router();

const TITLE_MAX = 255;
const FORBIDDEN = { error: 'Bạn không có quyền với công việc của nhân viên này' };

// Trả về chuỗi lỗi nếu title không hợp lệ, ngược lại null
function checkTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return 'Nội dung công việc không được để trống';
  if (title.trim().length > TITLE_MAX) return `Nội dung công việc tối đa ${TITLE_MAX} ký tự`;
  return null;
}

// Lấy công việc theo id (đã parse), trả về null nếu không có
async function findTask(id) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0] || null;
}

// GET /api/tasks?employee_id=123 — chỉ xem được việc của chính mình (quản lý xem được tất cả)
router.get('/', async (req, res, next) => {
  try {
    const employeeId = parseId(req.query.employee_id);
    if (!employeeId) return res.status(400).json({ error: 'Thiếu hoặc sai employee_id' });
    if (!canAccessEmployee(req, employeeId)) return res.status(403).json(FORBIDDEN);

    const { rows } = await pool.query(
      `SELECT t.*, a.full_name AS assigned_by_name
       FROM tasks t
       LEFT JOIN employees a ON a.id = t.assigned_by
       WHERE t.employee_id = $1
       ORDER BY t.is_done ASC, t.is_priority DESC, t.created_at DESC`,
      [employeeId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks { employee_id, title, is_priority }
router.post('/', async (req, res, next) => {
  try {
    const { title, is_priority } = req.body || {};
    const employeeId = parseId(req.body?.employee_id);
    if (!employeeId) return res.status(400).json({ error: 'Thiếu hoặc sai employee_id' });

    const titleError = checkTitle(title);
    if (titleError) return res.status(400).json({ error: titleError });
    if (is_priority !== undefined && typeof is_priority !== 'boolean') {
      return res.status(400).json({ error: 'is_priority phải là true hoặc false' });
    }
    if (!canAccessEmployee(req, employeeId)) return res.status(403).json(FORBIDDEN);

    const { rows } = await pool.query(
      `INSERT INTO tasks (employee_id, title, is_priority, assigned_by)
       VALUES ($1, $2, COALESCE($3, false), $4)
       RETURNING *`,
      [employeeId, title.trim(), is_priority ?? null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    }
    next(err);
  }
});

// PUT /api/tasks/:id { title?, is_priority?, is_done? }
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID công việc không hợp lệ' });

    const { title, is_priority, is_done } = req.body || {};
    if (title !== undefined) {
      const titleError = checkTitle(title);
      if (titleError) return res.status(400).json({ error: titleError });
    }
    for (const [name, value] of [['is_priority', is_priority], ['is_done', is_done]]) {
      if (value !== undefined && typeof value !== 'boolean') {
        return res.status(400).json({ error: `${name} phải là true hoặc false` });
      }
    }

    const existing = await findTask(id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy công việc' });
    // Kiểm tra quyền theo CHỦ SỞ HỮU công việc (task.employee_id), không tin dữ liệu client gửi lên
    if (!canAccessEmployee(req, existing.employee_id)) return res.status(403).json(FORBIDDEN);

    const nextTitle = title !== undefined ? title.trim() : existing.title;
    const nextPriority = is_priority !== undefined ? is_priority : existing.is_priority;
    const nextDone = is_done !== undefined ? is_done : existing.is_done;
    const nextCompletedAt = nextDone ? (existing.is_done ? existing.completed_at : new Date()) : null;

    const { rows } = await pool.query(
      `UPDATE tasks SET title=$1, is_priority=$2, is_done=$3, completed_at=$4 WHERE id=$5 RETURNING *`,
      [nextTitle, nextPriority, nextDone, nextCompletedAt, id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID công việc không hợp lệ' });

    const existing = await findTask(id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy công việc' });
    if (!canAccessEmployee(req, existing.employee_id)) return res.status(403).json(FORBIDDEN);

    await pool.query('DELETE FROM tasks WHERE id=$1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
