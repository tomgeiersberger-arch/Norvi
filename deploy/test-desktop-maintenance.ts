import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync("packages/desktop/electron/main.ts", "utf8");
const panel = readFileSync("packages/web/src/web/components/desktop-maintenance-panel.tsx", "utf8");
const dialog = readFileSync("packages/web/src/web/components/settings-dialog.tsx", "utf8");

assert.match(main, /norvi:check-for-updates/);
assert.match(panel, /norvi-settings-backup\.json/);
assert.match(panel, /Nach Updates suchen/);
assert.match(panel, /LOCAL_ONLY/);
assert.match(dialog, /DesktopMaintenancePanel/);

console.log("desktop maintenance tools wiring: OK");
