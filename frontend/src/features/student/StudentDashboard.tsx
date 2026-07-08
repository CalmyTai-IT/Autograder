import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { useContent } from "@/store/content";
import { useSubmissions } from "@/store/submissions";
import { assignmentsApi } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { courseStatus } from "@/lib/term";
import { CourseStatusBadge, CourseTermGroups } from "@/features/shared/course-bits";
import { PracticeBrowser, type ProblemProgress } from "@/features/shared/PracticeBrowser";
import { DeadlineCalendar, type CalendarItem } from "./DeadlineCalendar";
import { JoinClassDialog } from "./JoinClassDialog";
import { BookOpen, Code2, Plus, Users, ArrowRight } from "lucide-react";

export function StudentDashboard() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();

  const courses = useContent((s) => s.courses);
  const problems = useContent((s) => s.problems);
  const loadCourses = useContent((s) => s.loadCourses);
  const loadProblems = useContent((s) => s.loadProblems);
  const loadAllProblemSubs = useSubmissions((s) => s.loadAllProblemSubs);

  const [joinOpen, setJoinOpen] = useState(false);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);

  useEffect(() => {
    void loadCourses();
    void loadProblems();
    void loadAllProblemSubs();
  }, [loadCourses, loadProblems, loadAllProblemSubs]);

  // Lịch deadline: gom bài tập của các lớp đang hoạt động
  useEffect(() => {
    const active = courses.filter((c) => courseStatus(c) === "active");
    if (active.length === 0) { setCalendarItems([]); return; }
    let cancelled = false;
    Promise.all(active.map((c) => assignmentsApi.listByCourse(c.id).then((as) =>
      as.map((a) => ({ ...a, courseName: c.name }))
    ))).then((lists) => {
      if (!cancelled) setCalendarItems(lists.flat());
    }).catch(() => { if (!cancelled) setCalendarItems([]); });
    return () => { cancelled = true; };
  }, [courses]);

  const problemSubs = useSubmissions((s) => s.problemSubs);
  const progress: Record<string, ProblemProgress> = useMemo(() => {
    const map: Record<string, ProblemProgress> = {};
    for (const sub of problemSubs) {
      if (sub.userId !== user?.id) continue;
      const prev = map[sub.problemId]?.bestScore ?? -1;
      if (sub.score > prev) {
        map[sub.problemId] = {
          bestScore: sub.score,
          status: sub.passedTests === sub.totalTests ? "solved" : "attempted",
        };
      }
    }
    return map;
  }, [problemSubs, user?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Xin chào, {user?.fullName.split(" ").slice(-1)[0]} 👋</h1>
        <p className="text-muted-foreground">Theo dõi deadline và luyện tập lập trình.</p>
      </div>

      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses"><BookOpen /> Môn học</TabsTrigger>
          <TabsTrigger value="practice"><Code2 /> Bài tập tự do</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Lớp của tôi</h2>
                <Button size="sm" onClick={() => setJoinOpen(true)}><Plus /> Vào lớp</Button>
              </div>

              <CourseTermGroups
                courses={courses}
                emptyAll={
                  <EmptyState icon={<BookOpen />} title="Bạn chưa tham gia lớp nào"
                    description="Nhập mã lớp giảng viên gửi để bắt đầu."
                    action={<Button onClick={() => setJoinOpen(true)}><Plus /> Vào lớp</Button>} />
                }
                renderCard={(c) => (
                  <button onClick={() => navigate(`/sv/mon/${c.id}`)}
                    className="group flex h-full w-full flex-col rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:shadow-sm">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug group-hover:text-primary">{c.name}</p>
                      <CourseStatusBadge status={courseStatus(c)} />
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3.5" /> {c.studentCount}
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                )}
              />
            </div>

            <DeadlineCalendar items={calendarItems} onOpen={(a) => navigate(`/sv/bai-tap/${a.id}`)} />
          </div>
        </TabsContent>

        <TabsContent value="practice">
          <div className="mb-4">
            <h2 className="font-semibold">Luyện tập tự do</h2>
            <p className="text-sm text-muted-foreground">Giải đề công khai, chấm ngay bằng testcase + nhận xét AI.</p>
          </div>
          <PracticeBrowser problems={problems} progress={progress} onOpen={(id) => navigate(`/sv/luyen-tap/${id}`)} />
        </TabsContent>
      </Tabs>

      <JoinClassDialog open={joinOpen} onOpenChange={setJoinOpen} onJoined={() => void loadCourses()} />
    </div>
  );
}
