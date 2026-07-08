import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "@/lib/api";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, Inbox } from "lucide-react";

export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Nếu mở từ link trong email (?email=&code=) → vào thẳng bước nhập mật khẩu mới.
  const prefillEmail = params.get("email") ?? "";
  const prefillCode = (params.get("code") ?? "").replace(/\D/g, "").slice(0, 6);

  const [phase, setPhase] = useState<"request" | "reset" | "done">(prefillCode ? "reset" : "request");
  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState(prefillCode);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  // Bước 1: gửi mã về email
  const sendCode = async () => {
    if (!email.trim()) return;
    setError(""); setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setPhase("reset");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email.trim()) return;
    try { await authApi.forgotPassword(email.trim()); setResent(true); } catch { /* bỏ qua */ }
  };

  // Bước 2: nhập mã + mật khẩu mới
  const reset = async () => {
    setError("");
    if (!email.trim() || code.length < 6) { setError("Nhập email và mã 6 số."); return; }
    if (password.length < 6) { setError("Mật khẩu tối thiểu 6 ký tự."); return; }
    if (password !== confirm) { setError("Mật khẩu nhập lại không khớp."); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(email.trim(), code.trim(), password);
      setPhase("done");
      setTimeout(() => navigate("/login"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đặt lại thất bại");
    } finally {
      setLoading(false);
    }
  };

  if (phase === "done") {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-success/12 text-success">
            <CheckCircle2 className="size-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Đã đặt lại mật khẩu</h2>
          <p className="mt-2 text-sm text-muted-foreground">Đang chuyển tới trang đăng nhập…</p>
        </div>
      </AuthLayout>
    );
  }

  if (phase === "reset") {
    return (
      <AuthLayout>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight">Đặt lại mật khẩu</h2>
          <p className="text-sm text-muted-foreground">Nhập mã 6 số đã gửi tới email, rồi đặt mật khẩu mới.</p>
        </div>

        <div className="mt-7 space-y-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="rp-email">Email</Label>
            <Input id="rp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="mssv@student.hcmus.edu.vn" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rp-code">Mã xác nhận</Label>
            <Input id="rp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000" className="data text-center text-xl font-semibold tracking-[0.5em]" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rp-pass">Mật khẩu mới</Label>
            <Input id="rp-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-confirm">Nhập lại mật khẩu</Label>
            <Input id="rp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && reset()} placeholder="••••••••" />
          </div>

          <Button className="w-full" onClick={reset} disabled={loading || code.length < 6 || !password || !confirm}>
            {loading ? "Đang đặt lại…" : "Đặt lại mật khẩu"}
          </Button>

          <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Inbox className="mt-0.5 size-3.5 shrink-0" />
            <span>Không thấy mã? Hãy kiểm tra thư mục <b>Spam</b> / <b>Quảng cáo (Promotions)</b>.</span>
          </div>

          <button className="w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={resend} disabled={resent}>
            {resent ? "Đã gửi lại mã" : "Gửi lại mã"}
          </button>
        </div>

        <p className="mt-8 text-center text-sm">
          <Link to="/login" className="font-medium text-muted-foreground hover:text-foreground">← Quay lại đăng nhập</Link>
        </p>
      </AuthLayout>
    );
  }

  // phase === "request"
  return (
    <AuthLayout>
      <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Quay lại đăng nhập
      </Link>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Quên mật khẩu</h2>
        <p className="text-sm text-muted-foreground">Nhập email tài khoản, chúng tôi sẽ gửi mã 6 số để đặt lại mật khẩu.</p>
      </div>
      <div className="mt-7 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fp-email">Email</Label>
          <Input id="fp-email" type="email" placeholder="mssv@student.hcmus.edu.vn" value={email}
            onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCode()} autoFocus />
        </div>
        <Button className="w-full" onClick={sendCode} disabled={loading || !email.trim()}>
          {loading ? "Đang gửi…" : "Gửi mã đặt lại"}
        </Button>
        <button className="w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setPhase("reset")}>
          Đã có mã? Nhập mã
        </button>
      </div>
    </AuthLayout>
  );
}
