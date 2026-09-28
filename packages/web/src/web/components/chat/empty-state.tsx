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
    <div className="flex min-h-full flex-col items-center justify-center px-1 py-12 text-center sm:py-16">
      <div className="hero-glass rise relative" style={{ animationDelay: "20ms" }}>
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-ring hero-ring-outer" />
        <div className="hero-ring hero-ring-inner" />
        <div className="hero-mark-wrap">
          <NorviMark className="size-16 rounded-[1.1rem] sm:size-[4.5rem]" />
        </div>
      </div>

      <h1
        className="hero-title rise mt-7 max-w-2xl text-[2.25rem] font-semibold leading-[1.02] tracking-[-0.06em] sm:text-[3.2rem]"
        style={{ animationDelay: "80ms" }}
      >
        Was machen wir heute?
      </h1>

      <p
        className="rise mt-3 max-w-lg text-[13.5px] leading-6 text-muted-foreground sm:text-sm"
        style={{ animationDelay: "135ms" }}
      >
        Schreib {agentName} einfach, was du brauchst. Kurz, direkt oder komplett chaotisch.
      </p>

      <div className="mt-9 grid w-full max-w-[44rem] gap-2.5 sm:grid-cols-2">
        {suggestions.map((suggestion, i) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.text}
              type="button"
              aria-label={suggestion.text}
              onClick={() => onPick(suggestion.text)}
              className="suggestion-card rise group flex items-start gap-3.5 rounded-[1.35rem] p-4 text-left transition duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${190 + i * 55}ms` }}
            >
              <span className="suggestion-icon flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition duration-300 group-hover:text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold tracking-[-0.015em] text-foreground/95">
                  {suggestion.label}
                </span>
                <span className="mt-1 block text-[11.5px] leading-5 text-muted-foreground">
                  {suggestion.text}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rise mt-6 flex items-center gap-2 text-[10px] text-muted-foreground/42" style={{ animationDelay: "420ms" }}>
        <span className="h-px w-6 bg-gradient-to-r from-transparent to-white/10" />
        Ctrl/⌘ K · Eingabe fokussieren
        <span className="h-px w-6 bg-gradient-to-l from-transparent to-white/10" />
      </div>
    </div>
  );
}