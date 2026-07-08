import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssignmentForm } from "./AssignmentForm";
import type { Assignment } from "@/types";

export function CreateAssignmentDialog({
  open,
  onOpenChange,
  courseId,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  onCreate: (a: Assignment) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo bài tập</DialogTitle>
          <DialogDescription>Soạn đề, đặt rubric và testcase. Bài lớp được chấm tự động sau hạn nộp.</DialogDescription>
        </DialogHeader>
        <AssignmentForm
          courseId={courseId}
          submitLabel="Tạo bài tập"
          onSubmit={async (a) => {
            await onCreate(a);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
