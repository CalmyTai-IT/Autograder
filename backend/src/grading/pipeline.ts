// ============================================================================
//  PIPELINE — ĐIỀU PHỐI 5 MÔ ĐUN theo đúng luồng trong sửa.txt:
//
//   (1) GIAN LẬN trước tiên (GATE): so tất cả bài với nhau. Nếu vượt ngưỡng
//       → 0 điểm + chỉ ra giống bài nào, DỪNG (không qua các mô đun còn lại).
//   (2) TESTCASE:
//        • Có lỗi do code (không biên dịch được / luôn crash)
//             → STYLE ở chế độ "debug" (tìm lỗi & hướng dẫn), XONG, KHÔNG tổng kết.
//        • Chạy được
//             → COMPLEXITY ∥ STYLE (song song, độc lập testcase)
//             → TỔNG KẾT (Groq) ra điểm theo rubric + nhận xét.
// ============================================================================
import type { CriteriaResult, GradeInput, GradeMode, GradeResult, RubricConfig } from "./types";
import { runTestcases } from "./testcase";
import { detectPlagiarism } from "./plagiarism";
import { measureComplexity } from "./complexity";
import { reviewStyle } from "./style";
import { aggregate } from "./aggregate";

/** Rubric mặc định cho BÀI TỰ DO (practice) — không có rubric riêng từ đề.
 *  Điểm chỉ tính theo testcase; complexity vẫn chạy nhưng trọng số 0 (chỉ để nhận xét/định hướng);
 *  không kiểm tra gian lận (bài tự do nộp lẻ, không có "lớp" để so). */
const PRACTICE_RUBRIC: RubricConfig = {
  testcaseWeight: 100,
  complexityEnabled: true,
  complexityWeight: 0,
  complexityTiers: [
    { label: "O(n)", maxPercent: 100 }, { label: "O(n log n)", maxPercent: 90 },
    { label: "O(n²)", maxPercent: 60 }, { label: "O(n³)", maxPercent: 30 }, { label: "Chậm hơn", maxPercent: 0 },
  ],
  plagiarismEnabled: false,
  plagiarismThreshold: 100,
};

export async function gradeSubmission(input: GradeInput): Promise<GradeResult> {
  const mode: GradeMode = input.mode ?? (input.rubric ? "assignment" : "practice");
  const rubric: RubricConfig = input.rubric ?? PRACTICE_RUBRIC;
  const totalTests = input.testcases.length;

  // ── (1) GIAN LẬN — GATE ──────────────────────────────────────────────────
  const plagEnabled = rubric.plagiarismEnabled !== false;
  const hasPeers = (input.peers?.length ?? 0) > 0;
  const plag = plagEnabled && hasPeers
    ? await detectPlagiarism(input)
    : { similarityPct: 0, matchedId: undefined as string | undefined };

  if (plagEnabled && hasPeers && plag.similarityPct >= rubric.plagiarismThreshold) {
    return cheatingResult(plag, mode, rubric, totalTests);
  }

  // ── (2) TESTCASE ─────────────────────────────────────────────────────────
  const tc = await runTestcases(input);
  const base: CriteriaResult = {
    passedTests: tc.passedTests, totalTests: tc.totalTests, testcasePct: tc.testcasePct,
    similarityPct: plag.similarityPct, matchedId: plag.matchedId,
  };

  // (2a) Có lỗi do code → STYLE(debug) → xong, KHÔNG qua tổng kết
  if (tc.fatal) {
    const dbg = await reviewStyle(input, { mode, purpose: "debug", errorSummary: tc.errorSummary });
    const footer = `📊 Không chấm điểm: code chưa chạy được (${tc.passedTests}/${tc.totalTests} testcase chạy đúng)` +
      (tc.compileError ? " · lỗi biên dịch/cú pháp" : " · crash/timeout toàn bộ");
    return {
      score: 0,
      aiComment: `${dbg.notes}\n\n${footer}`,
      flaggedCheating: false,
      criteria: { ...base, stylePct: dbg.stylePct },
    };
  }

  // (2b) Chạy được → COMPLEXITY ∥ STYLE (song song)
  const wantComplexity = rubric.complexityEnabled !== false;
  const [cx, st] = await Promise.all([
    wantComplexity ? measureComplexity(input) : Promise.resolve(undefined),
    reviewStyle(input, { mode, purpose: "review" }),
  ]);

  const criteria: CriteriaResult = {
    ...base,
    complexityClass: cx?.complexityClass,
    complexityPct: cx?.complexityPct,
    stylePct: st.stylePct,
  };

  // ── (3) TỔNG KẾT → điểm theo rubric + nhận xét ───────────────────────────
  return aggregate({ input, mode, rubric, criteria, styleNotes: st.notes });
}

/** Kết quả khi phát hiện gian lận (GATE) — 0 điểm, không qua mô đun nào khác. */
function cheatingResult(
  plag: { similarityPct: number; matchedId?: string },
  mode: GradeMode,
  rubric: RubricConfig,
  totalTests: number,
): GradeResult {
  const matched = plag.matchedId ? ` (trùng cao nhất với bài nộp mã ${plag.matchedId})` : "";
  const comment =
    `🚫 Phát hiện gian lận: độ giống ${plag.similarityPct}% ≥ ngưỡng ${rubric.plagiarismThreshold}%${matched}. ` +
    (mode === "assignment"
      ? "Bài bị đánh dấu 0 điểm; giảng viên nên đối chiếu trực tiếp hai bài để xác nhận."
      : "Bài bị đánh dấu 0 điểm do trùng với bài khác.");
  return {
    score: 0,
    aiComment: comment,
    flaggedCheating: true,
    criteria: {
      passedTests: 0, totalTests, testcasePct: 0,
      similarityPct: plag.similarityPct, matchedId: plag.matchedId,
    },
  };
}
