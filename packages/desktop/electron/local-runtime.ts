import { app, net } from "electron";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import { cpus, homedir, totalmem } from "node:os";
import path from "node:path";

export type ProfileName = "lite" | "standard" | "power";

export interface HardwareProfile {
  cpu: string;
  threads: number;
  ramGiB: number;
  nvidiaVramGiB: number | null;
  profile: ProfileName;
  label: string;
}

export interface SetupProgress {
  stage: string;
  message: string;
  percent?: number;
}

export interface RuntimeCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

let serverProcess: ChildProcessWithoutNullStreams | null = null;

export function runtimeDirectory(): string {
  return path.join(app.getPath("userData"), "runtime");
}

function nvidiaVramGiB(): number | null {
  for (const command of process.platform === "win32" ? ["nvidia-smi.exe", "nvidia-smi"] : ["nvidia-smi"]) {
    try {
      const raw = execFileSync(
        command,
        ["--query-gpu=memory.total", "--format=csv,noheader,nounits"],
        { encoding: "utf8", windowsHide: true },
      );
      const values = raw
        .split(/\r?\n/)
        .map(Number)
        .filter(Number.isFinite);
      if (values.length) return Math.max(...values) / 1024;
    } catch {
      // No supported NVIDIA tool on this machine.
    }
  }
  return null;
}

export function detectHardware(): HardwareProfile {
  const ramGiB = totalmem() / 1024 ** 3;
  const vram = nvidiaVramGiB();
  const threads = cpus().length;
  const profile: ProfileName =
    (vram ?? 0) >= 14
      ? "power"
      : (vram ?? 0) >= 7 || (ramGiB >= 24 && threads >= 8)
        ? "standard"
        : "lite";
  const label = profile === "power" ? "Power · 14B" : profile === "standard" ? "Standard · 8B" : "Lite · 4B";

  return {
    cpu: cpus()[0]?.model ?? "Unknown CPU",
    threads,
    ramGiB,
    nvidiaVramGiB: vram,
    profile,
    label,
  };
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function runtimeReady(): Promise<boolean> {
  const root = runtimeDirectory();
  return (
    (await exists(path.join(root, ".env"))) &&
    (await exists(path.join(root, "packages", "web", "dist", "index.html")))
  );
}

export async function runtimeNeedsUpdate(): Promise<boolean> {
  if (!(await runtimeReady())) return false;
  try {
    const installedVersion = (await fs.readFile(path.join(runtimeDirectory(), ".norvi-version"), "utf8")).trim();
    return installedVersion !== app.getVersion();
  } catch {
    return true;
  }
}

function powershellQuote(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

async function runProcess(
  command: string,
  args: string[],
  cwd: string | undefined,
  onLine: (line: string) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      windowsHide: true,
      shell: false,
    });

    const push = (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        const ansi = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");
        const clean = line.replace(ansi, "").trim();
        if (clean) onLine(clean);
      }
    };
    child.stdout.on("data", push);
    child.stderr.on("data", push);
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} wurde mit Code ${code ?? "?"} beendet.`));
    });
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopStaleRuntimeProcesses(runtime: string): Promise<void> {
  // Stop the child tracked by this Electron process first.
  stopLocalServer();

  if (process.platform !== "win32") return;

  // A previous NORVI process can leave Bun/Whisper running after an update or
  // crash. Only terminate processes that both own NORVI's local ports and have
  // command lines matching NORVI/Whisper, so unrelated local services are left
  // alone.
  let sttPort = 8000;
  try {
    const env = await fs.readFile(path.join(runtime, ".env"), "utf8");
    const match = env.match(/^STT_LOCAL_PORT=(\d+)\s*$/m);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) sttPort = parsed;
    }
  } catch {
    // Fresh install or incomplete runtime: use the default STT port.
  }

  const script = [
    `$ports=@(4200,${sttPort})`,
    "$ids=@()",
    "try{$ids=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $ports -contains $_.LocalPort } | Select-Object -ExpandProperty OwningProcess -Unique)}catch{}",
    "foreach($id in $ids){",
    "  $p=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $id) -ErrorAction SilentlyContinue",
    "  if(-not $p){continue}",
    "  $cmd=[string]$p.CommandLine",
    "  if($cmd -match 'packages[\\\\/]web[\\\\/]src[\\\\/]__server\\.ts' -or $cmd -match 'whisper-api'){",
    "    try{Stop-Process -Id $id -Force -ErrorAction Stop}catch{}",
    "  }",
    "}",
  ].join(";");

  try {
    await runProcess(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      undefined,
      () => {},
    );
  } catch {
    // Retry logic below still handles a transient or already-exited process.
  }
}

async function removeRuntimeForInstall(
  runtime: string,
  onProgress: (progress: SetupProgress) => void,
): Promise<void> {
  await stopStaleRuntimeProcesses(runtime);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fs.rm(runtime, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code !== "EBUSY" && code !== "EPERM" && code !== "ENOTEMPTY") throw error;

      onProgress({
        stage: "prepare",
        message: "Alte NORVI-Prozesse werden beendet und Dateien freigegeben…",
        percent: 26,
      });
      await stopStaleRuntimeProcesses(runtime);
      await sleep(300 + attempt * 250);
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "");
  throw new Error(
    "Die lokale NORVI-Runtime ist noch von einem Prozess gesperrt. " +
      "Bitte NORVI vollständig schließen und erneut versuchen. " +
      detail,
  );
}

async function downloadReleaseSource(destination: string): Promise<void> {
  const ref = `v${app.getVersion()}`;
  const url = `https://github.com/tomgeiersberger-arch/Norvi/archive/refs/tags/${ref}.zip`;
  const response = await net.fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(
      `NORVI ${ref} konnte nicht geladen werden (HTTP ${response.status}). Der GitHub-Release muss denselben Tag wie der Installer haben.`,
    );
  }
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function preserveLocalData(root: string, backup: string): Promise<void> {
  await fs.mkdir(backup, { recursive: true });
  const envPath = path.join(root, ".env");
  const dataPath = path.join(root, "data");
  if (await exists(envPath)) await fs.copyFile(envPath, path.join(backup, ".env"));
  if (await exists(dataPath)) {
    await fs.cp(dataPath, path.join(backup, "data"), { recursive: true });
  }
}

async function restoreLocalData(root: string, backup: string): Promise<void> {
  const envPath = path.join(backup, ".env");
  const dataPath = path.join(backup, "data");
  if (await exists(envPath)) await fs.copyFile(envPath, path.join(root, ".env"));
  if (await exists(dataPath)) {
    await fs.rm(path.join(root, "data"), { recursive: true, force: true });
    await fs.cp(dataPath, path.join(root, "data"), { recursive: true });
  }
}

export async function installRuntime(
  profile: ProfileName,
  onProgress: (progress: SetupProgress) => void,
): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Der grafische NORVI-Installer ist aktuell für Windows vorgesehen.");
  }

  const tempRoot = path.join(app.getPath("temp"), `norvi-setup-${Date.now()}`);
  const zipPath = path.join(tempRoot, "norvi.zip");
  const extractPath = path.join(tempRoot, "source");
  const backupPath = path.join(tempRoot, "backup");
  const runtime = runtimeDirectory();

  try {
    await fs.mkdir(tempRoot, { recursive: true });
    onProgress({ stage: "download", message: "NORVI wird von GitHub geladen…", percent: 8 });
    await downloadReleaseSource(zipPath);

    onProgress({ stage: "extract", message: "Installationsdateien werden vorbereitet…", percent: 18 });
    await fs.mkdir(extractPath, { recursive: true });
    const expand = `Expand-Archive -LiteralPath ${powershellQuote(zipPath)} -DestinationPath ${powershellQuote(extractPath)} -Force`;
    await runProcess("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", expand], undefined, () => {});

    const entries = (await fs.readdir(extractPath, { withFileTypes: true })).filter((entry) => entry.isDirectory());
    if (entries.length !== 1) throw new Error("Das NORVI-Archiv hat ein unerwartetes Format.");
    const extractedRoot = path.join(extractPath, entries[0]!.name);

    onProgress({ stage: "prepare", message: "Lokale NORVI-Daten werden vorbereitet…", percent: 25 });
    if (await exists(runtime)) await preserveLocalData(runtime, backupPath);
    await removeRuntimeForInstall(runtime, onProgress);
    await fs.mkdir(path.dirname(runtime), { recursive: true });
    await fs.cp(extractedRoot, runtime, { recursive: true });
    await restoreLocalData(runtime, backupPath);

    onProgress({
      stage: "models",
      message: `${profile === "power" ? "14B" : profile === "standard" ? "8B" : "4B"}-Profil wird lokal eingerichtet. Der erste Download kann dauern…`,
      percent: 32,
    });

    const setupScript = path.join(runtime, "deploy", "install-local.ps1");
    await runProcess(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        setupScript,
        `--profile=${profile}`,
      ],
      runtime,
      (line) => onProgress({ stage: "install", message: line, percent: 55 }),
    );

    await fs.writeFile(path.join(runtime, ".norvi-version"), app.getVersion() + "\n", "utf8");
    onProgress({ stage: "done", message: "NORVI ist installiert und offline bereit.", percent: 100 });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

function bunExecutable(): string {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(homedir(), ".bun", "bin", "bun.exe"),
          path.join(process.env.USERPROFILE ?? homedir(), ".bun", "bin", "bun.exe"),
        ]
      : [path.join(homedir(), ".bun", "bin", "bun")];

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore", windowsHide: true });
      return candidate;
    } catch {
      // Try the next known Bun location.
    }
  }
  return process.platform === "win32" ? "bun.exe" : "bun";
}

async function healthFetch(
  url: string,
  headers?: Record<string, string>,
  timeoutMs = 1500,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await net.fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runtimeEnvValues(): Promise<Record<string, string>> {
  try {
    const source = await fs.readFile(path.join(runtimeDirectory(), ".env"), "utf8");
    const values: Record<string, string> = {};
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index <= 0) continue;
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    }
    return values;
  } catch {
    return {};
  }
}

async function ollamaHealthOk(): Promise<boolean> {
  try {
    const response = await healthFetch("http://127.0.0.1:11434/api/tags");
    return response.ok;
  } catch {
    return false;
  }
}

async function sttHealthOk(): Promise<boolean> {
  try {
    const env = await runtimeEnvValues();
    const port = env.STT_LOCAL_PORT?.trim() || "8000";
    const base = (env.STT_BASE_URL?.trim() || `http://127.0.0.1:${port}/v1`).replace(
      /\/+$/,
      "",
    );
    const key = env.STT_API_KEY?.trim();
    const response = await healthFetch(
      `${base}/models`,
      key ? { Authorization: `Bearer ${key}` } : undefined,
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function startOllamaIfNeeded(): Promise<void> {
  if (await ollamaHealthOk()) return;

  const candidates =
    process.platform === "win32"
      ? [
          path.join(
            process.env.LOCALAPPDATA ?? "",
            "Programs",
            "Ollama",
            "ollama.exe",
          ),
          "ollama.exe",
        ]
      : ["ollama"];

  let started = false;
  for (const command of candidates) {
    const launched = await new Promise<boolean>((resolve) => {
      const child = spawn(command, ["serve"], {
        detached: true,
        windowsHide: true,
        stdio: "ignore",
        shell: false,
      });
      let settled = false;
      child.once("error", () => {
        if (settled) return;
        settled = true;
        resolve(false);
      });
      child.once("spawn", () => {
        if (settled) return;
        settled = true;
        child.unref();
        resolve(true);
      });
    });
    if (launched) {
      started = true;
      break;
    }
  }
  if (!started) throw new Error("Ollama konnte nicht gestartet werden.");

  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    if (await ollamaHealthOk()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Ollama antwortet nach dem Start nicht.");
}

async function localHealthOk(): Promise<boolean> {
  try {
    const response = await healthFetch("http://127.0.0.1:4200/api/health");
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(expectedProcess?: ChildProcessWithoutNullStreams): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (await localHealthOk()) return;
    if (
      expectedProcess &&
      (expectedProcess.exitCode !== null || expectedProcess.signalCode !== null)
    ) {
      throw new Error("NORVI Server wurde beim Start unerwartet beendet.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("NORVI konnte nicht innerhalb von 90 Sekunden gestartet werden.");
}

export async function startLocalServer(
  onProgress?: (progress: SetupProgress) => void,
): Promise<void> {
  if (await localHealthOk()) return;
  if (!(await runtimeReady())) throw new Error("NORVI ist noch nicht vollständig installiert.");

  const root = runtimeDirectory();
  const bun = bunExecutable();
  onProgress?.({ stage: "start", message: "NORVI wird gestartet…", percent: 96 });

  const child = spawn(
    bun,
    ["--env-file=.env", "packages/web/src/__server.ts"],
    {
      cwd: root,
      env: { ...process.env, NODE_ENV: "production", PORT: "4200" },
      windowsHide: true,
      shell: false,
    },
  );
  serverProcess = child;

  child.stdout.on("data", (chunk: Buffer) => {
    const line = chunk.toString("utf8").trim();
    if (line) onProgress?.({ stage: "start", message: line, percent: 97 });
  });
  child.stderr.on("data", (chunk: Buffer) => {
    const line = chunk.toString("utf8").trim();
    if (line) onProgress?.({ stage: "start", message: line, percent: 97 });
  });
  child.once("exit", () => {
    if (serverProcess === child) serverProcess = null;
  });

  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", (error) => {
      if (serverProcess === child) serverProcess = null;
      reject(
        new Error(
          "NORVI Server konnte nicht gestartet werden: " +
            (error instanceof Error ? error.message : String(error)),
        ),
      );
    });
  });

  await waitForServer(child);
}

export function stopLocalServer(): void {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill();
  serverProcess = null;
}

export async function runRuntimeSelfTest(): Promise<RuntimeCheck[]> {
  const runtime = await runtimeReady();
  const [ollamaOk, norviOk, sttOk] = await Promise.all([
    ollamaHealthOk(),
    localHealthOk(),
    sttHealthOk(),
  ]);

  let bunOk = false;
  try {
    execFileSync(bunExecutable(), ["--version"], {
      stdio: "ignore",
      windowsHide: true,
    });
    bunOk = true;
  } catch {
    bunOk = false;
  }

  return [
    {
      id: "runtime",
      label: "NORVI-Dateien",
      ok: runtime,
      detail: runtime ? "Runtime vollständig" : "Runtime unvollständig",
    },
    {
      id: "bun",
      label: "Bun",
      ok: bunOk,
      detail: bunOk ? "Bun ausführbar" : "Bun nicht gefunden",
    },
    {
      id: "ollama",
      label: "Ollama",
      ok: ollamaOk,
      detail: ollamaOk ? "Ollama API erreichbar" : "Ollama API offline",
    },
    {
      id: "norvi",
      label: "NORVI Server",
      ok: norviOk,
      detail: norviOk ? "Port 4200 bereit" : "Lokaler Server offline",
    },
    {
      id: "stt",
      label: "Speech-to-Text",
      ok: sttOk,
      detail: sttOk ? "Lokaler STT-Dienst erreichbar" : "STT-Dienst offline",
    },
  ];
}

export async function repairLocalRuntime(): Promise<RuntimeCheck[]> {
  if (!(await runtimeReady())) {
    throw new Error("NORVI Runtime ist unvollständig. Bitte die Installation erneut ausführen.");
  }

  await startOllamaIfNeeded();

  const needsSttRestart = !(await sttHealthOk());
  if (needsSttRestart && serverProcess && !serverProcess.killed) {
    stopLocalServer();
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  if (!(await localHealthOk())) {
    await startLocalServer();
  }

  if (needsSttRestart) {
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      if (await sttHealthOk()) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return runRuntimeSelfTest();
}
