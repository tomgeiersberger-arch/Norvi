import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useMe } from "../queries/me";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** When true the page additionally requires the admin role. */
  adminOnly?: boolean;
}

/** Gate for pages that need a NORVI AI account (and optionally the owner role). */
export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const me = useMe();
  const [, navigate] = useLocation();

  const user = me.data ?? null;
  const denied = !me.isLoading && (!user || (adminOnly && user.role !== "admin"));

  useEffect(() => {
    if (!denied) return;
    navigate(user ? "/" : "/sign-in", { replace: true });
  }, [denied, user, navigate]);

  if (me.isLoading || denied) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
