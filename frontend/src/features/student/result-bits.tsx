import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { GradeBreakdown, SubmissionStatus } from "@/types";

export function SubmissionStatusBadge({
  status,
  flaggedCheating,
}: {
  status: SubmissionStatus;
  flaggedCheating?: boolean;
}) {
  if (flaggedCheating) return <Badge variant="destructive">Gian lận</Badge>;
  if (status === "graded") return <Badge variant="success">Đã chấm</Badge>;
  if (status === "grading") return <Badge variant="warning">Đang chấm</Badge>;
  return <Badge variant="secondary">Đã nộp · chờ chấm</Badge>;
}

const barLabels: Record<keyof GradeBreakdown, string> = {
  testcase: "Testcase",
  complexity: "Độ phức tạp",
  similarity: "Độ giống nhau",
};

export function BreakdownBars({ breakdown }: { breakdown: GradeBreakdown }) {
  return (
    <div className="space-y-2.5">
      {(Object.keys(barLabels) as (keyof GradeBreakdown)[]).map((k) => {
        const v = breakdown[k];
        const danger = k === "similarity" && v >= 80;
        return (
          <div key={k}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{barLabels[k]}</span>
              <span className="data font-medium">{v}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", danger ? "bg-destructive" : k === "similarity" ? "bg-muted-foreground/50" : "bg-primary")}
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AiCommentBox({ comment }: { comment: string }) {
  return (
    <div className="rounded-lg border bg-accent/40 p-4">
      <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="size-4" /> Nhận xét từ AI
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{comment}</p>
    </div>
  );
}

export function CheatingNotice({ comment }: { comment: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-4">
      <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="size-4" /> Phát hiện gian lận — 0 điểm
      </div>
      <p className="text-sm leading-relaxed text-destructive/90">{comment}</p>
    </div>
  );
}

export function CodeBlock({ code, fileName }: { code: string; fileName?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      {fileName && (
        <div className="data flex items-center border-b bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
          {fileName}
        </div>
      )}
      <pre className="data overflow-x-auto p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone = score === 0 ? "text-destructive" : score >= 8 ? "text-success" : "text-foreground";
  return (
    <div className="flex items-baseline gap-1">
      <span className={cn("data text-3xl font-bold", tone)}>{score}</span>
      <span className="data text-sm text-muted-foreground">/10</span>
    </div>
  );
}
