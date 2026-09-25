/**
 * Best-effort Ollama warm-up for the local NORVI homeserver.
 *
 * The HTTP server starts immediately; model loading happens in the background
 * so the first real chat request does not pay the full cold-start cost.
 */
let warming = false;

function localOllamaOrigin(): string | null {
  const raw = (process.env.AI_BASE_URL ?? "http://localhost:11434/v1").trim();
  try {
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (!local || url.port !== "11434") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function enabled(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return !/^(0|false|no|off)$/i.test(value.trim());
}

function warmModelIds(): string[] {
  const primary = process.env.AI_FAST_MODEL?.trim() || process.env.AI_MODEL?.trim();
  const vision =
    enabled(process.env.AI_LOCAL_WARM_VISION, false)
      ? process.env.AI_VISION_MODEL?.trim()
      : undefined;
  return [...new Set([primary, vision].filter((model): model is string => Boolean(model)))];
}

async function warmOne(origin: string, model: string, keepAlive: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${origin}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: " ",
        stream: false,
        keep_alive: keepAlive,
        options: { num_predict: 1 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`[ai] local model warm: ${model} (keep-alive ${keepAlive})`);
  } finally {
    clearTimeout(timer);
  }
}

/** Starts one non-blocking warm-up sequence. Safe to call more than once. */
export function warmLocalAi(): void {
  if (warming || !enabled(process.env.AI_LOCAL_WARMUP, true)) return;
  const origin = localOllamaOrigin();
  const models = warmModelIds();
  if (!origin || models.length === 0) return;

  warming = true;
  const keepAlive = (process.env.AI_LOCAL_KEEP_ALIVE ?? "30m").trim() || "30m";

  void (async () => {
    for (const model of models) {
      try {
        await warmOne(origin, model, keepAlive);
      } catch (error) {
        console.warn(
          `[ai] warm-up skipped for ${model}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  })().finally(() => {
    warming = false;
  });
}
