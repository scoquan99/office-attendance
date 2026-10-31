# Hệ thống Quản lý Nhân sự & Chấm công Văn phòng

Web app quản lý nhân viên và chấm công, xây dựng bằng **React (Vite)** ở frontend,
**Node.js/Express** ở backend, và **PostgreSQL** để lưu dữ liệu. Có đăng nhập, xuất
danh sách chấm công ra file **Excel (.xlsx)** để phục vụ kiểm tra/đối chiếu.

## Tính năng

- **Đăng nhập**: mỗi nhân viên được cấp tài khoản (đăng nhập bằng Mã nhân viên + mật khẩu)
  mới dùng được ứng dụng; phiên đăng nhập lưu 7 ngày (JWT). Đổi hoặc cấp lại mật khẩu thì
  mọi phiên cũ của tài khoản đó tự hết hiệu lực. Nhân viên tự đăng ký ở trạng thái **chờ duyệt**: quản lý phải bấm "Duyệt" ở trang Nhân sự thì họ mới đăng nhập được
- Quản lý nhân viên: thêm / sửa / cho nghỉ việc / tìm kiếm, lưu mã NV, phòng ban, chức vụ, trạng thái làm việc.
  "Phòng ban" và "Chức vụ" là dropdown chọn theo cơ cấu tổ chức của công ty; danh sách này do **backend** quản lý
  (`backend/src/config/orgStructure.js`), frontend lấy qua `GET /api/org` và backend từ chối giá trị ngoài danh sách
- **Cấp tài khoản cho nhân viên mới**: khi quản lý thêm nhân viên, hệ thống tự tạo **mật khẩu tạm** (hiện đúng một
  lần trên màn hình). Nhân viên bị bắt buộc đổi mật khẩu ngay lần đăng nhập đầu tiên. Quản lý cũng có nút
  **"Cấp lại MK"** cho nhân viên quên mật khẩu hoặc nhân viên cũ chưa có tài khoản; ai cũng tự đổi được mật khẩu
  từ menu tài khoản ở góc dưới thanh bên
- Chấm công: chấm công vào/ra theo ngày (kiểu "bấm giờ"), nhập/sửa thủ công, lọc theo khoảng ngày, nhân viên, phòng ban.
  Trạng thái **"Đi trễ"** được tự tính khi chấm công vào sau giờ bắt đầu làm việc (cấu hình ở mục "Quy tắc đi trễ")
- **Theo phòng ban**: gom nhân sự thành từng nhóm theo ban, mỗi ban là 1 ô — bấm vào sẽ chuyển
  sang trang Nhân sự đã lọc sẵn theo ban đó. Hiển thị sĩ số, tỉ lệ đã chấm công (%), giờ vào/ra từng người
- Xuất danh sách chấm công theo bộ lọc hiện tại ra file Excel để kiểm tra (chỉ quản lý)
- **Phân quyền và phân cấp**: Ban Giám đốc (Chủ tịch/CEO/Phó CEO) cộng 2 chức vụ cao nhất của mỗi phòng ban
  khác là "quản lý" (xem `backend/src/config/managerPositions.js`). Chỉ quản lý được thêm nhân viên, cho nghỉ việc,
  cấp lại mật khẩu, tạo/sửa/xóa chấm công thủ công, và chấm công hộ người khác. Nhân viên thường chỉ chấm công,
  xem việc và sửa thông tin liên hệ của **chính mình**. Giữa các quản lý có **phân cấp**:
  Chủ tịch > Tổng Giám đốc > Phó Tổng Giám đốc > quản lý phòng ban > nhân viên — chỉ được cho nghỉ việc, đổi chức vụ
  hoặc cấp lại mật khẩu cho người có bậc **thấp hơn** mình, và không được tạo/nâng ai lên bậc ngang hoặc cao hơn mình. **Phạm vi dữ liệu**: nhân viên thường chỉ thấy SĐT, email,
  ngày vào làm, giờ chấm công và công việc của chính mình (với người khác chỉ thấy mã, tên, phòng ban, chức vụ)
- **Cho nghỉ việc** là xóa mềm (chuyển sang "Đã nghỉ"): tài khoản không đăng nhập được nữa nhưng lịch sử chấm công
  và công việc vẫn được giữ lại
- Toàn bộ dữ liệu lưu trong PostgreSQL, có ràng buộc chống chấm công trùng ngày cho 1 nhân viên

## Cấu trúc thư mục

```
office-attendance/
├── backend/                # API Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── db.js           # Kết nối PostgreSQL + tự áp dụng schema.sql khi khởi động
│   │   ├── server.js       # Khởi tạo Express app
│   │   ├── config/
│   │   │   ├── orgStructure.js    # Cơ cấu Phòng ban → Chức vụ (nguồn duy nhất)
│   │   │   └── managerPositions.js# Chức vụ quản lý và bậc phân cấp
│   │   ├── middleware/
│   │   │   ├── auth.js     # Kiểm tra JWT (requireAuth), phân quyền quản lý
│   │   │   └── rateLimit.js# Giới hạn số lần đăng nhập / đăng ký / đổi mật khẩu
│   │   ├── db/
│   │   │   ├── schema.sql  # Cấu trúc bảng. Chạy lại an toàn; tự áp dụng mỗi lần backend khởi động
│   │   │   └── seed.sql    # Dữ liệu mẫu (tùy chọn)
│   │   ├── utils/          # Kiểm tra dữ liệu, giờ văn phòng, mã nhân viên, mật khẩu tạm
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── employees.js
│   │       ├── attendance.js
│   │       ├── dashboard.js
│   │       ├── tasks.js
│   │       └── org.js
│   ├── .env.example
│   └── package.json
└── frontend/                # React app (Vite)
    ├── src/
    │   ├── context/AuthContext.jsx
    │   ├── pages/LoginPage.jsx
    │   ├── pages/AttendancePage.jsx
    │   ├── pages/EmployeesPage.jsx
    │   ├── pages/DepartmentsPage.jsx
    │   ├── useOrg.js         # Lấy danh sách Phòng ban → Chức vụ từ backend
    │   ├── components/
    │   ├── api.js
    │   └── index.css
    └── package.json
```

## 1. Cài đặt PostgreSQL & tạo database

```bash
# Tạo database rỗng (đổi tên/user/password nếu cần)
createdb office_attendance

# (Tùy chọn) Thêm dữ liệu mẫu để test — chạy SAU khi backend đã khởi động ít nhất một lần
psql -d office_attendance -f backend/src/db/seed.sql   # 3 nhân viên mẫu, KHÔNG kèm tài khoản đăng nhập (repo không chứa mật khẩu nào)
```

**Không cần tự chạy `schema.sql` hay file migration.** Mỗi lần khởi động, backend tự áp dụng
`backend/src/db/schema.sql` (chỉ gồm lệnh "IF NOT EXISTS", chạy lại bao nhiêu lần cũng an toàn, không đụng dữ liệu
có sẵn). Nhờ vậy cả database mới lẫn database cũ đều được tạo/nâng cấp tự động. Khi cần thay đổi cấu trúc bảng,
hãy thêm vào `schema.sql` thay vì tạo thêm file migration riêng.

## 2. Chạy backend

```bash
cd backend
cp .env.example .env
# Mở .env, chỉnh DB_USER / DB_PASSWORD / DB_NAME cho khớp với PostgreSQL của bạn.
# JWT_SECRET: để trống khi dev (mỗi lần khởi động dùng secret ngẫu nhiên tạm), hoặc đặt một chuỗi ngẫu nhiên, dài.
# KHÔNG dùng giá trị mẫu "change-me-to-a-random-secret" — backend sẽ từ chối khởi động.

npm install
npm run dev      # chạy với nodemon, tự reload khi sửa code
# hoặc: npm start
```

Backend chạy tại `http://localhost:4000`. Kiểm tra nhanh: `GET http://localhost:4000/api/health`.
Nếu chưa kết nối được PostgreSQL, backend thử lại khoảng 30 giây rồi dừng với thông báo lỗi.

### Quy tắc đi trễ

Chấm công vào sau giờ bắt đầu + số phút châm chước thì tự được ghi là **"Đi trễ"**. Cấu hình trong `.env`:

```
WORK_START_TIME=08:00     # giờ bắt đầu làm việc (HH:MM), mặc định 08:00
LATE_GRACE_MINUTES=0      # số phút châm chước, mặc định 0
OFFICE_TZ=Asia/Ho_Chi_Minh
```

So sánh theo **phút** và theo giờ văn phòng (`OFFICE_TZ`), không phụ thuộc múi giờ máy chủ. Ví dụ với 08:00 và châm chước 0:
vào lúc 08:00:45 vẫn đúng giờ, từ 08:01:00 là đi trễ.

## 3. Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại `http://localhost:5173` (Vite tự động proxy các request `/api` sang
`http://localhost:4000`, cấu hình trong `vite.config.js`).

Mở trình duyệt tại `http://localhost:5173` — sẽ gặp màn hình đăng nhập trước khi vào app.

### Tạo tài khoản đầu tiên (và tài khoản quản lý)

Hệ thống **không có tài khoản mặc định** (không còn mật khẩu kiểm thử nào trong repo).

1. Vào `/register` để đăng ký tài khoản đầu tiên. Mã nhân viên được cấp tự động (`NV0001`, `NV0002`...; nếu đã nạp dữ liệu mẫu thì bắt đầu từ `NV0004`)
   và hiện trên màn hình sau khi đăng ký — hãy ghi lại.
2. Tài khoản tự đăng ký luôn ở trạng thái **chờ duyệt** (chưa đăng nhập được), và chức vụ quản lý **không thể tự đăng ký**
   (để người lạ không tự phong quyền). Vì chưa có quản lý nào để duyệt, tài khoản quản lý đầu tiên phải được kích hoạt
   trực tiếp trong database, ví dụ biến tài khoản bạn vừa đăng ký (đổi `NV0001` thành mã của bạn) thành Tổng Giám đốc:

   ```sql
   UPDATE employees
   SET status = 'active', department = 'Ban Giám đốc', position = 'Tổng Giám đốc (CEO)'
   WHERE employee_code = 'NV0001';
   ```

3. Từ đó, quản lý duyệt các tài khoản tự đăng ký (nút **Duyệt** / **Từ chối** ở trang **Nhân sự**), thêm nhân viên và
   cấp mật khẩu tạm ngay trong app.

## 4. Build cho production

```bash
cd frontend
npm run build     # tạo thư mục dist/, có thể deploy lên bất kỳ static host nào
```

Backend có thể deploy như một Node.js service bình thường (PM2, Docker, hoặc các
nền tảng như Render/Railway/VPS...), chỉ cần cấu hình biến môi trường kết nối tới
PostgreSQL của bạn. Khi chạy thật nhớ đặt `NODE_ENV=production`, `JWT_SECRET` ngẫu nhiên, và
`TRUST_PROXY=1` nếu backend đứng sau một reverse proxy (nginx...) để giới hạn đăng nhập tính đúng IP người dùng.

## 5. Chạy toàn bộ bằng Docker (không cần cài Node/PostgreSQL trên máy)

Cách này dựng cả 3 thành phần (PostgreSQL + backend + frontend) bằng
`docker-compose.yml` ở thư mục gốc. Yêu cầu máy đã cài **Docker Desktop** (Windows/Mac)
hoặc **Docker Engine + Docker Compose plugin** (Linux) và đang ở trạng thái chạy.

### 5.1. Tạo file cấu hình `.env` (bắt buộc)

```bash
cp .env.docker.example .env
```

Mở `.env` vừa tạo (ở thư mục gốc, ngang hàng `docker-compose.yml`) và **đặt hai giá trị bắt buộc**: `POSTGRES_PASSWORD`
(mật khẩu PostgreSQL) và `JWT_SECRET` (chuỗi ngẫu nhiên, dài). Lệnh tạo giá trị ngẫu nhiên có sẵn trong file. Thiếu một trong
hai thì `docker compose` báo lỗi và không khởi động. Các giá trị khác (cổng, giờ bắt đầu làm việc...) có thể giữ mặc định.

### 5.2. Build và khởi động

Ở thư mục gốc dự án (nơi có `docker-compose.yml`):

```bash
docker compose up --build
```

Hoặc chạy nền (không chiếm terminal):

```bash
docker compose up --build -d
```

Lần đầu chạy, PostgreSQL tạo bảng bằng `schema.sql` và nạp dữ liệu mẫu từ `seed.sql`. Về sau, mỗi lần backend khởi động
nó lại tự áp dụng `schema.sql` (an toàn, xem mục 1) nên database cũ vẫn được nâng cấp khi bạn cập nhật code.

### 5.3. Truy cập

| Dịch vụ | Địa chỉ mặc định |
|---|---|
| Frontend (web app) | http://localhost:8080 |
| Backend API | http://localhost:4000 (chỉ truy cập được từ chính máy này) |
| PostgreSQL | `127.0.0.1:5432` (chỉ truy cập được từ chính máy này) — dùng được với pgAdmin như bình thường (user và db theo `.env`, mặc định `postgres` / `office_attendance`; mật khẩu là giá trị bạn đặt ở `POSTGRES_PASSWORD`) |

Cổng PostgreSQL và backend cố ý chỉ mở cho `127.0.0.1` để không lộ database/API ra mạng; người dùng truy cập qua
frontend (cổng 8080), nginx trong container sẽ chuyển `/api` sang backend. Nếu cần mở cho máy khác, hãy sửa mục `ports`
trong `docker-compose.yml` (và dùng mật khẩu DB mạnh).

Mở http://localhost:8080 → vì là cài đặt hoàn toàn mới nên chưa có tài khoản nào đăng
nhập được — vào `http://localhost:8080/register` để tạo tài khoản đầu tiên, rồi làm theo mục
"Tạo tài khoản đầu tiên (và tài khoản quản lý)" ở trên.

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
| POST | `/api/auth/register` | Nhân viên tự đăng ký, tài khoản ở trạng thái chờ duyệt, không trả token (không được chọn chức vụ quản lý) |
| POST | `/api/auth/login` | Đăng nhập bằng `{ employee_code, password }`, trả về JWT (403 nếu tài khoản chưa được duyệt) |
| GET | `/api/auth/me` | Thông tin nhân viên đang đăng nhập, gồm cờ `isManager` *(cần token)* |
| POST | `/api/auth/change-password` | Đổi mật khẩu `{ current_password, new_password }`, trả token mới *(cần token)* |
| GET | `/api/org` | Danh sách Phòng ban → Chức vụ *(công khai, trang Đăng ký cần dùng)* |
| GET | `/api/employees?q=&department=&status=` | Danh sách nhân viên *(cần đăng nhập; nhân viên thường không thấy SĐT/email/ngày vào làm của người khác và không thấy tài khoản chờ duyệt)* |
| POST | `/api/employees` | Thêm nhân viên, kèm mật khẩu tạm trả về một lần *(chỉ quản lý)* |
| PUT | `/api/employees/:id` | Sửa nhân viên; duyệt tài khoản chờ duyệt = đổi `status` sang `active` *(quản lý sửa mọi người; nhân viên thường chỉ sửa thông tin liên hệ của mình)* |
| POST | `/api/employees/:id/reset-password` | Cấp lại mật khẩu tạm *(chỉ quản lý, theo phân cấp)* |
| DELETE | `/api/employees/:id` | Cho nghỉ việc (xóa mềm) *(chỉ quản lý, theo phân cấp)* |
| GET | `/api/attendance?from=&to=&employee_id=&department=` | Danh sách chấm công *(quản lý xem tất cả; nhân viên thường chỉ xem của chính mình)* |
| POST | `/api/attendance/checkin` | Chấm công vào (hôm nay), tự tính "Đi trễ" *(chính mình; quản lý chấm hộ được)* |
| POST | `/api/attendance/checkout` | Chấm công ra (hôm nay) *(chính mình; quản lý chấm hộ được)* |
| POST | `/api/attendance` | Thêm/sửa thủ công 1 bản ghi chấm công *(chỉ quản lý)* |
| DELETE | `/api/attendance/:id` | Xóa bản ghi chấm công *(chỉ quản lý)* |
| GET | `/api/attendance/export/xlsx?from=&to=&employee_id=&department=` | Xuất Excel theo bộ lọc *(chỉ quản lý)* |
| GET | `/api/dashboard?date=YYYY-MM-DD` | Nhân sự gom theo phòng ban kèm trạng thái chấm công *(cần đăng nhập; nhân viên thường chỉ thấy số liệu tổng hợp và dòng của chính mình)* |
| GET/POST/PUT/DELETE | `/api/tasks` | Công việc của từng nhân viên *(chỉ xem/sửa việc của chính mình, quản lý thì mọi người)* |

Các route "cần đăng nhập" yêu cầu header `Authorization: Bearer <token>` (frontend
tự động gắn header này sau khi đăng nhập). Tài khoản đang dùng mật khẩu tạm chỉ gọi được
`/api/auth/me` và `/api/auth/change-password` cho tới khi đổi mật khẩu, các route khác trả `403`.

## Gợi ý mở rộng sau này

- Phân quyền chi tiết hơn theo vai trò (hiện chỉ có 2 mức: quản lý / nhân viên, kèm phân cấp giữa các quản lý) —
  tài liệu cơ cấu tổ chức bạn cung cấp có sẵn khung Role/Permission có thể dùng làm tham khảo
- Thông báo/nhắc nhở nếu quên chấm công ra
- Tính "về sớm", tăng ca, và ngày nghỉ lễ vào quy tắc chấm công
- Lịch sử chỉnh sửa (audit log) cho các thay đổi thủ công trên bảng chấm công
- Bộ kiểm thử tự động cho ma trận phân quyền (nhân viên so với quản lý, các bậc phân cấp)
