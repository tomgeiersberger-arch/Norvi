import { API_BASE_URL } from "./api-base";

/**
 * Image upload and speech-to-text for the NORVI mobile app.
 *
 * Both go through the NORVI server on the home network — the phone never talks
 * to a cloud service directly and holds no API key.
 */

export interface UploadedImage {
  url: string;
  mediaType: string;
}

/** Absolute url for an image reference returned by the server. */
export function imageUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
}

function guessImageType(uri: string, mimeType?: string | null): string {
  if (mimeType?.startsWith("image/")) return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  const ext = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function readError(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `${fallback} (HTTP ${response.status}).`;
}

/** Uploads a picked or captured photo to NORVI and returns its stored reference. */
export async function uploadImage(
  uri: string,
  deviceId: string,
  mimeType?: string | null,
  filename?: string | null,
): Promise<UploadedImage> {
  const mediaType = guessImageType(uri, mimeType);
  const name = filename || `bild.${mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg"}`;

  const form = new FormData();
  // React Native's FormData takes the file descriptor object, not a Blob.
  form.append("file", { uri, name, type: mediaType } as unknown as Blob, name);
  form.append("deviceId", deviceId);

  const response = await fetch(`${API_BASE_URL}/api/upload`, { method: "POST", body: form });
  if (!response.ok) throw new Error(await readError(response, "Upload fehlgeschlagen"));

  const data = (await response.json()) as UploadedImage;
  return data;
}

/** Sends a recording to NORVI's Whisper endpoint and returns the recognised text. */
export async function transcribeAudio(
  uri: string,
  deviceId: string,
  language: "de" | "en" = "de",
): Promise<string> {
  const name = uri.split("/").pop() || "aufnahme.m4a";
  const type = name.endsWith(".wav") ? "audio/wav" : "audio/m4a";

  const form = new FormData();
  form.append("file", { uri, name, type } as unknown as Blob, name);
  form.append("deviceId", deviceId);
  form.append("language", language);

  const response = await fetch(`${API_BASE_URL}/api/transcribe`, { method: "POST", body: form });
  if (!response.ok) throw new Error(await readError(response, "Transkription fehlgeschlagen"));

  const data = (await response.json()) as { text: string };
  return data.text;
}
