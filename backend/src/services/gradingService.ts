// Orchestration chấm điểm: lấy dữ liệu → gọi pipeline (mô hình) → ghi điểm → cập nhật job.
// KHÔNG chứa logic mô hình (ở src/grading). Hai function báo lỗi cho tới khi mô hình được cài.
import { many, maybe, supabase } from "../db";
import { gradeSubmission } from "../grading/pipeline";
import type { RubricConfig, TestcaseIO } from "../grading/types";

/** Chấm hàng loạt 1 bài lớp (gọi sau deadline). */
export async function gradeAssignment(assignmentId: string) {
  const asg = await maybe(supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle());
  if (!asg) throw new Error("Không tìm thấy bài tập");

  const tcRows = await many(supabase.from("testcases").select("*").eq("assignment_id", assignmentId).order("order_index", { ascending: true }));
  const testcases: TestcaseIO[] = tcRows.map((t) => ({ input: t.input, expectedOutput: t.expected_output, hidden: t.is_hidden }));
  const rubric = asg.rubric as RubricConfig;

  const subs = await many(supabase.from("submissions").select("*").eq("assignment_id", assignmentId));
  const peers = subs.map((s) => ({ id: s.id, code: s.code ?? "", language: s.file_name as string | undefined }));

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const s of subs) {
    const job = await maybe(supabase.from("grading_jobs").insert({ submission_id: s.id, status: "running", started_at: new Date().toISOString() }).select("id").single());
    try {
      const r = await gradeSubmission({ submissionId: s.id, code: s.code ?? "", fileName: s.file_name, testcases, rubric, mode: "assignment", peers: peers.filter((p) => p.id !== s.id) });
      await many(supabase.from("submissions").update({
        status: "graded", score: r.score, testcase_pct: r.criteria.testcasePct,
        complexity_pct: r.criteria.complexityPct ?? null, complexity_class: r.criteria.complexityClass ?? null,
        similarity_pct: r.criteria.similarityPct, ai_comment: r.aiComment, flagged_cheating: r.flaggedCheating,
        graded_at: new Date().toISOString(),
      }).eq("id", s.id));
      await many(supabase.from("grading_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", job.id));
      results.push({ id: s.id, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await many(supabase.from("grading_jobs").update({ status: "error", error_message: msg, finished_at: new Date().toISOString() }).eq("id", job.id));
      results.push({ id: s.id, ok: false, error: msg });
    }
  }
  return { assignmentId, total: subs.length, results };
}

/** Chấm ngay 1 lần nộp bài tự do. */
export async function gradeProblemSubmission(submissionId: string) {
  const job = await maybe(supabase.from("grading_jobs").insert({ problem_sub_id: submissionId, status: "running", started_at: new Date().toISOString() }).select("id").single());
  try {
    const sub = await maybe(supabase.from("problem_submissions").select("*").eq("id", submissionId).maybeSingle());
    if (!sub) throw new Error("Không tìm thấy bài nộp");
    const tcRows = await many(supabase.from("testcases").select("*").eq("problem_id", sub.problem_id).order("order_index", { ascending: true }));
    const testcases: TestcaseIO[] = tcRows.map((t) => ({ input: t.input, expectedOutput: t.expected_output, hidden: t.is_hidden }));

    const r = await gradeSubmission({ submissionId, code: sub.code, language: sub.language, testcases, mode: "practice" });
    await many(supabase.from("problem_submissions").update({
      score: r.score, passed_tests: r.criteria.passedTests, total_tests: r.criteria.totalTests, ai_comment: r.aiComment,
    }).eq("id", submissionId));
    await many(supabase.from("grading_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", job.id));
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await many(supabase.from("grading_jobs").update({ status: "error", error_message: msg, finished_at: new Date().toISOString() }).eq("id", job.id));
    throw e;
  }
}
