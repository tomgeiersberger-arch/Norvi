import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const composer = readFileSync("packages/web/src/web/components/chat/composer.tsx", "utf8");
const account = readFileSync("packages/web/src/web/components/account-menu.tsx", "utf8");
const maintenance = readFileSync("packages/web/src/web/components/desktop-maintenance-panel.tsx", "utf8");
const provider = readFileSync("packages/web/src/web/components/provider.tsx", "utf8");
const setup = readFileSync("packages/desktop/setup/index.html", "utf8");
const main = readFileSync("packages/desktop/electron/main.ts", "utf8");
const workflow = readFileSync(".github/workflows/windows-release.yml", "utf8");

assert.match(composer, /Kurzmodus/);
assert.match(composer, /OPEN_SETTINGS_EVENT/);
assert.match(composer, /TEXT_ATTACHMENT_ACCEPT/);
assert.match(account, /OPEN_SETTINGS_EVENT/);
assert.match(provider, /DesktopErrorLogger/);
assert.match(maintenance, /recentRendererErrors/);
assert.match(maintenance, /Fehlerlog leeren/);
assert.match(setup, /Automatische Empfehlung/);
assert.match(setup, /advancedProfiles/);
assert.match(main, /norvi:run-system-action/);
assert.match(main, /0xAF/);
assert.match(main, /0xAE/);
assert.match(main, /0xAD/);
assert.match(workflow, /packages\/desktop\/artifact\//);

console.log("final desktop polish wiring: OK");
