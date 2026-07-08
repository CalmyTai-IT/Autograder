// MÔ ĐUN 5 — TỔNG KẾT: tính ĐIỂM (0-10) theo rubric một cách TẤT ĐỊNH (không để LLM bịa điểm),
// rồi gọi Groq để VIẾT NHẬN XÉT tổng hợp 4 mô đun.
//  • mode="practice"  → nhận xét + định hướng học tập.
//  • mode="assignment"→ nhận xét + vài thống kê nhỏ để giảng viên dễ kiểm tra.
// Luôn đính kèm "footer" thống kê tất định để có số liệu kể cả khi API lỗi.
import { config } from "../config";
import type { CriteriaResult, GradeInput, GradeMode, GradeResult, RubricConfig } from "./types";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export async function aggregate(args: {
  input: GradeInput;
  mode: GradeMode;
  rubric: RubricConfig;
  criteria: CriteriaResult;
  styleNotes?: string;
}): Promise<GradeResult> {
  const { mode, rubric, criteria, styleNotes } = args;
  const score = computeRubricScore(rubric, criteria);

  const prose = await groqComment({ mode, rubric, criteria, styleNotes, score });
  const aiComment = `${prose}\n\n${statsFooter(mode, rubric, criteria, score)}`;

  return { score, aiComment, flaggedCheating: false, criteria };
}

/** ĐIỂM = (testcase·wTC + complexity·wCX)/(wTC+wCX)/10. Style KHÔNG vào điểm (chỉ nhận xét). */
export function computeRubricScore(rubric: RubricConfig, c: CriteriaResult): number {
  const wTC = rubric.testcaseWeight ?? 100;
  const wCX = rubric.complexityEnabled ? (rubric.complexityWeight ?? 0) : 0;
  const total = wTC + wCX;
  const pct = total <= 0
    ? c.testcasePct
    : (c.testcasePct * wTC + (c.complexityPct ?? 0) * wCX) / total;
  const score10 = Math.round((pct / 10) * 100) / 100;
  return Math.max(0, Math.min(10, score10));
}

/* ─────────────── Groq: viết nhận xét ─────────────── */

async function groqComment(a: {
  mode: GradeMode; rubric: RubricConfig; criteria: CriteriaResult; styleNotes?: string; score: number;
}): Promise<string> {
  if (!config.groq.apiKey) return fallbackProse(a);

  const facts = factsBlock(a);
  const system = a.mode === "practice"
    ? "Bạn là trợ giảng lập trình. Viết nhận xét tiếng Việt RẤT NGẮN (2-3 câu) cho SINH VIÊN: 1 câu tóm tắt kết quả + 1-2 câu định hướng cải tiến. Không bịa số liệu, không lặp lại nguyên văn dữ kiện, không liệt kê dài."
    : "Bạn là trợ lý chấm bài cho GIẢNG VIÊN. Viết nhận xét tiếng Việt: tóm tắt chất lượng và nêu chỗ cần kiểm tra (testcase trượt / độ phức tạp / dấu hiệu lưu ý). Khách quan, không bịa số liệu, không liệt kê dài.";

  try {
    const retryable = new Set([429, 500, 502, 503, 504]);
    let res: Awaited<ReturnType<typeof fetch>> | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), config.llmTimeoutMs);
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.groq.apiKey}` },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: config.groq.model,
            temperature: 0.5,
            max_tokens: 200,
            messages: [
              { role: "system", content: system },
              { role: "user", content: `Dữ kiện chấm bài:\n${facts}\n\nViết nhận xét theo yêu cầu trên.` },
            ],
          }),
        });
      } finally { clearTimeout(timer); }
      if (res.ok || !retryable.has(res.status) || attempt === 3) break;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }

    if (!res || !res.ok) {
      const t = res ? await res.text().catch(() => "") : "";
      console.warn(`[aggregate] Groq lỗi ${res?.status}: ${t.slice(0, 300)}`);
      return fallbackProse(a);
    }
    const data: any = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    return text.trim() || fallbackProse(a);
  } catch (e) {
    console.warn(`[aggregate] Groq exception: ${String(e)}`);
    return fallbackProse(a);
  }
}

function factsBlock(a: { mode: GradeMode; rubric: RubricConfig; criteria: CriteriaResult; styleNotes?: string; score: number; }): string {
  const c = a.criteria;
  const lines = [
    `- Loại bài: ${a.mode === "practice" ? "luyện tập tự do" : "nộp deadline (tính điểm)"}`,
    `- Testcase: ${c.passedTests}/${c.totalTests} (${c.testcasePct}%)`,
  ];
  if (a.rubric.complexityEnabled && c.complexityClass) {
    lines.push(`- Độ phức tạp ước lượng: ${c.complexityClass} → đạt ${c.complexityPct ?? 0}% theo thang rubric`);
  }
  if (typeof c.similarityPct === "number") lines.push(`- Độ giống bài khác (cao nhất): ${c.similarityPct}% (ngưỡng gian lận ${a.rubric.plagiarismThreshold}%)`);
  if (a.styleNotes) lines.push(`- Nhận xét phong cách từ bộ phân tích: ${a.styleNotes}`);
  lines.push(`- Điểm cuối (đã tính theo rubric, cố định): ${a.score}/10`);
  return lines.join("\n");
}

/* ─────────────── Fallback & footer (tất định) ─────────────── */

function fallbackProse(a: { mode: GradeMode; criteria: CriteriaResult; styleNotes?: string; score: number; }): string {
  const c = a.criteria;
  const head = `Đạt ${c.passedTests}/${c.totalTests} testcase (${c.testcasePct}%).`;
  const cx = c.complexityClass ? ` Độ phức tạp ước lượng ${c.complexityClass}.` : "";
  const sty = a.styleNotes ? ` Phong cách: ${a.styleNotes}` : "";
  const tail = a.mode === "practice"
    ? " Hãy rà lại các testcase chưa qua và thử tối ưu thuật toán để cải thiện."
    : " Giảng viên nên xem lại các testcase trượt và đối chiếu độ phức tạp với yêu cầu đề.";
  return `${head}${cx}${sty}${tail}`;
}

function statsFooter(mode: GradeMode, rubric: RubricConfig, c: CriteriaResult, score: number): string {
  const parts = [`Testcase ${c.passedTests}/${c.totalTests} (${c.testcasePct}%)`];
  if (rubric.complexityEnabled && c.complexityClass) parts.push(`Độ phức tạp ${c.complexityClass} (${c.complexityPct ?? 0}%)`);
  if (mode === "assignment") parts.push(`Giống nhau ${c.similarityPct ?? 0}%`);
  parts.push(`Điểm ${score}/10`);
  return `📊 ${parts.join(" · ")}`;
}
