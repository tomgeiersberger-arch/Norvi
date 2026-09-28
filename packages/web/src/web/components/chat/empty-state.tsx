import { Code2, ImagePlus, Lightbulb, Mic2, ServerCog, Sparkles, Zap } from "lucide-react";
import { NorviMark } from "./norvi-mark";

const SUGGESTIONS = [
  {
    icon: Code2,
    label: "Code",
    text: "Hilf mir, diesen Code sauberer und schneller zu machen",
    meta: "Build",
  },
  {
    icon: ServerCog,
    label: "Server",
    text: "Prüfe mit mir Schritt für Schritt einen Linux-Server",
    meta: "Debug",
  },
  {
    icon: Lightbulb,
    label: "Erklären",
    text: "Erklär mir ein schwieriges Thema kurz und verständlich",
    meta: "Learn",
  },
  {
    icon: ImagePlus,
    label: "Vision",
    text: "Ich lade ein Bild hoch – analysiere, was darauf zu sehen ist",
    meta: "See",
  },
];

interface EmptyStateProps {
  agentName: string;
  onPick: (text: string) => void;
  vision?: boolean;
  stt?: boolean;
}

export function EmptyState({ agentName, onPick, vision = false, stt = false }: EmptyStateProps) {
  const suggestions = vision ? SUGGESTIONS : SUGGESTIONS.filter((item) => item.label !== "Vision");

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-1 py-10 text-center sm:py-14">
      <div className="rise relative mb-1" style={{ animationDelay: "40ms" }}>
        <div className="absolute inset-[-4.5rem] rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="hero-core">
          <span className="hero-orbit" />
          <NorviMark className="size-[4.7rem] rounded-[1.55rem]" pulse />
          <Sparkles className="absolute -right-2 -top-2 size-4 text-primary drop-shadow-[0_0_10px_rgba(255,125,87,0.8)]" />
        </div>
      </div>

      <div
        className="rise mt-9 flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[9.5px] font-semibold tracking-[0.19em] text-muted-foreground/85 uppercase"
        style={{ animationDelay: "100ms" }}
      >
        <span className="status-dot size-1.5 rounded-full bg-green-400" />
        Private · Local · Yours
      </div>

      <h1
        className="gradient-title rise mt-4 max-w-2xl text-[2.35rem] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[3.35rem]"
        style={{ animationDelay: "145ms" }}
      >
        Frag. Bau. Versteh.
      </h1>

      <p
        className="rise mt-4 max-w-xl text-[13.5px] leading-6 text-muted-foreground sm:text-sm"
        style={{ animationDelay: "205ms" }}
      >
        {agentName} läuft direkt auf deinem Server. Keine Cloud-KI nötig – nur deine lokale
        Hardware, Live-Antworten, Vision und Sprache.
      </p>

      <div
        className="rise mt-5 flex flex-wrap items-center justify-center gap-2"
        style={{ animationDelay: "245ms" }}
      >
        <span className="capability-pill flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] text-muted-foreground">
          <Zap className="size-3 text-primary" />
          Local AI
        </span>
        {vision && (
          <span className="capability-pill flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] text-muted-foreground">
            <ImagePlus className="size-3 text-sky-300" />
            Vision ready
          </span>
        )}
        {stt && (
          <span className="capability-pill flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] text-muted-foreground">
            <Mic2 className="size-3 text-violet-300" />
            Voice ready
          </span>
        )}
      </div>

      <div className="mt-9 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
        {suggestions.map((suggestion, i) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.text}
              type="button"
              aria-label={suggestion.text}
              onClick={() => onPick(suggestion.text)}
              className="suggestion-card rise group rounded-[1.35rem] p-4.5 text-left transition duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_24px_70px_-42px_rgba(255,125,87,0.52)]"
              style={{ animationDelay: `${300 + i * 65}ms` }}
            >
              <div className="relative z-10 flex items-start gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-primary transition duration-300 group-hover:border-primary/22 group-hover:bg-primary/[0.09] group-hover:shadow-[0_0_24px_-10px_rgba(255,125,87,0.8)]">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      {suggestion.label}
                    </span>
                    <span className="text-[9px] font-medium tracking-[0.16em] text-muted-foreground/45 uppercase">
                      {suggestion.meta}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[0.87rem] leading-relaxed text-foreground/82 transition group-hover:text-foreground">
                    {suggestion.text}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p
        className="rise mt-6 text-[10.5px] tracking-wide text-muted-foreground/48"
        style={{ animationDelay: `${340 + suggestions.length * 65}ms` }}
      >
        Tipp: <kbd className="font-sans text-muted-foreground/70">Ctrl/⌘ K</kbd> springt direkt ins Eingabefeld
      </p>
    </div>
  );
}