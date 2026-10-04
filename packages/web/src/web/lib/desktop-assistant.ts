export type DesktopActionId = "spotify" | "cs2";

export interface WebsiteAction {
  id: string;
  label: string;
  url: string;
  aliases: string[];
}

export interface DesktopAssistantSettings {
  assistantName: string;
  wakePhrase: string;
  wakeEnabled: boolean;
  speakReplies: boolean;
  startWithWindows: boolean;
  desktopActionsEnabled: boolean;
  desktopActionAliases: Record<DesktopActionId, string[]>;
  websiteActions: WebsiteAction[];
  voice: string;
}

export type MatchedDesktopAction =
  | { kind: "desktop"; id: DesktopActionId; label: string }
  | { kind: "website"; id: string; label: string; url: string };

const STORAGE_KEY = "norvi.desktop-assistant.v1";
export const ASSISTANT_SETTINGS_EVENT = "norvi:assistant-settings";
export const VOICE_COMMAND_EVENT = "norvi:voice-command";

export const DEFAULT_DESKTOP_ACTION_ALIASES: Record<DesktopActionId, string[]> = {
  spotify: ["spotify"],
  cs2: ["cs2", "counter strike 2", "counterstrike 2"],
};

export const DEFAULT_ASSISTANT_SETTINGS: DesktopAssistantSettings = {
  assistantName: "NORVI",
  wakePhrase: "Hey NORVI",
  wakeEnabled: false,
  speakReplies: true,
  startWithWindows: false,
  desktopActionsEnabled: true,
  desktopActionAliases: DEFAULT_DESKTOP_ACTION_ALIASES,
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

function sanitiseSettings(value: Partial<DesktopAssistantSettings>): DesktopAssistantSettings {
  const rawAliases = value.desktopActionAliases as Partial<Record<DesktopActionId, unknown>> | undefined;
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
    desktopActionsEnabled: value.desktopActionsEnabled !== false,
    desktopActionAliases: {
      spotify: cleanAliases(rawAliases?.spotify, DEFAULT_DESKTOP_ACTION_ALIASES.spotify),
      cs2: cleanAliases(rawAliases?.cs2, DEFAULT_DESKTOP_ACTION_ALIASES.cs2),
    },
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

const DESKTOP_LABELS: Record<DesktopActionId, string> = {
  spotify: "Spotify",
  cs2: "Counter-Strike 2",
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

  const launchIntent =
    /\b(?:offne|oeffne|offnen|oeffnen|starte|starten|start|open|launch|aufmachen|besuche|visit)\b/.test(clean) ||
    /\b(?:mach|mache|geh|gehe|ruf|rufe)\b.*\bauf\b/.test(clean);
  if (!launchIntent) return null;

  const candidates: { alias: string; action: MatchedDesktopAction }[] = [];

  for (const id of ["spotify", "cs2"] as const) {
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
