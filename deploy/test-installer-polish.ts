import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const setup = readFileSync("packages/desktop/setup/index.html", "utf8");
const workflow = readFileSync(".github/workflows/windows-release.yml", "utf8");

assert.match(setup, /Automatische Empfehlung/);
assert.match(setup, /advancedProfiles/);
assert.match(setup, /Model Manager/);
assert.match(workflow, /packages\/desktop\/artifact\//);
assert.match(workflow, /SHA256SUMS\.txt/);
assert.match(workflow, /NORVI-Setup-\$version\.exe/);

console.log("installer recommendation and staged artifact wiring: OK");
