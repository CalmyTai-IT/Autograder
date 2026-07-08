import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import type { Difficulty, Problem } from "@/types";

export type ProblemStatus = "solved" | "attempted" | "todo";

const diffMap: Record<Difficulty, { label: string; cls: string }> = {
  easy: { label: "Dễ", cls: "bg-success/12 text-success" },
  medium: { label: "Trung bình", cls: "bg-warning/15 text-warning-foreground" },
  hard: { label: "Khó", cls: "bg-destructive/12 text-destructive" },
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const d = diffMap[difficulty];
  return <Badge className={cn("border-transparent", d.cls)}>{d.label}</Badge>;
}

function StatusIcon({ status }: { status: ProblemStatus }) {
  if (status === "solved")
    return <CheckCircle2 className="size-5 text-success" aria-label="Đã giải" />;
  if (status === "attempted")
    return <CircleDashed className="size-5 text-warning" aria-label="Đang làm" />;
  return <CircleDashed className="size-5 text-muted-foreground/40" aria-label="Chưa làm" />;
}

export function ProblemRow({
  problem,
  onOpen,
  status = "todo",
  bestScore,
}: {
  problem: Problem;
  onOpen: () => void;
  status?: ProblemStatus;
  bestScore?: number;
}) {
  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent/40"
    >
      <StatusIcon status={status} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{problem.title}</p>
        <p className="truncate text-sm text-muted-foreground">{problem.description}</p>
      </div>
      {bestScore !== undefined && (
        <span className="data hidden shrink-0 text-sm text-muted-foreground sm:inline">{bestScore}/10</span>
      )}
      <DifficultyBadge difficulty={problem.difficulty} />
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
