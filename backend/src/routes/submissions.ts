import { Router } from "express";
import { many, maybe, supabase } from "../db";
import { ApiError, asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { sSubmission, sUser } from "../lib/serialize";
import { upload, saveFile } from "../lib/upload";

export const submissionsRouter = Router();
submissionsRouter.use(requireAuth);

async function lecturerOwnsAssignment(assignmentId: string, userId: string) {
  const a = await maybe(supabase.from("assignments").select("course_id").eq("id", assignmentId).maybeSingle());
  if (!a) throw new ApiError(404, "Không tìm thấy bài tập");
  const c = await maybe(supabase.from("courses").select("lecturer_id").eq("id", a.course_id).maybeSingle());
  if (!c || c.lecturer_id !== userId) throw new ApiError(403, "Không có quyền");
}

/** Gắn student_name/student_code vào các bài nộp. */
async function withStudents(subs: any[]) {
  if (subs.length === 0) return [];
  const ids = [...new Set(subs.map((s) => s.student_id))];
  const users = await many(supabase.from("users").select("id, full_name, student_code").in("id", ids));
  const byId: Record<string, any> = {};
  for (const u of users) byId[u.id] = u;
  return subs.map((s) => sSubmission({ ...s, student_name: byId[s.student_id]?.full_name ?? "", student_code: byId[s.student_id]?.student_code ?? "" }));
}

// GET /api/submissions/assignment/:assignmentId/mine  (student)
submissionsRouter.get("/assignment/:assignmentId/mine", asyncHandler(async (req, res) => {
  const sub = await maybe(supabase.from("submissions").select("*").eq("assignment_id", req.params.assignmentId).eq("student_id", req.user!.id).maybeSingle());
  if (!sub) return res.json(null);
  res.json((await withStudents([sub]))[0]);
}));

// GET /api/submissions/assignment/:assignmentId  (lecturer)
submissionsRouter.get("/assignment/:assignmentId", requireRole("lecturer"), asyncHandler(async (req, res) => {
  await lecturerOwnsAssignment(req.params.assignmentId, req.user!.id);
  const subs = await many(supabase.from("submissions").select("*").eq("assignment_id", req.params.assignmentId));
  const out = await withStudents(subs);
  out.sort((a, b) => (a.studentCode ?? "").localeCompare(b.studentCode ?? ""));
  res.json(out);
}));

// POST /api/submissions/assignment/:assignmentId  (student, file tùy chọn)
submissionsRouter.post("/assignment/:assignmentId", requireRole("student"), upload.single("file"),
  asyncHandler(async (req, res) => {
    const { fileName, code } = req.body ?? {};
    if (!fileName) throw new ApiError(400, "Thiếu tên file");
    // Chặn nộp khi đã quá hạn (hệ thống sẽ chấm tự động sau hạn).
    const asg = await maybe(supabase.from("assignments").select("deadline").eq("id", req.params.assignmentId).maybeSingle());
    if (asg?.deadline && new Date(asg.deadline).getTime() < Date.now()) {
      throw new ApiError(403, "Đã quá hạn nộp bài");
    }
    const sub = await maybe(supabase.from("submissions").upsert({
      assignment_id: req.params.assignmentId, student_id: req.user!.id,
      file_name: fileName, code: code ?? "", file_path: req.file ? await saveFile(req.file) : null,
      status: "submitted", submitted_at: new Date().toISOString(),
      score: null, testcase_pct: null, complexity_pct: null, complexity_class: null,
      similarity_pct: null, ai_comment: null, flagged_cheating: false, lecturer_overridden: false, graded_at: null,
    }, { onConflict: "assignment_id,student_id" }).select().single());
    res.status(201).json((await withStudents([sub]))[0]);
  }));

// PATCH /api/submissions/:id/grade  (lecturer override)
submissionsRouter.patch("/:id/grade", requireRole("lecturer"), asyncHandler(async (req, res) => {
  const sub = await maybe(supabase.from("submissions").select("id, assignment_id").eq("id", req.params.id).maybeSingle());
  if (!sub) throw new ApiError(404, "Không tìm thấy bài nộp");
  await lecturerOwnsAssignment(sub.assignment_id, req.user!.id);
  const { score, aiComment } = req.body ?? {};
  const updated = await maybe(supabase.from("submissions").update({
    score: score ?? null, ai_comment: aiComment ?? null, status: "graded",
    lecturer_overridden: true, graded_at: new Date().toISOString(),
  }).eq("id", req.params.id).select().single());
  res.json((await withStudents([updated]))[0]);
}));

// POST /api/submissions/assignment/:assignmentId/publish  (lecturer)
submissionsRouter.post("/assignment/:assignmentId/publish", requireRole("lecturer"), asyncHandler(async (req, res) => {
  await lecturerOwnsAssignment(req.params.assignmentId, req.user!.id);
  await many(supabase.from("assignments").update({ grades_published: true, grades_published_at: new Date().toISOString() }).eq("id", req.params.assignmentId));
  await many(supabase.from("submissions").update({ published: true }).eq("assignment_id", req.params.assignmentId));
  res.json({ message: "Đã công bố điểm" });
}));

// POST /api/submissions/assignment/:assignmentId/finalize  (lecturer)
// Cho 0 điểm những sinh viên KHÔNG nộp (trong lớp), rồi công bố điểm.
// Giảng viên có thể chỉnh/châm trước điểm (PATCH /:id/grade) TRƯỚC khi bấm finalize.
submissionsRouter.post("/assignment/:assignmentId/finalize", requireRole("lecturer"), asyncHandler(async (req, res) => {
  const a = await maybe(supabase.from("assignments").select("course_id").eq("id", req.params.assignmentId).maybeSingle());
  if (!a) throw new ApiError(404, "Không tìm thấy bài tập");
  const c = await maybe(supabase.from("courses").select("lecturer_id").eq("id", a.course_id).maybeSingle());
  if (!c || c.lecturer_id !== req.user!.id) throw new ApiError(403, "Không có quyền");

  // Sinh viên trong lớp
  const enrolls = await many(supabase.from("enrollments").select("student_id").eq("course_id", a.course_id));
  const enrolledIds = enrolls.map((e) => e.student_id);
  // Đã có bài nộp/điểm
  const existing = await many(supabase.from("submissions").select("student_id").eq("assignment_id", req.params.assignmentId));
  const haveIds = new Set(existing.map((s) => s.student_id));
  // Người KHÔNG nộp → 0 điểm
  const missing = enrolledIds.filter((id) => !haveIds.has(id));
  if (missing.length) {
    const now = new Date().toISOString();
    const rows = missing.map((sid) => ({
      assignment_id: req.params.assignmentId, student_id: sid,
      file_name: "(không nộp)", code: "", file_path: null,
      status: "graded", score: 0, ai_comment: "Không nộp bài trước hạn — 0 điểm.",
      flagged_cheating: false, lecturer_overridden: true, published: true,
      submitted_at: now, graded_at: now,
    }));
    await many(supabase.from("submissions").insert(rows));
  }
  // Công bố toàn bộ
  await many(supabase.from("assignments").update({ grades_published: true, grades_published_at: new Date().toISOString() }).eq("id", req.params.assignmentId));
  await many(supabase.from("submissions").update({ published: true }).eq("assignment_id", req.params.assignmentId));
  res.json({ message: "Đã hoàn thành & công bố điểm", zeroed: missing.length });
}));

// GET /api/submissions/course/:courseId/gradebook  (lecturer)
submissionsRouter.get("/course/:courseId/gradebook", requireRole("lecturer"), asyncHandler(async (req, res) => {
  const owns = await maybe(supabase.from("courses").select("id").eq("id", req.params.courseId).eq("lecturer_id", req.user!.id).maybeSingle());
  if (!owns) throw new ApiError(403, "Không có quyền");

  const enrolls = await many(supabase.from("enrollments").select("student_id").eq("course_id", req.params.courseId));
  const studentIds = enrolls.map((e) => e.student_id);
  const students = studentIds.length
    ? await many(supabase.from("users").select("*").in("id", studentIds).order("student_code", { ascending: true, nullsFirst: false }))
    : [];
  const assignments = await many(supabase.from("assignments").select("id, title").eq("course_id", req.params.courseId).order("deadline", { ascending: true }));
  const asgIds = assignments.map((a) => a.id);
  const subs = asgIds.length
    ? await many(supabase.from("submissions").select("assignment_id, student_id, score, status").in("assignment_id", asgIds))
    : [];

  res.json({
    students: students.map(sUser),
    assignments,
    scores: subs.map((r) => ({
      assignmentId: r.assignment_id, studentId: r.student_id,
      score: r.status === "graded" && r.score != null ? Number(r.score) : null,
    })),
  });
}));
