import { create } from "zustand";
import { assignmentsApi, coursesApi, problemsApi } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Assignment, Course, Material, Problem } from "@/types";

function upsert<T extends { id: string }>(arr: T[], item: T): T[] {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...arr];
  const next = [...arr];
  next[i] = item;
  return next;
}

interface ContentState {
  courses: Course[];
  assignments: Assignment[];
  materials: Material[];
  problems: Problem[];

  loadCourses: () => Promise<void>;
  loadCourse: (id: string) => Promise<Course>;
  createCourse: (d: { name: string; description: string; academicYear: string; semester: number; startDate: string; endDate: string }) => Promise<Course>;
  joinCourse: (code: string) => Promise<Course>;

  loadProblems: () => Promise<void>;
  loadProblem: (id: string) => Promise<Problem>;
  createProblem: (p: Omit<Problem, "id" | "createdAt" | "createdById">) => Promise<Problem>;
  updateProblem: (id: string, patch: Partial<Problem>) => Promise<Problem>;

  loadAssignments: (courseId: string) => Promise<void>;
  loadAssignment: (id: string) => Promise<Assignment>;
  createAssignment: (a: Omit<Assignment, "id" | "createdAt">) => Promise<Assignment>;
  updateAssignment: (id: string, patch: Partial<Assignment>) => Promise<Assignment>;

  loadMaterials: (courseId: string) => Promise<void>;
  uploadMaterials: (courseId: string, files: File[], section?: string) => Promise<Material[]>;
}

export const useContent = create<ContentState>((set) => ({
  courses: [],
  assignments: [],
  materials: [],
  problems: [],

  loadCourses: async () => set({ courses: await coursesApi.list() }),
  loadCourse: async (id) => {
    const c = await coursesApi.get(id);
    set((st) => ({ courses: upsert(st.courses, c) }));
    return c;
  },
  createCourse: async (d) => {
    const c = await coursesApi.create(d);
    set((st) => ({ courses: [c, ...st.courses] }));
    return c;
  },
  joinCourse: async (code) => {
    const c = await coursesApi.join(code);
    set((st) => ({ courses: upsert(st.courses, c) }));
    return c;
  },

  loadProblems: async () => set({ problems: await problemsApi.list() }),
  loadProblem: async (id) => {
    const p = await problemsApi.get(id);
    set((st) => ({ problems: upsert(st.problems, p) }));
    return p;
  },
  createProblem: async (p) => {
    const created = await problemsApi.create(p);
    set((st) => ({ problems: [created, ...st.problems] }));
    toast.success("Đã đăng bài tập tự do.");
    return created;
  },
  updateProblem: async (id, patch) => {
    const updated = await problemsApi.update(id, patch);
    set((st) => ({ problems: upsert(st.problems, updated) }));
    toast.success("Đã lưu thay đổi bài tập.");
    return updated;
  },

  loadAssignments: async (courseId) => set({ assignments: await assignmentsApi.listByCourse(courseId) }),
  loadAssignment: async (id) => {
    const a = await assignmentsApi.get(id);
    set((st) => ({ assignments: upsert(st.assignments, a) }));
    return a;
  },
  createAssignment: async (a) => {
    const created = await assignmentsApi.create(a);
    set((st) => ({ assignments: [...st.assignments, created] }));
    toast.success("Đã đăng bài tập.");
    return created;
  },
  updateAssignment: async (id, patch) => {
    const updated = await assignmentsApi.update(id, patch);
    set((st) => ({ assignments: upsert(st.assignments, updated) }));
    toast.success("Đã lưu thay đổi đề bài.");
    return updated;
  },

  loadMaterials: async (courseId) => set({ materials: await assignmentsApi.listMaterials(courseId) }),
  uploadMaterials: async (courseId, files, section) => {
    const ms = await assignmentsApi.uploadMaterials(courseId, files, section);
    set((st) => ({ materials: [...ms, ...st.materials] }));
    toast.success(ms.length > 1 ? `Đã đăng ${ms.length} tài liệu.` : "Đã đăng tài liệu.");
    return ms;
  },
}));
