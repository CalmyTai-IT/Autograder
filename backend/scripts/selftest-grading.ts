// ============================================================================
//  TỰ KIỂM TRA MÔ ĐUN CHẤM ĐIỂM ("doctor")
//  Chạy:  npx tsx scripts/selftest-grading.ts
//
//  - Kiểm tra toolchain (python3 / g++ / javac).
//  - Chạy thử 5 mô đun với code thật (KHÔNG cần API key — phần LLM sẽ dùng fallback).
//  - Nếu có GEMINI_API_KEY / GROQ_API_KEY trong .env → ping thử để xác nhận key chạy được.
// ============================================================================
import { spawnSync } from "node:child_process";
import { config } from "../src/config";
import { runTestcases } from "../src/grading/testcase";
import { measureComplexity } from "../src/grading/complexity";
import { detectPlagiarism } from "../src/grading/plagiarism";
import { reviewStyle } from "../src/grading/style";
import { gradeSubmission } from "../src/grading/pipeline";
import type { RubricConfig } from "../src/grading/types";

const ok = (b: boolean) => (b ? "✅" : "❌");
const has = (cmd: string, arg = "--version") => { try { return !spawnSync(cmd, [arg]).error; } catch { return false; } };
const isRealPython = (c: string) => { try { const r = spawnSync(c, ["--version"], { encoding: "utf8" }); return !r.error && r.status === 0 && /Python\s+3/i.test(`${r.stdout ?? ""}${r.stderr ?? ""}`); } catch { return false; } };
const hasPython = () => ["python3", "python", "py"].some(isRealPython);

const RUBRIC: RubricConfig = {
  testcaseWeight: 70, complexityEnabled: true, complexityWeight: 30,
  complexityTiers: [
    { label: "O(n)", maxPercent: 100 }, { label: "O(n log n)", maxPercent: 90 },
    { label: "O(n²)", maxPercent: 60 }, { label: "O(n³)", maxPercent: 30 }, { label: "Chậm hơn", maxPercent: 0 },
  ],
  plagiarismEnabled: true, plagiarismThreshold: 80,
};
const TCS = [
  { input: "3\n1 2 3\n", expectedOutput: "6" },
  { input: "5\n10 20 30 40 50\n", expectedOutput: "150" },
];
const PY_OK = `import sys
d=sys.stdin.read().split(); n=int(d[0]); a=list(map(int,d[1:1+n]))
print(sum(a))`;
const PY_N2 = `import sys
d=sys.stdin.read().split(); n=int(d[0]); a=list(map(int,d[1:1+n]))
c=0
for i in range(n):
    for j in range(n): c+=a[i]*a[j]
print(c)`;

async function main() {
  console.log("\n── 1. Toolchain ──");
  console.log(`${ok(hasPython())} python (python3 / python / py)`);
  console.log(`${ok(has("g++"))} g++ (C++)`);
  console.log(`${ok(has("javac") && has("java", "-version"))} javac + java`);

  console.log("\n── 2. Mô đun (không cần API key) ──");
  const tc = await runTestcases({ submissionId: "s", code: PY_OK, language: "python", testcases: TCS });
  console.log(`${ok(tc.testcasePct === 100 && !tc.fatal)} testcase: ${tc.passedTests}/${tc.totalTests} (${tc.testcasePct}%)`);

  const cx1 = await measureComplexity({ submissionId: "s", code: PY_OK, language: "python", testcases: TCS, rubric: RUBRIC });
  const cx2 = await measureComplexity({ submissionId: "s", code: PY_N2, language: "python", testcases: TCS, rubric: RUBRIC });
  console.log(`${ok(cx1.complexityClass === "O(n)" && cx2.complexityClass === "O(n²)")} complexity: ${cx1.complexityClass} (${cx1.complexityPct}%) | ${cx2.complexityClass} (${cx2.complexityPct}%)`);

  const plag = await detectPlagiarism({ submissionId: "s", code: PY_OK, language: "python", testcases: TCS,
    peers: [{ id: "twin", code: PY_OK.replace(/a\b/g, "arr") }, { id: "other", code: PY_N2 }] });
  console.log(`${ok(plag.similarityPct > 80 && plag.matchedId === "twin")} plagiarism: giống nhất ${plag.similarityPct}% với '${plag.matchedId}'`);

  console.log("\n── 3. Pipeline end-to-end (practice) ──");
  const r = await gradeSubmission({ submissionId: "s", code: PY_OK, language: "python", testcases: TCS, mode: "practice" });
  console.log(`${ok(r.score === 10)} điểm = ${r.score}/10`);
  console.log(`   nhận xét: ${r.aiComment.replace(/\n/g, " ").slice(0, 160)}…`);

  console.log("\n── 4. LLM (chỉ chạy nếu có key) ──");
  if (config.gemini.apiKey) {
    try {
      const st = await reviewStyle({ submissionId: "s", code: PY_OK, language: "python", testcases: TCS }, { mode: "practice", purpose: "review" });
      const live = !/Chưa cấu hình|Không gọi được|Lỗi kết nối/.test(st.notes);
      console.log(`${ok(live)} Gemini (${config.gemini.model}): ${st.notes.slice(0, 120)}…`);
    } catch (e) { console.log(`❌ Gemini lỗi: ${String(e)}`); }
  } else {
    console.log("⏭️  GEMINI_API_KEY trống → bỏ qua (mô đun style sẽ dùng fallback).");
  }
  if (config.groq.apiKey) {
    const g = await gradeSubmission({ submissionId: "s", code: PY_OK, language: "python", testcases: TCS, rubric: RUBRIC, mode: "assignment" });
    console.log(`${ok(!!g.aiComment)} Groq (${config.groq.model}): ${g.aiComment.replace(/\n/g, " ").slice(0, 120)}…`);
  } else {
    console.log("⏭️  GROQ_API_KEY trống → bỏ qua (mô đun tổng kết sẽ dùng fallback).");
  }

  console.log("\n✔ Hoàn tất self-test.\n");
}
main().catch((e) => { console.error("LỖI self-test:", e); process.exit(1); });
