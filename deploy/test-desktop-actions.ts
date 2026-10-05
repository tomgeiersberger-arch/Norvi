import assert from "node:assert/strict";
import {
  DEFAULT_ASSISTANT_SETTINGS,
  matchDesktopAction,
  type DesktopAssistantSettings,
} from "../packages/web/src/web/lib/desktop-assistant";

const defaults: DesktopAssistantSettings = {
  ...DEFAULT_ASSISTANT_SETTINGS,
  desktopActionAliases: Object.fromEntries(
    Object.entries(DEFAULT_ASSISTANT_SETTINGS.desktopActionAliases).map(([id, aliases]) => [
      id,
      [...aliases],
    ]),
  ) as DesktopAssistantSettings["desktopActionAliases"],
  customDesktopActions: [],
  websiteActions: [],
};

assert.deepEqual(matchDesktopAction("Starte cs2", defaults), {
  kind: "desktop",
  id: "cs2",
  label: "Counter-Strike 2",
});
assert.equal(matchDesktopAction("Was ist cs2?", defaults), null);
assert.deepEqual(matchDesktopAction("Starte steam", defaults), {
  kind: "desktop",
  id: "steam",
  label: "Steam",
});
assert.deepEqual(matchDesktopAction("Öffne downloads", defaults), {
  kind: "desktop",
  id: "downloads",
  label: "Downloads",
});
assert.deepEqual(matchDesktopAction("Starte dc", defaults), {
  kind: "desktop",
  id: "discord",
  label: "Discord",
});

const custom: DesktopAssistantSettings = {
  ...defaults,
  desktopActionAliases: {
    ...defaults.desktopActionAliases,
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
