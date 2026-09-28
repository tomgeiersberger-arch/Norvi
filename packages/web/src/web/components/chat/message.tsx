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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <img
        src={url}
        alt="Angehängtes Bild in voller Größe"
        className="rise max-h-full max-w-full rounded-2xl border border-white/[0.08] object-contain shadow-2xl"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Bildansicht schließen"
        className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full border border-white/[0.08] bg-[#171717] text-muted-foreground transition hover:text-foreground"
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

export function Message({ message, streaming = false }: MessageProps) {
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
        <div className="flex max-w-[88%] flex-col items-end gap-2 sm:max-w-[72%]">
          {images.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {images.map((image) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => setZoomed(image.url)}
                  aria-label="Bild vergrößern"
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-secondary transition hover:brightness-110"
                >
                  <img src={image.url} alt="Angehängtes Bild" className="max-h-56 max-w-[15rem] object-cover" />
                </button>
              ))}
            </div>
          )}
          {text && (
            <div className="message-user rounded-[1.15rem] rounded-br-[0.35rem] px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap">
              {text}
            </div>
          )}
        </div>
        {zoomed && <Lightbox url={zoomed} onClose={() => setZoomed(null)} />}
      </div>
    );
  }

  return (
    <div className="rise group flex gap-3.5">
      <NorviMark className="mt-0.5 size-7 shrink-0" />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1.5 flex items-center justify-end">
          {text && (
            <button
              type="button"
              onClick={() => void copyText()}
              aria-label="Antwort kopieren"
              title="Antwort kopieren"
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-white/[0.05] hover:text-foreground group-hover:opacity-100 focus:opacity-100"
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

export function TypingIndicator({ vision = false }: { agentName: string; vision?: boolean }) {
  return (
    <div className="flex gap-3.5">
      <NorviMark className="mt-0.5 size-7" />
      <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground">
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
  );
}