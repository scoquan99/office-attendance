import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireManagerRole } from '../middleware/auth.js';
import { positionRank } from '../config/managerPositions.js';
import { checkOrgPair } from '../config/orgStructure.js';
import { parseId } from '../utils/id.js';
import { generateTempPassword } from '../utils/password.js';
import { checkEmployeeField, EMAIL_UNIQUE_KEY } from '../utils/validate.js';

const router = Router();

// Giới hạn phân trang: tránh SELECT không giới hạn làm chậm / tốn bộ nhớ
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// Chỉ trả các cột an toàn. KHÔNG BAO GIỜ dùng SELECT * / RETURNING * trên bảng employees
// vì sẽ làm lộ cột password_hash cho mọi người dùng đã đăng nhập.
const EMP_COLS =
  'id, employee_code, full_name, department, position, phone, email, start_date, status, created_at';

const VALID_STATUS = ['active', 'inactive', 'pending'];
// Quản lý chỉ được TẠO nhân viên ở trạng thái đang làm / đã nghỉ; 'pending' (chờ duyệt) chỉ do tự đăng ký mà có.
const CREATE_STATUS = ['active', 'inactive'];

// Các trường được phép sửa: quản lý sửa được tất cả, nhân viên thường chỉ sửa
// thông tin liên hệ của CHÍNH MÌNH (không tự đổi được chức vụ, phòng ban, trạng thái...).
const MANAGER_EDITABLE = ['employee_code', 'full_name', 'department', 'position', 'phone', 'email', 'start_date', 'status'];
const SELF_EDITABLE = ['full_name', 'phone', 'email'];

const NO_RANK = {
  error: 'Bạn không có đủ cấp bậc để thực hiện thao tác này đối với nhân viên / chức vụ đó',
};

// Thông báo cho lỗi trùng dữ liệu (23505) theo ràng buộc bị vi phạm
function duplicateMessage(err) {
  return err.constraint === EMAIL_UNIQUE_KEY
    ? 'Email này đã được dùng cho một nhân viên khác'
    : 'Mã nhân viên đã tồn tại';
}

// Phân cấp: chỉ được tác động (vô hiệu hoá, đổi chức vụ...) lên người có bậc THẤP HƠN mình.
function outranks(actor, targetPosition) {
  return positionRank(actor.position) > positionRank(targetPosition);
}

// Nhân viên thường chỉ thấy SĐT, email, ngày vào làm của CHÍNH MÌNH; với người khác chỉ thấy mã, tên, phòng ban,
// chức vụ, trạng thái. Quản lý thấy đầy đủ. Nhờ vậy ai đó có tài khoản cũng không đọc được thông tin liên hệ cả công ty.
function viewFor(req, row) {
  if (req.user.isManager || row.id === req.user.id) return row;
  return {
    id: row.id,
    employee_code: row.employee_code,
    full_name: row.full_name,
    department: row.department,
    position: row.position,
    status: row.status,
    phone: null,
    email: null,
    start_date: null,
    created_at: null,
  };
}

// GET /api/employees?q=&department=&status=&page=1&page_size=50
router.get('/', async (req, res, next) => {
  try {
    const { q, department, status } = req.query;
    const conditions = [];
    const params = [];

    // Tài khoản đang chờ duyệt chỉ quản lý mới thấy
    if (!req.user.isManager) conditions.push("status <> 'pending'");

    if (q) {
      if (typeof q !== 'string' || q.length > 100) {
        return res.status(400).json({ error: 'Từ khóa tìm kiếm tối đa 100 ký tự' });
      }
      // Thoát ký tự đặc biệt của LIKE (%, _, \) để tìm kiếm chính xác nội dung người dùng nhập
      const escaped = String(q).replace(/[%_\\]/g, '\\$&');
      params.push(`%${escaped}%`);
      conditions.push(`(full_name ILIKE $${params.length} OR employee_code ILIKE $${params.length})`);
    }
    if (department) {
      if (typeof department !== 'string' || department.length > 100) {
        return res.status(400).json({ error: 'Phòng ban không hợp lệ' });
      }
      params.push(department);
      conditions.push(`department = $${params.length}`);
    }
    if (status) {
      if (!VALID_STATUS.includes(status)) {
        return res.status(400).json({ error: 'Trạng thái lọc không hợp lệ' });
      }
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    // Phân trang: page (bắt đầu từ 1) và page_size (tối đa MAX_PAGE_SIZE)
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(req.query.page_size)) || DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * pageSize;

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(pageSize);
    params.push(offset);
    const { rows } = await pool.query(
      `SELECT ${EMP_COLS} FROM employees ${where} ORDER BY full_name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows.map((row) => viewFor(req, row)));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID nhân viên không hợp lệ' });

    const { rows } = await pool.query(`SELECT ${EMP_COLS} FROM employees WHERE id = $1`, [id]);
    const row = rows[0];
    // Đăng ký chờ duyệt chỉ quản lý (và chính chủ) mới thấy
    if (!row || (row.status === 'pending' && !req.user.isManager && row.id !== req.user.id)) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    }
    res.json(viewFor(req, row));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireManagerRole, async (req, res, next) => {
  try {
    const body = req.body || {};
    const { employee_code, full_name, department, position, phone, email, start_date, status } = body;

    for (const field of ['employee_code', 'full_name', 'department', 'position', 'phone', 'email', 'start_date']) {
      const fieldError = checkEmployeeField(field, body[field]);
      if (fieldError) return res.status(400).json({ error: fieldError });
    }
    if (typeof employee_code !== 'string' || !employee_code.trim() || typeof full_name !== 'string' || !full_name.trim()) {
      return res.status(400).json({ error: 'Thiếu mã nhân viên hoặc họ tên' });
    }
    if (status && !CREATE_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    }
    // Phòng ban / chức vụ phải nằm trong cơ cấu tổ chức của công ty
    const orgError = checkOrgPair(department, position);
    if (orgError) return res.status(400).json({ error: orgError });

    // Không được tạo nhân viên có chức vụ bậc BẰNG hoặc CAO HƠN chính mình
    if (position && positionRank(position) >= positionRank(req.user.position)) {
      return res.status(403).json(NO_RANK);
    }

    // Cấp luôn tài khoản đăng nhập bằng mật khẩu tạm. Mật khẩu chỉ được trả về ĐÚNG MỘT LẦN trong phản hồi này
    // (database chỉ lưu bản băm); nhân viên bắt buộc phải đổi ngay lần đăng nhập đầu tiên.
    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const { rows } = await pool.query(
      `INSERT INTO employees (employee_code, full_name, department, position, phone, email, start_date, status,
                             password_hash, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'active'),$9,true) RETURNING ${EMP_COLS}`,
      [
        employee_code.trim(),
        full_name.trim(),
        department || null,
        position || null,
        phone || null,
        email || null,
        start_date || null,
        status || null,
        passwordHash,
      ]
    );
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ ...rows[0], temporary_password: temporaryPassword });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: duplicateMessage(err) });
    }
    next(err);
  }
});

// PUT /api/employees/:id — quản lý sửa mọi nhân viên; nhân viên thường chỉ sửa thông tin liên hệ của mình.
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID nhân viên không hợp lệ' });

    const isSelf = id === req.user.id;
    if (!req.user.isManager && !isSelf) {
      return res.status(403).json({ error: 'Bạn chỉ được sửa thông tin của chính mình' });
    }

    const editable = req.user.isManager ? MANAGER_EDITABLE : SELF_EDITABLE;
    const body = req.body || {};

    // Form "Sửa" luôn gửi đủ mọi trường, kể cả những trường không đổi. Vì vậy các quy tắc dưới đây
    // chỉ áp dụng cho trường nào THỰC SỰ thay đổi so với giá trị hiện tại trong database.
    const sensitiveSent = ['department', 'position', 'status'].some(
      (f) => editable.includes(f) && body[f] !== undefined
    );
    // Mã nhân viên chính là TÊN ĐĂNG NHẬP nên cũng phải theo phân cấp (xem codeChanged bên dưới)
    const codeSent = editable.includes('employee_code') && body.employee_code !== undefined;
    if (sensitiveSent || codeSent) {
      const { rows: curRows } = await pool.query(
        'SELECT employee_code, department, position, status FROM employees WHERE id = $1',
        [id]
      );
      if (!curRows.length) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
      const cur = curRows[0];

      const nextDepartment = body.department !== undefined && editable.includes('department')
        ? (body.department || null) : cur.department;
      const nextPosition = body.position !== undefined && editable.includes('position')
        ? (body.position || null) : cur.position;

      const positionChanged = nextPosition !== cur.position;
      const statusChanged = editable.includes('status') && body.status !== undefined && body.status !== cur.status;
      const departmentChanged = nextDepartment !== cur.department;

      // Đổi mã nhân viên của người KHÁC = đổi tên đăng nhập của họ: người bậc thấp có thể làm giám đốc không đăng nhập
      // được nữa. Chỉ được đổi mã của người có bậc THẤP HƠN mình (tự đổi mã của chính mình thì được).
      const codeChanged =
        codeSent && typeof body.employee_code === 'string' && body.employee_code.trim() !== cur.employee_code;
      if (codeChanged && !isSelf && !outranks(req.user, cur.position)) {
        return res.status(403).json({
          error: 'Bạn không thể đổi mã đăng nhập của nhân viên có chức vụ ngang hoặc cao hơn mình',
        });
      }

      // 'pending' chỉ do tự đăng ký tạo ra; không đưa nhân viên đang làm / đã nghỉ quay lại trạng thái chờ duyệt
      if (statusChanged && body.status === 'pending') {
        return res.status(400).json({ error: 'Không thể chuyển nhân viên sang trạng thái chờ duyệt' });
      }

      // Chức vụ quyết định quyền, còn status 'inactive' tương đương xoá tài khoản
      // → đổi hai trường này phải theo quy tắc phân cấp.
      if (positionChanged || statusChanged) {
        if (isSelf) {
          return res.status(403).json({ error: 'Bạn không thể tự đổi chức vụ hoặc trạng thái của chính mình' });
        }
        if (!outranks(req.user, cur.position)) {
          return res.status(403).json(NO_RANK);
        }
        if (positionChanged && nextPosition && positionRank(nextPosition) >= positionRank(req.user.position)) {
          return res.status(403).json(NO_RANK);
        }
      }

      // Phòng ban / chức vụ mới phải nằm trong cơ cấu tổ chức. Chỉ kiểm khi có thay đổi để vẫn sửa được
      // các trường khác của nhân viên cũ có dữ liệu phòng ban/chức vụ không còn trong danh sách.
      if (departmentChanged || positionChanged) {
        const orgError = checkOrgPair(nextDepartment, nextPosition);
        if (orgError) return res.status(400).json({ error: orgError });
      }
    }

    const sets = [];
    const params = [];

    // Chỉ cập nhật những trường được gửi lên VÀ nằm trong danh sách cho phép
    // (các trường khác bị bỏ qua) — tránh việc thiếu trường làm ghi đè thành NULL.
    for (const field of editable) {
      if (body[field] === undefined) continue;
      let value = body[field];

      const fieldError = checkEmployeeField(field, value);
      if (fieldError) return res.status(400).json({ error: fieldError });

      if (field === 'employee_code' || field === 'full_name') {
        value = typeof value === 'string' ? value.trim() : '';
        if (!value) return res.status(400).json({ error: 'Mã nhân viên và họ tên không được để trống' });
        if (field === 'employee_code') {
          const { rows: existing } = await pool.query(
            'SELECT 1 FROM employees WHERE lower(employee_code) = lower($1) AND id <> $2',
            [value, id]
          );
          if (existing.length) {
            return res.status(409).json({ error: 'Mã nhân viên đã tồn tại' });
          }
        }
      } else if (field === 'status') {
        if (!VALID_STATUS.includes(value)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      } else if (value === '') {
        value = null;
      }

      params.push(value);
      sets.push(`${field} = $${params.length}`);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'Không có thông tin nào để cập nhật' });
    }

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE employees SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${EMP_COLS}`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: duplicateMessage(err) });
    }
    next(err);
  }
});

// POST /api/employees/:id/reset-password — quản lý cấp lại mật khẩu tạm cho nhân viên (quên mật khẩu,
// hoặc nhân viên cũ chưa có tài khoản). Trả về mật khẩu tạm đúng một lần; token cũ của nhân viên đó mất hiệu lực.
// Áp dụng quy tắc phân cấp như xoá/đổi chức vụ: cấp lại mật khẩu là cách chiếm tài khoản nếu cho phép với người ngang/cao hơn.
router.post('/:id/reset-password', requireManagerRole, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID nhân viên không hợp lệ' });
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Hãy dùng chức năng Đổi mật khẩu cho tài khoản của chính mình' });
    }

    const { rows } = await pool.query('SELECT position, status FROM employees WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    if (rows[0].status === 'pending') {
      return res.status(400).json({ error: 'Tài khoản đang chờ duyệt, hãy duyệt trước khi cấp mật khẩu' });
    }
    if (rows[0].status !== 'active') {
      return res.status(400).json({ error: 'Nhân viên đã nghỉ việc, không thể cấp mật khẩu' });
    }
    if (!outranks(req.user, rows[0].position)) {
      return res.status(403).json(NO_RANK);
    }

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await pool.query(
      'UPDATE employees SET password_hash = $1, must_change_password = true WHERE id = $2',
      [passwordHash, id]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ temporary_password: temporaryPassword });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/employees/:id — XOÁ MỀM: chuyển sang 'inactive' thay vì xoá hàng.
// Xoá cứng sẽ kéo theo ON DELETE CASCADE làm mất toàn bộ lịch sử chấm công và công việc.
// Tài khoản inactive không đăng nhập được và token cũ cũng bị chặn (xem requireAuth).
router.delete('/:id', requireManagerRole, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID nhân viên không hợp lệ' });
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính mình' });
    }

    const { rows: targetRows } = await pool.query('SELECT position FROM employees WHERE id = $1', [id]);
    if (!targetRows.length) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    if (!outranks(req.user, targetRows[0].position)) {
      return res.status(403).json({
        error: 'Bạn không thể xóa nhân viên có chức vụ ngang hoặc cao hơn mình',
      });
    }

    await pool.query("UPDATE employees SET status = 'inactive' WHERE id = $1", [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
