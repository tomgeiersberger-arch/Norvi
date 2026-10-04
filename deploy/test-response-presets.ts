import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const assistant = readFileSync("packages/web/src/web/lib/desktop-assistant.ts", "utf8");
const panel = readFileSync("packages/web/src/web/components/desktop-style-panel.tsx", "utf8");
const chat = readFileSync("packages/web/src/web/components/chat/chat-pane.tsx", "utf8");
const api = readFileSync("packages/web/src/api/index.ts", "utf8");
const agent = readFileSync("packages/web/src/api/agent/index.ts", "utf8");

assert.match(assistant, /responsePreset:\s*"normal"/);
assert.match(panel, /Eigener Stil/);
assert.match(chat, /responseStyle/);
assert.match(api, /customResponseStyle/);
assert.match(agent, /Response-style preference/);
assert.match(agent, /never overrides safety/);

console.log("response presets wiring: OK");
