import { useEffect, useState } from "react";
import { BrainCircuit, Gauge, Loader2, X, Zap } from "lucide-react";
import { useSettings, useUpdateSettings } from "../queries/settings";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Personal NORVI settings: model and, where supported, answer style. */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const settings = useSettings(open);
  const update = useUpdateSettings();

  const [modelId, setModelId] = useState("");
  const [temperature, setTemperature] = useState(70);
  const [performanceMode, setPerformanceMode] = useState<"fast" | "balanced" | "deep">("balanced");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setModelId(settings.data.modelId);
    setTemperature(settings.data.temperature);
    setPerformanceMode(settings.data.performanceMode);
  }, [settings.data]);

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

  const save = () => {
    setSaved(false);
    update.mutate(
      { modelId, temperature, performanceMode },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6">
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
          className="premium-surface rise relative m-0 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-[1.4rem] border-0 p-0 text-foreground sm:max-h-[calc(100dvh-3rem)]"
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
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">Modell</span>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                aria-label="Modell"
                className="capability-pill w-full rounded-xl px-3 py-2.5 text-sm outline-none transition focus:border-primary/40"
              >
                {(settings.data?.models ?? []).map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-1.5 block text-[12px] text-muted-foreground">
                Leistungsmodus
              </span>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["fast", "Schnell", Zap, "kurz · kein Thinking"],
                  ["balanced", "Normal", Gauge, "ausgewogen · kein Thinking"],
                  ["deep", "Gründlich", BrainCircuit, "4B · starkes Thinking"],
                ] as const).map(([value, label, Icon, hint]) => {
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
              <p className="mt-2 text-[11px] text-muted-foreground">
                NORVI schaltet Modell und Antwortbudget automatisch um.
              </p>
            </div>

            {settings.data?.supportsTemperature ? (
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[12px] text-muted-foreground">
                  <span>Antwortstil</span>
                  <span>
                    {temperature < 35
                      ? "präzise"
                      : temperature > 75
                        ? "kreativ"
                        : "ausgewogen"}{" "}
                    ({(temperature / 100).toFixed(2)})
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={temperature}
                  aria-label="Antwortstil"
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-[var(--primary)]"
                />
              </label>
            ) : (
              <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[12px] text-muted-foreground">
                Der aktive KI-Dienst unterstützt keine Feineinstellung des Antwortstils.
              </p>
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
    </div>
  );
}