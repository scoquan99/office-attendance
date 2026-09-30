import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /api/tasks?employee_id=123
router.get('/', async (req, res, next) => {
  try {
    const { employee_id } = req.query;
    if (!employee_id) return res.status(400).json({ error: 'Thiếu employee_id' });

    const { rows } = await pool.query(
      `SELECT t.*, a.full_name AS assigned_by_name
       FROM tasks t
       LEFT JOIN employees a ON a.id = t.assigned_by
       WHERE t.employee_id = $1
       ORDER BY t.is_done ASC, t.is_priority DESC, t.created_at DESC`,
      [employee_id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks { employee_id, title, is_priority }
router.post('/', async (req, res, next) => {
  try {
    const { employee_id, title, is_priority } = req.body;
    if (!employee_id || !title || !title.trim()) {
      return res.status(400).json({ error: 'Thiếu employee_id hoặc nội dung công việc' });
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks (employee_id, title, is_priority, assigned_by)
       VALUES ($1, $2, COALESCE($3, false), $4)
       RETURNING *`,
      [employee_id, title.trim(), is_priority, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id { title?, is_priority?, is_done? }
router.put('/:id', async (req, res, next) => {
  try {
    const { title, is_priority, is_done } = req.body;

    const { rows: existingRows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Không tìm thấy công việc' });
    const existing = existingRows[0];

    const nextTitle = title !== undefined ? title : existing.title;
    const nextPriority = is_priority !== undefined ? is_priority : existing.is_priority;
    const nextDone = is_done !== undefined ? is_done : existing.is_done;
    const nextCompletedAt = nextDone ? (existing.is_done ? existing.completed_at : new Date()) : null;

    const { rows } = await pool.query(
      `UPDATE tasks SET title=$1, is_priority=$2, is_done=$3, completed_at=$4 WHERE id=$5 RETURNING *`,
      [nextTitle, nextPriority, nextDone, nextCompletedAt, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy công việc' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
