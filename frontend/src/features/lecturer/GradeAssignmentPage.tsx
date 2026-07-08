import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useContent } from "@/store/content";
import { useSubmissions } from "@/store/submissions";
import { gradingApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { BackButton } from "@/components/layout/BackButton";
import { AssignmentForm } from "./AssignmentForm";
import { CodeBlock } from "@/features/student/result-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2, Code2, FileText, Loader2, Lock, Maximize2, PencilLine, Play } from "lucide-react";
import type { Submission } from "@/types";

export function GradeAssignmentPage() {
  const { assignmentId } = useParams();
  const assignment = useContent((s) => s.assignments.find((a) => a.id === assignmentId));
  const loadAssignment = useContent((s) => s.loadAssignment);
  const updateAssignment = useContent((s) => s.updateAssignment);
  const classSubs = useSubmissions((s) => s.classSubs);
  const loadForAssignment = useSubmissions((s) => s.loadForAssignment);
  const overrideGrade = useSubmissions((s) => s.overrideGrade);
  const finalizeAssignment = useSubmissions((s) => s.finalizeAssignment);

  const [saved, setSaved] = useState(false);
  const [viewing, setViewing] = useState<Submission | null>(null);
  const [commentOf, setCommentOf] = useState<Submission | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { score: string; comment: string }>>({});
  const [grading, setGrading] = useState(false);
  const [gradeMsg, setGradeMsg] = useState("");

  useEffect(() => {
    if (!assignmentId) return;
    void loadAssignment(assignmentId);
    void loadForAssignment(assignmentId);
  }, [assignmentId, loadAssignment, loadForAssignment]);

  const subs = useMemo(
    () => classSubs.filter((s) => s.assignmentId === assignmentId).sort((a, b) => a.studentCode.localeCompare(b.studentCode)),
    [classSubs, assignmentId]
  );
  const locked = subs.some((s) => s.published);

  if (!assignment) {
    return (<div><BackButton /><EmptyState title="Không tìm thấy bài tập" /></div>);
  }

  const draftOf = (s: Submission) => drafts[s.id] ?? { score: s.score?.toString() ?? "", comment: s.aiComment ?? "" };
  const setDraft = (id: string, patch: Partial<{ score: string; comment: string }>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? { score: "", comment: "" }), ...patch } }));
  const commit = async (s: Submission) => {
    const d = draftOf(s);
    const newScore = d.score === "" ? undefined : Number(d.score);
    const curScore = s.score ?? undefined;
    const newComment = d.comment ?? "";
    const curComment = s.aiComment ?? "";
    // Chỉ ghi khi có thay đổi thật → bấm vào ô rồi bấm ra (không sửa gì) sẽ KHÔNG đánh dấu/khóa bài.
    if (newScore === curScore && newComment === curComment) return;
    await overrideGrade(s.id, { score: newScore, aiComment: newComment });
  };

  const runAutoGrade = async () => {
    if (!assignmentId) return;
    setGrading(true);
    setGradeMsg("");
    try {
      await gradingApi.gradeAssignment(assignmentId);
      await loadForAssignment(assignmentId);
      setGradeMsg("Đã chạy chấm tự động.");
    } catch (e) {
      setGradeMsg(e instanceof Error ? e.message : "Mô hình chấm chưa sẵn sàng.");
    } finally {
      setGrading(false);
    }
  };

  return (
    <div>
      <BackButton />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
          <p className="mt-1 text-muted-foreground">Hạn nộp {formatDate(assignment.deadline)} · {subs.length} bài nộp</p>
        </div>
        {locked && <Badge variant="success"><Lock className="mr-1 size-3" /> Đã công bố</Badge>}
      </div>

      <Tabs defaultValue="grade">
        <TabsList>
          <TabsTrigger value="grade"><CheckCircle2 /> Xem & chấm điểm</TabsTrigger>
          <TabsTrigger value="edit"><PencilLine /> Sửa đề</TabsTrigger>
        </TabsList>

        <TabsContent value="grade">
          {subs.length === 0 ? (
            <EmptyState icon={<FileText />} title="Chưa có bài nộp" />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">
                  {gradeMsg || "Chạy chấm tự động để hệ thống chấm tất cả bài nộp theo rubric."}
                </p>
                <Button size="sm" variant="outline" disabled={locked || grading} onClick={runAutoGrade}>
                  {grading ? <Loader2 className="animate-spin" /> : <Play />} Chạy chấm tự động
                </Button>
              </div>

              <Card className="mb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">STT</TableHead>
                      <TableHead>MSSV</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead className="w-24">Điểm AI</TableHead>
                      <TableHead>Nhận xét AI</TableHead>
                      <TableHead className="w-20 text-right">Code</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.map((s, i) => {
                      const d = draftOf(s);
                      return (
                        <TableRow key={s.id} className={s.flaggedCheating ? "bg-destructive/5" : undefined}>
                          <TableCell className="data text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="data">{s.studentCode}</TableCell>
                          <TableCell className="font-medium">
                            {s.studentName}
                            {s.flaggedCheating && <Badge variant="destructive" className="ml-2">Gian lận</Badge>}
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} max={10} step={0.5} value={d.score} disabled={locked}
                              onChange={(e) => setDraft(s.id, { score: e.target.value })}
                              onBlur={() => void commit(s)} className="data h-9 w-20" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-1">
                              <Textarea value={d.comment} disabled={locked}
                                onChange={(e) => setDraft(s.id, { comment: e.target.value })}
                                onBlur={() => void commit(s)} className="min-h-9 py-1.5 text-xs" rows={2} />
                              <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground" title="Mở rộng nhận xét" onClick={() => setCommentOf(s)}>
                                <Maximize2 />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setViewing(s)}><Code2 /> Xem</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {locked ? "Điểm đã công bố và bị khóa, không thể chỉnh sửa." : "Sau khi công bố, điểm sẽ bị khóa vĩnh viễn và sinh viên xem được."}
                </p>
                <Button variant="success" disabled={locked} onClick={() => setConfirmPublish(true)}>
                  <CheckCircle2 /> Hoàn thành & công bố
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="edit">
          <Card className="p-5">
            {saved && <div className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">Đã lưu thay đổi.</div>}
            <AssignmentForm
              initial={assignment}
              courseId={assignment.courseId}
              submitLabel="Lưu thay đổi"
              onSubmit={async (a) => {
                await updateAssignment(a.id, {
                  title: a.title, source: a.source, description: a.description, pdfUrl: a.pdfUrl, section: a.section,
                  deadline: a.deadline, rubric: a.rubric, testcases: a.testcases,
                });
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
              }}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.studentName}</DialogTitle>
            <DialogDescription className="data">{viewing?.studentCode} · {viewing?.fileName}</DialogDescription>
          </DialogHeader>
          {viewing && <CodeBlock code={viewing.code} fileName={viewing.fileName} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Quay lại</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!commentOf} onOpenChange={(v) => { if (!v) { if (commentOf && !locked) void commit(commentOf); setCommentOf(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nhận xét — {commentOf?.studentName}</DialogTitle>
            <DialogDescription className="data">{commentOf?.studentCode}</DialogDescription>
          </DialogHeader>
          {commentOf && (
            <Textarea
              value={draftOf(commentOf).comment}
              disabled={locked}
              onChange={(e) => setDraft(commentOf.id, { comment: e.target.value })}
              className="min-h-72 text-sm leading-relaxed"
              placeholder="Nhận xét cho sinh viên…"
            />
          )}
          <DialogFooter>
            <Button onClick={() => { if (commentOf && !locked) void commit(commentOf); setCommentOf(null); }}>
              {locked ? "Đóng" : "Lưu & đóng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hoàn thành & công bố điểm?</DialogTitle>
            <DialogDescription>
              Những sinh viên <b>chưa nộp</b> sẽ bị cho <b>0 điểm</b>. Toàn bộ điểm sẽ được khóa và sinh viên xem được điểm của mình. Hãy chấm/châm trước điểm xong rồi mới bấm.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPublish(false)}>Hủy</Button>
            <Button variant="success" onClick={async () => {
              if (assignmentId) await finalizeAssignment(assignmentId);
              setConfirmPublish(false);
            }}>
              Xác nhận hoàn thành
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
