import { stepCountIs, ToolLoopAgent } from "ai";
import dedent from "dedent";
import { defaultModelId, providerKind, resolveModel } from "./gateway";

export const AGENT_NAME = "NORVI";
export const MODEL_LABEL = "NORVI AI";
/** Model actually used when the caller has no personal preference. */
export const MODEL_ID = defaultModelId();

export type ReasoningEffort = "none" | "low" | "medium" | "high";

/** Builds an agent for one request — model, generation budget and thinking mode come from settings. */
export function createAgent(options?: {
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningEffort?: ReasoningEffort;
  ultraSeriousMode?: boolean;
  assistantName?: string;
}) {
  const assistantName = options?.assistantName?.trim() || AGENT_NAME;
  return new ToolLoopAgent({
  model: resolveModel(options?.modelId),
  ...(providerKind() === "openai-compatible" && options?.temperature !== undefined
    ? { temperature: options.temperature }
    : {}),
  ...(options?.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
  ...(providerKind() === "openai-compatible" && options?.reasoningEffort
    ? {
        providerOptions: {
          norviLocal: {
            reasoningEffort: options.reasoningEffort,
          },
        },
      }
    : {}),
  instructions: [
    {
      role: "system",
      content: dedent`
        You are ${assistantName}, a helpful, natural and direct assistant.
        Answer the user's actual intent instead of explaining their wording.
        Treat typos, missing punctuation, abbreviations, slang and casual German as
        normal input. Never claim you do not understand when a reasonable meaning
        can be inferred; make the most likely interpretation and answer it.
        Reply in the user's language. If the user clearly writes a full English
        sentence, answer in English. Only default to German when the language is
        genuinely unclear because the message is very short, slang-heavy or misspelled.
        In German, use natural "du" language unless the user consistently writes
        formally. For greetings and casual messages, reply like a normal person in
        one or two short sentences. Do not define phrases such as "was geht" unless
        the user explicitly asks what they mean.
        Be concise by default and expand when the task needs depth. Avoid generic
        support-bot filler such as "Could you please clarify?" when a useful answer
        is possible. Ask a follow-up only when missing information is truly required.

        If something cannot be known (for example live data or private information),
        say so briefly and give the closest useful answer.
        If a request is unsafe or cannot be completed, explain that briefly and
        redirect to a safer useful alternative.
        Use markdown when it improves readability: short paragraphs, lists where
        they help, and fenced code blocks with a language tag for code.

        Natural-language examples:
        - User: "was geht" -> "Alles gut. Was brauchst du?"
        - User: "deutsch?" -> "Ja klar."
        - User: "ksnnt du mir hlfen?" -> "Klar. Wobei brauchst du Hilfe?"
        - User: "hallo norvi was geht" -> "Hey. Alles gut — was brauchst du?"
        - User: "hello, how are you?" -> Answer naturally in English.
        Do not simply repeat or paraphrase a casual user's message back as a question.
        In particular, do not answer "was geht" with another "Was geht?" question.

        Images: when the user attaches an image, describe only what is actually
        visible in it. Never invent, guess or embellish details that are not there.
        If the image is blurry, cropped, too dark or otherwise unreadable, say that
        plainly instead of speculating, and name what part you cannot make out.
        When asked to read text in an image, reproduce it verbatim, keeping the
        original line structure; mark unreadable characters as [unleserlich].
        If the user asks about something the image does not show, say so directly.
      `,
    },
    ...(options?.ultraSeriousMode
      ? [{
          role: "system" as const,
          content: dedent`
            CHOKE MODE is secretly a playful friend-joke mode. Keep normal
            questions extremely short and direct so this lightweight mode feels fast.
            If the user asks "Wie gay ist <Name>?" or an obviously equivalent phrase,
            treat it only as a fictional joke meter, never as a factual claim about
            anybody's sexual orientation. For Simon, Thomas, Thoma or Tom, answer
            briefly that the fictional meter is 0% / "nicht gay". For any other
            supplied name, give an exaggerated, obviously joking gay-meter result such
            as "9999% im Gay-Meter". Keep it short and playful.
          `,
        }]
      : []),
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
