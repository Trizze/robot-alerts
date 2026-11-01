import test from "node:test";
import assert from "node:assert/strict";
import { patternSelection } from "../website-staging/shared/pattern-selection.js";

const catalog = [{ id: "green_marble_pattern_tiles" }];
test("only an installed catalog identifier can select an alert texture", () => {
  for (const id of [
    null,
    "unknown",
    "../green_marble_pattern_tiles",
    "https://example.invalid/texture",
    "<img>",
    { toString: () => "green_marble_pattern_tiles" },
  ])
    assert.equal(patternSelection({ selectedPattern: id }, catalog), null);
  assert.equal(patternSelection({}, catalog), null);
  assert.deepEqual(
    patternSelection(
      { selectedPattern: catalog[0].id, patternScale: 1.5 },
      catalog,
    ),
    { id: catalog[0].id, scale: 1.5 },
  );
});
test("pattern scale remains bounded even for hostile or outdated event payloads", () => {
  const choose = (patternScale) =>
    patternSelection({ selectedPattern: catalog[0].id, patternScale }, catalog)
      .scale;
  assert.equal(choose(0.25), 0.5);
  assert.equal(choose(8), 2);
  for (const value of [NaN, Infinity, null, "1.5", undefined])
    assert.equal(choose(value), 1);
});
