import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton({ to, label = "Quay lại" }: { to?: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground" onClick={() => (to ? navigate(to) : navigate(-1))}>
      <ArrowLeft /> {label}
    </Button>
  );
}
