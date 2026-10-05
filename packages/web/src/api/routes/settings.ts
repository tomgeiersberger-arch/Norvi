import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withUser } from "../middleware/auth";
import {
  AUTH_REQUIRED_MESSAGE,
  hasAdminAccess,
  requireAuthEnabled,
} from "../lib/access";
import { publicEditionEnabled } from "../lib/privacy";
import { availableModels, defaultModelId, providerKind } from "../agent/gateway";
import { db } from "../database";
import * as schema from "../database/schema";

/** Temperature is stored as an integer percentage (0–100) to stay SQLite-simple. */
const temperature = z.number().int().min(0).max(100);
const performanceMode = z.enum(["serious", "fast", "balanced", "power", "deep"]);
const deviceId = z.string().trim().min(6).max(120);
export type PerformanceMode = z.infer<typeof performanceMode>;

export type UserSettings = {
  modelId: string;
  temperature: number;
  models: string[];
  supportsTemperature: boolean;
  performanceMode: PerformanceMode;
  premiumAccess: boolean;
  chokeModeAccess: boolean;
};

function present(
  row:
    | {
        modelId: string | null;
        temperature: number | null;
        performanceMode: string | null;
      }
    | undefined,
  premiumAccess: boolean,
  chokeModeAccess: boolean,
) {
  const models = availableModels();
  const stored = row?.modelId && models.includes(row.modelId) ? row.modelId : defaultModelId();
  const publicEdition = publicEditionEnabled();
  const effectivePremiumAccess = publicEdition || premiumAccess;
  const effectiveChokeModeAccess = !publicEdition && chokeModeAccess;
  return {
    modelId: stored,
    temperature: row?.temperature ?? 30,
    models,
    // The hosted gateway ignores temperature for reasoning models, so the UI
    // only offers it on the OpenAI-compatible (self-hosted) provider.
    supportsTemperature: providerKind() === "openai-compatible",
    performanceMode:
      performanceMode.safeParse(row?.performanceMode).success &&
      (row!.performanceMode !== "deep" || effectivePremiumAccess) &&
      (row!.performanceMode !== "serious" || effectiveChokeModeAccess)
        ? (row!.performanceMode as PerformanceMode)
        : "balanced",
    premiumAccess: effectivePremiumAccess,
    chokeModeAccess: effectiveChokeModeAccess,
  } satisfies UserSettings;
}

function anonymousOwnerId(rawDeviceId: string | undefined): string | null {
  const clean = (rawDeviceId ?? "").trim();
  if (clean.length < 6 || clean.length > 120) return null;
  return `device:${clean}`;
}

function settingsOwnerId(
  userId: string | undefined,
  rawDeviceId: string | undefined,
): string {
  if (userId) return userId;
  if (requireAuthEnabled()) {
    throw new ORPCError("UNAUTHORIZED", { message: AUTH_REQUIRED_MESSAGE });
  }
  const anonymous = anonymousOwnerId(rawDeviceId);
  if (!anonymous) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Lokale Geräte-ID fehlt. Bitte NORVI neu laden.",
    });
  }
  return anonymous;
}

export const settings = {
  get: withUser
    .input(z.object({ deviceId: deviceId.optional() }))
    .handler(async ({ input, context }) => {
      const ownerId = settingsOwnerId(context.user?.id, input.deviceId);
      const [row] = await db
        .select()
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, ownerId))
        .limit(1);
      return present(
        row,
        context.user?.premiumAccess ?? false,
        context.user
          ? hasAdminAccess(context.user.role) || context.user.chokeModeEnabled
          : false,
      );
    }),

  update: withUser
    .input(
      z.object({
        deviceId: deviceId.optional(),
        modelId: z.string().trim().min(1).max(120).optional(),
        temperature: temperature.optional(),
        performanceMode: performanceMode.optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const ownerId = settingsOwnerId(context.user?.id, input.deviceId);

      if (input.performanceMode === "serious" && publicEditionEnabled()) {
        throw new ORPCError("FORBIDDEN", {
          message: "Choke Mode ist in der öffentlichen NORVI-Version deaktiviert.",
        });
      }
      if (
        input.performanceMode === "deep" &&
        !(context.user?.premiumAccess ?? false) &&
        !publicEditionEnabled()
      ) {
        throw new ORPCError("FORBIDDEN", {
          message: "NORVI Deep ist für Premium-Konten verfügbar.",
        });
      }
      if (
        input.performanceMode === "serious" &&
        (!context.user ||
          (!hasAdminAccess(context.user.role) && !context.user.chokeModeEnabled))
      ) {
        throw new ORPCError("FORBIDDEN", {
          message: "Choke Mode ist für dieses Konto nicht freigeschaltet.",
        });
      }

      const models = availableModels();
      const modelId =
        input.modelId && models.includes(input.modelId) ? input.modelId : undefined;
      const selectedMode = input.performanceMode ?? "balanced";
      const selectedTemperature =
        selectedMode === "serious" || selectedMode === "fast"
          ? 20
          : input.temperature ?? 30;
      const updateTemperature =
        input.performanceMode === "serious" || input.performanceMode === "fast"
          ? 20
          : input.temperature;

      await db
        .insert(schema.userSettings)
        .values({
          userId: ownerId,
          modelId: modelId ?? defaultModelId(),
          temperature: selectedTemperature,
          performanceMode: selectedMode,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.userSettings.userId,
          set: {
            ...(modelId ? { modelId } : {}),
            ...(updateTemperature !== undefined ? { temperature: updateTemperature } : {}),
            ...(input.performanceMode !== undefined
              ? { performanceMode: input.performanceMode }
              : {}),
            updatedAt: new Date(),
          },
        });

      const [row] = await db
        .select()
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, ownerId))
        .limit(1);
      return present(
        row,
        context.user?.premiumAccess ?? false,
        context.user
          ? hasAdminAccess(context.user.role) || context.user.chokeModeEnabled
          : false,
      );
    }),
};

/** Server-side lookup used by the streaming endpoint. */
export async function settingsFor(
  userId: string | undefined,
  rawDeviceId: string | undefined,
  premiumAccess = false,
  chokeModeAccess = false,
) {
  const ownerId = userId ?? (!requireAuthEnabled() ? anonymousOwnerId(rawDeviceId) : null);
  if (!ownerId) return present(undefined, premiumAccess, chokeModeAccess);

  const [row] = await db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, ownerId))
    .limit(1);
  return present(row, premiumAccess, chokeModeAccess);
}
