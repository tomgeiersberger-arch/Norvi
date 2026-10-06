import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const assistant = readFileSync("packages/web/src/web/lib/desktop-assistant.ts", "utf8");
const page = readFileSync("packages/web/src/web/pages/index.tsx", "utf8");
const recorder = readFileSync("packages/web/src/web/lib/recorder.ts", "utf8");
const composer = readFileSync("packages/web/src/web/components/chat/composer.tsx", "utf8");
const runtime = readFileSync("packages/desktop/electron/local-runtime.ts", "utf8");
const mobileMedia = readFileSync("packages/mobile/lib/media.ts", "utf8");
const firstRun = readFileSync("packages/web/src/web/components/first-run-wizard.tsx", "utf8");
const settings = readFileSync("packages/web/src/web/components/settings-dialog.tsx", "utf8");

assert.match(assistant, /currentVoiceStatus/);
assert.match(assistant, /getVoiceStatus/);
assert.match(assistant, /currentVoiceStatus = status/);
assert.match(page, /useState<VoiceListenStatus>\(getVoiceStatus\)/);
assert.doesNotMatch(page, /effectiveVoiceStatus/);

assert.match(recorder, /stopPromise/);
assert.match(recorder, /if \(stopPromise\) return stopPromise/);
assert.match(composer, /recordingStartingRef/);
assert.match(composer, /recordingStarting/);

assert.match(runtime, /rollbackPath/);
assert.match(runtime, /previousRuntime/);
assert.match(runtime, /vorherige NORVI-Runtime wurde wiederhergestellt/);

assert.match(mobileMedia, /fetchWithTimeout/);
assert.match(mobileMedia, /controller\.abort\(\)/);
assert.match(mobileMedia, /35_000/);

assert.match(firstRun, /\.catch\(\(\) => undefined\)[\s\S]*\.finally/);
assert.match(settings, /removeCustomDesktopAction\(action\.id\)[\s\S]*\.then\(\(removed\)/);
assert.match(settings, /setBackgroundMode[\s\S]*\.catch\(\(\) => undefined\)/);

console.log("post-v0.1.4 reliability audit: OK");
