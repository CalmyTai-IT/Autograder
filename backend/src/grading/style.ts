// MÔ ĐUN 3 — PHONG CÁCH CODE: gọi Google Gemini.
//  • purpose="review": chấm phong cách (đặt tên/cấu trúc/độ rõ ràng) → % + nhận xét.
//       - mode="practice"  → nhận xét + ĐỊNH HƯỚNG cải tiến (mang tính dạy học).
//       - mode="assignment"→ nhận xét + CHỈ RA điểm giảng viên nên xem lại.
//  • purpose="debug"  : code chạy lỗi → tìm lỗi & HƯỚNG DẪN sửa (không lấy phong cách).
// Trả { stylePct, notes }. stylePct chỉ phục vụ nhận xét (KHÔNG vào điểm số).
import { config } from "../config";
import type { GradeInput, StyleOptions } from "./types";

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export async function reviewStyle(input: GradeInput, opts: StyleOptions): Promise<{ stylePct: number; notes: string }> {
  const code = (input.code ?? "").slice(0, 8000);
  const prompt = buildPrompt(code, input.language ?? "", opts);

  if (!config.gemini.apiKey) {
    return fallback(opts, "(Chưa cấu hình GEMINI_API_KEY nên bỏ qua nhận xét phong cách.)");
  }

  try {
    const retryable = new Set([429, 500, 502, 503, 504]);
    let res: Awaited<ReturnType<typeof fetch>> | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), config.llmTimeoutMs);
      try {
        res = await fetch(ENDPOINT(config.gemini.model), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": config.gemini.apiKey },
          signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, responseMimeType: "application/json", maxOutputTokens: 220, thinkingConfig: { thinkingBudget: 0 } },
          }),
        });
      } finally { clearTimeout(timer); }
      // 503/429 thường do model quá tải tạm thời → chờ rồi thử lại
      if (res.ok || !retryable.has(res.status) || attempt === 3) break;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }

    if (!res || !res.ok) {
      const t = res ? await res.text().catch(() => "") : "";
      console.warn(`[style] Gemini lỗi ${res?.status}: ${t.slice(0, 300)}`);
      return fallback(opts, `(Không gọi được Gemini — HTTP ${res?.status ?? "?"}.)`);
    }
    const data: any = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    const parsed = parseJson(text);
    const score = clampPct(Number(parsed?.score));
    const notes = String(parsed?.comment ?? parsed?.notes ?? text ?? "").trim();
    return { stylePct: Number.isFinite(score) ? score : 75, notes: notes || "(Gemini không trả nội dung.)" };
  } catch (e) {
    console.warn(`[style] Gemini exception: ${String(e)}`);
    return fallback(opts, "(Lỗi kết nối Gemini — bỏ qua nhận xét phong cách.)");
  }
}

function buildPrompt(code: string, lang: string, opts: StyleOptions): string {
  const header =
    `Bạn là trợ giảng môn lập trình. Trả về DUY NHẤT một JSON dạng ` +
    `{"score": <0-100>, "comment": "<tiếng Việt, NGẮN GỌN tối đa 2-3 câu>"}. ` +
    `Không thêm chữ nào ngoài JSON. Không liệt kê dài dòng, không lặp lại đề.\n` +
    `Ngôn ngữ: ${lang || "không rõ"}.\n`;

  if (opts.purpose === "debug") {
    const who = opts.mode === "practice"
      ? `Người học đang luyện tập: nêu NGẮN lỗi chính và 1 gợi ý sửa.`
      : `Bài nộp tính điểm: nêu NGẮN lỗi chính để giảng viên kiểm tra.`;
    return (
      header +
      `Code dưới đây CHẠY LỖI (không biên dịch được hoặc luôn crash). "score" = 0. ${who}\n` +
      (opts.errorSummary ? `Lỗi quan sát được:\n"""${opts.errorSummary}"""\n` : "") +
      `Code:\n"""${code}"""`
    );
  }

  // purpose = "review"
  const guidance = opts.mode === "practice"
    ? `Chấm phong cách (đặt tên, cấu trúc, độ rõ ràng). "comment": 1 điểm tốt + 1 định hướng cải tiến, ngắn gọn.`
    : `Chấm phong cách (đặt tên, cấu trúc, độ rõ ràng). "comment": nêu ngắn chỗ giảng viên nên xem lại (nếu có).`;
  return header + guidance + `\n"score" = chất lượng phong cách (0-100).\nCode:\n"""${code}"""`;
}

function fallback(opts: StyleOptions, msg: string): { stylePct: number; notes: string } {
  return { stylePct: opts.purpose === "debug" ? 0 : 75, notes: msg };
}

function clampPct(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  return Math.max(0, Math.min(100, Math.round(x * 100) / 100));
}

/** Bóc JSON kể cả khi model bọc trong ```json ... ``` hoặc kèm chữ thừa. */
function parseJson(text: string): any {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(t); } catch { /* thử cắt từ { đến } */ }
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch { /* ignore */ } }
  return null;
}
