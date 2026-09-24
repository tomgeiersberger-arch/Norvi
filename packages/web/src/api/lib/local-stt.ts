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

const projectRoot = decodeURIComponent(
  new URL("../../../../../", import.meta.url).pathname,
).replace(/\/$/, "");

function localSttEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test((process.env.STT_LOCAL_ENABLED ?? "").trim());
}

function executable(): string {
  return (
    process.env.STT_LOCAL_BIN?.trim() ||
    `${projectRoot}/packages/web/node_modules/.bin/whisper-api`
  );
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

  const key = process.env.STT_API_KEY?.trim();
  if (!key) {
    console.warn("[stt] STT_LOCAL_ENABLED=true but STT_API_KEY is empty; local STT not started.");
    return;
  }

  const host = "127.0.0.1";
  const port = (process.env.STT_LOCAL_PORT ?? "8000").trim();
  const model = (process.env.STT_LOCAL_MODEL ?? "tiny").trim();
  const configuredHome = process.env.WHISPER_API_HOME?.trim();
  const home = configuredHome
    ? configuredHome.startsWith("/")
      ? configuredHome
      : `${projectRoot}/${configuredHome}`
    : `${projectRoot}/data/whisper-api`;

  try {
    child = Bun.spawn(
      [
        executable(),
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
