import { ipcRenderer, contextBridge } from "electron";
import { createManagedAuthBridge } from "@runablehq/managed-auth/desktop/preload";

const managedAuth = createManagedAuthBridge();
contextBridge.exposeInMainWorld("managedAuth", managedAuth);

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  showOpenDialog: (opts: Electron.OpenDialogOptions) => ipcRenderer.invoke("dialog:open", opts),
  showSaveDialog: (opts: Electron.SaveDialogOptions) => ipcRenderer.invoke("dialog:save", opts),
  readFile: (path: string) => ipcRenderer.invoke("fs:read", path),
  writeFile: (path: string, data: string) => ipcRenderer.invoke("fs:write", path, data),
  openExternal: managedAuth.openExternal,
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke("notification:show", title, body),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  onDeepLink: managedAuth.onDeepLink,
});

contextBridge.exposeInMainWorld("norviDesktop", {
  detectHardware: () => ipcRenderer.invoke("norvi:detect-hardware"),
  install: (profile: "lite" | "standard" | "power") =>
    ipcRenderer.invoke("norvi:install", profile),
  launch: () => ipcRenderer.invoke("norvi:launch"),
  onProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => callback(progress);
    ipcRenderer.on("norvi:setup-progress", listener);
    return () => ipcRenderer.removeListener("norvi:setup-progress", listener);
  },

  showWindow: () => ipcRenderer.invoke("norvi:show-window"),
  listVoices: () => ipcRenderer.invoke("norvi:list-voices"),
  speak: (text: string, voice?: string) => ipcRenderer.invoke("norvi:speak", text, voice),
  stopSpeech: () => ipcRenderer.invoke("norvi:stop-speech"),
  listDesktopActions: () => ipcRenderer.invoke("norvi:list-desktop-actions"),
  launchDesktopAction: (actionId: "spotify" | "cs2") =>
    ipcRenderer.invoke("norvi:launch-desktop-action", actionId),
  setBackgroundMode: (enabled: boolean) =>
    ipcRenderer.invoke("norvi:set-background-mode", enabled),
  getAutoStart: () => ipcRenderer.invoke("norvi:get-auto-start"),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke("norvi:set-auto-start", enabled),
});
