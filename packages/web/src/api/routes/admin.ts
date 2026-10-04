import { ORPCError } from "@orpc/server";
import { freemem, loadavg, totalmem, uptime } from "node:os";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { adminOnly, ownerOnly } from "../middleware/auth";
import { defaultModelId, providerKind, visionAvailable } from "../agent/gateway";
import { db } from "../database";
import { sttAvailable } from "../lib/stt";
import { aiMetricsSnapshot } from "../lib/ai-metrics";
import { allowAdditionalSignups, setRuntimeSignupEnabled } from "../lib/access";
import * as schema from "../database/schema";

const userId = z.string().min(1).max(120);
const assignableRole = z.enum(["admin", "user"]);

async function targetAccount(id: string) {
  const [target] = await db
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1);
  if (!target) throw new ORPCError("NOT_FOUND", { message: "Konto nicht gefunden." });
  return target;
}

function assertCanManage(actorRole: string, targetRole: string) {
  if (targetRole === "owner") {
    throw new ORPCError("FORBIDDEN", { message: "Der Owner kann nicht verwaltet werden." });
  }
  if (actorRole === "admin" && targetRole !== "user") {
    throw new ORPCError("FORBIDDEN", {
      message: "Admins dürfen nur normale Benutzer verwalten.",
    });
  }
}

/** Administration for the self-hosted NORVI AI instance. */
export const admin = {
  /** Owner/Admin: all accounts with their real chat/message counts. */
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
        chokeModeEnabled: schema.user.chokeModeEnabled,
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

  /** Owner only: promote a user to Admin or demote an Admin to User. */
  setRole: ownerOnly
    .input(z.object({ id: userId, role: assignableRole }))
    .handler(async ({ input }) => {
      const target = await targetAccount(input.id);
      if (target.role === "owner") {
        throw new ORPCError("FORBIDDEN", { message: "Die Owner-Rolle kann nicht geändert werden." });
      }
      const [updated] = await db
        .update(schema.user)
        .set({ role: input.role })
        .where(eq(schema.user.id, input.id))
        .returning({ id: schema.user.id, role: schema.user.role });
      return updated;
    }),

  /** Owner/Admin: enable or disable accounts inside their permission level. */
  setActive: adminOnly
    .input(z.object({ id: userId, isActive: z.boolean() }))
    .handler(async ({ input, context }) => {
      const target = await targetAccount(input.id);
      assertCanManage(context.user.role, target.role);
      if (input.id === context.user.id && !input.isActive) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Das eigene Konto kann nicht deaktiviert werden.",
        });
      }
      const [updated] = await db
        .update(schema.user)
        .set({ isActive: input.isActive })
        .where(eq(schema.user.id, input.id))
        .returning({ id: schema.user.id, isActive: schema.user.isActive });
      return updated;
    }),

  /** Owner/Admin: grant or revoke Premium for manageable users. */
  setPremium: adminOnly
    .input(
      z.object({
        id: userId,
        isPremium: z.boolean(),
        premiumUntil: z.string().trim().min(4).max(40).nullable().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const target = await targetAccount(input.id);
      assertCanManage(context.user.role, target.role);
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
      return updated;
    }),

  /** Owner/Admin: grant or revoke Choke Mode for manageable normal users. */
  setChokeMode: adminOnly
    .input(z.object({ id: userId, enabled: z.boolean() }))
    .handler(async ({ input, context }) => {
      const target = await targetAccount(input.id);
      assertCanManage(context.user.role, target.role);
      const [updated] = await db
        .update(schema.user)
        .set({ chokeModeEnabled: input.enabled })
        .where(eq(schema.user.id, input.id))
        .returning({
          id: schema.user.id,
          chokeModeEnabled: schema.user.chokeModeEnabled,
        });
      return updated;
    }),

  /** Owner/Admin: temporarily open/close registration until restart. */
  setRegistration: adminOnly
    .input(z.object({ enabled: z.boolean() }))
    .handler(({ input }) => ({
      enabled: setRuntimeSignupEnabled(input.enabled),
    })),

  /** Owner/Admin: safe runtime diagnostics — no credentials or tokens. */
  system: adminOnly.handler(async () => {
    const total = totalmem();
    const free = freemem();
    return {
      provider: providerKind(),
      model: defaultModelId(),
      fastModel: process.env.AI_FAST_MODEL?.trim() || defaultModelId(),
      chokeModel: process.env.AI_ULTRA_SERIOUS_MODEL?.trim() || null,
      powerModel: process.env.AI_POWER_MODEL?.trim() || null,
      deepModel: process.env.AI_DEEP_MODEL?.trim() || null,
      visionFastModel: process.env.AI_VISION_FAST_MODEL?.trim() || null,
      visionModel: process.env.AI_VISION_MODEL?.trim() || null,
      vision: visionAvailable(),
      stt: await sttAvailable(1_500),
      registrationOpen: allowAdditionalSignups(),
      ai: aiMetricsSnapshot(),
      uptimeSeconds: Math.floor(uptime()),
      memoryUsedBytes: Math.max(0, total - free),
      memoryTotalBytes: total,
      load1: loadavg()[0] ?? 0,
    };
  }),

  /** Owner/Admin: real usage numbers straight from the database. */
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
