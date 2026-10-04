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
