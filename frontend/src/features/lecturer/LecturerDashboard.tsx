import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContent } from "@/store/content";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { courseStatus, termRange } from "@/lib/term";
import { CourseStatusBadge, CourseTermGroups } from "@/features/shared/course-bits";
import { PracticeBrowser } from "@/features/shared/PracticeBrowser";
import { CreateClassDialog, type NewClassData } from "./CreateClassDialog";
import { BookOpen, Code2, Plus, Users, KeyRound } from "lucide-react";

export function LecturerDashboard() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const courses = useContent((s) => s.courses);
  const problems = useContent((s) => s.problems);
  const loadCourses = useContent((s) => s.loadCourses);
  const loadProblems = useContent((s) => s.loadProblems);
  const createCourse = useContent((s) => s.createCourse);

  useEffect(() => {
    void loadCourses();
    void loadProblems();
  }, [loadCourses, loadProblems]);

  const onCreate = async (data: NewClassData) => {
    const { start, end } = termRange(data.academicYear, data.semester);
    await createCourse({
      name: data.name, description: data.description, academicYear: data.academicYear,
      semester: data.semester, startDate: start, endDate: end,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bảng điều khiển giảng viên</h1>
        <p className="text-muted-foreground">Quản lý lớp, ra đề và chấm bài tự động.</p>
      </div>

      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses"><BookOpen /> Lớp đã tạo</TabsTrigger>
          <TabsTrigger value="practice"><Code2 /> Bài tập tự do</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Danh mục lớp</h2>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus /> Tạo lớp</Button>
          </div>

          <CourseTermGroups
            courses={courses}
            emptyAll={
              <EmptyState icon={<BookOpen />} title="Chưa có lớp nào"
                description="Tạo lớp đầu tiên và chia sẻ mã cho sinh viên."
                action={<Button onClick={() => setCreateOpen(true)}><Plus /> Tạo lớp</Button>} />
            }
            renderCard={(c) => (
              <button onClick={() => navigate(`/gv/mon/${c.id}`)}
                className="group flex h-full w-full flex-col rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug group-hover:text-primary">{c.name}</p>
                  <CourseStatusBadge status={courseStatus(c)} />
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <KeyRound className="size-3.5" /><span className="data">{c.joinCode}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" /> {c.studentCount}
                  </span>
                </div>
              </button>
            )}
          />
        </TabsContent>

        <TabsContent value="practice">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Ngân hàng bài tự do</h2>
              <p className="text-sm text-muted-foreground">Bài luyện công khai, không ràng buộc thời gian.</p>
            </div>
            <Button size="sm" onClick={() => navigate("/gv/luyen-tap/tao")}><Plus /> Tạo bài tập</Button>
          </div>
          <PracticeBrowser problems={problems} onOpen={(id) => navigate(`/gv/luyen-tap/${id}`)} />
        </TabsContent>
      </Tabs>

      <CreateClassDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={onCreate} />
    </div>
  );
}
