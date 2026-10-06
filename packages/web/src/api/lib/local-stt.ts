import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Optional local Whisper sidecar for the self-hosted NORVI server.
 *
 * It is deliberately bound to loopback and inherits the API key through the
 * environment, so neither the key nor the STT endpoint is exposed to browsers.
 */
let child: ReturnType<typeof Bun.spawn> | null = null;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let stopping = false;
let started = false;

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);

function localSttEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test((process.env.STT_LOCAL_ENABLED ?? "").trim());
}

function executable(): string[] {
  const configured = process.env.STT_LOCAL_BIN?.trim();
  if (configured) return [configured];

  // Invoke the package with the same Bun runtime as NORVI. This avoids
  // platform-specific node_modules/.bin shims on Windows.
  return [
    Bun.argv[0] || "bun",
    path.join(projectRoot, "packages", "web", "node_modules", "whisper-api", "bin", "whisper-api.js"),
  ];
}

function scheduleRestart() {
  if (stopping || restartTimer) return;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    spawnLocalStt();
  }, 3000);
}
function spawnLocalStt() {
  if (stopping || !localSttEnabled()) return;

  let key = process.env.STT_API_KEY?.trim();
  if (!key) {
    key = randomBytes(24).toString("base64url");
    process.env.STT_API_KEY = key;
    console.warn("[stt] STT_API_KEY was empty; generated a local in-memory key.");
  }

  const host = "127.0.0.1";
  const port = (process.env.STT_LOCAL_PORT ?? "8000").trim();
  const model = (process.env.STT_LOCAL_MODEL ?? "base").trim();
  const configuredHome = process.env.WHISPER_API_HOME?.trim();
  const home = configuredHome
    ? path.isAbsolute(configuredHome)
      ? configuredHome
      : path.resolve(projectRoot, configuredHome)
    : path.join(projectRoot, "data", "whisper-api");

  try {
    child = Bun.spawn(
      [
        ...executable(),
        "start",
        "--host",
        host,
        "--port",
        port,
        "--model",
        model,
        "--engine",
        "onnx",
      ],
      {
        cwd: projectRoot,
        env: { ...process.env, WHISPER_API_KEY: key, WHISPER_API_HOME: home },
        stdin: "ignore",
        // whisper-api prints an example command containing the configured key
        // during startup. Keep that local secret out of systemd's journal.
        stdout: "ignore",
        stderr: "inherit",
      },
    );

    console.log(`[stt] local Whisper starting on http://${host}:${port} (model ${model})`);
    void child.exited.then((code) => {
      child = null;
      if (stopping) return;
      console.error(`[stt] local Whisper exited with code ${code}; restarting in 3s`);
      scheduleRestart();
    });
  } catch (error) {
    console.error("[stt] failed to start local Whisper:", error);
    scheduleRestart();
  }
}

export function startLocalStt() {
  if (started || !localSttEnabled()) return;
  started = true;
  stopping = false;
  spawnLocalStt();
}

export function stopLocalStt() {
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = null;
  child?.kill();
  child = null;
}
