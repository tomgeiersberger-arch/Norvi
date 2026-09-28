interface NorviMarkProps {
  className?: string;
  pulse?: boolean;
}

/** Simple NORVI product mark. Intentionally avoids generic AI/sparkle imagery. */
export function NorviMark({ className = "size-7", pulse = false }: NorviMarkProps) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[0.62rem] border border-white/[0.08] bg-[#171717] ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`size-[58%] ${pulse ? "opacity-80" : ""}`}
        fill="none"
      >
        <path
          d="M6.5 17.5V6.5L17.5 17.5V6.5"
          stroke="var(--primary)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function NorviWordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <NorviMark className="size-9" />
      <span className="text-[1rem] font-semibold tracking-[-0.025em]">NORVI</span>
    </span>
  );
}