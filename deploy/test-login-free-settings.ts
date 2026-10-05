import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.example", "utf8");
const setup = readFileSync("deploy/setup-local.ts", "utf8");
const settingsRoute = readFileSync("packages/web/src/api/routes/settings.ts", "utf8");
const settingsQuery = readFileSync("packages/web/src/web/queries/settings.ts", "utf8");
const accountMenu = readFileSync("packages/web/src/web/components/account-menu.tsx", "utf8");
const wizard = readFileSync("packages/web/src/web/components/first-run-wizard.tsx", "utf8");

assert.match(env, /^REQUIRE_AUTH=false$/m);
assert.match(setup, /REQUIRE_AUTH:\s*"false"/);

assert.match(settingsRoute, /withUser/);
assert.match(settingsRoute, /deviceId:\s*deviceId\.optional\(\)/);
assert.match(settingsRoute, /return "device:" \+ parsed\.data/);
assert.match(settingsRoute, /requireAuthEnabled\(\)/);

assert.match(settingsQuery, /input:\s*\{\s*deviceId:\s*getDeviceId\(\)\s*\}/s);
assert.match(accountMenu, /localPublicProfile/);
assert.match(accountMenu, /Kein Login nötig/);
assert.match(wizard, /Kein Account nötig/);

console.log("login-free local settings regression: OK");
