import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(
  "packages/web/src/web/components/desktop-maintenance-panel.tsx",
  "utf8",
);
const privacy = readFileSync("docs/PRIVACY.md", "utf8");

assert.equal(panel.includes("exportDiagnostics"), true);
assert.equal(panel.includes("saveTextFile"), true);
assert.equal(panel.includes("runtimeChecks"), true);
assert.equal(panel.includes("API-Keys oder Chat-Inhalte"), true);
assert.equal(privacy.includes("Local diagnostics report"), true);
assert.equal(privacy.includes("excludes chat content"), true);

console.log("local diagnostics report wiring: OK");
