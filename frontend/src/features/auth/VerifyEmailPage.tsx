import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "@/lib/api";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Inbox } from "lucide-react";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState((params.get("code") ?? "").replace(/\D/g, "").slice(0, 6));
  const [ok, setOk] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const autoTried = useRef(false); // chặn auto-xác nhận chạy 2 lần (React StrictMode)

  const verify = async (em = email, cd = code) => {
    const e = em.trim();
    const c = cd.trim();
    if (!e || c.length < 6) { setError("Vui lòng nhập email và mã 6 số."); return; }
    setError(""); setLoading(true);
    try {
      const r = await authApi.verifyEmail(e, c);
      setOk(true); setMessage(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác nhận thất bại");
    } finally {
      setLoading(false);
    }
  };

  // Nếu mở từ link có sẵn email + mã → tự xác nhận MỘT lần cho tiện.
  // (Backend idempotent nên kể cả gọi lại cũng không báo lỗi giả.)
  useEffect(() => {
    const e = params.get("email");
    const c = (params.get("code") ?? "").replace(/\D/g, "");
    if (e && c.length === 6 && !autoTried.current) {
      autoTried.current = true;
      void verify(e, c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async () => {
    if (!email.trim()) { setError("Nhập email để gửi lại mã."); return; }
    try { await authApi.resendVerification(email.trim()); setResent(true); } catch { /* bỏ qua */ }
  };

  if (ok) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-success/12 text-success">
            <CheckCircle2 className="size-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Xác nhận thành công</h2>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Button className="mt-7 w-full" onClick={() => navigate("/login")}>Đăng nhập</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Xác nhận email</h2>
        <p className="text-sm text-muted-foreground">Nhập email và mã 6 số chúng tôi vừa gửi cho bạn.</p>
      </div>

      <div className="mt-7 space-y-4">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="space-y-2">
          <Label htmlFor="ve-email">Email</Label>
          <Input id="ve-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="mssv@student.hcmus.edu.vn" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ve-code">Mã xác nhận</Label>
          <Input id="ve-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="000000" className="data text-center text-xl font-semibold tracking-[0.5em]" />
        </div>

        <Button className="w-full" onClick={() => verify()} disabled={loading || !email.trim() || code.length < 6}>
          {loading ? "Đang xác nhận…" : "Xác nhận"}
        </Button>

        <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Inbox className="mt-0.5 size-3.5 shrink-0" />
          <span>Không thấy email? Hãy kiểm tra thư mục <b>Spam</b> / <b>Quảng cáo (Promotions)</b> và đánh dấu “Không phải spam”.</span>
        </div>

        <button className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={resend} disabled={resent}>
          {resent ? "Đã gửi lại mã" : "Không nhận được mã? Gửi lại"}
        </button>
      </div>

      <p className="mt-8 text-center text-sm">
        <Link to="/login" className="font-medium text-muted-foreground hover:text-foreground">← Quay lại đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
