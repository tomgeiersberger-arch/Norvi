import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  MonitorUp,
  Settings2,
  Sparkles,
  Square,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import {
  ACCEPTED_IMAGE_TYPES,
  transcribeAudio,
  uploadImage,
  type UploadedImage,
} from "../../lib/uploads";
import { startRecording } from "../../lib/recorder";
import {
  formatTextAttachments,
  isSupportedTextAttachment,
  TEXT_ATTACHMENT_ACCEPT,
} from "../../lib/text-attachments";
import { getNorviDesktopAPI, isDesktop, type DesktopExternalFile } from "../../lib/desktop";
import {
  getAssistantSettings,
  OPEN_SETTINGS_EVENT,
  saveAssistantSettings,
  subscribeAssistantSettings,
} from "../../lib/desktop-assistant";

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
  const [dragging, setDragging] = useState(false);
  const [assistantSettings, setAssistantSettings] = useState(getAssistantSettings);

  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<RecordHandle | null>(null);
  const toggleRecordingRef = useRef<() => void>(() => undefined);

  useEffect(() => subscribeAssistantSettings(setAssistantSettings), []);

  useEffect(() => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    return api.onFocusCommandInput(() => {
      ref.current?.focus();
      ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [value]);

  useEffect(() => {
    if (!busy && !recording) ref.current?.focus();
  }, [busy, recording]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const addFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    setNotice(null);

    const slots = Math.max(0, 4 - images.length);
    const accepted = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, slots);

    if (accepted.length === 0) {
      setNotice(slots === 0 ? "Maximal 4 Bilder pro Nachricht." : "Bitte nur Bilddateien ablegen.");
      return;
    }
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
  }, [images.length]);

  useEffect(() => {
    const api = getNorviDesktopAPI();
    if (!api) return;

    const removeFileListener = api.onExternalFile((file: DesktopExternalFile) => {
      if (file.kind === "text") {
        const formatted = formatTextAttachments([{ name: file.name, text: file.text }]);
        if (!formatted.text) return;
        setValue((current) =>
          current.trim() ? current.trimEnd() + "\n\n" + formatted.text : formatted.text,
        );
        setNotice("Datei über Windows-Rechtsklick lokal eingefügt.");
        ref.current?.focus();
        return;
      }

      void (async () => {
        try {
          const response = await fetch(file.dataUrl);
          const blob = await response.blob();
          const image = new File([blob], file.name, { type: file.mediaType });
          await addFiles([image]);
          setNotice("Bild über Windows-Rechtsklick angehängt.");
        } catch {
          setNotice("Die Rechtsklick-Datei konnte nicht geöffnet werden.");
        }
      })();
    });

    const removeErrorListener = api.onExternalFileError((message) => {
      setNotice(message || "Die Rechtsklick-Datei konnte nicht geöffnet werden.");
    });

    return () => {
      removeFileListener();
      removeErrorListener();
    };
  }, [addFiles]);

  const addTextFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    setNotice(null);

    const accepted = Array.from(files)
      .filter((file) => isSupportedTextAttachment(file.name, file.type))
      .slice(0, 3);
    if (accepted.length === 0) {
      setNotice("Unterstützt werden normale Text- und Code-Dateien.");
      return;
    }

    try {
      const inputs = await Promise.all(
        accepted.map(async (file) => ({
          name: file.name,
          text: await file.text(),
        })),
      );
      const formatted = formatTextAttachments(inputs);
      if (!formatted.text) {
        setNotice("In der Datei wurde kein lesbarer Text gefunden.");
        return;
      }
      setValue((current) =>
        current.trim()
          ? current.trimEnd() + "\n\n" + formatted.text
          : formatted.text,
      );
      setNotice(
        formatted.count +
          " Text/Code-Datei(en) lokal eingefügt." +
          (formatted.truncated ? " Lange Inhalte wurden gekürzt." : ""),
      );
      ref.current?.focus();
    } catch {
      setNotice("Die Datei konnte nicht als Text gelesen werden.");
    }
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
        const { blob, filename, voiceDetected } = await handle.stop();
        if (!voiceDetected) {
          setNotice("Keine Sprache erkannt. Bitte nochmal sprechen.");
          return;
        }
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

  toggleRecordingRef.current = () => {
    void toggleRecording();
  };

  const captureScreen = async (prompt?: string) => {
    if (!vision || !assistantSettings.screenCaptureEnabled) return;
    const api = getNorviDesktopAPI();
    if (!api) return;

    setNotice(null);
    try {
      const screenshot = await api.capturePrimaryScreen();
      const response = await fetch(screenshot.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], screenshot.name, { type: "image/png" });
      await addFiles([file]);
      if (prompt) setValue((current) => (current.trim() ? current : prompt));
      setNotice("Screenshot angehängt. Schreib jetzt, was NORVI darauf prüfen soll.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Screenshot konnte nicht erstellt werden.");
    }
  };

  useEffect(() => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    return api.onVoiceShortcut(() => {
      if (!stt || !assistantSettings.microphoneEnabled || busy || transcribing) return;
      toggleRecordingRef.current();
    });
  }, [assistantSettings.microphoneEnabled, busy, recording, stt, transcribing]);

  const micAllowed = !isDesktop() || assistantSettings.microphoneEnabled;
  const micDisabled = transcribing || busy || !micAllowed;

  return (
    <div
      className={`composer-shell relative rounded-[1.6rem] p-2.5 sm:p-3 transition duration-250 ${
        dragging ? "border-primary/60 bg-primary/[0.055]" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const dropped = Array.from(event.dataTransfer.files);
        const imageFiles = vision ? dropped.filter((file) => file.type.startsWith("image/")) : [];
        const textFiles = dropped.filter((file) =>
          isSupportedTextAttachment(file.name, file.type),
        );
        if (imageFiles.length) void addFiles(imageFiles);
        if (textFiles.length) void addTextFiles(textFiles);
        if (!imageFiles.length && !textFiles.length) {
          setNotice("Diese Datei wird noch nicht unterstützt.");
        }
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-[1.25rem] border border-dashed border-primary/50 bg-background/92 text-sm font-medium text-primary backdrop-blur-xl">
          <FileText className="mr-2 size-4.5" />
          Bild oder Text/Code hier ablegen
        </div>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1.5 pt-1.5 pb-1">
          {images.map((image) => (
            <div
              key={image.key}
              className="rise group relative size-16 overflow-hidden rounded-[1rem] border border-white/[0.08] bg-secondary shadow-[0_14px_36px_-24px_rgba(0,0,0,1)]"
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
                className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground/85 opacity-90 transition sm:opacity-0 sm:group-hover:opacity-100 hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {recording && (
        <div className="mx-1 mt-1 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.07] px-3.5 py-2.5 text-[0.8rem] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          <div className="flex h-4 items-center gap-[3px]" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-[2px] animate-pulse rounded-full bg-primary"
                style={{ height: `${6 + ((i * 5) % 10)}px`, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
          <span className="font-medium">Aufnahme · {secondsLabel(seconds)}</span>
          <span className="ml-auto hidden text-primary/65 sm:inline">Mic drücken zum Beenden</span>
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

      {vision && isDesktop() && assistantSettings.screenCaptureEnabled && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
          <span className="mr-1 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/55">
            Quick Actions
          </span>
          <button
            type="button"
            disabled={busy || uploading}
            onClick={() =>
              void captureScreen(
                "Erkläre mir kurz und verständlich, was auf diesem Screenshot zu sehen ist.",
              )
            }
            className="icon-action flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] text-muted-foreground disabled:opacity-40"
          >
            <Sparkles className="size-3.5" />
            Screen erklären
          </button>
          <button
            type="button"
            disabled={busy || uploading}
            onClick={() =>
              void captureScreen(
                "Analysiere den sichtbaren Fehler auf diesem Screenshot und sag mir kurz, wie ich ihn behebe.",
              )
            }
            className="icon-action flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] text-muted-foreground disabled:opacity-40"
          >
            <TriangleAlert className="size-3.5" />
            Fehler prüfen
          </button>
          <button
            type="button"
            onClick={() => {
              const next = saveAssistantSettings({
                ...assistantSettings,
                responsePreset:
                  assistantSettings.responsePreset === "short" ? "normal" : "short",
              });
              setAssistantSettings(next);
            }}
            className={
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] transition " +
              (assistantSettings.responsePreset === "short"
                ? "border-primary/35 bg-primary/[0.10] text-primary"
                : "icon-action border-transparent text-muted-foreground")
            }
          >
            <Zap className="size-3.5" />
            Kurzmodus
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
            className="icon-action flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] text-muted-foreground"
          >
            <Settings2 className="size-3.5" />
            Einstellungen
          </button>
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

        <input
          ref={documentRef}
          type="file"
          accept={TEXT_ATTACHMENT_ACCEPT}
          multiple
          aria-label="Text- oder Code-Datei auswählen"
          className="hidden"
          onChange={(event) => {
            void addTextFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => documentRef.current?.click()}
          disabled={busy}
          aria-label="Text- oder Code-Datei anhängen"
          title="Text- oder Code-Datei lokal einfügen"
          className="icon-action mb-0.5 flex h-10 min-w-10 items-center justify-center gap-2 rounded-[1rem] px-0 text-muted-foreground transition duration-200 disabled:opacity-40 sm:px-3"
        >
          <FileText className="size-4.5 shrink-0" />
          <span className="hidden text-[11px] font-medium sm:inline">Datei</span>
        </button>

        {vision && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Bild anhängen"
            title="Bild anhängen (JPG, PNG, WebP)"
            className="icon-action mb-0.5 flex h-10 min-w-10 items-center justify-center gap-2 rounded-[1rem] px-0 text-muted-foreground transition duration-200 disabled:opacity-40 sm:px-3"
          >
            <ImagePlus className="size-4.5 shrink-0" />
            <span className="hidden text-[11px] font-medium sm:inline">Bild</span>
          </button>
        )}

        {vision && isDesktop() && assistantSettings.screenCaptureEnabled && (
          <button
            type="button"
            onClick={() => void captureScreen()}
            disabled={busy || uploading}
            aria-label="Bildschirm aufnehmen"
            title="Aktuellen Bildschirm als Bild an NORVI anhängen"
            className="icon-action mb-0.5 flex h-10 min-w-10 items-center justify-center gap-2 rounded-[1rem] px-0 text-muted-foreground transition duration-200 disabled:opacity-40 sm:px-3"
          >
            <MonitorUp className="size-4.5 shrink-0" />
            <span className="hidden text-[11px] font-medium sm:inline">Screen</span>
          </button>
        )}

        {stt && micAllowed && (
          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={micDisabled}
            aria-label={recording ? "Aufnahme beenden" : "Spracheingabe starten"}
            title={recording ? "Aufnahme beenden" : "Spracheingabe starten"}
            className={`mb-0.5 flex h-10 min-w-10 items-center justify-center gap-2 rounded-[1rem] border px-0 transition duration-200 disabled:opacity-40 sm:px-3 ${
              recording
                ? "border-primary/35 bg-primary/15 text-primary"
                : "icon-action text-muted-foreground "
            }`}
          >
            {transcribing ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : (
              <Mic className="size-4.5 shrink-0" />
            )}
            <span className="hidden text-[11px] font-medium sm:inline">
              {recording ? "Stopp" : transcribing ? "Text…" : "Sprache"}
            </span>
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
            void addFiles(files);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={recording ? "Sprich einfach …" : "Nachricht schreiben…"}
          aria-label={`Nachricht an ${agentName}`}
          className="composer-scrollbar min-h-10 max-h-52 flex-1 resize-none overflow-y-auto bg-transparent px-3.5 py-2.5 text-[0.98rem] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/42"
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Antwort stoppen"
            className="icon-action mb-0.5 flex size-10 items-center justify-center rounded-[1rem] text-foreground transition hover:bg-white/[0.08]"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Senden"
            className="send-glow mb-0.5 mr-0.5 flex size-11 items-center justify-center rounded-[1.05rem] text-[#35140d] transition duration-200 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-5 text-[#35140d]" strokeWidth={2.9} />
            )}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 px-2.5 pb-0.5 pt-1.5 text-[9.5px] text-muted-foreground/34">
        <span>Enter = senden · Umschalt + Enter = neue Zeile</span>
        <span className="hidden sm:inline">· Bilder und Text/Code kannst du hineinziehen</span>
      </div>
    </div>
  );
}