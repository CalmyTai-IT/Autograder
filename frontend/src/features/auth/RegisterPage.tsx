import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { authApi } from "@/lib/api";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { GraduationCap, Inbox, MailCheck, UserCog } from "lucide-react";
import type { Role } from "@/types";

export function RegisterPage() {
  const register = useAuth((s) => s.register);

  const [role, setRole] = useState<Role>("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const canSubmit =
    fullName.trim() && email.trim() && password.trim() && (role === "lecturer" || studentCode.trim());

  const submit = async () => {
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      await register({ fullName, email: email.trim(), password, role, studentCode: studentCode.trim() || undefined });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await authApi.resendVerification(email.trim());
      setResent(true);
    } catch { /* bỏ qua */ }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-success/12 text-success">
            <MailCheck className="size-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Xác nhận email của bạn</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Đã gửi <span className="font-medium text-foreground">mã xác nhận 6 số</span> tới{" "}
            <span className="font-medium text-foreground">{email}</span>. Nhập mã đó để kích hoạt tài khoản rồi đăng nhập.
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground">
            <Inbox className="mt-0.5 size-3.5 shrink-0" />
            <span>Email thường rơi vào thư mục <b>Spam</b> / <b>Quảng cáo (Promotions)</b> — hãy kiểm tra ở đó nếu Hộp thư đến không có.</span>
          </div>

          <Link to={`/xac-nhan-email?email=${encodeURIComponent(email)}`} className="mt-6 w-full">
            <Button className="w-full">Nhập mã xác nhận</Button>
          </Link>
          <button className="mt-4 text-sm text-muted-foreground hover:text-foreground" onClick={resend} disabled={resent}>
            {resent ? "Đã gửi lại mã" : "Không nhận được? Gửi lại mã"}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Tạo tài khoản</h2>
        <p className="text-sm text-muted-foreground">Chọn vai trò và điền thông tin để bắt đầu.</p>
      </div>

      <div className="mt-7 space-y-4">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div className="space-y-2">
          <Label>Bạn là</Label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "student", label: "Sinh viên", icon: GraduationCap },
              { value: "lecturer", label: "Giảng viên", icon: UserCog },
            ] as const).map((opt) => (
              <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                className={cn("flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all",
                  role === opt.value ? "border-primary bg-accent ring-1 ring-primary" : "border-input hover:bg-muted")}>
                <opt.icon className={cn("size-5", role === opt.value ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Họ và tên</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
        </div>

        {role === "student" && (
          <div className="space-y-2">
            <Label htmlFor="mssv">MSSV</Label>
            <Input id="mssv" className="data" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} placeholder="22120xxx" />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reg-email">Email trường</Label>
          <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={role === "student" ? "mssv@student.hcmus.edu.vn" : "ten@hcmus.edu.vn"} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-pass">Mật khẩu</Label>
          <Input id="reg-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
        </div>

        <Button className="w-full" onClick={submit} disabled={!canSubmit || loading}>
          {loading ? "Đang tạo…" : "Đăng ký"}
        </Button>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">Đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
