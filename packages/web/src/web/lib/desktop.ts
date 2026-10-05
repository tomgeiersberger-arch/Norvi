/** Type definition for the Electron preload API exposed via contextBridge. */
export interface ElectronAPI {
  platform: string;
  showOpenDialog: (opts: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    properties?: string[];
  }) => Promise<string[]>;
  showSaveDialog: (opts: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<string | null>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, data: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  showNotification: (title: string, body: string) => Promise<void>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  onDeepLink: (cb: (url: string) => void) => () => void;
}

export type DesktopActionId =
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

export interface DesktopActionResult {
  ok: true;
  id: string;
  label: string;
}

export interface DesktopHardwareProfile {
  cpu: string;
  threads: number;
  ramGiB: number;
  nvidiaVramGiB: number | null;
  profile: "lite" | "standard" | "power";
  label: string;
}

export interface DesktopUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  available: boolean;
  releaseUrl: string | null;
}

export interface RuntimeCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface ManagedModelInfo {
  profile: "lite" | "standard" | "power";
  label: string;
  model: string;
  installed: boolean;
  active: boolean;
  sizeBytes: number | null;
}

export interface NorviDesktopAPI {
  detectHardware: () => Promise<DesktopHardwareProfile>;
  checkForUpdates: () => Promise<DesktopUpdateInfo>;
  runRuntimeSelfTest: () => Promise<RuntimeCheck[]>;
  repairRuntime: () => Promise<RuntimeCheck[]>;
  listManagedModels: () => Promise<ManagedModelInfo[]>;
  pullManagedModel: (profile: "lite" | "standard" | "power") => Promise<ManagedModelInfo[]>;
  activateManagedModel: (profile: "lite" | "standard" | "power") => Promise<ManagedModelInfo[]>;
  deleteManagedModel: (profile: "lite" | "standard" | "power") => Promise<ManagedModelInfo[]>;
  showWindow: () => Promise<boolean>;
  listVoices: () => Promise<string[]>;
  speak: (text: string, voice?: string) => Promise<boolean>;
  stopSpeech: () => Promise<boolean>;
  listDesktopActions: () => Promise<DesktopActionDescriptor[]>;
  addCustomDesktopAction: () => Promise<DesktopActionDescriptor | null>;
  removeCustomDesktopAction: (actionId: string) => Promise<boolean>;
  launchDesktopAction: (actionId: string) => Promise<DesktopActionResult>;
  runSystemAction: (
    actionId: "volume-up" | "volume-down" | "volume-mute",
  ) => Promise<{ ok: true; label: string }>;
  openWebsite: (url: string) => Promise<{ ok: true; url: string }>;
  capturePrimaryScreen: () => Promise<{ dataUrl: string; name: string }>;
  setQuickShortcut: (enabled: boolean) => Promise<boolean>;
  setVoiceShortcut: (accelerator: string | null) => Promise<boolean>;
  onFocusCommandInput: (cb: () => void) => () => void;
  onVoiceShortcut: (cb: () => void) => () => void;
  setBackgroundMode: (enabled: boolean) => Promise<boolean>;
  getAutoStart: () => Promise<boolean>;
  setAutoStart: (enabled: boolean) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    norviDesktop?: NorviDesktopAPI;
  }
}

export function getDesktopAPI(): ElectronAPI | null {
  return window.electronAPI ?? null;
}

export function getNorviDesktopAPI(): NorviDesktopAPI | null {
  return window.norviDesktop ?? null;
}

export function isDesktop(): boolean {
  return getDesktopAPI() !== null && getNorviDesktopAPI() !== null;
}
