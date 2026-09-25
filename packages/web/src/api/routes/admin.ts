import { ORPCError } from "@orpc/server";
import { freemem, loadavg, totalmem, uptime } from "node:os";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { adminOnly } from "../middleware/auth";
import { defaultModelId, providerKind, visionAvailable } from "../agent/gateway";
import { db } from "../database";
import { sttAvailable } from "../lib/stt";
import * as schema from "../database/schema";

const userId = z.string().min(1).max(120);

/** Owner-only administration for the self-hosted NORVI AI instance. */
export const admin = {
  /** All accounts with their real chat/message counts. */
  users: adminOnly.handler(async () => {
    const rows = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.user.role,
        isActive: schema.user.isActive,
        isPremium: schema.user.isPremium,
        premiumUntil: schema.user.premiumUntil,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .orderBy(desc(schema.user.createdAt));

    const chatCounts = await db
      .select({ userId: schema.chats.userId, chats: count() })
      .from(schema.chats)
      .groupBy(schema.chats.userId);

    const byUser = new Map(chatCounts.map((row) => [row.userId ?? "", row.chats]));
    return rows.map((row) => ({ ...row, chats: byUser.get(row.id) ?? 0 }));
  }),

  /** Enable or disable an account. The last admin can never lock themselves out. */
  setActive: adminOnly
    .input(z.object({ id: userId, isActive: z.boolean() }))
    .handler(async ({ input, context }) => {
      if (input.id === context.user.id && !input.isActive) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Das eigene Admin-Konto kann nicht deaktiviert werden.",
        });
      }
      const [updated] = await db
        .update(schema.user)
        .set({ isActive: input.isActive })
        .where(eq(schema.user.id, input.id))
        .returning({ id: schema.user.id, isActive: schema.user.isActive });
      if (!updated) throw new ORPCError("NOT_FOUND", { message: "Konto nicht gefunden." });
      return updated;
    }),

  /** Manually grant or revoke premium, optionally with an expiry date. */
  setPremium: adminOnly
    .input(
      z.object({
        id: userId,
        isPremium: z.boolean(),
        // ISO date string (yyyy-mm-dd) or null for "unlimited".
        premiumUntil: z.string().trim().min(4).max(40).nullable().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const until =
        input.isPremium && input.premiumUntil ? new Date(input.premiumUntil) : null;
      if (until && Number.isNaN(until.getTime())) {
        throw new ORPCError("BAD_REQUEST", { message: "Ungültiges Datum." });
      }
      const [updated] = await db
        .update(schema.user)
        .set({ isPremium: input.isPremium, premiumUntil: until })
        .where(eq(schema.user.id, input.id))
        .returning({
          id: schema.user.id,
          isPremium: schema.user.isPremium,
          premiumUntil: schema.user.premiumUntil,
        });
      if (!updated) throw new ORPCError("NOT_FOUND", { message: "Konto nicht gefunden." });
      return updated;
    }),

  /** Safe runtime diagnostics for the owner UI — no credentials or tokens. */
  system: adminOnly.handler(async () => {
    const total = totalmem();
    const free = freemem();
    return {
      provider: providerKind(),
      model: defaultModelId(),
      fastModel: process.env.AI_FAST_MODEL?.trim() || defaultModelId(),
      deepModel: process.env.AI_DEEP_MODEL?.trim() || null,
      visionModel: process.env.AI_VISION_MODEL?.trim() || null,
      vision: visionAvailable(),
      stt: await sttAvailable(1_500),
      uptimeSeconds: Math.floor(uptime()),
      memoryUsedBytes: Math.max(0, total - free),
      memoryTotalBytes: total,
      load1: loadavg()[0] ?? 0,
    };
  }),

  /** Real usage numbers straight from the database — no estimates. */
  stats: adminOnly.handler(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [users] = await db.select({ value: count() }).from(schema.user);
    const [active] = await db
      .select({ value: count() })
      .from(schema.user)
      .where(eq(schema.user.isActive, true));
    const [premium] = await db
      .select({ value: count() })
      .from(schema.user)
      .where(eq(schema.user.isPremium, true));
    const [chats] = await db.select({ value: count() }).from(schema.chats);
    const [messages] = await db.select({ value: count() }).from(schema.chatMessages);
    const [messages7d] = await db
      .select({ value: count() })
      .from(schema.chatMessages)
      .where(gte(schema.chatMessages.createdAt, sevenDaysAgo));
    const [activeUsers7d] = await db
      .select({ value: sql<number>`count(distinct ${schema.chats.userId})` })
      .from(schema.chats)
      .where(gte(schema.chats.updatedAt, sevenDaysAgo));

    return {
      users: users?.value ?? 0,
      activeUsers: active?.value ?? 0,
      premiumUsers: premium?.value ?? 0,
      chats: chats?.value ?? 0,
      messages: messages?.value ?? 0,
      messages7d: messages7d?.value ?? 0,
      activeUsers7d: Number(activeUsers7d?.value ?? 0),
    };
  }),
};
