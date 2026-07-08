import { useToasts } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CheckCircle2, Info, XCircle } from "lucide-react";

const STYLE = {
  success: { icon: CheckCircle2, cls: "border-success/30 bg-success/10 text-success" },
  error: { icon: XCircle, cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  info: { icon: Info, cls: "border-border bg-card text-foreground" },
} as const;

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const s = STYLE[t.kind];
        const Icon = s.icon;
        return (
          <div key={t.id} onClick={() => dismiss(t.id)}
            className={cn(
              "pointer-events-auto flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm font-medium shadow-lg backdrop-blur",
              "animate-in slide-in-from-bottom-2 fade-in",
              s.cls
            )}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="leading-snug">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
