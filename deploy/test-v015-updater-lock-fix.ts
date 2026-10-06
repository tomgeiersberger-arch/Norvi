import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync("packages/desktop/electron/local-runtime.ts", "utf8");
const main = readFileSync("packages/desktop/electron/main.ts", "utf8");

assert.match(runtime, /stopExistingNorviRuntimeProcess/);
assert.match(runtime, /Get-NetTCPConnection -LocalPort 4200/);
assert.match(runtime, /packages\[\\\\\/\]web/);
assert.match(runtime, /taskkill\.exe \/PID/);

const stopIndex = runtime.indexOf("await stopExistingNorviRuntimeProcess()");
const preserveMatch = runtime.match(/await preserveLocalData\((?:runtime|previousRuntime), backupPath\)/);
const preserveIndex = preserveMatch?.index ?? -1;
assert.ok(stopIndex >= 0 && preserveIndex > stopIndex);

const launchIndex = main.indexOf("await shell.openPath(destination)");
const quitIndex = main.indexOf("app.quit()", launchIndex);
const stopServerIndex = main.indexOf("stopLocalServer()", launchIndex);
assert.ok(launchIndex >= 0 && stopServerIndex > launchIndex && quitIndex > stopServerIndex);
assert.match(main.slice(launchIndex, quitIndex + 20), /setTimeout/);

console.log("v0.1.5 updater shutdown regression: OK");
