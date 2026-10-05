const STORAGE_KEY = "norvi.desktop-error-log.v1";
const MAX_ENTRIES = 50;

export interface LocalErrorEntry {
  at: string;
  type: "error" | "rejection";
  message: string;
  stack?: string;
}

function clean(value: unknown, maxLength: number): string {
  const printable = Array.from(String(value ?? ""))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("");
  return printable.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function getLocalErrorLog(): LocalErrorEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is LocalErrorEntry => {
        if (!item || typeof item !== "object") return false;
        const entry = item as Partial<LocalErrorEntry>;
        return (
          typeof entry.at === "string" &&
          (entry.type === "error" || entry.type === "rejection") &&
          typeof entry.message === "string"
        );
      })
      .slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function recordLocalError(type: LocalErrorEntry["type"], value: unknown): void {
  if (typeof window === "undefined") return;
  const error = value instanceof Error ? value : null;
  const message = clean(error?.message ?? value, 800) || "Unbekannter Fehler";
  const stack = error?.stack ? clean(error.stack, 1800) : undefined;
  const next = [
    ...getLocalErrorLog(),
    {
      at: new Date().toISOString(),
      type,
      message,
      ...(stack ? { stack } : {}),
    },
  ].slice(-MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Diagnostics must never break NORVI.
  }
}

export function clearLocalErrorLog(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
