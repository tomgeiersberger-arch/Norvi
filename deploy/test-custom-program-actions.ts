import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actions = readFileSync("packages/desktop/electron/actions.ts", "utf8");
const preload = readFileSync("packages/desktop/electron/preload.ts", "utf8");
const settings = readFileSync("packages/web/src/web/components/settings-dialog.tsx", "utf8");

assert.match(actions, /showOpenDialog/);
assert.match(actions, /extensions: \["exe", "lnk"\]/);
assert.match(actions, /custom-/);
assert.match(actions, /steam:\/\/open\/main/);
assert.match(actions, /discord:\/\//);
assert.match(actions, /getPath\(action\.target\)/);
assert.doesNotMatch(actions, /execFile\(/);
assert.match(preload, /norvi:add-custom-desktop-action/);
assert.match(settings, /Eigene Games & Programme/);

console.log("custom program action wiring: OK");
