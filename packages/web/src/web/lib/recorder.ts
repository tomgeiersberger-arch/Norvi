/**
 * Thin MediaRecorder wrapper for NORVI's speech input.
 *
 * The browser only records — the audio is transcribed server-side by the
 * self-hosted Whisper server, so no cloud speech API is involved.
 */

export interface Recording {
  blob: Blob;
  filename: string;
}

/** Picks a container the browser can actually produce (Chrome: webm, Safari: mp4). */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function recordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Turns getUserMedia failures into something a German-speaking user understands. */
function micErrorMessage(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Zugriff auf das Mikrofon wurde verweigert. Bitte in den Browser-Einstellungen für diese Seite erlauben und erneut versuchen.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Es wurde kein Mikrofon gefunden. Bitte ein Mikrofon anschließen und erneut versuchen.";
  }
  if (name === "NotReadableError") {
    return "Das Mikrofon ist gerade von einem anderen Programm belegt.";
  }
  return `Aufnahme nicht möglich: ${error instanceof Error ? error.message : String(error)}`;
}

/** Starts a recording; the returned handle stops it and yields the audio blob. */
export async function startRecording(): Promise<{
  stop: () => Promise<Recording>;
  cancel: () => void;
}> {
  if (!window.isSecureContext) {
    throw new Error(
      "Sprachaufnahme braucht HTTPS. Bitte NORVI über eine sichere HTTPS-Adresse öffnen.",
    );
  }
  if (!recordingSupported()) {
    throw new Error(
      "Dieser Browser unterstützt keine Sprachaufnahme. Bitte Chrome, Edge, Firefox oder Safari in aktueller Version verwenden.",
    );
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    throw new Error(micErrorMessage(error));
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(250);

  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };

  return {
    stop: () =>
      new Promise<Recording>((resolve, reject) => {
        recorder.onerror = () => {
          release();
          reject(new Error("Die Aufnahme wurde vom Browser abgebrochen."));
        };
        recorder.onstop = () => {
          release();
          const type = recorder.mimeType || mimeType || "audio/webm";
          const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          resolve({
            blob: new Blob(chunks, { type: type.split(";")[0] }),
            filename: `aufnahme.${extension}`,
          });
        };
        if (recorder.state === "inactive") recorder.onstop?.(new Event("stop"));
        else recorder.stop();
      }),
    cancel: () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } finally {
        release();
      }
    },
  };
}
