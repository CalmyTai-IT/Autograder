// Kiểu dùng chung cho MÔ HÌNH CHẤM (5 mô đun). Đã hiện thực ở các file cùng thư mục.

export type GradeMode = "assignment" | "practice"; // bài nộp deadline | bài tự do

export interface RubricConfig {
  testcaseWeight: number;
  complexityEnabled: boolean;
  complexityWeight: number;
  complexityTiers: { label: string; maxPercent: number }[];
  plagiarismEnabled: boolean;
  plagiarismThreshold: number;   // ngưỡng % giống nhau (GATE — không cộng điểm)
}

export interface TestcaseIO { input: string; expectedOutput: string; hidden?: boolean; }

export interface GradeInput {
  submissionId: string;
  code: string;
  language?: string;                       // "python" | "cpp" | "java" (chuẩn hoá ở sandbox)
  fileName?: string;                       // dùng để đoán ngôn ngữ khi language trống
  testcases: TestcaseIO[];
  rubric?: RubricConfig;                   // có → bài deadline; trống → dùng rubric mặc định cho bài tự do
  peers?: { id: string; code: string; language?: string }[];
  mode?: GradeMode;
}

export interface CriteriaResult {
  passedTests: number; totalTests: number; testcasePct: number;
  similarityPct: number; matchedId?: string;
  complexityClass?: string; complexityPct?: number;
  stylePct?: number;
}

export interface GradeResult { score: number; aiComment: string; flaggedCheating: boolean; criteria: CriteriaResult; }

// ── Kết quả chi tiết của mô đun testcase (rộng hơn để pipeline rẽ nhánh) ──
export type TestStatus = "pass" | "wrong" | "runtime_error" | "timeout";
export interface TestcaseRunResult {
  passedTests: number;
  totalTests: number;
  testcasePct: number;
  compileError: boolean;       // không biên dịch được / lỗi cú pháp
  fatal: boolean;              // compileError HOẶC mọi testcase đều crash/timeout → đi nhánh "tìm lỗi"
  errorSummary?: string;       // thông điệp lỗi đầu tiên (đưa vào prompt tìm lỗi của module style)
  perTest: { index: number; status: TestStatus; hidden?: boolean }[];
}

// ── Tuỳ chọn cho module style (Gemini) ──
export interface StyleOptions {
  mode: GradeMode;
  purpose: "review" | "debug";   // chấm phong cách | tìm lỗi & hướng dẫn
  errorSummary?: string;         // chỉ dùng khi purpose = "debug"
}
