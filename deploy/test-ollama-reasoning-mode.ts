import assert from "node:assert/strict";
import { localReasoningBody } from "../packages/web/src/api/agent/gateway";

const oldDeep = process.env.AI_DEEP_MODEL;
process.env.AI_DEEP_MODEL = "norvi-deep:latest";

const normal = JSON.parse(
  localReasoningBody(JSON.stringify({ model: "norvi:latest", messages: [] })),
) as Record<string, unknown>;
assert.equal(normal.reasoning_effort, "none");
assert.equal(normal.think, false);

const deep = JSON.parse(
  localReasoningBody(JSON.stringify({ model: "norvi-deep:latest", messages: [] })),
) as Record<string, unknown>;
assert.equal(deep.reasoning_effort, "high");
assert.equal(deep.think, undefined);

if (oldDeep === undefined) delete process.env.AI_DEEP_MODEL;
else process.env.AI_DEEP_MODEL = oldDeep;

console.log("ollama reasoning mode mapping: OK");