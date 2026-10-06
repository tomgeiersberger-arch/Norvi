import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("packages/web/src/web/pages/index.tsx", "utf8");
const assistant = readFileSync("packages/web/src/web/lib/desktop-assistant.ts", "utf8");
const recorder = readFileSync("packages/web/src/web/lib/recorder.ts", "utf8");
const listener = readFileSync("packages/web/src/web/components/desktop-assistant-listener.tsx", "utf8");
const settings = readFileSync("packages/web/src/web/components/settings-dialog.tsx", "utf8");
const composer = readFileSync("packages/web/src/web/components/chat/composer.tsx", "utf8");
const desktop = readFileSync("packages/web/src/web/lib/desktop.ts", "utf8");
const preload = readFileSync("packages/desktop/electron/preload.ts", "utf8");
const main = readFileSync("packages/desktop/electron/main.ts", "utf8");
const actions = readFileSync("packages/desktop/electron/actions.ts", "utf8");
const stt = readFileSync("packages/web/src/api/lib/stt.ts", "utf8");
const setupLocal = readFileSync("deploy/setup-local.ts", "utf8");

assert.doesNotMatch(page, /\bEye\b/);
assert.doesNotMatch(page, /Bilder verfügbar/);

assert.match(assistant, /microphoneDeviceId/);
assert.match(recorder, /deviceId/);
assert.match(recorder, /exact/);
assert.match(settings, /Systemstandard/);
assert.match(settings, /Mikrofon auswählen|Mikrofon/);
assert.match(settings, /Vorschau/);
assert.match(settings, /api\.speak/);

assert.doesNotMatch(listener, /document\.hasFocus/);
assert.doesNotMatch(listener, /document\.visibilityState/);
assert.match(listener, /microphoneDeviceId/);
assert.match(listener, /FOREGROUND_MICROPHONE_EVENT/);

assert.doesNotMatch(assistant, /"cs2"/);
assert.doesNotMatch(assistant, /"downloads"/);
assert.doesNotMatch(assistant, /"explorer"/);
assert.match(assistant, /"spotify"/);
assert.match(assistant, /"steam"/);
assert.match(assistant, /"discord"/);
assert.match(assistant, /"browser"/);

assert.doesNotMatch(actions, /Counter-Strike 2/);
assert.doesNotMatch(actions, /label: "Downloads"/);
assert.doesNotMatch(actions, /label: "Explorer"/);
assert.match(actions, /scanInstalledDesktopActions/);
assert.match(actions, /addScannedDesktopActions/);
assert.match(settings, /PC scannen/);
assert.match(preload, /scan-installed-desktop-actions/);
assert.match(main, /scan-installed-desktop-actions/);
assert.match(desktop, /scanInstalledDesktopActions/);

assert.doesNotMatch(composer, />Screen<\/span>/);
assert.match(composer, /Live Screen/);
assert.match(composer, /live-screen/);
assert.match(composer, /setInterval/);
const textareaIndex = composer.indexOf("<textarea");
const micIndex = composer.indexOf('aria-label={recording ? "Aufnahme beenden" : "Spracheingabe starten"}');
const sendIndex = composer.indexOf('aria-label="Senden"');
assert.ok(textareaIndex >= 0 && micIndex > textareaIndex && sendIndex > micIndex, "Mic must sit directly between chat input and send");
assert.match(stt, /localSttEnabled/);
assert.match(stt, /if \(localSttEnabled\(\)\) return true/);
assert.match(setupLocal, /Lokale Speech-to-Text-Einstellungen auf diesen PC migriert/);
assert.match(setupLocal, /STT_BASE_URL/);
assert.match(setupLocal, /STT_API_KEY/);

console.log("v0.1.2 assistant polish wiring: OK");
