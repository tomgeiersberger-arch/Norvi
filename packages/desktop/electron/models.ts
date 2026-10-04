import { net } from "electron";

export type ManagedModelProfile = "lite" | "standard" | "power";

export interface ManagedModelInfo {
  profile: ManagedModelProfile;
  label: string;
  model: string;
  installed: boolean;
  active: boolean;
  sizeBytes: number | null;
}

const CATALOG: Record<
  ManagedModelProfile,
  { label: string; model: string }
> = {
  lite: { label: "Lite · 4B", model: "qwen3:4b" },
  standard: { label: "Standard · 8B", model: "qwen3:8b" },
  power: { label: "Power · 14B", model: "qwen3:14b" },
};

const TEXT_ALIASES = [
  "norvi-local-fast:latest",
  "norvi-local-standard:latest",
  "norvi-local-power:latest",
  "norvi-local-deep:latest",
] as const;

function profile(value: string): ManagedModelProfile {
  if (value === "lite" || value === "standard" || value === "power") return value;
  throw new Error("Dieses NORVI-Modellprofil ist nicht freigegeben.");
}

async function ollama(
  route: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await net.fetch("http://127.0.0.1:11434" + route, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Ollama ist nicht erreichbar.");
  }
}

type Tag = {
  name?: string;
  model?: string;
  size?: number;
  digest?: string;
};

async function tags(): Promise<Tag[]> {
  const response = await ollama("/api/tags");
  if (!response.ok) throw new Error("Ollama-Modelle konnten nicht gelesen werden.");
  const payload = (await response.json()) as { models?: Tag[] };
  return Array.isArray(payload.models) ? payload.models : [];
}

function findTag(items: Tag[], name: string): Tag | undefined {
  return items.find((item) => item.name === name || item.model === name);
}

export async function listManagedModels(): Promise<ManagedModelInfo[]> {
  const items = await tags();
  const alias = findTag(items, "norvi-local-standard:latest");
  return (Object.keys(CATALOG) as ManagedModelProfile[]).map((key) => {
    const entry = CATALOG[key];
    const tag = findTag(items, entry.model);
    return {
      profile: key,
      label: entry.label,
      model: entry.model,
      installed: Boolean(tag),
      active:
        Boolean(alias?.digest) &&
        Boolean(tag?.digest) &&
        alias!.digest === tag!.digest,
      sizeBytes: typeof tag?.size === "number" ? tag.size : null,
    };
  });
}

export async function pullManagedModel(
  rawProfile: string,
): Promise<ManagedModelInfo[]> {
  const key = profile(rawProfile);
  const model = CATALOG[key].model;
  const response = await ollama("/api/pull", {
    method: "POST",
    body: JSON.stringify({ model, stream: false }),
  });
  if (!response.ok) {
    throw new Error(model + " konnte nicht heruntergeladen werden.");
  }
  return listManagedModels();
}

export async function activateManagedModel(
  rawProfile: string,
): Promise<ManagedModelInfo[]> {
  const key = profile(rawProfile);
  const model = CATALOG[key].model;
  const installed = await listManagedModels();
  if (!installed.find((item) => item.profile === key)?.installed) {
    throw new Error("Bitte das Modell zuerst herunterladen.");
  }

  for (const destination of TEXT_ALIASES) {
    const response = await ollama("/api/copy", {
      method: "POST",
      body: JSON.stringify({ source: model, destination }),
    });
    if (!response.ok) {
      throw new Error("NORVI konnte das Modell nicht aktivieren.");
    }
  }
  return listManagedModels();
}

export async function deleteManagedModel(
  rawProfile: string,
): Promise<ManagedModelInfo[]> {
  const key = profile(rawProfile);
  const current = await listManagedModels();
  const target = current.find((item) => item.profile === key);
  if (!target?.installed) return current;
  if (target.active) {
    throw new Error("Das aktive Modell kann nicht gelöscht werden.");
  }

  const response = await ollama("/api/delete", {
    method: "DELETE",
    body: JSON.stringify({ model: CATALOG[key].model }),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error("Das lokale Modell konnte nicht gelöscht werden.");
  }
  return listManagedModels();
}
