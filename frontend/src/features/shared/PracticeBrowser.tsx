import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ProblemRow, type ProblemStatus } from "./problem-bits";
import type { Difficulty, Problem } from "@/types";

export interface ProblemProgress {
  status: ProblemStatus;
  bestScore?: number;
}

const DIFFS: { value: Difficulty | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "easy", label: "Dễ" },
  { value: "medium", label: "Trung bình" },
  { value: "hard", label: "Khó" },
];

export function PracticeBrowser({
  problems,
  onOpen,
  progress,
}: {
  problems: Problem[];
  onOpen: (id: string) => void;
  /** Nếu có: hiện trạng thái đã giải + thanh tiến độ (phía sinh viên) */
  progress?: Record<string, ProblemProgress>;
}) {
  const [query, setQuery] = useState("");
  const [diff, setDiff] = useState<Difficulty | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter(
      (p) =>
        (diff === "all" || p.difficulty === diff) &&
        (q === "" || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    );
  }, [problems, query, diff]);

  const solved = progress ? Object.values(progress).filter((p) => p.status === "solved").length : 0;
  const pct = problems.length ? Math.round((solved / problems.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Tiến độ (chỉ phía sinh viên) */}
      {progress && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Tiến độ luyện tập</span>
            <span className="text-muted-foreground">
              Đã giải <span className="data text-foreground">{solved}</span>/
              <span className="data">{problems.length}</span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Tìm kiếm + lọc độ khó */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm bài tập theo tên…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1">
          {DIFFS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDiff(d.value)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                diff === d.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Search />} title="Không tìm thấy bài tập" description="Thử từ khóa khác hoặc đổi bộ lọc độ khó." />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <ProblemRow
              key={p.id}
              problem={p}
              onOpen={() => onOpen(p.id)}
              status={progress?.[p.id]?.status ?? "todo"}
              bestScore={progress?.[p.id]?.bestScore}
            />
          ))}
        </div>
      )}
    </div>
  );
}
