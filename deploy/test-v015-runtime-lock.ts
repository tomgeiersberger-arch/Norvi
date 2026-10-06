import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync("packages/desktop/electron/local-runtime.ts", "utf8");
const main = readFileSync("packages/desktop/electron/main.ts", "utf8");
const pkg = JSON.parse(readFileSync("packages/desktop/package.json", "utf8")) as { version?: string };

assert.equal(pkg.version, "0.1.5");
assert.match(runtime, /stopStaleRuntimeProcesses/);
assert.match(runtime, /removeRuntimeForInstall/);
assert.match(runtime, /Get-NetTCPConnection/);
assert.match(runtime, /EBUSY/);
assert.match(runtime, /EPERM/);
assert.match(runtime, /ENOTEMPTY/);
assert.match(runtime, /Alte NORVI-Prozesse werden beendet/);
assert.match(main, /stopLocalServer\(\)/);
assert.match(main, /Release the local runtime before the new installer starts/);

console.log("v0.1.5 runtime lock hotfix: OK");
