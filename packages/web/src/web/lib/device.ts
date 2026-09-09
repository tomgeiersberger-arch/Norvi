const STORAGE_KEY = "norvi.device-id";

let cached: string | null = null;

/**
 * Stable per-browser id. Chats are scoped to it, so a device only ever sees
 * its own history — no account required.
 */
export function getDeviceId(): string {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, created);
    cached = created;
    return created;
  } catch {
    // Private mode / storage disabled: keep a session-only id.
    cached ??= crypto.randomUUID();
    return cached;
  }
}
