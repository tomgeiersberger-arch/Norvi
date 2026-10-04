import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const assistant = readFileSync("packages/web/src/web/lib/desktop-assistant.ts", "utf8");
const chat = readFileSync("packages/web/src/web/components/chat/chat-pane.tsx", "utf8");
const api = readFileSync("packages/web/src/api/index.ts", "utf8");
const agent = readFileSync("packages/web/src/api/agent/index.ts", "utf8");
const panel = readFileSync("packages/web/src/web/components/desktop-memory-panel.tsx", "utf8");

assert.match(assistant, /memoryItems:\s*\[\]/);
assert.match(chat, /capabilities\.data\?\.localOnly/);
assert.match(api, /localOnlyModeEnabled\(\) && Array\.isArray\(body\?\.localMemory\)/);
assert.match(agent, /user-controlled local memory/);
assert.match(panel, /Noch keine Erinnerungen/);
assert.match(panel, /30 Erinnerungen/);

console.log("local memory wiring: OK");
