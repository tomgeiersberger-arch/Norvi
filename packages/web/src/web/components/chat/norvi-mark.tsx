interface NorviMarkProps {
  className?: string;
  pulse?: boolean;
}

/** NORVI core mark — compact, local-first and designed to stay crisp at small sizes. */
export function NorviMark({ className = "size-7", pulse = false }: NorviMarkProps) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[0.72rem] border border-white/[0.09] bg-[radial-gradient(circle_at_34%_28%,rgba(255,255,255,0.10),transparent_24%),linear-gradient(145deg,rgba(255,125,87,0.19),rgba(12,15,22,0.92)_58%)] shadow-[0_14px_36px_-19px_rgba(255,125,87,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] ${className}`}
    >
      <span className="absolute inset-[13%] rounded-[0.5rem] border border-primary/12" />
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`relative z-10 size-[60%] drop-shadow-[0_0_9px_rgba(255,125,87,0.55)] ${pulse ? "animate-pulse" : ""}`}
        fill="none"
      >
        <path
          d="M12 2.7c.55 4.15 2.3 5.95 6.35 6.75-4.05.78-5.8 2.58-6.35 6.73-.55-4.15-2.3-5.95-6.35-6.73C9.7 8.65 11.45 6.85 12 2.7Z"
          fill="var(--primary)"
        />
        <path
          d="M17.65 15.35c.28 2.05 1.16 2.95 3.28 3.32-2.12.4-3 1.3-3.28 3.35-.3-2.05-1.18-2.95-3.3-3.35 2.12-.37 3-1.27 3.3-3.32Z"
          fill="#68d7ff"
          opacity="0.72"
        />
      </svg>
      <span className="absolute bottom-0 left-[22%] right-[22%] h-px bg-gradient-to-r from-transparent via-primary/65 to-transparent" />
    </span>
  );
}

/** Wordmark used in the navigation shell. */
export function NorviWordmark() {
  return (
    <span className="flex items-center gap-3">
      <NorviMark className="size-10" />
      <span className="leading-tight">
        <span className="block text-[1.03rem] font-semibold tracking-[-0.025em]">NORVI</span>
        <span className="mt-0.5 block text-[9px] font-medium tracking-[0.24em] text-muted-foreground/75 uppercase">
          Local Intelligence
        </span>
      </span>
    </span>
  );
}
