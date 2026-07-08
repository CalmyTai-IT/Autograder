import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useAuth } from "@/store/auth";
import { useContent } from "@/store/content";
import { useSubmissions } from "@/store/submissions";
import { problemsApi } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { BackButton } from "@/components/layout/BackButton";
import { DifficultyBadge } from "@/features/shared/problem-bits";
import { AiCommentBox, CodeBlock, ScorePill } from "./result-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Code2, History, Loader2, Play, Plus, Send, X } from "lucide-react";
import type { ProblemSubmission } from "@/types";

const LANGS = [
  {
    value: "python", label: "Python",
    starter: `import sys
data = sys.stdin.buffer.read().split()
# data là danh sách các "từ" đọc từ bàn phím (stdin).
# Ví dụ đề: dòng 1 là n, dòng 2 là n số.
# n = int(data[0]); a = list(map(int, data[1:1+n]))
# print(ket_qua)   # in kết quả ra màn hình (stdout)
`,
  },
  {
    value: "cpp", label: "C++",
    starter: `#include <bits/stdc++.h>
using namespace std;
int main() {
    // Đọc bằng cin, in bằng cout
    // int n; cin >> n; ... cout << ket_qua << "\\n";
    return 0;
}
`,
  },
  {
    value: "java", label: "Java",
    starter: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Đọc bằng sc, in bằng System.out.println()
        // int n = sc.nextInt(); ... System.out.println(ketQua);
    }
}
`,
  },
];

type RunCase = { id: string; input: string; expectedOutput: string; locked: boolean };
type RunResult = { index: number; input: string; expected?: string; actual: string; stderr?: string; status: string };

const MAX_CASES = 12;
const SAMPLE_LIMIT = 3;

function RunBadge({ status }: { status: string }) {
  const map: Record<string, { v: "success" | "destructive" | "warning" | "secondary"; t: string }> = {
    pass: { v: "success", t: "Đúng" },
    wrong: { v: "destructive", t: "Sai" },
    runtime_error: { v: "destructive", t: "Lỗi chạy" },
    timeout: { v: "warning", t: "Quá giờ" },
    no_expected: { v: "secondary", t: "Đã chạy" },
  };
  const m = map[status] ?? { v: "secondary", t: status };
  return <Badge variant={m.v} className="data text-[10px]">{m.t}</Badge>;
}

export function PracticeDetailPage() {
  const { problemId } = useParams();
  const user = useAuth((s) => s.user);

  const problems = useContent((s) => s.problems);
  const loadProblem = useContent((s) => s.loadProblem);
  const problemSubs = useSubmissions((s) => s.problemSubs);
  const loadProblemSubs = useSubmissions((s) => s.loadProblemSubs);
  const submitProblem = useSubmissions((s) => s.submitProblem);

  const problem = problems.find((p) => p.id === problemId);
  const [lang, setLang] = useState(LANGS[0]);
  const [code, setCode] = useState(LANGS[0].starter);

  const [cases, setCases] = useState<RunCase[]>([]);
  const [activeCase, setActiveCase] = useState(0);
  const [running, setRunning] = useState(false);
  const [runResults, setRunResults] = useState<RunResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const seeded = useRef(false);

  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<ProblemSubmission | null>(null);

  useEffect(() => {
    if (!problemId) return;
    void loadProblem(problemId);
    void loadProblemSubs(problemId);
  }, [problemId, loadProblem, loadProblemSubs]);

  // Khởi tạo tối đa 3 testcase mẫu (lần đầu problem có dữ liệu)
  useEffect(() => {
    if (seeded.current || !problem) return;
    const samples = problem.testcases.filter((t) => !t.hidden).slice(0, SAMPLE_LIMIT)
      .map((t, i) => ({ id: `c-${i}`, input: t.input, expectedOutput: t.expectedOutput, locked: true }));
    setCases(samples.length ? samples : [{ id: "c-0", input: "", expectedOutput: "", locked: false }]);
    seeded.current = true;
  }, [problem]);

  const history = useMemo(
    () => problemSubs.filter((s) => s.problemId === problemId)
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt)),
    [problemSubs, problemId]
  );

  if (!problem) {
    return (<div><BackButton to="/sv" /><EmptyState title="Không tìm thấy bài tập" /></div>);
  }

  const clearRun = () => setRunResults(null);
  const changeLang = (value: string) => {
    const l = LANGS.find((x) => x.value === value) ?? LANGS[0];
    setLang(l); setCode(l.starter); clearRun();
  };
  const addCase = () => {
    if (cases.length >= MAX_CASES) return;
    const id = `c-${Date.now()}`;
    setCases((cs) => [...cs, { id, input: "", expectedOutput: "", locked: false }]);
    setActiveCase(cases.length);
    clearRun();
  };
  const removeCase = (id: string) => {
    setCases((cs) => {
      const next = cs.filter((c) => c.id !== id);
      setActiveCase((a) => Math.max(0, Math.min(a, next.length - 1)));
      return next;
    });
    clearRun();
  };
  const updateCase = (id: string, patch: Partial<RunCase>) => {
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    clearRun();
  };

  const runSamplesNow = async () => {
    if (!cases.length) return;
    setRunning(true); setRunError(null); setRunResults(null);
    try {
      const res = await problemsApi.run(problem.id, {
        language: lang.value, code,
        cases: cases.map((c) => ({ input: c.input, expectedOutput: c.expectedOutput || undefined })),
      });
      if (res.compileError) setRunError(res.errorSummary || "Code không biên dịch được.");
      else setRunResults(res.cases);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Lỗi khi chạy thử.");
    } finally {
      setRunning(false);
    }
  };

  const submitSolution = async () => {
    if (!user) return;
    setGrading(true); setResult(null);
    try {
      await submitProblem({ problemId: problem.id, language: lang.value, code });
      const subs = useSubmissions.getState().getProblemSubs(problem.id);
      setResult(subs[0] ?? null);
    } finally {
      setGrading(false);
    }
  };

  const active = cases[activeCase];
  const activeResult = runResults?.find((r) => r.index === activeCase) ?? null;
  const passedCount = runResults?.filter((r) => r.status === "pass").length ?? 0;
  const scorable = runResults?.filter((r) => r.status !== "no_expected").length ?? 0;

  return (
    <div>
      <BackButton to="/sv" />

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{problem.title}</h1>
        <DifficultyBadge difficulty={problem.difficulty} />
      </div>

      <Tabs defaultValue="solve">
        <TabsList>
          <TabsTrigger value="solve"><Code2 /> Đề bài & nộp</TabsTrigger>
          <TabsTrigger value="history"><History /> Lịch sử chấm {history.length > 0 && <Badge variant="secondary" className="data ml-1">{history.length}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="solve">
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            {/* CỘT TRÁI: đề bài + testcase + kết quả nộp */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Mô tả</CardTitle></CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{problem.description}</p>
                </CardContent>
              </Card>

              {/* PANEL TESTCASE kiểu LeetCode */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Testcase</CardTitle>
                    {runResults && (
                      <span className="data text-xs text-muted-foreground">
                        {scorable > 0 ? `${passedCount}/${scorable} đúng` : "đã chạy"}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* dải tab các case */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {cases.map((c, i) => {
                      const r = runResults?.find((x) => x.index === i);
                      const dot = r ? (r.status === "pass" ? "bg-success" : r.status === "no_expected" ? "bg-muted-foreground/60" : "bg-destructive") : null;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setActiveCase(i)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            activeCase === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
                          Case {i + 1}
                          {!c.locked && (
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); removeCase(c.id); }}
                              className="-mr-1 ml-0.5 rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100"
                            >
                              <X className="size-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {cases.length < MAX_CASES && (
                      <button type="button" onClick={addCase}
                        className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                        <Plus className="size-3" /> Thêm
                      </button>
                    )}
                  </div>

                  {/* nội dung case đang chọn */}
                  {active && (
                    <div className="space-y-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Input {active.locked && <span className="font-normal">(mẫu)</span>}</p>
                        <Textarea
                          value={active.input}
                          readOnly={active.locked}
                          onChange={(e) => updateCase(active.id, { input: e.target.value })}
                          placeholder={"Dữ liệu nạp vào stdin"}
                          className={cn("data min-h-14 text-xs", active.locked && "bg-muted/40")}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Kết quả mong đợi {active.locked ? "" : <span className="font-normal">(tuỳ chọn)</span>}
                        </p>
                        <Textarea
                          value={active.expectedOutput}
                          readOnly={active.locked}
                          onChange={(e) => updateCase(active.id, { expectedOutput: e.target.value })}
                          placeholder={active.locked ? "" : "Để trống nếu chỉ muốn xem output"}
                          className={cn("data min-h-10 text-xs", active.locked && "bg-muted/40")}
                        />
                      </div>

                      {activeResult && (
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">Output máy chạy</p>
                            <RunBadge status={activeResult.status} />
                          </div>
                          <pre className="data max-h-32 overflow-auto rounded-lg border bg-muted/40 p-2 text-xs">
                            {activeResult.actual || "(không có output)"}
                          </pre>
                          {activeResult.stderr && (
                            <pre className="data mt-1 max-h-28 overflow-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                              {activeResult.stderr}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {runError && (
                    <pre className="data max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                      {runError}
                    </pre>
                  )}
                </CardContent>
              </Card>

              {grading && (
                <Card>
                  <CardContent className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Đang chấm bài…
                  </CardContent>
                </Card>
              )}
              {result && !grading && (
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle>Kết quả chấm</CardTitle>
                    <Badge variant={result.passedTests === result.totalTests ? "success" : "warning"} className="data">
                      {result.passedTests}/{result.totalTests} testcase
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ScorePill score={result.score} />
                    <AiCommentBox comment={result.aiComment} />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* CỘT PHẢI: editor */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <select value={lang.value} onChange={(e) => changeLang(e.target.value)}
                  className="h-8 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {LANGS.map((l) => (<option key={l.value} value={l.value}>{l.label}</option>))}
                </select>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={runSamplesNow} disabled={running || grading}>
                    {running ? <Loader2 className="animate-spin" /> : <Play />} Chạy thử
                  </Button>
                  <Button size="sm" onClick={submitSolution} disabled={grading || running}>
                    {grading ? <Loader2 className="animate-spin" /> : <Send />} Chạy & nộp
                  </Button>
                </div>
              </div>
              <div className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Đọc dữ liệu từ <span className="font-medium text-foreground">stdin</span> (bàn phím) và in kết quả ra{" "}
                <span className="font-medium text-foreground">stdout</span> bằng <code>print</code>/<code>cout</code>/<code>System.out</code>.
                Không viết kiểu hàm trả về — input được nạp qua bàn phím.
              </div>
              <Editor height="440px" language={lang.value} value={code}
                onChange={(v) => { setCode(v ?? ""); clearRun(); }}
                theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, padding: { top: 12 } }} />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? (
            <EmptyState icon={<History />} title="Chưa có lần nộp nào" description="Giải bài và nộp để xem lịch sử chấm ở đây." />
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <Card key={h.id}>
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ScorePill score={h.score} />
                        <div>
                          <Badge variant={h.passedTests === h.totalTests ? "success" : "warning"} className="data">
                            {h.passedTests}/{h.totalTests} testcase
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(h.submittedAt)} · {h.language}</p>
                        </div>
                      </div>
                    </div>
                    <AiCommentBox comment={h.aiComment} />
                    <details className="group">
                      <summary className="cursor-pointer list-none text-sm text-primary hover:underline">Xem code đã nộp</summary>
                      <div className="mt-2"><CodeBlock code={h.code} /></div>
                    </details>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
