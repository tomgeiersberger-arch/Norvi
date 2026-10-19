import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  clearRuntimeUpdateFailure,
  recordRuntimeUpdateFailure,
  restorePreviousRuntime,
  runtimeUpdateInCooldown,
} from "../packages/desktop/electron/runtime-recovery";

const userData = await fs.mkdtemp(path.join(os.tmpdir(), "norvi-v018-test-"));
const pointer = path.join(userData, ".norvi-active-runtime");
async function healthy(name: string): Promise<string> {
  const root = path.join(userData, name);
  await fs.mkdir(path.join(root, "packages", "web", "dist"), { recursive: true });
  await fs.writeFile(path.join(root, ".env"), "LOCAL_ONLY_MODE=true\n");
  await fs.writeFile(path.join(root, "packages", "web", "dist", "index.html"), "ok");
  return root;
}

try {
  const old = await healthy("runtime-v0.1.7-previous");
  const next = await healthy("runtime-v0.1.8-new");
  await fs.writeFile(pointer, path.basename(next) + "\n");
  await restorePreviousRuntime(userData, old);
  assert.equal((await fs.readFile(pointer, "utf8")).trim(), path.basename(old));
  await fs.access(next);

  const legacy = await healthy("runtime");
  await restorePreviousRuntime(userData, legacy);
  await assert.rejects(fs.access(pointer), { code: "ENOENT" });
  await assert.rejects(
    restorePreviousRuntime(userData, path.join(userData, "..", "outside")),
    /Ungültiges NORVI-Rollback-Ziel/,
  );
  const incomplete = path.join(userData, "runtime-v0.1.5-incomplete");
  await fs.mkdir(incomplete);
  await assert.rejects(restorePreviousRuntime(userData, incomplete));
  await assert.rejects(fs.access(pointer), { code: "ENOENT" });

  const now = Date.parse("2026-10-19T18:00:00Z");
  await recordRuntimeUpdateFailure(userData, "0.1.8", now);
  assert.equal(await runtimeUpdateInCooldown(userData, "0.1.8", now + 1000), true);
  assert.equal(await runtimeUpdateInCooldown(userData, "0.1.9", now + 1000), false);
  assert.equal(await runtimeUpdateInCooldown(userData, "0.1.8", now + 25 * 60 * 60 * 1000), false);
  await clearRuntimeUpdateFailure(userData);
  assert.equal(await runtimeUpdateInCooldown(userData, "0.1.8", now + 1000), false);
  console.log("v0.1.8 runtime recovery regression: OK");
} finally {
  await fs.rm(userData, { recursive: true, force: true });
}
