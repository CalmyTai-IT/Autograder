# AutoGrade — Frontend (React SPA)

Giao diện web duy nhất của [AutoGrade](../README.md), phục vụ **cả hai vai trò** Sinh viên và Giảng viên (phân biệt qua route và trạng thái đăng nhập).

**Demo:** <https://autograder-gamma.vercel.app/login>

**Stack:** React 18 · Vite 6 · TypeScript 5 · React Router 6 · Zustand · TailwindCSS + shadcn/ui · Monaco Editor · SheetJS (`xlsx`)

---

## 1. Chạy nhanh

```bash
npm install
cp .env.example .env      # mặc định VITE_API_URL=http://localhost:4000/api
npm run dev               # http://localhost:5173
```

Cần **backend đang chạy** trước (xem [`../backend/README.md`](../backend/README.md)).

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Dev server (Vite, HMR) |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | Xem thử bản build tĩnh |

## 2. Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `VITE_API_URL` | `http://localhost:4000/api` | URL gốc của backend API |

Khi deploy (Vercel), đặt `VITE_API_URL` trỏ tới backend production. **Không đặt bất kỳ khoá bí mật nào ở frontend** — biến `VITE_*` được nhúng thẳng vào bundle và ai cũng đọc được.

## 3. Cấu trúc

Tổ chức theo **tính năng / vai trò** (feature-based) thay vì theo layer kỹ thuật:

```
src/
├── App.tsx, main.tsx
├── components/
│   ├── layout/        # AppShell, AppHeader, BackButton, Logo
│   ├── auth/          # ProtectedRoute
│   └── ui/            # UI primitives (shadcn/ui): button, card, dialog, input, table, tabs...
├── features/
│   ├── auth/          # LoginPage, RegisterPage, VerifyEmailPage, Forgot/ResetPasswordPage
│   ├── student/       # StudentDashboard, CourseDetailPage, AssignmentPage,
│   │                  # PracticeDetailPage, DeadlineCalendar, JoinClassDialog
│   ├── lecturer/      # LecturerDashboard, LecturerCourseDetailPage, GradeAssignmentPage,
│   │                  # CreateAssignmentDialog, CreateProblemPage, AssignmentForm...
│   └── shared/        # CourseSections, PracticeBrowser, ProfileDialog, course-bits, problem-bits
├── store/             # Zustand: auth.ts, content.ts, submissions.ts
├── lib/               # api.ts (HTTP client), rubric.ts, term.ts, toast.ts, utils.ts
└── types/index.ts     # User, Course, Assignment, Problem, Submission, Rubric...
```

## 4. Bản đồ route

| Route | Vai trò | Màn hình |
|-------|---------|----------|
| `/login`, `/register` | Công khai | Đăng nhập / Đăng ký |
| `/xac-nhan-email` | Công khai | Nhập mã xác nhận 6 số (tự điền sẵn từ link email) |
| `/quen-mat-khau`, `/dat-lai-mat-khau` | Công khai | Quên & đặt lại mật khẩu |
| `/sv` | Sinh viên | Dashboard: lớp đã tham gia, deadline sắp tới, bài luyện tập |
| `/sv/mon/:courseId` | Sinh viên | Chi tiết lớp: bài tập, tài liệu |
| `/sv/bai-tap/:assignmentId` | Sinh viên | Soạn code, chạy thử, nộp bài, xem điểm & nhận xét |
| `/sv/luyen-tap/:problemId` | Sinh viên | Làm bài tự luyện, chấm ngay khi nộp |
| `/gv` | Giảng viên | Dashboard: lớp đã tạo, bài luyện tập đã ra |
| `/gv/mon/:courseId` | Giảng viên | Chi tiết lớp: tạo bài tập, tài liệu, **bảng điểm + Xuất Excel** |
| `/gv/bai-tap/:assignmentId` | Giảng viên | Sửa đề, xem & chấm điểm, ghi đè điểm, công bố |
| `/gv/luyen-tap/tao`, `/gv/luyen-tap/:problemId` | Giảng viên | Tạo / sửa bài tự luyện |

`ProtectedRoute` chặn route theo vai trò; `/` tự chuyển hướng về `/sv` hoặc `/gv` tuỳ `role` trong JWT.

## 5. Ghi chú kỹ thuật

- **Xác thực:** JWT do backend cấp được lưu ở `localStorage` và đính vào header `Authorization: Bearer <token>` trong `lib/api.ts`. Frontend **không giữ** bất kỳ khoá dịch vụ nào.
- **Soạn code:** `@monaco-editor/react` — không cần cài IDE, hỗ trợ Python / C++ / Java.
- **Xuất Excel:** thực hiện **hoàn toàn phía client** bằng `xlsx` (sheet "Bảng điểm": STT, MSSV, Họ tên, một cột mỗi bài tập) → không tốn tài nguyên backend.
- **Trạng thái:** Zustand chia theo miền (`auth`, `content`, `submissions`) thay vì một store khổng lồ.
- **Chạy thử ≠ nộp bài:** nút "Chạy thử" gọi `POST /api/{assignments|problems}/:id/run` — chỉ dùng sandbox, không tạo bài nộp, không tính điểm, không lộ testcase ẩn.
- **Bản địa hoá:** toàn bộ giao diện, thông báo lỗi và nhận xét AI bằng tiếng Việt. Tối ưu cho laptop/desktop (tác vụ chính là đọc/viết code), không có bản mobile riêng.
