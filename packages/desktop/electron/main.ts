import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  screen,
  shell,
  Tray,
} from "electron";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createManagedDeepLinks } from "@runablehq/managed-auth/desktop/main";
import { registerIpcHandlers } from "./ipc";
import {
  detectHardware,
  installRuntime,
  repairLocalRuntime,
  runRuntimeSelfTest,
  runtimeReady,
  startLocalServer,
  stopLocalServer,
  type ProfileName,
  type SetupProgress,
} from "./local-runtime";
import { listLocalVoices, speakLocal, stopSpeech } from "./voice";
import {
  addCustomDesktopAction,
  launchDesktopAction,
  listDesktopActions,
  openDesktopWebsite,
  removeCustomDesktopAction,
} from "./actions";
import {
  activateManagedModel,
  deleteManagedModel,
  listManagedModels,
  pullManagedModel,
} from "./models";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";
const WEB_DEV_URL = process.env.WEBSITE_URL ?? "http://localhost:4200";
const LOCAL_NORVI_URL = "http://localhost:4200";
const SETUP_PAGE = path.join(__dirname, "../dist/setup/index.html");
const BACKGROUND_ARG = "--background";
const EXTERNAL_FILE_ARG = "--norvi-file";
const EXPLORER_CONTEXT_KEY = "HKCU\\Software\\Classes\\*\\shell\\NORVI";
const TEXT_EXTERNAL_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".json", ".csv", ".log", ".xml", ".yaml", ".yml",
  ".toml", ".ini", ".env", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py",
  ".java", ".c", ".h", ".cpp", ".hpp", ".cs", ".go", ".rs", ".rb", ".php",
  ".html", ".htm", ".css", ".scss", ".sql", ".sh", ".ps1",
]);
const IMAGE_EXTERNAL_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const TRAY_ICON_DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA50lEQVR4nM2XMRaDIAyGA8857t6lq5fo1JM5eQlX7+LeE9iJ1z4FhPAnNmuE/zME+HHMvNON0eWS7+cDItLPazLnYhVACZeAeCvx1Nz+6gNtCJ9KWEGclsA6PJHt34cImsUVGKZFBSR7DhxFh2mh7TVeTnoclxtT3QPoSoiaEAkh3gUoiKZtiICoAog1UytEdQXQEKIlQEKIewAF0dSECIjmy6jkZFQFaIWAXcdSCKgfkEDADUkthGPmXcOQlFzd/bx+bbm1KwoW/T88IVH+9YKOXy2fSliInwC0IWJzR9+GIW57nFrGB5R9U7oSkIjNAAAAAElFTkSuQmCC";

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let installPromise: Promise<void> | null = null;
let backgroundMode = false;
let quickShortcutEnabled = false;
let voiceShortcutRegistered: string | null = null;
let pendingExternalFile:
  | { kind: "text"; name: string; text: string }
  | { kind: "image"; name: string; mediaType: string; dataUrl: string }
  | null = null;
let quitting = false;
const backgroundLaunch = process.argv.includes(BACKGROUND_ARG);
const getWindow = () => win;

const deepLinks = createManagedDeepLinks({
  applicationId: process.env.APPLICATION_ID,
  getWindow,
});

function sendSetupProgress(progress: SetupProgress) {
  const window = win;
  if (window && !window.isDestroyed()) {
    window.webContents.send("norvi:setup-progress", progress);
  }
}

function showWindow() {
  const window = win;
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

function ensureTray() {
  if (tray) return;
  const image = nativeImage.createFromDataURL(TRAY_ICON_DATA).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip("NORVI · lokaler KI-Assistent");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "NORVI öffnen",
        click: () => showWindow(),
      },
      { type: "separator" },
      {
        label: "NORVI beenden",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", () => showWindow());
}

function setBackgroundMode(enabled: boolean) {
  backgroundMode = enabled;
  if (enabled) ensureTray();
  else destroyTray();
}

function setQuickShortcut(enabled: boolean): boolean {
  globalShortcut.unregister("Alt+Space");
  quickShortcutEnabled = false;
  if (!enabled) return false;

  quickShortcutEnabled = globalShortcut.register("Alt+Space", () => {
    showWindow();
    const window = win;
    if (window && !window.isDestroyed()) {
      window.webContents.send("norvi:focus-command-input");
    }
  });
  return quickShortcutEnabled;
}

function setVoiceShortcut(rawAccelerator: string | null): boolean {
  if (voiceShortcutRegistered) {
    globalShortcut.unregister(voiceShortcutRegistered);
    voiceShortcutRegistered = null;
  }

  const accelerator = (rawAccelerator ?? "").replace(/[\r\n\t]/g, "").trim().slice(0, 80);
  if (!accelerator) return false;
  if (accelerator.toLocaleLowerCase() === "alt+space" && quickShortcutEnabled) return false;

  try {
    const registered = globalShortcut.register(accelerator, () => {
      showWindow();
      const window = win;
      if (window && !window.isDestroyed()) {
        window.webContents.send("norvi:voice-shortcut");
      }
    });
    if (registered) voiceShortcutRegistered = accelerator;
    return registered;
  } catch {
    return false;
  }
}

async function runSystemAction(
  rawActionId: string,
): Promise<{ ok: true; label: string }> {
  if (process.platform !== "win32") {
    throw new Error("Diese System-Aktion ist aktuell für Windows vorgesehen.");
  }

  const actions = {
    "volume-up": { code: "0xAF", label: "Lautstärke erhöht" },
    "volume-down": { code: "0xAE", label: "Lautstärke verringert" },
    "volume-mute": { code: "0xAD", label: "Stummschaltung umgeschaltet" },
  } as const;
  const action = actions[rawActionId as keyof typeof actions];
  if (!action) throw new Error("Diese System-Aktion ist nicht freigegeben.");

  const script = [
    "$sig='[DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);'",
    "$t=Add-Type -MemberDefinition $sig -Name NorviKeySender -Namespace Norvi -PassThru",
    "$t::keybd_event(" + action.code + ",0,0,[UIntPtr]::Zero)",
    "$t::keybd_event(" + action.code + ",0,2,[UIntPtr]::Zero)",
  ].join(";");

  await new Promise<void>((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true },
      (error) => (error ? reject(error) : resolve()),
    );
  });
  return { ok: true, label: action.label };
}

function explorerContextMenuEnabled(): boolean {
  if (process.platform !== "win32") return false;
  try {
    execFileSync("reg.exe", ["query", EXPLORER_CONTEXT_KEY], {
      stdio: "ignore",
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

function setExplorerContextMenu(enabled: boolean): boolean {
  if (process.platform !== "win32") return false;

  if (!enabled) {
    try {
      execFileSync("reg.exe", ["delete", EXPLORER_CONTEXT_KEY, "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      // Already absent.
    }
    return false;
  }

  const commandKey = EXPLORER_CONTEXT_KEY + "\\command";
  const command = '"' + process.execPath + '" ' + EXTERNAL_FILE_ARG + ' "%1"';

  execFileSync(
    "reg.exe",
    ["add", EXPLORER_CONTEXT_KEY, "/ve", "/d", "Mit NORVI öffnen", "/f"],
    { stdio: "ignore", windowsHide: true },
  );
  execFileSync(
    "reg.exe",
    ["add", EXPLORER_CONTEXT_KEY, "/v", "Icon", "/d", process.execPath, "/f"],
    { stdio: "ignore", windowsHide: true },
  );
  execFileSync(
    "reg.exe",
    ["add", commandKey, "/ve", "/d", command, "/f"],
    { stdio: "ignore", windowsHide: true },
  );
  return explorerContextMenuEnabled();
}

async function readExternalFile(filePath: string) {
  if (!path.isAbsolute(filePath)) return null;
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return null;

  const extension = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath).replace(/[\r\n\t]/g, " ").slice(0, 160);
  const mediaType = IMAGE_EXTERNAL_TYPES[extension];

  if (mediaType) {
    if (stat.size > 8 * 1024 * 1024) throw new Error("Das Bild ist größer als 8 MB.");
    const data = await fs.readFile(filePath);
    return {
      kind: "image" as const,
      name,
      mediaType,
      dataUrl: "data:" + mediaType + ";base64," + data.toString("base64"),
    };
  }

  if (!TEXT_EXTERNAL_EXTENSIONS.has(extension)) {
    throw new Error("Dieser Dateityp wird vom NORVI-Rechtsklick noch nicht unterstützt.");
  }
  if (stat.size > 1024 * 1024) throw new Error("Die Textdatei ist größer als 1 MB.");

  return {
    kind: "text" as const,
    name,
    text: await fs.readFile(filePath, "utf8"),
  };
}

function deliverExternalFile(): void {
  const window = win;
  if (!pendingExternalFile || !window || window.isDestroyed() || window.webContents.isLoading()) {
    return;
  }

  const url = window.webContents.getURL();
  if (!isDev && !url.startsWith(LOCAL_NORVI_URL)) return;

  window.webContents.send("norvi:external-file", pendingExternalFile);
  pendingExternalFile = null;
}

async function queueExternalFile(argv: string[]): Promise<void> {
  const index = argv.indexOf(EXTERNAL_FILE_ARG);
  const filePath = index >= 0 ? argv[index + 1] : undefined;
  if (!filePath) return;

  try {
    pendingExternalFile = await readExternalFile(filePath);
    showWindow();
    deliverExternalFile();
  } catch (error) {
    const window = win;
    if (window && !window.isDestroyed()) {
      window.webContents.send(
        "norvi:external-file-error",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

async function capturePrimaryScreen(): Promise<{ dataUrl: string; name: string }> {
  const primary = screen.getPrimaryDisplay();
  const logicalWidth = Math.max(1, primary.size.width);
  const logicalHeight = Math.max(1, primary.size.height);
  const width = Math.min(1920, Math.round(logicalWidth * primary.scaleFactor));
  const height = Math.max(1, Math.round((width / logicalWidth) * logicalHeight));

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width, height },
    fetchWindowIcons: false,
  });
  const source =
    sources.find((candidate) => candidate.display_id === String(primary.id)) ?? sources[0];
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error("Der Bildschirm konnte nicht aufgenommen werden.");
  }

  return {
    dataUrl: source.thumbnail.toDataURL(),
    name: "norvi-screen-" + Date.now() + ".png",
  };
}

async function showSetup() {
  if (!win) return;
  await win.loadFile(SETUP_PAGE);
}

async function openNorvi() {
  await startLocalServer(sendSetupProgress);
  if (!win) return;
  await win.loadURL(LOCAL_NORVI_URL);
}

async function bootProduction() {
  try {
    if (await runtimeReady()) {
      await openNorvi();
    } else {
      await showSetup();
    }
  } catch (error) {
    await showSetup();
    sendSetupProgress({
      stage: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function compareVersions(a: string, b: string): number {
  const clean = (value: string) =>
    value
      .replace(/^v/i, "")
      .split(".")
      .map((part) => Number(part.replace(/[^0-9].*$/, "")) || 0);
  const left = clean(a);
  const right = clean(b);
  const count = Math.max(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

type LatestRelease = {
  tag_name?: string;
  html_url?: string;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
  }>;
};

async function latestRelease(): Promise<LatestRelease> {
  const response = await net.fetch(
    "https://api.github.com/repos/tomgeiersberger-arch/Norvi/releases/latest",
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "NORVI-Desktop",
      },
    },
  );
  if (!response.ok) {
    throw new Error("Update-Informationen konnten nicht geladen werden.");
  }
  return (await response.json()) as LatestRelease;
}

async function checkForUpdates(): Promise<{
  currentVersion: string;
  latestVersion: string;
  available: boolean;
  releaseUrl: string | null;
}> {
  const currentVersion = app.getVersion();
  const payload = await latestRelease();
  const latestVersion = (payload.tag_name ?? "").replace(/^v/i, "") || currentVersion;
  return {
    currentVersion,
    latestVersion,
    available: compareVersions(latestVersion, currentVersion) > 0,
    releaseUrl: typeof payload.html_url === "string" ? payload.html_url : null,
  };
}

async function installLatestUpdate(): Promise<{ ok: true; version: string }> {
  if (process.platform !== "win32") {
    throw new Error("Die direkte Update-Installation ist aktuell für Windows vorgesehen.");
  }

  const currentVersion = app.getVersion();
  const release = await latestRelease();
  const version = (release.tag_name ?? "").replace(/^v/i, "");
  if (!version || compareVersions(version, currentVersion) <= 0) {
    throw new Error("Es ist kein neueres NORVI-Update verfügbar.");
  }

  const installerName = "NORVI-Setup-" + version + ".exe";
  const installerAsset = release.assets?.find(
    (asset) => asset.name === installerName && typeof asset.browser_download_url === "string",
  );
  const checksumAsset = release.assets?.find(
    (asset) => asset.name === "SHA256SUMS.txt" && typeof asset.browser_download_url === "string",
  );

  if (!installerAsset?.browser_download_url || !checksumAsset?.browser_download_url) {
    throw new Error("Der Release enthält keinen verifizierbaren NORVI-Installer.");
  }

  const [installerResponse, checksumResponse] = await Promise.all([
    net.fetch(installerAsset.browser_download_url, { redirect: "follow" }),
    net.fetch(checksumAsset.browser_download_url, { redirect: "follow" }),
  ]);

  if (!installerResponse.ok || !checksumResponse.ok) {
    throw new Error("Das Update konnte nicht vollständig heruntergeladen werden.");
  }

  const manifest = await checksumResponse.text();
  const line = manifest
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.endsWith("  " + installerName));
  const expectedHash = line?.split(/\s+/)[0]?.toLowerCase();

  if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error("Die Update-Prüfsumme fehlt oder ist ungültig.");
  }

  const bytes = Buffer.from(await installerResponse.arrayBuffer());
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error("Die SHA-256-Prüfung des Updates ist fehlgeschlagen.");
  }

  const destination = path.join(app.getPath("temp"), installerName);
  await fs.writeFile(destination, bytes);
  const launchError = await shell.openPath(destination);
  if (launchError) throw new Error(launchError);

  return { ok: true, version };
}

function registerNorviHandlers() {
  ipcMain.handle("norvi:detect-hardware", () => detectHardware());
  ipcMain.handle("norvi:check-for-updates", () => checkForUpdates());
  ipcMain.handle("norvi:install-update", () => installLatestUpdate());
  ipcMain.handle("norvi:get-explorer-context-menu", () => explorerContextMenuEnabled());
  ipcMain.handle("norvi:set-explorer-context-menu", (_event, enabled: boolean) =>
    setExplorerContextMenu(Boolean(enabled)),
  );
  ipcMain.handle("norvi:runtime-self-test", () => runRuntimeSelfTest());
  ipcMain.handle("norvi:repair-runtime", () => repairLocalRuntime());
  ipcMain.handle("norvi:list-managed-models", () => listManagedModels());
  ipcMain.handle("norvi:pull-managed-model", (_event, profile: string) =>
    pullManagedModel(String(profile ?? "")),
  );
  ipcMain.handle("norvi:activate-managed-model", (_event, profile: string) =>
    activateManagedModel(String(profile ?? "")),
  );
  ipcMain.handle("norvi:delete-managed-model", (_event, profile: string) =>
    deleteManagedModel(String(profile ?? "")),
  );

  ipcMain.handle("norvi:install", async (_event, rawProfile: string) => {
    if (installPromise) return installPromise;
    const profile: ProfileName =
      rawProfile === "power" || rawProfile === "standard" || rawProfile === "lite"
        ? rawProfile
        : detectHardware().profile;

    installPromise = installRuntime(profile, sendSetupProgress).finally(() => {
      installPromise = null;
    });
    return installPromise;
  });

  ipcMain.handle("norvi:launch", async () => {
    await openNorvi();
    showWindow();
    return true;
  });

  ipcMain.handle("norvi:show-window", () => {
    showWindow();
    return true;
  });

  ipcMain.handle("norvi:list-voices", () => listLocalVoices());
  ipcMain.handle("norvi:speak", async (_event, text: string, voice?: string) => {
    await speakLocal(String(text ?? ""), typeof voice === "string" ? voice : undefined);
    return true;
  });
  ipcMain.handle("norvi:stop-speech", () => {
    stopSpeech();
    return true;
  });

  ipcMain.handle("norvi:list-desktop-actions", () => listDesktopActions());
  ipcMain.handle("norvi:add-custom-desktop-action", () => addCustomDesktopAction());
  ipcMain.handle("norvi:remove-custom-desktop-action", (_event, actionId: string) =>
    removeCustomDesktopAction(String(actionId ?? "")),
  );
  ipcMain.handle("norvi:launch-desktop-action", async (_event, actionId: string) =>
    launchDesktopAction(String(actionId ?? "")),
  );
  ipcMain.handle("norvi:open-website", async (_event, url: string) =>
    openDesktopWebsite(String(url ?? "")),
  );
  ipcMain.handle("norvi:capture-primary-screen", () => capturePrimaryScreen());
  ipcMain.handle("norvi:set-quick-shortcut", (_event, enabled: boolean) =>
    setQuickShortcut(Boolean(enabled)),
  );
  ipcMain.handle("norvi:set-voice-shortcut", (_event, accelerator: string | null) =>
    setVoiceShortcut(typeof accelerator === "string" ? accelerator : null),
  );

  ipcMain.handle("norvi:set-background-mode", (_event, enabled: boolean) => {
    setBackgroundMode(Boolean(enabled));
    return backgroundMode;
  });

  ipcMain.handle("norvi:get-auto-start", () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle("norvi:set-auto-start", (_event, enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      args: enabled ? [BACKGROUND_ARG] : [],
    });
    return app.getLoginItemSettings().openAtLogin;
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: "#090909",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  win.webContents.on("did-finish-load", () => deliverExternalFile());

  win.on("close", (event) => {
    if (!quitting && backgroundMode) {
      event.preventDefault();
      win?.hide();
    }
  });

  if (!backgroundLaunch) {
    win.once("ready-to-show", () => win?.show());
  }

  if (isDev) {
    void win.loadURL(WEB_DEV_URL);
  } else {
    void bootProduction();
  }
}

registerIpcHandlers(getWindow);
registerNorviHandlers();

app.on("before-quit", () => {
  quitting = true;
  globalShortcut.unregisterAll();
  quickShortcutEnabled = false;
  voiceShortcutRegistered = null;
  stopSpeech();
  stopLocalServer();
});

app.on("window-all-closed", () => {
  if (backgroundMode && !quitting) return;
  stopSpeech();
  stopLocalServer();
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else showWindow();
});

if (app.requestSingleInstanceLock()) {
  app.on("second-instance", (_event, argv) => {
    deepLinks.handleArgv(argv);
    void queueExternalFile(argv);
    showWindow();
  });

  app.whenReady().then(() => {
    createWindow();
    deepLinks.handleArgv(process.argv);
    void queueExternalFile(process.argv);
  });
} else {
  app.quit();
}
