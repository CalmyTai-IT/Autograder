// MÔ ĐUN 1 — TESTCASE: biên dịch + chạy code trong sandbox, so output với đáp án → % pass.
// Trả thêm cờ compileError/fatal + tóm tắt lỗi để pipeline rẽ nhánh "tìm lỗi".
import type { GradeInput, TestcaseRunResult, TestStatus } from "./types";
import { compileSource, resolveLang, runPrepared, outputsEqual } from "./sandbox";

export async function runTestcases(input: GradeInput): Promise<TestcaseRunResult> {
  const total = input.testcases.length;
  const lang = resolveLang(input);

  // 1) Biên dịch (hoặc kiểm tra cú pháp với Python)
  const prep = await compileSource(lang, input.code ?? "");
  if (!prep.ok) {
    prep.cleanup();
    return {
      passedTests: 0, totalTests: total, testcasePct: 0,
      compileError: true, fatal: true,
      errorSummary: trimErr(prep.error),
      perTest: [],
    };
  }

  // 2) Chạy từng testcase
  let passed = 0;
  let firstError: string | undefined;
  const perTest: { index: number; status: TestStatus; hidden?: boolean }[] = [];

  try {
    for (let i = 0; i < total; i++) {
      const tc = input.testcases[i];
      const r = await runPrepared(prep, tc.input ?? "");
      let status: TestStatus;
      if (r.timedOut) {
        status = "timeout";
        firstError ??= `Testcase #${i + 1}: quá thời gian (TLE)`;
      } else if (r.exitCode !== 0) {
        status = "runtime_error";
        firstError ??= `Testcase #${i + 1}: lỗi khi chạy (exit ${r.exitCode}). ${trimErr(r.stderr)}`;
      } else if (outputsEqual(r.stdout, tc.expectedOutput ?? "")) {
        status = "pass";
        passed++;
      } else {
        status = "wrong";
      }
      perTest.push({ index: i, status, hidden: tc.hidden });
    }
  } finally {
    prep.cleanup();
  }

  const testcasePct = total > 0 ? round2((passed / total) * 100) : 0;

  // "fatal" = mọi testcase đều crash/timeout (không hề tạo ra output để so) → coi như code hỏng.
  const ranAny = perTest.some((t) => t.status === "pass" || t.status === "wrong");
  const fatal = total > 0 && !ranAny;

  return {
    passedTests: passed, totalTests: total, testcasePct,
    compileError: false, fatal,
    errorSummary: fatal ? firstError : undefined,
    perTest,
  };
}

function round2(x: number): number { return Math.round(x * 100) / 100; }
function trimErr(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  return t.length > 1500 ? t.slice(0, 1500) + " …" : t;
}

/* ───────── Chạy thử (kiểu LeetCode): trả OUTPUT THỰC TẾ từng case, KHÔNG chấm/không lưu ─────────
   Dùng cho nút "Chạy thử" ở bài tự do: sinh viên xem máy chạy ra gì so với kết quả mong đợi.
   Chỉ chạy đúng các case client gửi lên (sample hiển thị + case tự thêm) → không lộ testcase ẩn. */
export interface RunCaseResult {
  index: number;
  input: string;
  expected?: string;
  actual: string;
  stderr?: string;
  status: "pass" | "wrong" | "runtime_error" | "timeout" | "no_expected";
}
export interface RunSamplesResult { compileError: boolean; errorSummary?: string; cases: RunCaseResult[]; }

export async function runSamples(
  language: string,
  code: string,
  cases: { input: string; expectedOutput?: string }[],
): Promise<RunSamplesResult> {
  const lang = resolveLang({ language, code });
  const prep = await compileSource(lang, code);
  if (!prep.ok) { prep.cleanup(); return { compileError: true, errorSummary: trimErr(prep.error), cases: [] }; }

  const results: RunCaseResult[] = [];
  try {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const r = await runPrepared(prep, c.input ?? "");
      const exp = c.expectedOutput ?? "";
      let status: RunCaseResult["status"];
      if (r.timedOut) status = "timeout";
      else if (r.exitCode !== 0) status = "runtime_error";
      else if (exp.trim() === "") status = "no_expected";
      else status = outputsEqual(r.stdout, exp) ? "pass" : "wrong";
      results.push({
        index: i,
        input: c.input ?? "",
        expected: c.expectedOutput,
        actual: cap(r.stdout),
        stderr: r.timedOut ? "⏱ Quá thời gian (TLE)" : (r.exitCode !== 0 ? cap(r.stderr) : undefined),
        status,
      });
    }
  } finally {
    prep.cleanup();
  }
  return { compileError: false, cases: results };
}

function cap(s: string, n = 4000): string { const t = s ?? ""; return t.length > n ? t.slice(0, n) + " …(đã cắt)" : t; }
