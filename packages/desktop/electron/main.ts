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
  Tray,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createManagedDeepLinks } from "@runablehq/managed-auth/desktop/main";
import { registerIpcHandlers } from "./ipc";
import {
  detectHardware,
  installRuntime,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";
const WEB_DEV_URL = process.env.WEBSITE_URL ?? "http://localhost:4200";
const LOCAL_NORVI_URL = "http://localhost:4200";
const SETUP_PAGE = path.join(__dirname, "../dist/setup/index.html");
const BACKGROUND_ARG = "--background";
const TRAY_ICON_DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA50lEQVR4nM2XMRaDIAyGA8857t6lq5fo1JM5eQlX7+LeE9iJ1z4FhPAnNmuE/zME+HHMvNON0eWS7+cDItLPazLnYhVACZeAeCvx1Nz+6gNtCJ9KWEGclsA6PJHt34cImsUVGKZFBSR7DhxFh2mh7TVeTnoclxtT3QPoSoiaEAkh3gUoiKZtiICoAog1UytEdQXQEKIlQEKIewAF0dSECIjmy6jkZFQFaIWAXcdSCKgfkEDADUkthGPmXcOQlFzd/bx+bbm1KwoW/T88IVH+9YKOXy2fSliInwC0IWJzR9+GIW57nFrGB5R9U7oSkIjNAAAAAElFTkSuQmCC";

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let installPromise: Promise<void> | null = null;
let backgroundMode = false;
let quickShortcutEnabled = false;
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

async function checkForUpdates(): Promise<{
  currentVersion: string;
  latestVersion: string;
  available: boolean;
  releaseUrl: string | null;
}> {
  const currentVersion = app.getVersion();
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
  const payload = (await response.json()) as {
    tag_name?: string;
    html_url?: string;
  };
  const latestVersion = (payload.tag_name ?? "").replace(/^v/i, "") || currentVersion;
  return {
    currentVersion,
    latestVersion,
    available: compareVersions(latestVersion, currentVersion) > 0,
    releaseUrl: typeof payload.html_url === "string" ? payload.html_url : null,
  };
}

function registerNorviHandlers() {
  ipcMain.handle("norvi:detect-hardware", () => detectHardware());
  ipcMain.handle("norvi:check-for-updates", () => checkForUpdates());

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
    showWindow();
  });

  app.whenReady().then(() => {
    createWindow();
    deepLinks.handleArgv(process.argv);
  });
} else {
  app.quit();
}
