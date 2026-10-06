import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync("packages/desktop/electron/local-runtime.ts", "utf8");

assert.match(runtime, /const managedPid = serverProcess\?\.pid/);
assert.match(runtime, /taskkill\.exe.*\/PID.*managedPid.*\/T.*\/F/s);
assert.match(runtime, /runtimePattern/);
assert.match(runtime, /Get-CimInstance Win32_Process/);
assert.match(runtime, /CommandLine.*-match.*runtimePattern/s);
assert.match(runtime, /taskkill\.exe.*\/PID.*ProcessId.*\/T.*\/F/s);

const captureIndex = runtime.indexOf("const managedPid = serverProcess?.pid");
const stopIndex = runtime.indexOf("stopLocalServer()", captureIndex);
const scanIndex = runtime.indexOf("Get-CimInstance Win32_Process", captureIndex);
assert.ok(captureIndex >= 0, "managed NORVI PID must be captured before shutdown");
assert.ok(stopIndex > captureIndex, "managed PID must be captured before stopLocalServer clears it");
assert.ok(scanIndex > stopIndex, "runtime-path process scan must run after managed shutdown");

console.log("v0.1.6 runtime child lock regression wiring: OK");
