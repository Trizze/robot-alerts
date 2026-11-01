export function inventoryOrder(catalog, owned, filter = "all") {
  const have = new Set(owned.map((p) => (typeof p === "string" ? p : p.id)));
  return catalog
    .filter((p) => filter === "all" || String(p.tier) === filter)
    .slice()
    .sort(
      (a, b) =>
        Number(have.has(b.id)) - Number(have.has(a.id)) ||
        (filter === "all" ? b.tier - a.tier : 0) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}
