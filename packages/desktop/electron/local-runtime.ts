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
    await fs.rm(runtime, { recursive: true, force: true });
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

async function localHealthOk(): Promise<boolean> {
  try {
    const response = await net.fetch("http://127.0.0.1:4200/api/health");
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (await localHealthOk()) return;
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

  serverProcess = spawn(
    bun,
    ["--env-file=.env", "packages/web/src/__server.ts"],
    {
      cwd: root,
      env: { ...process.env, NODE_ENV: "production", PORT: "4200" },
      windowsHide: true,
      shell: false,
    },
  );

  serverProcess.stdout.on("data", (chunk: Buffer) => {
    const line = chunk.toString("utf8").trim();
    if (line) onProgress?.({ stage: "start", message: line, percent: 97 });
  });
  serverProcess.stderr.on("data", (chunk: Buffer) => {
    const line = chunk.toString("utf8").trim();
    if (line) onProgress?.({ stage: "start", message: line, percent: 97 });
  });
  serverProcess.once("exit", () => {
    serverProcess = null;
  });

  await waitForServer();
}

export function stopLocalServer(): void {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill();
  serverProcess = null;
}
