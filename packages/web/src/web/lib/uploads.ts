import { getDeviceId } from "./device";

/** One image attached to a message, as returned by `POST /api/upload`. */
export interface UploadedImage {
  url: string;
  mediaType: string;
  /** Local object URL used for the instant preview before the upload finishes. */
  preview?: string;
  name?: string;
}

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/jpg,image/png,image/webp";

async function errorMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `Upload fehlgeschlagen (HTTP ${response.status}).`;
}

/** Uploads one image and returns its stored reference. */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("deviceId", getDeviceId());

  const response = await fetch("/api/upload", { method: "POST", body: form });
  if (!response.ok) throw new Error(await errorMessage(response));

  const data = (await response.json()) as { url: string; mediaType: string };
  return { url: data.url, mediaType: data.mediaType, name: file.name };
}

/** Sends a recording to the server-side Whisper endpoint and returns the text. */
export async function transcribeAudio(
  blob: Blob,
  language: "de" | "en",
  filename = "aufnahme.webm",
): Promise<string> {
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("language", language);
  form.append("deviceId", getDeviceId());

  const response = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Transkription fehlgeschlagen (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as { text: string };
  return data.text;
}
