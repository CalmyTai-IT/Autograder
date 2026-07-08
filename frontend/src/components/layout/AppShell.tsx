import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";

export function AppShell() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-8">
        <Outlet />
      </main>
    </div>
  );
}
