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
const voice = readFileSync("packages/desktop/electron/voice.ts", "utf8");
const actions = readFileSync("packages/desktop/electron/actions.ts", "utf8");
const settings = readFileSync(
  "packages/web/src/web/components/settings-dialog.tsx",
  "utf8",
);
const composer = readFileSync(
  "packages/web/src/web/components/chat/composer.tsx",
  "utf8",
);
const errorLog = readFileSync(
  "packages/web/src/web/lib/local-error-log.ts",
  "utf8",
);

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

assert.match(voice, /SAPI\.SpVoice/);
assert.match(voice, /GetVoices/);
assert.match(settings, /voicePreviewError/);
assert.match(actions, /scanDesktopActionsInFolder/);
assert.match(settings, /Ordner scannen/);

assert.match(listener, /const handle = await startRecording/);
assert.match(listener, /activeHandle === handle/);
assert.match(listener, /voiceAvailable \? "ready" : "off"/);
assert.match(composer, /!recording/);
assert.match(composer, /2600/);
assert.match(composer, /Live Screen beendet/);
assert.match(composer, /!transcribing/);
assert.match(errorLog, /LOCAL_ERROR_LOG_EVENT/);
assert.match(maintenance, /LOCAL_ERROR_LOG_EVENT/);

console.log("v0.1.4 voice and diagnostics fixes: OK");
