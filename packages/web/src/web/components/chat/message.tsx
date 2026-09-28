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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-lg"
      onClick={onClose}
      role="presentation"
    >
      <img
        src={url}
        alt="Angehängtes Bild in voller Größe"
        className="rise max-h-full max-w-full rounded-2xl border border-white/[0.08] object-contain shadow-[0_36px_100px_-30px_rgba(0,0,0,1)]"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Bildansicht schließen"
        className="icon-action absolute right-5 top-5 flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
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
      <div className="rise flex justify-end">
        <div className="flex max-w-[88%] flex-col items-end gap-2 sm:max-w-[74%]">
          {images.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {images.map((image) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => setZoomed(image.url)}
                  aria-label="Bild vergrößern"
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-secondary shadow-[0_16px_38px_-28px_rgba(0,0,0,1)] transition hover:brightness-110"
                >
                  <img src={image.url} alt="Angehängtes Bild" className="max-h-56 max-w-[15rem] object-cover" />
                </button>
              ))}
            </div>
          )}
          {text && (
            <div className="message-user rounded-[1.25rem] rounded-br-[0.42rem] px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap">
              {text}
            </div>
          )}
        </div>
        {zoomed && <Lightbox url={zoomed} onClose={() => setZoomed(null)} />}
      </div>
    );
  }

  return (
    <div className="rise group flex gap-3.5 sm:gap-4">
      <NorviMark className="mt-0.5 size-8 shrink-0" />
      <div className="message-assistant min-w-0 flex-1 rounded-[1.45rem] rounded-tl-[0.5rem] px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/70">
            {agentName}
          </span>
          {text && (
            <button
              type="button"
              onClick={() => void copyText()}
              aria-label="Antwort kopieren"
              title="Antwort kopieren"
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-55 transition hover:bg-white/[0.04] hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
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
    <div className="flex gap-3.5 sm:gap-4">
      <NorviMark className="mt-0.5 size-8" pulse />
      <div className="message-assistant rounded-[1.1rem] rounded-tl-[0.4rem] px-4 py-3">
        <div className="mb-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/65">
          {agentName}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70"
                style={{ animationDelay: `${i * 140}ms`, animationDuration: "1s" }}
              />
            ))}
          </span>
          {vision && <span>Bild wird geprüft …</span>}
        </div>
      </div>
    </div>
  );
}