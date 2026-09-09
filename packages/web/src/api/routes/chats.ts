import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { withUser } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";

const deviceId = z.string().min(6).max(120);
const chatId = z.string().min(6).max(120);

export const NEW_CHAT_TITLE = "Neuer Chat";

/**
 * A chat belongs either to a signed-in user (web) or, for the login-less
 * mobile client, to a device id. Signed-in requests always win.
 */
export function ownerFilter(userId: string | null, device: string | undefined) {
  if (userId) return eq(schema.chats.userId, userId);
  if (device) return and(eq(schema.chats.deviceId, device), isNull(schema.chats.userId));
  throw new ORPCError("UNAUTHORIZED", { message: "Bitte anmelden." });
}

/** Ensures the chat exists and belongs to this caller before touching it. */
export async function requireChat(
  id: string,
  userId: string | null,
  device: string | undefined,
) {
  const [chat] = await db
    .select()
    .from(schema.chats)
    .where(and(eq(schema.chats.id, id), ownerFilter(userId, device)))
    .limit(1);
  if (!chat) throw new ORPCError("NOT_FOUND", { message: "Chat nicht gefunden." });
  return chat;
}

export const chats = {
  /** All chats of the caller, newest activity first. */
  list: withUser
    .input(z.object({ deviceId: deviceId.optional() }))
    .handler(({ input, context }) =>
      db
        .select({
          id: schema.chats.id,
          title: schema.chats.title,
          createdAt: schema.chats.createdAt,
          updatedAt: schema.chats.updatedAt,
        })
        .from(schema.chats)
        .where(ownerFilter(context.user?.id ?? null, input.deviceId))
        .orderBy(desc(schema.chats.updatedAt)),
    ),

  create: withUser
    .input(
      z.object({
        deviceId: deviceId.optional(),
        title: z.string().trim().max(120).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.user?.id ?? null;
      if (!userId && !input.deviceId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Bitte anmelden." });
      }
      const [chat] = await db
        .insert(schema.chats)
        .values({
          id: crypto.randomUUID(),
          deviceId: input.deviceId ?? `user:${userId}`,
          userId,
          title: input.title?.length ? input.title : NEW_CHAT_TITLE,
        })
        .returning();
      return chat!;
    }),

  rename: withUser
    .input(
      z.object({
        deviceId: deviceId.optional(),
        id: chatId,
        title: z.string().trim().min(1).max(120),
      }),
    )
    .handler(async ({ input, context }) => {
      await requireChat(input.id, context.user?.id ?? null, input.deviceId);
      const [chat] = await db
        .update(schema.chats)
        .set({ title: input.title })
        .where(eq(schema.chats.id, input.id))
        .returning();
      return chat!;
    }),

  remove: withUser
    .input(z.object({ deviceId: deviceId.optional(), id: chatId }))
    .handler(async ({ input, context }) => {
      await requireChat(input.id, context.user?.id ?? null, input.deviceId);
      await db.delete(schema.chatMessages).where(eq(schema.chatMessages.chatId, input.id));
      await db.delete(schema.chats).where(eq(schema.chats.id, input.id));
      return { id: input.id };
    }),

  /** Stored messages of one chat, oldest first. */
  messages: withUser
    .input(z.object({ deviceId: deviceId.optional(), id: chatId }))
    .handler(async ({ input, context }) => {
      await requireChat(input.id, context.user?.id ?? null, input.deviceId);
      return db
        .select({
          id: schema.chatMessages.id,
          role: schema.chatMessages.role,
          content: schema.chatMessages.content,
          attachments: schema.chatMessages.attachments,
          createdAt: schema.chatMessages.createdAt,
        })
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.chatId, input.id))
        .orderBy(asc(schema.chatMessages.createdAt));
    }),
};
