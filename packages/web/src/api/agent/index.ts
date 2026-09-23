import { stepCountIs, ToolLoopAgent } from "ai";
import dedent from "dedent";
import { defaultModelId, providerKind, resolveModel } from "./gateway";

export const AGENT_NAME = "NORVI";
export const MODEL_LABEL = "NORVI AI";
/** Model actually used when the caller has no personal preference. */
export const MODEL_ID = defaultModelId();

/** Builds an agent for one request — model and generation budget come from settings. */
export function createAgent(options?: {
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  return new ToolLoopAgent({
  model: resolveModel(options?.modelId),
  ...(providerKind() === "openai-compatible" && options?.temperature !== undefined
    ? { temperature: options.temperature }
    : {}),
  ...(options?.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
  instructions: [
    {
      role: "system",
      content: dedent`
        You are ${AGENT_NAME}, a helpful and direct assistant in a minimal chat app.
        Always answer the user's question directly — never refuse a question you can
        answer, and never reply with an empty message. If a question is ambiguous,
        give your best answer and state the assumption you made.
        If you truly cannot know something (live data, private information), say so
        in one sentence and offer the closest useful answer instead.
        Reply in the language the user writes in.
        Be concise by default and expand when the question needs depth.
        Use markdown: short paragraphs, lists where they help, and fenced code blocks
        with a language tag for any code.

        Images: when the user attaches an image, describe only what is actually
        visible in it. Never invent, guess or embellish details that are not there.
        If the image is blurry, cropped, too dark or otherwise unreadable, say that
        plainly instead of speculating, and name what part you cannot make out.
        When asked to read text in an image, reproduce it verbatim, keeping the
        original line structure; mark unreadable characters as [unleserlich].
        If the user asks about something the image does not show, say so directly.
      `,
    },
  ],
  tools: {},
  stopWhen: [stepCountIs(5)],
  });
}

/** Default agent instance (used when no per-user settings apply). */
export const agent = createAgent();

/** Turns provider/gateway failures into a message that is useful in the UI. */
export function describeAgentError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (/insufficient_credits|Insufficient credits/i.test(raw)) {
    return `Das KI-Guthaben des Gateways ist aufgebraucht — ${AGENT_NAME} kann gerade nicht antworten. Guthaben aufladen und erneut senden.`;
  }
  if (/rate.?limit|429/i.test(raw)) {
    return "Zu viele Anfragen in kurzer Zeit. Kurz warten und nochmal senden.";
  }
  if (/401|403|api key|unauthorized/i.test(raw)) {
    return "Der KI-Dienst hat die Anfrage abgelehnt (Zugangsdaten). Bitte AI_API_KEY bzw. AI_GATEWAY_API_KEY in der .env prüfen.";
  }
  if (/timeout|ETIMEDOUT|network|fetch failed/i.test(raw)) {
    return "Der KI-Dienst ist nicht erreichbar. Läuft der Endpoint aus AI_BASE_URL (z. B. Ollama)? Bitte prüfen und erneut senden.";
  }
  return `Antwort fehlgeschlagen: ${raw}`;
}
