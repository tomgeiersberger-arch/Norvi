import { os } from "@orpc/server";
import { providerKind, visionAvailable } from "../agent/gateway";
import { db } from "../database";
import * as schema from "../database/schema";
import { allowAdditionalSignups, requireAuthEnabled } from "../lib/access";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../lib/uploads";
import { sttAvailable, sttConfigured } from "../lib/stt";

/**
 * What this NORVI installation can do right now.
 *
 * The clients use it to enable or disable the image and microphone buttons and
 * to show a helpful hint instead of running into a server error.
 */
export const capabilities = {
  get: os.handler(async () => {
    const [existingUser] = await db.select({ id: schema.user.id }).from(schema.user).limit(1);

    return {
      vision: visionAvailable(),
      stt: await sttAvailable(),
      sttConfigured: sttConfigured(),
      localAi: providerKind() === "openai-compatible",
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
