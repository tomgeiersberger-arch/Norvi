import { app, BrowserWindow, ipcMain } from "electron";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";
const WEB_DEV_URL = process.env.WEBSITE_URL ?? "http://localhost:4200";
const LOCAL_NORVI_URL = "http://localhost:4200";
const SETUP_PAGE = path.join(__dirname, "../dist/setup/index.html");

let win: BrowserWindow | null = null;
let installPromise: Promise<void> | null = null;
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

function registerNorviHandlers() {
  ipcMain.handle("norvi:detect-hardware", () => detectHardware());

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
    return true;
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
    },
  });

  win.once("ready-to-show", () => win?.show());

  if (isDev) {
    void win.loadURL(WEB_DEV_URL);
  } else {
    void bootProduction();
  }
}

registerIpcHandlers(getWindow);
registerNorviHandlers();

app.on("before-quit", () => {
  stopLocalServer();
});

app.on("window-all-closed", () => {
  stopLocalServer();
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

if (app.requestSingleInstanceLock()) {
  app.on("second-instance", (_event, argv) => {
    deepLinks.handleArgv(argv);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    deepLinks.handleArgv(process.argv);
  });
} else {
  app.quit();
}
