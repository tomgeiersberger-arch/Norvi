import { os } from "@orpc/server";
import { providerKind, visionAvailable } from "../agent/gateway";
import { db } from "../database";
import * as schema from "../database/schema";
import { allowAdditionalSignups, requireAuthEnabled } from "../lib/access";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../lib/uploads";
import { sttAvailable, sttConfigured } from "../lib/stt";
import { localOnlyModeEnabled, publicEditionEnabled } from "../lib/privacy";

let aiHealthCache: { at: number; online: boolean } | null = null;

/** Probe the configured OpenAI-compatible provider without exposing its URL/key. */
async function aiProviderAvailable(timeoutMs = 1500): Promise<boolean> {
  if (providerKind() !== "openai-compatible") return true;
  if (aiHealthCache && Date.now() - aiHealthCache.at < 5_000) return aiHealthCache.online;

  const base = (process.env.AI_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const key = process.env.AI_API_KEY?.trim();

  try {
    const response = await fetch(`${base}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      signal: controller.signal,
    });
    const online = response.ok;
    aiHealthCache = { at: Date.now(), online };
    return online;
  } catch {
    aiHealthCache = { at: Date.now(), online: false };
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What this NORVI installation can do right now.
 *
 * The clients use it to enable or disable the image and microphone buttons and
 * to show a helpful hint instead of running into a server error.
 */
export const capabilities = {
  get: os.handler(async () => {
    const [users, stt, aiOnline] = await Promise.all([
      db.select({ id: schema.user.id }).from(schema.user).limit(1),
      sttAvailable(),
      aiProviderAvailable(),
    ]);
    const [existingUser] = users;

    return {
      vision: visionAvailable(),
      stt,
      sttConfigured: sttConfigured(),
      localAi: providerKind() === "openai-compatible",
      localOnly: localOnlyModeEnabled(),
      publicEdition: publicEditionEnabled(),
      aiOnline,
      /** True, wenn diese Instanz eine Anmeldung erzwingt (REQUIRE_AUTH=true). */
      requireAuth: requireAuthEnabled(),
      /** First account can bootstrap the server; further signups are opt-in. */
      registrationOpen: !existingUser || allowAdditionalSignups(),
      // Expose only the public browser URL, never any secret or tunnel token.
      publicUrl: /^https:\/\//i.test(process.env.WEBSITE_URL ?? "")
        ? process.env.WEBSITE_URL
        : null,
      imageTypes: [...ALLOWED_IMAGE_TYPES],
      maxImageBytes: MAX_IMAGE_BYTES,
    };
  }),
};
