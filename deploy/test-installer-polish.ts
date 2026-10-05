import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const setup = readFileSync("packages/desktop/setup/index.html", "utf8");
const workflow = readFileSync(".github/workflows/windows-release.yml", "utf8");
const desktopPackage = JSON.parse(readFileSync("packages/desktop/package.json", "utf8")) as {
  version?: string;
};
const version = desktopPackage.version ?? "";
const releaseNotesPath = `docs/RELEASE_NOTES_${version}.md`;
const releaseNotes = existsSync(releaseNotesPath) ? readFileSync(releaseNotesPath, "utf8") : "";

assert.match(setup, /Automatische Empfehlung/);
assert.match(setup, /advancedProfiles/);
assert.match(setup, /Model Manager/);
assert.match(setup, /This may take a while\. Go relax, grab a snack, or do some homework\./);
assert.match(workflow, /packages\/desktop\/artifact\//);
assert.match(workflow, /SHA256SUMS\.txt/);
assert.match(workflow, /NORVI-Setup-\$version\.exe/);

assert.match(workflow, /Silent install smoke/);
assert.match(workflow, /\/S/);
assert.match(workflow, /NORVI\.exe/);
assert.match(workflow, /--disable-gpu/);
assert.match(workflow, /tags:\s*\n\s*- "v\*"/);
assert.match(workflow, /if: startsWith\(github\.ref, 'refs\/tags\/v'\)/);
assert.doesNotMatch(workflow, /github\.event_name == 'push'/);
assert.doesNotMatch(workflow, /RELEASE_0\.1\.0_READY/);
assert.doesNotMatch(workflow, /releaseTag -ne "v0\.1\.0"/);
assert.match(workflow, /RELEASE_NOTES_\$version\.md/);
assert.match(workflow, /--notes-file/);

assert.match(version, /^\d+\.\d+\.\d+$/);
assert.equal(existsSync(releaseNotesPath), true, `${releaseNotesPath} is missing`);
assert.match(releaseNotes, new RegExp(version.replace(/\./g, "\\.")));
assert.match(releaseNotes, /Windows/i);
assert.match(releaseNotes, /update|fix|verbesser/i);

console.log("installer recommendation, UI smoke and tag-only release wiring: OK");
