import { shell } from "electron";

export type DesktopActionId = "spotify" | "cs2";

export interface DesktopAction {
  id: DesktopActionId;
  label: string;
  uri: string;
}

const ACTIONS: Record<DesktopActionId, DesktopAction> = {
  spotify: {
    id: "spotify",
    label: "Spotify",
    uri: "spotify:",
  },
  cs2: {
    id: "cs2",
    label: "Counter-Strike 2",
    uri: "steam://rungameid/730",
  },
};

function isDesktopActionId(value: string): value is DesktopActionId {
  return Object.prototype.hasOwnProperty.call(ACTIONS, value);
}

function safeWebsiteUrl(rawUrl: string): string {
  const input = rawUrl.trim().slice(0, 2048);
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Die Website-Adresse ist ungültig.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("NORVI öffnet hier nur http/https-Websites.");
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error("Die Website-Adresse ist nicht erlaubt.");
  }
  return parsed.toString();
}

/**
 * Safe desktop actions exposed to the renderer.
 *
 * NORVI intentionally does not expose a generic shell/command runner. Only
 * fixed, reviewed targets from this allowlist can be launched.
 */
export function listDesktopActions(): Omit<DesktopAction, "uri">[] {
  return Object.values(ACTIONS).map(({ id, label }) => ({ id, label }));
}

export async function launchDesktopAction(rawId: string): Promise<{
  ok: true;
  id: DesktopActionId;
  label: string;
}> {
  const id = rawId.trim().toLowerCase();
  if (!isDesktopActionId(id)) {
    throw new Error("Diese Desktop-Aktion ist nicht freigegeben.");
  }

  const action = ACTIONS[id];
  await shell.openExternal(action.uri, { activate: true });
  return { ok: true, id: action.id, label: action.label };
}

export async function openDesktopWebsite(rawUrl: string): Promise<{
  ok: true;
  url: string;
}> {
  const url = safeWebsiteUrl(rawUrl);
  await shell.openExternal(url, { activate: true });
  return { ok: true, url };
}
