import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { LogIn, LogOut, Settings, Shield, User } from "lucide-react";
import { authClient, clearAuthToken } from "../lib/auth";
import { useMe, useResetSession } from "../queries/me";
import { SettingsDialog } from "./settings-dialog";

/**
 * Kontomenü im Kopfbereich.
 *
 * Ein unauffälliger Button, der die bereits vorhandenen Seiten erreichbar
 * macht: Einstellungen, Admin-Bereich (nur Besitzer) und An-/Abmelden.
 */
export function AccountMenu() {
  const me = useMe();
  const resetSession = useResetSession();
  const [, navigate] = useLocation();

  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const user = me.data ?? null;

  // Klick außerhalb und Escape schließen das Menü.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    setBusy(true);
    try {
      await authClient.signOut();
    } catch {
      /* Sitzung lokal trotzdem verwerfen */
    } finally {
      clearAuthToken();
      resetSession();
      setBusy(false);
      setOpen(false);
      navigate("/sign-in", { replace: true });
    }
  };

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground transition hover:bg-secondary disabled:opacity-60";

  return (
    <>
      <div className="relative ml-auto" ref={boxRef}>
        <button
          type="button"
          aria-label="Konto"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <User className="size-5" />
        </button>

        {open && (
          <div
            role="menu"
            className="glass-panel rise absolute right-0 z-50 mt-2 w-60 rounded-2xl p-1.5 shadow-2xl"
          >
            <div className="px-2.5 py-2">
              <div className="truncate text-[13px] font-medium">
                {user ? (user.name || user.email) : "Nicht angemeldet"}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {user ? user.email : "Chats bleiben nur auf diesem Gerät"}
              </div>
            </div>
            <div className="my-1 h-px bg-border/70" />

            {user && (
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  setSettingsOpen(true);
                  setOpen(false);
                }}
              >
                <Settings className="size-4 text-muted-foreground" />
                Einstellungen
              </button>
            )}

            {user?.role === "admin" && (
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  setOpen(false);
                  navigate("/admin");
                }}
              >
                <Shield className="size-4 text-muted-foreground" />
                Administration
              </button>
            )}

            {user ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className={itemClass}
                onClick={() => void signOut()}
              >
                <LogOut className="size-4 text-muted-foreground" />
                Abmelden
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  setOpen(false);
                  navigate("/sign-in");
                }}
              >
                <LogIn className="size-4 text-muted-foreground" />
                Anmelden
              </button>
            )}
          </div>
        )}
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
