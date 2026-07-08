import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, daysUntil, isSameDay } from "@/lib/utils";
import type { Assignment } from "@/types";

export interface CalendarItem extends Assignment {
  courseName: string;
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Trả về số ô trống đầu tháng (tuần bắt đầu Thứ 2) */
function leadingBlanks(year: number, month: number) {
  const first = new Date(year, month, 1).getDay(); // 0=CN
  return (first + 6) % 7;
}

export function DeadlineCalendar({
  items,
  onOpen,
}: {
  items: CalendarItem[];
  onOpen: (a: CalendarItem) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(today);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Gom deadline theo ngày
  const byDay = useMemo(() => {
    const map = new Map<number, CalendarItem[]>();
    for (const a of items) {
      const d = new Date(a.deadline);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const arr = map.get(d.getDate()) ?? [];
        arr.push(a);
        map.set(d.getDate(), arr);
      }
    }
    return map;
  }, [items, year, month]);

  const selectedItems = selected
    ? items
        .filter((a) => isSameDay(new Date(a.deadline), selected))
        .sort((x, y) => +new Date(x.deadline) - +new Date(y.deadline))
    : [];

  const monthLabel = cursor.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  return (
    <div className="rounded-lg border bg-card">
      {/* Header điều hướng tháng */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="font-semibold capitalize">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today); }}>
            Hôm nay
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Lưới ngày */}
      <div className="p-4">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks(year, month) }).map((_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(year, month, day);
            const dayItems = byDay.get(day) ?? [];
            const has = dayItems.length > 0;
            const overdue = has && daysUntil(date) < 0;
            const isToday = isSameDay(date, today);
            const isSelected = selected && isSameDay(date, selected);

            return (
              <button
                key={day}
                onClick={() => setSelected(date)}
                title={has ? dayItems.map((a) => a.courseName).join(", ") : undefined}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-colors",
                  isSelected ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted",
                  !isSelected && isToday && "ring-1 ring-primary text-primary font-semibold",
                  !isSelected && has && (overdue ? "bg-destructive/10" : "bg-accent")
                )}
              >
                <span className="data">{day}</span>
                {has && (
                  <span
                    className={cn(
                      "absolute bottom-1 size-1.5 rounded-full",
                      isSelected ? "bg-primary-foreground" : overdue ? "bg-destructive" : "bg-primary"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Danh sách bài của ngày được chọn */}
      <div className="border-t p-4">
        <p className="mb-3 text-sm font-medium">
          {selected
            ? selected.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" })
            : "Chọn một ngày"}
        </p>

        {selectedItems.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            Không có deadline
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((a) => {
              const left = daysUntil(a.deadline);
              return (
                <li key={a.id}>
                  <button
                    onClick={() => onOpen(a)}
                    className="group flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:border-primary hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.courseName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={left < 0 ? "destructive" : left <= 2 ? "warning" : "secondary"}>
                        {left < 0 ? "Đã quá hạn" : left === 0 ? "Hôm nay" : `Còn ${left} ngày`}
                      </Badge>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export { EmptyState };
