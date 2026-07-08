import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { StudentDashboard } from "@/features/student/StudentDashboard";
import { CourseDetailPage } from "@/features/student/CourseDetailPage";
import { AssignmentPage } from "@/features/student/AssignmentPage";
import { PracticeDetailPage } from "@/features/student/PracticeDetailPage";
import { LecturerDashboard } from "@/features/lecturer/LecturerDashboard";
import { LecturerCourseDetailPage } from "@/features/lecturer/LecturerCourseDetailPage";
import { GradeAssignmentPage } from "@/features/lecturer/GradeAssignmentPage";
import { CreateProblemPage } from "@/features/lecturer/CreateProblemPage";
import { LecturerProblemDetailPage } from "@/features/lecturer/LecturerProblemDetailPage";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";

function HomeRedirect() {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "lecturer" ? "/gv" : "/sv"} replace />;
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  const ready = useAuth((s) => s.ready);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
        <Route path="/dat-lai-mat-khau" element={<ResetPasswordPage />} />
        <Route path="/xac-nhan-email" element={<VerifyEmailPage />} />

        {/* Khu vực sinh viên */}
        <Route element={<ProtectedRoute role="student" />}>
          <Route element={<AppShell />}>
            <Route path="/sv" element={<StudentDashboard />} />
            <Route path="/sv/mon/:courseId" element={<CourseDetailPage />} />
            <Route path="/sv/bai-tap/:assignmentId" element={<AssignmentPage />} />
            <Route path="/sv/luyen-tap/:problemId" element={<PracticeDetailPage />} />
          </Route>
        </Route>

        {/* Khu vực giảng viên */}
        <Route element={<ProtectedRoute role="lecturer" />}>
          <Route element={<AppShell />}>
            <Route path="/gv" element={<LecturerDashboard />} />
            <Route path="/gv/mon/:courseId" element={<LecturerCourseDetailPage />} />
            <Route path="/gv/bai-tap/:assignmentId" element={<GradeAssignmentPage />} />
            <Route path="/gv/luyen-tap/tao" element={<CreateProblemPage />} />
            <Route path="/gv/luyen-tap/:problemId" element={<LecturerProblemDetailPage />} />
          </Route>
        </Route>

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
