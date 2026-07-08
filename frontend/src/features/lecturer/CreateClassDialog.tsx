import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { currentAcademicYear, SEMESTERS, semesterLabel } from "@/lib/term";
import type { Semester } from "@/types";

export interface NewClassData {
  name: string;
  description: string;
  academicYear: string;
  semester: Semester;
}

export function CreateClassDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (data: NewClassData) => void;
}) {
  const yearOptions = useMemo(() => {
    const start = parseInt(currentAcademicYear().split("–")[0], 10);
    return [start + 1, start, start - 1].map((y) => `${y}–${y + 1}`);
  }, []);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [academicYear, setAcademicYear] = useState(yearOptions[1]);
  const [semester, setSemester] = useState<Semester>(2);

  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim(), academicYear, semester });
      setName("");
      setDescription("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo lớp mới</DialogTitle>
          <DialogDescription>Hệ thống sẽ tự sinh mã lớp để bạn gửi cho sinh viên.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="class-name">Tên môn học</Label>
            <Input
              id="class-name"
              placeholder="VD: Cấu trúc dữ liệu và Giải thuật"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Thời gian học: năm học + học kỳ */}
          <div className="space-y-2">
            <Label htmlFor="class-year">Năm học</Label>
            <select
              id="class-year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="data flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Học kỳ</Label>
            <div className="grid grid-cols-3 gap-2">
              {SEMESTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSemester(s)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-all",
                    semester === s ? "border-primary bg-accent text-primary ring-1 ring-primary" : "border-input hover:bg-muted"
                  )}
                >
                  {semesterLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="class-desc">Mô tả</Label>
            <Textarea
              id="class-desc"
              placeholder="Mô tả ngắn về nội dung môn học…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={!name.trim() || saving}>{saving ? "Đang tạo…" : "Tạo lớp"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
