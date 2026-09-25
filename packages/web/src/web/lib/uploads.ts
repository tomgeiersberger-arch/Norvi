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

/**
 * Shrinks very large phone photos before upload. The vision model does its own
 * resizing anyway, so capping the longest side saves bandwidth and CPU without
 * touching normal screenshots or already-small images.
 */
async function prepareImage(file: File): Promise<File> {
  // Tiny screenshots are already cheap to send and often contain text that
  // benefits from keeping the original pixels. Larger photos get capped more
  // aggressively because local vision inference is CPU-bound.
  if (file.size < 300_000 || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const maxSide = file.type === "image/png" ? 1200 : 768;
    if (longest <= maxSide) {
      bitmap.close();
      return file;
    }

    const scale = maxSide / longest;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const type = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
    return blob && blob.size < file.size ? new File([blob], file.name, { type }) : file;
  } catch {
    return file;
  }
}

/** Uploads one image and returns its stored reference. */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const prepared = await prepareImage(file);
  const form = new FormData();
  form.append("file", prepared, prepared.name);
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
