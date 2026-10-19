import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ACTIVE_POINTER = ".norvi-active-runtime";
const FAILURE_MARKER = ".norvi-runtime-update-failure.json";
const RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const markerPath = (userData: string) => path.join(userData, FAILURE_MARKER);

/** Do not repeatedly retry a broken update at every Windows startup. */
export async function runtimeUpdateInCooldown(
  userData: string,
  version: string,
  now = Date.now(),
): Promise<boolean> {
  try {
    const marker = JSON.parse(await fs.readFile(markerPath(userData), "utf8")) as {
      version?: unknown;
      failedAt?: unknown;
    };
    return (
      marker.version === version &&
      typeof marker.failedAt === "number" &&
      Number.isFinite(marker.failedAt) &&
      marker.failedAt <= now &&
      now - marker.failedAt < RETRY_COOLDOWN_MS
    );
  } catch {
    return false;
  }
}

export async function recordRuntimeUpdateFailure(
  userData: string,
  version: string,
  now = Date.now(),
): Promise<void> {
  await fs.mkdir(userData, { recursive: true });
  await fs.writeFile(
    markerPath(userData),
    JSON.stringify({ version, failedAt: now }) + "\n",
    "utf8",
  );
}

export async function clearRuntimeUpdateFailure(userData: string): Promise<void> {
  await fs.rm(markerPath(userData), { force: true });
}

/** Restore only an installed NORVI runtime within userData, never arbitrary paths. */
export async function restorePreviousRuntime(
  userData: string,
  previousRuntime: string,
): Promise<void> {
  const root = path.resolve(userData);
  const previous = path.resolve(previousRuntime);
  const name = path.basename(previous);
  if (path.dirname(previous) !== root ||
      (name !== "runtime" && !/^runtime-v[0-9A-Za-z._-]+$/.test(name))) {
    throw new Error("Ungültiges NORVI-Rollback-Ziel.");
  }

  await Promise.all([
    fs.access(path.join(previous, ".env")),
    fs.access(path.join(previous, "packages", "web", "dist", "index.html")),
  ]);

  const pointer = path.join(root, ACTIVE_POINTER);
  if (name === "runtime") {
    await fs.rm(pointer, { force: true });
    return;
  }

  const temporary = pointer + ".rollback-" + randomUUID();
  await fs.writeFile(temporary, name + "\n", "utf8");
  try {
    try {
      await fs.rename(temporary, pointer);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST" && code !== "EPERM") throw error;
      await fs.rm(pointer, { force: true });
      await fs.rename(temporary, pointer);
    }
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}
