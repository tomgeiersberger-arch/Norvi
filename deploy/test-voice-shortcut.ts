import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync("packages/desktop/electron/main.ts", "utf8");
const preload = readFileSync("packages/desktop/electron/preload.ts", "utf8");
const composer = readFileSync("packages/web/src/web/components/chat/composer.tsx", "utf8");
const settings = readFileSync("packages/web/src/web/components/settings-dialog.tsx", "utf8");

assert.match(main, /setVoiceShortcut/);
assert.match(main, /norvi:voice-shortcut/);
assert.match(preload, /onVoiceShortcut/);
assert.match(composer, /onVoiceShortcut/);
assert.match(settings, /Push-to-talk \/ Sprach-Hotkey/);

console.log("voice shortcut wiring: OK");
