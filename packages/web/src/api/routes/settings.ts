import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authed } from "../middleware/auth";
import { hasAdminAccess } from "../lib/access";
import { availableModels, defaultModelId, providerKind } from "../agent/gateway";
import { db } from "../database";
import * as schema from "../database/schema";

/** Temperature is stored as an integer percentage (0–100) to stay SQLite-simple. */
const temperature = z.number().int().min(0).max(100);
const performanceMode = z.enum(["serious", "fast", "balanced", "power", "deep"]);
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
  return {
    modelId: stored,
    temperature: row?.temperature ?? 30,
    models,
    // The hosted gateway ignores temperature for reasoning models, so the UI
    // only offers it on the OpenAI-compatible (self-hosted) provider.
    supportsTemperature: providerKind() === "openai-compatible",
    performanceMode:
      performanceMode.safeParse(row?.performanceMode).success &&
      (row!.performanceMode !== "deep" || premiumAccess) &&
      (row!.performanceMode !== "serious" || chokeModeAccess)
        ? (row!.performanceMode as PerformanceMode)
        : "balanced",
    premiumAccess,
    chokeModeAccess,
  } satisfies UserSettings;
}

export const settings = {
  get: authed.handler(async ({ context }) => {
    const [row] = await db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, context.user.id))
      .limit(1);
    return present(
      row,
      context.user.premiumAccess,
      hasAdminAccess(context.user.role) || context.user.chokeModeEnabled,
    );
  }),

  update: authed
    .input(
      z.object({
        modelId: z.string().trim().min(1).max(120).optional(),
        temperature: temperature.optional(),
        performanceMode: performanceMode.optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      if (input.performanceMode === "deep" && !context.user.premiumAccess) {
        throw new ORPCError("FORBIDDEN", {
          message: "NORVI Deep ist für Premium-Konten verfügbar.",
        });
      }
      if (
        input.performanceMode === "serious" &&
        !hasAdminAccess(context.user.role) &&
        !context.user.chokeModeEnabled
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
          userId: context.user.id,
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
        .where(eq(schema.userSettings.userId, context.user.id))
        .limit(1);
      return present(
        row,
        context.user.premiumAccess,
        hasAdminAccess(context.user.role) || context.user.chokeModeEnabled,
      );
    }),
};

/** Server-side lookup used by the streaming endpoint. */
export async function settingsFor(
  userId: string | undefined,
  premiumAccess = false,
  chokeModeAccess = false,
) {
  if (!userId) return present(undefined, false, false);
  const [row] = await db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1);
  return present(row, premiumAccess, chokeModeAccess);
}
