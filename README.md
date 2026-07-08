# AutoGrade — Hệ thống chấm điểm code tự động

Đồ án môn **Công nghệ phần mềm cho AI**. Kiến trúc tách rời:

```
autograde/
├── frontend/   # React + Vite + TypeScript (giao diện SV & GV)
└── backend/    # Node + Express + TypeScript + PostgreSQL (API, auth, chấm bài)
```

Frontend và backend là **2 project chạy độc lập**. Frontend gọi backend qua REST API (JSON + JWT).

---

## 1. Yêu cầu môi trường

- **Node.js** ≥ 18
- **Tài khoản Supabase** (gói free là đủ) — Supabase đóng vai trò **cơ sở dữ liệu PostgreSQL** cho backend
- npm

> Không cần cài PostgreSQL trên máy: database nằm trên Supabase. Backend (Express) kết nối Supabase **bằng API key** (thư viện `@supabase/supabase-js`) — chỉ cần Project URL + key, không cần chuỗi kết nối Postgres.

---

## 2. Chạy BACKEND (kết nối Supabase bằng API key)

**Bước 1 — Tạo project & lấy khóa:**
1. Tạo project tại <https://supabase.com> (đợi database khởi tạo xong).
2. Vào **Project Settings → API**, copy 2 giá trị:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (mục *Project API keys*) → `SUPABASE_SERVICE_ROLE_KEY`
   > ⚠️ `service_role` có toàn quyền và bỏ qua RLS — chỉ đặt ở backend, **không bao giờ** đưa ra frontend.

**Bước 2 — Tạo bảng:** mở **SQL Editor** trên Supabase, dán toàn bộ nội dung `backend/db/schema.sql` rồi bấm **Run**.

**Bước 3 — Chạy:**
```bash
cd backend
npm install
cp .env.example .env          # dán SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY
npm run dev                   # chạy ở http://localhost:4000
```

Kiểm tra: mở http://localhost:4000/api/health → `{"ok":true}`.

> **Vì sao không cần RLS?** Mọi truy cập DB đều đi qua server Express (dùng `service_role`), không expose API công khai của Supabase ra frontend, nên phân quyền nằm ở middleware Express là đủ.

## 3. Chạy FRONTEND

```bash
cd frontend
npm install
cp .env.example .env          # mặc định trỏ tới http://localhost:4000/api
npm run dev                   # chạy ở http://localhost:5173
```

Mở http://localhost:5173, **đăng ký tài khoản** → xác nhận email → đăng nhập.

---

## 4. Cấu hình backend (`backend/.env`)

| Biến | Ý nghĩa |
|------|---------|
| `PORT` | Cổng backend (mặc định 4000) |
| `APP_URL` | URL frontend, dùng để tạo link trong email (mặc định `http://localhost:5173`) |
| `SUPABASE_URL` | Project URL của Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Khóa `service_role` (chỉ ở backend) |
| `JWT_SECRET` | Chuỗi bí mật ký JWT — **đổi thành chuỗi ngẫu nhiên dài** |
| `JWT_EXPIRES_IN` | Thời hạn token (mặc định `7d`) |
| `UPLOAD_DIR` | Thư mục lưu file upload (mặc định `uploads`) |
| `SMTP_*` | Cấu hình gửi email (xem mục 5) |
| `GRADING_API_KEY` | Khóa API cho mô hình chấm (nhóm tự dùng) |

---

## 5. Email xác nhận & Quên mật khẩu — hướng dẫn cụ thể

Hệ thống tự gửi email cho 2 luồng: **xác nhận email khi đăng ký** và **đặt lại mật khẩu**.

### 5.1 Chế độ DEV (không cần SMTP) — khuyến nghị khi làm đồ án

Để **trống** `SMTP_HOST` và `SMTP_USER` trong `.env`. Khi đó backend **không gửi mail thật** mà **in link ra console**:

```
[email:DEV] Tới: sv@student.hcmus.edu.vn
[email:DEV] Mã xác nhận email — AutoGrade
[email:DEV] Link: http://localhost:5173/xac-nhan-email?email=sv@student.hcmus.edu.vn&code=123456   ·   Mã: 123456
```

Lấy **mã 6 số** (hoặc mở link để tự điền sẵn) rồi nhập ở trang xác nhận. Với *Quên mật khẩu*, copy link trong console dán vào trình duyệt. Rất tiện để demo mà không cần email thật.

### 5.2 Gửi email thật (Gmail App Password)

1. Bật **2-Step Verification** cho tài khoản Google.
2. Vào <https://myaccount.google.com/apppasswords> tạo **App Password** (16 ký tự).
3. Điền vào `.env`:


> Thay vì Gmail, có thể dùng **Mailtrap** (sandbox, không gửi ra ngoài, rất hợp để test): lấy host/port/user/pass trong mục *SMTP Settings* của inbox Mailtrap rồi điền tương tự.

### 5.3 Luồng hoạt động

**Đăng ký → xác nhận email:**
1. SV/GV đăng ký ở `/register`.
2. Backend tạo user (`email_verified = false`) + **mã 6 số**, gửi email chứa mã (kèm link tự điền sẵn `/xac-nhan-email?email=...&code=...`).
3. Người dùng nhập email + mã → frontend gọi `POST /api/auth/verify-email` → `email_verified = true`. (API idempotent: gọi lại khi đã xác nhận vẫn báo thành công.)
4. **Chưa xác nhận thì không đăng nhập được** (login trả lỗi 403). Đăng ký lại bằng email **chưa xác nhận** sẽ ghi đè & gửi mã mới (không báo "email đã tồn tại").

**Quên mật khẩu → đặt lại:**
1. Ở `/quen-mat-khau`, nhập email → backend tạo `reset_token` (hết hạn sau **1 giờ**), gửi link `/dat-lai-mat-khau?token=...`.
2. Người dùng mở link, nhập mật khẩu mới → frontend gọi `POST /api/auth/reset-password` → đổi mật khẩu.
3. Để chống dò email, API luôn trả thông báo giống nhau dù email có tồn tại hay không.

---

## 6. Mô hình chấm điểm — phần nhóm tự cài đặt

Toàn bộ logic chấm nằm gọn trong `backend/src/grading/` và hiện là **stub** (ném lỗi "chưa cài đặt"). Bốn tiêu chí + tổng kết:

| File | Tiêu chí |
|------|----------|
| `testcase.ts` | Chạy code trong sandbox, so output → % pass |
| `plagiarism.ts` | So độ giống giữa các bài; vượt ngưỡng rubric → đánh dấu gian lận |
| `complexity.ts` | Đo độ phức tạp thuật toán (nhóm tự chọn phương pháp) |
| `style.ts` | Gọi API (LLM) chấm phong cách code |
| `aggregate.ts` | Tổng hợp 4 tiêu chí + rubric → điểm cuối + nhận xét |

`pipeline.ts` đã ráp sẵn thứ tự gọi; `services/gradingService.ts` lo lấy dữ liệu, ghi điểm, cập nhật `grading_jobs`.

**Gian lận là cổng chặn (gate):** trong rubric, thanh phần trăm "Ngưỡng giống" là **ngưỡng** — ví dụ thuật toán so ra 95% mà GV đặt ngưỡng 90% thì coi là gian lận → **0 điểm**, *không* cộng phần trăm vào điểm. Chỉ **testcase** và **độ phức tạp** mới có trọng số (tổng = 100%).

Khi mô hình chưa cài, hệ thống vẫn chạy đầy đủ: đăng ký/đăng nhập, tạo lớp, ra đề, nộp bài, GV chấm tay & công bố điểm, xuất Excel. Nút *"Chạy chấm tự động"* sẽ báo mô hình chưa sẵn sàng cho tới khi nhóm hiện thực các file trên.

