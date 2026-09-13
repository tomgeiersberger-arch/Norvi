import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useCapabilities } from "../queries/capabilities";
import { useMe } from "../queries/me";

/**
 * Schutz für den Chat.
 *
 * Standardmäßig bleibt NORVI ohne Anmeldung nutzbar (Chats hängen an der
 * `deviceId` des Geräts). Setzt der Betreiber `REQUIRE_AUTH=true` in der
 * root `.env` — was für einen aus dem Internet erreichbaren Server gedacht
 * ist — verlangt diese Hülle vor dem Chat eine Anmeldung.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const capabilities = useCapabilities();
  const me = useMe();
  const [, navigate] = useLocation();

  const required = capabilities.data?.requireAuth === true;
  const loading = capabilities.isLoading || (required && me.isLoading);
  const locked = required && !loading && !me.data;

  useEffect(() => {
    if (locked) navigate("/sign-in", { replace: true });
  }, [locked, navigate]);

  if (loading || locked) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
