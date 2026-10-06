import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BrainCircuit,
  Database,
  Gamepad2,
  Gauge,
  Keyboard,
  Link2,
  Loader2,
  Mic,
  MonitorUp,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Trash2,
  Volume2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useSettings, useUpdateSettings } from "../queries/settings";
import { DesktopMaintenancePanel } from "./desktop-maintenance-panel";
import { DesktopMemoryPanel } from "./desktop-memory-panel";
import { DesktopPrivacyPanel } from "./desktop-privacy-panel";
import { DesktopModelManager } from "./desktop-model-manager";
import { DesktopStylePanel } from "./desktop-style-panel";
import { DesktopSkillsPanel } from "./desktop-skills-panel";
import {
  getNorviDesktopAPI,
  isDesktop,
  type ScannedDesktopActionDescriptor,
} from "../lib/desktop";
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
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scannedActions, setScannedActions] = useState<ScannedDesktopActionDescriptor[]>([]);
  const [selectedScanIds, setSelectedScanIds] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"ai" | "assistant" | "data" | "system">("ai");
  const desktop = isDesktop();

  const refreshMicrophones = async (requestPermission = false) => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMicrophones([]);
      return;
    }
    if (requestPermission) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    setMicrophones(devices.filter((device) => device.kind === "audioinput"));
  };

  const previewVoice = async () => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    if (previewingVoice) {
      await api.stopSpeech().catch(() => undefined);
      setPreviewingVoice(false);
      return;
    }
    setPreviewingVoice(true);
    try {
      await api.speak(
        "Hallo, ich bin NORVI. So klingt meine ausgewählte Stimme.",
        assistant.voice || undefined,
      );
    } finally {
      setPreviewingVoice(false);
    }
  };

  const scanComputer = async () => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    setScanBusy(true);
    setSelectedScanIds([]);
    try {
      setScannedActions(await api.scanInstalledDesktopActions());
    } finally {
      setScanBusy(false);
    }
  };

  const scanFolder = async () => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    setScanBusy(true);
    setSelectedScanIds([]);
    try {
      setScannedActions(await api.scanDesktopActionsInFolder());
    } finally {
      setScanBusy(false);
    }
  };

  const addSelectedScanned = async () => {
    const api = getNorviDesktopAPI();
    if (!api || selectedScanIds.length === 0) return;
    const added = await api.addScannedDesktopActions(selectedScanIds);
    setAssistant((current) => ({
      ...current,
      customDesktopActions: [
        ...current.customDesktopActions,
        ...added
          .filter((action) => !current.customDesktopActions.some((item) => item.id === action.id))
          .map((action) => ({ id: action.id, label: action.label, aliases: [action.label] })),
      ],
    }));
    const chosen = new Set(selectedScanIds);
    setScannedActions((current) => current.filter((item) => !chosen.has(item.scanId)));
    setSelectedScanIds([]);
  };

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
    void refreshMicrophones(false).catch(() => setMicrophones([]));
    void api
      .listDesktopActions()
      .then((actions) => {
        const custom = actions.filter((action) => !action.builtin);
        setAssistant((current) => ({
          ...current,
          customDesktopActions: custom.map((action) => {
            const existing = current.customDesktopActions.find((item) => item.id === action.id);
            return existing ?? { id: action.id, label: action.label, aliases: [action.label] };
          }),
        }));
      })
      .catch(() => undefined);
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
        (!next.gamingMode && next.microphoneEnabled && next.wakeEnabled) ||
          next.startWithWindows,
      );
      void api?.setQuickShortcut(next.quickShortcutEnabled);
      void api?.setVoiceShortcut(next.voiceShortcutEnabled ? next.voiceShortcut : null);
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
                Deine lokalen NORVI-Einstellungen auf diesem Gerät.
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
            {desktop && (
              <div
                role="tablist"
                aria-label="Einstellungsbereiche"
                className="grid grid-cols-4 gap-1 rounded-2xl border border-white/[0.055] bg-black/10 p-1"
              >
                {([
                  ["ai", "KI", BrainCircuit],
                  ["assistant", "Assistent", Mic],
                  ["data", "Daten", Database],
                  ["system", "System", Wrench],
                ] as const).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === value}
                    onClick={() => setActiveTab(value)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[10.5px] font-medium transition sm:text-[11px] ${
                      activeTab === value
                        ? "bg-white/[0.07] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        : "text-muted-foreground hover:bg-white/[0.035] hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}

            {(!desktop || activeTab === "ai") && (
              <>
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

              </>
            )}

            {desktop && activeTab === "assistant" && (
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
                  <label
                    htmlFor="norvi-gaming-mode"
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5"
                  >
                    <input
                      id="norvi-gaming-mode"
                      aria-label="Gaming Mode"
                      type="checkbox"
                      checked={assistant.gamingMode}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          gamingMode: event.target.checked,
                        }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    <Gamepad2 className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium">Gaming Mode</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Pausiert Wakeword- und Gesprächs-Mithören im Hintergrund. Chat,
                        Alt + Leertaste und Push-to-talk bleiben nutzbar.
                      </span>
                    </span>
                    {assistant.gamingMode && (
                      <span className="rounded-full border border-green-400/20 bg-green-400/10 px-2 py-0.5 text-[9px] font-semibold text-green-300">
                        AKTIV
                      </span>
                    )}
                  </label>

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

                  <div className="rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Mic className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px]">Mikrofon auswählen</div>
                        <div className="text-[10px] text-muted-foreground">
                          NORVI nutzt dieses Gerät für Spracheingabe und Wakeword.
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!assistant.microphoneEnabled}
                        onClick={() => void refreshMicrophones(true).catch(() => setMicrophones([]))}
                        className="icon-action rounded-lg px-2.5 py-1.5 text-[10px] disabled:opacity-40"
                      >
                        Aktualisieren
                      </button>
                    </div>
                    <select
                      aria-label="Mikrofon auswählen"
                      disabled={!assistant.microphoneEnabled}
                      value={assistant.microphoneDeviceId}
                      onChange={(event) =>
                        setAssistant((current) => ({
                          ...current,
                          microphoneDeviceId: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] outline-none transition focus:border-primary/60 disabled:opacity-50"
                    >
                      <option value="">Systemstandard</option>
                      {microphones.map((microphone, index) => (
                        <option key={microphone.deviceId} value={microphone.deviceId}>
                          {microphone.label || "Mikrofon " + (index + 1)}
                        </option>
                      ))}
                    </select>
                  </div>

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
                        Erlaubt Live Screen und einmalige Bildschirmaufnahmen für die Bildanalyse.
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

                  <div className="rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <label htmlFor="norvi-voice-shortcut-enabled" className="flex cursor-pointer items-center gap-3">
                      <input
                        id="norvi-voice-shortcut-enabled"
                        aria-label="Sprach-Hotkey aktivieren"
                        type="checkbox"
                        checked={assistant.voiceShortcutEnabled}
                        disabled={!assistant.microphoneEnabled}
                        onChange={(event) =>
                          setAssistant((current) => ({
                            ...current,
                            voiceShortcutEnabled: event.target.checked,
                          }))
                        }
                        className="size-4 accent-[var(--primary)]"
                      />
                      <Keyboard className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px]">Push-to-talk / Sprach-Hotkey</span>
                        <span className="block text-[10px] text-muted-foreground">
                          Einmal drücken startet die Aufnahme, nochmal drücken beendet sie.
                        </span>
                      </span>
                    </label>
                    {assistant.voiceShortcutEnabled && (
                      <input
                        aria-label="Sprach-Hotkey Tastenkombination"
                        value={assistant.voiceShortcut}
                        onChange={(event) =>
                          setAssistant((current) => ({
                            ...current,
                            voiceShortcut: event.target.value,
                          }))
                        }
                        placeholder="CommandOrControl+Shift+Space"
                        className="mt-2 w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] outline-none transition focus:border-primary/60"
                      />
                    )}
                  </div>

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
                        {assistant.gamingMode
                          ? "Im Gaming Mode pausiert. Deine Einstellung bleibt gespeichert."
                          : "NORVI reagiert auf die Wake-Phrase auch bei geöffneter App und im Hintergrund."}
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
                        {assistant.gamingMode
                          ? "Im Gaming Mode pausiert. Deine Einstellung bleibt gespeichert."
                          : "Nach einer Sprachantwort hört NORVI kurz auf eine Folgefrage, ohne erneut das Wake-Wort zu brauchen."}
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
                        Zum Beispiel „Öffne Spotify“, „Starte Steam“ oder „Öffne Browser“. Nur freigegebene Ziele können gestartet werden.
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
                          Mehrere Call-Wörter mit Komma trennen. NORVI reagiert z. B. auf „Starte Steam“ oder „Starte winkelhof“.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        ["spotify", "Spotify"],
                        ["steam", "Steam"],
                        ["discord", "Discord"],
                        ["browser", "Browser"],
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
                            placeholder={assistant.desktopActionAliases[id].join(", ")}
                            className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] outline-none transition focus:border-primary/60"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-medium">Eigene Games & Programme</div>
                        <div className="text-[9.5px] text-muted-foreground">
                          Scan typische Orte, einen eigenen Ordner oder wähle eine .exe/.lnk direkt aus.
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          disabled={scanBusy}
                          onClick={() => void scanComputer()}
                          className="icon-action flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] text-foreground disabled:opacity-50"
                        >
                          {scanBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Search className="size-3.5" />
                          )}
                          PC scannen
                        </button>
                        <button
                          type="button"
                          disabled={scanBusy}
                          onClick={() => void scanFolder()}
                          className="icon-action flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] text-foreground disabled:opacity-50"
                        >
                          <Search className="size-3.5" />
                          Ordner scannen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const api = getNorviDesktopAPI();
                            if (!api) return;
                            void api.addCustomDesktopAction().then((action) => {
                              if (!action) return;
                              setAssistant((current) => {
                                if (current.customDesktopActions.some((item) => item.id === action.id)) {
                                  return current;
                                }
                                return {
                                  ...current,
                                  customDesktopActions: [
                                    ...current.customDesktopActions,
                                    { id: action.id, label: action.label, aliases: [action.label] },
                                  ],
                                };
                              });
                            });
                          }}
                          className="icon-action flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] text-foreground"
                        >
                          <Plus className="size-3.5" />
                          Programm
                        </button>
                      </div>
                    </div>

                    {scannedActions.length > 0 && (
                      <div className="mt-2 rounded-xl border border-primary/15 bg-primary/[0.035] p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10.5px] font-medium">
                              Gefundene Programme & Games
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              Wähle nur das aus, was NORVI später starten darf.
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={selectedScanIds.length === 0}
                            onClick={() => void addSelectedScanned()}
                            className="rounded-lg bg-primary/15 px-2.5 py-1.5 text-[10px] font-medium text-primary disabled:opacity-40"
                          >
                            {selectedScanIds.length} hinzufügen
                          </button>
                        </div>
                        <div className="scroll-slim max-h-44 space-y-1 overflow-y-auto pr-1">
                          {scannedActions.map((action) => {
                            const checked = selectedScanIds.includes(action.scanId);
                            return (
                              <label
                                key={action.scanId}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.045] bg-black/10 px-2.5 py-2"
                              >
                                <input
                                  type="checkbox"
                                  aria-label={action.label + " zum Hinzufügen auswählen"}
                                  checked={checked}
                                  onChange={(event) =>
                                    setSelectedScanIds((current) =>
                                      event.target.checked
                                        ? [...current, action.scanId]
                                        : current.filter((id) => id !== action.scanId),
                                    )
                                  }
                                  className="size-3.5 accent-[var(--primary)]"
                                />
                                <span className="min-w-0 flex-1 truncate text-[10.5px]">
                                  {action.label}
                                </span>
                                <span className="shrink-0 text-[9px] text-muted-foreground">
                                  {action.source}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 grid gap-2">
                      {assistant.customDesktopActions.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-white/[0.07] px-3 py-2.5 text-[10px] leading-4 text-muted-foreground">
                          Beispiel: Fortnite.exe auswählen → Call-Wort „fn“ → „Starte fn“.
                        </div>
                      ) : (
                        assistant.customDesktopActions.map((action, index) => (
                          <div key={action.id} className="rounded-lg border border-white/[0.055] bg-background/30 p-2.5">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[11px] font-medium">{action.label}</div>
                                <div className="text-[9px] text-muted-foreground">Freigegebenes lokales Programm</div>
                              </div>
                              <button
                                type="button"
                                aria-label={action.label + " entfernen"}
                                onClick={() => {
                                  const api = getNorviDesktopAPI();
                                  void api?.removeCustomDesktopAction(action.id);
                                  setAssistant((current) => ({
                                    ...current,
                                    customDesktopActions: current.customDesktopActions.filter(
                                      (item) => item.id !== action.id,
                                    ),
                                  }));
                                }}
                                className="icon-action flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                            <input
                              aria-label={"Programm " + (index + 1) + " Call-Wörter"}
                              value={action.aliases.join(", ")}
                              onChange={(event) =>
                                setAssistant((current) => ({
                                  ...current,
                                  customDesktopActions: current.customDesktopActions.map((item) =>
                                    item.id === action.id
                                      ? { ...item, aliases: parseCallWords(event.target.value) }
                                      : item,
                                  ),
                                }))
                              }
                              placeholder="fortnite, fn"
                              className="mt-2 w-full rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] outline-none transition focus:border-primary/60"
                            />
                          </div>
                        ))
                      )}
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
                  <div className="mt-3">
                    <span className="mb-1.5 block text-[11px] text-muted-foreground">
                      Lokale Windows-Stimme
                    </span>
                    <div className="flex gap-2">
                      <select
                        value={assistant.voice}
                        onChange={(event) =>
                          setAssistant((current) => ({ ...current, voice: event.target.value }))
                        }
                        className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 py-2 text-[12px] outline-none transition focus:border-primary/60"
                      >
                        <option value="">Windows-Standardstimme</option>
                        {voices.map((voice) => (
                          <option key={voice} value={voice}>
                            {voice}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void previewVoice()}
                        className="icon-action flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px]"
                      >
                        <Volume2 className="size-4" />
                        {previewingVoice ? "Stopp" : "Vorschau"}
                      </button>
                    </div>
                  </div>
                )}

                <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                  Die Wake-Erkennung nutzt den lokalen Whisper-Dienst. Mikrofonaufnahmen
                  werden nicht an einen Cloud-Sprachdienst geschickt.
                </p>
              </div>
            )}

            {desktop && activeTab === "assistant" && (
              <DesktopSkillsPanel assistant={assistant} setAssistant={setAssistant} />
            )}

            {desktop && activeTab === "ai" && (
              <>
                <DesktopStylePanel assistant={assistant} setAssistant={setAssistant} />
                <DesktopModelManager />
              </>
            )}

            {desktop && activeTab === "data" && (
              <>
                <DesktopPrivacyPanel assistant={assistant} />
                <DesktopMemoryPanel assistant={assistant} setAssistant={setAssistant} />
              </>
            )}

            {desktop && activeTab === "system" && <DesktopMaintenancePanel />}

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
