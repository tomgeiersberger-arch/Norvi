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
      <div className="rise relative" style={{ animationDelay: "20ms" }}>
        <div className="heaven-halo absolute -inset-16 rounded-full" />
        <div className="relative rounded-[1.35rem] border border-white/[0.055] bg-white/[0.018] p-3 shadow-[0_26px_80px_-42px_rgba(0,0,0,1)]">
          <NorviMark className="size-14 rounded-[1rem]" />
        </div>
      </div>

      <h1
        className="brand-title rise mt-6 text-[2.15rem] font-semibold leading-tight tracking-[-0.055em] sm:text-[2.75rem]"
        style={{ animationDelay: "70ms" }}
      >
        Was kann ich für dich tun?
      </h1>

      <p
        className="rise mt-3 max-w-md text-[13.5px] leading-6 text-muted-foreground"
        style={{ animationDelay: "120ms" }}
      >
        Schreib {agentName} einfach, was du brauchst.
      </p>

      <div className="mt-9 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
        {suggestions.map((suggestion, i) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.text}
              type="button"
              aria-label={suggestion.text}
              onClick={() => onPick(suggestion.text)}
              className="suggestion-card rise group flex items-start gap-3.5 rounded-[1.25rem] p-4 text-left transition duration-250 hover:-translate-y-0.5"
              style={{ animationDelay: `${175 + i * 45}ms` }}
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025] text-muted-foreground transition group-hover:border-primary/20 group-hover:bg-primary/[0.055] group-hover:text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold tracking-[-0.01em] text-foreground/95">
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

      <p className="rise mt-5 text-[10px] text-muted-foreground/42" style={{ animationDelay: "365ms" }}>
        Ctrl/⌘ K · Eingabe fokussieren
      </p>
    </div>
  );
}