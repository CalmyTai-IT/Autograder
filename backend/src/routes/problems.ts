import { Router } from "express";
import { many, maybe, supabase } from "../db";
import { ApiError, asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { sProblem, sProblemSub } from "../lib/serialize";
import { runSamples } from "../grading/testcase";

export const problemsRouter = Router();
problemsRouter.use(requireAuth);

// GET /api/problems/submissions/mine  — TẤT CẢ bài nộp luyện tập của tôi (mọi bài)
problemsRouter.get("/submissions/mine", asyncHandler(async (req, res) => {
  const rows = await many(supabase.from("problem_submissions").select("*").eq("user_id", req.user!.id).order("submitted_at", { ascending: false }));
  res.json(rows.map(sProblemSub));
}));

async function loadProblem(id: string) {
  const p = await maybe(supabase.from("problems").select("*").eq("id", id).maybeSingle());
  if (!p) throw new ApiError(404, "Không tìm thấy bài tập");
  const tcs = await many(supabase.from("testcases").select("*").eq("problem_id", id).order("order_index", { ascending: true }));
  return sProblem({ ...p, testcases: tcs });
}

async function replaceTestcases(problemId: string, testcases: any[]) {
  await many(supabase.from("testcases").delete().eq("problem_id", problemId));
  const rows = (testcases ?? [])
    .filter((t) => (t.input ?? "").trim() || (t.expectedOutput ?? "").trim())
    .map((t, i) => ({ problem_id: problemId, input: t.input ?? "", expected_output: t.expectedOutput ?? "", is_hidden: !!t.hidden, order_index: i }));
  if (rows.length) await many(supabase.from("testcases").insert(rows));
}

// GET /api/problems
problemsRouter.get("/", asyncHandler(async (_req, res) => {
  const list = await many(supabase.from("problems").select("*").eq("is_public", true).order("created_at", { ascending: false }));
  const ids = list.map((p) => p.id);
  const tcs = ids.length ? await many(supabase.from("testcases").select("*").in("problem_id", ids).order("order_index", { ascending: true })) : [];
  const byProblem: Record<string, any[]> = {};
  for (const t of tcs) (byProblem[t.problem_id] ??= []).push(t);
  res.json(list.map((p) => sProblem({ ...p, testcases: byProblem[p.id] ?? [] })));
}));

// GET /api/problems/:id
problemsRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json(await loadProblem(req.params.id));
}));

// POST /api/problems  (lecturer)
problemsRouter.post("/", requireRole("lecturer"), asyncHandler(async (req, res) => {
  const { title, difficulty, description, testcases } = req.body ?? {};
  if (!title || !description) throw new ApiError(400, "Thiếu thông tin");
  const p = await maybe(supabase.from("problems").insert({
    title, difficulty: difficulty ?? "easy", description, created_by: req.user!.id,
  }).select().single());
  await replaceTestcases(p.id, testcases ?? []);
  res.status(201).json(await loadProblem(p.id));
}));

// PATCH /api/problems/:id  (lecturer)
problemsRouter.patch("/:id", requireRole("lecturer"), asyncHandler(async (req, res) => {
  const p = await maybe(supabase.from("problems").select("created_by").eq("id", req.params.id).maybeSingle());
  if (!p) throw new ApiError(404, "Không tìm thấy bài tập");
  if (p.created_by !== req.user!.id) throw new ApiError(403, "Không có quyền");
  const { title, difficulty, description, testcases } = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (title !== undefined) patch.title = title;
  if (difficulty !== undefined) patch.difficulty = difficulty;
  if (description !== undefined) patch.description = description;
  if (Object.keys(patch).length) await many(supabase.from("problems").update(patch).eq("id", req.params.id));
  if (Array.isArray(testcases)) await replaceTestcases(req.params.id, testcases);
  res.json(await loadProblem(req.params.id));
}));

// GET /api/problems/:id/submissions/mine
problemsRouter.get("/:id/submissions/mine", asyncHandler(async (req, res) => {
  const rows = await many(supabase.from("problem_submissions").select("*").eq("problem_id", req.params.id).eq("user_id", req.user!.id).order("submitted_at", { ascending: false }));
  res.json(rows.map(sProblemSub));
}));

// POST /api/problems/:id/run  — CHẠY THỬ: trả output thực tế từng case, KHÔNG lưu, KHÔNG gọi AI.
problemsRouter.post("/:id/run", asyncHandler(async (req, res) => {
  const { language, code, cases } = req.body ?? {};
  if (!language || !code) throw new ApiError(400, "Thiếu ngôn ngữ hoặc code");
  if (!Array.isArray(cases) || cases.length === 0) throw new ApiError(400, "Cần ít nhất 1 testcase để chạy");
  const safe = cases.slice(0, 12).map((c: any) => ({
    input: String(c?.input ?? "").slice(0, 50000),
    expectedOutput: c?.expectedOutput != null ? String(c.expectedOutput).slice(0, 50000) : undefined,
  }));
  res.json(await runSamples(String(language), String(code), safe));
}));

// POST /api/problems/:id/submissions  { language, code }
problemsRouter.post("/:id/submissions", asyncHandler(async (req, res) => {
  const { language, code } = req.body ?? {};
  if (!language || !code) throw new ApiError(400, "Thiếu ngôn ngữ hoặc code");
  const row = await maybe(supabase.from("problem_submissions").insert({
    problem_id: req.params.id, user_id: req.user!.id, language, code,
  }).select().single());
  res.status(201).json(sProblemSub(row));
}));
