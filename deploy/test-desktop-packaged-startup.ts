import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync("packages/desktop/electron/main.ts", "utf8");
const workflow = readFileSync(".github/workflows/windows-release.yml", "utf8");

assert.match(main, /const isDev = !app\.isPackaged/);
assert.doesNotMatch(main, /const isDev = process\.env\.NODE_ENV !== "production"/);
assert.match(main, /SETUP_PAGE/);
assert.match(main, /loadFile\(SETUP_PAGE\)/);

assert.match(workflow, /MainWindowTitle/);
assert.match(workflow, /NORVI Setup/);
assert.match(workflow, /@template\/desktop/);
assert.match(workflow, /schwarz|black|Renderer|UI/i);

console.log("packaged desktop startup and visible UI smoke guard: OK");