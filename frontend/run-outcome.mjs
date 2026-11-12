import { useMemo, useState } from "react";

/** Dismiss presentation only; never alter a run, its history or edit authority. */
export function useRunOutcomeDismissal(storage, owner, scope, itemId, run) {
  const [connection, profile] = JSON.parse(owner);
  const key = `run-outcome:v1:${JSON.stringify([connection, profile, scope, itemId])}`;
  const fingerprint = run ? JSON.stringify([run.id, run.status, run.updated_at]) : null;
  const stored = useMemo(() => {
    try { return storage?.get(key, null) ?? null; }
    catch { return null; }
  }, [storage, key]);
  const [local, setLocal] = useState(null);
  return {
    dismissed: fingerprint !== null && (local?.key === key ? local.value : stored) === fingerprint,
    dismiss() {
      setLocal({ key, value: fingerprint });
      try { storage?.set(key, fingerprint); }
      catch { /* Dismissal still applies to this open view. */ }
    },
  };
}
