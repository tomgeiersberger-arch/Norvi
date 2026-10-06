import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stt = readFileSync("packages/web/src/api/lib/stt.ts", "utf8");
const setup = readFileSync("deploy/setup-local.ts", "utf8");
const listener = readFileSync(
  "packages/web/src/web/components/desktop-assistant-listener.tsx",
  "utf8",
);
const page = readFileSync("packages/web/src/web/pages/index.tsx", "utf8");
const maintenance = readFileSync(
  "packages/web/src/web/components/desktop-maintenance-panel.tsx",
  "utf8",
);
const preload = readFileSync("packages/desktop/electron/preload.ts", "utf8");
const ipc = readFileSync("packages/desktop/electron/ipc.ts", "utf8");

assert.match(stt, /sanitiseTranscription/);
assert.match(stt, /repeats > 3/);
assert.match(setup, /migratedSttModel/);
assert.match(setup, /currentSttModel === "tiny"/);

assert.match(listener, /dispatchVoiceStatus\("listening"\)/);
assert.match(listener, /dispatchVoiceStatus\("processing"\)/);
assert.match(listener, /dispatchVoiceStatus\("command"\)/);
assert.match(page, /Höre zu/);
assert.match(page, /Verarbeite/);
assert.match(page, /Befehl erkannt/);
assert.doesNotMatch(page, /Mic2/);
assert.doesNotMatch(page, /Spracheingabe verfügbar/);

assert.match(maintenance, /saveTextFile/);
assert.match(preload, /dialog:save-text/);
assert.match(ipc, /dialog:save-text/);
assert.match(ipc, /writeFile/);

console.log("v0.1.4 voice and diagnostics fixes: OK");
