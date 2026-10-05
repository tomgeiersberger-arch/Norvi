interface NorviMarkProps {
  className?: string;
  pulse?: boolean;
}

/** Norvi AI app mark — shared with the Windows executable, taskbar and Start menu. */
export function NorviMark({ className = "size-7", pulse = false }: NorviMarkProps) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[0.72rem] border border-white/[0.09] bg-[#0d1014] shadow-[0_14px_34px_-24px_rgba(255,112,32,0.72)] ${className}`}
    >
      <img
        src="/norvi-ai.svg"
        alt=""
        aria-hidden="true"
        className={`size-full object-cover ${pulse ? "opacity-85" : ""}`}
      />
    </span>
  );
}

export function NorviWordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <NorviMark className="size-9" />
      <span className="text-[1.02rem] font-semibold tracking-[-0.03em] text-foreground">Norvi AI</span>
    </span>
  );
}
