import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync("packages/desktop/electron/local-runtime.ts", "utf8");

assert.match(runtime, /ACTIVE_RUNTIME_POINTER/);
assert.match(runtime, /atomicRuntimeDirectory/);
assert.match(runtime, /runtime-v/);
assert.match(runtime, /writeFile\([^\n]*ACTIVE_RUNTIME_POINTER/);
assert.match(runtime, /rename\([^\n]*ACTIVE_RUNTIME_POINTER/);

const installIndex = runtime.indexOf("export async function installRuntime");
const installBody = runtime.slice(installIndex, runtime.indexOf("\nfunction bunExecutable", installIndex));
assert.ok(installIndex >= 0, "installRuntime must exist");
assert.match(installBody, /const previousRuntime = runtimeDirectory\(\)/);
assert.match(installBody, /const runtime = atomicRuntimeDirectory\(\)/);
assert.match(installBody, /preserveLocalData\(previousRuntime, backupPath\)/);
assert.doesNotMatch(installBody, /removeRuntimeDirectory\(previousRuntime\)/);
assert.match(installBody, /activateRuntimeDirectory\(runtime\)/);

console.log("v0.1.7 atomic runtime switch regression: OK");
