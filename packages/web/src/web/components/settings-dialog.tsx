import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useSettings, useUpdateSettings } from "../queries/settings";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Personal NORVI AI settings: model and, where supported, answer style. */
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

  if (!open) return null;

  const save = () => {
    setSaved(false);
    update.mutate(
      { modelId, temperature, performanceMode },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Einstellungen schließen"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="rise relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Einstellungen</h2>
            <p className="text-[12px] text-muted-foreground">
              Gilt nur für dein NORVI AI Konto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

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
                className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60"
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
                  ["fast", "Schnell"],
                  ["balanced", "Normal"],
                  ["deep", "Gründlich"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPerformanceMode(value)}
                    className={`rounded-xl border px-2 py-2 text-[12px] transition ${
                      performanceMode === value
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Schnell spart Rechenzeit, Normal ist der Standard, Gründlich nutzt ein optionales
                größeres Modell und ein höheres Antwortlimit.
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
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {update.isPending && <Loader2 className="size-4 animate-spin" />}
                Speichern
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
