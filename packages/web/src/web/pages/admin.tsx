import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { NorviMark } from "../components/chat/norvi-mark";
import {
  useAdminStats,
  useAdminUsers,
  useSetActive,
  useSetPremium,
} from "../queries/admin";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("de-DE");
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 px-4 py-3.5">
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

/** Owner-only administration for this NORVI AI instance. */
function Admin() {
  const users = useAdminUsers(true);
  const stats = useAdminStats(true);
  const setActive = useSetActive();
  const setPremium = useSetPremium();
  const [dateDraft, setDateDraft] = useState<Record<string, string>>({});

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            aria-label="Zurück zum Chat"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <NorviMark className="size-8" />
          <div className="leading-tight">
            <div className="text-[0.95rem] font-medium tracking-tight">NORVI</div>
            <div className="text-[11px] text-muted-foreground">Administration</div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.isLoading ? (
            <div className="col-span-full flex justify-center py-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : stats.data ? (
            <>
              <StatCard label="Konten" value={stats.data.users} />
              <StatCard label="Aktiv" value={stats.data.activeUsers} />
              <StatCard label="Premium" value={stats.data.premiumUsers} />
              <StatCard label="Chats" value={stats.data.chats} />
              <StatCard label="Nachrichten" value={stats.data.messages} />
              <StatCard label="Nachr. 7 Tage" value={stats.data.messages7d} />
            </>
          ) : (
            <p className="col-span-full text-[13px] text-destructive">
              Statistiken konnten nicht geladen werden.
            </p>
          )}
        </section>

        <h2 className="mt-10 mb-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Benutzer
        </h2>

        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[46rem] text-left text-[13px]">
            <thead className="bg-secondary/40 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Konto</th>
                <th className="px-4 py-2.5 font-medium">Rolle</th>
                <th className="px-4 py-2.5 font-medium">Chats</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Premium</th>
                <th className="px-4 py-2.5 font-medium">Läuft ab</th>
              </tr>
            </thead>
            <tbody>
              {users.isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </td>
                </tr>
              )}
              {users.data?.map((row) => (
                <tr key={row.id} className="border-t border-border/70">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-[12px] text-muted-foreground">{row.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.role === "admin" ? "text-primary" : "text-muted-foreground"
                      }
                    >
                      {row.role === "admin" ? "Admin" : "Benutzer"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.chats}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setActive.mutate({ id: row.id, isActive: !row.isActive })
                      }
                      className={`rounded-lg px-2.5 py-1 text-[12px] transition ${
                        row.isActive
                          ? "bg-primary/15 text-primary hover:bg-primary/25"
                          : "bg-destructive/15 text-destructive hover:bg-destructive/25"
                      }`}
                    >
                      {row.isActive ? "Aktiv" : "Deaktiviert"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setPremium.mutate({
                          id: row.id,
                          isPremium: !row.isPremium,
                          premiumUntil: dateDraft[row.id] || null,
                        })
                      }
                      className={`rounded-lg px-2.5 py-1 text-[12px] transition ${
                        row.isPremium
                          ? "bg-primary/15 text-primary hover:bg-primary/25"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {row.isPremium ? "Premium an" : "Premium aus"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatDate(row.premiumUntil)}
                      </span>
                      <input
                        type="date"
                        aria-label="Premium-Ablaufdatum"
                        value={dateDraft[row.id] ?? ""}
                        onChange={(e) =>
                          setDateDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                        onBlur={() => {
                          const value = dateDraft[row.id];
                          if (value && row.isPremium) {
                            setPremium.mutate({
                              id: row.id,
                              isPremium: true,
                              premiumUntil: value,
                            });
                          }
                        }}
                        className="rounded-lg border border-border bg-background/60 px-2 py-1 text-[12px] outline-none focus:border-primary/60"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(setActive.error || setPremium.error) && (
          <p className="mt-4 text-[13px] text-destructive">
            Änderung fehlgeschlagen. Bitte erneut versuchen.
          </p>
        )}
      </main>
    </div>
  );
}

export default Admin;
