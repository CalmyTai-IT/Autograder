import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { CheckCircle2, FileCode2, ShieldCheck } from "lucide-react";

const points = [
  { icon: FileCode2, text: "Nộp code, chấm tự động bằng testcase + AI" },
  { icon: ShieldCheck, text: "Phát hiện gian lận theo độ giống nhau" },
  { icon: CheckCircle2, text: "Nhận xét chi tiết và điểm theo rubric" },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panel thương hiệu */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <Logo className="relative [&_span]:text-primary-foreground [&_div:first-child]:bg-primary-foreground [&_div:first-child]:text-primary [&_.text-primary]:!text-primary-foreground/70" />

        <div className="relative space-y-6">
          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            Chấm bài lập trình tự động, công bằng và minh bạch.
          </h1>
          <ul className="space-y-3">
            {points.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-primary-foreground/90">
                <p.icon className="size-5 shrink-0" />
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative" />
      </div>

      {/* Panel form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
