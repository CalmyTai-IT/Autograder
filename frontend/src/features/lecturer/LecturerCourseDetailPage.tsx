import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useContent } from "@/store/content";
import { coursesApi, submissionsApi } from "@/lib/api";
import { courseStatus, semesterLabel } from "@/lib/term";
import { initials } from "@/lib/utils";
import { BackButton } from "@/components/layout/BackButton";
import { CourseStatusBadge } from "@/features/shared/course-bits";
import { CreateAssignmentDialog } from "./CreateAssignmentDialog";
import { CourseSections } from "@/features/shared/CourseSections";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList, FileSpreadsheet, KeyRound, Plus, Upload, Users } from "lucide-react";
import type { Assignment, User } from "@/types";

type Gradebook = {
  students: User[];
  assignments: { id: string; title: string }[];
  scores: { assignmentId: string; studentId: string; score: number | null }[];
};

export function LecturerCourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const matRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [matSection, setMatSection] = useState("");
  const [uploading, setUploading] = useState(false);

  const course = useContent((s) => s.courses.find((c) => c.id === courseId));
  const assignments = useContent((s) => s.assignments).filter((a) => a.courseId === courseId);
  const materials = useContent((s) => s.materials).filter((m) => m.courseId === courseId);
  const loadCourse = useContent((s) => s.loadCourse);
  const loadAssignments = useContent((s) => s.loadAssignments);
  const loadMaterials = useContent((s) => s.loadMaterials);
  const createAssignment = useContent((s) => s.createAssignment);
  const uploadMaterials = useContent((s) => s.uploadMaterials);

  const [members, setMembers] = useState<{ lecturer: User | null; students: User[] }>({ lecturer: null, students: [] });
  const [gradebook, setGradebook] = useState<Gradebook>({ students: [], assignments: [], scores: [] });

  const refreshGradebook = () => {
    if (courseId) submissionsApi.gradebook(courseId).then(setGradebook).catch(() => {});
  };

  useEffect(() => {
    if (!courseId) return;
    void loadCourse(courseId);
    void loadAssignments(courseId);
    void loadMaterials(courseId);
    coursesApi.members(courseId).then(setMembers).catch(() => {});
    submissionsApi.gradebook(courseId).then(setGradebook).catch(() => {});
  }, [courseId, loadCourse, loadAssignments, loadMaterials]);

  const subCount = (assignmentId: string) => gradebook.scores.filter((s) => s.assignmentId === assignmentId).length;
  const scoreOf = (assignmentId: string, studentId: string): number | undefined => {
    const row = gradebook.scores.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);
    return row && row.score != null ? row.score : undefined;
  };

  const onUploadMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !courseId) return;
    setUploading(true);
    try { await uploadMaterials(courseId, files, matSection.trim() || undefined); }
    finally { setUploading(false); }
  };

  const onCreateAssignment = async (a: Assignment) => {
    const { id: _id, createdAt: _c, ...payload } = a;
    void _id; void _c;
    await createAssignment(payload);
    refreshGradebook();
  };

  const exportExcel = async () => {
    if (!course) return;
    const XLSX = await import("xlsx");
    const header = ["STT", "MSSV", "Họ tên", ...assignments.map((a) => a.title)];
    const rows = gradebook.students.map((s, i) => [
      i + 1, s.studentCode ?? "", s.fullName,
      ...assignments.map((a) => { const sc = scoreOf(a.id, s.id); return sc === undefined ? "" : sc; }),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bảng điểm");
    XLSX.writeFile(wb, `bang-diem-${course.name}.xlsx`);
  };

  if (!course) {
    return (<div><BackButton to="/gv" /><EmptyState title="Không tìm thấy lớp" /></div>);
  }

  return (
    <div>
      <BackButton to="/gv" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
            <CourseStatusBadge status={courseStatus(course)} />
          </div>
          <p className="mt-1 text-muted-foreground">
            Năm học <span className="data">{course.academicYear}</span> · {semesterLabel(course.semester)} · {course.studentCount} sinh viên
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
          <TabsTrigger value="grades"><FileSpreadsheet /> Bảng điểm</TabsTrigger>
        </TabsList>

        <TabsContent value="work" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
            <Input value={matSection} onChange={(e) => setMatSection(e.target.value)} placeholder='Tên mục (vd: Tài liệu tuần 1)' className="h-9 w-56" />
            <input ref={matRef} type="file" multiple className="hidden" onChange={onUploadMaterial} />
            <Button size="sm" variant="outline" onClick={() => matRef.current?.click()} disabled={uploading}>
              <Upload /> {uploading ? "Đang tải…" : "Tải tài liệu"}
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus /> Tạo bài tập</Button>
          </div>
          <p className="text-xs text-muted-foreground">Tài liệu &amp; bài tập cùng tên mục sẽ hiển thị chung nhóm. Để trống mục → vào nhóm "Chung".</p>

          {assignments.length === 0 && materials.length === 0 ? (
            <EmptyState icon={<ClipboardList />} title="Chưa có nội dung" action={<Button onClick={() => setCreateOpen(true)}><Plus /> Tạo bài tập</Button>} />
          ) : (
            <CourseSections
              assignments={assignments}
              materials={materials}
              onOpenAssignment={(a) => navigate(`/gv/bai-tap/${a.id}`)}
              assignmentExtra={(a) => <span className="data shrink-0 text-xs text-muted-foreground">{subCount(a.id)} nộp</span>}
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
                  <div className="flex-1"><p className="font-medium">{members.lecturer.fullName}</p><p className="text-sm text-muted-foreground">{members.lecturer.email}</p></div>
                  <Badge>GV</Badge>
                </Card>
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Sinh viên ({members.students.length})</p>
              {members.students.length === 0 ? (
                <EmptyState icon={<Users />} title="Chưa có sinh viên" description="Chia sẻ mã lớp để sinh viên tham gia." />
              ) : (
                <Card className="divide-y">
                  {members.students.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-4">
                      <Avatar className="size-8"><AvatarFallback className="text-xs">{initials(s.fullName)}</AvatarFallback></Avatar>
                      <span className="data w-24 shrink-0 text-sm text-muted-foreground">{s.studentCode}</span>
                      <span className="flex-1 truncate text-sm font-medium">{s.fullName}</span>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="grades">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Bảng điểm chỉ xem. Chấm & chỉnh điểm trong từng bài tập.</p>
            <Button size="sm" variant="outline" onClick={exportExcel} disabled={assignments.length === 0}>
              <FileSpreadsheet /> Xuất Excel
            </Button>
          </div>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">STT</TableHead>
                  <TableHead>MSSV</TableHead>
                  <TableHead>Họ tên</TableHead>
                  {assignments.map((a) => (<TableHead key={a.id} className="text-right">{a.title}</TableHead>))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradebook.students.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell className="data text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="data">{s.studentCode}</TableCell>
                    <TableCell className="font-medium">{s.fullName}</TableCell>
                    {assignments.map((a) => {
                      const sc = scoreOf(a.id, s.id);
                      return (
                        <TableCell key={a.id} className="text-right">
                          {sc === undefined ? <span className="text-muted-foreground">—</span> : <span className={sc === 0 ? "data text-destructive" : "data font-medium"}>{sc}</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateAssignmentDialog open={createOpen} onOpenChange={setCreateOpen} courseId={course.id} onCreate={onCreateAssignment} />
    </div>
  );
}
