import { useEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Loader2, Mic, Square, X } from "lucide-react";
import {
  ACCEPTED_IMAGE_TYPES,
  transcribeAudio,
  uploadImage,
  type UploadedImage,
} from "../../lib/uploads";
import { recordingSupported, startRecording } from "../../lib/recorder";

interface ComposerProps {
  agentName: string;
  onSend: (text: string, images: UploadedImage[]) => void;
  onStop: () => void;
  busy: boolean;
  /** Feature flags from the server — hides what this installation cannot do. */
  vision?: boolean;
  stt?: boolean;
}

/** A pending image: shown immediately, replaced by the stored url once uploaded. */
interface Pending {
  key: string;
  preview: string;
  name: string;
  uploaded?: UploadedImage;
  failed?: boolean;
}

type RecordHandle = Awaited<ReturnType<typeof startRecording>>;

function secondsLabel(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Composer({
  agentName,
  onSend,
  onStop,
  busy,
  vision = true,
  stt = false,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<Pending[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);

  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<RecordHandle | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [value]);

  useEffect(() => {
    if (!busy && !recording) ref.current?.focus();
  }, [busy, recording]);

  // Live timer while recording.
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  // Never leave the microphone open when the composer unmounts.
  useEffect(() => () => handleRef.current?.cancel(), []);

  const uploading = images.some((image) => !image.uploaded && !image.failed);
  const ready = images.filter((image) => image.uploaded).map((image) => image.uploaded!);
  const canSend = (value.trim().length > 0 || ready.length > 0) && !uploading && !busy;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setNotice(null);

    const accepted = Array.from(files).slice(0, 4);
    const pending: Pending[] = accepted.map((file) => ({
      key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      preview: URL.createObjectURL(file),
      name: file.name,
    }));
    setImages((current) => [...current, ...pending]);

    await Promise.all(
      pending.map(async (item, index) => {
        try {
          const uploaded = await uploadImage(accepted[index]!);
          setImages((current) =>
            current.map((image) => (image.key === item.key ? { ...image, uploaded } : image)),
          );
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
          setImages((current) => current.filter((image) => image.key !== item.key));
          URL.revokeObjectURL(item.preview);
        }
      }),
    );
  };

  const removeImage = (key: string) => {
    setImages((current) => {
      const hit = current.find((image) => image.key === key);
      if (hit) URL.revokeObjectURL(hit.preview);
      return current.filter((image) => image.key !== key);
    });
  };

  const submit = () => {
    const text = value.trim();
    if (!canSend) return;
    onSend(text, ready);
    setValue("");
    for (const image of images) URL.revokeObjectURL(image.preview);
    setImages([]);
    setNotice(null);
  };

  const toggleRecording = async () => {
    setNotice(null);

    if (recording) {
      const handle = handleRef.current;
      handleRef.current = null;
      setRecording(false);
      if (!handle) return;
      setTranscribing(true);
      try {
        const { blob, filename } = await handle.stop();
        // German first — Whisper handles English input fine with a German hint,
        // and this is a German-language installation.
        const text = await transcribeAudio(blob, "de", filename);
        // Recognised text lands in the input field so it can be edited first.
        setValue((current) => (current ? `${current.trimEnd()} ${text}` : text));
        ref.current?.focus();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Transkription fehlgeschlagen.");
      } finally {
        setTranscribing(false);
        setSeconds(0);
      }
      return;
    }

    try {
      handleRef.current = await startRecording();
      setSeconds(0);
      setRecording(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Aufnahme nicht möglich.");
    }
  };

  const micDisabled = transcribing || busy;

  return (
    <div className="rounded-[1.5rem] border border-border bg-card/80 p-2 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.03] backdrop-blur-2xl transition duration-300 focus-within:border-primary/45 focus-within:shadow-[0_28px_80px_-28px_rgba(217,119,87,0.35)]">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1.5 pt-1.5 pb-1">
          {images.map((image) => (
            <div
              key={image.key}
              className="rise group relative size-16 overflow-hidden rounded-xl border border-border/80 bg-secondary"
            >
              <img src={image.preview} alt={image.name} className="size-full object-cover" />
              {!image.uploaded && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(image.key)}
                aria-label={`Bild ${image.name} entfernen`}
                className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/85 text-foreground/80 opacity-0 transition group-hover:opacity-100 hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {recording && (
        <div className="mx-1.5 mt-1.5 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[0.8rem] text-primary">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          Aufnahme läuft … {secondsLabel(seconds)}
          <span className="ml-auto text-primary/70">Mikrofon-Symbol drücken zum Beenden</span>
        </div>
      )}

      {transcribing && (
        <div className="mx-1.5 mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-[0.8rem] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Aufnahme wird in Text umgewandelt …
        </div>
      )}

      {notice && (
        <div className="mx-1.5 mt-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[0.8rem] text-destructive">
          {notice}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          aria-label="Bild auswählen"
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {vision && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Bild anhängen"
            title="Bild anhängen (JPG, PNG, WebP)"
            className="mb-0.5 flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40"
          >
            <ImagePlus className="size-4.5" />
          </button>
        )}

        {stt && recordingSupported() && (
          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={micDisabled}
            aria-label={recording ? "Aufnahme beenden" : "Spracheingabe starten"}
            title={recording ? "Aufnahme beenden" : "Spracheingabe starten"}
            className={`mb-0.5 flex size-9 items-center justify-center rounded-full transition disabled:opacity-40 ${
              recording
                ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {transcribing ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : (
              <Mic className="size-4.5" />
            )}
          </button>
        )}

        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={(e) => {
            if (!vision) return;
            const files = Array.from(e.clipboardData.files).filter((f) =>
              f.type.startsWith("image/"),
            );
            if (files.length === 0) return;
            e.preventDefault();
            const list = new DataTransfer();
            for (const file of files) list.items.add(file);
            void addFiles(list.files);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={recording ? "Sprich einfach …" : "Nachricht schreiben…"}
          aria-label={`Nachricht an ${agentName}`}
          className="max-h-52 flex-1 resize-none bg-transparent px-2 py-2.5 text-[0.97rem] leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Antwort stoppen"
            className="mb-0.5 flex size-9 items-center justify-center rounded-full bg-secondary text-foreground transition hover:bg-accent"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Senden"
            className="mb-0.5 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-10px_rgba(217,119,87,0.9)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4.5" />
            )}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 px-2.5 pt-1 pb-1 text-[11px] text-muted-foreground/70">
        <span>
          <kbd className="font-sans">Enter</kbd> senden ·{" "}
          <kbd className="font-sans">Shift + Enter</kbd> neue Zeile
        </span>
        {vision && <span className="hidden sm:inline">· Bilder: JPG, PNG, WebP</span>}
      </div>
    </div>
  );
}
