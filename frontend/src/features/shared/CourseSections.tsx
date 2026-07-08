import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { fileHref } from "@/lib/api";
import type { Assignment, Material } from "@/types";

const NO_SECTION = "Chung";

/** Gom bài tập + tài liệu theo "mục" (section), mỗi mục gấp/mở được.
 *  Dùng chung cho trang lớp của sinh viên và giảng viên. */
export function CourseSections({
  assignments,
  materials,
  onOpenAssignment,
  assignmentExtra,
}: {
  assignments: Assignment[];
  materials: Material[];
  onOpenAssignment: (a: Assignment) => void;
  assignmentExtra?: (a: Assignment) => ReactNode;
}) {
  const order: string[] = [];
  const groups: Record<string, { assignments: Assignment[]; materials: Material[] }> = {};
  const ensure = (name?: string) => {
    const k = (name ?? "").trim() || NO_SECTION;
    if (!groups[k]) { groups[k] = { assignments: [], materials: [] }; order.push(k); }
    return groups[k];
  };
  assignments.forEach((a) => ensure(a.section).assignments.push(a));
  materials.forEach((m) => ensure(m.section).materials.push(m));

  if (order.length === 0) return null;
  return (
    <div className="space-y-3">
      {order.map((name) => (
        <SectionPanel key={name} name={name} group={groups[name]} onOpenAssignment={onOpenAssignment} assignmentExtra={assignmentExtra} />
      ))}
    </div>
  );
}

function SectionPanel({
  name, group, onOpenAssignment, assignmentExtra,
}: {
  name: string;
  group: { assignments: Assignment[]; materials: Material[] };
  onOpenAssignment: (a: Assignment) => void;
  assignmentExtra?: (a: Assignment) => ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const count = group.assignments.length + group.materials.length;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent/40">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{name}</span>
          <Badge variant="secondary" className="data">{count}</Badge>
        </div>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-2 border-t p-3">
          {group.assignments.map((a) => (
            <button key={a.id} onClick={() => onOpenAssignment(a)}
              className="group flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary hover:bg-accent/40">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">Bài tập · Hạn {formatDate(a.deadline)}</p>
              </div>
              {assignmentExtra?.(a)}
            </button>
          ))}
          {group.materials.map((m) => (
            <a key={m.id} href={fileHref(m.fileUrl)} target="_blank" rel="noreferrer"
              className="group flex items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FileText className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">Tài liệu · {formatDate(m.uploadedAt)}</p>
              </div>
              <Download className="size-4 text-muted-foreground" />
            </a>
          ))}
          {count === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Mục trống.</p>}
        </div>
      )}
    </div>
  );
}
