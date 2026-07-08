import type { Course, Semester } from "@/types";

export type CourseStatus = "active" | "completed" | "upcoming";

export const SEMESTERS: Semester[] = [1, 2, 3];

export function semesterLabel(s: Semester) {
  return s === 1 ? "Học kỳ 1" : s === 2 ? "Học kỳ 2" : "Học kỳ hè";
}

export function semesterShort(s: Semester) {
  return s === 1 ? "HK1" : s === 2 ? "HK2" : "HK hè";
}

/** Trạng thái lớp suy từ thời gian học so với hôm nay */
export function courseStatus(c: Pick<Course, "startDate" | "endDate">): CourseStatus {
  const now = Date.now();
  if (now < +new Date(c.startDate)) return "upcoming";
  if (now > +new Date(c.endDate)) return "completed";
  return "active";
}

export const statusLabel: Record<CourseStatus, string> = {
  active: "Đang học",
  completed: "Đã hoàn thành",
  upcoming: "Sắp diễn ra",
};

/** Tự suy khoảng thời gian từ năm học + học kỳ (khi giảng viên tạo lớp) */
export function termRange(academicYear: string, semester: Semester): { start: string; end: string } {
  const parts = academicYear.split(/[–-]/).map((s) => parseInt(s.trim(), 10));
  const y1 = parts[0];
  const y2 = parts[1] ?? y1 + 1;
  const mk = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();
  if (semester === 1) return { start: mk(y1, 9, 1), end: mk(y2, 1, 15) };
  if (semester === 2) return { start: mk(y2, 2, 1), end: mk(y2, 6, 30) };
  return { start: mk(y2, 7, 1), end: mk(y2, 8, 15) };
}

/** Năm học hiện tại theo hôm nay, vd "2025–2026" */
export function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  // Năm học mới bắt đầu khoảng tháng 9
  const start = now.getMonth() >= 8 ? y : y - 1;
  return `${start}–${start + 1}`;
}

interface TermGroup {
  academicYear: string;
  semesters: { semester: Semester; courses: Course[] }[];
}

/** Nhóm lớp theo năm học (mới nhất trước) rồi theo học kỳ */
export function groupByTerm(courses: Course[]): TermGroup[] {
  const years = new Map<string, Map<Semester, Course[]>>();
  for (const c of courses) {
    if (!years.has(c.academicYear)) years.set(c.academicYear, new Map());
    const sem = years.get(c.academicYear)!;
    if (!sem.has(c.semester)) sem.set(c.semester, []);
    sem.get(c.semester)!.push(c);
  }
  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([academicYear, sem]) => ({
      academicYear,
      semesters: [...sem.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([semester, list]) => ({ semester, courses: list })),
    }));
}
