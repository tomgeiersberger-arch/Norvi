import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const models = readFileSync("packages/desktop/electron/models.ts", "utf8");
const runtime = readFileSync("packages/desktop/electron/local-runtime.ts", "utf8");
const main = readFileSync("packages/desktop/electron/main.ts", "utf8");
const panel = readFileSync("packages/web/src/web/components/desktop-model-manager.tsx", "utf8");
const maintenance = readFileSync("packages/web/src/web/components/desktop-maintenance-panel.tsx", "utf8");

assert.match(models, /qwen3:4b/);
assert.match(models, /qwen3:8b/);
assert.match(models, /qwen3:14b/);
assert.match(models, /127\.0\.0\.1:11434/);
assert.match(models, /Das aktive Modell kann nicht gelöscht werden/);
assert.match(runtime, /runRuntimeSelfTest/);
assert.match(runtime, /repairLocalRuntime/);
assert.match(main, /norvi:list-managed-models/);
assert.match(panel, /Model Manager/);
assert.match(maintenance, /Reparatur versuchen/);

console.log("model manager and recovery wiring: OK");
