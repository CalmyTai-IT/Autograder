import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useContent } from "@/store/content";
import { useAuth } from "@/store/auth";
import { BackButton } from "@/components/layout/BackButton";
import { DifficultyBadge } from "@/features/shared/problem-bits";
import { ProblemForm } from "./ProblemForm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export function LecturerProblemDetailPage() {
  const { problemId } = useParams();
  const user = useAuth((s) => s.user);
  const problem = useContent((s) => s.problems.find((p) => p.id === problemId));
  const loadProblem = useContent((s) => s.loadProblem);
  const updateProblem = useContent((s) => s.updateProblem);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (problemId) void loadProblem(problemId);
  }, [problemId, loadProblem]);

  if (!problem) {
    return (<div><BackButton to="/gv" /><EmptyState title="Không tìm thấy bài tập" /></div>);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton to="/gv" />
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{problem.title}</h1>
        <DifficultyBadge difficulty={problem.difficulty} />
      </div>
      <p className="mb-6 text-muted-foreground">Chỉnh sửa đề bài bên dưới</p>

      <Card className="p-5">
        {saved && <div className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">Đã lưu thay đổi.</div>}
        <div className="mb-4 flex items-center gap-2"><Badge variant="secondary">Sửa bài tập</Badge></div>
        <ProblemForm
          initial={problem}
          createdById={user!.id}
          submitLabel="Lưu thay đổi"
          onSubmit={async (p) => {
            await updateProblem(p.id, { title: p.title, difficulty: p.difficulty, description: p.description, testcases: p.testcases });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }}
        />
      </Card>
    </div>
  );
}
