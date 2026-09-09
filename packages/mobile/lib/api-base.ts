import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Port the NORVI web/API server listens on (fixed in __ports.cjs).
 * Behind a reverse proxy or on another port, set EXPO_PUBLIC_API_URL instead.
 */
const API_PORT = "4200";

/** Matches the private IPv4 ranges a home network (WLAN) hands out. */
const PRIVATE_IPV4 =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Host (without port) the Expo dev server was reached at, e.g. "192.168.1.42". */
function devServerHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    null;
  if (!hostUri) return null;
  const host = hostUri.split("/")[0]?.split("?")[0]?.split(":")[0];
  return host ?? null;
}

/**
 * Resolves the NORVI API base URL for the mobile app.
 *
 * Order of precedence:
 *  1. `EXPO_PUBLIC_API_URL` — explicit override, always wins (self-hosting, reverse proxy).
 *  2. Expo Go over LAN — when the dev server was loaded from a private WLAN address,
 *     talk to NORVI on that same machine (`http://<lan-ip>:4200`). Without this the app
 *     would call the cloud preview URL (or localhost) and fail on a real phone.
 *  3. `expo.extra.apiUrl` — platform-managed preview URL (Runable dashboard preview).
 */
export function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return trimSlash(explicit);

  if (Platform.OS !== "web") {
    const host = devServerHost();
    if (host && PRIVATE_IPV4.test(host)) return `http://${host}:${API_PORT}`;
  }

  const managed = Constants.expoConfig?.extra?.apiUrl;
  if (typeof managed === "string" && managed) return trimSlash(managed);

  return "";
}

/** Base URL of the NORVI API, resolved once at module load. */
export const API_BASE_URL = resolveApiBaseUrl();
