import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Chat history. Chats are scoped to a device id generated on the client
 * (no login), so every device only ever sees its own conversations.
 */
export const chats = sqliteTable(
  "chats",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id").notNull(),
    userId: text("user_id"),
    title: text("title").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("chats_device_updated_idx").on(table.deviceId, table.updatedAt),
    index("chats_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** JSON array of image references: [{ url, mediaType }] — null for plain text turns. */
    attachments: text("attachments"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("chat_messages_chat_created_idx").on(table.chatId, table.createdAt)],
);

/** Per-user preferences (model + answer style). One row per account. */
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id").primaryKey(),
  modelId: text("model_id"),
  temperature: integer("temperature"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export * from "./auth-schema";
