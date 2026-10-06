import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync("packages/desktop/electron/local-runtime.ts", "utf8");
const main = readFileSync("packages/desktop/electron/main.ts", "utf8");
const pkg = JSON.parse(readFileSync("packages/desktop/package.json", "utf8")) as { version?: string };

function atLeast(current: string, minimum: string): boolean {
  const parse = (value: string) => value.split(".").map((part) => Number(part) || 0);
  const left = parse(current);
  const right = parse(minimum);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}

assert.ok(pkg.version && atLeast(pkg.version, "0.1.5"));
assert.match(runtime, /stopExistingNorviRuntimeProcess/);
assert.match(runtime, /Get-NetTCPConnection/);
assert.match(runtime, /taskkill\.exe \/PID/);
assert.match(runtime, /removeRuntimeDirectory/);
assert.match(runtime, /code !== "EBUSY"/);

const launchIndex = main.indexOf("await shell.openPath(destination)");
const quitIndex = main.indexOf("app.quit()", launchIndex);
const stopServerIndex = main.indexOf("stopLocalServer()", launchIndex);
assert.ok(launchIndex >= 0 && stopServerIndex > launchIndex && quitIndex > stopServerIndex);
assert.match(main.slice(launchIndex, quitIndex + 20), /setTimeout/);

console.log("v0.1.5 updater lock regression remains covered: OK");
