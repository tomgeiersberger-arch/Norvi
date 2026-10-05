import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const setup = readFileSync("packages/desktop/setup/index.html", "utf8");
const workflow = readFileSync(".github/workflows/windows-release.yml", "utf8");
const releaseNotesPath = "docs/RELEASE_NOTES_0.1.0.md";
const releaseNotes = existsSync(releaseNotesPath) ? readFileSync(releaseNotesPath, "utf8") : "";

assert.match(setup, /Automatische Empfehlung/);
assert.match(setup, /advancedProfiles/);
assert.match(setup, /Model Manager/);
assert.match(workflow, /packages\/desktop\/artifact\//);
assert.match(workflow, /SHA256SUMS\.txt/);
assert.match(workflow, /NORVI-Setup-\$version\.exe/);

assert.match(workflow, /Silent install smoke/);
assert.match(workflow, /\/S/);
assert.match(workflow, /NORVI\.exe/);
assert.match(workflow, /--disable-gpu/);
assert.match(workflow, /--notes-file docs\/RELEASE_NOTES_0\.1\.0\.md/);

assert.equal(existsSync(releaseNotesPath), true, "v0.1.0 release notes are missing");
assert.match(releaseNotes, /first setup requires an Internet connection/i);
assert.match(releaseNotes, /model downloads/i);
assert.match(releaseNotes, /offline/i);

console.log("installer recommendation, install smoke and release notes wiring: OK");