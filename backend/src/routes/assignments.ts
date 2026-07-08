import { Router } from "express";
import { many, maybe, supabase } from "../db";
import { ApiError, asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { sAssignment, sMaterial } from "../lib/serialize";
import { upload, saveFile, origName } from "../lib/upload";
import { runSamples } from "../grading/testcase";

export const assignmentsRouter = Router();
assignmentsRouter.use(requireAuth);

async function assertOwnsAssignmentCourse(assignmentId: string, userId: string) {
  const a = await maybe(supabase.from("assignments").select("course_id").eq("id", assignmentId).maybeSingle());
  if (!a) throw new ApiError(404, "Không tìm thấy bài tập");
  const c = await maybe(supabase.from("courses").select("lecturer_id").eq("id", a.course_id).maybeSingle());
  if (!c || c.lecturer_id !== userId) throw new ApiError(403, "Không có quyền");
}

async function testcasesFor(assignmentIds: string[], role: string) {
  if (assignmentIds.length === 0) return [] as any[];
  let query = supabase.from("testcases").select("*").in("assignment_id", assignmentIds).order("order_index", { ascending: true });
  if (role !== "lecturer") query = query.eq("is_hidden", false);
  return many(query);
}

async function loadAssignment(id: string, role: string) {
  const a = await maybe(supabase.from("assignments").select("*").eq("id", id).maybeSingle());
  if (!a) throw new ApiError(404, "Không tìm thấy bài tập");
  const tcs = await testcasesFor([id], role);
  return sAssignment({ ...a, testcases: tcs });
}

async function replaceTestcases(assignmentId: string, testcases: any[]) {
  await many(supabase.from("testcases").delete().eq("assignment_id", assignmentId));
  const rows = (testcases ?? [])
    .filter((t) => (t.input ?? "").trim() || (t.expectedOutput ?? "").trim())
    .map((t, i) => ({
      assignment_id: assignmentId, input: t.input ?? "", expected_output: t.expectedOutput ?? "",
      is_hidden: !!t.hidden, order_index: i,
    }));
  if (rows.length) await many(supabase.from("testcases").insert(rows));
}

// GET /api/assignments/course/:courseId
assignmentsRouter.get("/course/:courseId", asyncHandler(async (req, res) => {
  const list = await many(supabase.from("assignments").select("*").eq("course_id", req.params.courseId).order("deadline", { ascending: true }));
  const tcs = await testcasesFor(list.map((a) => a.id), req.user!.role);
  const byAsg: Record<string, any[]> = {};
  for (const t of tcs) (byAsg[t.assignment_id] ??= []).push(t);
  res.json(list.map((a) => sAssignment({ ...a, testcases: byAsg[a.id] ?? [] })));
}));

// GET /api/assignments/:id
assignmentsRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json(await loadAssignment(req.params.id, req.user!.role));
}));

// POST /api/assignments  (lecturer)
assignmentsRouter.post("/", requireRole("lecturer"), asyncHandler(async (req, res) => {
  const { courseId, title, source, description, pdfUrl, section, deadline, rubric, testcases } = req.body ?? {};
  if (!courseId || !title || !deadline || !rubric) throw new ApiError(400, "Thiếu thông tin bài tập");
  const owns = await maybe(supabase.from("courses").select("id").eq("id", courseId).eq("lecturer_id", req.user!.id).maybeSingle());
  if (!owns) throw new ApiError(403, "Không có quyền với lớp này");
  const a = await maybe(supabase.from("assignments").insert({
    course_id: courseId, title, source: source ?? "text", description: description ?? null,
    pdf_path: pdfUrl ?? null, section: section ?? null, deadline, rubric,
  }).select().single());
  await replaceTestcases(a.id, testcases ?? []);
  res.status(201).json(await loadAssignment(a.id, "lecturer"));
}));

// PATCH /api/assignments/:id  (lecturer)
assignmentsRouter.patch("/:id", requireRole("lecturer"), asyncHandler(async (req, res) => {
  await assertOwnsAssignmentCourse(req.params.id, req.user!.id);
  const { title, source, description, pdfUrl, section, deadline, rubric, testcases } = req.body ?? {};
  const patch: Record<string, unknown> = { description: description ?? null, pdf_path: pdfUrl ?? null };
  if (title !== undefined) patch.title = title;
  if (source !== undefined) patch.source = source;
  if (section !== undefined) patch.section = section ?? null;
  if (deadline !== undefined) patch.deadline = deadline;
  if (rubric !== undefined) patch.rubric = rubric;
  await many(supabase.from("assignments").update(patch).eq("id", req.params.id));
  if (Array.isArray(testcases)) await replaceTestcases(req.params.id, testcases);
  res.json(await loadAssignment(req.params.id, "lecturer"));
}));

// GET /api/assignments/course/:courseId/materials
assignmentsRouter.get("/course/:courseId/materials", asyncHandler(async (req, res) => {
  const rows = await many(supabase.from("materials").select("*").eq("course_id", req.params.courseId).order("uploaded_at", { ascending: false }));
  res.json(rows.map(sMaterial));
}));

// POST /api/assignments/course/:courseId/materials  (lecturer) — NHIỀU file + tên "mục"
assignmentsRouter.post("/course/:courseId/materials", requireRole("lecturer"), upload.array("files", 20),
  asyncHandler(async (req, res) => {
    const owns = await maybe(supabase.from("courses").select("id").eq("id", req.params.courseId).eq("lecturer_id", req.user!.id).maybeSingle());
    if (!owns) throw new ApiError(403, "Không có quyền");
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw new ApiError(400, "Thiếu file");
    const section = (req.body?.section ?? "").toString().trim() || null;
    const rows = await Promise.all(files.map(async (f) => ({
      course_id: req.params.courseId, title: origName(f), file_path: await saveFile(f), section,
    })));
    const inserted = await many(supabase.from("materials").insert(rows).select());
    res.status(201).json(inserted.map(sMaterial));
  }));

// POST /api/assignments/upload  (lecturer) — tải 1 file lên, trả về URL (dùng cho PDF đề bài)
assignmentsRouter.post("/upload", requireRole("lecturer"), upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "Thiếu file");
    res.status(201).json({ url: await saveFile(req.file), name: origName(req.file) });
  }));

// POST /api/assignments/:id/run  — CHẠY THỬ testcase (không chấm/không lưu). Chỉ chạy case client gửi
// (ví dụ công khai + case sinh viên tự thêm) → KHÔNG đụng testcase ẩn của giảng viên.
assignmentsRouter.post("/:id/run", asyncHandler(async (req, res) => {
  const { language, code, cases } = req.body ?? {};
  if (!language || !code) throw new ApiError(400, "Thiếu ngôn ngữ hoặc code");
  if (!Array.isArray(cases) || cases.length === 0) throw new ApiError(400, "Cần ít nhất 1 testcase để chạy");
  const safe = cases.slice(0, 12).map((c: any) => ({
    input: String(c?.input ?? "").slice(0, 50000),
    expectedOutput: c?.expectedOutput != null ? String(c.expectedOutput).slice(0, 50000) : undefined,
  }));
  res.json(await runSamples(String(language), String(code), safe));
}));
