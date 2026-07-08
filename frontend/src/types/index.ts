// ============================================================
//  Domain types — dùng chung cho cả app.
//  Đặt tên & cấu trúc bám sát schema DB (Supabase) sẽ làm sau.
// ============================================================

export type Role = "student" | "lecturer";

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  /** MSSV — chỉ có với sinh viên */
  studentCode?: string;
  avatarUrl?: string;
}

// ----- Lớp / Môn học -----------------------------------------

/** 1 = Học kỳ 1, 2 = Học kỳ 2, 3 = Học kỳ hè */
export type Semester = 1 | 2 | 3;

export interface Course {
  id: string;
  name: string;
  description: string;
  /** Năm học dạng "2025–2026" */
  academicYear: string;
  semester: Semester;
  /** Thời gian học — dùng để suy ra trạng thái đang học / đã xong */
  startDate: string;
  endDate: string;
  lecturerId: string;
  lecturerName: string;
  /** Mã đặc biệt để sinh viên vào lớp */
  joinCode: string;
  studentCount: number;
  createdAt: string;
}

// ----- Rubric & Testcase -------------------------------------

export interface ComplexityTier {
  /** Nhãn lớp độ phức tạp, vd "O(n)", "O(n log n)" */
  label: string;
  /** % điểm tối đa ứng với lớp này (0–100) */
  maxPercent: number;
}

export interface Rubric {
  /** Trọng số % của testcase (testcaseWeight + complexityWeight = 100) */
  testcaseWeight: number;
  /** Có chấm độ phức tạp không */
  complexityEnabled: boolean;
  /** Trọng số % độ phức tạp (0 khi tắt) */
  complexityWeight: number;
  /** Thang điểm theo lớp độ phức tạp */
  complexityTiers: ComplexityTier[];
  /** Có bật phát hiện gian lận không */
  plagiarismEnabled: boolean;
  /** Ngưỡng % giống nhau → coi là gian lận (gate: vượt ngưỡng = 0 điểm) */
  plagiarismThreshold: number;
}

export interface Testcase {
  id: string;
  input: string;
  expectedOutput: string;
  /** Testcase ẩn — không hiển thị cho sinh viên */
  hidden?: boolean;
}

// ----- Bài tập lớp -------------------------------------------

export type AssignmentSource = "text" | "pdf";

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  source: AssignmentSource;
  /** Đề bài dạng text (khi source = "text") */
  description?: string;
  /** Link PDF đề (khi source = "pdf") */
  pdfUrl?: string;
  /** Tên "mục" gom nhóm (vd "Tuần 1") */
  section?: string;
  deadline: string;
  rubric: Rubric;
  testcases: Testcase[];
  createdAt: string;
}

export interface Material {
  id: string;
  courseId: string;
  title: string;
  fileUrl: string;
  /** Tên \"mục\" gom nhóm */
  section?: string;
  uploadedAt: string;
}

// ----- Bài nộp & Điểm (bài tập lớp) --------------------------

export type SubmissionStatus = "submitted" | "grading" | "graded";

export interface GradeBreakdown {
  testcase: number; // 0–100
  complexity: number; // 0–100
  /** % giống nhau cao nhất phát hiện được */
  similarity: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  fileName: string;
  code: string;
  submittedAt: string;
  status: SubmissionStatus;
  /** Điểm cuối (0–10), undefined nếu chưa chấm */
  score?: number;
  breakdown?: GradeBreakdown;
  aiComment?: string;
  flaggedCheating?: boolean;
  /** Giảng viên đã chỉnh tay điểm/nhận xét */
  lecturerOverridden?: boolean;
  /** Đã push điểm — khóa, không sửa được nữa */
  published?: boolean;
}

// ----- Bài tập tự do (LeetCode-style) ------------------------

export type Difficulty = "easy" | "medium" | "hard";

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  /** Markdown mô tả đề */
  description: string;
  testcases: Testcase[];
  createdById: string;
  createdAt: string;
}

export interface ProblemSubmission {
  id: string;
  problemId: string;
  userId: string;
  language: string;
  code: string;
  submittedAt: string;
  score: number; // 0–10
  passedTests: number;
  totalTests: number;
  aiComment: string;
}
