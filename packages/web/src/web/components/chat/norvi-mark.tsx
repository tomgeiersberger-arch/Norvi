interface NorviMarkProps {
  className?: string;
  pulse?: boolean;
}

/** Norvi logo mark — a starburst inside a soft terracotta tile. */
export function NorviMark({ className = "size-7", pulse = false }: NorviMarkProps) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[0.68rem] bg-[linear-gradient(145deg,rgba(255,122,89,0.22),rgba(255,122,89,0.08))] ring-1 ring-primary/30 shadow-[0_12px_30px_-18px_rgba(255,122,89,0.9)] ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`size-[62%] ${pulse ? "animate-pulse" : ""}`}
        fill="none"
      >
        <path
          d="M12 2.5c.5 4.2 2.2 6.1 6.4 6.9-4.2.8-5.9 2.6-6.4 6.9-.5-4.3-2.2-6.1-6.4-6.9C9.8 8.6 11.5 6.7 12 2.5Z"
          fill="var(--primary)"
        />
        <path
          d="M17.6 15.4c.3 2.2 1.2 3.1 3.4 3.5-2.2.4-3.1 1.3-3.4 3.5-.3-2.2-1.2-3.1-3.4-3.5 2.2-.4 3.1-1.3 3.4-3.5Z"
          fill="var(--primary)"
          opacity="0.55"
        />
      </svg>
    </span>
  );
}

/** Wordmark used in the sidebar header. */
export function NorviWordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <NorviMark className="size-9" />
      <span className="leading-tight">
        <span className="block text-[1rem] font-semibold tracking-tight">NORVI</span>
        <span className="block text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
          NORVI AI
        </span>
      </span>
    </span>
  );
}