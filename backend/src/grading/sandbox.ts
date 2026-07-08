// SANDBOX dùng chung cho module 1 (testcase). Biên dịch + chạy code Python / C++ / Java
// trong thư mục tạm, có giới hạn thời gian & bộ nhớ. KHÔNG phụ thuộc thư viện ngoài.
//
// ✅ ĐA NỀN TẢNG (Windows / macOS / Linux): spawn trực tiếp trình biên dịch/thông dịch,
//    KHÔNG qua `bash -c` (tránh lỗi WSL trên Windows). Trên Linux/macOS vẫn áp giới hạn
//    RAM bằng `ulimit` (bọc trong bash); trên Windows chỉ dựa vào timeout + -Xmx (Java).
//
// ⚠️ An toàn: đây là sandbox "nhẹ" (process tách + timeout + ulimit), đủ cho đồ án/môi
//    trường tin cậy. Khi triển khai thật nên chạy trong Docker/nsjail — chỉ cần đổi phần
//    spawn ở `platformSpawn` bên dưới.
import { spawn, spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { config } from "../config";
import type { GradeInput } from "./types";

export type Lang = "python" | "cpp" | "java";
const IS_WIN = process.platform === "win32";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  spawnError?: string;
}

export interface Prepared {
  ok: boolean;
  error?: string;     // lỗi biên dịch / cú pháp (khi ok = false)
  dir: string;
  lang: Lang;
  cmd: string;        // lệnh chạy chương trình
  args: string[];     // tham số
  memMb: number;      // 0 = không áp ulimit (vd Java dùng -Xmx)
  cleanup: () => void;
}

/* ───────────────────────── Dò lệnh Python ───────────────────────── */
// Windows thường là `python`/`py`; Linux/macOS là `python3`. Dò 1 lần rồi cache.
let cachedPython: string | null = null;
/** Kiểm tra ứng viên CÓ PHẢI Python thật không: phải exit 0 và in ra "Python 3".
 *  (Trên Windows, alias giả trong WindowsApps vẫn spawn được nhưng in "Python was
 *   not found..." và exit khác 0 → phải loại bỏ.) */
function isRealPython(cmd: string): boolean {
  try {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    return !r.error && r.status === 0 && /Python\s+3/i.test(`${r.stdout ?? ""}${r.stderr ?? ""}`);
  } catch { return false; }
}
function pythonCmd(): string {
  if (cachedPython) return cachedPython;
  const candidates = [process.env.PYTHON_CMD, "python3", "python", "py"].filter(Boolean) as string[];
  for (const c of candidates) if (isRealPython(c)) { cachedPython = c; return c; }
  cachedPython = process.env.PYTHON_CMD || "python3"; // không tìm thấy → để báo lỗi rõ khi chạy
  return cachedPython;
}

/* ───────────────────────── Đoán ngôn ngữ ───────────────────────── */

export function normalizeLang(raw?: string): Lang | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (/(^|[^a-z])(py|python)/.test(s)) return "python";
  if (/(c\+\+|cpp|cxx|cc)/.test(s) || s === "c") return "cpp";
  if (/java/.test(s)) return "java";
  return undefined;
}
function langFromFileName(fileName?: string): Lang | undefined {
  if (!fileName) return undefined;
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".py") return "python";
  if ([".cpp", ".cc", ".cxx", ".c", ".hpp", ".h"].includes(ext)) return "cpp";
  if (ext === ".java") return "java";
  return undefined;
}
function langFromCode(code: string): Lang {
  if (/\b(#include|std::|using namespace|cout\s*<<|int\s+main\s*\()/.test(code)) return "cpp";
  if (/\b(public\s+class|System\.out|import\s+java\.|void\s+main\s*\(\s*String)/.test(code)) return "java";
  if (/\b(def\s+\w+\s*\(|print\s*\(|import\s+\w+|elif\b|:\s*$)/m.test(code)) return "python";
  return "python";
}
/** Thứ tự ưu tiên: language khai báo → đuôi file → suy từ nội dung code. */
export function resolveLang(input: Pick<GradeInput, "language" | "fileName" | "code">): Lang {
  return normalizeLang(input.language) ?? langFromFileName(input.fileName) ?? langFromCode(input.code ?? "");
}

/* ───────────────────────── Spawn cấp thấp (đa nền tảng) ───────────────────────── */

/** Trên Linux/macOS: bọc bash để áp ulimit RAM. Trên Windows: chạy trực tiếp. */
function platformSpawn(cmd: string, args: string[], memMb: number): { file: string; argv: string[] } {
  if (!IS_WIN && memMb > 0) {
    return { file: "bash", argv: ["-c", `ulimit -v ${memMb * 1024} 2>/dev/null; exec "$0" "$@"`, cmd, ...args] };
  }
  return { file: cmd, argv: args };
}

function spawnOnce(cmd: string, args: string[], cwd: string, input: string | null, timeoutMs: number, memMb: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const { file, argv } = platformSpawn(cmd, args, memMb);
    const child = spawn(file, argv, { cwd, windowsHide: true });
    const cap = config.sandbox.maxOutputBytes;
    let out = "", err = "", timedOut = false;

    const timer = setTimeout(() => { timedOut = true; try { child.kill("SIGKILL"); } catch { /* ignore */ } }, timeoutMs);
    child.stdout.on("data", (d) => { if (out.length < cap) out += d.toString(); });
    child.stderr.on("data", (d) => { if (err.length < cap) err += d.toString(); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ stdout: out, stderr: err, exitCode: null, timedOut, durationMs: Date.now() - started, spawnError: String(e) }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ stdout: out, stderr: err, exitCode: code, timedOut, durationMs: Date.now() - started }); });

    if (input != null) { child.stdin.on("error", () => { /* nuốt EPIPE */ }); child.stdin.write(input); child.stdin.end(); }
    else child.stdin.end();
  });
}

/* ───────────────────────── Biên dịch ───────────────────────── */

function detectJavaClass(code: string): string {
  const pub = code.match(/public\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)/);
  if (pub) return pub[1];
  const any = code.match(/\bclass\s+([A-Za-z_]\w*)/);
  return any ? any[1] : "Main";
}

/** Ghi source ra thư mục tạm và biên dịch (nếu cần). Trả về cách chạy. */
export async function compileSource(lang: Lang, code: string): Promise<Prepared> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ag-"));
  const cleanup = () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } };
  const memMb = config.sandbox.memoryMb;
  const ct = config.sandbox.compileTimeoutMs;
  const fail = (error: string): Prepared => ({ ok: false, error: error.trim(), dir, lang, cmd: "", args: [], memMb: 0, cleanup });

  try {
    if (lang === "python") {
      const py = pythonCmd();
      writeFileSync(path.join(dir, "main.py"), code);
      const chk = await spawnOnce(py, ["-m", "py_compile", "main.py"], dir, null, ct, 0);
      if (chk.spawnError) return fail(`Không chạy được '${py}'. Hãy cài Python và thêm vào PATH (Windows: tải ở python.org, tick "Add to PATH"). Chi tiết: ${chk.spawnError}`);
      if (chk.exitCode !== 0) return fail(chk.stderr || chk.stdout || "Lỗi cú pháp Python");
      return { ok: true, dir, lang, cmd: py, args: ["main.py"], memMb, cleanup };
    }

    if (lang === "cpp") {
      const bin = IS_WIN ? "main.exe" : "main";
      writeFileSync(path.join(dir, "main.cpp"), code);
      const comp = await spawnOnce("g++", ["-O2", "-std=c++17", "-pipe", "-w", "-o", bin, "main.cpp"], dir, null, ct, 0);
      if (comp.spawnError) return fail(`Không chạy được 'g++'. Hãy cài trình biên dịch C++ (Windows: MinGW-w64 hoặc dùng WSL; Ubuntu: sudo apt install build-essential). Chi tiết: ${comp.spawnError}`);
      if (comp.exitCode !== 0) return fail(comp.stderr || "Lỗi biên dịch C++");
      return { ok: true, dir, lang, cmd: path.join(dir, bin), args: [], memMb, cleanup };
    }

    // java
    const cls = detectJavaClass(code);
    writeFileSync(path.join(dir, `${cls}.java`), code);
    const comp = await spawnOnce("javac", [`${cls}.java`], dir, null, ct, 0);
    if (comp.spawnError) return fail(`Không chạy được 'javac'. Hãy cài JDK 17+ và thêm vào PATH. Chi tiết: ${comp.spawnError}`);
    if (comp.exitCode !== 0) return fail(comp.stderr || "Lỗi biên dịch Java");
    // JVM cấp phát virtual memory rất lớn → KHÔNG dùng ulimit -v, dùng -Xmx để giới hạn heap.
    return { ok: true, dir, lang, cmd: "java", args: [`-Xmx${memMb}m`, "-XX:-UsePerfData", "-cp", dir, cls], memMb: 0, cleanup };
  } catch (e) {
    return fail(String(e));
  }
}

/** Chạy 1 lần với 1 đầu vào (stdin). Dùng lại `prepared` cho mọi testcase. */
export async function runPrepared(prepared: Prepared, input: string, timeoutMs?: number): Promise<RunResult> {
  if (!prepared.ok) return { stdout: "", stderr: prepared.error ?? "", exitCode: null, timedOut: false, durationMs: 0 };
  return spawnOnce(prepared.cmd, prepared.args, prepared.dir, input, timeoutMs ?? config.sandbox.runTimeoutMs, prepared.memMb);
}

/* ───────────────────────── So khớp output ───────────────────────── */

/** Chuẩn hoá để so output: bỏ \r, cắt khoảng trắng cuối dòng & dòng trống cuối. */
export function normalizeOutput(s: string): string {
  return (s ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/g, "")).join("\n").replace(/\n+$/g, "").trim();
}

/** Tách thành dãy "token" sau khi coi ngoặc [] () {} và dấu phẩy như khoảng trắng.
 *  Giúp "[1, 2, 3]" (Python in mảng) ~ "1 2 3" (testcase). */
function looseTokens(s: string): string[] {
  return (s ?? "").replace(/[[\](){}]/g, " ").replace(/,/g, " ").split(/\s+/).filter(Boolean);
}
/** So 2 dãy token; token số thì so theo GIÁ TRỊ (vd "1.0" == "1"), còn lại so chuỗi. */
function tokensEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const x = Number(a[i]), y = Number(b[i]);
    if (Number.isFinite(x) && Number.isFinite(y) && x === y) continue;
    return false;
  }
  return true;
}

export function outputsEqual(actual: string, expected: string): boolean {
  // 1) So khớp CHẶT trước (giữ nguyên hành vi cũ — không gây sai cho bài cần chính xác).
  if (normalizeOutput(actual) === normalizeOutput(expected)) return true;
  // 2) DỰ PHÒNG linh hoạt: bỏ qua ngoặc/dấu phẩy/khoảng trắng & xuống dòng → so theo token.
  //    Chỉ kích hoạt khi (1) đã trượt, nên không phá vỡ các so khớp chính xác.
  return tokensEqual(looseTokens(actual), looseTokens(expected));
}
