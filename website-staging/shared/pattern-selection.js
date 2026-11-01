// User-provided identifiers never become paths. Only installed catalog entries do.
export function patternSelection(viewer, catalog) {
  const id = viewer?.selectedPattern;
  if (
    typeof id !== "string" ||
    !/^[a-z0-9_-]{1,80}$/.test(id) ||
    !catalog.some((item) => item.id === id)
  )
    return null;
  const scale = Number.isFinite(viewer.patternScale)
    ? Math.min(2, Math.max(0.5, viewer.patternScale))
    : 1;
  return { id, scale };
}
