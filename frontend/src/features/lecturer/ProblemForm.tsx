import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Upload } from "lucide-react";
import type { Difficulty, Problem, Testcase } from "@/types";

const DIFFS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Dễ" },
  { value: "medium", label: "Trung bình" },
  { value: "hard", label: "Khó" },
];

export function ProblemForm({
  initial,
  createdById,
  onSubmit,
  submitLabel,
}: {
  initial?: Problem;
  createdById: string;
  onSubmit: (p: Problem) => void | Promise<void>;
  submitLabel: string;
}) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "easy");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [testcases, setTestcases] = useState<Testcase[]>(initial?.testcases ?? [{ id: `pt-${Date.now()}`, input: "", expectedOutput: "" }]);

  const addTc = () => setTestcases((ts) => [...ts, { id: `pt-${Date.now()}-${ts.length}`, input: "", expectedOutput: "" }]);
  const rmTc = (id: string) => setTestcases((ts) => ts.filter((t) => t.id !== id));
  const setTc = (id: string, patch: Partial<Testcase>) => setTestcases((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  // Nhập testcase từ file JSON: chấp nhận mảng [{input, expectedOutput, hidden?}]
  // (cũng nhận khoá thay thế: stdin / output / expected).
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const arr: any[] = Array.isArray(data) ? data : data?.testcases;
      if (!Array.isArray(arr)) throw new Error("File JSON phải là một mảng testcase.");
      const mapped: Testcase[] = arr.map((t, i) => ({
        id: `pt-${Date.now()}-${i}`,
        input: String(t.input ?? t.stdin ?? ""),
        expectedOutput: String(t.expectedOutput ?? t.output ?? t.expected ?? ""),
        hidden: !!t.hidden,
      }));
      if (!mapped.length) throw new Error("Không tìm thấy testcase nào trong file.");
      setTestcases(mapped);
      setImportMsg(`Đã nhập ${mapped.length} testcase từ JSON.`);
    } catch (e) {
      setImportMsg(`Lỗi: ${e instanceof Error ? e.message : "File JSON không hợp lệ"}`);
    }
  };

  const canSubmit = title.trim() && description.trim();

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSubmit({
      id: initial?.id ?? `p-${Date.now()}`,
      title: title.trim(),
      difficulty,
      description: description.trim(),
      testcases: testcases.filter((t) => t.input.trim() || t.expectedOutput.trim()),
      createdById: initial?.createdById ?? createdById,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="p-title">Tiêu đề</Label>
        <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Tổng hai số" />
      </div>

      <div className="space-y-2">
        <Label>Độ khó</Label>
        <div className="inline-flex rounded-lg border bg-card p-1">
          {DIFFS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDifficulty(d.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                difficulty === d.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-desc">Mô tả đề bài</Label>
        <Textarea id="p-desc" className="min-h-32" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả yêu cầu, ràng buộc, ví dụ…" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Testcase</Label>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload /> Nhập JSON</Button>
            <Button variant="outline" size="sm" onClick={addTc}><Plus /> Thêm</Button>
          </div>
        </div>

        <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Input</span> được nạp thẳng vào <span className="font-medium text-foreground">stdin</span>;
            <span className="font-medium text-foreground"> Output</span> so với <span className="font-medium text-foreground">stdout</span> (bỏ qua khoảng trắng thừa cuối dòng).
          </p>
          <p className="mt-1">
            Với <span className="font-medium text-foreground">mảng</span>: tự quy ước định dạng và ghi rõ trong đề. Ví dụ — dòng 1 là <code>n</code>, dòng 2 là <code>n</code> số cách nhau bởi dấu cách:
          </p>
          <pre className="data mt-1 rounded bg-card p-2 text-[11px] leading-snug">{`Input:            Output:
3                 6
1 2 3`}</pre>
          <p className="mt-1">
            So khớp <span className="font-medium text-foreground">linh hoạt</span>: bỏ qua khoảng trắng, xuống dòng, ngoặc <code>[]()</code> và dấu phẩy — vd <code>[1, 2, 3]</code> vẫn khớp <code>1 2 3</code>. Dù vậy nên ghi kết quả mong đợi đúng định dạng đề.
          </p>
          <p className="mt-1">
            File JSON mẫu: <code className="break-all">{`[{ "input": "3\\n1 2 3", "expectedOutput": "6" }, { "input": "2\\n5 7", "expectedOutput": "12", "hidden": true }]`}</code>
          </p>
          {importMsg && <p className={cn("mt-2 font-medium", importMsg.startsWith("Lỗi") ? "text-destructive" : "text-foreground")}>{importMsg}</p>}
        </div>
        {testcases.map((t, i) => (
          <div key={t.id} className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="data text-sm font-medium text-muted-foreground">Testcase {i + 1}</span>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => rmTc(t.id)}><Trash2 /></Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Textarea value={t.input} onChange={(e) => setTc(t.id, { input: e.target.value })} placeholder="Input" className="data min-h-16 text-xs" />
              <Textarea value={t.expectedOutput} onChange={(e) => setTc(t.id, { expectedOutput: e.target.value })} placeholder="Output mong đợi" className="data min-h-16 text-xs" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={!canSubmit || saving}>{saving ? "Đang lưu…" : submitLabel}</Button>
      </div>
    </div>
  );
}
