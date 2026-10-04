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

export type DesktopActionId = "spotify" | "cs2";

export interface DesktopActionResult {
  ok: true;
  id: DesktopActionId;
  label: string;
}

export interface NorviDesktopAPI {
  showWindow: () => Promise<boolean>;
  listVoices: () => Promise<string[]>;
  speak: (text: string, voice?: string) => Promise<boolean>;
  stopSpeech: () => Promise<boolean>;
  listDesktopActions: () => Promise<{ id: DesktopActionId; label: string }[]>;
  launchDesktopAction: (actionId: DesktopActionId) => Promise<DesktopActionResult>;
  openWebsite: (url: string) => Promise<{ ok: true; url: string }>;
  capturePrimaryScreen: () => Promise<{ dataUrl: string; name: string }>;
  setQuickShortcut: (enabled: boolean) => Promise<boolean>;
  onFocusCommandInput: (cb: () => void) => () => void;
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
