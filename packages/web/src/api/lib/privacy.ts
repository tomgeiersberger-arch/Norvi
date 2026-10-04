function enabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

export function localOnlyModeEnabled(): boolean {
  return enabled(process.env.LOCAL_ONLY_MODE);
}

export function publicEditionEnabled(): boolean {
  return enabled(process.env.NORVI_PUBLIC_EDITION);
}

function assertLoopbackUrl(name: string, raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`LOCAL_ONLY_MODE: ${name} ist keine gültige URL.`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(
      `LOCAL_ONLY_MODE blockiert ${name}=${raw}. Erlaubt sind nur lokale Loopback-Adressen.`,
    );
  }
}
/**
 * Hard privacy guard for the public self-hosted edition.
 * It runs before the API is imported, so cloud AI/STT/database endpoints never
 * get a chance to initialise when LOCAL_ONLY_MODE=true.
 */
export function assertLocalOnlyConfiguration(): void {
  if (!localOnlyModeEnabled()) return;

  const provider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (provider !== "openai-compatible" && provider !== "ollama") {
    throw new Error(
      "LOCAL_ONLY_MODE verlangt AI_PROVIDER=openai-compatible (oder ollama).",
    );
  }

  assertLoopbackUrl(
    "AI_BASE_URL",
    (process.env.AI_BASE_URL ?? "http://127.0.0.1:11434/v1").trim(),
  );

  const stt = process.env.STT_BASE_URL?.trim();
  if (stt) assertLoopbackUrl("STT_BASE_URL", stt);
  const database = (process.env.DATABASE_URL ?? "").trim();
  if (!database.startsWith("file:")) {
    throw new Error("LOCAL_ONLY_MODE verlangt eine lokale DATABASE_URL mit file:.");
  }
  if ((process.env.DATABASE_AUTH_TOKEN ?? "").trim()) {
    throw new Error("LOCAL_ONLY_MODE erlaubt keinen DATABASE_AUTH_TOKEN.");
  }

  if (
    (process.env.AI_GATEWAY_BASE_URL ?? "").trim() ||
    (process.env.AI_GATEWAY_API_KEY ?? "").trim()
  ) {
    throw new Error(
      "LOCAL_ONLY_MODE blockiert AI_GATEWAY_BASE_URL/AI_GATEWAY_API_KEY.",
    );
  }

  console.log("[privacy] LOCAL_ONLY_MODE aktiv: KI, STT und Datenbank bleiben lokal.");
}
