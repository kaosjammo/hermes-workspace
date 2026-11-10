/** Walk folders in the sidebar's sibling order, keeping each subtree together. */
export function folderDestinations(items, movingId) {
  const children = new Map();
  for (const item of items) {
    if (item.kind !== "folder" || item.deleted_at) continue;
    const siblings = children.get(item.parent_id) ?? [];
    siblings.push(item);
    children.set(item.parent_id, siblings);
  }
  const root = "Workspace root";
  const options = [["", root]];
  const seen = new Set();
  const visit = (parent, depth, path) => {
    for (const folder of children.get(parent) ?? []) {
      // A folder cannot move into itself or any of its descendants.
      if (folder.id === movingId || seen.has(folder.id)) continue;
      seen.add(folder.id);
      const location = [...path, folder.title];
      options.push([folder.id, folder.title, {
        depth,
        path: location.join(" / "),
      }]);
      visit(folder.id, depth + 1, location);
    }
  };
  visit(null, 1, [root]);
  return options;
}
