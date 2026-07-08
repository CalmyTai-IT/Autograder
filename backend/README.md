# AutoGrade — Backend (Express + Supabase)

API + Auth + lưu trữ + orchestration chấm bài. Database là **Supabase**, kết nối **bằng API key**
qua `@supabase/supabase-js`. Xem hướng dẫn đầy đủ (lấy URL/key, email, v.v.) ở `../README.md`.

```bash
npm install
cp .env.example .env     # dán SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, đặt JWT_SECRET
# tạo bảng: dán db/schema.sql vào Supabase → SQL Editor → Run
npm run dev              # http://localhost:4000
```

Cấu trúc: `src/supabase.ts` (client service_role), `src/db.ts` (helper bọc client),
`src/routes` (REST), `src/middleware` (JWT), `src/lib` (token/email/upload/serialize),
`src/services/gradingService.ts` (điều phối chấm), `src/grading/` (mô hình chấm — **nhóm tự cài**).
