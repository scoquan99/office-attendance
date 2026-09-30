# Hệ thống Quản lý Nhân sự & Chấm công Văn phòng

Web app quản lý nhân viên và chấm công, xây dựng bằng **React (Vite)** ở frontend,
**Node.js/Express** ở backend, và **PostgreSQL** để lưu dữ liệu. Có đăng nhập, xuất
danh sách chấm công ra file **Excel (.xlsx)** để phục vụ kiểm tra/đối chiếu.

## Tính năng

- **Đăng nhập**: mỗi nhân viên được cấp tài khoản (đăng nhập bằng Mã nhân viên + mật khẩu)
  mới dùng được ứng dụng; phiên đăng nhập lưu 7 ngày (JWT)
- Quản lý nhân viên: thêm / sửa / xóa / tìm kiếm, lưu mã NV, phòng ban, chức vụ, trạng thái làm việc.
  "Phòng ban" và "Chức vụ" là dropdown chọn sẵn theo cơ cấu tổ chức mẫu (`frontend/src/orgStructure.js`)
- Chấm công: chấm công vào/ra theo ngày (kiểu "bấm giờ"), nhập/sửa thủ công, lọc theo khoảng ngày, nhân viên, phòng ban
- **Theo phòng ban**: gom nhân sự thành từng nhóm theo ban, mỗi ban là 1 ô — bấm vào sẽ chuyển
  sang trang Nhân sự đã lọc sẵn theo ban đó. Hiển thị sĩ số, tỉ lệ đã chấm công (%), giờ vào/ra từng người
- Xuất danh sách chấm công theo bộ lọc hiện tại ra file Excel để kiểm tra
- **Phân quyền thêm/xóa nhân viên**: Ban Giám đốc (Chủ tịch/CEO/Phó CEO) cộng 2 chức vụ
  cao nhất của mỗi phòng ban khác mới thấy và dùng được nút "+ Thêm nhân viên" và "Xóa"
  (xem `backend/src/config/managerPositions.js`).
  Xem/sửa nhân viên vẫn mở cho mọi tài khoản đã đăng nhập — chỉ riêng thêm mới và xóa bị giới hạn
- Toàn bộ dữ liệu lưu trong PostgreSQL, có ràng buộc chống chấm công trùng ngày cho 1 nhân viên

## Cấu trúc thư mục

```
office-attendance/
├── backend/                # API Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── db.js           # Kết nối PostgreSQL (pg Pool)
│   │   ├── server.js       # Khởi tạo Express app
│   │   ├── middleware/
│   │   │   └── auth.js     # Middleware kiểm tra JWT (requireAuth)
│   │   ├── db/
│   │   │   ├── schema.sql        # Câu lệnh tạo bảng (dùng cho cài mới)
│   │   │   ├── migration_auth.sql# Thêm cột đăng nhập cho DB đã có sẵn dữ liệu
│   │   │   └── seed.sql          # Dữ liệu mẫu (tùy chọn)
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── employees.js
│   │       ├── attendance.js
│   │       └── dashboard.js
│   ├── .env.example
│   └── package.json
└── frontend/                # React app (Vite)
    ├── src/
    │   ├── context/AuthContext.jsx
    │   ├── pages/LoginPage.jsx
    │   ├── pages/AttendancePage.jsx
    │   ├── pages/EmployeesPage.jsx
    │   ├── pages/DepartmentsPage.jsx
    │   ├── orgStructure.js   # Cơ cấu Phòng ban → Chức vụ mẫu
    │   ├── components/
    │   ├── api.js
    │   └── index.css
    └── package.json
```

## 1. Cài đặt PostgreSQL & tạo database

```bash
# Tạo database (đổi tên/user/password nếu cần)
createdb office_attendance

# Tạo bảng (cài mới, đã bao gồm cột đăng nhập)
psql -d office_attendance -f backend/src/db/schema.sql

# (Tùy chọn) Thêm dữ liệu mẫu để test
psql -d office_attendance -f backend/src/db/seed.sql
```

> Nếu database của bạn **đã có sẵn dữ liệu** từ trước khi có tính năng đăng nhập,
> chạy thêm `backend/src/db/migration_auth.sql` (qua psql hoặc Query Tool trong
> pgAdmin) để thêm cột `password_hash` mà không mất dữ liệu.

## 2. Chạy backend

```bash
cd backend
cp .env.example .env
# Mở .env, chỉnh DB_USER / DB_PASSWORD / DB_NAME cho khớp với PostgreSQL của bạn,
# và đổi JWT_SECRET thành một chuỗi ngẫu nhiên, giữ bí mật

npm install
npm run dev      # chạy với nodemon, tự reload khi sửa code
# hoặc: npm start
```

Backend chạy tại `http://localhost:4000`. Kiểm tra nhanh: `GET http://localhost:4000/api/health`.

## 3. Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại `http://localhost:5173` (Vite tự động proxy các request `/api` sang
`http://localhost:4000`, cấu hình trong `vite.config.js`).

Mở trình duyệt tại `http://localhost:5173` — sẽ gặp màn hình đăng nhập trước khi vào app.

### Tài khoản kiểm thử

Sau khi chạy `migration_auth.sql`, nhân viên **Do Hong Quan** (mã NV `2301140082`)
có thể đăng nhập bằng:

- Mã nhân viên: `2301140082`
- Mật khẩu: `123456`

Đây là mật khẩu dùng để kiểm thử cục bộ — nên đổi hoặc xóa khi triển khai thật.
Các nhân viên khác chưa có mật khẩu sẽ chưa đăng nhập được cho tới khi được cấp
(thêm dòng `UPDATE employees SET password_hash = ... WHERE employee_code = '...'`
tương tự trong `migration_auth.sql`, dùng `bcryptjs` để băm mật khẩu).

## 4. Build cho production

```bash
cd frontend
npm run build     # tạo thư mục dist/, có thể deploy lên bất kỳ static host nào
```

Backend có thể deploy như một Node.js service bình thường (PM2, Docker, hoặc các
nền tảng như Render/Railway/VPS...), chỉ cần cấu hình biến môi trường kết nối tới
PostgreSQL của bạn.

## 5. Chạy toàn bộ bằng Docker (không cần cài Node/PostgreSQL trên máy)

Cách này dựng cả 3 thành phần (PostgreSQL + backend + frontend) bằng
`docker-compose.yml` ở thư mục gốc. Yêu cầu máy đã cài **Docker Desktop** (Windows/Mac)
hoặc **Docker Engine + Docker Compose plugin** (Linux) và đang ở trạng thái chạy.

### 5.1. (Tùy chọn) Tùy chỉnh cấu hình

```bash
cp .env.docker.example .env
```

Mở `.env` vừa tạo (ở thư mục gốc, ngang hàng `docker-compose.yml`) nếu muốn đổi
mật khẩu DB, cổng, hay `JWT_SECRET`. Bỏ qua bước này nếu chỉ muốn chạy thử nhanh với
giá trị mặc định.

### 5.2. Build và khởi động

Ở thư mục gốc dự án (nơi có `docker-compose.yml`):

```bash
docker compose up --build
```

Hoặc chạy nền (không chiếm terminal):

```bash
docker compose up --build -d
```

Lần đầu chạy, PostgreSQL trong container sẽ tự động tạo bảng bằng
`backend/src/db/schema.sql` và nạp dữ liệu mẫu từ `seed.sql` — **không cần tự chạy
schema.sql qua pgAdmin như khi cài thủ công ở trên**. Việc này chỉ xảy ra 1 lần duy
nhất (khi volume dữ liệu `pgdata` còn trống).

### 5.3. Truy cập

| Dịch vụ | Địa chỉ mặc định |
|---|---|
| Frontend (web app) | http://localhost:8080 |
| Backend API | http://localhost:4000 (vd: `GET /api/health`) |
| PostgreSQL | `localhost:5432` — dùng được với pgAdmin như bình thường (user/password/db theo `.env`, mặc định đều là `postgres` / `postgres` / `office_attendance`) |

Mở http://localhost:8080 → vì là cài đặt hoàn toàn mới nên chưa có tài khoản nào đăng
nhập được — vào `http://localhost:8080/register` để tạo tài khoản đầu tiên.

### 5.4. Các lệnh thường dùng

```bash
docker compose logs -f              # xem log realtime cả 3 service
docker compose logs -f backend      # chỉ xem log backend
docker compose ps                   # xem trạng thái các container
docker compose down                 # dừng và xóa container (giữ nguyên dữ liệu trong volume pgdata)
docker compose down -v              # dừng và XÓA LUÔN dữ liệu PostgreSQL (về trạng thái cài mới hoàn toàn)
docker compose up --build           # build lại sau khi sửa code (backend/frontend)
```

Sau khi sửa code backend hoặc frontend, cần `docker compose up --build` lại để build
ảnh mới — không tự hot-reload như khi chạy `npm run dev` ở mục 2–3 (cách Docker này
phù hợp để chạy thử toàn bộ hệ thống giống môi trường thật, không dùng để phát triển
hằng ngày).

## API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/login` | Đăng nhập bằng `{ employee_code, password }`, trả về JWT |
| GET | `/api/auth/me` | Thông tin nhân viên đang đăng nhập (cần token) |
| GET | `/api/employees?q=&department=&status=` | Danh sách nhân viên *(cần đăng nhập)* |
| POST | `/api/employees` | Thêm nhân viên *(cần đăng nhập)* |
| PUT | `/api/employees/:id` | Sửa nhân viên *(cần đăng nhập)* |
| DELETE | `/api/employees/:id` | Xóa nhân viên *(cần đăng nhập)* |
| GET | `/api/attendance?from=&to=&employee_id=&department=` | Danh sách chấm công *(cần đăng nhập)* |
| POST | `/api/attendance/checkin` | Chấm công vào (hôm nay) *(cần đăng nhập)* |
| POST | `/api/attendance/checkout` | Chấm công ra (hôm nay) *(cần đăng nhập)* |
| POST | `/api/attendance` | Thêm/sửa thủ công 1 bản ghi chấm công *(cần đăng nhập)* |
| DELETE | `/api/attendance/:id` | Xóa bản ghi chấm công *(cần đăng nhập)* |
| GET | `/api/attendance/export/xlsx?from=&to=&employee_id=&department=` | Xuất Excel theo bộ lọc *(cần đăng nhập)* |
| GET | `/api/dashboard?date=YYYY-MM-DD` | Nhân sự gom theo phòng ban kèm trạng thái chấm công *(cần đăng nhập)* |

Các route "cần đăng nhập" yêu cầu header `Authorization: Bearer <token>` (frontend
tự động gắn header này sau khi đăng nhập). Riêng `POST /api/employees` và
`DELETE /api/employees/:id` yêu cầu thêm: tài khoản đang đăng nhập phải có
`position` nằm trong danh sách `backend/src/config/managerPositions.js` (Ban Giám đốc
cộng 2 chức vụ cao nhất mỗi phòng ban khác), nếu không sẽ trả về lỗi `403`.

## Gợi ý mở rộng sau này

- Phân quyền theo vai trò (nhân viên / trưởng phòng / admin) — tài liệu cơ cấu tổ
  chức bạn cung cấp có sẵn khung Role/Permission có thể dùng làm tham khảo
- Trang quản trị để cấp/đổi mật khẩu cho từng nhân viên ngay trong app (hiện đang
  cấp thủ công qua SQL)
- Tính công tự động (giờ làm, đi trễ/về sớm dựa trên giờ hành chính cấu hình)
- Thông báo/nhắc nhở nếu quên chấm công ra
- Lịch sử chỉnh sửa (audit log) cho các thay đổi thủ công trên bảng chấm công
