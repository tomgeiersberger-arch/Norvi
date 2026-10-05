import {
  Brain,
  CheckCircle2,
  CloudOff,
  LockKeyhole,
  Mic,
  MonitorUp,
  ShieldCheck,
} from "lucide-react";
import type { DesktopAssistantSettings } from "../lib/desktop-assistant";
import { useCapabilities } from "../queries/capabilities";

interface DesktopPrivacyPanelProps {
  assistant: DesktopAssistantSettings;
}

export function DesktopPrivacyPanel({ assistant }: DesktopPrivacyPanelProps) {
  const capabilities = useCapabilities();
  const localOnly = capabilities.data?.localOnly === true;

  const rows = [
    {
      label: "KI-Verarbeitung",
      value: localOnly ? "Lokal · Cloud-AI blockiert" : "Server-Konfiguration",
      ok: localOnly,
      icon: CloudOff,
    },
    {
      label: "Speech-to-Text",
      value: capabilities.data?.stt
        ? localOnly
          ? "Lokaler Whisper-Dienst"
          : "Verfügbar"
        : "Nicht verfügbar",
      ok: capabilities.data?.stt === true,
      icon: Mic,
    },
    {
      label: "Anmeldung",
      value: capabilities.data?.requireAuth ? "Login-Schutz aktiv" : "Lokal ohne Pflicht-Login",
      ok: localOnly || capabilities.data?.requireAuth === true,
      icon: LockKeyhole,
    },
    {
      label: "Mikrofon",
      value: assistant.microphoneEnabled ? "Von dir erlaubt" : "Deaktiviert",
      ok: assistant.microphoneEnabled,
      icon: Mic,
    },
    {
      label: "Screen Mode",
      value: assistant.screenCaptureEnabled ? "Von dir erlaubt" : "Deaktiviert",
      ok: assistant.screenCaptureEnabled,
      icon: MonitorUp,
    },
    {
      label: "Local Memory",
      value: assistant.memoryEnabled
        ? assistant.memoryItems.length + " gespeicherte Erinnerung(en)"
        : "Deaktiviert",
      ok: assistant.memoryEnabled,
      icon: Brain,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.018] p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="icon-action flex size-9 shrink-0 items-center justify-center rounded-xl text-primary">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <div className="text-[13px] font-semibold">Privacy Dashboard</div>
          <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">
            Auf einen Blick sehen, welche lokalen Zugriffe und Datenschutz-Schalter aktiv sind.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(({ label, value, ok, icon: Icon }) => (
          <div
            key={label}
            className="flex items-start gap-2.5 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5"
          >
            <div className="mt-0.5">
              {ok ? (
                <CheckCircle2 className="size-3.5 text-green-400" />
              ) : (
                <Icon className="size-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 text-[10.5px] font-medium">{value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5 text-[10px] leading-4 text-muted-foreground">
        {localOnly
          ? "LOCAL_ONLY ist aktiv: KI-, STT- und Datenbank-Konfiguration werden auf Loopback/lokale Daten beschränkt."
          : "Diese Installation ist nicht im LOCAL_ONLY-Modus. Prüfe die Server-Konfiguration, bevor du sensible Daten verwendest."}
      </div>
    </div>
  );
}
