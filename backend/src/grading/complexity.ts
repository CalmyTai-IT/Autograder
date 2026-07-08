// ============================================================================
//  MÔ ĐUN 2 — ĐỘ PHỨC TẠP (KHÔNG gọi API).
//
//  Dùng PHÂN TÍCH TĨNH (static structural analysis) để suy ra lớp O(...):
//    • độ sâu vòng lặp lồng nhau  → n^depth
//      (kể cả vòng lặp trong list/dict/set comprehension cùng dòng)
//    • 1 vòng lặp TỰ chia đôi (binary-search có `mid`; biến đếm ×/÷ 2) → O(log n)
//    • vòng lặp tuyến tính có GỌI thao tác log (binary_search/lower_bound…) → n log n
//    • gọi sort thư viện  → n log n
//    • hàm tổng hợp tuyến tính trên dữ liệu (sum/max/min/sorted/accumulate…)  → ≥ n
//    • đệ quy: tuyến tính → n ; chia-để-trị có chia đôi → n log n ; nhiều nhánh
//      không chia đôi → mũ (2^n)
//
//  ➜ Chọn phương pháp tĩnh (thay vì đo thời gian) vì grader cần KẾT QUẢ TÁI LẬP
//    (cùng bài → cùng điểm), trong khi đo thời gian bị nhiễu bởi I/O, tải máy và
//    chi phí khởi động trình thông dịch. (Phần "đo thực nghiệm" được mô tả trong
//    HUONG_DAN_CHAM_DIEM.md nếu muốn dùng làm phương án thay thế.)
//
//  Cuối cùng MAP lớp O(...) sang % theo rubric.complexityTiers
//    (vd lời giải O(n²), rubric [O(n log n)=100, O(n²)=80, O(n³)=50] → 80%).
// ============================================================================
import type { GradeInput, RubricConfig } from "./types";
import { resolveLang, type Lang } from "./sandbox";

interface CxOut { complexityClass: string; complexityPct: number; }

export async function measureComplexity(input: GradeInput): Promise<CxOut> {
  const tiers = input.rubric?.complexityTiers ?? DEFAULT_TIERS;
  const lang = resolveLang(input);
  const { label, rank } = analyze(input.code ?? "", lang);
  return { complexityClass: label, complexityPct: mapToTier(rank, tiers) };
}

/* ───────────────────────── Phân tích tĩnh ───────────────────────── */

function analyze(code: string, lang: Lang): { label: string; rank: number } {
  const s = stripNoise(code, lang);

  let depth = lang === "python" ? pythonLoopDepth(s) : braceLoopDepth(s);
  const hasSort = /\b(sorted|std::sort|Arrays\.sort|Collections\.sort)\s*\(|\bsort\s*\(|\.sort\s*\(/.test(s);

  // PHÂN BIỆT 2 loại "log n" mà trước đây bị gộp làm một:
  //  • halvingSelf — CHÍNH vòng lặp tự thu hẹp một phần mỗi bước (binary-search có
  //    `mid`; hoặc biến đếm nhân/chia cho MỘT HẰNG SỐ bất kỳ: i//=2, i>>=1, i//=10 …)
  //      → một vòng lặp như vậy chạy O(log n) lần, KHÔNG phải O(n).
  //  • logCall — vòng lặp TUYẾN TÍNH nhưng GỌI thao tác log (binary_search,
  //    lower_bound, bisect, hoặc thao tác trên set/map/heap…) ở bên trong → O(n log n).
  //    NOTE: trước đây chỉ nhận /2, bỏ sót chia cho hằng số khác (vd chia 10 đếm
  //    chữ số) → giờ tổng quát hoá thành "chia/nhân cho MỘT HẰNG SỐ NGUYÊN bất kỳ".
  const geoUpdate =
    /\b\w+\s*(?:\/\/=|>>=|<<=|\*=|\/=)\s*\d+\b/.test(s) ||
    /\b(\w+)\s*=\s*\1\s*(?:\/\/|>>|<<|\*|\/)\s*\d+\b/.test(s);
  const halvingSelf = /\bmid\b/.test(s) || geoUpdate;

  // Thao tác log-time trên cấu trúc dữ liệu có thứ tự (set/map cây, heap):
  // chỉ tính là "log" khi CÓ khai báo container loại này VÀ có gọi thao tác
  // insert/find/count/erase/push/pop tương ứng — tránh nhầm với list/vector
  // (mà .insert()/.erase() thường là O(n)).
  const hasOrderedContainer =
    /\b(?:std::)?(?:multi)?(?:set|map)\s*</.test(s) ||
    /\bTreeSet\b|\bTreeMap\b|\bPriorityQueue\b/.test(s) ||
    /\bheapq\b/.test(s);
  const hasOrderedContainerOp =
    /\.\s*(?:insert|find|count|erase|lower_bound|upper_bound)\s*\(/.test(s) ||
    /\bheappush\s*\(|\bheappop\s*\(/.test(s) ||
    /\.\s*(?:add|offer|poll|remove)\s*\(/.test(s);

  const logCall =
    /\b(?:binary_search|lower_bound|upper_bound|bisect_left|bisect_right|bisect)\s*\(/.test(s) ||
    /\.\s*binarySearch\s*\(/.test(s) ||
    (hasOrderedContainer && hasOrderedContainerOp);

  const hasLinearBuiltin =
    /\b(sum|max|min|any|all|count|reduce|accumulate|max_element|min_element)\s*\(/.test(s) ||
    /\.stream\s*\(\s*\)|Arrays\.stream\s*\(/.test(s);

  // Thao tác O(n) BỊ GIẤU bên trong một vòng lặp tưởng như tuyến tính
  // (vd list.insert(0, x), list.pop(0) trong Python — mỗi lần dịch cả mảng) →
  // vòng lặp n lần × thao tác O(n) = O(n²), không phải O(n).
  const hiddenLinearOpInLoop =
    /\.\s*insert\s*\(\s*0\s*,/.test(s) || /\.\s*pop\s*\(\s*0\s*\)/.test(s);

  // Chặn mũ/giai thừa bị "che" dưới vỏ vòng lặp thay vì đệ quy:
  //  • biên vòng lặp dạng 2^n / 1<<n / pow(2, n)  → duyệt tập con, mặt nạ bit…
  //  • itertools.permutations/combinations, math.factorial → duyệt hoán vị/tổ hợp
  const hasExponentialBound =
    /range\s*\(\s*1\s*<<\s*\w+\s*\)/.test(s) || /range\s*\(\s*2\s*\*\*\s*\w+\s*\)/.test(s) ||
    /[<>]=?\s*\(?\s*1\s*<<\s*\w+/.test(s) || /[<>]=?\s*\(?\s*2\s*\*\*\s*\w+/.test(s) ||
    /\bpow\s*\(\s*2\s*,\s*\w+\s*\)\s*[-+]?\s*\d*\s*[<>]/.test(s) ||
    /[<>]=?\s*\(?\s*(?:pow\s*\(\s*2\s*,\s*\w+\s*\)|Math\.pow\s*\(\s*2\s*,\s*\w+\s*\))/.test(s);
  const hasCombinatorialBlowup =
    /itertools\.permutations\s*\(|itertools\.combinations\s*\(|math\.factorial\s*\(/.test(s);

  // Vòng lặp có SỐ LẦN LẶP CỐ ĐỊNH (hằng số, không phụ thuộc n) → thực chất O(1)
  // dù cú pháp trông như một vòng lặp thường (vd `for i in range(32)`,
  // `for(int i=0;i<100;i++)`).
  const fixedBoundLoopOnly =
    depth === 1 &&
    (/for\s+\w+\s+in\s+range\s*\(\s*\d+\s*(?:,\s*\d+\s*)?\)\s*:/.test(s) ||
      /for\s*\(\s*(?:int|long)\s+\w+\s*=\s*\d+\s*;\s*\w+\s*[<>]=?\s*\d+\s*;/.test(s));

  const { rec, interprocDepthBoost } = recursionAndCallGraph(s, lang);
  depth = Math.max(depth, interprocDepthBoost);

  // ── lớp từ cấu trúc vòng lặp ──
  let rank: number;
  if (depth >= 4) rank = 7;                       // chậm hơn O(n³)
  else if (depth === 3) rank = 6;                 // O(n³)
  else if (depth === 2) rank = 5;                 // O(n²)
  else if (depth === 1) {                         // MỘT vòng lặp
    if (fixedBoundLoopOnly && !hasSort && !logCall && !halvingSelf && !hiddenLinearOpInLoop) {
      rank = 1;                                   // O(1): số lần lặp là hằng số cố định
    } else if (hasSort || logCall) rank = 4;      // O(n log n): sort, hoặc n × thao-tác-log
    else if (hiddenLinearOpInLoop) rank = 5;      // O(n²): n × thao-tác-O(n) bị giấu
    else if (halvingSelf) rank = 2;               // O(log n): vòng lặp tự chia đôi (binary search)
    else rank = 3;                                // O(n): vòng lặp tuyến tính thường
  } else {                                        // depth === 0
    if (hasSort) rank = 4;                        // O(n log n)
    else if (hasLinearBuiltin) rank = 3;          // O(n)
    else if (logCall) rank = 2;                   // O(log n): 1 lời gọi log-time, không vòng lặp
    else if (halvingSelf) rank = 2;               // O(log n)
    else rank = 1;                                // O(1)
  }

  // ── chặn mũ/giai thừa bị giấu dưới biên vòng lặp (ưu tiên cao nhất) ──
  if (hasExponentialBound || hasCombinatorialBlowup) rank = Math.max(rank, 7);

  // ── chồng yếu tố đệ quy (lấy max hạng — mũ luôn trội) ──
  if (rec === "exp") rank = Math.max(rank, 7);
  else if (rec === "divide") rank = Math.max(rank, 4);   // chia-để-trị có chia đôi → n log n
  else if (rec === "linear") rank = Math.max(rank, 3);   // đệ quy tuyến tính → n
  else if (rec === "log") rank = Math.max(rank, 2);      // chia đôi 1 nhánh → log n

  return { label: RANK_LABEL[rank], rank };
}

/** Bỏ comment + literal chuỗi/ký tự để không bị nhiễu khi tìm pattern. */
function stripNoise(code: string, lang: Lang): string {
  let s = code.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])*'/g, "''");
  if (lang === "python") {
    s = s.replace(/#[^\n]*/g, "").replace(/'''[\s\S]*?'''/g, "").replace(/"""[\s\S]*?"""/g, "");
  } else {
    s = s.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  }
  return s;
}

/**
 * Độ sâu vòng lặp lồng nhau cho C++/Java. Xử lý CẢ thân lệnh có { } LẪN thân
 * một-câu-lệnh không ngoặc (vd `for(...)for(...)for(...) c++;`). Bỏ qua dấu ; nằm
 * trong header `for(...;...;...)` bằng cách nhảy qua cặp ngoặc của header.
 */
function braceLoopDepth(s: string): number {
  const toks: string[] = [];
  const re = /\bfor\b|\bwhile\b|\bdo\b|[(){};]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) toks.push(m[0]);

  let depth = 0, max = 0, i = 0;
  const stack: ("loop-brace" | "loop-semi" | "block")[] = [];
  const closeSemis = () => { while (stack.length && stack[stack.length - 1] === "loop-semi") { stack.pop(); depth--; } };
  const skipParens = () => {
    if (toks[i] !== "(") return;
    let bal = 0;
    while (i < toks.length) {
      if (toks[i] === "(") bal++;
      else if (toks[i] === ")") { bal--; i++; if (bal === 0) return; continue; }
      i++;
    }
  };

  while (i < toks.length) {
    const t = toks[i];
    if (t === "for" || t === "while" || t === "do") {
      i++;
      if (t !== "do") skipParens();                 // bỏ qua header (...)
      depth++; if (depth > max) max = depth;
      if (toks[i] === "{") { stack.push("loop-brace"); i++; } // thân có ngoặc
      else stack.push("loop-semi");                 // thân một câu lệnh
      continue;
    }
    if (t === "{") { stack.push("block"); i++; continue; }
    if (t === "}") { if (stack.pop() === "loop-brace") depth--; closeSemis(); i++; continue; }
    if (t === ";") { closeSemis(); i++; continue; }
    i++; // "(" hoặc ")" ngoài header → bỏ qua
  }
  return max;
}

/** Độ sâu vòng lặp lồng nhau (Python) — theo thụt lề của for/while, CỘNG các
 *  mệnh đề `for` trong comprehension/generator nằm cùng một dòng. */
function pythonLoopDepth(s: string): number {
  const loopIndents: number[] = [];
  let max = 0;
  for (const raw of s.split("\n")) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^[ \t]*/)![0].replace(/\t/g, "    ").length;
    while (loopIndents.length && indent <= loopIndents[loopIndents.length - 1]) loopIndents.pop();

    const isStmtLoop = /^\s*(for|while)\b/.test(raw);
    if (isStmtLoop) loopIndents.push(indent);
    const stmtDepth = loopIndents.length;

    // Vòng lặp trong COMPREHENSION/generator cùng dòng:
    //   [..  for i in ..  for j in ..]  → mỗi mệnh đề `for` là một lớp lồng nhau.
    // Đếm số `for` trên dòng, trừ 1 nếu dòng mở đầu bằng `for` (for-câu-lệnh đã
    // được tính trong stmtDepth ở trên).
    const forCount = (raw.match(/\bfor\b/g) ?? []).length;
    const leadingFor = /^\s*for\b/.test(raw) ? 1 : 0;
    const compFor = Math.max(0, forCount - leadingFor);

    max = Math.max(max, stmtDepth + compFor);
  }
  return max;
}

/** Tách file thành các hàm con { name, body } để phân tích RIÊNG từng hàm —
 *  tránh việc đếm lời gọi/vòng lặp của hàm này bị lẫn với hàm khác. */
interface FnChunk { name: string; body: string; }
function splitFunctions(s: string, lang: Lang): FnChunk[] {
  const chunks: FnChunk[] = [];
  if (lang === "python") {
    const lines = s.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const m = /^(\s*)def\s+([A-Za-z_]\w*)\s*\(/.exec(lines[li]);
      if (!m) continue;
      const indent = m[1].replace(/\t/g, "    ").length;
      const bodyLines: string[] = [];
      let j = li + 1;
      for (; j < lines.length; j++) {
        if (!lines[j].trim()) { bodyLines.push(lines[j]); continue; }
        const ind = lines[j].match(/^[ \t]*/)![0].replace(/\t/g, "    ").length;
        if (ind <= indent) break;
        bodyLines.push(lines[j]);
      }
      chunks.push({ name: m[2], body: bodyLines.join("\n") });
    }
  } else {
    const ctrl = new Set(["if", "for", "while", "switch", "catch", "else"]);
    const sigRe = /\b([A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:const\s*)?\{/g;
    let m: RegExpExecArray | null;
    while ((m = sigRe.exec(s)) !== null) {
      if (ctrl.has(m[1])) continue;
      const braceStart = s.indexOf("{", m.index);
      if (braceStart === -1) continue;
      let bal = 0, k = braceStart;
      for (; k < s.length; k++) {
        if (s[k] === "{") bal++;
        else if (s[k] === "}") { bal--; if (bal === 0) break; }
      }
      chunks.push({ name: m[1], body: s.slice(braceStart + 1, k) });
    }
  }
  return chunks;
}

/** Nhận diện đệ quy: trả "none" | "linear" | "divide" | "exp" | "log". */
type RecKind = "none" | "linear" | "divide" | "exp" | "log";

/**
 * Phân tích đệ quy VÀ đồ thị gọi hàm (call graph) cùng lúc:
 *  • recKind: hạng đệ quy tệ nhất trong số các hàm tự gọi chính nó — đếm số
 *    lần tự gọi CHỈ TRONG THÂN HÀM ĐÓ (không tính lời gọi từ hàm khác/hàm
 *    main tới nó), tránh lỗi đếm sai khi hàm được gọi lại ở nơi khác.
 *  • interprocDepthBoost: khi một hàm A có vòng lặp (độ sâu ≥1) mà bên trong
 *    đó GỌI một hàm phụ B cũng có vòng lặp riêng (độ sâu ≥1) — độ phức tạp
 *    thật sự là depth(A) + depth(B), vì "bậc" của B bị GIẤU sau lời gọi hàm
 *    (vd vòng ngoài O(n) gọi hàm phụ O(n²) → tổng O(n³)).
 */
function recursionAndCallGraph(s: string, lang: Lang): { rec: RecKind; interprocDepthBoost: number } {
  const chunks = splitFunctions(s, lang);
  const loopDepthOf = (body: string) => (lang === "python" ? pythonLoopDepth(body) : braceLoopDepth(body));
  const depths = new Map<string, number>(chunks.map((c) => [c.name, loopDepthOf(c.body)]));

  let rec: RecKind = "none";
  let interprocDepthBoost = 0;

  for (const { name, body } of chunks) {
    // ── đệ quy: đếm số lần TỰ GỌI chỉ trong thân hàm này ──
    const selfCallRe = new RegExp(`\\b${name}\\s*\\(`, "g");
    const selfCalls = body.match(selfCallRe)?.length ?? 0;
    if (selfCalls > 0) {
      const halving = /(\/\s*2|\/\/\s*2|>>\s*1|\bmid\b|\(\s*[lr]\w*\s*\+\s*[lr]\w*\s*\)\s*\/\s*2)/.test(body);
      const k: RecKind = selfCalls >= 2 ? (halving ? "divide" : "exp") : (halving ? "log" : "linear");
      rec = worse(rec, k);
    }

    // ── liên hàm: hàm A có vòng lặp gọi hàm B cũng có vòng lặp ──
    const ownDepth = depths.get(name) ?? 0;
    if (ownDepth >= 1) {
      for (const [otherName, otherDepth] of depths) {
        if (otherName === name || otherDepth < 1) continue;
        const callsOther = new RegExp(`\\b${otherName}\\s*\\(`).test(body);
        if (callsOther) interprocDepthBoost = Math.max(interprocDepthBoost, ownDepth + otherDepth);
      }
    }
  }
  return { rec, interprocDepthBoost };
}

function worse(a: RecKind, b: RecKind): RecKind {
  const ord: RecKind[] = ["none", "log", "linear", "divide", "exp"];
  return ord.indexOf(b) > ord.indexOf(a) ? b : a;
}

/* ───────────────── Map lớp O(...) → % theo rubric tier ───────────────── */

const RANK_LABEL: Record<number, string> = {
  1: "O(1)", 2: "O(log n)", 3: "O(n)", 4: "O(n log n)", 5: "O(n²)", 6: "O(n³)", 7: "Chậm hơn O(n³)",
};

const DEFAULT_TIERS: RubricConfig["complexityTiers"] = [
  { label: "O(n)", maxPercent: 100 }, { label: "O(n log n)", maxPercent: 90 },
  { label: "O(n²)", maxPercent: 60 }, { label: "O(n³)", maxPercent: 30 }, { label: "Chậm hơn", maxPercent: 0 },
];

/** Quy nhãn tier về "hạng" độ phức tạp (nhỏ = nhanh hơn). */
export function rankOfLabel(label: string): number {
  const s = label.toLowerCase().replace(/\s+/g, "").replace(/²/g, "2").replace(/³/g, "3").replace(/\^/g, "");
  if (/2n|n!|exponential|giai\s*thua|mũ|chậm/.test(s)) return 7;
  if (/o\(1\)|hằng|constant/.test(s)) return 1;
  if (/nlogn|n\*logn|nlgn/.test(s)) return 4;
  if (/logn/.test(s)) return 2;
  if (/n3|n\*n\*n/.test(s)) return 6;
  if (/n2|n\*n/.test(s)) return 5;
  if (/o\(n\)/.test(s)) return 3;
  return 7;
}

/**
 * Lấy % của TIER TỐT NHẤT (maxPercent cao nhất) mà lời giải ĐẠT
 * (hạng lời giải ≤ hạng tier). VD: lời giải O(n²) (rank5),
 * tiers [O(n log n)=100, O(n²)=80, O(n³)=50] → 80.
 */
export function mapToTier(solutionRank: number, tiers: RubricConfig["complexityTiers"]): number {
  let best: number | null = null;
  for (const t of tiers) {
    const r = rankOfLabel(t.label);
    if (solutionRank <= r) best = best === null ? t.maxPercent : Math.max(best, t.maxPercent);
  }
  if (best !== null) return best;
  return tiers.length ? Math.min(...tiers.map((t) => t.maxPercent)) : 0;
}