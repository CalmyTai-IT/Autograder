// Client gọi backend REST (Express). Token JWT lưu ở localStorage.
import type {
  Assignment, Course, Material, Problem, ProblemSubmission, Role, Submission, User,
} from "@/types";

const BASE = (import.meta.env as any).VITE_API_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "autograde_token";

/** Đổi URL file tương đối ("/uploads/..") thành URL tuyệt đối tới backend (cổng 4000),
 *  để mở/tải được từ frontend (cổng 5173). URL tuyệt đối thì giữ nguyên. */
export const fileHref = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = BASE.replace(/\/api\/?$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request<T>(path: string, opts: { method?: string; body?: any; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, { method: opts.method ?? "GET", headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? `Lỗi ${res.status}`);
  return data as T;
}

// ---- Auth ----
export const authApi = {
  register: (d: { fullName: string; email: string; password: string; role: Role; studentCode?: string }) =>
    request<{ message: string }>("/auth/register", { method: "POST", body: d }),
  verifyEmail: (email: string, code: string) =>
    request<{ message: string }>("/auth/verify-email", { method: "POST", body: { email, code } }),
  resendVerification: (email: string) =>
    request<{ message: string }>("/auth/resend-verification", { method: "POST", body: { email } }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body: { email, password } }),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<{ message: string }>("/auth/reset-password", { method: "POST", body: { email, code, newPassword } }),
  me: () => request<User>("/auth/me"),
  updateMe: (patch: { fullName?: string; avatarUrl?: string }) =>
    request<User>("/auth/me", { method: "PATCH", body: patch }),
};

// ---- Courses ----
export const coursesApi = {
  list: () => request<Course[]>("/courses"),
  get: (id: string) => request<Course>(`/courses/${id}`),
  create: (d: { name: string; description: string; academicYear: string; semester: number; startDate: string; endDate: string }) =>
    request<Course>("/courses", { method: "POST", body: d }),
  join: (code: string) => request<Course>("/courses/join", { method: "POST", body: { code } }),
  members: (id: string) => request<{ lecturer: User | null; students: User[] }>(`/courses/${id}/members`),
};

// ---- Assignments + Materials ----
export const assignmentsApi = {
  listByCourse: (courseId: string) => request<Assignment[]>(`/assignments/course/${courseId}`),
  get: (id: string) => request<Assignment>(`/assignments/${id}`),
  create: (d: Omit<Assignment, "id" | "createdAt">) => request<Assignment>("/assignments", { method: "POST", body: d }),
  update: (id: string, patch: Partial<Assignment>) => request<Assignment>(`/assignments/${id}`, { method: "PATCH", body: patch }),
  listMaterials: (courseId: string) => request<Material[]>(`/assignments/course/${courseId}/materials`),
  uploadMaterial: (courseId: string, file: File) => {
    const form = new FormData();
    form.append("files", file);
    return request<Material[]>(`/assignments/course/${courseId}/materials`, { method: "POST", form });
  },
  uploadMaterials: (courseId: string, files: File[], section?: string) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (section) form.append("section", section);
    return request<Material[]>(`/assignments/course/${courseId}/materials`, { method: "POST", form });
  },
  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string; name: string }>(`/assignments/upload`, { method: "POST", form });
  },
  run: (id: string, d: { language: string; code: string; cases: { input: string; expectedOutput?: string }[] }) =>
    request<{
      compileError: boolean; errorSummary?: string;
      cases: { index: number; input: string; expected?: string; actual: string; stderr?: string; status: string }[];
    }>(`/assignments/${id}/run`, { method: "POST", body: d }),
};

// ---- Submissions ----
export const submissionsApi = {
  mine: (assignmentId: string) => request<Submission | null>(`/submissions/assignment/${assignmentId}/mine`),
  listForAssignment: (assignmentId: string) => request<Submission[]>(`/submissions/assignment/${assignmentId}`),
  submit: (assignmentId: string, d: { fileName: string; code: string; file?: File }) => {
    const form = new FormData();
    form.append("fileName", d.fileName);
    form.append("code", d.code);
    if (d.file) form.append("file", d.file);
    return request<Submission>(`/submissions/assignment/${assignmentId}`, { method: "POST", form });
  },
  grade: (id: string, patch: { score?: number; aiComment?: string }) =>
    request<Submission>(`/submissions/${id}/grade`, { method: "PATCH", body: patch }),
  publish: (assignmentId: string) =>
    request<{ message: string }>(`/submissions/assignment/${assignmentId}/publish`, { method: "POST" }),
  finalize: (assignmentId: string) =>
    request<{ message: string; zeroed: number }>(`/submissions/assignment/${assignmentId}/finalize`, { method: "POST" }),
  gradebook: (courseId: string) =>
    request<{
      students: User[];
      assignments: { id: string; title: string }[];
      scores: { assignmentId: string; studentId: string; score: number | null }[];
    }>(`/submissions/course/${courseId}/gradebook`),
};

// ---- Problems ----
export const problemsApi = {
  list: () => request<Problem[]>("/problems"),
  get: (id: string) => request<Problem>(`/problems/${id}`),
  create: (d: Omit<Problem, "id" | "createdAt" | "createdById">) => request<Problem>("/problems", { method: "POST", body: d }),
  update: (id: string, patch: Partial<Problem>) => request<Problem>(`/problems/${id}`, { method: "PATCH", body: patch }),
  mySubmissions: (problemId: string) => request<ProblemSubmission[]>(`/problems/${problemId}/submissions/mine`),
  allMySubmissions: () => request<ProblemSubmission[]>(`/problems/submissions/mine`),
  submit: (problemId: string, d: { language: string; code: string }) =>
    request<ProblemSubmission>(`/problems/${problemId}/submissions`, { method: "POST", body: d }),
  run: (problemId: string, d: { language: string; code: string; cases: { input: string; expectedOutput?: string }[] }) =>
    request<{
      compileError: boolean;
      errorSummary?: string;
      cases: { index: number; input: string; expected?: string; actual: string; stderr?: string; status: string }[];
    }>(`/problems/${problemId}/run`, { method: "POST", body: d }),
};

// ---- Grading triggers ----
export const gradingApi = {
  gradeAssignment: (assignmentId: string) => request<unknown>(`/grading/assignment/${assignmentId}`, { method: "POST" }),
  gradeProblem: (submissionId: string) => request<unknown>(`/grading/problem-submission/${submissionId}`, { method: "POST" }),
};

export const api = {
  auth: authApi, courses: coursesApi, assignments: assignmentsApi,
  submissions: submissionsApi, problems: problemsApi, grading: gradingApi,
  getToken, setToken, clearToken,
};
export default api;
