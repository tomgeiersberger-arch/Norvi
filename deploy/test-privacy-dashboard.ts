import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync(
  "packages/web/src/web/components/desktop-privacy-panel.tsx",
  "utf8",
);
const settings = fs.readFileSync(
  "packages/web/src/web/components/settings-dialog.tsx",
  "utf8",
);

assert.equal(panel.includes("Privacy Dashboard"), true);
assert.equal(panel.includes("localOnly"), true);
assert.equal(panel.includes("requireAuth"), true);
assert.equal(panel.includes("screenCaptureEnabled"), true);
assert.equal(panel.includes("memoryItems"), true);
assert.equal(settings.includes("DesktopPrivacyPanel"), true);

console.log("privacy dashboard wiring: OK");
