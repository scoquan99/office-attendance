import { Router } from 'express';
import { pool } from '../db.js';
import { requireManagerRole } from '../middleware/auth.js';

const router = Router();

// GET /api/employees?q=&department=&status=
router.get('/', async (req, res, next) => {
  try {
    const { q, department, status } = req.query;
    const conditions = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(full_name ILIKE $${params.length} OR employee_code ILIKE $${params.length})`);
    }
    if (department) {
      params.push(department);
      conditions.push(`department = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM employees ${where} ORDER BY full_name ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireManagerRole, async (req, res, next) => {
  try {
    const { employee_code, full_name, department, position, phone, email, start_date, status } = req.body;
    if (!employee_code || !full_name) {
      return res.status(400).json({ error: 'Thiếu mã nhân viên hoặc họ tên' });
    }
    const { rows } = await pool.query(
      `INSERT INTO employees (employee_code, full_name, department, position, phone, email, start_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'active')) RETURNING *`,
      [employee_code, full_name, department, position, phone, email, start_date || null, status]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Mã nhân viên đã tồn tại' });
    }
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { employee_code, full_name, department, position, phone, email, start_date, status } = req.body;
    const { rows } = await pool.query(
      `UPDATE employees SET employee_code=$1, full_name=$2, department=$3, position=$4,
       phone=$5, email=$6, start_date=$7, status=$8 WHERE id=$9 RETURNING *`,
      [employee_code, full_name, department, position, phone, email, start_date || null, status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Mã nhân viên đã tồn tại' });
    }
    next(err);
  }
});

router.delete('/:id', requireManagerRole, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM employees WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
