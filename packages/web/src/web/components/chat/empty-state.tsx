const SUGGESTIONS = [
  "Erklär mir Vektordatenbanken in 5 Sätzen",
  "Schreib eine Python-Funktion für Fibonacci mit Memoization",
  "Gib mir 5 Namen für eine Espresso-Bar in Wien",
  "Was ist der Unterschied zwischen TCP und UDP?",
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
      <div
        className="rise flex size-12 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/25"
        style={{ animationDelay: "40ms" }}
      >
        <span className="size-4 rounded-full bg-primary" />
      </div>
      <h1
        className="rise mt-6 text-2xl font-medium tracking-tight sm:text-[1.75rem]"
        style={{ animationDelay: "120ms" }}
      >
        Womit fangen wir an?
      </h1>
      <p
        className="rise mt-2 max-w-sm text-sm text-muted-foreground"
        style={{ animationDelay: "200ms" }}
      >
        {agentName} antwortet live, Token für Token — Code inklusive Syntax-Highlighting.
      </p>
      <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion, i) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rise rounded-xl border border-border bg-card/60 px-4 py-3 text-left text-[0.86rem] leading-snug text-foreground/85 transition hover:border-primary/40 hover:bg-card hover:text-foreground"
            style={{ animationDelay: `${280 + i * 70}ms` }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      {hints.length > 0 && (
        <div
          className="rise mt-6 flex flex-wrap items-center justify-center gap-2"
          style={{ animationDelay: `${280 + SUGGESTIONS.length * 70}ms` }}
        >
          {hints.map((hint) => (
            <span
              key={hint}
              className="rounded-full border border-border/70 bg-card/40 px-3 py-1 text-xs text-muted-foreground"
            >
              {hint}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
