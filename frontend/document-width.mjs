import { useMemo, useState } from "react";

/** A local view preference, separate from prose, saved versions and run grants.
 * Source/profile/scope/page are all part of identity; activation epochs are not
 * persisted, so reopening the same source restores the same page preference. */
export function documentWidthKey(owner, scope, itemId) {
  const [connection, profile] = JSON.parse(owner);
  return `document-width:v1:${JSON.stringify([connection, profile, scope, itemId])}`;
}

export function useDocumentWidth(storage, owner, scope, itemId) {
  const key = documentWidthKey(owner, scope, itemId);
  const initial = useMemo(() => {
    try { return storage?.get(key, false) === true; }
    catch { return false; }
  }, [storage, key]);
  const [local, setLocal] = useState({ key, wide: initial, error: "" });
  const current = local.key === key ? local : { key, wide: initial, error: "" };
  return { wide: current.wide, error: current.error, toggle() {
    const next = !current.wide;
    let error = "";
    try {
      if (!storage) throw new Error("Local preferences unavailable");
      storage.set(key, next);
    } catch {
      error = "Document width changed for this view, but its preference could not be saved.";
    }
    setLocal({ key, wide: next, error });
  } };
}
