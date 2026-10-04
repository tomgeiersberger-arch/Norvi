import type { Dispatch, SetStateAction } from "react";
import { Braces, Gamepad2, GraduationCap, MessageSquareText, Pencil, Zap } from "lucide-react";
import type {
  DesktopAssistantSettings,
  ResponsePreset,
} from "../lib/desktop-assistant";

interface DesktopStylePanelProps {
  assistant: DesktopAssistantSettings;
  setAssistant: Dispatch<SetStateAction<DesktopAssistantSettings>>;
}

const PRESETS: {
  id: ResponsePreset;
  label: string;
  hint: string;
  icon: typeof MessageSquareText;
}[] = [
  { id: "normal", label: "Normal", hint: "Ausgewogen", icon: MessageSquareText },
  { id: "short", label: "Kurz", hint: "Direkt & knapp", icon: Zap },
  { id: "coding", label: "Coding", hint: "Code zuerst", icon: Braces },
  { id: "gaming", label: "Gaming", hint: "Kurze Game-Hilfe", icon: Gamepad2 },
  { id: "explain", label: "Erklären", hint: "Einfach & Schritt für Schritt", icon: GraduationCap },
  { id: "custom", label: "Eigener Stil", hint: "Selbst festlegen", icon: Pencil },
];

export function DesktopStylePanel({
  assistant,
  setAssistant,
}: DesktopStylePanelProps) {
  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.018] p-4">
      <div className="mb-3">
        <div className="text-[13px] font-semibold">Antwort-Preset</div>
        <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">
          Legt nur Ton, Format und Länge fest. Sicherheits- und Systemregeln bleiben immer unverändert.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PRESETS.map(({ id, label, hint, icon: Icon }) => {
          const active = assistant.responsePreset === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() =>
                setAssistant((current) => ({ ...current, responsePreset: id }))
              }
              className={
                "rounded-xl border px-3 py-2.5 text-left transition " +
                (active
                  ? "border-primary/35 bg-primary/[0.08] text-foreground"
                  : "border-white/[0.055] bg-black/10 text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className={"mb-1.5 size-4 " + (active ? "text-primary" : "")} />
              <div className="text-[11px] font-semibold">{label}</div>
              <div className="mt-0.5 text-[9px] opacity-70">{hint}</div>
            </button>
          );
        })}
      </div>

      {assistant.responsePreset === "custom" && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[10px] text-muted-foreground">
            Eigene Stil-Vorgabe
          </span>
          <textarea
            aria-label="Eigene Antwortstil-Vorgabe"
            value={assistant.customResponseStyle}
            maxLength={500}
            rows={3}
            onChange={(event) =>
              setAssistant((current) => ({
                ...current,
                customResponseStyle: event.target.value,
              }))
            }
            placeholder="z. B. Antworte locker, sehr kurz und nenne zuerst die wichtigste Lösung."
            className="w-full resize-y rounded-xl border border-border bg-background/60 px-3 py-2 text-[11px] leading-4 outline-none transition focus:border-primary/60"
          />
          <span className="mt-1 block text-right text-[9px] text-muted-foreground">
            {assistant.customResponseStyle.length}/500
          </span>
        </label>
      )}
    </div>
  );
}
