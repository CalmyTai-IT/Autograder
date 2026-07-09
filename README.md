# AutoGrade — Hệ thống chấm điểm code tự động

> Đồ án môn **Công nghệ phần mềm cho AI** — Trường ĐH Khoa học Tự nhiên, ĐHQG-HCM (HCMUS)

**Demo:** <https://autograder-gamma.vercel.app/login>

AutoGrade cho phép Giảng viên ra đề bài tập lập trình kèm **rubric** và **testcase**, Sinh viên nộp code ngay trên trình duyệt, và hệ thống chấm tự động qua **pipeline 5 mô-đun** (gian lận → testcase → độ phức tạp ∥ phong cách → tổng kết). Điểm số được tính **tất định** theo rubric; LLM chỉ sinh nhận xét, không quyết định điểm.

<p>
<img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white">
<img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white">
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
<img alt="Node" src="https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=nodedotjs&logoColor=white">
<img alt="Express" src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white">
<img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white">
</p>

---

## Mục lục

1. [Tính năng chính](#1-tính-năng-chính)
2. [Cấu trúc repository](#2-cấu-trúc-repository)
3. [Kiến trúc tổng thể](#3-kiến-trúc-tổng-thể)
4. [Pipeline chấm điểm 5 mô-đun](#4-pipeline-chấm-điểm-5-mô-đun)
5. [Cài đặt & chạy](#5-cài-đặt--chạy)
6. [Biến môi trường](#6-biến-môi-trường)
7. [Email xác nhận & quên mật khẩu](#7-email-xác-nhận--quên-mật-khẩu)
8. [Kết quả đánh giá mô hình](#8-kết-quả-đánh-giá-mô-hình)
9. [Tài liệu (`docs/`)](#9-tài-liệu-docs)
10. [Giới hạn đã biết](#10-giới-hạn-đã-biết)

---

## 1. Tính năng chính

**Giảng viên**

- Tạo lớp học, nhận mã lớp (`join_code`) để Sinh viên tham gia.
- Ra đề bài tập có hạn nộp: đề dạng văn bản hoặc PDF, cấu hình rubric (trọng số testcase / độ phức tạp, ngưỡng gian lận), thêm testcase (có thể ẩn).
- Chạy chấm tự động toàn bộ bài nộp, rà soát và **ghi đè điểm** thủ công, công bố điểm (khoá vĩnh viễn).
- Bảng điểm tổng hợp toàn lớp, **xuất Excel** ngay trên trình duyệt.
- Tạo bài tập tự luyện công khai, quản lý tài liệu môn học.

**Sinh viên**

- Tham gia lớp bằng mã lớp; soạn code trực tiếp bằng **Monaco Editor**.
- **Chạy thử** với testcase công khai trước khi nộp (không lưu, không tính điểm).
- Nộp bài tập (dán code hoặc tải file), nộp lại trước hạn.
- Làm bài tự luyện và nhận điểm + nhận xét AI **ngay lập tức**.

Hỗ trợ **Python, C++, Java**. Toàn bộ giao diện và nhận xét bằng **tiếng Việt**.

---

## 2. Cấu trúc repository

```
autograde/
├── README.md               # Tài liệu này
├── docs/                   # ★ Toàn bộ tài liệu đồ án (xem docs/README.md)
│   ├── AutoGrade_Vision_Document.pdf
│   ├── AutoGrade_UseCase_Specification.pdf
│   ├── AutoGrade_Software_Architecture_Document.pdf
│   ├── AutoGrade_KienTruc.pdf
│   ├── AutoGrade_NonFunctional_Requirements.pdf
│   ├── Model_Evaluation_AutoGrade.pdf
│   └── HUONG_DAN_CHAM_DIEM.md
├── backend/                # Node.js + Express + TypeScript (API, auth, grading engine)
│   ├── src/
│   │   ├── routes/         # REST endpoints
│   │   ├── middleware/     # requireAuth, requireRole
│   │   ├── services/       # gradingService.ts — điều phối chấm
│   │   ├── grading/        # 5 mô-đun chấm + sandbox + pipeline
│   │   └── lib/            # tokens, email, upload, http
│   ├── db/schema.sql       # 10 bảng PostgreSQL
│   └── scripts/            # selftest-grading.ts
└── frontend/               # React 18 + Vite + TypeScript (SPA)
    └── src/
        ├── features/       # auth / student / lecturer / shared
        ├── components/     # layout + UI primitives (shadcn/ui)
        ├── store/          # Zustand
        └── lib/            # api client, rubric, toast
```

Frontend và backend là **2 project độc lập**, giao tiếp qua REST API (JSON + JWT).

Chi tiết từng phía: [`backend/README.md`](backend/README.md) · [`frontend/README.md`](frontend/README.md)

---

## 3. Kiến trúc tổng thể

```
┌────────────────────────────────────────────┐
│  ① FRONTEND — React SPA (Vercel)           │
│     Sinh viên  ·  Giảng viên               │
└──────────────────┬─────────────────────────┘
                   │ RESTful API (HTTPS + JSON, Bearer JWT)
┌──────────────────▼─────────────────────────┐        ┌──────────────────────┐
│  ③ BACKEND — Node.js / Express (monolith)  │───────▶│ ② DỊCH VỤ NGOÀI      │
│     Auth · Course&Assignment · Submission  │  HTTPS │   Gemini API (style) │
│     ┌────────────────────────────────────┐ │        │   Groq API (tổng kết)│
│     │ ④ GRADING ENGINE                   │ │        │   SMTP (Brevo)       │
│     │   Sandbox cục bộ (Python/C++/Java) │ │        └──────────────────────┘
│     │   Pipeline 5 mô-đun                │ │
│     └────────────────────────────────────┘ │
└──────────────────┬─────────────────────────┘
                   │ service_role key
┌──────────────────▼─────────────────────────┐
│  Supabase — PostgreSQL (10 bảng) + Storage │
└────────────────────────────────────────────┘
```

Backend là **điểm truy cập DB duy nhất** (dùng `service_role`), nên không cần bật Row-Level Security. Chi tiết đầy đủ: [`docs/AutoGrade_Software_Architecture_Document.pdf`](docs/AutoGrade_Software_Architecture_Document.pdf) và [`docs/AutoGrade_KienTruc.pdf`](docs/AutoGrade_KienTruc.pdf).

---

## 4. Pipeline chấm điểm 5 mô-đun

| # | Mô-đun | File | Kỹ thuật | Gọi API? |
|---|--------|------|----------|----------|
| 1 | Gian lận (GATE) | `plagiarism.ts` | k-gram + winnowing (kiểu MOSS) | Không |
| 2 | Testcase | `testcase.ts` + `sandbox.ts` | Biên dịch + chạy cách ly, so output chuẩn hoá | Không |
| 3 | Độ phức tạp | `complexity.ts` | Phân tích tĩnh cấu trúc → lớp Big-O → % theo rubric | Không |
| 4 | Phong cách code | `style.ts` | Gemini 2.5 Flash — nhận xét / chế độ debug | Có |
| 5 | Tổng kết | `aggregate.ts` | Điểm tất định theo rubric + Groq viết nhận xét | Có |

```
Gian lận (chỉ bài tập lớp)
   ├─ vượt ngưỡng → 0 điểm, gắn cờ "Gian lận", DỪNG
   └─ không → Testcase (sandbox)
                 ├─ code lỗi fatal → Gemini chế độ DEBUG → không tính điểm tổng kết
                 └─ code chạy được → Độ phức tạp ∥ Phong cách (song song)
                                        └─ Tổng kết: điểm rubric + nhận xét Groq
```

**Quy tắc điểm:** chỉ **testcase** và **độ phức tạp** có trọng số (tổng = 100%). Phong cách **không vào điểm**. Gian lận là **cổng chặn**. Thiếu API key hoặc dịch vụ AI lỗi → hệ thống dùng nhận xét dự phòng, **điểm vẫn tính bình thường**.

Bài tự luyện dùng chung pipeline nhưng **bỏ qua bước gian lận**.

📖 Chi tiết cách cài, đổi model, prompt: [`docs/HUONG_DAN_CHAM_DIEM.md`](docs/HUONG_DAN_CHAM_DIEM.md)

---

## 5. Cài đặt & chạy

### Yêu cầu

- **Node.js ≥ 18** (khuyến nghị 20+) và npm
- **Tài khoản Supabase** (free tier là đủ) — không cần cài PostgreSQL cục bộ
- Toolchain cho ngôn ngữ muốn chấm: `python3`, `g++` (C++17), `javac`/`java` (JDK 17+)
- (Tuỳ chọn) API key miễn phí của [Gemini](https://aistudio.google.com/apikey) và [Groq](https://console.groq.com/keys)

### Backend

```bash
# 1. Tạo project tại https://supabase.com
#    Project Settings → API → copy "Project URL" và "service_role" key
# 2. SQL Editor → dán toàn bộ backend/db/schema.sql → Run

cd backend
npm install
cp .env.example .env          # điền SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
npm run dev                   # http://localhost:4000
```

Kiểm tra: <http://localhost:4000/api/health> → `{"ok":true}`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # mặc định trỏ http://localhost:4000/api
npm run dev                   # http://localhost:5173
```

Mở <http://localhost:5173> → **Đăng ký** → xác nhận email (chế độ DEV: mã in ra console backend) → **Đăng nhập**.

> ⚠️ **Không bao giờ commit file `.env`.** Khoá `service_role` có toàn quyền trên database và bỏ qua RLS.

---

## 6. Biến môi trường

### `backend/.env`

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `PORT` | `4000` | Cổng backend |
| `APP_URL` | `http://localhost:5173` | URL frontend, dùng tạo link trong email |
| `SUPABASE_URL` | — | Project URL của Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Khoá `service_role` — **chỉ ở backend** |
| `JWT_SECRET` | `dev-secret-change-me` | **Bắt buộc đổi khi triển khai** |
| `JWT_EXPIRES_IN` | `7d` | Thời hạn token |
| `UPLOAD_DIR` | `uploads` | Thư mục fallback khi Storage lỗi |
| `STORAGE_BUCKET` | `uploads` | Bucket Supabase Storage |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | trống | Gửi email; để trống → chế độ DEV in ra console |
| `GEMINI_API_KEY` | trống | Mô-đun phong cách; trống → dùng nhận xét dự phòng |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model Gemini |
| `GROQ_API_KEY` | trống | Mô-đun tổng kết; trống → dùng nhận xét dự phòng |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Model Groq |
| `LLM_TIMEOUT_MS` | `30000` | Timeout mỗi lần gọi LLM |
| `SANDBOX_TIMEOUT_MS` | `5000` | Timeout chạy 1 testcase |
| `SANDBOX_COMPILE_TIMEOUT_MS` | `15000` | Timeout biên dịch |
| `SANDBOX_MEMORY_MB` | `256` | Giới hạn RAM mỗi tiến trình |
| `SANDBOX_MAX_OUTPUT` | `1000000` | Giới hạn byte stdout/stderr |
| `PYTHON_CMD` | tự dò | Ép dùng một lệnh Python cụ thể |

### `frontend/.env`

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `VITE_API_URL` | `http://localhost:4000/api` | URL gốc của backend API |

---

## 7. Email xác nhận & quên mật khẩu

**Chế độ DEV (khuyến nghị khi demo):** để trống `SMTP_HOST` và `SMTP_USER`. Backend **không gửi mail thật** mà in link/mã ra console:

```
[email:DEV] Tới: sv@student.hcmus.edu.vn
[email:DEV] Mã xác nhận email — AutoGrade
[email:DEV] Link: http://localhost:5173/xac-nhan-email?email=...&code=123456   ·   Mã: 123456
```

**Gửi email thật:** dùng SMTP relay (Brevo, Mailtrap) hoặc Gmail App Password, điền `SMTP_*` vào `.env`.

**Luồng:**

- Đăng ký → user ở trạng thái `email_verified = false` + mã 6 số → **chưa xác nhận thì không đăng nhập được** (403). Đăng ký lại bằng email chưa xác nhận sẽ ghi đè và gửi mã mới.
- Quên mật khẩu → `reset_token` hết hạn sau **1 giờ**. API luôn trả **một thông báo chung** dù email có tồn tại hay không (chống dò email).

---

## 8. Kết quả đánh giá mô hình

Đánh giá trên bộ dữ liệu **ground truth gán nhãn thủ công, thiết kế đối kháng** (~180 mẫu):

| Mô-đun | Chỉ số | Giá trị |
|--------|--------|---------|
| Testcase | Chính xác số testcase PASS | **98,3%** (59/60) |
| Testcase | Phát hiện code hỏng (fatal) | **100%** (8/8) |
| Độ phức tạp | Chính xác lớp O() · macro-F1 | **94,8%** · 0,953 |
| Gian lận | ROC-AUC · F1 @ ngưỡng 85% | **0,987** · 0,923 |
| Công thức điểm | Khớp điểm kỳ vọng | 3/3 ca |
| Nhận xét AI | Điểm giám khảo (3 lần chấm độc lập) | **4,64/5** ± 0,09 |

Chi tiết phương pháp, ma trận nhầm lẫn, quét ngưỡng, phân tích từng ca sai và hạn chế: [`docs/Model_Evaluation_AutoGrade.pdf`](docs/Model_Evaluation_AutoGrade.pdf).

---

## 9. Tài liệu (`docs/`)

Toàn bộ tài liệu đồ án nằm trong thư mục [`docs/`](docs/) — xem [`docs/README.md`](docs/README.md) để biết nên đọc file nào trước.

| Tài liệu | Nội dung |
|----------|----------|
| [Vision Document](docs/AutoGrade_Vision_Document.pdf) | Bài toán, định vị sản phẩm, persona, tính năng mức cao |
| [Use-Case Specification](docs/AutoGrade_UseCase_Specification.pdf) | 14 use case theo mẫu RUP + các UC «include»/«extend» |
| [Software Architecture Document](docs/AutoGrade_Software_Architecture_Document.pdf) | SAD rút gọn RUP: Logical View, Deployment, Implementation View |
| [Báo cáo Kiến trúc tổng thể](docs/AutoGrade_KienTruc.pdf) | 4 phân hệ, luồng chấm A/B, luồng dữ liệu, công nghệ |
| [Non-Functional Requirements](docs/AutoGrade_NonFunctional_Requirements.pdf) | 26 NFR theo ISO/IEC 25010, kèm bằng chứng trong mã nguồn |
| [Model Evaluation](docs/Model_Evaluation_AutoGrade.pdf) | Thiết kế thí nghiệm, độ đo, kết quả, hạn chế |
| [Hướng dẫn mô-đun chấm điểm](docs/HUONG_DAN_CHAM_DIEM.md) | Cách cài, đổi model/API, prompt của 5 mô-đun |

---

## 10. Giới hạn đã biết

Nêu thẳng thắn (chi tiết ở NFR-SCL-02 trong tài liệu NFR):

- **Chấm hàng loạt tuần tự** trong tiến trình web → lớp rất đông sẽ chấm lâu. Hướng nâng cấp: job queue + worker riêng.
- **Sandbox "nhẹ"** (tiến trình con + timeout + `ulimit`), chưa cách ly hệ thống tệp/mạng triệt để. Triển khai thật nên dùng Docker/nsjail.
- **CORS mở cho mọi origin** — cần whitelist domain frontend khi production.
- Phân tích tĩnh chưa xử lý được **khấu hao** (cửa sổ trượt), **chi phí ẩn** của generator thư viện, và **memoization**.
- Ngưỡng gian lận 85% có thể bị lách bằng **độn code chết**; đánh giá cho thấy nên hạ về vùng **65–70%**.

---

## Nhóm thực hiện

Đồ án môn Công nghệ phần mềm cho AI — Khoa CNTT, HCMUS.

<sub>Tài liệu và mã nguồn phục vụ mục đích học tập.</sub>
