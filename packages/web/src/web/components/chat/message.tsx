import { lazy, Suspense, useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { Check, Copy, X } from "lucide-react";
import { NorviMark } from "./norvi-mark";

let markdownModule: Promise<typeof import("./markdown")> | null = null;
function loadMarkdown() {
  markdownModule ??= import("./markdown");
  return markdownModule;
}
const Markdown = lazy(() => loadMarkdown().then((module) => ({ default: module.Markdown })));

function textOf(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("");
}

/** Attached images travel as `file` parts on the UI message. */
function imagesOf(message: UIMessage): { url: string; mediaType: string }[] {
  return message.parts
    .filter(
      (part) =>
        part.type === "file" &&
        typeof (part as { url?: unknown }).url === "string" &&
        String((part as { mediaType?: unknown }).mediaType ?? "").startsWith("image/"),
    )
    .map((part) => ({
      url: (part as { url: string }).url,
      mediaType: (part as { mediaType: string }).mediaType,
    }));
}

function UserAvatar() {
  return (
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[0.6rem] bg-secondary text-[11px] font-semibold text-foreground/80 ring-1 ring-white/10">
      DU
    </span>
  );
}

/** Full-size view of an attached image. */
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <img
        src={url}
        alt="Angehängtes Bild in voller Größe"
        className="rise max-h-full max-w-full rounded-2xl object-contain shadow-[0_40px_120px_-40px_rgba(0,0,0,1)]"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Bildansicht schließen"
        className="absolute top-5 right-5 flex size-9 items-center justify-center rounded-full bg-card/80 text-foreground ring-1 ring-white/10 transition hover:bg-card"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

interface MessageProps {
  message: UIMessage;
  agentName: string;
  streaming?: boolean;
}

export function Message({ message, agentName, streaming = false }: MessageProps) {
  const text = textOf(message);
  const images = imagesOf(message);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  if (message.role === "user") {
    return (
      <div className="rise flex justify-end gap-3">
        <div className="flex max-w-[85%] flex-col items-end gap-2">
          {images.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {images.map((image) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => setZoomed(image.url)}
                  aria-label="Bild vergrößern"
                  className="overflow-hidden rounded-2xl border border-border/70 bg-secondary transition hover:brightness-110"
                >
                  <img
                    src={image.url}
                    alt="Angehängtes Bild"
                    className="max-h-56 max-w-[15rem] object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          {text && (
            <div className="rounded-2xl rounded-br-md border border-white/[0.055] bg-[linear-gradient(145deg,rgba(31,35,44,0.96),rgba(24,27,34,0.94))] px-4 py-2.5 text-[0.97rem] leading-relaxed whitespace-pre-wrap shadow-[0_14px_36px_-24px_rgba(0,0,0,1)]">
              {text}
            </div>
          )}
        </div>
        <UserAvatar />
        {zoomed && <Lightbox url={zoomed} onClose={() => setZoomed(null)} />}
      </div>
    );
  }

  return (
    <div className="rise group flex gap-3.5">
      <NorviMark className="mt-0.5 size-8 shrink-0" />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-white/[0.06] bg-[linear-gradient(150deg,rgba(255,255,255,0.026),rgba(255,255,255,0.012))] px-4 py-3.5 shadow-[0_16px_50px_-42px_rgba(0,0,0,0.95)] sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {agentName}
          </div>
          {text && (
            <button
              type="button"
              onClick={() => void copyText()}
              aria-label="Antwort kopieren"
              title="Antwort kopieren"
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-60 transition hover:bg-white/[0.06] hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
            >
              {copied ? <Check className="size-3.5 text-green-400" /> : <Copy className="size-3.5" />}
            </button>
          )}
        </div>
        <div className={streaming && text.length > 0 ? "streaming-caret" : ""}>
          <Suspense fallback={<div className="whitespace-pre-wrap">{text}</div>}>
            <Markdown content={text} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator({
  agentName,
  vision = false,
}: {
  agentName: string;
  vision?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <NorviMark className="mt-0.5 size-7" pulse />
      <div>
        <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
          {agentName}
        </div>
        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: `${i * 140}ms`, animationDuration: "1s" }}
              />
            ))}
          </span>
          {vision && <span>Bildanalyse läuft lokal …</span>}
        </div>
      </div>
    </div>
  );
}
