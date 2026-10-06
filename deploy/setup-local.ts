import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpus, totalmem } from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type ProfileName = "lite" | "standard" | "power";
type Profile = {
  label: string;
  textBase: string;
  visionFast: string;
  visionPrecise: string;
  sttModel: string;
};

const profiles: Record<ProfileName, Profile> = {
  lite: {
    label: "Lite · 4B",
    textBase: "qwen3:4b",
    visionFast: "qwen3-vl:2b",
    visionPrecise: "qwen3-vl:4b",
    sttModel: "tiny",
  },
  standard: {
    label: "Standard · 8B",
    textBase: "qwen3:8b",
    visionFast: "qwen3-vl:4b",
    visionPrecise: "qwen3-vl:8b",
    sttModel: "base",
  },
  power: {
    label: "Power · 14B",
    textBase: "qwen3:14b",
    visionFast: "qwen3-vl:8b",
    visionPrecise: "qwen3-vl:8b",
    sttModel: "small",
  },
};

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function run(
  command: string,
  args: string[],
  quiet = false,
  extraEnv: Record<string, string> = {},
): string {
  const env = { ...process.env, ...extraEnv };
  if (quiet) {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    }).trim();
  }
  execFileSync(command, args, { stdio: "inherit", env });
  return "";
}

function nvidiaVramGiB(): number | null {
  try {
    const raw = run(
      "nvidia-smi",
      ["--query-gpu=memory.total", "--format=csv,noheader,nounits"],
      true,
    );
    const mib = raw
      .split(/\r?\n/)
      .map(Number)
      .filter(Number.isFinite);
    return mib.length ? Math.max(...mib) / 1024 : null;
  } catch {
    return null;
  }
}

function detectedProfile(): ProfileName {
  const ram = totalmem() / 1024 ** 3;
  const threads = cpus().length;
  const vram = nvidiaVramGiB();

  if ((vram ?? 0) >= 14 || (process.platform === "darwin" && ram >= 48)) return "power";
  if ((vram ?? 0) >= 7) return "standard";
  if (process.platform === "darwin" && ram >= 24) return "standard";
  if (ram >= 24 && threads >= 8) return "standard";
  return "lite";
}

function envValue(source: string, key: string): string | undefined {
  const match = source.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim();
}

function replaceEnv(source: string, values: Record<string, string>): string {
  const seen = new Set<string>();
  const lines = source.split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match || !(match[1] in values)) return line;
    seen.add(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  return lines.join("\n").replace(/\n*$/, "\n");
}

const requested = argValue("profile");
const profileName: ProfileName =
  requested === "lite" || requested === "standard" || requested === "power"
    ? requested
    : detectedProfile();
const profile = profiles[profileName];
const ramGiB = totalmem() / 1024 ** 3;
const vramGiB = nvidiaVramGiB();

console.log("\nNORVI Local Setup");
console.log(`CPU: ${cpus()[0]?.model ?? "unbekannt"} · ${cpus().length} Threads`);
console.log(`RAM: ${ramGiB.toFixed(1)} GB`);
console.log(`NVIDIA VRAM: ${vramGiB === null ? "nicht erkannt" : `${vramGiB.toFixed(1)} GB`}`);
console.log(`Profil: ${profile.label}\n`);

if (process.argv.includes("--detect-only")) {
  process.exit(0);
}

try {
  run("ollama", ["--version"], true);
} catch {
  console.error("Ollama fehlt. Bitte zuerst Ollama installieren und danach setup:local erneut starten.");
  process.exit(2);
}

const aliases = {
  fast: "norvi-local-fast:latest",
  standard: "norvi-local-standard:latest",
  power: "norvi-local-power:latest",
  deep: "norvi-local-deep:latest",
};

const skipPull = process.argv.includes("--no-pull");
if (!skipPull) {
  const models = [...new Set([profile.textBase, profile.visionFast, profile.visionPrecise])];
  for (const model of models) {
    console.log(`==> Lade ${model}`);
    run("ollama", ["pull", model]);
  }
  for (const alias of Object.values(aliases)) {
    run("ollama", ["cp", profile.textBase, alias]);
  }
}

if (existsSync(".env") && !process.argv.includes("--force")) {
  const current = readFileSync(".env", "utf8");
  const localPort = envValue(current, "STT_LOCAL_PORT") || "8000";
  const sttValues: Record<string, string> = {
    STT_LOCAL_ENABLED: "true",
    STT_LOCAL_PORT: localPort,
    STT_LOCAL_MODEL: envValue(current, "STT_LOCAL_MODEL") || profile.sttModel,
    WHISPER_API_HOME: envValue(current, "WHISPER_API_HOME") || "data/whisper-api",
    STT_BASE_URL: `http://127.0.0.1:${localPort}/v1`,
    STT_API_KEY: envValue(current, "STT_API_KEY") || randomBytes(24).toString("base64url"),
    STT_MODEL: envValue(current, "STT_MODEL") || "whisper-1",
  };

  const migrated = replaceEnv(current, sttValues);
  if (migrated !== current) {
    writeFileSync(".env", migrated, { mode: 0o600 });
    console.log("==> Lokale Speech-to-Text-Einstellungen auf diesen PC migriert");
  } else {
    console.log("\n.env existiert bereits — lokale Speech-to-Text-Einstellungen sind aktuell.");
  }
} else {
  const template = readFileSync(".env.example", "utf8");
  const secret = randomBytes(32).toString("base64url");
  const sttKey = randomBytes(24).toString("base64url");
  const values: Record<string, string> = {
    LOCAL_ONLY_MODE: "true",
    NORVI_PUBLIC_EDITION: "true",
    VITE_ENABLE_TELEMETRY: "false",
    EXPO_PUBLIC_ENABLE_TELEMETRY: "false",
    WEBSITE_URL: "http://localhost:4200",
    TRUSTED_ORIGINS: "http://127.0.0.1:4200",
    DATABASE_URL: "file:./data/norvi.db",
    DATABASE_AUTH_TOKEN: "",
    BETTER_AUTH_SECRET: secret,
    ADMIN_EMAIL: "",
    REQUIRE_AUTH: "false",
    ALLOW_SIGNUP: "false",
    AI_PROVIDER: "openai-compatible",
    AI_BASE_URL: "http://127.0.0.1:11434/v1",
    AI_MODEL: aliases.standard,
    AI_MODELS: Object.values(aliases).join(","),
    AI_ULTRA_SERIOUS_MODEL: "",
    AI_FAST_MODEL: aliases.fast,
    AI_POWER_MODEL: aliases.power,
    AI_DEEP_MODEL: aliases.deep,
    AI_LOCAL_WARMUP: "true",
    AI_LOCAL_WARM_VISION: "false",
    AI_LOCAL_KEEP_ALIVE: "30m",
    AI_API_KEY: "",
    AI_VISION_FAST_MODEL: profile.visionFast,
    AI_VISION_MODEL: profile.visionPrecise,
    STT_LOCAL_ENABLED: "true",
    STT_LOCAL_MODEL: profile.sttModel,
    STT_BASE_URL: "http://127.0.0.1:8000/v1",
    STT_API_KEY: sttKey,
    STT_MODEL: "whisper-1",
    UPLOAD_DIR: "data/uploads",
  };
  writeFileSync(".env", replaceEnv(template, values), { mode: 0o600 });
  console.log("==> Lokale .env erzeugt (Secrets bleiben nur auf diesem PC)");
}

console.log("\n==> Abhängigkeiten");
run("bun", ["install", "--frozen-lockfile"]);

if (!skipPull) {
  const whisperHome = resolve("data/whisper-api");
  const whisperConfig = resolve(whisperHome, "config.json");
  mkdirSync(whisperHome, { recursive: true });

  if (!existsSync(whisperConfig) || process.argv.includes("--force")) {
    writeFileSync(
      whisperConfig,
      JSON.stringify({ engine: "onnx", defaultModel: profile.sttModel }, null, 2) + "\n",
      "utf8",
    );
  }

  console.log(`==> Lade lokales Whisper-Modell ${profile.sttModel}`);
  run(
    "bun",
    [
      "packages/web/node_modules/whisper-api/bin/whisper-api.js",
      "models",
      "pull",
      profile.sttModel,
    ],
    false,
    { WHISPER_API_HOME: whisperHome },
  );
}

console.log("==> Datenbank");
run("bun", ["run", "db:push"]);
console.log("==> Web-App bauen");
run("bun", ["run", "build:web"]);

console.log("\nFertig.");
console.log("Start: bun run serve");
console.log("Dann öffnen: http://localhost:4200");
console.log(`Profil ändern: bun run setup:local -- --profile=lite|standard|power --force`);
