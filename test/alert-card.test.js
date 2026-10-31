import test from "node:test";
import assert from "node:assert/strict";
import { validateSettings } from "../src/robots/registry.js";
import {
  CARD_PRESET_ORDER,
  CARD_PRESETS,
} from "../public/shared/card-presets.js";
import { eventAmount } from "../public/shared/alert-card.js";
test("the chosen nine card presets and per-event amounts are available", () => {
  assert.deepEqual(CARD_PRESET_ORDER, [
    "02",
    "03",
    "04",
    "05",
    "07",
    "08",
    "09",
    "01",
    "10",
  ]);
  assert.equal(Object.keys(CARD_PRESETS).length, 9);
  assert.deepEqual(eventAmount({ type: "resub", months: 12 }), {
    value: "12",
    unit: "months",
  });
  assert.deepEqual(eventAmount({ type: "cheer", bits: 500 }), {
    value: "500",
    unit: "bits",
  });
  assert.deepEqual(eventAmount({ type: "gift", gifts: 1 }), {
    value: "1",
    unit: "sub",
  });
  assert.deepEqual(eventAmount({ type: "raid", raidSize: 42 }), {
    value: "42",
    unit: "viewers",
  });
});
test("card customization retains valid colors, text and local image symbols only", () => {
  const out = validateSettings({
    card: {
      preset: "02",
      colors: { background: "#123456", text: "url(evil)" },
      events: {
        cheer: {
          label: "BIG CHEER",
          detail: "{user} gave {count} {unit}!",
          symbol: "uploaded",
          upload: "/media/00000000-0000-4000-8000-000000000000.png",
        },
        raid: {
          label: "x".repeat(100),
          symbol: "<svg>",
          upload: "https://example.com/x.png",
        },
      },
    },
  }).card;
  assert.equal(out.colors.background, "#123456");
  assert.equal(out.colors.text, CARD_PRESETS["02"].colors.text);
  assert.equal(out.events.cheer.symbol, "uploaded");
  assert.match(out.events.cheer.upload, /\.png$/);
  assert.equal(out.events.raid.label.length, 32);
  assert.equal(out.events.raid.symbol, undefined);
  assert.equal(out.events.raid.upload, undefined);
});
