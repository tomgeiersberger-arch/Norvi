import { ipcRenderer, contextBridge } from "electron";
import { createManagedAuthBridge } from "@runablehq/managed-auth/desktop/preload";

const managedAuth = createManagedAuthBridge();
contextBridge.exposeInMainWorld("managedAuth", managedAuth);

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  showOpenDialog: (opts: Electron.OpenDialogOptions) => ipcRenderer.invoke("dialog:open", opts),
  showSaveDialog: (opts: Electron.SaveDialogOptions) => ipcRenderer.invoke("dialog:save", opts),
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
  checkForUpdates: () => ipcRenderer.invoke("norvi:check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("norvi:install-update"),
  getExplorerContextMenu: () => ipcRenderer.invoke("norvi:get-explorer-context-menu"),
  setExplorerContextMenu: (enabled: boolean) =>
    ipcRenderer.invoke("norvi:set-explorer-context-menu", enabled),
  onExternalFile: (callback: (file: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, file: unknown) => callback(file);
    ipcRenderer.on("norvi:external-file", listener);
    return () => ipcRenderer.removeListener("norvi:external-file", listener);
  },
  onExternalFileError: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on("norvi:external-file-error", listener);
    return () => ipcRenderer.removeListener("norvi:external-file-error", listener);
  },
  runRuntimeSelfTest: () => ipcRenderer.invoke("norvi:runtime-self-test"),
  repairRuntime: () => ipcRenderer.invoke("norvi:repair-runtime"),
  listManagedModels: () => ipcRenderer.invoke("norvi:list-managed-models"),
  pullManagedModel: (profile: "lite" | "standard" | "power") =>
    ipcRenderer.invoke("norvi:pull-managed-model", profile),
  activateManagedModel: (profile: "lite" | "standard" | "power") =>
    ipcRenderer.invoke("norvi:activate-managed-model", profile),
  deleteManagedModel: (profile: "lite" | "standard" | "power") =>
    ipcRenderer.invoke("norvi:delete-managed-model", profile),
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
  addCustomDesktopAction: () => ipcRenderer.invoke("norvi:add-custom-desktop-action"),
  scanInstalledDesktopActions: () => ipcRenderer.invoke("norvi:scan-installed-desktop-actions"),
  addScannedDesktopActions: (scanIds: string[]) =>
    ipcRenderer.invoke("norvi:add-scanned-desktop-actions", scanIds),
  removeCustomDesktopAction: (actionId: string) =>
    ipcRenderer.invoke("norvi:remove-custom-desktop-action", actionId),
  launchDesktopAction: (actionId: string) =>
    ipcRenderer.invoke("norvi:launch-desktop-action", actionId),
  runSystemAction: (actionId: "volume-up" | "volume-down" | "volume-mute") =>
    ipcRenderer.invoke("norvi:run-system-action", actionId),
  openWebsite: (url: string) => ipcRenderer.invoke("norvi:open-website", url),
  capturePrimaryScreen: () => ipcRenderer.invoke("norvi:capture-primary-screen"),
  setQuickShortcut: (enabled: boolean) => ipcRenderer.invoke("norvi:set-quick-shortcut", enabled),
  setVoiceShortcut: (accelerator: string | null) =>
    ipcRenderer.invoke("norvi:set-voice-shortcut", accelerator),
  onFocusCommandInput: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("norvi:focus-command-input", listener);
    return () => ipcRenderer.removeListener("norvi:focus-command-input", listener);
  },
  onVoiceShortcut: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("norvi:voice-shortcut", listener);
    return () => ipcRenderer.removeListener("norvi:voice-shortcut", listener);
  },
  setBackgroundMode: (enabled: boolean) =>
    ipcRenderer.invoke("norvi:set-background-mode", enabled),
  getAutoStart: () => ipcRenderer.invoke("norvi:get-auto-start"),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke("norvi:set-auto-start", enabled),
});
