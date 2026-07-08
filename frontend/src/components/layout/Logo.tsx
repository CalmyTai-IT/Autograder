import { cn } from "@/lib/utils";

/** Dấu </> + check: vừa code vừa "đã chấm" — signature của brand */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
          <path d="M9 8L5.5 11.5L9 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 8L18.5 11.5L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 17.5L13.2 19.5L17 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        </svg>
      </div>
      <span className="text-lg font-bold tracking-tight">
        Auto<span className="text-primary">Grade</span>
      </span>
    </div>
  );
}
