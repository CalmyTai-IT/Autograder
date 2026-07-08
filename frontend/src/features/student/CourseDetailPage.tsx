import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { useContent } from "@/store/content";
import { coursesApi, submissionsApi } from "@/lib/api";
import { courseStatus, semesterLabel } from "@/lib/term";
import { cn, daysUntil, initials } from "@/lib/utils";
import { BackButton } from "@/components/layout/BackButton";
import { CourseStatusBadge } from "@/features/shared/course-bits";
import { SubmissionStatusBadge } from "./result-bits";
import { CourseSections } from "@/features/shared/CourseSections";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList, FileText, KeyRound, Users } from "lucide-react";
import type { Submission, User } from "@/types";

function DeadlineBadge({ deadline }: { deadline: string }) {
  const left = daysUntil(deadline);
  return (
    <Badge variant={left < 0 ? "destructive" : left <= 2 ? "warning" : "secondary"}>
      {left < 0 ? "Đã quá hạn" : left === 0 ? "Hạn hôm nay" : `Còn ${left} ngày`}
    </Badge>
  );
}

export function CourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const courses = useContent((s) => s.courses);
  const allAssignments = useContent((s) => s.assignments);
  const allMaterials = useContent((s) => s.materials);
  const loadCourse = useContent((s) => s.loadCourse);
  const loadAssignments = useContent((s) => s.loadAssignments);
  const loadMaterials = useContent((s) => s.loadMaterials);

  const [members, setMembers] = useState<{ lecturer: User | null; students: User[] }>({ lecturer: null, students: [] });
  const [mySubs, setMySubs] = useState<Record<string, Submission>>({});

  const course = courses.find((c) => c.id === courseId);
  const assignments = useMemo(
    () => allAssignments.filter((a) => a.courseId === courseId).sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline)),
    [allAssignments, courseId]
  );
  const materials = allMaterials.filter((m) => m.courseId === courseId);

  useEffect(() => {
    if (!courseId) return;
    void loadCourse(courseId);
    void loadAssignments(courseId);
    void loadMaterials(courseId);
    coursesApi.members(courseId).then(setMembers).catch(() => {});
  }, [courseId, loadCourse, loadAssignments, loadMaterials]);

  // Điểm/bài nộp của chính mình cho từng bài tập
  useEffect(() => {
    if (assignments.length === 0) { setMySubs({}); return; }
    let cancelled = false;
    Promise.all(assignments.map((a) => submissionsApi.mine(a.id).then((s) => [a.id, s] as const)))
      .then((pairs) => {
        if (cancelled) return;
        const map: Record<string, Submission> = {};
        for (const [id, s] of pairs) if (s) map[id] = s;
        setMySubs(map);
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [assignments]);

  const mySub = (assignmentId: string) => mySubs[assignmentId];

  if (!course) {
    return (<div><BackButton to="/sv" /><EmptyState title="Không tìm thấy môn học" /></div>);
  }

  return (
    <div>
      <BackButton to="/sv" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
            <CourseStatusBadge status={courseStatus(course)} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {course.lecturerName} · Năm học <span className="data">{course.academicYear}</span> · {semesterLabel(course.semester)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground">
          <KeyRound className="size-3.5" /> <span className="data">{course.joinCode}</span>
        </div>
      </div>

      <Tabs defaultValue="work">
        <TabsList>
          <TabsTrigger value="work"><ClipboardList /> Bài tập & tài liệu</TabsTrigger>
          <TabsTrigger value="members"><Users /> Thành viên</TabsTrigger>
          <TabsTrigger value="grades"><FileText /> Điểm của tôi</TabsTrigger>
        </TabsList>

        <TabsContent value="work" className="space-y-4">
          {assignments.length === 0 && materials.length === 0 ? (
            <EmptyState icon={<ClipboardList />} title="Chưa có nội dung" description="Giảng viên chưa đăng bài tập hay tài liệu." />
          ) : (
            <CourseSections
              assignments={assignments}
              materials={materials}
              onOpenAssignment={(a) => navigate(`/sv/bai-tap/${a.id}`)}
              assignmentExtra={(a) => {
                const sub = mySub(a.id);
                return (
                  <div className="flex items-center gap-2">
                    {sub ? <SubmissionStatusBadge status={sub.status} flaggedCheating={sub.flaggedCheating} /> : <Badge variant="outline">Chưa nộp</Badge>}
                    <DeadlineBadge deadline={a.deadline} />
                  </div>
                );
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="members">
          <div className="space-y-4">
            {members.lecturer && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Giảng viên</p>
                <Card className="flex items-center gap-3 p-4">
                  <Avatar><AvatarFallback>{initials(members.lecturer.fullName)}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{members.lecturer.fullName}</p>
                    <p className="text-sm text-muted-foreground">{members.lecturer.email}</p>
                  </div>
                  <Badge>GV</Badge>
                </Card>
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Sinh viên ({members.students.length})</p>
              <Card className="divide-y">
                {members.students.map((s) => (
                  <div key={s.id} className={cn("flex items-center gap-3 p-4", s.id === user?.id && "bg-accent/40")}>
                    <Avatar className="size-8"><AvatarFallback className="text-xs">{initials(s.fullName)}</AvatarFallback></Avatar>
                    <span className="data w-24 shrink-0 text-sm text-muted-foreground">{s.studentCode}</span>
                    <span className="flex-1 truncate text-sm font-medium">
                      {s.fullName}
                      {s.id === user?.id && <span className="ml-2 text-xs text-primary">(bạn)</span>}
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="grades">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bài tập</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Điểm</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => {
                  const sub = mySub(a.id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>
                        {sub ? <SubmissionStatusBadge status={sub.status} flaggedCheating={sub.flaggedCheating} /> : <Badge variant="outline">Chưa nộp</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {sub?.status === "graded" ? (
                          <span className={cn("data font-semibold", sub.score === 0 && "text-destructive")}>{sub.score}</span>
                        ) : (<span className="text-muted-foreground">—</span>)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => navigate(`/sv/bai-tap/${a.id}`)} className="text-sm text-primary hover:underline">Xem</button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">Bạn chỉ thấy điểm của chính mình. Điểm có thể thay đổi cho đến khi giảng viên công bố.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
