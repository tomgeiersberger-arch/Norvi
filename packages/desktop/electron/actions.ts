import { app, dialog, shell } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type BuiltinDesktopActionId =
  | "spotify"
  | "cs2"
  | "steam"
  | "discord"
  | "downloads"
  | "explorer"
  | "browser";

export interface DesktopActionDescriptor {
  id: string;
  label: string;
  builtin: boolean;
}

type BuiltinDesktopAction =
  | {
      id: BuiltinDesktopActionId;
      label: string;
      kind: "uri";
      target: string;
    }
  | {
      id: BuiltinDesktopActionId;
      label: string;
      kind: "folder";
      target: "downloads" | "home";
    };

interface StoredDesktopAction {
  id: string;
  label: string;
  filePath: string;
}

const ACTIONS: Record<BuiltinDesktopActionId, BuiltinDesktopAction> = {
  spotify: {
    id: "spotify",
    label: "Spotify",
    kind: "uri",
    target: "spotify:",
  },
  cs2: {
    id: "cs2",
    label: "Counter-Strike 2",
    kind: "uri",
    target: "steam://rungameid/730",
  },
  steam: {
    id: "steam",
    label: "Steam",
    kind: "uri",
    target: "steam://open/main",
  },
  discord: {
    id: "discord",
    label: "Discord",
    kind: "uri",
    target: "discord://",
  },
  downloads: {
    id: "downloads",
    label: "Downloads",
    kind: "folder",
    target: "downloads",
  },
  explorer: {
    id: "explorer",
    label: "Explorer",
    kind: "folder",
    target: "home",
  },
  browser: {
    id: "browser",
    label: "Browser",
    kind: "uri",
    target: "https://www.google.com/",
  },
};

function registryPath(): string {
  return path.join(app.getPath("userData"), "desktop-actions.json");
}

function isBuiltinDesktopActionId(value: string): value is BuiltinDesktopActionId {
  return Object.prototype.hasOwnProperty.call(ACTIONS, value);
}

function validStoredAction(value: unknown): value is StoredDesktopAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<StoredDesktopAction>;
  return (
    typeof action.id === "string" &&
    /^custom-[a-zA-Z0-9-]+$/.test(action.id) &&
    typeof action.label === "string" &&
    action.label.trim().length > 0 &&
    typeof action.filePath === "string" &&
    action.filePath.trim().length > 0
  );
}

async function readCustomActions(): Promise<StoredDesktopAction[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(registryPath(), "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validStoredAction).slice(0, 50);
  } catch {
    return [];
  }
}

async function writeCustomActions(actions: StoredDesktopAction[]): Promise<void> {
  await fs.mkdir(path.dirname(registryPath()), { recursive: true });
  await fs.writeFile(registryPath(), JSON.stringify(actions.slice(0, 50), null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function selectedProgramIsAllowed(filePath: string): Promise<boolean> {
  const extension = path.extname(filePath).toLowerCase();
  if (process.platform === "win32" && extension !== ".exe" && extension !== ".lnk") return false;
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
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
 * Fixed actions plus programs explicitly selected by the user.
 *
 * Custom paths never come directly from chat/model text. They can only enter
 * the registry through the native file picker and are launched later by an
 * opaque registry id.
 */
export async function listDesktopActions(): Promise<DesktopActionDescriptor[]> {
  const builtin = Object.values(ACTIONS).map(({ id, label }) => ({
    id,
    label,
    builtin: true,
  }));
  const custom = (await readCustomActions()).map(({ id, label }) => ({
    id,
    label,
    builtin: false,
  }));
  return [...builtin, ...custom];
}

export async function addCustomDesktopAction(): Promise<DesktopActionDescriptor | null> {
  if (process.platform !== "win32") {
    throw new Error("Eigene Programm-Aktionen sind aktuell für Windows vorgesehen.");
  }

  const result = await dialog.showOpenDialog({
    title: "Programm oder Game für NORVI auswählen",
    properties: ["openFile"],
    filters: [
      { name: "Programme & Verknüpfungen", extensions: ["exe", "lnk"] },
    ],
  });
  const filePath = result.filePaths[0];
  if (result.canceled || !filePath) return null;
  if (!(await selectedProgramIsAllowed(filePath))) {
    throw new Error("Bitte eine Windows-App (.exe) oder Verknüpfung (.lnk) auswählen.");
  }

  const existing = await readCustomActions();
  const duplicate = existing.find(
    (action) => action.filePath.toLocaleLowerCase() === filePath.toLocaleLowerCase(),
  );
  if (duplicate) {
    return { id: duplicate.id, label: duplicate.label, builtin: false };
  }
  if (existing.length >= 50) {
    throw new Error("Maximal 50 eigene Programm-Aktionen sind möglich.");
  }

  const label = path.basename(filePath, path.extname(filePath)).trim().slice(0, 80) || "Programm";
  const action: StoredDesktopAction = {
    id: "custom-" + randomUUID(),
    label,
    filePath,
  };
  await writeCustomActions([...existing, action]);
  return { id: action.id, label: action.label, builtin: false };
}

export async function removeCustomDesktopAction(rawId: string): Promise<boolean> {
  const id = rawId.trim();
  if (!id.startsWith("custom-")) return false;
  const actions = await readCustomActions();
  const next = actions.filter((action) => action.id !== id);
  if (next.length === actions.length) return false;
  await writeCustomActions(next);
  return true;
}

export async function launchDesktopAction(rawId: string): Promise<{
  ok: true;
  id: string;
  label: string;
}> {
  const id = rawId.trim();

  if (isBuiltinDesktopActionId(id)) {
    const action = ACTIONS[id];
    if (action.kind === "folder") {
      const error = await shell.openPath(app.getPath(action.target));
      if (error) throw new Error(error);
    } else {
      await shell.openExternal(action.target, { activate: true });
    }
    return { ok: true, id: action.id, label: action.label };
  }

  const action = (await readCustomActions()).find((item) => item.id === id);
  if (!action || !(await selectedProgramIsAllowed(action.filePath))) {
    throw new Error("Diese Desktop-Aktion ist nicht freigegeben oder nicht mehr vorhanden.");
  }

  const launchError = await shell.openPath(action.filePath);
  if (launchError) throw new Error(launchError);
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
