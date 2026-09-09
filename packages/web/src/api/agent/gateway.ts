import { createGateway, type LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * NORVI AI model provider.
 *
 * Two deployment modes, selected purely through environment variables so no
 * credential ever lives in the source:
 *
 *  - `AI_PROVIDER=gateway` (default) — the hosted Runable AI gateway.
 *  - `AI_PROVIDER=openai-compatible` — any OpenAI-compatible endpoint on the
 *    local network (Ollama, LM Studio, llama.cpp, vLLM, LiteLLM …).
 */
export type ProviderKind = "gateway" | "openai-compatible";

export function providerKind(): ProviderKind {
  const raw = (process.env.AI_PROVIDER ?? "gateway").trim().toLowerCase();
  return raw === "openai-compatible" || raw === "ollama" ? "openai-compatible" : "gateway";
}

/** Models the user may pick from, resolved from the active provider. */
export function availableModels(): string[] {
  if (providerKind() === "openai-compatible") {
    const list = (process.env.AI_MODELS ?? "")
      .split(",")
      .map((m: string) => m.trim())
      .filter(Boolean);
    const fallback = (process.env.AI_MODEL ?? "").trim();
    const models = list.length ? list : fallback ? [fallback] : [];
    return models.length ? models : ["llama3.1"];
  }
  return [
    "anthropic/claude-sonnet-4.6",
    "anthropic/claude-haiku-4.5",
    "anthropic/claude-opus-4.6",
    "openai/gpt-5.4",
    "openai/gpt-5.4-mini",
    "google/gemini-3-flash",
  ];
}

/** Default model id — env override first, otherwise the first available one. */
export function defaultModelId(): string {
  const configured = (process.env.AI_MODEL ?? "").trim();
  const models = availableModels();
  if (configured && models.includes(configured)) return configured;
  if (configured && providerKind() === "openai-compatible") return configured;
  return models[0]!;
}

/**
 * Unwraps image payloads on the wire.
 *
 * The gateway validates `file` parts with `data` as string | Uint8Array | URL,
 * while ai@7 serialises the same field as `{ type: "data", data: "<base64>" }`.
 * Without this the gateway answers 400 "Invalid input" for every image. We only
 * unwrap that exact shape and leave anything else untouched.
 */
function unwrapFileParts(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      prompt?: { content?: { type?: string; data?: unknown }[] }[];
    };
    if (!Array.isArray(parsed.prompt)) return body;

    let changed = false;
    for (const message of parsed.prompt) {
      if (!Array.isArray(message?.content)) continue;
      for (const part of message.content) {
        const data = part?.data as { type?: string; data?: unknown } | undefined;
        if (part?.type === "file" && data && typeof data === "object" && typeof data.data === "string") {
          part.data = data.data;
          changed = true;
        }
      }
    }
    return changed ? JSON.stringify(parsed) : body;
  } catch {
    return body;
  }
}

/** Gateway transport with the image payload fix applied. */
const gatewayFetch = (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  if (init && typeof init.body === "string" && init.body.includes('"type":"file"')) {
    return fetch(input, { ...init, body: unwrapFileParts(init.body) });
  }
  return fetch(input, init);
};

const gatewayProvider = () =>
  createGateway({
    baseURL: process.env.AI_GATEWAY_BASE_URL,
    apiKey: process.env.AI_GATEWAY_API_KEY,
    // Cast: Bun's `typeof fetch` additionally carries `preconnect`, which a
    // plain transport wrapper neither has nor needs.
    fetch: gatewayFetch as unknown as typeof fetch,
  });

const openAICompatibleProvider = () =>
  createOpenAICompatible({
    name: "norvi-local",
    // e.g. http://localhost:11434/v1 for Ollama.
    baseURL: (process.env.AI_BASE_URL ?? "http://localhost:11434/v1").trim(),
    // Local servers usually need no key; keep it configurable anyway.
    apiKey: process.env.AI_API_KEY || "not-needed",
  });

/** Resolves a model id to a language model on the configured provider. */
export function resolveModel(modelId?: string): LanguageModel {
  const id = modelId?.trim() || defaultModelId();
  return providerKind() === "openai-compatible"
    ? openAICompatibleProvider()(id)
    : gatewayProvider()(id);
}

/** Gateway models that can actually look at images. */
const VISION_CAPABLE = /^(anthropic\/claude|openai\/gpt|google\/gemini)/i;

/** Default vision model on the hosted gateway. */
const GATEWAY_VISION_FALLBACK = "anthropic/claude-sonnet-4.6";

/**
 * Model used as soon as a message contains an image.
 *
 * `AI_VISION_MODEL` always wins (e.g. `llama3.2-vision` on a local Ollama).
 * On the gateway we keep the user's model when it is vision capable, otherwise
 * we route to a model that is.
 */
export function visionModelId(currentModelId?: string): string {
  const configured = (process.env.AI_VISION_MODEL ?? "").trim();
  if (configured) return configured;

  if (providerKind() === "openai-compatible") {
    throw new Error(
      "Für die Bildanalyse ist noch kein Modell eingerichtet. Bitte AI_VISION_MODEL in der .env setzen (z. B. llama3.2-vision) und das Modell im lokalen Server laden.",
    );
  }

  const current = currentModelId?.trim();
  if (current && VISION_CAPABLE.test(current)) return current;
  return GATEWAY_VISION_FALLBACK;
}

/** Whether image understanding can work with the current configuration. */
export function visionAvailable(): boolean {
  if ((process.env.AI_VISION_MODEL ?? "").trim()) return true;
  return providerKind() === "gateway";
}

/** Backwards-compatible helper used by existing code paths. */
export const gateway = (modelId: string) => resolveModel(modelId);
