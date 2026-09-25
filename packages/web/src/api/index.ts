import type { RouterClient } from "@orpc/server";
import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { and, eq, isNull } from "drizzle-orm";
import { createApp } from "./__core/app";
import {
  createAgent,
  AGENT_NAME,
  describeAgentError,
  MODEL_LABEL,
  type ReasoningEffort,
} from "./agent";
import { visionModelId } from "./agent/gateway";
import { db } from "./database";
import * as schema from "./database/schema";
import { auth, trustedOrigins } from "./auth";
import { AUTH_REQUIRED_MESSAGE, denyAnonymous } from "./lib/access";
import { rateLimit } from "./lib/rate-limit";
import { warmLocalAi } from "./lib/local-ai";
import { startLocalStt } from "./lib/local-stt";
import { SttError, transcribe } from "./lib/stt";
import {
  absoluteFileUrl,
  imageAsDataUrl,
  MAX_IMAGE_BYTES,
  normaliseImageType,
  readImage,
  storeImage,
} from "./lib/uploads";
import { admin } from "./routes/admin";
import { capabilities } from "./routes/capabilities";
import { chats, NEW_CHAT_TITLE } from "./routes/chats";
import { ping } from "./routes/ping";
import { model } from "./routes/model";
import { me } from "./routes/me";
import { settings, settingsFor, type PerformanceMode } from "./routes/settings";

// API features are oRPC procedures, one file per feature in ./routes/,
// composed into this router — typed end-to-end via the clients
// (web: src/web/lib/api.ts, mobile: lib/api.ts).
export const router = {
  ping,
  model,
  me,
  chats,
  settings,
  admin,
  capabilities,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);

// Browser writes must come from an explicitly trusted NORVI origin. Requests
// without Origin stay allowed for the native/mobile client and local CLI tools.
const browserOrigins = new Set(trustedOrigins().map((origin) => origin.replace(/\/$/, "")));
app.use("/api/*", async (c, next) => {
  const origin = c.req.header("origin")?.replace(/\/$/, "");
  if (origin && !browserOrigins.has(origin)) {
    return c.json({ error: "Nicht erlaubter Browser-Ursprung." }, 403);
  }
  await next();
});

// In self-hosted mode NORVI can own its local Whisper sidecar. Starting here
// keeps the template-managed __server.ts untouched.
startLocalStt();
warmLocalAi();

// Better Auth (E-Mail/Passwort) — mounted as a plain route.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

/** Flattens a UI message's text parts into the plain text we persist. */
function textOf(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("")
    .trim();
}

/**
 * Row id for a persisted turn. Client message ids are only unique inside one
 * conversation, so they get scoped to the chat before they become a primary key.
 */
function rowId(chatId: string, messageId: string | undefined): string {
  return messageId ? `${chatId}:${messageId}` : `${chatId}:${crypto.randomUUID()}`;
}

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 60) return clean || NEW_CHAT_TITLE;
  return `${clean.slice(0, 57)}…`;
}

/** One image attached to a chat message. */
interface ImageRef {
  url: string;
  mediaType: string;
}

/** Image parts of a UI message (the AI SDK models attachments as `file` parts). */
function imagesOf(message: UIMessage | undefined): ImageRef[] {
  if (!message) return [];
  return message.parts
    .filter(
      (part): part is { type: "file"; url: string; mediaType: string } =>
        part.type === "file" &&
        typeof (part as { url?: unknown }).url === "string" &&
        typeof (part as { mediaType?: unknown }).mediaType === "string" &&
        (part as { mediaType: string }).mediaType.startsWith("image/"),
    )
    .map((part) => ({ url: part.url, mediaType: part.mediaType }));
}

/**
 * Replaces `/api/files/...` references with inline `data:` URLs.
 *
 * The model gets the real image bytes. A link would not work here: this server
 * usually runs at home behind a router and is not reachable from a hosted model
 * provider. Only files we cannot read fall back to an absolute URL.
 */
async function withInlineImages(messages: UIMessage[], requestUrl: string): Promise<UIMessage[]> {
  return (await Promise.all(
    messages.map(async (message) => ({
      ...message,
      parts: await Promise.all(
        message.parts.map(async (part) => {
          if (part.type !== "file") return part;
          const url = (part as { url?: unknown }).url;
          if (typeof url !== "string") return part;
          const inlined = await imageAsDataUrl(url);
          return { ...part, url: inlined ?? absoluteFileUrl(url, requestUrl) };
        }),
      ),
    })),
  )) as UIMessage[];
}

/** Rate-limit helper shared by the upload and transcription endpoints. */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function performanceProfile(
  mode: PerformanceMode,
  selectedModel: string,
): { modelId: string; maxOutputTokens: number; reasoningEffort: ReasoningEffort } {
  if (mode === "fast") {
    return {
      modelId: process.env.AI_FAST_MODEL?.trim() || selectedModel,
      maxOutputTokens: positiveInt(process.env.AI_FAST_MAX_TOKENS, 256),
      reasoningEffort: "none",
    };
  }
  if (mode === "deep") {
    return {
      modelId: process.env.AI_DEEP_MODEL?.trim() || selectedModel,
      maxOutputTokens: positiveInt(process.env.AI_DEEP_MAX_TOKENS, 1024),
      reasoningEffort: "high",
    };
  }
  return {
    modelId: selectedModel,
    maxOutputTokens: positiveInt(process.env.AI_BALANCED_MAX_TOKENS, 512),
    reasoningEffort: "low",
  };
}

function limitKeyFor(
  user: { id: string } | undefined,
  deviceId: string | undefined | null,
): string {
  return user ? `user:${user.id}` : deviceId ? `device:${deviceId}` : "anon";
}

/** Image upload — plain HTTP because it is multipart, not JSON-RPC. */
app.post("/api/upload", async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const user = session?.user as { id: string; isActive?: boolean } | undefined;
    if (user && user.isActive === false) {
      return c.json({ error: "Dieses Konto ist deaktiviert." }, 403);
    }
    if (denyAnonymous(user)) return c.json({ error: AUTH_REQUIRED_MESSAGE }, 401);

    const form = await c.req.formData();
    const file = form.get("file");
    const deviceId = form.get("deviceId");

    const limit = rateLimit(
      `upload:${limitKeyFor(user, typeof deviceId === "string" ? deviceId : null)}`,
      60,
      10 * 60 * 1000,
    );
    if (!limit.allowed) {
      return c.json({ error: "Zu viele Uploads in kurzer Zeit. Bitte kurz warten." }, 429);
    }

    if (!(file instanceof File)) {
      return c.json({ error: "Es wurde keine Bilddatei übertragen." }, 400);
    }
    if (file.size === 0) {
      return c.json({ error: "Die Bilddatei ist leer." }, 400);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return c.json(
        {
          error: `Das Bild ist zu groß (max. ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB).`,
        },
        413,
      );
    }

    const mediaType = normaliseImageType(file.type, file.name);
    if (!mediaType) {
      return c.json({ error: "Nur JPG, JPEG, PNG oder WebP werden unterstützt." }, 415);
    }

    const stored = await storeImage(new Uint8Array(await file.arrayBuffer()), mediaType);
    return c.json({ url: stored.url, mediaType: stored.mediaType, bytes: stored.bytes }, 201);
  } catch (error) {
    console.error("[upload] failed:", error);
    return c.json({ error: "Das Bild konnte nicht gespeichert werden." }, 500);
  }
});

/**
 * Serves a stored image. Access is guarded by the unguessable 128-bit id so that
 * both `<img>` in the browser and `<Image>` in React Native can load it without
 * attaching credentials.
 */
app.get("/api/files/:id", async (c) => {
  const image = await readImage(c.req.param("id"));
  if (!image) return c.json({ error: "Bild nicht gefunden." }, 404);
  return new Response(image.data as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": image.mediaType,
      "Content-Length": String(image.data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

/** Speech-to-text — multipart audio in, recognised text out. */
app.post("/api/transcribe", async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const user = session?.user as { id: string; isActive?: boolean } | undefined;
    if (user && user.isActive === false) {
      return c.json({ error: "Dieses Konto ist deaktiviert." }, 403);
    }
    if (denyAnonymous(user)) return c.json({ error: AUTH_REQUIRED_MESSAGE }, 401);

    const form = await c.req.formData();
    const file = form.get("file");
    const deviceId = form.get("deviceId");
    const rawLanguage = form.get("language");
    const language =
      rawLanguage === "de" || rawLanguage === "en" ? (rawLanguage as "de" | "en") : undefined;

    const limit = rateLimit(
      `stt:${limitKeyFor(user, typeof deviceId === "string" ? deviceId : null)}`,
      60,
      10 * 60 * 1000,
    );
    if (!limit.allowed) {
      return c.json({ error: "Zu viele Aufnahmen in kurzer Zeit. Bitte kurz warten." }, 429);
    }

    if (!(file instanceof File)) {
      return c.json({ error: "Es wurde keine Aufnahme übertragen." }, 400);
    }

    const text = await transcribe({ audio: file, filename: file.name, language });
    return c.json({ text }, 200);
  } catch (error) {
    if (error instanceof SttError) {
      return c.json({ error: error.message }, error.status as 400);
    }
    console.error("[transcribe] failed:", error);
    return c.json({ error: "Die Aufnahme konnte nicht transkribiert werden." }, 500);
  }
});

/** Streaming chat endpoint — plain HTTP because responses are streamed, not oRPC. */
app.post("/api/agent/messages", async (c) => {
  try {
    const body = await c.req.json();
    const messages = body?.messages;
    const chatId: string | undefined = body?.chatId;
    const deviceId: string | undefined = body?.deviceId;

    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "Keine Nachricht erhalten." }, 400);
    }
    if (messages.length > 200) {
      return c.json({ error: "Zu viele Nachrichten in einer Anfrage." }, 400);
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const user = session?.user as
      | { id: string; isActive?: boolean; isPremium?: boolean }
      | undefined;
    if (user && user.isActive === false) {
      return c.json({ error: "Dieses Konto ist deaktiviert." }, 403);
    }
    if (denyAnonymous(user)) return c.json({ error: AUTH_REQUIRED_MESSAGE }, 401);

    // Rate-limit guard rail per account (or per device for the login-less client).
    const limitKey = user ? `user:${user.id}` : deviceId ? `device:${deviceId}` : "anon";
    const limit = rateLimit(limitKey, 30, 10 * 60 * 1000);
    if (!limit.allowed) {
      return c.json(
        {
          error: `Zu viele Nachrichten in kurzer Zeit. Bitte in ${Math.ceil(
            limit.retryAfterSeconds / 60,
          )} Minute(n) erneut versuchen.`,
        },
        429,
      );
    }

    // Persist the incoming user turn (best effort — chat is optional for one-off calls).
    let storedChatId: string | null = null;
    if (chatId && (user || deviceId)) {
      const owner = user
        ? eq(schema.chats.userId, user.id)
        : and(eq(schema.chats.deviceId, deviceId!), isNull(schema.chats.userId));
      const [chat] = await db
        .select()
        .from(schema.chats)
        .where(and(eq(schema.chats.id, chatId), owner))
        .limit(1);

      // Never touch a chat that belongs to somebody else.
      if (!chat) return c.json({ error: "Chat nicht gefunden." }, 404);

      {
        storedChatId = chat.id;
        const lastUser = [...messages].reverse().find((m) => m?.role === "user") as
          | UIMessage
          | undefined;
        const userText = textOf(lastUser);
        const userImages = imagesOf(lastUser);

        if (lastUser && (userText || userImages.length > 0)) {
          await db
            .insert(schema.chatMessages)
            .values({
              id: rowId(chat.id, lastUser.id),
              chatId: chat.id,
              role: "user",
              content: userText,
              attachments: userImages.length ? JSON.stringify(userImages) : null,
            })
            .onConflictDoNothing();

          const title = userText || `${userImages.length} Bild(er)`;
          await db
            .update(schema.chats)
            .set({
              updatedAt: new Date(),
              title: chat.title === NEW_CHAT_TITLE ? titleFrom(title) : chat.title,
            })
            .where(eq(schema.chats.id, chat.id));
        }
      }
    }

    // Per-account model / answer style, falling back to the server default.
    const prefs = await settingsFor(user?.id);

    // Route normal text through the selected performance profile. Vision always
    // wins when an image is present so a text-only fast/deep model never guesses.
    const profile = performanceProfile(prefs.performanceMode, prefs.modelId);
    const hasImages = (messages as UIMessage[]).some((message) => imagesOf(message).length > 0);
    const modelId = hasImages ? visionModelId(profile.modelId) : profile.modelId;
    const uiMessages = hasImages
      ? await withInlineImages(messages as UIMessage[], c.req.url)
      : (messages as UIMessage[]);

    return await createAgentUIStreamResponse({
      agent: createAgent({
        modelId,
        temperature: prefs.supportsTemperature ? prefs.temperature / 100 : undefined,
        maxOutputTokens: profile.maxOutputTokens,
        // Keep vision requests provider-neutral; not every vision model supports reasoning controls.
        reasoningEffort: hasImages ? undefined : profile.reasoningEffort,
      }),
      uiMessages,
      // Errors mid-stream reach the client as readable text instead of a silent stop.
      onError: (error) => describeAgentError(error),
      onFinish: async ({ responseMessage, isAborted }) => {
        const answer = textOf(responseMessage as UIMessage);
        if (!storedChatId || !answer) return;
        try {
          await db
            .insert(schema.chatMessages)
            .values({
              id: rowId(storedChatId, responseMessage.id),
              chatId: storedChatId,
              role: "assistant",
              content: answer,
            })
            .onConflictDoNothing();
          await db
            .update(schema.chats)
            .set({ updatedAt: new Date() })
            .where(eq(schema.chats.id, storedChatId));
        } catch (error) {
          console.error("[agent] persisting answer failed:", error, { isAborted });
        }
      },
    });
  } catch (error) {
    // Failures before the stream starts (e.g. gateway rejects the request).
    console.error("[agent] request failed:", error);
    return c.json({ error: describeAgentError(error) }, 502);
  }
});

export { AGENT_NAME, MODEL_LABEL };

export default app;
