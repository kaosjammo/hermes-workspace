export function tableRows(
  records,
  columns,
  { sort = "", direction = "asc", filter = "" } = {},
) {
  const needle = filter.toLocaleLowerCase();
  const result = records.filter((r) =>
    [r.title, ...Object.values(r.properties ?? {})].some((v) =>
      String(v ?? "")
        .toLocaleLowerCase()
        .includes(needle),
    ),
  );
  const column = columns.find((c) => c.id === sort);
  if (sort)
    result.sort((a, b) => {
      const av = sort === "title" ? a.title : a.properties?.[sort];
      const bv = sort === "title" ? b.title : b.properties?.[sort];
      const comparison =
        column?.type === "number"
          ? Number(av ?? 0) - Number(bv ?? 0)
          : String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
              numeric: true,
            });
      return comparison * (direction === "desc" ? -1 : 1);
    });
  return result;
}
export function boardGroups(records, column) {
  const groups = new Map(
    [...(column?.options ?? []), null].map((name) => [name, []]),
  );
  for (const record of records) {
    const name = record.properties?.[column.id] ?? null;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(record);
  }
  return groups;
}
export function activeRun(state, id) {
  return state?.runs?.find(
    (run) =>
      ["running", "pending", "starting", "stopping"].includes(run.status) &&
      (run.allowed_item_ids ?? [run.item_id]).includes(id),
  );
}

/** Replacement-property writes are built at queue execution, excluding computed values. */
export function propertyPatch(state, id, columnId, value) {
  const record = state.items.find((i) => i.id === id);
  if (!record) throw new Error("Record is unavailable.");
  const database = state.items.find((i) => i.id === record.database_id);
  const editable = new Set(
    (database?.columns ?? [])
      .filter((c) => c.type !== "formula")
      .map((c) => c.id),
  );
  return {
    id,
    patch: {
      properties: {
        ...Object.fromEntries(
          Object.entries(record.properties ?? {}).filter(([key]) =>
            editable.has(key),
          ),
        ),
        [columnId]: value,
      },
    },
  };
}
