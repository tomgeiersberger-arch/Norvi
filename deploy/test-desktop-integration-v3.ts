import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync("packages/desktop/electron/main.ts", "utf8");
const preload = readFileSync("packages/desktop/electron/preload.ts", "utf8");
const desktop = readFileSync("packages/web/src/web/lib/desktop.ts", "utf8");
const maintenance = readFileSync(
  "packages/web/src/web/components/desktop-maintenance-panel.tsx",
  "utf8",
);
const composer = readFileSync("packages/web/src/web/components/chat/composer.tsx", "utf8");
const skills = readFileSync("packages/web/src/web/components/desktop-skills-panel.tsx", "utf8");

assert.equal(main.includes("SHA256SUMS.txt"), true);
assert.equal(main.includes('createHash("sha256")'), true);
assert.equal(main.includes("Mit NORVI öffnen"), true);
assert.equal(main.includes("TEXT_EXTERNAL_EXTENSIONS"), true);
assert.equal(main.includes("IMAGE_EXTERNAL_TYPES"), true);
assert.equal(preload.includes("norvi:external-file"), true);
assert.equal(desktop.includes("installUpdate"), true);
assert.equal(desktop.includes("setExplorerContextMenu"), true);
assert.equal(maintenance.includes("Update installieren"), true);
assert.equal(maintenance.includes("Rechtsklick aktivieren"), true);
assert.equal(composer.includes("onExternalFile"), true);
assert.equal(skills.includes("NORVI Skills"), true);
assert.equal(skills.includes("kein generischer Shell-Zugriff"), true);

console.log("skills, verified update and Explorer context menu wiring: OK");
