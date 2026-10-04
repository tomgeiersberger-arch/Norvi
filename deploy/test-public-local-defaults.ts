import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.example", "utf8");
const setup = readFileSync("deploy/setup-local.ts", "utf8");

assert.match(env, /^REQUIRE_AUTH=false$/m);
assert.match(setup, /REQUIRE_AUTH:\s*"false"/);
assert.match(env, /set REQUIRE_AUTH=true first/i);

console.log("public local login defaults: OK");
