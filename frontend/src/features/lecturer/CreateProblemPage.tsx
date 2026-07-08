import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { useContent } from "@/store/content";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/ui/card";
import { ProblemForm } from "./ProblemForm";

export function CreateProblemPage() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const createProblem = useContent((s) => s.createProblem);

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton to="/gv" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Tạo bài tập tự do</h1>
      <p className="mb-6 text-muted-foreground">Bài luyện công khai, không có deadline, chấm ngay bằng testcase.</p>
      <Card className="p-5">
        <ProblemForm
          createdById={user!.id}
          submitLabel="Tạo bài tập"
          onSubmit={async (p) => {
            const created = await createProblem({
              title: p.title, difficulty: p.difficulty, description: p.description, testcases: p.testcases,
            });
            navigate(`/gv/luyen-tap/${created.id}`);
          }}
        />
      </Card>
    </div>
  );
}
