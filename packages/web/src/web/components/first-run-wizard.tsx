import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Cpu, Mic, MonitorUp, ShieldCheck, Sparkles, Volume2 } from "lucide-react";
import { getNorviDesktopAPI, isDesktop, type DesktopHardwareProfile } from "../lib/desktop";
import {
  getAssistantSettings,
  saveAssistantSettings,
  type DesktopAssistantSettings,
} from "../lib/desktop-assistant";
import { useCapabilities } from "../queries/capabilities";
import { useModel } from "../queries/model";

const STEPS = ["Willkommen", "Name & Stimme", "Berechtigungen", "Fertig"] as const;

export function FirstRunWizard() {
  const capabilities = useCapabilities();
  const model = useModel();
  const [assistant, setAssistant] = useState<DesktopAssistantSettings>(getAssistantSettings);
  const [hardware, setHardware] = useState<DesktopHardwareProfile | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const shouldShow =
    isDesktop() &&
    capabilities.data?.publicEdition === true &&
    capabilities.data?.localOnly === true &&
    capabilities.data?.requireAuth !== true &&
    !assistant.onboardingComplete;

  useEffect(() => {
    if (!shouldShow) return;
    const api = getNorviDesktopAPI();
    if (!api) return;
    void api.detectHardware().then(setHardware).catch(() => setHardware(null));
    void api.listVoices().then(setVoices).catch(() => setVoices([]));
  }, [shouldShow]);

  const profileHint = useMemo(() => {
    if (!hardware) return "Wird erkannt …";
    return hardware.label + " · " + hardware.ramGiB.toFixed(0) + " GB RAM";
  }, [hardware]);

  if (!shouldShow) return null;

  const finish = async () => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    setFinishing(true);
    const saved = saveAssistantSettings({ ...assistant, onboardingComplete: true });
    setAssistant(saved);
    try {
      await Promise.all([
        api.setQuickShortcut(saved.quickShortcutEnabled),
        api.setVoiceShortcut(saved.voiceShortcutEnabled ? saved.voiceShortcut : null),
        api.setBackgroundMode(
          (!saved.gamingMode && saved.microphoneEnabled && saved.wakeEnabled) ||
            saved.startWithWindows,
        ),
        api.setAutoStart(saved.startWithWindows),
      ]);
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-4 backdrop-blur-2xl">
      <div className="premium-surface rise w-full max-w-2xl overflow-hidden rounded-[1.7rem] border border-white/[0.08] shadow-[0_40px_140px_-50px_rgba(0,0,0,1)]">
        <div className="border-b border-white/[0.06] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Norvi AI Einrichtung
          </div>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((label, index) => (
              <div
                key={label}
                className={"h-1.5 flex-1 rounded-full " + (index <= step ? "bg-primary" : "bg-white/[0.07]")}
                title={label}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[25rem] px-5 py-6 sm:px-7 sm:py-7">
          {step === 0 && (
            <div>
              <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Sparkles className="size-6" />
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.035em]">Willkommen bei Norvi AI</h2>
              <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">
                Kein Account nötig. Norvi AI läuft auf deinem PC und wurde für deine Hardware lokal eingerichtet.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Cpu className="size-4" /> Hardware-Profil
                  </div>
                  <div className="mt-2 text-[14px] font-semibold">{profileHint}</div>
                  <div className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                    {hardware?.cpu ?? "Hardware wird lokal erkannt."}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <ShieldCheck className="size-4" /> Aktives Modell
                  </div>
                  <div className="mt-2 text-[14px] font-semibold">
                    {model.data?.label ?? model.data?.id ?? "Lokales Norvi-AI-Modell"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">LOCAL · OFFLINE READY</div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">Wie soll dein Assistent heißen?</h2>
              <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
                Anzeigename, Rufwort und lokale Windows-Stimme kannst du später jederzeit ändern.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-[11px] text-muted-foreground">Assistentenname</span>
                  <input
                    aria-label="Assistentenname"
                    value={assistant.assistantName}
                    maxLength={40}
                    onChange={(e) => setAssistant((c) => ({ ...c, assistantName: e.target.value }))}
                    placeholder="NORVI"
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] text-muted-foreground">Wake-Phrase</span>
                  <input
                    aria-label="Wake-Phrase"
                    value={assistant.wakePhrase}
                    maxLength={40}
                    onChange={(e) => setAssistant((c) => ({ ...c, wakePhrase: e.target.value }))}
                    placeholder="Hey NORVI"
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
                  />
                </label>
              </div>
              <div className="mt-4">
                <span className="mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Volume2 className="size-3.5" /> Lokale Stimme
                </span>
                <div className="flex gap-2">
                  <select
                    aria-label="Lokale Stimme"
                    value={assistant.voice}
                    onChange={(e) => setAssistant((c) => ({ ...c, voice: e.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
                  >
                    <option value="">Windows-Standardstimme</option>
                    {voices.map((voice) => (
                      <option key={voice} value={voice}>{voice}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const api = getNorviDesktopAPI();
                      if (!api) return;
                      if (previewingVoice) {
                        void api.stopSpeech().finally(() => setPreviewingVoice(false));
                        return;
                      }
                      setPreviewingVoice(true);
                      void api
                        .speak(
                          "Hallo, ich bin NORVI. So klingt meine ausgewählte Stimme.",
                          assistant.voice || undefined,
                        )
                        .finally(() => setPreviewingVoice(false));
                    }}
                    className="icon-action flex shrink-0 items-center gap-1.5 rounded-xl px-3 text-[11px]"
                  >
                    <Volume2 className="size-4" />
                    {previewingVoice ? "Stopp" : "Vorschau"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">Was darf NORVI?</h2>
              <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
                Alles ist später in den Einstellungen änderbar. Screen Mode bleibt standardmäßig aus.
              </p>
              <div className="mt-5 grid gap-2.5">
                {[
                  {
                    key: "microphoneEnabled" as const,
                    icon: Mic,
                    title: "Mikrofon",
                    text: "Spracheingabe und optionales Wakeword lokal verwenden.",
                  },
                  {
                    key: "screenCaptureEnabled" as const,
                    icon: MonitorUp,
                    title: "Screen Mode",
                    text: "Live Screen oder einzelne Bildschirmaufnahmen für lokale Bildanalyse erlauben.",
                  },
                  {
                    key: "desktopActionsEnabled" as const,
                    icon: Sparkles,
                    title: "PC-Aktionen",
                    text: "Freigegebene Apps, Games und deine gespeicherten Websites starten.",
                  },
                ].map(({ key, icon: Icon, title, text }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={title}
                      checked={Boolean(assistant[key])}
                      onChange={(e) => setAssistant((c) => ({ ...c, [key]: e.target.checked }))}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium">{title}</span>
                      <span className="block text-[10px] leading-4 text-muted-foreground">{text}</span>
                    </span>
                  </label>
                ))}

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Push-to-talk Hotkey"
                    disabled={!assistant.microphoneEnabled}
                    checked={assistant.voiceShortcutEnabled}
                    onChange={(e) => setAssistant((c) => ({ ...c, voiceShortcutEnabled: e.target.checked }))}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <Mic className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium">Push-to-talk Hotkey</span>
                    <span className="block text-[10px] leading-4 text-muted-foreground">
                      {assistant.voiceShortcut} startet/stoppt die Spracheingabe.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Wake-Phrase im Hintergrund"
                    disabled={!assistant.microphoneEnabled}
                    checked={assistant.wakeEnabled}
                    onChange={(e) => setAssistant((c) => ({ ...c, wakeEnabled: e.target.checked }))}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <Mic className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium">Wake-Phrase im Hintergrund</span>
                    <span className="block text-[10px] leading-4 text-muted-foreground">
                      Reagiert auf „{assistant.wakePhrase || "Hey NORVI"}“, wenn NORVI im Tray läuft.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-green-500/12 text-green-400">
                <Check className="size-7" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">{assistant.assistantName || "NORVI"} ist bereit.</h2>
              <p className="mt-2 max-w-md text-[12px] leading-5 text-muted-foreground">
                Du kannst sofort chatten. Mit Alt + Leertaste holst du NORVI schnell nach vorne. Alle Optionen findest du später unter Einstellungen.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4 sm:px-7">
          <button
            type="button"
            disabled={step === 0 || finishing}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground disabled:opacity-0"
          >
            <ChevronLeft className="size-4" /> Zurück
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
              className="send-glow flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-primary-foreground"
            >
              Weiter <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={finishing}
              onClick={() => void finish()}
              className="send-glow flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Check className="size-4" /> NORVI starten
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
