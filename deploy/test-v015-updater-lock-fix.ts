import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync("packages/desktop/electron/local-runtime.ts", "utf8");
const main = readFileSync("packages/desktop/electron/main.ts", "utf8");

assert.match(runtime, /stopExistingNorviRuntimeProcess/);
assert.match(runtime, /Get-NetTCPConnection -LocalPort 4200/);
assert.match(runtime, /packages\[\\\\\/\]web/);
assert.match(runtime, /taskkill\.exe \/PID/);
assert.match(runtime, /removeRuntimeDirectory/);
assert.match(runtime, /maxRetries: 2/);
assert.match(runtime, /code !== "EBUSY"/);

const stopIndex = runtime.indexOf("await stopExistingNorviRuntimeProcess()");
const preserveIndex = runtime.indexOf("await preserveLocalData(runtime, backupPath)");
const removeIndex = runtime.indexOf("await removeRuntimeDirectory(runtime)");
assert.ok(stopIndex >= 0 && preserveIndex > stopIndex && removeIndex > preserveIndex);

const launchIndex = main.indexOf("await shell.openPath(destination)");
const quitIndex = main.indexOf("app.quit()", launchIndex);
const stopServerIndex = main.indexOf("stopLocalServer()", launchIndex);
assert.ok(launchIndex >= 0 && stopServerIndex > launchIndex && quitIndex > stopServerIndex);
assert.match(main.slice(launchIndex, quitIndex + 20), /setTimeout/);

console.log("v0.1.5 updater lock hotfix wiring: OK");
