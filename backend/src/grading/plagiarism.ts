// MÔ ĐUN 4 — GIAN LẬN: so bài hiện tại với từng bài peer, lấy độ giống CAO NHẤT.
// Phương pháp (KHÔNG gọi API): chuẩn hoá token + k-gram + winnowing fingerprint, rồi
// đo độ trùng bằng "containment" (overlap / min) — bền với việc đổi tên biến, format lại,
// thêm/bớt comment, đảo thứ tự nhỏ. Vượt ngưỡng rubric → pipeline coi là gian lận (0 điểm, GATE).
import type { GradeInput } from "./types";
import { resolveLang, type Lang } from "./sandbox";

const K = 5;       // độ dài k-gram (số token)
const W = 4;       // cửa sổ winnowing

const KEYWORDS: Record<Lang, Set<string>> = {
  python: new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield print range len".split(" ")),
  cpp: new Set("alignas alignof and asm auto bool break case catch char class const constexpr continue decltype default delete do double else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator or private protected public register return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while cout cin endl vector string pair map set sort push_back".split(" ")),
  java: new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null String System out println length".split(" ")),
};

/** Bỏ comment + literal chuỗi/ký tự để không bị nhiễu. */
function stripNoise(code: string, lang: Lang): string {
  let s = code;
  s = s.replace(/"(?:\\.|[^"\\])*"/g, '"S"').replace(/'(?:\\.|[^'\\])*'/g, "'S'");
  if (lang === "python") {
    s = s.replace(/#[^\n]*/g, " ");
    s = s.replace(/'''[\s\S]*?'''/g, " ").replace(/"""[\s\S]*?"""/g, " ");
  } else {
    s = s.replace(/\/\/[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  }
  return s;
}

/** Chuỗi token chuẩn hoá: keyword giữ nguyên, định danh → "ID", số → "NUM", toán tử giữ. */
function tokenize(code: string, lang: Lang): string[] {
  const clean = stripNoise(code, lang);
  const kw = KEYWORDS[lang];
  const tokens: string[] = [];
  const re = /[A-Za-z_]\w*|\d+(?:\.\d+)?|==|!=|<=|>=|->|\+\+|--|&&|\|\||::|[+\-*/%=<>!&|^~?:;,.\[\]{}()]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const t = m[0];
    if (/^[A-Za-z_]\w*$/.test(t)) tokens.push(kw.has(t) ? t : "ID");
    else if (/^\d/.test(t)) tokens.push("NUM");
    else tokens.push(t);
  }
  return tokens;
}

/** Hash 32-bit cho 1 k-gram (FNV-1a). */
function hashGram(gram: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < gram.length; i++) {
    h ^= gram.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Tập fingerprint của 1 bài (winnowing). */
export function fingerprint(code: string, lang: Lang): Set<number> {
  const toks = tokenize(code, lang);
  if (toks.length < K) return new Set(toks.length ? [hashGram(toks.join(" "))] : []);
  const hashes: number[] = [];
  for (let i = 0; i + K <= toks.length; i++) hashes.push(hashGram(toks.slice(i, i + K).join(" ")));

  const fps = new Set<number>();
  if (hashes.length <= W) { hashes.forEach((h) => fps.add(h)); return fps; }
  let minPos = -1;
  for (let i = 0; i + W <= hashes.length; i++) {
    if (minPos < i) {
      minPos = i;
      for (let j = i + 1; j < i + W; j++) if (hashes[j] <= hashes[minPos]) minPos = j;
      fps.add(hashes[minPos]);
    } else {
      const last = i + W - 1;
      if (hashes[last] <= hashes[minPos]) { minPos = last; fps.add(hashes[minPos]); }
    }
  }
  return fps;
}

/** Độ giống 0..1 = overlap / min(|A|,|B|) (containment). */
function containment(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let overlap = 0;
  for (const h of small) if (big.has(h)) overlap++;
  return overlap / small.size;
}

export async function detectPlagiarism(input: GradeInput): Promise<{ similarityPct: number; matchedId?: string }> {
  const peers = input.peers ?? [];
  if (peers.length === 0 || !(input.code ?? "").trim()) return { similarityPct: 0 };

  const myLang = resolveLang(input);
  const mine = fingerprint(input.code, myLang);

  let best = 0;
  let matchedId: string | undefined;
  for (const p of peers) {
    if (!(p.code ?? "").trim()) continue;
    const pLang = resolveLang({ language: p.language, code: p.code });
    const sim = containment(mine, fingerprint(p.code, pLang));
    if (sim > best) { best = sim; matchedId = p.id; }
  }
  return { similarityPct: Math.round(best * 10000) / 100, matchedId };
}
