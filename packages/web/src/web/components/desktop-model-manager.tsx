import { useEffect, useState } from "react";
import { Check, Download, HardDrive, Loader2, Trash2 } from "lucide-react";
import {
  getNorviDesktopAPI,
  type ManagedModelInfo,
} from "../lib/desktop";

function sizeLabel(bytes: number | null): string {
  if (!bytes) return "";
  return (bytes / 1024 ** 3).toFixed(1) + " GB";
}

export function DesktopModelManager() {
  const [models, setModels] = useState<ManagedModelInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    try {
      setModels(await api.listManagedModels());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Modelle konnten nicht gelesen werden.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const run = async (
    key: string,
    task: () => Promise<ManagedModelInfo[]>,
  ) => {
    setBusy(key);
    setNotice(null);
    try {
      setModels(await task());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Modell-Aktion fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.018] p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="icon-action flex size-9 shrink-0 items-center justify-center rounded-xl text-primary">
          <HardDrive className="size-4" />
        </div>
        <div>
          <div className="text-[13px] font-semibold">Model Manager</div>
          <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">
            NORVI-Textmodelle lokal laden, aktivieren und nicht benötigte Profile entfernen.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {models.length === 0 ? (
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl border border-dashed border-white/[0.07] px-3 py-3 text-[10px] text-muted-foreground"
          >
            Modelle neu laden
          </button>
        ) : (
          models.map((model) => {
            const isBusy = busy?.endsWith(":" + model.profile) === true;
            return (
              <div
                key={model.profile}
                className="rounded-xl border border-white/[0.05] bg-black/10 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold">{model.label}</span>
                      {model.active && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/[0.08] px-1.5 py-0.5 text-[8.5px] text-green-400">
                          <Check className="size-2.5" /> Aktiv
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[9.5px] text-muted-foreground">
                      {model.model}
                      {model.installed && model.sizeBytes
                        ? " · " + sizeLabel(model.sizeBytes)
                        : ""}
                    </div>
                  </div>
                  {isBusy && <Loader2 className="size-4 animate-spin text-primary" />}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {!model.installed ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        const api = getNorviDesktopAPI();
                        if (!api) return;
                        void run("pull:" + model.profile, () =>
                          api.pullManagedModel(model.profile),
                        );
                      }}
                      className="icon-action flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] disabled:opacity-40"
                    >
                      <Download className="size-3.5" /> Herunterladen
                    </button>
                  ) : (
                    <>
                      {!model.active && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => {
                            const api = getNorviDesktopAPI();
                            if (!api) return;
                            void run("activate:" + model.profile, () =>
                              api.activateManagedModel(model.profile),
                            );
                          }}
                          className="send-glow rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground disabled:opacity-40"
                        >
                          Aktivieren
                        </button>
                      )}
                      {!model.active && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => {
                            if (!window.confirm(model.label + " wirklich lokal löschen?")) return;
                            const api = getNorviDesktopAPI();
                            if (!api) return;
                            void run("delete:" + model.profile, () =>
                              api.deleteManagedModel(model.profile),
                            );
                          }}
                          className="icon-action flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-destructive disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" /> Löschen
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {notice && (
        <div className="mt-3 rounded-xl border border-white/[0.055] bg-black/10 px-3 py-2 text-[10px] text-muted-foreground">
          {notice}
        </div>
      )}
    </div>
  );
}
