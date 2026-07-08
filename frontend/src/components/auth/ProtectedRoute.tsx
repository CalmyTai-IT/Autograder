import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/store/auth";
import type { Role } from "@/types";

export function ProtectedRoute({ role }: { role?: Role }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    // Sai role → đưa về dashboard đúng của họ
    return <Navigate to={user.role === "lecturer" ? "/gv" : "/sv"} replace />;
  }
  return <Outlet />;
}
