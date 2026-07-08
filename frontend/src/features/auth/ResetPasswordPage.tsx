import { Navigate, useSearchParams } from "react-router-dom";

// Luồng đặt lại mật khẩu nay dùng MÃ và gộp vào trang /quen-mat-khau.
// Giữ route cũ này để các liên kết cũ vẫn chuyển hướng đúng (kèm theo email/mã nếu có).
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const qs = params.toString();
  return <Navigate to={`/quen-mat-khau${qs ? `?${qs}` : ""}`} replace />;
}
