import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { defaultRubric } from "@/lib/rubric";
import { assignmentsApi } from "@/lib/api";
import { FileUp, Plus, Trash2, Upload } from "lucide-react";
import type { Assignment, AssignmentSource, Rubric, Testcase } from "@/types";

const pad = (n: number) => String(n).padStart(2, "0");
function toLocal(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return toLocal(d.toISOString());
}

export function AssignmentForm({
  initial,
  courseId,
  onSubmit,
  submitLabel,
}: {
  initial?: Assignment;
  courseId: string;
  onSubmit: (a: Assignment) => void | Promise<void>;
  submitLabel: string;
}) {
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tcFileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [source, setSource] = useState<AssignmentSource>(initial?.source ?? "text");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pdfName, setPdfName] = useState(initial?.pdfUrl ? "Đề bài.pdf" : "");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [section, setSection] = useState(initial?.section ?? "");
  const [deadline, setDeadline] = useState(initial ? toLocal(initial.deadline) : defaultDeadline());
  const [rubric, setRubric] = useState<Rubric>(initial?.rubric ?? defaultRubric());
  const [testcases, setTestcases] = useState<Testcase[]>(initial?.testcases ?? [{ id: `t-${Date.now()}`, input: "", expectedOutput: "" }]);

  const setR = (patch: Partial<Rubric>) => setRubric((r) => ({ ...r, ...patch }));

  const addTc = () => setTestcases((ts) => [...ts, { id: `t-${Date.now()}-${ts.length}`, input: "", expectedOutput: "" }]);
  const rmTc = (id: string) => setTestcases((ts) => ts.filter((t) => t.id !== id));
  const setTc = (id: string, patch: Partial<Testcase>) => setTestcases((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const importTc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(String(reader.result));
        if (Array.isArray(arr)) {
          setTestcases(
            arr.map((x: { input?: string; output?: string; expectedOutput?: string }, i: number) => ({
              id: `t-imp-${Date.now()}-${i}`,
              input: String(x.input ?? ""),
              expectedOutput: String(x.expectedOutput ?? x.output ?? ""),
            }))
          );
        }
      } catch {
        // bỏ qua file sai định dạng
      }
    };
    reader.readAsText(f);
  };

  const canSubmit = title.trim() && (source === "text" ? description.trim() : pdfName);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      let pdfUrl = source === "pdf" ? initial?.pdfUrl : undefined;
      if (source === "pdf" && pdfFile) {
        const up = await assignmentsApi.uploadFile(pdfFile);
        pdfUrl = up.url;
      }
      const a: Assignment = {
        id: initial?.id ?? `a-${Date.now()}`,
        courseId,
        title: title.trim(),
        source,
        description: source === "text" ? description : undefined,
        pdfUrl,
        section: section.trim() || undefined,
        deadline: new Date(deadline).toISOString(),
        rubric,
        testcases: testcases.filter((t) => t.input.trim() || t.expectedOutput.trim()),
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      };
      await onSubmit(a);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thông tin chung */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="a-title">Tiêu đề</Label>
          <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Bài tập tuần 1 — Sắp xếp" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="a-section">Mục (tuỳ chọn)</Label>
          <Input id="a-section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="VD: Tuần 1 — gom chung với tài liệu cùng mục" />
        </div>

        <div className="space-y-2">
          <Label>Đề bài</Label>
          <div className="inline-flex rounded-lg border bg-card p-1">
            {(["text", "pdf"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  source === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "text" ? "Nhập văn bản" : "Tải PDF"}
              </button>
            ))}
          </div>

          {source === "text" ? (
            <Textarea className="min-h-32" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả đề bài, định dạng input/output…" />
          ) : (
            <div>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setPdfFile(f); setPdfName(f?.name ?? ""); }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed py-6 transition-colors hover:border-primary hover:bg-accent/30"
              >
                <FileUp className="size-6 text-muted-foreground" />
                <span className="text-sm font-medium">{pdfName || "Chọn file PDF đề bài"}</span>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="a-deadline">Hạn nộp</Label>
          <Input id="a-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-auto" />
        </div>
      </div>

      {/* Rubric */}
      <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
        <p className="font-semibold">Rubric chấm điểm</p>

        {/* Testcase weight (suy từ complexity) */}
        <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Testcase</p>
            <p className="text-xs text-muted-foreground">Trọng số tự tính để tổng = 100%</p>
          </div>
          <span className="data text-lg font-bold text-primary">{rubric.testcaseWeight}%</span>
        </div>

        {/* Complexity */}
        <div className="rounded-md border bg-card px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Độ phức tạp thuật toán</p>
              <p className="text-xs text-muted-foreground">Đo bằng phương pháp, không gọi API</p>
            </div>
            <Switch
              checked={rubric.complexityEnabled}
              onCheckedChange={(v) =>
                setR(v ? { complexityEnabled: true, complexityWeight: 20, testcaseWeight: 80 } : { complexityEnabled: false, complexityWeight: 0, testcaseWeight: 100 })
              }
            />
          </div>

          {rubric.complexityEnabled && (
            <div className="mt-3 space-y-3 border-t pt-3">
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-xs text-muted-foreground">Trọng số</Label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={rubric.complexityWeight}
                  onChange={(e) => {
                    const w = Number(e.target.value);
                    setR({ complexityWeight: w, testcaseWeight: 100 - w });
                  }}
                  className="flex-1 accent-[hsl(var(--primary))]"
                />
                <span className="data w-10 text-right text-sm font-medium">{rubric.complexityWeight}%</span>
              </div>

              {/* Thang điểm theo lớp độ phức tạp */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Thang điểm theo lớp độ phức tạp</p>
                {rubric.complexityTiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={tier.label}
                      onChange={(e) => {
                        const tiers = [...rubric.complexityTiers];
                        tiers[i] = { ...tiers[i], label: e.target.value };
                        setR({ complexityTiers: tiers });
                      }}
                      className="data h-8 flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={tier.maxPercent}
                        onChange={(e) => {
                          const tiers = [...rubric.complexityTiers];
                          tiers[i] = { ...tiers[i], maxPercent: Number(e.target.value) };
                          setR({ complexityTiers: tiers });
                        }}
                        className="data h-8 w-20"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => setR({ complexityTiers: rubric.complexityTiers.filter((_, j) => j !== i) })}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setR({ complexityTiers: [...rubric.complexityTiers, { label: "O(?)", maxPercent: 0 }] })}>
                  <Plus /> Thêm mức
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Plagiarism — gate */}
        <div className="rounded-md border bg-card px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Chống gian lận</p>
              <p className="text-xs text-muted-foreground">Vượt ngưỡng giống nhau → 0 điểm (không tính trọng số)</p>
            </div>
            <Switch checked={rubric.plagiarismEnabled} onCheckedChange={(v) => setR({ plagiarismEnabled: v })} />
          </div>
          {rubric.plagiarismEnabled && (
            <div className="mt-3 flex items-center gap-3 border-t pt-3">
              <Label className="w-28 shrink-0 text-xs text-muted-foreground">Ngưỡng giống</Label>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={rubric.plagiarismThreshold}
                onChange={(e) => setR({ plagiarismThreshold: Number(e.target.value) })}
                className="flex-1 accent-[hsl(var(--primary))]"
              />
              <span className="data w-10 text-right text-sm font-medium">{rubric.plagiarismThreshold}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Testcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Testcase</p>
          <div className="flex gap-2">
            <input ref={tcFileRef} type="file" accept=".json" className="hidden" onChange={importTc} />
            <Button variant="outline" size="sm" onClick={() => tcFileRef.current?.click()}>
              <Upload /> Nhập từ file
            </Button>
            <Button variant="outline" size="sm" onClick={addTc}>
              <Plus /> Thêm
            </Button>
          </div>
        </div>

        <p className="rounded-md border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">
          Testcase <b>không ẩn</b> = ví dụ hiển thị cho SV (SV chạy thử được). <b>Ẩn với SV</b> = chỉ dùng để chấm. Nên để vài ví dụ public để SV biết định dạng input/output.
          <br />So khớp <b>linh hoạt</b>: bỏ qua khoảng trắng, xuống dòng, ngoặc <code>[]()</code> và dấu phẩy — vd <span className="data">[1, 2, 3]</span> vẫn khớp <span className="data">1 2 3</span>. Dù vậy, hãy ghi “Output mong đợi” đúng định dạng đề yêu cầu.
        </p>
        <div className="space-y-3">
          {testcases.map((t, i) => (
            <div key={t.id} className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="data text-sm font-medium text-muted-foreground">Testcase {i + 1}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch checked={!!t.hidden} onCheckedChange={(v) => setTc(t.id, { hidden: v })} /> Ẩn với SV
                  </label>
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => rmTc(t.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Textarea value={t.input} onChange={(e) => setTc(t.id, { input: e.target.value })} placeholder="Input" className="data min-h-20 text-xs" />
                <Textarea value={t.expectedOutput} onChange={(e) => setTc(t.id, { expectedOutput: e.target.value })} placeholder="Output mong đợi" className="data min-h-20 text-xs" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">File JSON dạng: <span className="data">[{`{ "input": "...", "expectedOutput": "..." }`}]</span></p>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={!canSubmit || saving}>{saving ? "Đang lưu…" : submitLabel}</Button>
      </div>
    </div>
  );
}
