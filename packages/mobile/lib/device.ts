import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "norvi.device-id";

let cached: string | null = null;

/** Stable per-install id — chats are scoped to it, so no login is needed. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
    const created = randomId();
    await AsyncStorage.setItem(STORAGE_KEY, created);
    cached = created;
    return created;
  } catch {
    cached ??= randomId();
    return cached;
  }
}

function randomId(): string {
  const global = globalThis as { crypto?: { randomUUID?: () => string } };
  if (global.crypto?.randomUUID) return global.crypto.randomUUID();
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
