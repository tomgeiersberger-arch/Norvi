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
    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[0.72rem] border border-white/[0.075] bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] text-[9px] font-semibold tracking-[0.08em] text-foreground/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-6 backdrop-blur-xl"
      onClick={onClose}
      role="presentation"
    >
      <img
        src={url}
        alt="Angehängtes Bild in voller Größe"
        className="rise max-h-full max-w-full rounded-[1.6rem] border border-white/[0.08] object-contain shadow-[0_42px_140px_-38px_rgba(0,0,0,1)]"
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
      <div className="rise flex justify-end gap-3.5">
        <div className="flex max-w-[88%] flex-col items-end gap-2 sm:max-w-[78%]">
          {images.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {images.map((image) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => setZoomed(image.url)}
                  aria-label="Bild vergrößern"
                  className="overflow-hidden rounded-[1.25rem] border border-white/[0.075] bg-secondary shadow-[0_18px_50px_-32px_rgba(0,0,0,1)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
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
            <div className="message-user rounded-[1.3rem] rounded-br-[0.38rem] px-4 py-3 text-[0.96rem] leading-relaxed whitespace-pre-wrap sm:px-4.5">
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
    <div className="rise group flex gap-3.5 sm:gap-4">
      <NorviMark className="mt-0.5 size-8 shrink-0" />
      <div className="message-assistant min-w-0 flex-1 rounded-[1.35rem] rounded-tl-[0.38rem] px-4 py-4 sm:px-5.5 sm:py-4.5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[9.5px] font-semibold tracking-[0.18em] text-muted-foreground/65 uppercase">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(255,125,87,0.7)]" />
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(255,125,87,0.65)]" />
          {agentName}
          </div>
          {text && (
            <button
              type="button"
              onClick={() => void copyText()}
              aria-label="Antwort kopieren"
              title="Antwort kopieren"
              className="icon-action flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-60 transition hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
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
    <div className="flex gap-3.5">
      <NorviMark className="mt-0.5 size-7" pulse />
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[9.5px] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
          {agentName}
        </div>
        <div className="message-assistant flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground">
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