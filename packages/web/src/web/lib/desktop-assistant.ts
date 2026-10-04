export type DesktopActionId = "spotify" | "cs2";

export interface DesktopAssistantSettings {
  assistantName: string;
  wakePhrase: string;
  wakeEnabled: boolean;
  speakReplies: boolean;
  startWithWindows: boolean;
  desktopActionsEnabled: boolean;
  voice: string;
}

const STORAGE_KEY = "norvi.desktop-assistant.v1";
export const ASSISTANT_SETTINGS_EVENT = "norvi:assistant-settings";
export const VOICE_COMMAND_EVENT = "norvi:voice-command";

export const DEFAULT_ASSISTANT_SETTINGS: DesktopAssistantSettings = {
  assistantName: "NORVI",
  wakePhrase: "Hey NORVI",
  wakeEnabled: false,
  speakReplies: true,
  startWithWindows: false,
  desktopActionsEnabled: true,
  voice: "",
};

function cleanName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  return clean || fallback;
}

export function getAssistantSettings(): DesktopAssistantSettings {
  if (typeof window === "undefined") return DEFAULT_ASSISTANT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ASSISTANT_SETTINGS;
    const value = JSON.parse(raw) as Partial<DesktopAssistantSettings>;
    return {
      assistantName: cleanName(value.assistantName, DEFAULT_ASSISTANT_SETTINGS.assistantName),
      wakePhrase: cleanName(value.wakePhrase, DEFAULT_ASSISTANT_SETTINGS.wakePhrase),
      wakeEnabled: value.wakeEnabled === true,
      speakReplies: value.speakReplies !== false,
      startWithWindows: value.startWithWindows === true,
      desktopActionsEnabled: value.desktopActionsEnabled !== false,
      voice: typeof value.voice === "string" ? value.voice.slice(0, 120) : "",
    };
  } catch {
    return DEFAULT_ASSISTANT_SETTINGS;
  }
}

export function saveAssistantSettings(
  next: DesktopAssistantSettings,
): DesktopAssistantSettings {
  const value: DesktopAssistantSettings = {
    assistantName: cleanName(next.assistantName, "NORVI"),
    wakePhrase: cleanName(next.wakePhrase, "Hey NORVI"),
    wakeEnabled: Boolean(next.wakeEnabled),
    speakReplies: Boolean(next.speakReplies),
    startWithWindows: Boolean(next.startWithWindows),
    desktopActionsEnabled: Boolean(next.desktopActionsEnabled),
    voice: next.voice.trim().slice(0, 120),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(ASSISTANT_SETTINGS_EVENT, { detail: value }));
  return value;
}

export function subscribeAssistantSettings(
  listener: (settings: DesktopAssistantSettings) => void,
): () => void {
  const handler = () => listener(getAssistantSettings());
  window.addEventListener(ASSISTANT_SETTINGS_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(ASSISTANT_SETTINGS_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function normalise(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * null = wake phrase not present, empty string = wake phrase only,
 * otherwise the spoken command after the wake phrase.
 */
export function commandAfterWakePhrase(transcript: string, wakePhrase: string): string | null {
  const heard = normalise(transcript);
  const wake = normalise(wakePhrase);
  if (!heard || !wake) return null;

  const at = heard.indexOf(wake);
  if (at < 0) return null;
  const after = heard.slice(at + wake.length).trim();
  return after;
}

export function dispatchVoiceCommand(text: string): void {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  window.dispatchEvent(new CustomEvent(VOICE_COMMAND_EVENT, { detail: { text: clean } }));
}


/**
 * Matches only clear app-launch requests. Questions about an app are ignored.
 * Execution still happens in Electron against a fixed allowlist.
 */
export function matchDesktopAction(text: string): DesktopActionId | null {
  const clean = normalise(text);
  if (!clean) return null;

  if (/^(wie|warum|wieso|was|wo|wann|welche|welcher|welches)\b/.test(clean)) {
    return null;
  }
  if (/\b(?:sag|sage|erklar|erklaer|zeige)\b.*\b(?:wie|warum)\b/.test(clean)) {
    return null;
  }

  const launchIntent =
    /\b(?:offne|oeffne|offnen|oeffnen|starte|starten|start|open|launch|aufmachen)\b/.test(clean) ||
    /\bmach\b.*\bauf\b/.test(clean);
  if (!launchIntent) return null;

  if (/\bspotify\b/.test(clean)) return "spotify";
  if (/\b(?:cs\s*2|counter\s*strike\s*2|counterstrike\s*2)\b/.test(clean)) return "cs2";
  return null;
}

export function desktopActionLabel(id: DesktopActionId): string {
  return id === "spotify" ? "Spotify" : "Counter-Strike 2";
}
