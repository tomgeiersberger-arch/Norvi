import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preload = readFileSync("packages/desktop/electron/preload.ts", "utf8");
const ipc = readFileSync("packages/desktop/electron/ipc.ts", "utf8");
const main = readFileSync("packages/desktop/electron/main.ts", "utf8");

assert.doesNotMatch(preload, /ipcRenderer\.invoke\("fs:(?:read|write)"/);
assert.doesNotMatch(preload, /readFile:\s*\(/);
assert.doesNotMatch(preload, /writeFile:\s*\(/);
assert.doesNotMatch(ipc, /ipcMain\.handle\("fs:(?:read|write)"/);

assert.match(main, /sandbox:\s*true/);
assert.match(main, /setWindowOpenHandler/);
assert.match(main, /will-navigate/);
assert.match(main, /https?:/);
assert.match(main, /action:\s*"deny"/);

console.log("desktop security hardening: OK");