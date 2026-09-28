interface NorviMarkProps {
  className?: string;
  pulse?: boolean;
}

/** NORVI monogram — product-like, warm and intentionally not an AI symbol. */
export function NorviMark({ className = "size-7", pulse = false }: NorviMarkProps) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[0.72rem] border border-white/[0.09] bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02)),rgba(16,15,19,0.78)] shadow-[0_16px_40px_-24px_rgba(255,128,87,0.9),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-xl ${className}`}
    >
      <span className="absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-[#ffd4c2]/35 to-transparent" />
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`size-[57%] ${pulse ? "opacity-85" : ""}`}
        fill="none"
      >
        <path
          d="M6.4 17.4V6.6L17.6 17.4V6.6"
          stroke="url(#norvi-n)"
          strokeWidth="2.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="norvi-n" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffc0a6" />
            <stop offset="0.48" stopColor="#ff8b63" />
            <stop offset="1" stopColor="#f16a43" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

export function NorviWordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <NorviMark className="size-9" />
      <span className="text-[1.02rem] font-semibold tracking-[-0.03em] text-foreground">NORVI</span>
    </span>
  );
}