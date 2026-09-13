import { os } from "@orpc/server";
import { visionAvailable } from "../agent/gateway";
import { requireAuthEnabled } from "../lib/access";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../lib/uploads";
import { sttConfigured } from "../lib/stt";

/**
 * What this NORVI installation can do right now.
 *
 * The clients use it to enable or disable the image and microphone buttons and
 * to show a helpful hint instead of running into a server error.
 */
export const capabilities = {
  get: os.handler(() => ({
    vision: visionAvailable(),
    stt: sttConfigured(),
    /** True, wenn diese Instanz eine Anmeldung erzwingt (REQUIRE_AUTH=true). */
    requireAuth: requireAuthEnabled(),
    imageTypes: [...ALLOWED_IMAGE_TYPES],
    maxImageBytes: MAX_IMAGE_BYTES,
  })),
};
