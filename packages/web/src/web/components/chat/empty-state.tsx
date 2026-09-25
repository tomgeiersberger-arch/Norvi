import { Code2, ImagePlus, Lightbulb, Mic2, ServerCog, Sparkles } from "lucide-react";
import { NorviMark } from "./norvi-mark";

const SUGGESTIONS = [
  { icon: Code2, label: "Code", text: "Hilf mir, diesen Code sauberer und schneller zu machen" },
  { icon: ServerCog, label: "Server", text: "Prüfe mit mir Schritt für Schritt einen Linux-Server" },
  { icon: Lightbulb, label: "Erklären", text: "Erklär mir ein schwieriges Thema kurz und verständlich" },
  { icon: ImagePlus, label: "Vision", text: "Ich lade ein Bild hoch – analysiere, was darauf zu sehen ist" },
];

interface EmptyStateProps {
  agentName: string;
  onPick: (text: string) => void;
  /** Image understanding is available — mention the attach button. */
  vision?: boolean;
  /** A Whisper endpoint is configured — mention the microphone. */
  stt?: boolean;
}

export function EmptyState({ agentName, onPick, vision = false, stt = false }: EmptyStateProps) {
  const hints = [
    vision ? "Bild anhängen und Fragen dazu stellen" : null,
    stt ? "Per Mikrofon diktieren statt tippen" : null,
  ].filter((hint): hint is string => hint !== null);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-1 py-12 text-center">
      <div className="rise relative" style={{ animationDelay: "40ms" }}>
        <div className="absolute inset-[-18px] rounded-full bg-primary/15 blur-3xl" />
        <div className="glass-panel relative flex size-20 items-center justify-center rounded-[1.7rem]">
          <NorviMark className="size-11" pulse />
          <Sparkles className="absolute -top-1 -right-1 size-4 text-primary" />
        </div>
      </div>
      <div
        className="rise mt-7 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"
        style={{ animationDelay: "90ms" }}
      >
        Private Local AI
      </div>
      <h1
        className="rise mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-[2.15rem]"
        style={{ animationDelay: "130ms" }}
      >
        Was bauen wir heute?
      </h1>
      <p
        className="rise mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground"
        style={{ animationDelay: "200ms" }}
      >
        {agentName} läuft auf deinem Server, streamt Antworten live und versteht auf Wunsch Bilder und Sprache.
      </p>
      <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion, i) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.text}
              type="button"
              onClick={() => onPick(suggestion.text)}
              className="rise group rounded-2xl border border-white/[0.065] bg-white/[0.025] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.045] hover:shadow-[0_20px_55px_-35px_rgba(255,122,89,0.45)]"
              style={{ animationDelay: `${280 + i * 70}ms` }}
            >
              <span className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                <span className="flex size-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035] text-primary transition group-hover:border-primary/20 group-hover:bg-primary/[0.08]">
                  <Icon className="size-3.5" />
                </span>
                {suggestion.label}
              </span>
              <span className="block text-[0.86rem] leading-relaxed text-foreground/82 transition group-hover:text-foreground">
                {suggestion.text}
              </span>
            </button>
          );
        })}
      </div>
      {hints.length > 0 && (
        <div
          className="rise mt-6 flex flex-wrap items-center justify-center gap-2"
          style={{ animationDelay: `${280 + SUGGESTIONS.length * 70}ms` }}
        >
          {hints.map((hint) => (
            <span
              key={hint}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground"
            >
              {hint.startsWith("Bild") ? <ImagePlus className="size-3.5" /> : <Mic2 className="size-3.5" />}
              {hint}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
