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
assert.match(actions, /scanInstalledDesktopActions/);
assert.match(actions, /Start Menu/);
assert.match(actions, /appmanifest_/);
assert.match(actions, /steam:\/\/rungameid\//);
assert.doesNotMatch(actions, /getPath\(action\.target\)/);
assert.doesNotMatch(actions, /execFile\(/);
assert.match(preload, /norvi:add-custom-desktop-action/);
assert.match(preload, /norvi:scan-installed-desktop-actions/);
assert.match(settings, /Eigene Games & Programme/);
assert.match(settings, /PC scannen/);

console.log("custom program action and PC scan wiring: OK");
