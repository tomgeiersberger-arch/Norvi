import { useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowLeft,
  Cpu,
  Eye,
  Loader2,
  MemoryStick,
  Mic2,
  Timer,
  UserPlus,
  Crown,
} from "lucide-react";
import { NorviMark } from "../components/chat/norvi-mark";
import {
  useAdminStats,
  useAdminSystem,
  useAdminUsers,
  useSetActive,
  useSetChokeMode,
  useSetPremium,
  useSetRegistration,
  useSetRole,
} from "../queries/admin";
import { useMe } from "../queries/me";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("de-DE");
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 GB";
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days} T ${hours % 24} h` : `${hours} h`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel rounded-2xl px-4 py-3.5">
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

/** Owner/Admin administration for this NORVI AI instance. */
function Admin() {
  const me = useMe();
  const isOwner = me.data?.role === "owner";
  const users = useAdminUsers(true);
  const stats = useAdminStats(true);
  const system = useAdminSystem(true);
  const setActive = useSetActive();
  const setChokeMode = useSetChokeMode();
  const setPremium = useSetPremium();
  const setRegistration = useSetRegistration();
  const setRole = useSetRole();
  const [dateDraft, setDateDraft] = useState<Record<string, string>>({});

  return (
    <div className="min-h-dvh">
      <header className="glass-header sticky top-0 z-20">
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
          System
        </h2>
        {system.isLoading ? (
          <div className="glass-panel flex justify-center rounded-2xl py-7 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : system.data ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="glass-panel rounded-2xl p-4">
              <Cpu className="size-4 text-primary" />
              <div className="mt-3 text-[11px] text-muted-foreground">KI-Modell</div>
              <div className="mt-0.5 truncate text-[13px] font-semibold">{system.data.model}</div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <Eye className={`size-4 ${system.data.vision ? "text-green-400" : "text-muted-foreground"}`} />
              <div className="mt-3 text-[11px] text-muted-foreground">Vision</div>
              <div className="mt-0.5 text-[13px] font-semibold">{system.data.vision ? "Bereit" : "Aus"}</div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <Mic2 className={`size-4 ${system.data.stt ? "text-green-400" : "text-muted-foreground"}`} />
              <div className="mt-3 text-[11px] text-muted-foreground">Sprache</div>
              <div className="mt-0.5 text-[13px] font-semibold">{system.data.stt ? "Bereit" : "Nicht bereit"}</div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <MemoryStick className="size-4 text-primary" />
              <div className="mt-3 text-[11px] text-muted-foreground">RAM belegt</div>
              <div className="mt-0.5 text-[13px] font-semibold">
                {formatBytes(system.data.memoryUsedBytes)} / {formatBytes(system.data.memoryTotalBytes)}
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <Activity className="size-4 text-primary" />
              <div className="mt-3 text-[11px] text-muted-foreground">Server</div>
              <div className="mt-0.5 text-[13px] font-semibold">{formatUptime(system.data.uptimeSeconds)}</div>
              <div className="mt-1 text-[10.5px] text-muted-foreground">Load {system.data.load1.toFixed(2)}</div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <Timer className="size-4 text-primary" />
              <div className="mt-3 text-[11px] text-muted-foreground">Antwortzeit</div>
              <div className="mt-0.5 text-[13px] font-semibold">
                {system.data.ai.averageMs === null
                  ? "Noch keine Daten"
                  : `${(system.data.ai.averageMs / 1000).toFixed(1)} s Ø`}
              </div>
              <div className="mt-1 text-[9.5px] leading-tight text-muted-foreground">
                {system.data.ai.p95Ms === null
                  ? "—"
                  : `P95 ${(system.data.ai.p95Ms / 1000).toFixed(1)} s · ${system.data.ai.errors} Fehler`}
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <UserPlus
                className={`size-4 ${system.data.registrationOpen ? "text-amber-400" : "text-green-400"}`}
              />
              <div className="mt-3 text-[11px] text-muted-foreground">Registrierung</div>
              <button
                type="button"
                disabled={setRegistration.isPending}
                onClick={() =>
                  setRegistration.mutate({ enabled: !system.data.registrationOpen })
                }
                className={`mt-0.5 text-left text-[13px] font-semibold transition hover:text-primary disabled:opacity-50 ${
                  system.data.registrationOpen ? "text-amber-400" : "text-green-400"
                }`}
              >
                {system.data.registrationOpen ? "Offen · schließen" : "Geschlossen · öffnen"}
              </button>
              <div className="mt-1 text-[9.5px] leading-tight text-muted-foreground">
                Offen nur bis Neustart
              </div>
            </div>
          </section>
        ) : (
          <div className="glass-panel rounded-2xl px-4 py-3 text-[13px] text-destructive">
            Systemstatus konnte nicht geladen werden.
          </div>
        )}

        <h2 className="mt-10 mb-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Benutzer & Rollen
        </h2>

        <div className="mb-3 flex items-start gap-3 rounded-2xl border border-border/70 bg-secondary/25 px-4 py-3">
          <Crown className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Owner</span> kann Rollen ändern und alle Konten verwalten.
            {" "}<span className="font-medium text-foreground">Admins</span> können normale Benutzer aktivieren, Premium/Choke Mode verwalten, Registrierung steuern und den Systemstatus sehen — aber keine Admins oder den Owner ändern.
          </div>
        </div>

        <div className="glass-panel scroll-slim overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[54rem] text-left text-[13px]">
            <thead className="bg-secondary/40 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Konto</th>
                <th className="px-4 py-2.5 font-medium">Rolle</th>
                <th className="px-4 py-2.5 font-medium">Chats</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Premium</th>
                <th className="px-4 py-2.5 font-medium">Choke Mode</th>
                <th className="px-4 py-2.5 font-medium">Läuft ab</th>
              </tr>
            </thead>
            <tbody>
              {users.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
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
                    {row.role === "owner" ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                        <Crown className="size-3.5" /> Owner
                      </span>
                    ) : isOwner ? (
                      <button
                        type="button"
                        disabled={setRole.isPending}
                        onClick={() =>
                          setRole.mutate({
                            id: row.id,
                            role: row.role === "admin" ? "user" : "admin",
                          })
                        }
                        className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition disabled:opacity-50 ${
                          row.role === "admin"
                            ? "bg-primary/15 text-primary hover:bg-primary/25"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                        title={row.role === "admin" ? "Zu Benutzer machen" : "Zu Admin machen"}
                      >
                        {row.role === "admin" ? "Admin" : "Benutzer"}
                      </button>
                    ) : (
                      <span className={row.role === "admin" ? "text-primary" : "text-muted-foreground"}>
                        {row.role === "admin" ? "Admin" : "Benutzer"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.chats}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={
                        setActive.isPending ||
                        row.role === "owner" ||
                        (!isOwner && row.role !== "user")
                      }
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
                    {row.role === "owner" || row.role === "admin" ? (
                      <span className="rounded-lg bg-primary/15 px-2.5 py-1 text-[12px] text-primary">
                        Immer an
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={setPremium.isPending || (!isOwner && row.role !== "user")}
                        onClick={() =>
                          setPremium.mutate({
                            id: row.id,
                            isPremium: !row.isPremium,
                            premiumUntil: dateDraft[row.id] || null,
                          })
                        }
                        className={`rounded-lg px-2.5 py-1 text-[12px] transition disabled:opacity-50 ${
                          row.isPremium
                            ? "bg-primary/15 text-primary hover:bg-primary/25"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {row.isPremium ? "Premium an" : "Premium aus"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.role === "owner" || row.role === "admin" ? (
                      <span className="rounded-lg bg-primary/15 px-2.5 py-1 text-[12px] text-primary">
                        Immer an
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={setChokeMode.isPending}
                        onClick={() =>
                          setChokeMode.mutate({
                            id: row.id,
                            enabled: !row.chokeModeEnabled,
                          })
                        }
                        className={`rounded-lg px-2.5 py-1 text-[12px] transition disabled:opacity-50 ${
                          row.chokeModeEnabled
                            ? "bg-primary/15 text-primary hover:bg-primary/25"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {row.chokeModeEnabled ? "Freigegeben" : "Gesperrt"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatDate(row.premiumUntil)}
                      </span>
                      <input
                        type="date"
                        aria-label="Premium-Ablaufdatum"
                        disabled={
                          row.role === "owner" ||
                          row.role === "admin" ||
                          (!isOwner && row.role !== "user")
                        }
                        value={dateDraft[row.id] ?? ""}
                        onChange={(e) =>
                          setDateDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                        onBlur={() => {
                          const value = dateDraft[row.id];
                          if (value && row.isPremium && row.role === "user") {
                            setPremium.mutate({
                              id: row.id,
                              isPremium: true,
                              premiumUntil: value,
                            });
                          }
                        }}
                        className="rounded-lg border border-border bg-background/60 px-2 py-1 text-[12px] outline-none focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(setRole.error ||
          setActive.error ||
          setChokeMode.error ||
          setPremium.error ||
          setRegistration.error) && (
          <p className="mt-4 text-[13px] text-destructive">
            Änderung fehlgeschlagen. Bitte erneut versuchen.
          </p>
        )}
      </main>
    </div>
  );
}

export default Admin;
