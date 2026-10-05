export type DesktopActionId =
  | "spotify"
  | "steam"
  | "discord"
  | "browser";

export interface WebsiteAction {
  id: string;
  label: string;
  url: string;
  aliases: string[];
}

export interface CustomDesktopAction {
  id: string;
  label: string;
  aliases: string[];
}

export interface LocalMemoryItem {
  id: string;
  text: string;
}

export type ResponsePreset =
  | "normal"
  | "short"
  | "coding"
  | "gaming"
  | "explain"
  | "custom";

export interface DesktopAssistantSettings {
  assistantName: string;
  wakePhrase: string;
  wakeEnabled: boolean;
  speakReplies: boolean;
  startWithWindows: boolean;
  gamingMode: boolean;
  microphoneEnabled: boolean;
  microphoneDeviceId: string;
  screenCaptureEnabled: boolean;
  quickShortcutEnabled: boolean;
  voiceShortcutEnabled: boolean;
  voiceShortcut: string;
  conversationMode: boolean;
  conversationWindowSeconds: number;
  onboardingComplete: boolean;
  memoryEnabled: boolean;
  memoryItems: LocalMemoryItem[];
  responsePreset: ResponsePreset;
  customResponseStyle: string;
  desktopActionsEnabled: boolean;
  desktopActionAliases: Record<DesktopActionId, string[]>;
  customDesktopActions: CustomDesktopAction[];
  websiteActions: WebsiteAction[];
  voice: string;
}

export type DesktopSystemActionId = "volume-up" | "volume-down" | "volume-mute";

export type MatchedDesktopAction =
  | { kind: "desktop"; id: string; label: string }
  | { kind: "website"; id: string; label: string; url: string }
  | { kind: "system"; id: DesktopSystemActionId; label: string };

const STORAGE_KEY = "norvi.desktop-assistant.v1";
export const ASSISTANT_SETTINGS_EVENT = "norvi:assistant-settings";
export const VOICE_COMMAND_EVENT = "norvi:voice-command";
export const VOICE_TURN_COMPLETE_EVENT = "norvi:voice-turn-complete";
export const FOREGROUND_MICROPHONE_EVENT = "norvi:foreground-microphone";
export const OPEN_SETTINGS_EVENT = "norvi:open-settings";

export const DEFAULT_DESKTOP_ACTION_ALIASES: Record<DesktopActionId, string[]> = {
  spotify: ["spotify", "musik"],
  steam: ["steam"],
  discord: ["discord", "dc"],
  browser: ["browser", "internet"],
};

export const DEFAULT_ASSISTANT_SETTINGS: DesktopAssistantSettings = {
  assistantName: "NORVI",
  wakePhrase: "Hey NORVI",
  wakeEnabled: false,
  speakReplies: true,
  startWithWindows: false,
  gamingMode: false,
  microphoneEnabled: true,
  microphoneDeviceId: "",
  screenCaptureEnabled: false,
  quickShortcutEnabled: true,
  voiceShortcutEnabled: false,
  voiceShortcut: "CommandOrControl+Shift+Space",
  conversationMode: false,
  conversationWindowSeconds: 12,
  onboardingComplete: false,
  memoryEnabled: true,
  memoryItems: [],
  responsePreset: "normal",
  customResponseStyle: "",
  desktopActionsEnabled: true,
  desktopActionAliases: DEFAULT_DESKTOP_ACTION_ALIASES,
  customDesktopActions: [],
  websiteActions: [],
  voice: "",
};

function cleanName(value: unknown, fallback: string, maxLength = 40): string {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return clean || fallback;
}

function cleanAlias(value: unknown): string {
  return cleanName(value, "", 48);
}

function cleanAliases(value: unknown, fallback: string[] = []): string[] {
  const raw =
    Array.isArray(value) ? value :
    typeof value === "string" ? value.split(",") :
    [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const alias = cleanAlias(item);
    const key = normalise(alias);
    if (!alias || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(alias);
    if (result.length >= 12) break;
  }
  return result.length ? result : [...fallback];
}

export function normaliseWebsiteUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let input = value.trim().slice(0, 2048);
  if (!input) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) input = "https://" + input;

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function cleanCustomDesktopAction(value: unknown): CustomDesktopAction | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CustomDesktopAction>;
  const id =
    typeof item.id === "string" && /^custom-[a-zA-Z0-9-]+$/.test(item.id)
      ? item.id.slice(0, 100)
      : "";
  const label = cleanName(item.label, "", 80);
  if (!id || !label) return null;
  return { id, label, aliases: cleanAliases(item.aliases, [label]) };
}

function cleanMemoryItem(value: unknown, index: number): LocalMemoryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<LocalMemoryItem>;
  const text = cleanName(item.text, "", 300);
  if (!text) return null;
  const rawId = typeof item.id === "string" ? item.id : "";
  const id =
    rawId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) ||
    "memory-" + (index + 1);
  return { id, text };
}

function cleanWebsiteAction(value: unknown, index: number): WebsiteAction | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<WebsiteAction>;
  const label = cleanName(item.label, "", 60);
  const url = normaliseWebsiteUrl(item.url);
  if (!label || !url) return null;

  const aliases = cleanAliases(item.aliases, [label]);
  const rawId = typeof item.id === "string" ? item.id : "";
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "website-" + (index + 1);
  return { id, label, url, aliases };
}

function cleanResponsePreset(value: unknown): ResponsePreset {
  return value === "short" ||
    value === "coding" ||
    value === "gaming" ||
    value === "explain" ||
    value === "custom"
    ? value
    : "normal";
}

function sanitiseSettings(value: Partial<DesktopAssistantSettings>): DesktopAssistantSettings {
  const rawAliases = value.desktopActionAliases as Partial<Record<DesktopActionId, unknown>> | undefined;
  const memoryItems = Array.isArray(value.memoryItems)
    ? value.memoryItems
        .map((item, index) => cleanMemoryItem(item, index))
        .filter((item): item is LocalMemoryItem => item !== null)
        .slice(0, 30)
    : [];
  const customDesktopActions = Array.isArray(value.customDesktopActions)
    ? value.customDesktopActions
        .map((item) => cleanCustomDesktopAction(item))
        .filter((item): item is CustomDesktopAction => item !== null)
        .slice(0, 50)
    : [];
  const websiteActions = Array.isArray(value.websiteActions)
    ? value.websiteActions
        .map((item, index) => cleanWebsiteAction(item, index))
        .filter((item): item is WebsiteAction => item !== null)
        .slice(0, 24)
    : [];

  return {
    assistantName: cleanName(value.assistantName, DEFAULT_ASSISTANT_SETTINGS.assistantName),
    wakePhrase: cleanName(value.wakePhrase, DEFAULT_ASSISTANT_SETTINGS.wakePhrase),
    wakeEnabled: value.wakeEnabled === true,
    speakReplies: value.speakReplies !== false,
    startWithWindows: value.startWithWindows === true,
    gamingMode: value.gamingMode === true,
    microphoneEnabled: value.microphoneEnabled !== false,
    microphoneDeviceId:
      typeof value.microphoneDeviceId === "string"
        ? value.microphoneDeviceId.trim().slice(0, 240)
        : "",
    screenCaptureEnabled: value.screenCaptureEnabled === true,
    quickShortcutEnabled: value.quickShortcutEnabled !== false,
    voiceShortcutEnabled: value.voiceShortcutEnabled === true,
    voiceShortcut: cleanName(
      value.voiceShortcut,
      DEFAULT_ASSISTANT_SETTINGS.voiceShortcut,
      80,
    ),
    conversationMode: value.conversationMode === true,
    conversationWindowSeconds:
      typeof value.conversationWindowSeconds === "number"
        ? Math.max(6, Math.min(30, Math.round(value.conversationWindowSeconds)))
        : DEFAULT_ASSISTANT_SETTINGS.conversationWindowSeconds,
    onboardingComplete: value.onboardingComplete === true,
    memoryEnabled: value.memoryEnabled !== false,
    memoryItems,
    responsePreset: cleanResponsePreset(value.responsePreset),
    customResponseStyle: cleanName(value.customResponseStyle, "", 500),
    desktopActionsEnabled: value.desktopActionsEnabled !== false,
    desktopActionAliases: {
      spotify: cleanAliases(rawAliases?.spotify, DEFAULT_DESKTOP_ACTION_ALIASES.spotify),
      steam: cleanAliases(rawAliases?.steam, DEFAULT_DESKTOP_ACTION_ALIASES.steam),
      discord: cleanAliases(rawAliases?.discord, DEFAULT_DESKTOP_ACTION_ALIASES.discord),
      browser: cleanAliases(rawAliases?.browser, DEFAULT_DESKTOP_ACTION_ALIASES.browser),
    },
    customDesktopActions,
    websiteActions,
    voice: typeof value.voice === "string" ? value.voice.trim().slice(0, 120) : "",
  };
}

export function getAssistantSettings(): DesktopAssistantSettings {
  if (typeof window === "undefined") return sanitiseSettings(DEFAULT_ASSISTANT_SETTINGS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return sanitiseSettings(DEFAULT_ASSISTANT_SETTINGS);
    return sanitiseSettings(JSON.parse(raw) as Partial<DesktopAssistantSettings>);
  } catch {
    return sanitiseSettings(DEFAULT_ASSISTANT_SETTINGS);
  }
}

export function saveAssistantSettings(
  next: DesktopAssistantSettings,
): DesktopAssistantSettings {
  const value = sanitiseSettings(next);
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

function containsAlias(command: string, alias: string): boolean {
  const needle = normalise(alias);
  if (!needle) return false;
  return (" " + command + " ").includes(" " + needle + " ");
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
  return heard.slice(at + wake.length).trim();
}

export function dispatchVoiceCommand(text: string): void {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  window.dispatchEvent(new CustomEvent(VOICE_COMMAND_EVENT, { detail: { text: clean } }));
}

export function dispatchVoiceTurnComplete(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VOICE_TURN_COMPLETE_EVENT));
}

export function setForegroundMicrophoneActive(active: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FOREGROUND_MICROPHONE_EVENT, { detail: { active } }),
  );
}

const DESKTOP_LABELS: Record<DesktopActionId, string> = {
  spotify: "Spotify",
  steam: "Steam",
  discord: "Discord",
  browser: "Browser",
};

/**
 * Matches only clear launch requests. The actual execution remains restricted
 * to Electron's reviewed app allowlist or validated http/https website URLs.
 */
export function matchDesktopAction(
  text: string,
  settings: DesktopAssistantSettings = getAssistantSettings(),
): MatchedDesktopAction | null {
  const clean = normalise(text);
  if (!clean) return null;

  if (/^(wie|warum|wieso|was|wo|wann|welche|welcher|welches)\b/.test(clean)) return null;
  if (/\b(?:sag|sage|erklar|erklaer|zeige)\b.*\b(?:wie|warum)\b/.test(clean)) return null;

  if (/\b(?:lauter|volume up|lautstarke hoch|lautstaerke hoch)\b/.test(clean)) {
    return { kind: "system", id: "volume-up", label: "Lautstärke erhöht" };
  }
  if (/\b(?:leiser|volume down|lautstarke runter|lautstaerke runter)\b/.test(clean)) {
    return { kind: "system", id: "volume-down", label: "Lautstärke verringert" };
  }
  if (/\b(?:stumm|mute|ton aus|lautstarke aus|lautstaerke aus)\b/.test(clean)) {
    return { kind: "system", id: "volume-mute", label: "Stummschaltung umgeschaltet" };
  }

  const launchIntent =
    /\b(?:offne|oeffne|offnen|oeffnen|starte|starten|start|open|launch|aufmachen|besuche|visit)\b/.test(clean) ||
    /\b(?:mach|mache|geh|gehe|ruf|rufe)\b.*\bauf\b/.test(clean);
  if (!launchIntent) return null;

  const candidates: { alias: string; action: MatchedDesktopAction }[] = [];

  for (const id of Object.keys(DESKTOP_LABELS) as DesktopActionId[]) {
    for (const alias of settings.desktopActionAliases[id] ?? DEFAULT_DESKTOP_ACTION_ALIASES[id]) {
      const key = normalise(alias);
      if (key && containsAlias(clean, key)) {
        candidates.push({
          alias: key,
          action: { kind: "desktop", id, label: DESKTOP_LABELS[id] },
        });
      }
    }
  }

  for (const custom of settings.customDesktopActions) {
    for (const alias of custom.aliases) {
      const key = normalise(alias);
      if (key && containsAlias(clean, key)) {
        candidates.push({
          alias: key,
          action: { kind: "desktop", id: custom.id, label: custom.label },
        });
      }
    }
  }

  for (const website of settings.websiteActions) {
    const url = normaliseWebsiteUrl(website.url);
    if (!url) continue;
    for (const alias of website.aliases) {
      const key = normalise(alias);
      if (key && containsAlias(clean, key)) {
        candidates.push({
          alias: key,
          action: {
            kind: "website",
            id: website.id,
            label: website.label,
            url,
          },
        });
      }
    }
  }

  candidates.sort((a, b) => b.alias.length - a.alias.length);
  return candidates[0]?.action ?? null;
}

export function desktopActionLabel(id: DesktopActionId): string {
  return DESKTOP_LABELS[id];
}
