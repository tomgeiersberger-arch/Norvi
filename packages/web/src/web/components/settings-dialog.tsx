import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BrainCircuit,
  Gauge,
  Keyboard,
  Link2,
  Loader2,
  Mic,
  MonitorUp,
  Plus,
  Rocket,
  ShieldCheck,
  Trash2,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useSettings, useUpdateSettings } from "../queries/settings";
import { getNorviDesktopAPI, isDesktop } from "../lib/desktop";
import { getDeviceId } from "../lib/device";
import {
  getAssistantSettings,
  saveAssistantSettings,
  type DesktopAssistantSettings,
  type WebsiteAction,
} from "../lib/desktop-assistant";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

function parseCallWords(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function newWebsiteAction(): WebsiteAction {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : "website-" + Date.now().toString(36),
    label: "",
    url: "",
    aliases: [],
  };
}

/** Personal NORVI settings: model and, where supported, answer style. */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const settings = useSettings(open);
  const update = useUpdateSettings();

  const [temperature, setTemperature] = useState(30);
  const [performanceMode, setPerformanceMode] = useState<"serious" | "fast" | "balanced" | "power" | "deep">("balanced");
  const [assistant, setAssistant] = useState<DesktopAssistantSettings>(getAssistantSettings);
  const [voices, setVoices] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const desktop = isDesktop();

  useEffect(() => {
    if (!settings.data) return;
    setTemperature(settings.data.temperature);
    setPerformanceMode(settings.data.performanceMode);
  }, [settings.data]);

  useEffect(() => {
    if (!open || !desktop) return;
    setAssistant(getAssistantSettings());
    const api = getNorviDesktopAPI();
    if (!api) return;
    void api.listVoices().then(setVoices).catch(() => setVoices([]));
    void api
      .getAutoStart()
      .then((enabled) => setAssistant((current) => ({ ...current, startWithWindows: enabled })))
      .catch(() => undefined);
  }, [open, desktop]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  const premiumAccess = settings.data?.premiumAccess ?? false;
  const chokeModeAccess = settings.data?.chokeModeAccess ?? false;
  const speedOptimizedMode = performanceMode === "serious" || performanceMode === "fast";
  const versions = [
    ...(chokeModeAccess
      ? ([["serious", "Choke Mode", ShieldCheck, "ultraschnell · Spezialmodus"]] as const)
      : []),
    ["fast", "NORVI Fast", Zap, "schnell"],
    ["balanced", "NORVI Standard", Gauge, "Alltag"],
    ["power", "NORVI Power", Rocket, "stärker"],
    ["deep", "NORVI Deep", BrainCircuit, "mehr Denkzeit"],
  ] as const;

  const save = () => {
    setSaved(false);
    if (desktop) {
      const next = saveAssistantSettings(assistant);
      setAssistant(next);
      const api = getNorviDesktopAPI();
      void api?.setBackgroundMode(
        (next.microphoneEnabled && next.wakeEnabled) || next.startWithWindows,
      );
      void api?.setQuickShortcut(next.quickShortcutEnabled);
      void api?.setAutoStart(next.startWithWindows);
    }
    update.mutate(
      { deviceId: getDeviceId(), temperature, performanceMode },
      { onSuccess: () => setSaved(true) },
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto p-3 sm:p-6">
      <button
        type="button"
        aria-label="Einstellungen schließen"
        onClick={onClose}
        className="fixed inset-0 bg-black/72 backdrop-blur-md"
      />
      <div className="relative z-10 flex min-h-full items-start justify-center sm:items-center">
        <dialog
          open
          aria-labelledby="norvi-settings-title"
          className="premium-surface rise relative m-0 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.4rem] border-0 p-0 text-foreground sm:max-h-[calc(100dvh-3rem)]"
        >
          <div className="relative z-20 flex shrink-0 items-start justify-between border-b border-white/[0.055] bg-black/10 px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
            <div>
              <h2 id="norvi-settings-title" className="brand-title text-lg font-semibold tracking-[-0.025em]">
                Einstellungen
              </h2>
              <p className="text-[12px] text-muted-foreground">
                Gilt nur für dein NORVI-Konto.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="icon-action flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="scroll-slim min-h-0 overflow-y-auto px-4 py-5 sm:px-6 sm:py-5">
        {settings.isLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : settings.error ? (
          <p className="text-[13px] text-destructive">
            Einstellungen konnten nicht geladen werden.
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[12px] text-muted-foreground">NORVI-Version</span>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-0.5 text-[9px] text-muted-foreground/70">
                  {versions.length} Versionen
                </span>
              </div>
              <div
                className={`grid grid-cols-2 gap-2 ${
                  chokeModeAccess ? "sm:grid-cols-5" : "sm:grid-cols-4"
                }`}
              >
                {versions.map(([value, label, Icon, hint]) => {
                  const locked = value === "deep" && !premiumAccess;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setPerformanceMode(value)}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        performanceMode === value
                          ? "border-primary/35 bg-[linear-gradient(145deg,rgba(255,125,87,0.13),rgba(255,125,87,0.04))] text-foreground shadow-[0_16px_42px_-28px_rgba(255,125,87,0.8),inset_0_1px_0_rgba(255,255,255,0.05)]"
                          : "border-white/[0.065] bg-white/[0.018] text-muted-foreground hover:border-white/[0.10] hover:bg-white/[0.035] hover:text-foreground"
                      } ${locked ? "cursor-not-allowed opacity-45 hover:bg-white/[0.02] hover:text-muted-foreground" : ""}`}
                    >
                      <Icon className={`mb-2 size-4 ${performanceMode === value ? "text-primary" : ""}`} />
                      <div className="text-[12px] font-semibold">{label}</div>
                      <div className="mt-0.5 text-[9.5px] leading-tight opacity-70">
                        {locked ? "Premium · 4B + Thinking" : hint}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                {chokeModeAccess
                  ? "Choke Mode ist ein speziell freigeschalteter Schnellmodus. Fast ist für Tempo, Standard für normale Chats, Power priorisiert Qualität. Deep gibt dem lokalen Modell zusätzliche Denkzeit."
                  : "Fast ist für Tempo, Standard für normale Chats, Power priorisiert Qualität. Deep gibt dem lokalen Modell zusätzliche Denkzeit."}
              </p>
            </div>

            {settings.data?.supportsTemperature ? (
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[12px] text-muted-foreground">
                  <span>Antwortstil</span>
                  <span>
                    {speedOptimizedMode
                      ? "präzise · automatisch (0.20)"
                      : `${temperature < 35 ? "präzise" : temperature > 75 ? "kreativ" : "ausgewogen"} (${(
                          temperature / 100
                        ).toFixed(2)})`}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={temperature}
                  aria-label="Antwortstil"
                  disabled={speedOptimizedMode}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-45"
                />
                {speedOptimizedMode ? (
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {performanceMode === "serious" ? "Choke Mode" : "Fast"} nutzt automatisch 0.20 für schnelle, stabilere Antworten.
                  </span>
                ) : null}
              </label>
            ) : (
              <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[12px] text-muted-foreground">
                Der aktive KI-Dienst unterstützt keine Feineinstellung des Antwortstils.
              </p>
            )}

            {desktop && (
              <div className="rounded-2xl border border-white/[0.065] bg-white/[0.018] p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="icon-action flex size-9 shrink-0 items-center justify-center rounded-xl text-primary">
                    <Mic className="size-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">Desktop-Assistent</div>
                    <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">
                      Wake-Phrase, Stimme und Autostart laufen lokal auf diesem PC.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label htmlFor="norvi-assistant-name" className="block">
                    <span className="mb-1.5 block text-[11px] text-muted-foreground">
                      Assistentenname
                    </span>
                    <input
                      id="norvi-assistant-name"
                      aria-label="Assistentenname"
                      value={assistant.assistantName}
                      maxLength={40}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          assistantName: event.target.value,
                        }))
                      }
                      placeholder="NORVI"
                      className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-[12px] outline-none transition focus:border-primary/60"
                    />
                  </label>
                  <label htmlFor="norvi-wake-phrase" className="block">
                    <span className="mb-1.5 block text-[11px] text-muted-foreground">
                      Wake-Phrase
                    </span>
                    <input
                      id="norvi-wake-phrase"
                      aria-label="Wake-Phrase"
                      value={assistant.wakePhrase}
                      maxLength={40}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          wakePhrase: event.target.value,
                        }))
                      }
                      placeholder="Hey NORVI"
                      className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-[12px] outline-none transition focus:border-primary/60"
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-2">
                  <label htmlFor="norvi-microphone-enabled" className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <input
                      id="norvi-microphone-enabled"
                      aria-label="Mikrofon in NORVI erlauben"
                      type="checkbox"
                      checked={assistant.microphoneEnabled}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          microphoneEnabled: event.target.checked,
                          wakeEnabled: event.target.checked ? current.wakeEnabled : false,
                        }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <Mic className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px]">Mikrofon in NORVI erlauben</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Master-Schalter für Spracheingabe und Wake-Phrase auf diesem PC.
                      </span>
                    </span>
                  </label>

                  <label htmlFor="norvi-screen-capture" className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <input
                      id="norvi-screen-capture"
                      aria-label="Bildschirm-Screenshots erlauben"
                      type="checkbox"
                      checked={assistant.screenCaptureEnabled}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          screenCaptureEnabled: event.target.checked,
                        }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <MonitorUp className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px]">Screen Mode erlauben</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Fügt auf Knopfdruck einen Screenshot deines aktuellen Bildschirms zum Chat hinzu.
                      </span>
                    </span>
                  </label>

                  <label htmlFor="norvi-quick-shortcut" className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <input
                      id="norvi-quick-shortcut"
                      aria-label="Alt plus Leertaste Schnellzugriff"
                      type="checkbox"
                      checked={assistant.quickShortcutEnabled}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          quickShortcutEnabled: event.target.checked,
                        }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <Keyboard className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px]">Alt + Leertaste Schnellzugriff</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Holt NORVI nach vorne und setzt den Fokus direkt ins Eingabefeld.
                      </span>
                    </span>
                  </label>

                  <label htmlFor="norvi-wake-enabled" className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <input
                      id="norvi-wake-enabled"
                      aria-label="Wake-Phrase im Hintergrund"
                      type="checkbox"
                      checked={assistant.wakeEnabled}
                      disabled={!assistant.microphoneEnabled}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          wakeEnabled: event.target.checked,
                        }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium">Wake-Phrase im Hintergrund</span>
                      <span className="block text-[10px] text-muted-foreground">
                        NORVI bleibt im Tray und reagiert, wenn die App nicht im Vordergrund ist.
                      </span>
                    </span>
                  </label>

                  <label htmlFor="norvi-conversation-mode" className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <input
                      id="norvi-conversation-mode"
                      aria-label="Gesprächsmodus"
                      type="checkbox"
                      checked={assistant.conversationMode}
                      disabled={!assistant.microphoneEnabled || !assistant.wakeEnabled}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          conversationMode: event.target.checked,
                        }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px]">Gesprächsmodus</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Nach einer Sprachantwort hört NORVI kurz auf eine Folgefrage, ohne erneut das Wake-Wort zu brauchen.
                      </span>
                    </span>
                    {assistant.conversationMode && (
                      <select
                        aria-label="Gesprächsfenster"
                        value={assistant.conversationWindowSeconds}
                        onChange={(event) =>
                          setAssistant((current) => ({
                            ...current,
                            conversationWindowSeconds: Number(event.target.value),
                          }))
                        }
                        className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[10px]"
                      >
                        <option value={8}>8 s</option>
                        <option value={12}>12 s</option>
                        <option value={20}>20 s</option>
                        <option value={30}>30 s</option>
                      </select>
                    )}
                  </label>

                  <label htmlFor="norvi-speak-replies" className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <input
                      id="norvi-speak-replies"
                      aria-label="Antworten auf Sprachbefehle vorlesen"
                      type="checkbox"
                      checked={assistant.speakReplies}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          speakReplies: event.target.checked,
                        }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <Volume2 className="size-4 text-muted-foreground" />
                    <span className="text-[12px]">Antworten auf Sprachbefehle vorlesen</span>
                  </label>

                  <label htmlFor="norvi-start-with-windows" className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <input
                      id="norvi-start-with-windows"
                      aria-label="Mit Windows im Hintergrund starten"
                      type="checkbox"
                      checked={assistant.startWithWindows}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          startWithWindows: event.target.checked,
                        }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="text-[12px]">Mit Windows im Hintergrund starten</span>
                  </label>

                  <label htmlFor="norvi-desktop-actions" className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <input
                      id="norvi-desktop-actions"
                      aria-label="Lokale App-Befehle erlauben"
                      type="checkbox"
                      checked={assistant.desktopActionsEnabled}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          desktopActionsEnabled: event.target.checked,
                        }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px]">Lokale App-Befehle erlauben</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Zum Beispiel „Öffne Spotify“ oder „Starte CS2“. Nur freigegebene Apps können gestartet werden.
                      </span>
                    </span>
                  </label>
                </div>

                {assistant.desktopActionsEnabled && (
                  <div className="mt-3 rounded-xl border border-white/[0.05] bg-black/10 p-3">
                    <div className="mb-3 flex items-start gap-2">
                      <Link2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div>
                        <div className="text-[12px] font-medium">Call-Wörter & Websites</div>
                        <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                          Mehrere Call-Wörter mit Komma trennen. NORVI reagiert z. B. auf „Starte cs2“ oder „Starte winkelhof“.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        ["spotify", "Spotify"],
                        ["cs2", "Counter-Strike 2"],
                      ] as const).map(([id, label]) => (
                        <label key={id} className="block">
                          <span className="mb-1 block text-[10px] text-muted-foreground">
                            {label} · Call-Wörter
                          </span>
                          <input
                            aria-label={label + " Call-Wörter"}
                            value={assistant.desktopActionAliases[id].join(", ")}
                            onChange={(event) =>
                              setAssistant((current) => ({
                                ...current,
                                desktopActionAliases: {
                                  ...current.desktopActionAliases,
                                  [id]: parseCallWords(event.target.value),
                                },
                              }))
                            }
                            placeholder={id === "cs2" ? "cs2, counter strike 2" : "spotify"}
                            className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] outline-none transition focus:border-primary/60"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-medium">Eigene Websites</div>
                        <div className="text-[9.5px] text-muted-foreground">
                          Name + Adresse + Call-Wörter. Es werden nur http/https-Adressen geöffnet.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAssistant((current) => ({
                            ...current,
                            websiteActions: [...current.websiteActions, newWebsiteAction()],
                          }))
                        }
                        className="icon-action flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] text-foreground"
                      >
                        <Plus className="size-3.5" />
                        Website
                      </button>
                    </div>

                    <div className="mt-2 grid gap-2">
                      {assistant.websiteActions.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-white/[0.07] px-3 py-2.5 text-[10px] leading-4 text-muted-foreground">
                          Beispiel: Name „Winkelhof“, URL „www.winkelhof.at“, Call-Wort „winkelhof“ → „Starte winkelhof“.
                        </div>
                      ) : (
                        assistant.websiteActions.map((website, index) => (
                          <div key={website.id} className="rounded-lg border border-white/[0.055] bg-background/30 p-2.5">
                            <div className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr_auto]">
                              <input
                                aria-label={"Website " + (index + 1) + " Name"}
                                value={website.label}
                                onChange={(event) =>
                                  setAssistant((current) => ({
                                    ...current,
                                    websiteActions: current.websiteActions.map((item) =>
                                      item.id === website.id ? { ...item, label: event.target.value } : item,
                                    ),
                                  }))
                                }
                                placeholder="Winkelhof"
                                className="rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] outline-none transition focus:border-primary/60"
                              />
                              <input
                                aria-label={"Website " + (index + 1) + " Adresse"}
                                value={website.url}
                                onChange={(event) =>
                                  setAssistant((current) => ({
                                    ...current,
                                    websiteActions: current.websiteActions.map((item) =>
                                      item.id === website.id ? { ...item, url: event.target.value } : item,
                                    ),
                                  }))
                                }
                                placeholder="www.winkelhof.at"
                                className="rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] outline-none transition focus:border-primary/60"
                              />
                              <button
                                type="button"
                                aria-label={"Website " + (index + 1) + " entfernen"}
                                onClick={() =>
                                  setAssistant((current) => ({
                                    ...current,
                                    websiteActions: current.websiteActions.filter((item) => item.id !== website.id),
                                  }))
                                }
                                className="icon-action flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                            <input
                              aria-label={"Website " + (index + 1) + " Call-Wörter"}
                              value={website.aliases.join(", ")}
                              onChange={(event) =>
                                setAssistant((current) => ({
                                  ...current,
                                  websiteActions: current.websiteActions.map((item) =>
                                    item.id === website.id
                                      ? { ...item, aliases: parseCallWords(event.target.value) }
                                      : item,
                                  ),
                                }))
                              }
                              placeholder="winkelhof, hof"
                              className="mt-2 w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] outline-none transition focus:border-primary/60"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {voices.length > 0 && (
                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-[11px] text-muted-foreground">
                      Lokale Windows-Stimme
                    </span>
                    <select
                      value={assistant.voice}
                      onChange={(event) =>
                        setAssistant((current) => ({ ...current, voice: event.target.value }))
                      }
                      className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-[12px] outline-none transition focus:border-primary/60"
                    >
                      <option value="">Windows-Standardstimme</option>
                      {voices.map((voice) => (
                        <option key={voice} value={voice}>
                          {voice}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                  Die Wake-Erkennung nutzt den lokalen Whisper-Dienst. Mikrofonaufnahmen
                  werden nicht an einen Cloud-Sprachdienst geschickt.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              {saved && !update.isPending && (
                <span className="text-[12px] text-muted-foreground">Gespeichert</span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={update.isPending}
                className="send-glow flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground transition disabled:opacity-60"
              >
                {update.isPending && <Loader2 className="size-4 animate-spin" />}
                Speichern
              </button>
            </div>
          </div>
        )}
          </div>
        </dialog>
      </div>
    </div>,
    document.body,
  );
}
