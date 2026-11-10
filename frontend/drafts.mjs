/** Recovery buffers only. The server remains authoritative; opening never writes a draft. */
export class DraftRepository {
  constructor(storage, connectionId, profile) {
    this.storage = storage;
    this.connectionId = connectionId;
    this.profile = profile;
  }
  key(scopeId, field = "content") {
    if (!scopeId || !this.connectionId || !this.profile)
      throw new Error("Draft source is unavailable.");
    const prefix = { content: "recovery-drafts", title: "recovery-titles", property: "recovery-properties", discussion: "recovery-discussions" }[field];
    if (!prefix) throw new Error("Unknown recovery field.");
    return `${prefix}:v1:${JSON.stringify([this.connectionId, this.profile, scopeId])}`;
  }
  list(scopeId, field = "content") {
    const entries = this.storage.get(this.key(scopeId, field), []);
    return Array.isArray(entries) ? entries.filter(entry =>
      entry?.version === 1 && entry.connection_id === this.connectionId &&
      entry.profile === this.profile && entry.scope_id === scopeId &&
      typeof entry.item_id === "string" && typeof entry.token === "string" &&
      (field === "property" ? typeof entry.property_id === "string" && Object.hasOwn(entry, "value") :
        field === "discussion" ? entry.draft && typeof entry.draft === "object" && !Array.isArray(entry.draft) :
          typeof entry[field === "title" ? "title" : "html"] === "string")) : [];
  }
  bind(scopeId, itemId, field = "content", propertyId = "") {
    if (field === "property" && !propertyId) throw new Error("A property draft needs its column.");
    const matches = entry => entry.item_id === itemId && (field !== "property" || entry.property_id === propertyId);
    const read = () => this.list(scopeId, field).find(matches) ?? null;
    const remove = () => this.storage.set(this.key(scopeId, field), this.list(scopeId, field).filter(entry => !matches(entry)));
    return {
      read,
      put: (value, baseValue) => {
        const payload = field === "title" ? { title: value, base_title: baseValue, field: "title" } :
          field === "property" ? { value: structuredClone(value), base_value: structuredClone(baseValue), property_id: propertyId, field: "property" } :
            field === "discussion" ? { draft: structuredClone(value), field: "discussion" } : { html: value, base_html: baseValue };
        const entry = { version: 1, connection_id: this.connectionId, profile: this.profile,
          scope_id: scopeId, item_id: itemId, ...payload, token: crypto.randomUUID(), updated_at: new Date().toISOString() };
        this.storage.set(this.key(scopeId, field), [...this.list(scopeId, field).filter(old => !matches(old)), entry]);
        if (read()?.token !== entry.token)
          throw new Error("Draft recovery could not be retained. Copy the text before leaving this page.");
        return entry;
      },
      acknowledge: token => { if (read()?.token === token) remove(); },
      discard: remove,
    };
  }
}
