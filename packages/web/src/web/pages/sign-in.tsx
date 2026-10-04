import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { NorviMark } from "../components/chat/norvi-mark";
import { authClient } from "../lib/auth";
import { useCapabilities } from "../queries/capabilities";
import { useResetSession } from "../queries/me";

type Mode = "signin" | "signup";

function messageFor(error: unknown): string {
  const raw =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: string }).message)
      : String(error ?? "");
  if (/invalid email or password|INVALID_EMAIL_OR_PASSWORD/i.test(raw)) {
    return "E-Mail oder Passwort stimmt nicht.";
  }
  if (/SIGNUP_DISABLED|Registrierung ist .* geschlossen/i.test(raw)) {
    return "Die Registrierung ist auf diesem NORVI-Server geschlossen.";
  }
  if (/already exists|USER_ALREADY_EXISTS/i.test(raw)) {
    return "Für diese E-Mail gibt es bereits ein Konto.";
  }
  if (/password/i.test(raw) && /short|length/i.test(raw)) {
    return "Das Passwort muss mindestens 8 Zeichen haben.";
  }
  if (/fetch|network/i.test(raw)) {
    return "Server nicht erreichbar. Läuft NORVI AI?";
  }
  return raw || "Anmeldung fehlgeschlagen.";
}

/** Sign-in / registration for NORVI AI — one page, two tabs. */
function SignIn() {
  const [, navigate] = useLocation();
  const resetSession = useResetSession();
  const capabilities = useCapabilities();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const registrationOpen = capabilities.data?.registrationOpen === true;
  const publicEdition = capabilities.data?.publicEdition === true;
  const loginlessLocal =
    publicEdition &&
    capabilities.data?.localOnly === true &&
    capabilities.data?.requireAuth !== true;

  useEffect(() => {
    if (loginlessLocal) navigate("/", { replace: true });
  }, [loginlessLocal, navigate]);

  useEffect(() => {
    if (!registrationOpen && mode === "signup") setMode("signin");
  }, [registrationOpen, mode]);

  if (loginlessLocal) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "signin"
          ? await authClient.signIn.email({ email: email.trim(), password })
          : await authClient.signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim().split("@")[0]!,
            });

      if (result.error) {
        setError(messageFor(result.error));
        return;
      }
      resetSession();
      navigate("/");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="rise w-full max-w-[26rem]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <NorviMark className="size-12" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">NORVI</h1>
            <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              NORVI AI
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-[1.6rem] p-6 shadow-[0_30px_100px_-45px_rgba(0,0,0,1)]">
          <div
            className={`mb-6 grid gap-1 rounded-xl bg-secondary/50 p-1 ${
              registrationOpen ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={`rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                mode === "signin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anmelden
            </button>
            {registrationOpen && (
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className={`rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                  mode === "signup"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Registrieren
              </button>
            )}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-muted-foreground">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Name"
                  autoComplete="name"
                  placeholder="Dein Name"
                  className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">E-Mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="E-Mail"
                autoComplete="email"
                placeholder="name@example.com"
                className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">
                Passwort {mode === "signup" && "(mind. 8 Zeichen)"}
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Passwort"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60"
              />
            </label>

            {error && (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Anmelden" : "Konto erstellen"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
          {registrationOpen
            ? publicEdition
              ? "Das erste Konto wird dein lokales NORVI-Profil."
              : "Der erste registrierte Account wird automatisch Administrator."
            : "Neue Registrierungen sind auf diesem NORVI-Server deaktiviert."}
        </p>
      </div>
    </div>
  );
}

export default SignIn;
