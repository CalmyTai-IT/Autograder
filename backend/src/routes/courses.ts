import { Router } from "express";
import { countBy, many, maybe, supabase } from "../db";
import { ApiError, asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { sCourse, sUser } from "../lib/serialize";

export const coursesRouter = Router();
coursesRouter.use(requireAuth);

function genJoinCode(name: string) {
  const prefix = name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4) || "LOP";
  return `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** Gắn lecturer_name + student_count vào danh sách lớp (gom phía JS). */
async function decorate(courses: any[]) {
  if (courses.length === 0) return [];
  const lecturerIds = [...new Set(courses.map((c) => c.lecturer_id))];
  const courseIds = courses.map((c) => c.id);
  const lecturers = await many(supabase.from("users").select("id, full_name").in("id", lecturerIds));
  const enrolls = await many(supabase.from("enrollments").select("course_id").in("course_id", courseIds));
  const nameById: Record<string, string> = {};
  for (const u of lecturers) nameById[u.id] = u.full_name;
  const counts = countBy(enrolls, (e) => e.course_id);
  return courses.map((c) => sCourse({ ...c, lecturer_name: nameById[c.lecturer_id] ?? "", student_count: counts[c.id] ?? 0 }));
}

// GET /api/courses
coursesRouter.get("/", asyncHandler(async (req, res) => {
  const me = req.user!;
  if (me.role === "lecturer") {
    const courses = await many(supabase.from("courses").select("*").eq("lecturer_id", me.id).order("created_at", { ascending: false }));
    return res.json(await decorate(courses));
  }
  const enrolls = await many(supabase.from("enrollments").select("course_id").eq("student_id", me.id));
  const ids = enrolls.map((e) => e.course_id);
  if (ids.length === 0) return res.json([]);
  const courses = await many(supabase.from("courses").select("*").in("id", ids).order("created_at", { ascending: false }));
  res.json(await decorate(courses));
}));

// GET /api/courses/:id
coursesRouter.get("/:id", asyncHandler(async (req, res) => {
  const c = await maybe(supabase.from("courses").select("*").eq("id", req.params.id).maybeSingle());
  if (!c) throw new ApiError(404, "Không tìm thấy lớp");
  res.json((await decorate([c]))[0]);
}));

// POST /api/courses  (lecturer)
coursesRouter.post("/", requireRole("lecturer"), asyncHandler(async (req, res) => {
  const { name, description, academicYear, semester, startDate, endDate } = req.body ?? {};
  if (!name || !academicYear || !semester || !startDate || !endDate) throw new ApiError(400, "Thiếu thông tin lớp");
  const c = await maybe(supabase.from("courses").insert({
    name, description: description ?? "", academic_year: academicYear, semester,
    start_date: startDate, end_date: endDate, lecturer_id: req.user!.id, join_code: genJoinCode(name),
  }).select().single());
  res.status(201).json((await decorate([c]))[0]);
}));

// POST /api/courses/join  { code }  (student)
coursesRouter.post("/join", requireRole("student"), asyncHandler(async (req, res) => {
  const { code } = req.body ?? {};
  const course = await maybe(supabase.from("courses").select("*").eq("join_code", code).maybeSingle());
  if (!course) throw new ApiError(404, "Mã lớp không tồn tại");
  await many(supabase.from("enrollments").upsert(
    { course_id: course.id, student_id: req.user!.id },
    { onConflict: "course_id,student_id", ignoreDuplicates: true }
  ));
  res.json((await decorate([course]))[0]);
}));

// GET /api/courses/:id/members
coursesRouter.get("/:id/members", asyncHandler(async (req, res) => {
  const course = await maybe(supabase.from("courses").select("lecturer_id").eq("id", req.params.id).maybeSingle());
  const lecturer = course
    ? await maybe(supabase.from("users").select("*").eq("id", course.lecturer_id).maybeSingle())
    : null;
  const enrolls = await many(supabase.from("enrollments").select("student_id").eq("course_id", req.params.id));
  const ids = enrolls.map((e) => e.student_id);
  const students = ids.length
    ? await many(supabase.from("users").select("*").in("id", ids).order("student_code", { ascending: true, nullsFirst: false }))
    : [];
  res.json({ lecturer: lecturer ? sUser(lecturer) : null, students: students.map(sUser) });
}));
