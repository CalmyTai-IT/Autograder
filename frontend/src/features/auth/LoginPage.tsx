import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      navigate(user.role === "lecturer" ? "/gv" : "/sv");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Đăng nhập</h2>
        <p className="text-sm text-muted-foreground">Chào mừng quay lại. Đăng nhập để tiếp tục.</p>
      </div>

      <div className="mt-7 space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
            {/xác nhận/i.test(error) && (
              <Link
                to={`/xac-nhan-email?email=${encodeURIComponent(email.trim())}`}
                className="mt-1 block font-medium underline underline-offset-2"
              >
                Nhập mã xác nhận email →
              </Link>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="mssv@student.hcmus.edu.vn" value={email}
            onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mật khẩu</Label>
            <button type="button" onClick={() => navigate("/quen-mat-khau")} className="text-xs text-primary hover:underline">
              Quên mật khẩu?
            </button>
          </div>
          <Input id="password" type="password" placeholder="••••••••" value={password}
            onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>

        <Button className="w-full" onClick={submit} disabled={loading || !email.trim() || !password}>
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">Đăng ký</Link>
      </p>
    </AuthLayout>
  );
}
