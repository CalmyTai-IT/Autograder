import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useAuth } from "@/store/auth";
import { useContent } from "@/store/content";
import { useSubmissions } from "@/store/submissions";
import { assignmentsApi, fileHref } from "@/lib/api";
import { cn, daysUntil, formatDateTime } from "@/lib/utils";
import { BackButton } from "@/components/layout/BackButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AiCommentBox, BreakdownBars, CheatingNotice, CodeBlock, ScorePill, SubmissionStatusBadge,
} from "./result-bits";
import { FileText, FileUp, Loader2, Play, Plus, Send, X } from "lucide-react";

const LANGS = [
  { value: "python", label: "Python", ext: "py", file: "baitap.py",
    starter: `import sys
data = sys.stdin.buffer.read().split()
# n = int(data[0]); a = list(map(int, data[1:1+n]))
# print(ket_qua)
` },
  { value: "cpp", label: "C++", ext: "cpp", file: "baitap.cpp",
    starter: `#include <bits/stdc++.h>
using namespace std;
int main() {
    // đọc cin, in cout
    return 0;
}
` },
  { value: "java", label: "Java", ext: "java", file: "Main.java",
    starter: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
    }
}
` },
];
const langByExt = (name: string) => {
  const e = name.split(".").pop()?.toLowerCase();
  if (e === "py") return LANGS[0];
  if (["cpp", "cc", "cxx", "c"].includes(e ?? "")) return LANGS[1];
  if (e === "java") return LANGS[2];
  return undefined;
};

type RunCase = { id: string; input: string; expectedOutput: string; locked: boolean };
type RunResult = { index: number; actual: string; stderr?: string; status: string };

function RunBadge({ status }: { status: string }) {
  const map: Record<string, { v: "success" | "destructive" | "warning" | "secondary"; t: string }> = {
    pass: { v: "success", t: "Đúng" }, wrong: { v: "destructive", t: "Sai" },
    runtime_error: { v: "destructive", t: "Lỗi chạy" }, timeout: { v: "warning", t: "Quá giờ" },
    no_expected: { v: "secondary", t: "Đã chạy" },
  };
  const m = map[status] ?? { v: "secondary", t: status };
  return <Badge variant={m.v} className="data text-[10px]">{m.t}</Badge>;
}

export function AssignmentPage() {
  const { assignmentId } = useParams();
  const user = useAuth((s) => s.user);

  const assignments = useContent((s) => s.assignments);
  const courses = useContent((s) => s.courses);
  const loadAssignment = useContent((s) => s.loadAssignment);
  const loadCourse = useContent((s) => s.loadCourse);

  const classSubs = useSubmissions((s) => s.classSubs);
  const loadMine = useSubmissions((s) => s.loadMine);
  const submitAssignment = useSubmissions((s) => s.submitAssignment);

  const fileRef = useRef<HTMLInputElement>(null);
  const assignment = assignments.find((a) => a.id === assignmentId);

  const [lang, setLang] = useState(LANGS[0]);
  const [code, setCode] = useState(LANGS[0].starter);
  const [fileName, setFileName] = useState(LANGS[0].file);
  const [submitting, setSubmitting] = useState(false);

  const [cases, setCases] = useState<RunCase[]>([]);
  const [activeCase, setActiveCase] = useState(0);
  const [running, setRunning] = useState(false);
  const [runResults, setRunResults] = useState<RunResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (!assignmentId) return;
    void loadAssignment(assignmentId);
    void loadMine(assignmentId);
  }, [assignmentId, loadAssignment, loadMine]);

  useEffect(() => {
    if (assignment) void loadCourse(assignment.courseId);
  }, [assignment, loadCourse]);

  // seed ví dụ (testcase không ẩn) làm case ban đầu
  useEffect(() => {
    if (seeded.current || !assignment) return;
    const ex = assignment.testcases.filter((t) => !t.hidden)
      .map((t, i) => ({ id: `c-${i}`, input: t.input, expectedOutput: t.expectedOutput, locked: true }));
    setCases(ex.length ? ex : [{ id: "c-0", input: "", expectedOutput: "", locked: false }]);
    seeded.current = true;
  }, [assignment]);

  const course = useMemo(() => courses.find((c) => c.id === assignment?.courseId), [courses, assignment]);
  const sub = user && assignment ? classSubs.find((s) => s.assignmentId === assignment.id && s.studentId === user.id) : undefined;

  if (!assignment) {
    return (<div><BackButton /><EmptyState title="Không tìm thấy bài tập" /></div>);
  }

  const left = daysUntil(assignment.deadline);
  const overdue = new Date(assignment.deadline).getTime() < Date.now();

  const clearRun = () => setRunResults(null);
  const changeLang = (value: string) => {
    const l = LANGS.find((x) => x.value === value) ?? LANGS[0];
    setLang(l); setCode(l.starter); setFileName(l.file); clearRun();
  };
  const onLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const l = langByExt(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCode(String(reader.result ?? ""));
      setFileName(f.name);
      if (l) setLang(l);
      clearRun();
    };
    reader.readAsText(f);
  };

  const addCase = () => {
    const id = `c-${Date.now()}`;
    setCases((cs) => [...cs, { id, input: "", expectedOutput: "", locked: false }]);
    setActiveCase(cases.length); clearRun();
  };
  const removeCase = (id: string) => {
    setCases((cs) => { const next = cs.filter((c) => c.id !== id); setActiveCase((a) => Math.max(0, Math.min(a, next.length - 1))); return next; });
    clearRun();
  };
  const updateCase = (id: string, patch: Partial<RunCase>) => {
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))); clearRun();
  };

  const runNow = async () => {
    if (!cases.length) return;
    setRunning(true); setRunError(null); setRunResults(null);
    try {
      const res = await assignmentsApi.run(assignment.id, {
        language: lang.value, code,
        cases: cases.map((c) => ({ input: c.input, expectedOutput: c.expectedOutput || undefined })),
      });
      if (res.compileError) setRunError(res.errorSummary || "Code không biên dịch được.");
      else setRunResults(res.cases.map((c) => ({ index: c.index, actual: c.actual, stderr: c.stderr, status: c.status })));
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Lỗi khi chạy thử.");
    } finally { setRunning(false); }
  };

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      await submitAssignment({ assignmentId: assignment.id, fileName, code });
    } finally { setSubmitting(false); }
  };

  const active = cases[activeCase];
  const activeResult = runResults?.find((r) => r.index === activeCase) ?? null;
  const published = !!sub?.published;

  return (
    <div>
      <BackButton />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
          <p className="mt-1 text-muted-foreground">{course?.name}</p>
        </div>
        <Badge variant={overdue ? "destructive" : left <= 2 ? "warning" : "secondary"}>
          {overdue ? "Đã quá hạn" : left === 0 ? "Hạn hôm nay" : `Còn ${left} ngày`} · {formatDateTime(assignment.deadline)}
        </Badge>
      </div>

      {/* Đề bài */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Đề bài</CardTitle></CardHeader>
        <CardContent>
          {assignment.source === "pdf" ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-8">
              <FileText className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Đề bài ở dạng PDF</p>
              <Button variant="outline" asChild>
                <a href={fileHref(assignment.pdfUrl)} target="_blank" rel="noreferrer">Mở / tải PDF</a>
              </Button>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{assignment.description}</p>
          )}
        </CardContent>
      </Card>

      {published ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Kết quả</CardTitle>
            <SubmissionStatusBadge status={sub!.status} flaggedCheating={sub!.flaggedCheating} />
          </CardHeader>
          <CardContent className="space-y-4">
            {sub!.flaggedCheating ? (
              <CheatingNotice comment={sub!.aiComment ?? ""} />
            ) : (
              <>
                <ScorePill score={sub!.score ?? 0} />
                {sub!.breakdown && <BreakdownBars breakdown={sub!.breakdown} />}
                {sub!.aiComment && <AiCommentBox comment={sub!.aiComment} />}
              </>
            )}
            {sub!.code ? <CodeBlock code={sub!.code} fileName={sub!.fileName} /> : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Editor */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <select value={lang.value} onChange={(e) => changeLang(e.target.value)}
                  className="h-8 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {LANGS.map((l) => (<option key={l.value} value={l.value}>{l.label}</option>))}
                </select>
                <span className="data text-xs text-muted-foreground">{fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept=".c,.cpp,.cc,.cxx,.py,.java,.txt" className="hidden" onChange={onLoadFile} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FileUp /> Tải file lên</Button>
              </div>
            </div>
            <div className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Viết trực tiếp hoặc tải file lên (nội dung đổ vào đây). Đọc <span className="font-medium text-foreground">stdin</span>, in <span className="font-medium text-foreground">stdout</span>.
            </div>
            <Editor height="460px" language={lang.value} value={code}
              onChange={(v) => { setCode(v ?? ""); clearRun(); }}
              theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, padding: { top: 12 } }} />
          </Card>

          {/* Testcase panel + Nộp */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Chạy thử testcase</CardTitle>
                  {runResults && <span className="data text-xs text-muted-foreground">{runResults.filter((r) => r.status === "pass").length}/{runResults.filter((r) => r.status !== "no_expected").length} đúng</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {cases.map((c, i) => {
                    const r = runResults?.find((x) => x.index === i);
                    const dot = r ? (r.status === "pass" ? "bg-success" : r.status === "no_expected" ? "bg-muted-foreground/60" : "bg-destructive") : null;
                    return (
                      <button key={c.id} type="button" onClick={() => setActiveCase(i)}
                        className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                          activeCase === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                        {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
                        {c.locked ? `VD ${i + 1}` : `Case ${i + 1}`}
                        {!c.locked && (
                          <span role="button" onClick={(e) => { e.stopPropagation(); removeCase(c.id); }} className="-mr-1 ml-0.5 rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100"><X className="size-3" /></span>
                        )}
                      </button>
                    );
                  })}
                  <button type="button" onClick={addCase} className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:text-foreground"><Plus className="size-3" /> Thêm</button>
                </div>

                {active && (
                  <div className="space-y-2">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Input {active.locked && <span className="font-normal">(ví dụ)</span>}</p>
                      <Textarea value={active.input} readOnly={active.locked} onChange={(e) => updateCase(active.id, { input: e.target.value })}
                        placeholder="Dữ liệu nạp vào stdin" className={cn("data min-h-14 text-xs", active.locked && "bg-muted/40")} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Kết quả mong đợi {active.locked ? "" : <span className="font-normal">(tuỳ chọn)</span>}</p>
                      <Textarea value={active.expectedOutput} readOnly={active.locked} onChange={(e) => updateCase(active.id, { expectedOutput: e.target.value })}
                        placeholder={active.locked ? "" : "Để trống nếu chỉ xem output"} className={cn("data min-h-10 text-xs", active.locked && "bg-muted/40")} />
                    </div>
                    {activeResult && (
                      <div>
                        <div className="mb-1 flex items-center gap-2"><p className="text-xs font-medium text-muted-foreground">Output máy chạy</p><RunBadge status={activeResult.status} /></div>
                        <pre className="data max-h-32 overflow-auto rounded-lg border bg-muted/40 p-2 text-xs">{activeResult.actual || "(không có output)"}</pre>
                        {activeResult.stderr && <pre className="data mt-1 max-h-28 overflow-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{activeResult.stderr}</pre>}
                      </div>
                    )}
                  </div>
                )}

                {runError && <pre className="data max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{runError}</pre>}

                <Button variant="outline" size="sm" className="w-full" onClick={runNow} disabled={running || !cases.length}>
                  {running ? <Loader2 className="animate-spin" /> : <Play />} Chạy thử
                </Button>
                <p className="text-xs text-muted-foreground">Testcase chấm điểm của giảng viên được ẩn — đây chỉ là ví dụ để bạn kiểm tra trước khi nộp.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Nộp bài</CardTitle>
                {sub && <SubmissionStatusBadge status={sub.status} />}
              </CardHeader>
              <CardContent className="space-y-3">
                {sub && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                    <p className="data font-medium">{sub.fileName}</p>
                    <p className="mt-0.5 text-muted-foreground">Đã nộp lúc {formatDateTime(sub.submittedAt)} · chấm tự động sau hạn nộp.</p>
                  </div>
                )}
                {overdue ? (
                  <>
                    <div className="rounded-lg border border-dashed py-4 text-center text-sm text-muted-foreground">
                      Đã quá hạn nộp bài — hệ thống chấm tự động, chờ giảng viên công bố điểm.
                    </div>
                    <Button className="w-full" disabled>
                      <Send /> Đã hết hạn nộp
                    </Button>
                  </>
                ) : (
                  <Button className="w-full" onClick={submit} disabled={submitting}>
                    <Send /> {submitting ? "Đang nộp…" : sub ? "Nộp lại" : "Nộp bài"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
