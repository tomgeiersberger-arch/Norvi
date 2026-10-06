/**
 * Speech-to-text for NORVI.
 *
 * NORVI talks to a self-hosted, OpenAI-compatible Whisper server on the home
 * network (e.g. faster-whisper-server, whisper.cpp server, LocalAI). Nothing is
 * sent to a cloud service and no key lives in the frontend: everything is
 * configured through the root .env.
 *
 *   STT_BASE_URL=http://<whisper-host>:8000/v1
 *   STT_MODEL=whisper-1                         # optional
 *   STT_API_KEY=...                             # optional
 */

export type SttLanguage = "de" | "en";

function localSttEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test((process.env.STT_LOCAL_ENABLED ?? "").trim());
}

/** True when a Whisper endpoint is configured or NORVI owns the local sidecar. */
export function sttConfigured(): boolean {
  return Boolean(process.env.STT_BASE_URL?.trim()) || localSttEnabled();
}

function baseUrl(): string {
  const configured = (process.env.STT_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const port = (process.env.STT_LOCAL_PORT ?? "8000").trim() || "8000";
  return `http://127.0.0.1:${port}/v1`;
}

function sttModel(): string {
  return (process.env.STT_MODEL ?? "").trim() || "whisper-1";
}

function transcriptionTimeoutMs(): number {
  const configured = Number(process.env.STT_TIMEOUT_MS ?? 30_000);
  if (!Number.isFinite(configured)) return 30_000;
  return Math.max(5_000, Math.min(120_000, Math.round(configured)));
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

/**
 * Whisper can occasionally get stuck repeating the same short token for a
 * long time (for example "Test Test Test ..."). Keep natural emphasis, but
 * cap clearly runaway consecutive repetitions before the text reaches NORVI.
 */
export function sanitiseTranscription(value: string): string {
  const tokens = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (tokens.length === 0) return "";

  const result: string[] = [];
  let previousKey = "";
  let repeats = 0;

  for (const token of tokens) {
    const key = token
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("de-DE")
      .replace(/[^a-z0-9äöüß]+/gi, "");

    if (key && key === previousKey) {
      repeats += 1;
      if (repeats > 3) continue;
    } else {
      previousKey = key;
      repeats = 1;
    }

    result.push(token);
  }

  return result.join(" ").trim();
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
      "Spracheingabe ist nicht eingerichtet. Bitte STT_BASE_URL in der .env auf den eigenen lokalen Whisper-Server setzen (z. B. http://127.0.0.1:8000/v1).",
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), transcriptionTimeoutMs());

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/audio/transcriptions`, {
      method: "POST",
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "AbortError") {
      throw new SttError(
        "Die Spracherkennung hat zu lange gebraucht und wurde abgebrochen. Bitte nochmal kurz sprechen.",
        504,
      );
    }
    throw new SttError(
      `Whisper-Server unter STT_BASE_URL (${baseUrl()}) ist nicht erreichbar. Läuft der Dienst im Heimnetz? (${
        error instanceof Error ? error.message : String(error)
      })`,
      503,
    );
  } finally {
    clearTimeout(timer);
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
  const text = sanitiseTranscription(data?.text ?? "");
  if (!text) {
    throw new SttError("Es wurde kein Text erkannt. Bitte nochmal etwas deutlicher sprechen.", 422);
  }
  return text;
}
