import { ArrowUpRight, Code2, Coffee, Database, Mic, Network, Paperclip } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NorviMark } from "./norvi-mark";

interface Suggestion {
  text: string;
  icon: LucideIcon;
}

const SUGGESTIONS: Suggestion[] = [
  { text: "Erklär mir Vektordatenbanken in 5 Sätzen", icon: Database },
  { text: "Schreib eine Python-Funktion für Fibonacci mit Memoization", icon: Code2 },
  { text: "Gib mir 5 Namen für eine Espresso-Bar in Wien", icon: Coffee },
  { text: "Was ist der Unterschied zwischen TCP und UDP?", icon: Network },
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
    vision ? { icon: Paperclip, label: "Bild anhängen und Fragen dazu stellen" } : null,
    stt ? { icon: Mic, label: "Per Mikrofon diktieren statt tippen" } : null,
  ].filter((hint): hint is { icon: LucideIcon; label: string } => hint !== null);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-1 py-12 text-center">
      <div className="rise relative" style={{ animationDelay: "40ms" }}>
        <span
          aria-hidden
          className="halo absolute inset-0 -z-10 rounded-full bg-primary/40 blur-2xl"
        />
        <NorviMark className="size-14 shadow-[0_18px_50px_-18px_rgba(217,119,87,0.9)]" />
      </div>

      <h1
        className="rise text-gradient mt-7 text-[2rem] leading-tight font-semibold tracking-tight sm:text-[2.35rem]"
        style={{ animationDelay: "120ms" }}
      >
        Womit fangen wir an?
      </h1>
      <p
        className="rise mt-3 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground"
        style={{ animationDelay: "200ms" }}
      >
        {agentName} antwortet live, Token für Token — Code inklusive Syntax-Highlighting.
      </p>

      <div className="mt-9 grid w-full max-w-xl gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion, i) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.text}
              type="button"
              onClick={() => onPick(suggestion.text)}
              className="rise hover-lift surface-glass group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-border px-4 py-3.5 text-left ring-1 ring-white/[0.02] hover:border-primary/45 hover:shadow-[0_20px_50px_-28px_rgba(217,119,87,0.55)]"
              style={{ animationDelay: `${280 + i * 70}ms` }}
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20 transition group-hover:bg-primary/20">
                <Icon className="size-4" />
              </span>
              <span className="flex-1 text-[0.88rem] leading-snug text-foreground/85 transition group-hover:text-foreground">
                {suggestion.text}
              </span>
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
            </button>
          );
        })}
      </div>

      {hints.length > 0 && (
        <div
          className="rise mt-7 flex flex-wrap items-center justify-center gap-2"
          style={{ animationDelay: `${280 + SUGGESTIONS.length * 70}ms` }}
        >
          {hints.map((hint) => {
            const Icon = hint.icon;
            return (
              <span
                key={hint.label}
                className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground"
              >
                <Icon className="size-3.5 text-primary/70" />
                {hint.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
