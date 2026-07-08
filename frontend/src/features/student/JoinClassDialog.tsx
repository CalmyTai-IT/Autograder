import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useContent } from "@/store/content";
import { AlertCircle } from "lucide-react";
import type { Course } from "@/types";

export function JoinClassDialog({
  open, onOpenChange, onJoined,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onJoined: (course: Course) => void;
}) {
  const joinCourse = useContent((s) => s.joinCourse);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setCode(""); setError(""); };

  const join = async () => {
    if (!code.trim()) return;
    setError("");
    setLoading(true);
    try {
      const course = await joinCourse(code.trim());
      onJoined(course);
      onOpenChange(false);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không vào được lớp");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vào lớp học</DialogTitle>
          <DialogDescription>Nhập mã lớp mà giảng viên đã cung cấp.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-2">
            <Label htmlFor="join-code">Mã lớp</Label>
            <Input id="join-code" className="data uppercase tracking-widest" placeholder="VD: CTDL-7K2P"
              value={code} onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()} autoFocus />
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4" /> {error}
            </p>
          )}
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button onClick={join} disabled={!code.trim() || loading}>{loading ? "Đang vào…" : "Vào lớp"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
