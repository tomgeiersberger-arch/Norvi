import { Code2, ImagePlus, Lightbulb, ServerCog } from "lucide-react";
import { NorviMark } from "./norvi-mark";

const SUGGESTIONS = [
  { icon: Code2, label: "Code verbessern", text: "Hilf mir, diesen Code sauberer und schneller zu machen" },
  { icon: ServerCog, label: "Server prüfen", text: "Prüfe mit mir Schritt für Schritt einen Linux-Server" },
  { icon: Lightbulb, label: "Etwas erklären", text: "Erklär mir ein schwieriges Thema kurz und verständlich" },
  { icon: ImagePlus, label: "Bild ansehen", text: "Ich lade ein Bild hoch – sag mir, was darauf zu sehen ist" },
];

interface EmptyStateProps {
  agentName: string;
  onPick: (text: string) => void;
  vision?: boolean;
  stt?: boolean;
}

export function EmptyState({ agentName, onPick, vision = false }: EmptyStateProps) {
  const suggestions = vision ? SUGGESTIONS : SUGGESTIONS.filter((item) => item.label !== "Bild ansehen");

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-1 py-12 text-center">
      <div className="rise" style={{ animationDelay: "20ms" }}>
        <NorviMark className="size-12 rounded-xl" />
      </div>

      <h1
        className="rise mt-5 text-[2rem] font-semibold tracking-[-0.045em] text-foreground sm:text-[2.4rem]"
        style={{ animationDelay: "70ms" }}
      >
        Was möchtest du machen?
      </h1>

      <p
        className="rise mt-2 max-w-md text-sm leading-6 text-muted-foreground"
        style={{ animationDelay: "120ms" }}
      >
        Schreib {agentName} einfach, wobei du Hilfe brauchst.
      </p>

      <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion, i) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.text}
              type="button"
              aria-label={suggestion.text}
              onClick={() => onPick(suggestion.text)}
              className="suggestion-card rise group flex items-start gap-3 rounded-2xl p-4 text-left transition duration-200 hover:border-white/[0.12] hover:bg-white/[0.035]"
              style={{ animationDelay: `${170 + i * 45}ms` }}
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-muted-foreground transition group-hover:text-foreground">
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-[13px] font-medium text-foreground">{suggestion.label}</span>
                <span className="mt-1 block text-[12px] leading-5 text-muted-foreground">
                  {suggestion.text}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="rise mt-5 text-[10.5px] text-muted-foreground/55" style={{ animationDelay: "360ms" }}>
        Ctrl/⌘ K · Eingabe fokussieren
      </p>
    </div>
  );
}