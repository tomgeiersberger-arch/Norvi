import { base } from "../__core/app";
import { AGENT_NAME, MODEL_ID, MODEL_LABEL } from "../agent";

/** Agent identity + underlying model, so clients can label the UI. */
export const model = base.handler(() => ({
  agent: AGENT_NAME,
  id: MODEL_ID,
  label: MODEL_LABEL,
}));
