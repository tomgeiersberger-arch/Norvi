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

assert.match(panel, /Privacy Dashboard/);
assert.match(panel, /localOnly/);
assert.match(panel, /requireAuth/);
assert.match(panel, /screenCaptureEnabled/);
assert.match(panel, /memoryItems/);
assert.match(settings, /DesktopPrivacyPanel/);

console.log("privacy dashboard wiring: OK");
