import { useState, type Dispatch, type SetStateAction } from "react";
import { Brain, Plus, Trash2 } from "lucide-react";
import type { DesktopAssistantSettings } from "../lib/desktop-assistant";

interface DesktopMemoryPanelProps {
  assistant: DesktopAssistantSettings;
  setAssistant: Dispatch<SetStateAction<DesktopAssistantSettings>>;
}

export function DesktopMemoryPanel({
  assistant,
  setAssistant,
}: DesktopMemoryPanelProps) {
  const [draft, setDraft] = useState("");

  const addMemory = () => {
    const text = draft.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!text || assistant.memoryItems.length >= 30) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? "memory-" + crypto.randomUUID()
        : "memory-" + Date.now().toString(36);
    setAssistant((current) => ({
      ...current,
      memoryItems: [...current.memoryItems, { id, text }],
    }));
    setDraft("");
  };

  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.018] p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="icon-action flex size-9 shrink-0 items-center justify-center rounded-xl text-primary">
          <Brain className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] font-semibold">Local Memory</div>
            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-muted-foreground">
              <input
                type="checkbox"
                aria-label="Local Memory aktivieren"
                checked={assistant.memoryEnabled}
                onChange={(event) =>
                  setAssistant((current) => ({
                    ...current,
                    memoryEnabled: event.target.checked,
                  }))
                }
                className="size-4 accent-[var(--primary)]"
              />
              Aktiv
            </label>
          </div>
          <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">
            Von dir eingetragene Fakten und Vorlieben. Sie bleiben lokal und werden nur im LOCAL_ONLY-Modus an dein lokales Modell gegeben.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          aria-label="Neue lokale Erinnerung"
          value={draft}
          maxLength={300}
          disabled={!assistant.memoryEnabled || assistant.memoryItems.length >= 30}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addMemory();
            }
          }}
          placeholder='z. B. "Antworte mir normalerweise kurz und direkt."'
          className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 py-2 text-[11px] outline-none transition focus:border-primary/60 disabled:opacity-50"
        />
        <button
          type="button"
          aria-label="Erinnerung hinzufügen"
          disabled={!draft.trim() || !assistant.memoryEnabled || assistant.memoryItems.length >= 30}
          onClick={addMemory}
          className="icon-action flex size-9 shrink-0 items-center justify-center rounded-xl text-foreground disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="mt-2 text-right text-[9px] text-muted-foreground">
        {assistant.memoryItems.length}/30 Erinnerungen
      </div>

      {assistant.memoryItems.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {assistant.memoryItems.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-black/10 p-2.5"
            >
              <textarea
                aria-label={"Erinnerung " + (index + 1)}
                value={item.text}
                maxLength={300}
                rows={2}
                onChange={(event) =>
                  setAssistant((current) => ({
                    ...current,
                    memoryItems: current.memoryItems.map((memory) =>
                      memory.id === item.id
                        ? { ...memory, text: event.target.value }
                        : memory,
                    ),
                  }))
                }
                className="min-h-12 flex-1 resize-y bg-transparent text-[10.5px] leading-4 outline-none"
              />
              <button
                type="button"
                aria-label={"Erinnerung " + (index + 1) + " löschen"}
                onClick={() =>
                  setAssistant((current) => ({
                    ...current,
                    memoryItems: current.memoryItems.filter(
                      (memory) => memory.id !== item.id,
                    ),
                  }))
                }
                className="icon-action flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-white/[0.07] px-3 py-3 text-[10px] leading-4 text-muted-foreground">
          Noch keine Erinnerungen. NORVI merkt sich nichts automatisch — du entscheidest selbst, was hier landet.
        </div>
      )}
    </div>
  );
}
