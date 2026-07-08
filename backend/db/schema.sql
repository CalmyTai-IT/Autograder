-- ============================================================================
--  AutoGrade — Database schema (chạy trên Supabase)
--  Backend kết nối Supabase bằng API key (service_role) và là nơi DUY NHẤT chạm DB,
--  nên KHÔNG cần bật RLS.
--
--  CÁCH NẠP: Supabase Dashboard → SQL Editor → dán TOÀN BỘ file này → Run.
-- ============================================================================
-- pgcrypto đã có sẵn trên Supabase; dòng dưới là no-op nếu đã cài (để dùng gen_random_uuid()).
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- 1) users — gồm cả thông tin xác thực (tự quản auth)
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  full_name     text not null,
  role          text not null default 'student' check (role in ('student','lecturer')),
  student_code  text unique,
  avatar_url    text,
  email_verified boolean not null default false,
  verify_token  text,                       -- token xác nhận email
  reset_token   text,                        -- token đặt lại mật khẩu
  reset_expires timestamptz,
  created_at    timestamptz not null default now()
);

-- 2) courses
create table if not exists courses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text default '',
  academic_year text not null,
  semester      smallint not null check (semester in (1,2,3)),
  start_date    date not null,
  end_date      date not null,
  lecturer_id   uuid not null references users(id) on delete restrict,
  join_code     text not null unique,
  created_at    timestamptz not null default now(),
  check (end_date >= start_date)
);

-- 3) enrollments
create table if not exists enrollments (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references courses(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  unique (course_id, student_id)
);

-- 4) assignments
create table if not exists assignments (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references courses(id) on delete cascade,
  title               text not null,
  source              text not null default 'text' check (source in ('text','pdf')),
  description         text,
  pdf_path            text,
  deadline            timestamptz not null,
  rubric              jsonb not null,
  grades_published    boolean not null default false,
  grades_published_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 5) problems (bài tự do)
create table if not exists problems (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  difficulty  text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  description text not null,
  created_by  uuid not null references users(id) on delete restrict,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 6) testcases (dùng chung assignment/problem — đúng 1 trong 2)
create table if not exists testcases (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid references assignments(id) on delete cascade,
  problem_id      uuid references problems(id) on delete cascade,
  input           text not null default '',
  expected_output text not null default '',
  is_hidden       boolean not null default false,
  order_index     int not null default 0,
  check ((assignment_id is not null)::int + (problem_id is not null)::int = 1)
);

-- 7) materials
create table if not exists materials (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  title       text not null,
  file_path   text not null,
  uploaded_at timestamptz not null default now()
);

-- 8) submissions (bài lớp)
create table if not exists submissions (
  id                  uuid primary key default gen_random_uuid(),
  assignment_id       uuid not null references assignments(id) on delete cascade,
  student_id          uuid not null references users(id) on delete cascade,
  file_name           text not null,
  code                text not null default '',
  file_path           text,
  submitted_at        timestamptz not null default now(),
  status              text not null default 'submitted' check (status in ('submitted','grading','graded')),
  score               numeric(4,2) check (score is null or (score >= 0 and score <= 10)),
  testcase_pct        numeric(5,2),
  complexity_pct      numeric(5,2),
  complexity_class    text,
  similarity_pct      numeric(5,2),
  ai_comment          text,
  flagged_cheating    boolean not null default false,
  lecturer_overridden boolean not null default false,
  published           boolean not null default false,
  graded_at           timestamptz,
  unique (assignment_id, student_id)
);

-- 9) problem_submissions (giữ lịch sử)
create table if not exists problem_submissions (
  id           uuid primary key default gen_random_uuid(),
  problem_id   uuid not null references problems(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  language     text not null,
  code         text not null,
  submitted_at timestamptz not null default now(),
  score        numeric(4,2) check (score is null or (score >= 0 and score <= 10)),
  passed_tests int,
  total_tests  int,
  ai_comment   text
);

-- 10) grading_jobs (theo dõi chấm bất đồng bộ)
create table if not exists grading_jobs (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid references submissions(id) on delete cascade,
  problem_sub_id uuid references problem_submissions(id) on delete cascade,
  status         text not null default 'queued' check (status in ('queued','running','done','error')),
  error_message  text,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz not null default now(),
  check ((submission_id is not null)::int + (problem_sub_id is not null)::int = 1)
);

-- Index
create index if not exists idx_courses_lecturer       on courses(lecturer_id);
create index if not exists idx_enroll_course          on enrollments(course_id);
create index if not exists idx_enroll_student         on enrollments(student_id);
create index if not exists idx_assignments_course     on assignments(course_id);
create index if not exists idx_testcases_assignment   on testcases(assignment_id);
create index if not exists idx_testcases_problem      on testcases(problem_id);
create index if not exists idx_materials_course       on materials(course_id);
create index if not exists idx_submissions_assignment on submissions(assignment_id);
create index if not exists idx_psubs_problem          on problem_submissions(problem_id);
create index if not exists idx_psubs_user             on problem_submissions(user_id);

-- ============================================================================
--  NÂNG CẤP (chạy lại an toàn nếu DB đã tạo từ trước) — bài tập deadline:
--  • materials.section / assignments.section: gom tài liệu & bài tập theo "mục".
-- ============================================================================
alter table materials   add column if not exists section text;
alter table assignments add column if not exists section text;
