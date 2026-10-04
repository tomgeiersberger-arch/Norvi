import assert from "node:assert/strict";
import {
  DEFAULT_ASSISTANT_SETTINGS,
  matchDesktopAction,
  type DesktopAssistantSettings,
} from "../packages/web/src/web/lib/desktop-assistant";

const defaults: DesktopAssistantSettings = {
  ...DEFAULT_ASSISTANT_SETTINGS,
  desktopActionAliases: {
    spotify: [...DEFAULT_ASSISTANT_SETTINGS.desktopActionAliases.spotify],
    cs2: [...DEFAULT_ASSISTANT_SETTINGS.desktopActionAliases.cs2],
  },
  customDesktopActions: [],
  websiteActions: [],
};

assert.deepEqual(matchDesktopAction("Starte cs2", defaults), {
  kind: "desktop",
  id: "cs2",
  label: "Counter-Strike 2",
});
assert.equal(matchDesktopAction("Was ist cs2?", defaults), null);

const custom: DesktopAssistantSettings = {
  ...defaults,
  desktopActionAliases: {
    spotify: ["musik"],
    cs2: ["shooter"],
  },
  customDesktopActions: [
    {
      id: "custom-demo-1234",
      label: "Demo Game",
      aliases: ["demo", "dg"],
    },
  ],
  websiteActions: [
    {
      id: "winkelhof",
      label: "Winkelhof",
      url: "www.winkelhof.at",
      aliases: ["winkelhof", "hofseite"],
    },
  ],
};

assert.deepEqual(matchDesktopAction("Mach shooter auf", custom), {
  kind: "desktop",
  id: "cs2",
  label: "Counter-Strike 2",
});

assert.deepEqual(matchDesktopAction("Starte dg", custom), {
  kind: "desktop",
  id: "custom-demo-1234",
  label: "Demo Game",
});

const website = matchDesktopAction("Starte winkelhof", custom);
assert.equal(website?.kind, "website");
if (website?.kind === "website") {
  assert.equal(website.label, "Winkelhof");
  assert.equal(website.url, "https://www.winkelhof.at/");
}

const unsafe: DesktopAssistantSettings = {
  ...custom,
  customDesktopActions: custom.customDesktopActions,
  websiteActions: [
    { id: "bad", label: "Bad", url: "javascript:alert(1)", aliases: ["bad"] },
  ],
};
assert.equal(matchDesktopAction("Starte bad", unsafe), null);

console.log("desktop action matcher: OK");
