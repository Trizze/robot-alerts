import test from "node:test";
import assert from "node:assert/strict";
import { inventoryOrder } from "../website-staging/shared/inventory-order.js";
test("owned skins precede locked skins; All sorts each group by highest tier first", () => {
  const catalog = [
    { id: "a", name: "A", tier: 1 },
    { id: "b", name: "B", tier: 5 },
    { id: "c", name: "C", tier: 3 },
    { id: "d", name: "D", tier: 5 },
  ];
  assert.deepEqual(
    inventoryOrder(catalog, [{ id: "a" }, { id: "c" }]).map((p) => p.id),
    ["c", "a", "b", "d"],
  );
  assert.deepEqual(
    inventoryOrder(catalog, [{ id: "d" }], "5").map((p) => p.id),
    ["d", "b"],
  );
  assert.deepEqual(
    catalog.map((p) => p.id),
    ["a", "b", "c", "d"],
  );
});
