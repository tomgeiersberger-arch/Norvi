import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { LogIn, LogOut, Settings, Shield, User } from "lucide-react";
import { authClient, clearAuthToken } from "../lib/auth";
import { useCapabilities } from "../queries/capabilities";
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
  const capabilities = useCapabilities();
  const resetSession = useResetSession();
  const [, navigate] = useLocation();

  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const user = me.data ?? null;
  const publicEdition = capabilities.data?.publicEdition === true;
  const localPublicProfile =
    publicEdition &&
    capabilities.data?.localOnly === true &&
    capabilities.data?.requireAuth !== true;

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
    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[13px] text-foreground/88 transition hover:bg-white/[0.045] hover:text-foreground disabled:opacity-60";

  return (
    <>
      <div className="relative" ref={boxRef}>
        <button
          type="button"
          aria-label={localPublicProfile ? "Einstellungen" : "Konto"}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="icon-action flex size-9 items-center justify-center rounded-xl text-muted-foreground transition hover:text-foreground"
        >
          {localPublicProfile ? <Settings className="size-5" /> : <User className="size-5" />}
        </button>

        {open && (
          <div
            role="menu"
            className="premium-surface rise absolute right-0 z-50 mt-2 w-64 rounded-[1.2rem] p-1.5 shadow-2xl"
          >
            <div className="px-3 py-2.5">
              <div className="truncate text-[13px] font-semibold tracking-tight">
                {localPublicProfile
                  ? "Lokales NORVI"
                  : user
                    ? (user.name || user.email)
                    : "Nicht angemeldet"}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {localPublicProfile
                  ? "Kein Login nötig · Daten bleiben auf diesem Gerät"
                  : user
                    ? user.email
                    : "Chats bleiben nur auf diesem Gerät"}
              </div>
              {!publicEdition && user && (user.role === "owner" || user.role === "admin" || user.premiumAccess) && (
                <span className="mt-2 inline-flex rounded-full border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-primary uppercase">
                  {user.role === "owner"
                    ? "Owner · Vollzugriff"
                    : user.role === "admin"
                      ? "Admin · Verwaltung"
                      : "Premium"}
                </span>
              )}
            </div>
            <div className="my-1 h-px bg-border/70" />

            {(user || localPublicProfile) && (
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

            {!publicEdition && (user?.role === "owner" || user?.role === "admin") && (
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

            {!localPublicProfile && (user ? (
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
            ))}
          </div>
        )}
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
