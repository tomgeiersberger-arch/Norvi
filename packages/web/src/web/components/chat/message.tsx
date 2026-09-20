import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { X } from "lucide-react";
import { Markdown } from "./markdown";
import { NorviMark } from "./norvi-mark";

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
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[0.6rem] bg-gradient-to-br from-secondary to-accent text-[11px] font-semibold text-foreground/80 ring-1 ring-white/10">
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
            <div className="rounded-2xl rounded-br-md bg-bubble px-4 py-2.5 text-[0.97rem] leading-relaxed whitespace-pre-wrap shadow-[0_10px_30px_-20px_rgba(0,0,0,0.9)]">
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
    <div className="rise flex gap-3">
      <NorviMark className="mt-0.5 size-7" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
          {agentName}
        </div>
        <div className={streaming && text.length > 0 ? "streaming-caret" : ""}>
          <Markdown content={text} />
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator({ agentName }: { agentName: string }) {
  return (
    <div className="flex gap-3">
      <NorviMark className="mt-0.5 size-7" pulse />
      <div>
        <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
          {agentName}
        </div>
        <div className="flex items-center gap-1.5 py-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: `${i * 140}ms`, animationDuration: "1s" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
