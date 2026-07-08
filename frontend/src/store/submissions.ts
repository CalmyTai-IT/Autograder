import { create } from "zustand";
import { gradingApi, problemsApi, submissionsApi } from "@/lib/api";
import type { ProblemSubmission, Submission } from "@/types";

function upsert<T extends { id: string }>(arr: T[], item: T): T[] {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [...arr, item];
  const next = [...arr];
  next[i] = item;
  return next;
}

interface SubmissionsState {
  classSubs: Submission[];
  problemSubs: ProblemSubmission[];

  loadMine: (assignmentId: string) => Promise<Submission | null>;
  loadForAssignment: (assignmentId: string) => Promise<void>;
  getClassSub: (assignmentId: string, userId: string) => Submission | undefined;
  submitAssignment: (input: { assignmentId: string; fileName: string; code: string; file?: File }) => Promise<Submission>;
  overrideGrade: (id: string, patch: { score?: number; aiComment?: string }) => Promise<void>;
  publishAssignment: (assignmentId: string) => Promise<void>;
  finalizeAssignment: (assignmentId: string) => Promise<number>;

  loadProblemSubs: (problemId: string) => Promise<void>;
  loadAllProblemSubs: () => Promise<void>;
  getProblemSubs: (problemId: string) => ProblemSubmission[];
  submitProblem: (input: { problemId: string; language: string; code: string }) => Promise<ProblemSubmission>;
}

export const useSubmissions = create<SubmissionsState>((set, get) => ({
  classSubs: [],
  problemSubs: [],

  loadMine: async (assignmentId) => {
    const sub = await submissionsApi.mine(assignmentId);
    if (sub) set((st) => ({ classSubs: upsert(st.classSubs, sub) }));
    return sub;
  },
  loadForAssignment: async (assignmentId) => {
    set({ classSubs: await submissionsApi.listForAssignment(assignmentId) });
  },
  getClassSub: (assignmentId, userId) =>
    get().classSubs.find((s) => s.assignmentId === assignmentId && s.studentId === userId),

  submitAssignment: async ({ assignmentId, fileName, code, file }) => {
    const sub = await submissionsApi.submit(assignmentId, { fileName, code, file });
    set((st) => ({ classSubs: upsert(st.classSubs, sub) }));
    return sub;
  },
  overrideGrade: async (id, patch) => {
    const updated = await submissionsApi.grade(id, patch);
    set((st) => ({ classSubs: upsert(st.classSubs, updated) }));
  },
  publishAssignment: async (assignmentId) => {
    await submissionsApi.publish(assignmentId);
    set((st) => ({
      classSubs: st.classSubs.map((s) => (s.assignmentId === assignmentId ? { ...s, published: true } : s)),
    }));
  },
  finalizeAssignment: async (assignmentId) => {
    const r = await submissionsApi.finalize(assignmentId);
    const fresh = await submissionsApi.listForAssignment(assignmentId);
    set((st) => ({
      classSubs: [...st.classSubs.filter((s) => s.assignmentId !== assignmentId), ...fresh],
    }));
    return r.zeroed;
  },

  loadProblemSubs: async (problemId) => {
    const fresh = await problemsApi.mySubmissions(problemId);
    set((st) => ({ problemSubs: [...st.problemSubs.filter((s) => s.problemId !== problemId), ...fresh] }));
  },
  loadAllProblemSubs: async () => {
    set({ problemSubs: await problemsApi.allMySubmissions() });
  },
  getProblemSubs: (problemId) => get().problemSubs.filter((s) => s.problemId === problemId),
  submitProblem: async ({ problemId, language, code }) => {
    const created = await problemsApi.submit(problemId, { language, code });
    // Kích hoạt chấm ngay (bỏ qua lỗi nếu mô hình chưa cài)
    try {
      await gradingApi.gradeProblem(created.id);
    } catch { /* mô hình chấm chưa cài — giữ bản nộp chưa chấm */ }
    const fresh = await problemsApi.mySubmissions(problemId);
    set((st) => ({ problemSubs: [...st.problemSubs.filter((s) => s.problemId !== problemId), ...fresh] }));
    return created;
  },
}));
