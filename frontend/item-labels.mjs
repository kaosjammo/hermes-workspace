/** Human identity for native choices; opaque IDs stay in command payloads. */
export function itemContext(item, items = [], attachments = []) {
  if (!item) return "Unavailable item";
  const path = [], seen = new Set([item.id]);
  let parent = items.find(i => i.id === (item.database_id || item.parent_id));
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id); path.unshift(parent.title);
    parent = items.find(i => i.id === (parent.database_id || parent.parent_id));
  }
  const files = attachments.filter(a => a.item_id === item.id);
  const duplicate = items.some(other => other.id !== item.id && !other.deleted_at &&
    other.title === item.title && other.kind === item.kind &&
    (other.database_id || other.parent_id) === (item.database_id || item.parent_id));
  const imports = files.filter(file => /\.(md|csv|docx|pdf)$/i.test(file.name));
  const original = duplicate && (imports.find(file =>
    file.name.replace(/\.[^.]+$/, "") === item.title) || imports[0]);
  const filename = original && [...original.name];
  const shortName = filename && (filename.length > 48
    ? `${filename.slice(0, 25).join("")}…${filename.slice(-20).join("")}` : original.name);
  return [path.join(" / ") || "Workspace", item.kind,
    shortName, files.length && `${files.length} ${files.length === 1 ? "attachment" : "attachments"}`]
    .filter(Boolean).join(" · ");
}
export function itemLabel(item, items = [], attachments = []) {
  return item ? `${item.title} · ${itemContext(item,items,attachments)}` : "Unavailable item";
}

/** Keep unique navigation titles quiet; distinguish collisions with existing context. */
export function navigationContexts(items = [], attachments = []) {
  const groups = new Map(), contexts = new Map();
  for (const item of items.filter(item => !item.deleted_at)) {
    const group = groups.get(item.title) ?? [];
    group.push(item); groups.set(item.title, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const details = group.map(item => itemContext(item, items, attachments));
    const seen = new Map(), totals = new Map();
    details.forEach(detail => totals.set(detail, (totals.get(detail) ?? 0) + 1));
    const locations = new Set(group.map(item => item.database_id || item.parent_id));
    for (const [index, item] of group.entries()) {
      const detail = details[index], total = totals.get(detail);
      const ordinal = (seen.get(detail) ?? 0) + 1;
      seen.set(detail, ordinal);
      const files = attachments.filter(file => file.item_id === item.id && /\.(md|csv|docx|pdf)$/i.test(file.name));
      const original = files.find(file => file.name.replace(/\.[^.]+$/, "") === item.title) || files[0];
      const extension = original?.name.split(".").at(-1).toLowerCase();
      const format = { md: "Markdown", csv: "CSV", docx: "Word", pdf: "PDF" }[extension];
      const filename = original && original.name.replace(/\.[^.]+$/, "") !== item.title ? original.name : null;
      const parent = items.find(parent => parent.id === (item.database_id || item.parent_id));
      const caption = [filename || format || item.kind, locations.size > 1 && (parent?.title || "Workspace"),
        total > 1 && `item ${ordinal} of ${total}`].filter(Boolean).join(" · ");
      contexts.set(item.id, { caption, description: total > 1 ? `${detail} · item ${ordinal} of ${total}` : detail });
    }
  }
  return contexts;
}

/** Stored upload order keeps duplicate-name ordinals stable as files are added. */
export function attachmentLabels(attachments) {
  const counts = new Map(), seen = new Map();
  for (const file of attachments) counts.set(file.name, (counts.get(file.name) ?? 0) + 1);
  const types = {
    "image/png": "PNG image", "image/jpeg": "JPEG image", "image/gif": "GIF image",
    "image/webp": "WebP image", "image/svg+xml": "SVG image", "application/pdf": "PDF document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
    "text/plain": "Text file", "text/markdown": "Markdown document", "text/csv": "CSV table",
  };
  const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  return attachments.map(attachment => {
    const ordinal = (seen.get(attachment.name) ?? 0) + 1;
    seen.set(attachment.name, ordinal);
    const total = counts.get(attachment.name), data = attachment.data_base64;
    const bytes = typeof data === "string"
      ? Math.max(0, Math.floor(data.length * 3 / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0)) : null;
    const size = bytes === null ? "Size unavailable" : bytes < 1024
      ? `${bytes} ${bytes === 1 ? "byte" : "bytes"}`
      : bytes < 1024 * 1024 ? `${number.format(bytes / 1024)} KiB` : `${number.format(bytes / (1024 * 1024))} MiB`;
    return { attachment, label: total > 1 ? `${attachment.name} · attachment ${ordinal} of ${total}` : attachment.name,
      detail: `${types[attachment.media_type] ?? "File"} · ${size}` };
  });
}
