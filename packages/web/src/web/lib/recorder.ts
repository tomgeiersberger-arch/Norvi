/**
 * Thin MediaRecorder wrapper for NORVI's speech input.
 *
 * The browser only records — the audio is transcribed server-side by the
 * self-hosted Whisper server, so no cloud speech API is involved.
 */

export interface Recording {
  blob: Blob;
  filename: string;
  /** False when the browser saw no meaningful microphone activity. */
  voiceDetected: boolean;
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
export async function startRecording(deviceId?: string): Promise<{
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
    const selectedDevice = deviceId?.trim();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
    });
  } catch (error) {
    throw new Error(micErrorMessage(error));
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  // Lightweight client-side voice activity check. Whisper can hallucinate short
  // words on pure silence, so skip server inference when the microphone never
  // rose meaningfully above its noise floor. If Web Audio is unavailable we
  // deliberately fall back to sending the recording instead of blocking voice.
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let audioContext: AudioContext | null = null;
  let animationFrame = 0;
  let speechFrames = 0;
  try {
    audioContext = new AudioContext();
    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    void audioContext.resume().catch(() => undefined);

    const samples = new Uint8Array(analyser.fftSize);
    const measure = () => {
      if (!analyser) return;
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) {
        const value = (sample - 128) / 128;
        energy += value * value;
      }
      const rms = Math.sqrt(energy / samples.length);
      if (rms >= 0.012) speechFrames += 1;
      animationFrame = requestAnimationFrame(measure);
    };
    measure();
  } catch {
    analyser = null;
    source = null;
    audioContext = null;
  }

  recorder.start(250);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    try {
      source?.disconnect();
    } catch {
      // Stream cleanup below is still enough if the audio graph already closed.
    }
    void audioContext?.close().catch(() => undefined);
    for (const track of stream.getTracks()) track.stop();
  };

  let stopPromise: Promise<Recording> | null = null;

  const stop = (): Promise<Recording> => {
    if (stopPromise) return stopPromise;

    stopPromise = new Promise<Recording>((resolve, reject) => {
      recorder.onerror = () => {
        release();
        reject(new Error("Die Aufnahme wurde vom Browser abgebrochen."));
      };
      recorder.onstop = () => {
        // Roughly 8 active animation frames ~= a short voiced burst. This is
        // intentionally permissive so quiet speech is kept.
        const voiceDetected = analyser === null || speechFrames >= 8;
        release();
        const type = recorder.mimeType || mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        resolve({
          blob: new Blob(chunks, { type: type.split(";")[0] }),
          filename: `aufnahme.${extension}`,
          voiceDetected,
        });
      };
      if (recorder.state === "inactive") recorder.onstop?.(new Event("stop"));
      else recorder.stop();
    });

    return stopPromise;
  };

  return {
    stop,
    cancel: () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } finally {
        release();
      }
    },
  };
}
