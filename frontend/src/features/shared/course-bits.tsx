import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { courseStatus, groupByTerm, semesterLabel, statusLabel, type CourseStatus } from "@/lib/term";
import type { Course } from "@/types";

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const variant = status === "active" ? "success" : status === "upcoming" ? "warning" : "secondary";
  return <Badge variant={variant}>{statusLabel[status]}</Badge>;
}

type Filter = "all" | "active" | "completed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Đang học" },
  { value: "completed", label: "Đã hoàn thành" },
];

export function CourseTermGroups({
  courses,
  renderCard,
  emptyAll,
}: {
  courses: Course[];
  renderCard: (course: Course) => ReactNode;
  emptyAll?: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    let active = 0;
    let completed = 0;
    for (const c of courses) {
      const s = courseStatus(c);
      if (s === "active") active++;
      else if (s === "completed") completed++;
    }
    return { all: courses.length, active, completed };
  }, [courses]);

  const filtered = useMemo(() => {
    if (filter === "all") return courses;
    return courses.filter((c) => {
      const s = courseStatus(c);
      return filter === "active" ? s === "active" : s === "completed";
    });
  }, [courses, filter]);

  const groups = useMemo(() => groupByTerm(filtered), [filtered]);

  if (courses.length === 0) return <>{emptyAll}</>;

  return (
    <div className="space-y-6">
      {/* Bộ lọc trạng thái */}
      <div className="inline-flex rounded-lg border bg-card p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
            <span className={cn("data ml-1.5 text-xs", filter === f.value ? "opacity-80" : "opacity-60")}>
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          Không có lớp nào ở mục này.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.academicYear} className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">
                Năm học <span className="data">{g.academicYear}</span>
              </h3>
              <span className="h-px flex-1 bg-border" />
            </div>

            {g.semesters.map((s) => (
              <div key={s.semester} className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">{semesterLabel(s.semester)}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {s.courses.map((c) => (
                    <div key={c.id}>{renderCard(c)}</div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
