# AutoGrade — Backend (Express + Supabase)

REST API, xác thực, lưu trữ và **Grading Engine** (pipeline chấm điểm 5 mô-đun) của [AutoGrade](../README.md).

Database là **Supabase (PostgreSQL)**, kết nối **bằng API key** qua `@supabase/supabase-js` — không cần chuỗi kết nối Postgres, không cần cài PostgreSQL cục bộ.

**Stack:** Node.js ≥ 18 · Express 4 · TypeScript 5 · JWT · bcryptjs · Multer · Nodemailer

---

## 1. Chạy nhanh

```bash
npm install
cp .env.example .env      # điền SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, đổi JWT_SECRET
# Tạo bảng: dán toàn bộ db/schema.sql vào Supabase → SQL Editor → Run
npm run dev               # http://localhost:4000
```

Kiểm tra: `GET http://localhost:4000/api/health` → `{"ok":true}`

> ⚠️ Khoá `service_role` bỏ qua Row-Level Security và có toàn quyền trên DB. **Chỉ đặt ở backend**, không bao giờ đưa ra frontend, không commit file `.env`.

Danh sách đầy đủ biến môi trường: xem [README chính, mục 6](../README.md#6-biến-môi-trường) hoặc `.env.example`.

## 2. Scripts

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Chạy dev với `tsx watch` (hot reload) |
| `npm run build` | Biên dịch TypeScript → `dist/` |
| `npm start` | Chạy bản build (`node dist/index.js`) |
| `npm run typecheck` | `tsc --noEmit` — kiểm tra kiểu, không build |
| `npm run selftest` | Chạy `scripts/selftest-grading.ts` — kiểm thử nhanh pipeline chấm |

## 3. Cấu trúc mã nguồn

Mỗi thư mục ánh xạ tới đúng một component trong [Software Architecture Document](../docs/AutoGrade_Software_Architecture_Document.pdf):

```
src/
├── config.ts                  # đọc & mặc định hoá biến môi trường (.env)
├── index.ts                   # khởi tạo Express, mount router, errorHandler
├── supabase.ts, db.ts         # client service_role + helper bọc client
├── middleware/auth.ts         # requireAuth, requireRole             → Auth
├── lib/
│   ├── tokens.ts, email.ts    # signJwt, randomCode, gửi email       → Auth
│   ├── http.ts, serialize.ts  # ApiError, asyncHandler, sXxx()
│   └── upload.ts              # Supabase Storage + fallback đĩa local
├── routes/
│   ├── auth.ts                                                       → Auth
│   ├── courses.ts, assignments.ts, problems.ts    → Course & Assignment
│   └── submissions.ts, grading.ts                        → Submission
├── services/gradingService.ts # điều phối chấm, ghi grading_jobs    → Grading Engine
└── grading/                   # 5 mô-đun + sandbox + pipeline       → Grading Engine
    ├── pipeline.ts            # ráp thứ tự & rẽ nhánh
    ├── plagiarism.ts          # (1) GATE — k-gram + winnowing
    ├── testcase.ts, sandbox.ts# (2) chạy testcase cách ly
    ├── complexity.ts          # (3) phân tích tĩnh → lớp Big-O
    ├── style.ts               # (4) Gemini — review / debug
    ├── aggregate.ts           # (5) điểm rubric tất định + Groq
    └── types.ts               # GradeInput, RubricConfig, GradeResult...

db/schema.sql                  # 10 bảng
scripts/selftest-grading.ts    # self-test pipeline
```

## 4. REST API

Mọi endpoint nghiệp vụ yêu cầu header `Authorization: Bearer <JWT>`. Endpoint đánh dấu 🎓 chỉ dành cho vai trò `lecturer`.

### `/api/health`

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/health` | Health-check, trả `{ok:true}` (không cần token) |

### `/api/auth`

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/register` | Đăng ký (`email_verified = false`, gửi mã 6 số) |
| POST | `/verify-email` | Xác nhận email bằng mã 6 số (idempotent) |
| POST | `/resend-verification` | Gửi lại mã — luôn trả thông báo chung (chống dò email) |
| POST | `/login` | Trả JWT (`{sub, role}`, hết hạn theo `JWT_EXPIRES_IN`) |
| POST | `/forgot-password` | Tạo `reset_token` hết hạn sau 1 giờ |
| POST | `/reset-password` | Đặt mật khẩu mới |
| GET | `/me` | Thông tin người dùng hiện tại |
| PATCH | `/me` | Cập nhật hồ sơ |

### `/api/courses`

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/` | Danh sách lớp của người dùng |
| GET | `/:id` | Chi tiết lớp |
| POST | `/` 🎓 | Tạo lớp, tự sinh `join_code` |
| POST | `/join` | Sinh viên tham gia lớp bằng mã |
| GET | `/:id/members` | Danh sách thành viên |

### `/api/assignments`

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/course/:courseId` | Danh sách bài tập của lớp |
| GET | `/:id` | Chi tiết bài tập (SV không thấy testcase ẩn) |
| POST | `/` 🎓 | Tạo bài tập kèm rubric + testcase |
| PATCH | `/:id` 🎓 | Sửa đề / rubric / testcase |
| GET | `/course/:courseId/materials` | Tài liệu môn học |
| POST | `/course/:courseId/materials` 🎓 | Tải tài liệu lên |
| POST | `/upload` | Upload file (PDF đề, file bài nộp) |
| POST | `/:id/run` | **Chạy thử** với testcase công khai — không lưu, không tính điểm |

### `/api/submissions`

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/assignment/:assignmentId/mine` | Bài nộp của chính mình |
| GET | `/assignment/:assignmentId` 🎓 | Toàn bộ bài nộp của bài tập |
| POST | `/assignment/:assignmentId` | Nộp bài (ghi đè nếu nộp lại trước hạn) |
| PATCH | `/:id/grade` 🎓 | Ghi đè điểm / nhận xét (`lecturer_overridden`) |
| POST | `/assignment/:assignmentId/publish` 🎓 | Công bố điểm |
| POST | `/assignment/:assignmentId/finalize` 🎓 | Hoàn tất: 0 điểm cho SV không nộp, khoá bảng điểm |
| GET | `/course/:courseId/gradebook` 🎓 | Bảng điểm tổng hợp toàn lớp |

### `/api/problems` (bài tập tự luyện)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/` | Danh sách bài luyện tập công khai |
| GET | `/:id` | Chi tiết bài luyện tập |
| POST | `/` 🎓 | Tạo bài luyện tập |
| PATCH | `/:id` 🎓 | Sửa bài luyện tập |
| GET | `/submissions/mine` | Toàn bộ lượt nộp luyện tập của mình |
| GET | `/:id/submissions/mine` | Lịch sử nộp cho một bài |
| POST | `/:id/run` | Chạy thử — không lưu |
| POST | `/:id/submissions` | Nộp bài → **chấm ngay** (bỏ qua bước gian lận) |

### `/api/grading`

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/assignment/:assignmentId` 🎓 | Chấm tự động hàng loạt toàn bộ bài nộp |
| POST | `/problem-submission/:id` | Chấm một lượt nộp bài tự luyện |

## 5. Grading Engine

`pipeline.ts` ráp đúng luồng:

```
GATE gian lận (chỉ mode = "assignment")
   ├─ similarityPct ≥ threshold → 0 điểm, cờ "Gian lận", DỪNG
   └─ Testcase (sandbox: biên dịch 1 lần → chạy từng testcase)
         ├─ fatal → style.ts (purpose = 'debug') → không tổng kết
         └─ ok    → Promise.all([complexity, style]) → aggregate
```

- **Điểm là tất định:** `score = (testcasePct·wTC + complexityPct·wCX) / (wTC + wCX) / 10`. LLM **không quyết định điểm**, chỉ viết nhận xét. Phong cách code không có trọng số.
- **Suy giảm mềm:** thiếu `GEMINI_API_KEY` / `GROQ_API_KEY` hoặc dịch vụ lỗi → dùng nhận xét dự phòng ghép từ số liệu; điểm vẫn tính bình thường.
- **Sandbox:** tiến trình con + thư mục tạm dùng-một-lần + timeout + `ulimit -v` (Linux/macOS) hoặc `-Xmx` (Java); `SIGKILL` khi quá giờ. Spawn trực tiếp trình biên dịch (không qua `bash -c`) để chạy được trên Windows.
- **Quan sát được:** mỗi lượt chấm ghi một bản ghi `grading_jobs` với trạng thái `running` → `done` / `error`.
- **Retry LLM:** timeout 30s (`AbortController`), thử lại tối đa 3 lần với backoff khi gặp `429/500/502/503/504`.

📖 Chi tiết prompt, cách đổi model/nhà cung cấp, bảng map Big-O: [`../docs/HUONG_DAN_CHAM_DIEM.md`](../docs/HUONG_DAN_CHAM_DIEM.md)

## 6. Cơ sở dữ liệu

10 bảng trong `db/schema.sql`: `users`, `courses`, `enrollments`, `assignments`, `problems`, `testcases`, `materials`, `submissions`, `problem_submissions`, `grading_jobs`.

**Vì sao không bật RLS?** Mọi truy cập DB đều đi qua Express bằng `service_role`; API công khai của Supabase không expose ra frontend, nên phân quyền nằm ở middleware Express là đủ. Backend là **điểm truy cập DUY NHẤT**.

## 7. Bảo mật (tóm tắt)

- Mật khẩu băm bằng `bcrypt` (cost 10), không bao giờ lưu plaintext.
- JWT ký bằng `JWT_SECRET`, chứa `{sub, role}`; `requireRole('lecturer')` bảo vệ endpoint của Giảng viên.
- Bắt buộc xác nhận email trước khi đăng nhập; chống dò email ở luồng quên mật khẩu / gửi lại mã.
- Giới hạn dữ liệu vào: body JSON ≤ 2MB, file upload ≤ 10MB.
- Sandbox giới hạn thời gian + RAM + kích thước output khi chạy code không tin cậy.

Đặc tả đầy đủ 26 yêu cầu phi chức năng: [`../docs/AutoGrade_NonFunctional_Requirements.pdf`](../docs/AutoGrade_NonFunctional_Requirements.pdf)

## 8. Giới hạn đã biết

- Chấm hàng loạt chạy **tuần tự trong tiến trình web** → nên tách sang job queue + worker khi lớp đông.
- Sandbox là loại "nhẹ" (tiến trình + timeout + ulimit), **chưa cách ly hệ thống tệp/mạng** — triển khai công khai nên dùng Docker/nsjail.
- `app.use(cors())` đang mở cho mọi origin — cần whitelist domain frontend khi production.
- `JWT_SECRET` có giá trị mặc định `dev-secret-change-me` — **bắt buộc đổi** khi triển khai.
