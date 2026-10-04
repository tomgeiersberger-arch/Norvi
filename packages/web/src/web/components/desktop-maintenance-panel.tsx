import { useEffect, useRef, useState } from "react";
import { Download, FileUp, RefreshCw, RotateCcw, ShieldCheck, Stethoscope } from "lucide-react";
import { getNorviDesktopAPI, type DesktopHardwareProfile, type DesktopUpdateInfo } from "../lib/desktop";
import {
  getAssistantSettings,
  saveAssistantSettings,
  type DesktopAssistantSettings,
} from "../lib/desktop-assistant";
import { getDeviceId } from "../lib/device";
import { useCapabilities } from "../queries/capabilities";
import { useModel } from "../queries/model";
import { useSettings, useUpdateSettings } from "../queries/settings";

type BackupFile = {
  version: 1;
  createdAt: string;
  assistant: DesktopAssistantSettings;
  model?: {
    modelId: string;
    temperature: number;
    performanceMode: "serious" | "fast" | "balanced" | "power" | "deep";
  };
};

export function DesktopMaintenancePanel() {
  const capabilities = useCapabilities();
  const model = useModel();
  const preferences = useSettings(true);
  const updatePreferences = useUpdateSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [hardware, setHardware] = useState<DesktopHardwareProfile | null>(null);
  const [updateInfo, setUpdateInfo] = useState<DesktopUpdateInfo | null>(null);
  const [busyUpdate, setBusyUpdate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    void api.detectHardware().then(setHardware).catch(() => setHardware(null));
  }, []);

  const exportBackup = () => {
    const assistant = getAssistantSettings();
    const file: BackupFile = {
      version: 1,
      createdAt: new Date().toISOString(),
      assistant,
      ...(preferences.data
        ? {
            model: {
              modelId: preferences.data.modelId,
              temperature: preferences.data.temperature,
              performanceMode: preferences.data.performanceMode,
            },
          }
        : {}),
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "norvi-settings-backup.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
    setNotice("Einstellungen exportiert.");
  };

  const importBackup = async (file: File) => {
    setNotice(null);
    try {
      const parsed = JSON.parse(await file.text()) as Partial<BackupFile>;
      if (parsed.version !== 1 || !parsed.assistant || typeof parsed.assistant !== "object") {
        throw new Error("Diese Datei ist kein gültiges NORVI-Backup.");
      }
      const saved = saveAssistantSettings(parsed.assistant as DesktopAssistantSettings);
      const api = getNorviDesktopAPI();
      await Promise.all([
        api?.setQuickShortcut(saved.quickShortcutEnabled),
        api?.setVoiceShortcut(saved.voiceShortcutEnabled ? saved.voiceShortcut : null),
        api?.setBackgroundMode(
          (saved.microphoneEnabled && saved.wakeEnabled) || saved.startWithWindows,
        ),
        api?.setAutoStart(saved.startWithWindows),
      ]);

      if (parsed.model) {
        await updatePreferences.mutateAsync({
          deviceId: getDeviceId(),
          modelId: parsed.model.modelId,
          temperature: parsed.model.temperature,
          performanceMode: parsed.model.performanceMode,
        });
      }
      setNotice("Backup importiert.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Backup konnte nicht importiert werden.");
    }
  };

  const checkUpdates = async () => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    setBusyUpdate(true);
    setNotice(null);
    try {
      setUpdateInfo(await api.checkForUpdates());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Update-Check fehlgeschlagen.");
    } finally {
      setBusyUpdate(false);
    }
  };

  const rerunOnboarding = () => {
    const current = getAssistantSettings();
    saveAssistantSettings({ ...current, onboardingComplete: false });
    window.location.reload();
  };

  const statusItems = [
    ["CPU", hardware ? hardware.cpu : "Wird erkannt …"],
    ["RAM", hardware ? hardware.ramGiB.toFixed(1) + " GB" : "—"],
    [
      "NVIDIA VRAM",
      hardware?.nvidiaVramGiB == null ? "nicht erkannt" : hardware.nvidiaVramGiB.toFixed(1) + " GB",
    ],
    ["Hardware-Profil", hardware?.label ?? "—"],
    ["Aktives Modell", model.data?.label ?? model.data?.id ?? "—"],
    ["KI", capabilities.data?.aiOnline === false ? "offline" : "bereit"],
    ["Vision", capabilities.data?.vision ? "bereit" : "nicht verfügbar"],
    ["Speech-to-Text", capabilities.data?.stt ? "bereit" : "nicht verfügbar"],
  ] as const;

  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.018] p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="icon-action flex size-9 shrink-0 items-center justify-center rounded-xl text-primary">
          <Stethoscope className="size-4" />
        </div>
        <div>
          <div className="text-[13px] font-semibold">System & Wartung</div>
          <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">
            Lokale Diagnose, Backup und manueller Update-Check.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {statusItems.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
            <div className="mt-1 truncate text-[11px] font-medium">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-500/15 bg-green-500/[0.045] px-3 py-2.5">
        <ShieldCheck className="size-4 shrink-0 text-green-400" />
        <div className="text-[10px] text-muted-foreground">
          {capabilities.data?.localOnly
            ? "LOCAL_ONLY aktiv · KI, STT und Datenbank lokal konfiguriert."
            : "Diese Installation läuft nicht im LOCAL_ONLY-Modus."}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={exportBackup}
          className="icon-action flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px]"
        >
          <Download className="size-4" /> Einstellungen exportieren
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="icon-action flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px]"
        >
          <FileUp className="size-4" /> Backup importieren
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="NORVI Backup importieren"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busyUpdate}
          onClick={() => void checkUpdates()}
          className="icon-action flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] disabled:opacity-50"
        >
          <RefreshCw className={"size-4 " + (busyUpdate ? "animate-spin" : "")} />
          Nach Updates suchen
        </button>
        <button
          type="button"
          onClick={rerunOnboarding}
          className="icon-action flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px]"
        >
          <RotateCcw className="size-4" /> Einrichtung erneut öffnen
        </button>
      </div>

      {updateInfo && (
        <div className="mt-3 rounded-xl border border-white/[0.055] bg-black/10 px-3 py-2.5 text-[10.5px] text-muted-foreground">
          {updateInfo.available
            ? "Update verfügbar: " + updateInfo.currentVersion + " → " + updateInfo.latestVersion
            : "NORVI ist aktuell (" + updateInfo.currentVersion + ")."}
          {updateInfo.available && updateInfo.releaseUrl && (
            <button
              type="button"
              onClick={() => void getNorviDesktopAPI()?.openWebsite(updateInfo.releaseUrl!)}
              className="ml-2 text-primary hover:underline"
            >
              Release öffnen
            </button>
          )}
        </div>
      )}

      {notice && (
        <div className="mt-3 rounded-xl border border-white/[0.055] bg-black/10 px-3 py-2.5 text-[10.5px] text-muted-foreground">
          {notice}
        </div>
      )}
    </div>
  );
}
