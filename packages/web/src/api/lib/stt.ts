/**
 * Speech-to-text for NORVI.
 *
 * NORVI talks to a self-hosted, OpenAI-compatible Whisper server on the home
 * network (e.g. faster-whisper-server, whisper.cpp server, LocalAI). Nothing is
 * sent to a cloud service and no key lives in the frontend: everything is
 * configured through the root .env.
 *
 *   STT_BASE_URL=http://192.168.1.50:8000/v1
 *   STT_MODEL=Systran/faster-whisper-large-v3   # optional
 *   STT_API_KEY=...                             # optional
 */

export type SttLanguage = "de" | "en";

/** True when a Whisper endpoint is configured — the UI hides the mic otherwise. */
export function sttConfigured(): boolean {
  return Boolean(process.env.STT_BASE_URL?.trim());
}

function baseUrl(): string {
  return (process.env.STT_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

function sttModel(): string {
  return (process.env.STT_MODEL ?? "").trim() || "whisper-1";
}

/** Audio formats the recorders produce (browser: webm/mp4, iOS/Android: m4a/wav). */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export class SttError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "SttError";
    this.status = status;
  }
}

/** Lightweight readiness probe used by the capability endpoint. */
export async function sttAvailable(timeoutMs = 1200): Promise<boolean> {
  if (!sttConfigured()) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const key = process.env.STT_API_KEY?.trim();

  try {
    const response = await fetch(`${baseUrl()}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Sends one recording to the Whisper server and returns the recognised text. */
export async function transcribe(input: {
  audio: Blob;
  filename?: string;
  language?: SttLanguage;
}): Promise<string> {
  if (!sttConfigured()) {
    throw new SttError(
      "Spracheingabe ist nicht eingerichtet. Bitte STT_BASE_URL in der .env auf den eigenen Whisper-Server setzen (z. B. http://192.168.1.50:8000/v1).",
      503,
    );
  }
  if (input.audio.size === 0) {
    throw new SttError("Die Aufnahme ist leer. Bitte nochmal sprechen.", 400);
  }
  if (input.audio.size > MAX_AUDIO_BYTES) {
    throw new SttError("Die Aufnahme ist zu lang. Bitte kürzer aufnehmen.", 413);
  }

  const form = new FormData();
  form.append("file", input.audio, input.filename || "aufnahme.webm");
  form.append("model", sttModel());
  form.append("response_format", "json");
  if (input.language) form.append("language", input.language);

  const key = process.env.STT_API_KEY?.trim();

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/audio/transcriptions`, {
      method: "POST",
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      body: form,
    });
  } catch (error) {
    throw new SttError(
      `Whisper-Server unter STT_BASE_URL (${baseUrl()}) ist nicht erreichbar. Läuft der Dienst im Heimnetz? (${
        error instanceof Error ? error.message : String(error)
      })`,
      503,
    );
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    if (response.status === 401 || response.status === 403) {
      throw new SttError(
        "Der Whisper-Server hat die Anfrage abgelehnt. Bitte STT_API_KEY in der .env prüfen.",
        502,
      );
    }
    if (response.status === 413) {
      throw new SttError("Die Aufnahme ist für den Whisper-Server zu groß.", 413);
    }
    if (response.status === 404) {
      throw new SttError(
        `Der Whisper-Server kennt den Endpunkt ${baseUrl()}/audio/transcriptions nicht. Endet STT_BASE_URL auf /v1?`,
        502,
      );
    }
    throw new SttError(
      `Transkription fehlgeschlagen (HTTP ${response.status}). ${detail}`.trim(),
      502,
    );
  }

  const data = (await response.json().catch(() => null)) as { text?: string } | null;
  const text = data?.text?.trim();
  if (!text) {
    throw new SttError("Es wurde kein Text erkannt. Bitte nochmal etwas deutlicher sprechen.", 422);
  }
  return text;
}
