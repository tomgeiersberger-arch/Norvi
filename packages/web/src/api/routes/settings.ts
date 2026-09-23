import { eq } from "drizzle-orm";
import { z } from "zod";
import { authed } from "../middleware/auth";
import { availableModels, defaultModelId, providerKind } from "../agent/gateway";
import { db } from "../database";
import * as schema from "../database/schema";

/** Temperature is stored as an integer percentage (0–100) to stay SQLite-simple. */
const temperature = z.number().int().min(0).max(100);
const performanceMode = z.enum(["fast", "balanced", "deep"]);
export type PerformanceMode = z.infer<typeof performanceMode>;

export type UserSettings = {
  modelId: string;
  temperature: number;
  models: string[];
  supportsTemperature: boolean;
  performanceMode: PerformanceMode;
};

function present(
  row:
    | {
        modelId: string | null;
        temperature: number | null;
        performanceMode: string | null;
      }
    | undefined,
) {
  const models = availableModels();
  const stored = row?.modelId && models.includes(row.modelId) ? row.modelId : defaultModelId();
  return {
    modelId: stored,
    temperature: row?.temperature ?? 70,
    models,
    // The hosted gateway ignores temperature for reasoning models, so the UI
    // only offers it on the OpenAI-compatible (self-hosted) provider.
    supportsTemperature: providerKind() === "openai-compatible",
    performanceMode: performanceMode.safeParse(row?.performanceMode).success
      ? (row!.performanceMode as PerformanceMode)
      : "balanced",
  } satisfies UserSettings;
}

export const settings = {
  get: authed.handler(async ({ context }) => {
    const [row] = await db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, context.user.id))
      .limit(1);
    return present(row);
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
      const models = availableModels();
      const modelId =
        input.modelId && models.includes(input.modelId) ? input.modelId : undefined;

      await db
        .insert(schema.userSettings)
        .values({
          userId: context.user.id,
          modelId: modelId ?? defaultModelId(),
          temperature: input.temperature ?? 70,
          performanceMode: input.performanceMode ?? "balanced",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.userSettings.userId,
          set: {
            ...(modelId ? { modelId } : {}),
            ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
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
      return present(row);
    }),
};

/** Server-side lookup used by the streaming endpoint. */
export async function settingsFor(userId: string | undefined) {
  if (!userId) return present(undefined);
  const [row] = await db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1);
  return present(row);
}
