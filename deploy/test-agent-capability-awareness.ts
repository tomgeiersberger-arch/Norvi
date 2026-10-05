import assert from "node:assert/strict";
import { capabilityInstruction } from "../packages/web/src/api/agent/capabilities";

const full = capabilityInstruction({
  localOnly: true,
  vision: true,
  stt: true,
  desktop: true,
  screenCapture: true,
  desktopActions: true,
});

assert.match(full, /offline/i);
assert.match(full, /bilder|images/i);
assert.match(full, /sprache|speech/i);
assert.match(full, /screen|bildschirm/i);
assert.match(full, /programme|programs/i);
assert.match(full, /websites/i);
assert.match(full, /was kannst du/i);
assert.match(full, /nicht.*behaupt|do not claim/i);

const limited = capabilityInstruction({
  localOnly: true,
  vision: false,
  stt: false,
  desktop: false,
  screenCapture: false,
  desktopActions: false,
});

assert.match(limited, /bilder.*nicht|images.*not|vision.*not/i);
assert.match(limited, /sprache.*nicht|speech.*not/i);
assert.doesNotMatch(limited, /kann.*programme.*öffnen/i);

console.log("agent capability awareness: OK");
