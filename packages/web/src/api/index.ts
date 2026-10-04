import type { RouterClient } from "@orpc/server";
import {
  convertToModelMessages,
  createAgentUIStreamResponse,
  UI_MESSAGE_STREAM_HEADERS,
  type UIMessage,
} from "ai";
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
import { AUTH_REQUIRED_MESSAGE, denyAnonymous, hasAdminAccess, hasPremiumAccess } from "./lib/access";
import { rateLimit } from "./lib/rate-limit";
import { recordAiRequest } from "./lib/ai-metrics";
import { assertLocalOnlyConfiguration } from "./lib/privacy";
import { refreshLocalModelKeepAlive, warmLocalAi } from "./lib/local-ai";
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

assertLocalOnlyConfiguration();

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

/**
 * Tiny local shortcut for very common casual turns.
 *
 * The 2B chat model is intentionally small and fast, but it can overthink short
 * slang such as "was geht". Handling only a few exact casual intents here makes
 * those replies instant without changing normal questions or model routing.
 */
function quickCasualReply(message: UIMessage | undefined): string | null {
  const normalised = textOf(message)
    .toLocaleLowerCase("de-DE")
    .replace(/[!?.,:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    /^(?:(?:hallo|hey|servus)\s+)?(?:norvi\s+)?was ?geht(?:\s+norvi)?$/.test(normalised) ||
    normalised === "wsg"
  ) {
    return "Hey, alles gut. Was brauchst du?";
  }

  if (/^deutsch(?: bitte)?$/.test(normalised)) {
    return "Ja klar. Schreib einfach auf Deutsch.";
  }

  return null;
}

/** Deterministic Choke Mode joke shortcut so the tiny model cannot reuse an old name. */
function ultraSeriousJokeReply(message: UIMessage | undefined): string | null {
  const normalised = textOf(message)
    .toLocaleLowerCase("de-DE")
    .replace(/[!?.,:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^was\s+kommt\s+nach\s+win$/.test(normalised)) {
    return "Bro";
  }

  let name: string | undefined;
  const direct = normalised.match(/^(?:ist|st)\s+([a-zäöüß0-9'-]+)\s+gay$/i);
  const inverse = normalised.match(/^wie\s+gay\s+(?:ist|st)\s+([a-zäöüß0-9'-]+)$/i);
  name = direct?.[1] ?? inverse?.[1];
  if (!name) return null;

  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  if (["simon", "thomas", "thoma", "tom"].includes(name)) {
    return displayName + ": 0% im Gay-Meter.";
  }
  return displayName + ": 9999% im Gay-Meter.";
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
 * Lightweight vision is ideal for ordinary scene understanding, but OCR,
 * counting and tiny details need the stronger local vision model. Power/Deep
 * intentionally keep maximum visual accuracy too.
 */
function preciseVisionRequest(
  message: UIMessage | undefined,
  mode: PerformanceMode,
): boolean {
  if (mode === "power" || mode === "deep") return true;

  const query = textOf(message)
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, " ")
    .trim();
  if (!query) return false;

  return /(was steht|was heißt|was heisst|lies|lesen|vorlesen|text|schrift|buchstab|wort|satz|zahl|nummer|ziffer|kennzeichen|serien(?:nummer)?|modellnummer|barcode|qr(?:-?code)?|wie viele|anzahl|zähl|zaehl|genau|exakt|detail|kleine? schrift|read|text|word|number|digit|license plate|serial|barcode|qr(?: code)?|how many|count|exact|detail|small text)/i.test(
    query,
  );
}

function routedVisionModel(
  message: UIMessage | undefined,
  mode: PerformanceMode,
  currentModelId: string,
): string {
  if (!preciseVisionRequest(message, mode)) {
    const fast = process.env.AI_VISION_FAST_MODEL?.trim();
    if (fast) return fast;
  }
  return visionModelId(currentModelId);
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

/**
 * Keep image bytes only on the latest user turn.
 *
 * Re-sending old images on every follow-up made every later text message route
 * back through the much slower vision model. The assistant answer from the
 * image turn stays in history, so normal follow-ups keep useful context without
 * re-encoding the same pixels again.
 */
function stripHistoricalFiles(messages: UIMessage[], latestUser: UIMessage | undefined): UIMessage[] {
  return messages.map((message) =>
    message === latestUser
      ? message
      : { ...message, parts: message.parts.filter((part) => part.type !== "file") },
  ) as UIMessage[];
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
  if (mode === "serious") {
    return {
      modelId:
        process.env.AI_ULTRA_SERIOUS_MODEL?.trim() ||
        process.env.AI_FAST_MODEL?.trim() ||
        process.env.AI_MODEL?.trim() ||
        selectedModel,
      maxOutputTokens: positiveInt(process.env.AI_ULTRA_SERIOUS_MAX_TOKENS, 160),
      reasoningEffort: "none",
    };
  }
  if (mode === "fast") {
    return {
      modelId: process.env.AI_FAST_MODEL?.trim() || process.env.AI_MODEL?.trim() || selectedModel,
      maxOutputTokens: positiveInt(process.env.AI_FAST_MAX_TOKENS, 256),
      reasoningEffort: "none",
    };
  }
  if (mode === "power") {
    return {
      modelId: process.env.AI_POWER_MODEL?.trim() || process.env.AI_DEEP_MODEL?.trim() || selectedModel,
      maxOutputTokens: positiveInt(process.env.AI_POWER_MAX_TOKENS, 768),
      reasoningEffort: "none",
    };
  }
  if (mode === "deep") {
    return {
      modelId: process.env.AI_DEEP_MODEL?.trim() || selectedModel,
      maxOutputTokens: positiveInt(process.env.AI_DEEP_MAX_TOKENS, 1024),
      // Deep mode deliberately spends more time on separate model reasoning.
      // Ollama returns this as reasoning content and the user sees only the
      // final answer. Choke Mode, fast, balanced and power stay non-thinking for lower latency.
      reasoningEffort: "high",
    };
  }
  return {
    modelId: process.env.AI_MODEL?.trim() || selectedModel,
    maxOutputTokens: positiveInt(process.env.AI_BALANCED_MAX_TOKENS, 512),
    // The CPU-only homeserver is much faster with Qwen thinking disabled.
    // Deep mode remains available when the user explicitly wants reasoning.
    reasoningEffort: "none",
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
    const assistantName =
      typeof body?.assistantName === "string"
        ? body.assistantName.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40)
        : "";

    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "Keine Nachricht erhalten." }, 400);
    }
    if (messages.length > 200) {
      return c.json({ error: "Zu viele Nachrichten in einer Anfrage." }, 400);
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const user = session?.user as
      | {
          id: string;
          role?: string;
          isActive?: boolean;
          isPremium?: boolean;
          premiumUntil?: Date | string | number | null;
          chokeModeEnabled?: boolean;
        }
      | undefined;
    if (user && user.isActive === false) {
      return c.json({ error: "Dieses Konto ist deaktiviert." }, 403);
    }
    if (denyAnonymous(user)) return c.json({ error: AUTH_REQUIRED_MESSAGE }, 401);

    const premiumAccess = hasPremiumAccess(user);

    // Premium (and owner/admin) gets a larger burst allowance while the
    // standard tier remains conservative for the small CPU-only homeserver.
    const limitKey = user ? `user:${user.id}` : deviceId ? `device:${deviceId}` : "anon";
    const limit = rateLimit(limitKey, premiumAccess ? 60 : 30, 10 * 60 * 1000);
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
    const prefs = await settingsFor(
      user?.id,
      premiumAccess,
      hasAdminAccess(user?.role) || user?.chokeModeEnabled === true,
    );

    // Route by the latest user turn, not the whole chat history. Otherwise one
    // old photo would force every later text message through the slow vision model.
    const profile = performanceProfile(prefs.performanceMode, prefs.modelId);
    const rawMessages = messages as UIMessage[];
    const latestUser = [...rawMessages].reverse().find((message) => message.role === "user");
    const hasImages = imagesOf(latestUser).length > 0;
    const modelId = hasImages
      ? routedVisionModel(latestUser, prefs.performanceMode, profile.modelId)
      : profile.modelId;
    const historyForModel = stripHistoricalFiles(rawMessages, latestUser);
    const uiMessages = hasImages
      ? await withInlineImages(historyForModel, c.req.url)
      : historyForModel;
    const visionMaxTokens = positiveInt(process.env.AI_VISION_MAX_TOKENS, 192);
    const requestStartedAt = Date.now();
    let metricRecorded = false;
    const finishMetric = (ok: boolean) => {
      if (metricRecorded) return;
      metricRecorded = true;
      recordAiRequest(hasImages ? "vision" : "text", Date.now() - requestStartedAt, ok);
      if (ok) refreshLocalModelKeepAlive(modelId);
    };

    const speedOptimizedMode =
      prefs.performanceMode === "serious" || prefs.performanceMode === "fast";
    const generationTemperature = prefs.supportsTemperature
      ? hasImages
        ? 0
        : speedOptimizedMode
          ? 0.2
          : prefs.temperature / 100
      : undefined;

    const activeAgent = createAgent({
      modelId,
      temperature: generationTemperature,
      maxOutputTokens: hasImages
        ? Math.min(profile.maxOutputTokens, visionMaxTokens)
        : profile.maxOutputTokens,
      // The direct 2B model disables hidden Qwen thinking in its template.
      // Keep the provider hint too for models/endpoints that support it natively.
      reasoningEffort: hasImages ? "none" : profile.reasoningEffort,
      ultraSeriousMode: !hasImages && prefs.performanceMode === "serious",
      assistantName: assistantName || undefined,
    });

    const persistAssistant = async (messageId: string, answer: string) => {
      if (!storedChatId || !answer) return;
      try {
        await db
          .insert(schema.chatMessages)
          .values({
            id: rowId(storedChatId, messageId),
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
        console.error("[agent] persisting answer failed:", error);
      }
    };

    const quickReply = hasImages
      ? null
      : prefs.performanceMode === "serious"
        ? ultraSeriousJokeReply(latestUser) ?? quickCasualReply(latestUser)
        : quickCasualReply(latestUser);
    if (quickReply) {
      const responseId = crypto.randomUUID();
      const textId = `txt-${responseId}`;
      await persistAssistant(responseId, quickReply);

      const chunks = [
        { type: "start", messageId: responseId },
        { type: "start-step" },
        { type: "text-start", id: textId },
        { type: "text-delta", id: textId, delta: quickReply },
        { type: "text-end", id: textId },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ];
      const body =
        chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
        "data: [DONE]\n\n";

      return new Response(body, {
        status: 200,
        headers: UI_MESSAGE_STREAM_HEADERS,
      });
    }

    // Cloudflare Quick Tunnels have intermittently cut NORVI's long-lived SSE
    // connection with "unexpected EOF". The web client opts into this buffered
    // path: generation finishes locally first, then a tiny complete AI-SDK event
    // stream is returned as one normal HTTP response.
    if (c.req.header("x-norvi-buffered") === "1") {
      const modelMessages = await convertToModelMessages(uiMessages);
      const result = await activeAgent.generate({ messages: modelMessages }).catch((error) => {
        finishMetric(false);
        throw error;
      });
      const answer = result.text.trim();

      if (!answer) {
        finishMetric(false);
        return c.json({ error: "NORVI hat keine Textantwort erzeugt. Bitte erneut senden." }, 502);
      }
      finishMetric(true);

      const responseId = crypto.randomUUID();
      const textId = `txt-${responseId}`;
      await persistAssistant(responseId, answer);

      const chunks = [
        { type: "start", messageId: responseId },
        { type: "start-step" },
        { type: "text-start", id: textId },
        { type: "text-delta", id: textId, delta: answer },
        { type: "text-end", id: textId },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ];
      const body =
        chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
        "data: [DONE]\n\n";

      return new Response(body, {
        status: 200,
        headers: UI_MESSAGE_STREAM_HEADERS,
      });
    }

    return await createAgentUIStreamResponse({
      agent: activeAgent,
      uiMessages,
      // Errors mid-stream reach the client as readable text instead of a silent stop.
      onError: (error) => {
        finishMetric(false);
        return describeAgentError(error);
      },
      onFinish: async ({ responseMessage, isAborted }) => {
        // Do not launch a competing warm-up directly after vision. On the
        // 16-GB homeserver both small models can remain resident, and an
        // immediate warm-up can steal CPU from the user's next text request.
        const answer = textOf(responseMessage as UIMessage);
        finishMetric(!isAborted && Boolean(answer));
        await persistAssistant(responseMessage.id, answer);
        if (isAborted) console.warn("[agent] stream aborted before completion");
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
