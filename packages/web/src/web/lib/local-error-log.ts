const STORAGE_KEY = "norvi.desktop-error-log.v1";
const MAX_ENTRIES = 50;

export interface LocalErrorEntry {
  at: string;
  type: "error" | "rejection";
  message: string;
  stack?: string;
}

function clean(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
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

export function recordLocalError(
  type: LocalErrorEntry["type"],
  value: unknown,
): void {
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

export function exportLocalErrorLog(extra: Record<string, unknown> = {}): void {
  const payload = {
    format: "norvi-local-diagnostics",
    version: 1,
    createdAt: new Date().toISOString(),
    errors: getLocalErrorLog(),
    ...extra,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "norvi-local-diagnostics.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
