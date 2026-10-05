import { app, dialog, shell } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type BuiltinDesktopActionId =
  | "spotify"
  | "steam"
  | "discord"
  | "browser";

export interface DesktopActionDescriptor {
  id: string;
  label: string;
  builtin: boolean;
}

export interface ScannedDesktopActionDescriptor {
  scanId: string;
  label: string;
  source: string;
}

type BuiltinDesktopAction = {
  id: BuiltinDesktopActionId;
  label: string;
  target: string;
};

interface StoredDesktopAction {
  id: string;
  label: string;
  filePath?: string;
  uri?: string;
}

interface ScannedTarget {
  label: string;
  source: string;
  filePath?: string;
  uri?: string;
}

const ACTIONS: Record<BuiltinDesktopActionId, BuiltinDesktopAction> = {
  spotify: {
    id: "spotify",
    label: "Spotify",
    target: "spotify:",
  },
  steam: {
    id: "steam",
    label: "Steam",
    target: "steam://open/main",
  },
  discord: {
    id: "discord",
    label: "Discord",
    target: "discord://",
  },
  browser: {
    id: "browser",
    label: "Browser",
    target: "https://www.google.com/",
  },
};

let scanCache = new Map<string, ScannedTarget>();

function registryPath(): string {
  return path.join(app.getPath("userData"), "desktop-actions.json");
}

function isBuiltinDesktopActionId(value: string): value is BuiltinDesktopActionId {
  return Object.prototype.hasOwnProperty.call(ACTIONS, value);
}

function safeScannedUri(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "steam:" ? value : null;
  } catch {
    return null;
  }
}

function validStoredAction(value: unknown): value is StoredDesktopAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<StoredDesktopAction>;
  const hasFilePath = typeof action.filePath === "string" && action.filePath.trim().length > 0;
  const hasUri = typeof action.uri === "string" && safeScannedUri(action.uri) !== null;
  return (
    typeof action.id === "string" &&
    /^custom-[a-zA-Z0-9-]+$/.test(action.id) &&
    typeof action.label === "string" &&
    action.label.trim().length > 0 &&
    (hasFilePath || hasUri)
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

function scanLabel(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).trim().slice(0, 80);
}

function usefulScannedLabel(label: string): boolean {
  return Boolean(label) &&
    !/(uninstall|deinstall|readme|hilfe|help|documentation|manual|update|updater)$/i.test(label);
}

async function walkPrograms(
  directory: string,
  source: string,
  found: ScannedTarget[],
  depth = 0,
): Promise<void> {
  if (depth > 8 || found.length >= 300) return;
  let entries: import("node:fs").Dirent<string>[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (found.length >= 300) break;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkPrograms(fullPath, source, found, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (extension !== ".lnk" && extension !== ".exe") continue;
    const label = scanLabel(entry.name);
    if (!usefulScannedLabel(label)) continue;
    found.push({ label, source, filePath: fullPath });
  }
}

async function steamLibraryRoots(): Promise<string[]> {
  const roots = new Set<string>();
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const programFiles = process.env.ProgramFiles;
  if (programFilesX86) roots.add(path.join(programFilesX86, "Steam"));
  if (programFiles) roots.add(path.join(programFiles, "Steam"));

  for (const root of roots) {
    try {
      const text = await fs.readFile(path.join(root, "steamapps", "libraryfolders.vdf"), "utf8");
      for (const match of text.matchAll(/"path"\s*"([^"]+)"/g)) {
        if (match[1]) roots.add(match[1].replace(/\\\\/g, "\\"));
      }
    } catch {
      // Steam may not be installed in this location.
    }
  }
  return [...roots];
}

async function scanSteamGames(found: ScannedTarget[]): Promise<void> {
  for (const root of await steamLibraryRoots()) {
    const steamapps = path.join(root, "steamapps");
    let entries: string[];
    try {
      entries = await fs.readdir(steamapps);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!/^appmanifest_\d+\.acf$/i.test(entry)) continue;
      try {
        const text = await fs.readFile(path.join(steamapps, entry), "utf8");
        const appId = text.match(/"appid"\s*"([0-9]+)"/i)?.[1];
        const name = text.match(/"name"\s*"([^"]+)"/i)?.[1]?.trim();
        if (!appId || !name || !usefulScannedLabel(name)) continue;
        found.push({
          label: name.slice(0, 80),
          source: "Steam",
          uri: "steam://rungameid/" + appId,
        });
      } catch {
        // Ignore malformed/unreadable manifests.
      }
    }
  }
}

function targetKey(target: ScannedTarget | StoredDesktopAction): string {
  return (target.filePath ?? target.uri ?? "").toLocaleLowerCase();
}

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
    filters: [{ name: "Programme & Verknüpfungen", extensions: ["exe", "lnk"] }],
  });
  const filePath = result.filePaths[0];
  if (result.canceled || !filePath) return null;
  if (!(await selectedProgramIsAllowed(filePath))) {
    throw new Error("Bitte eine Windows-App (.exe) oder Verknüpfung (.lnk) auswählen.");
  }

  const existing = await readCustomActions();
  const duplicate = existing.find(
    (action) => targetKey(action) === filePath.toLocaleLowerCase(),
  );
  if (duplicate) {
    return { id: duplicate.id, label: duplicate.label, builtin: false };
  }
  if (existing.length >= 50) {
    throw new Error("Maximal 50 eigene Programm-Aktionen sind möglich.");
  }

  const action: StoredDesktopAction = {
    id: "custom-" + randomUUID(),
    label: scanLabel(filePath) || "Programm",
    filePath,
  };
  await writeCustomActions([...existing, action]);
  return { id: action.id, label: action.label, builtin: false };
}

export async function scanInstalledDesktopActions(): Promise<ScannedDesktopActionDescriptor[]> {
  if (process.platform !== "win32") {
    throw new Error("Der Programm-Scan ist aktuell für Windows vorgesehen.");
  }

  const found: ScannedTarget[] = [];
  const appData = app.getPath("appData");
  const programData = process.env.ProgramData;
  const desktop = app.getPath("desktop");

  await walkPrograms(path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs"), "Startmenü", found);
  if (programData) {
    await walkPrograms(path.join(programData, "Microsoft", "Windows", "Start Menu", "Programs"), "Startmenü", found);
  }
  await walkPrograms(desktop, "Desktop", found);
  await scanSteamGames(found);

  const existingKeys = new Set((await readCustomActions()).map(targetKey));
  const builtinLabels = new Set(Object.values(ACTIONS).map((item) => item.label.toLocaleLowerCase()));
  const unique = new Map<string, ScannedTarget>();

  for (const candidate of found) {
    const key = targetKey(candidate);
    if (!key || existingKeys.has(key) || builtinLabels.has(candidate.label.toLocaleLowerCase())) continue;
    if (!unique.has(key)) unique.set(key, candidate);
  }

  scanCache = new Map();
  const result = [...unique.values()]
    .sort((a, b) => a.label.localeCompare(b.label, "de"))
    .slice(0, 250)
    .map((candidate) => {
      const scanId = "scan-" + randomUUID();
      scanCache.set(scanId, candidate);
      return { scanId, label: candidate.label, source: candidate.source };
    });

  return result;
}

export async function addScannedDesktopActions(
  rawScanIds: unknown,
): Promise<DesktopActionDescriptor[]> {
  if (!Array.isArray(rawScanIds)) return [];
  const ids = rawScanIds
    .filter((value): value is string => typeof value === "string")
    .slice(0, 50);
  const existing = await readCustomActions();
  const existingKeys = new Set(existing.map(targetKey));
  const additions: StoredDesktopAction[] = [];

  for (const scanId of ids) {
    if (existing.length + additions.length >= 50) break;
    const candidate = scanCache.get(scanId);
    if (!candidate) continue;
    const key = targetKey(candidate);
    if (!key || existingKeys.has(key)) continue;

    if (candidate.filePath && !(await selectedProgramIsAllowed(candidate.filePath))) continue;
    if (candidate.uri && !safeScannedUri(candidate.uri)) continue;

    const action: StoredDesktopAction = {
      id: "custom-" + randomUUID(),
      label: candidate.label,
      ...(candidate.filePath ? { filePath: candidate.filePath } : {}),
      ...(candidate.uri ? { uri: candidate.uri } : {}),
    };
    additions.push(action);
    existingKeys.add(key);
  }

  if (additions.length) await writeCustomActions([...existing, ...additions]);
  return additions.map(({ id, label }) => ({ id, label, builtin: false }));
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
    await shell.openExternal(action.target, { activate: true });
    return { ok: true, id: action.id, label: action.label };
  }

  const action = (await readCustomActions()).find((item) => item.id === id);
  if (!action) {
    throw new Error("Diese Desktop-Aktion ist nicht freigegeben oder nicht mehr vorhanden.");
  }

  if (action.filePath) {
    if (!(await selectedProgramIsAllowed(action.filePath))) {
      throw new Error("Das freigegebene Programm ist nicht mehr vorhanden.");
    }
    const launchError = await shell.openPath(action.filePath);
    if (launchError) throw new Error(launchError);
  } else if (action.uri && safeScannedUri(action.uri)) {
    await shell.openExternal(action.uri, { activate: true });
  } else {
    throw new Error("Diese Desktop-Aktion ist ungültig.");
  }

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
