import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const assistant = readFileSync("packages/web/src/web/lib/desktop-assistant.ts", "utf8");
const provider = readFileSync("packages/web/src/web/components/provider.tsx", "utf8");
const wizard = readFileSync("packages/web/src/web/components/first-run-wizard.tsx", "utf8");

assert.match(assistant, /onboardingComplete:\s*false/);
assert.match(provider, /<FirstRunWizard \/>/);
assert.match(wizard, /Screen Mode/);
assert.match(wizard, /Kein Account nötig/);
assert.match(wizard, /NORVI starten/);

console.log("first-run wizard wiring: OK");
