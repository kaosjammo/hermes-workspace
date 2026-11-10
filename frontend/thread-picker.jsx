import { useEffect, useId, useRef, useState } from "react";
import { SearchField, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@hermes/plugin-sdk";
import { h, Action, errorMessage, isSubmitEnter } from "./ui.jsx";

/** Public primitive composition. This deliberately labels bounded coverage:
 * the pinned host exposes no complete searchable/paged historical feed. */
export function ThreadPicker({ workflow, itemId, locked, onBound, onClose }) {
  const [rows, setRows] = useState([]), [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(0);
  const alive = useRef(true), binding = useRef(false), search = useRef(null);
  const id = useId();
  const opener = useRef(document.activeElement);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(""); setRows([]);
    Promise.resolve().then(() => workflow.listThreads()).then(result => {
      if (!current) return;
      setRows(Array.isArray(result) ? result : result.sessions);
    }).catch(err => { if (current) setError(errorMessage(err)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [workflow, attempt]);
  const matches = rows.filter(row => String(row.title ?? "").toLocaleLowerCase().includes(query.toLocaleLowerCase()) || row.id.includes(query));
  const choose = async row => {
    if (locked || loading || binding.current || row.running || row.pending?.length) return;
    binding.current = true; setBusy(true); setError("");
    try {
      // The exact listed row carries the adapter's private captured route/epoch.
      await workflow.bindThread(itemId, row.id, row);
      if (!alive.current) return;
      await onBound();
      if (alive.current) onClose();
    } catch (err) { if (alive.current) setError(errorMessage(err)); }
    finally { binding.current = false; if (alive.current) setBusy(false); }
  };
  const current = Math.min(active, Math.max(0, matches.length - 1));
  return h(Dialog, { open: true, onOpenChange: open => { if (!open && !binding.current) onClose(); } },
    h(DialogContent, { className: "ws-dialog ws-thread-picker", bodyClassName: "ws-thread-picker-body",
      onCloseAutoFocus: event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); } },
      showCloseButton: !busy },
      h(DialogHeader, null, h(DialogTitle, null, "Select existing thread"),
        h(DialogDescription, { className: "ws-dialog-description" }, "Recent only; older history is not searched.")),
      h("div", { ref: search }, h(SearchField, {
        containerClassName: "ws-thread-search", "aria-label": "Search recent native threads", placeholder: "Search recent threads…", value: query,
        loading, onChange: value => { setQuery(value); setActive(0); }, onClear: () => { setQuery(""); setActive(0); },
        onKeyDown: event => {
          if (event.isComposing || event.nativeEvent?.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const next = Math.max(0, Math.min(matches.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
            setActive(next);
            document.getElementById(`${id}-${next}`)?.scrollIntoView?.({ block: "nearest" });
          } else if (isSubmitEnter(event) && !event.repeat && matches[current]) {
            event.preventDefault(); void choose(matches[current]);
          }
        },
      })),
      !loading && matches[current] && h("p", { role: "status", className: "ws-thread-notice" },
        `${matches.length} recent ${matches.length === 1 ? "match" : "matches"}.`,
        h("span", { className: "sr-only" }, ` Selected: ${matches[current].title || "Untitled thread"}; ${matches[current].id}. Use arrows and Enter, or Tab to a result.`)),
      loading && h("p", { role: "status" }, "Loading native threads…"),
      !loading && !error && !matches.length && h("p", { role: "status" }, query ? "No matching recent threads. Older history has not been searched." : "No recent native threads available."),
      error && h("div", { role: "alert" }, h("p", null, error),
        h(Action, { disabled: busy, onClick: () => setAttempt(n => n + 1) }, "Reload threads")),
      h("div", { className: "ws-thread-results", role: "group", "aria-label": "Recent native threads", "aria-busy": loading || busy },
        matches.map((row, index) => h(Action, {
          key: row.id, id: `${id}-${index}`, className: "ws-thread-result", variant: index === current ? "secondary" : "ghost",
          disabled: locked || busy || row.running || Boolean(row.pending?.length),
          onFocus: () => setActive(index), onClick: () => void choose(row),
        }, h("span", null, row.title || "Untitled thread"),
        h("small", null, `${row.id}${row.running || row.pending?.length ? " · Busy" : ""}`)))),
      h(DialogFooter, null, h(Action, { disabled: busy, onClick: onClose }, "Cancel"))));
}
