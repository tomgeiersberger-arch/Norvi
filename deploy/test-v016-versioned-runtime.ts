import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync("packages/desktop/electron/local-runtime.ts", "utf8");
const pkg = JSON.parse(readFileSync("packages/desktop/package.json", "utf8")) as { version?: string };
const lock = readFileSync("bun.lock", "utf8");

assert.equal(pkg.version, "0.1.6");
assert.match(lock, /"packages\/desktop": \{[\s\S]*?"version": "0\.1\.6"/);

assert.match(runtime, /runtimeBaseDirectory/);
assert.match(runtime, /runtimes/);
assert.match(runtime, /v\$\{app\.getVersion\(\)\}/);
assert.match(runtime, /legacyRuntimeDirectory/);
assert.match(runtime, /migrationRuntimeDirectory/);
assert.match(runtime, /previous runtime is intentionally left untouched/i);

assert.match(runtime, /stopExistingNorviRuntimeProcess\(runtimeRoots/);
assert.match(runtime, /whisper-api/);
assert.match(runtime, /Get-NetTCPConnection -State Listen/);
assert.match(runtime, /taskkill\.exe \/PID/);

const sourceIndex = runtime.indexOf("const migrationSource = await migrationRuntimeDirectory(runtime)");
const preserveIndex = runtime.indexOf("await preserveLocalData(migrationSource, backupPath)");
const copyIndex = runtime.indexOf("await fs.cp(extractedRoot, runtime");
assert.ok(sourceIndex >= 0 && preserveIndex > sourceIndex && copyIndex > preserveIndex);

const oldDelete = runtime.indexOf("await removeRuntimeDirectory(migrationSource)");
assert.equal(oldDelete, -1, "Old runtime must not be deleted during v0.1.6 migration");

console.log("v0.1.6 versioned runtime updater: OK");
