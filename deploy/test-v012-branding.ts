import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const builder = readFileSync("packages/desktop/electron-builder.json5", "utf8");
const setup = readFileSync("packages/desktop/setup/index.html", "utf8");
const mark = readFileSync("packages/web/src/web/components/chat/norvi-mark.tsx", "utf8");
const html = readFileSync("packages/web/index.html", "utf8");
const manifest = readFileSync("packages/web/public/manifest.webmanifest", "utf8");
const windowsWorkflow = readFileSync(".github/workflows/windows-release.yml", "utf8");

assert.match(builder, /productName:\s*"Norvi AI"/);
assert.match(builder, /shortcutName:\s*"Norvi AI"/);
assert.match(builder, /icon:\s*"build\/icon\.svg"/);
assert.match(builder, /createStartMenuShortcut:\s*true/);
assert.match(builder, /createDesktopShortcut:\s*true/);

assert.match(mark, /norvi-ai\.svg/);
assert.match(mark, />Norvi AI</);
assert.match(html, /<title>Norvi AI — KI-Chat<\/title>/);
assert.match(html, /href="\/norvi-ai\.svg"/);
assert.match(manifest, /"name":\s*"Norvi AI"/);
assert.match(manifest, /"short_name":\s*"Norvi AI"/);
assert.match(manifest, /"src":\s*"\/norvi-ai\.svg"/);

assert.match(setup, /<title>Norvi AI Setup<\/title>/);
assert.match(setup, /<h1>Norvi AI Setup<\/h1>/);
assert.match(setup, /norvi-ai\.svg/);

assert.match(windowsWorkflow, /Norvi AI\.exe/);
assert.match(windowsWorkflow, /Norvi AI Setup/);

console.log("v0.1.2 Norvi AI Windows branding: OK");
