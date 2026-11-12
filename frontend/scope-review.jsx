import { Dialog, DialogContent } from "./owned-popups.jsx";
import { useRef, useState } from "react";
import {
  Checkbox,
  SearchField,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@hermes/plugin-sdk";
import { h, Action, operationError } from "./ui.jsx";
import { itemLabel } from "./item-labels.mjs";
/** References are inert data. Only the dialog's unchecked user choices grant this run. */
export function reviewScope(state, itemId) {
  const comments = state.comments.filter(
    (c) => c.item_id === itemId && !c.resolved,
  );
  // The existing run review is the ONLY place to choose related-item edits.
  // Keep unavailable legacy references visible, never preselect any grant.
  const ids = [...new Set([
    ...comments.flatMap((c) => c.target_item_ids ?? []),
    ...state.items.filter(i => !i.deleted_at && i.kind !== "folder").map(i => i.id),
  ])]
    .filter((id) => id !== itemId)
    .sort();
  const targets = ids.map((id) => {
    const item = state.items.find((i) => i.id === id);
    return {
      id,
      title: item?.title ?? "Unavailable item",
      label: itemLabel(item,state.items,state.attachments),
      kind: item?.kind ?? "unknown",
      available: Boolean(item && !item.deleted_at && item.kind !== "folder"),
      comments: comments
        .filter((c) => c.target_item_ids?.includes(id))
        .map((c) => ({ id: c.id, text: c.text })),
    };
  });
  return {
    scope_id: state.scope_id,
    revision: state.revision,
    targets,
    signature: JSON.stringify({
      comments: comments.map((c) => ({
        id: c.id,
        text: c.text,
        anchor: c.anchor ?? null,
        targets: [...(c.target_item_ids ?? [])].sort(),
      })),
      targets: targets.map((t) => ({
        id: t.id,
        title: t.title,
        label: t.label,
        kind: t.kind,
        available: t.available,
      })),
    }),
  };
}
export function ScopeReviewDialog({
  review,
  currentTitle,
  currentId,
  currentThreadId,
  onSubmit,
  onClose,
}) {
  const [selected, setSelected] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false);
  const [query, setQuery] = useState(""), [limit, setLimit] = useState(20);
  const matches = review.targets.filter(target => `${target.title} ${target.label} ${target.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return h(
    Dialog,
    { open: true, onOpenChange: (open) => !open && !busy && onClose() },
    h(
      DialogContent,
      { className: "ws-dialog ws-scope-review", bodyClassName: "ws-scope-review-body", showCloseButton: !busy },
      h(
        DialogHeader,
        null,
        h(DialogTitle, null, "Review edits for this run"),
        h(
          DialogDescription,
          { className: "ws-dialog-description" },
          "Related items start unchecked. Text and references never grant edits.",
        ),
      ),
      h("p", { className: "ws-scope-current", title: currentTitle }, `Current page: ${currentTitle}`),
      h("details", { className: "ws-related-scope" },
        h("summary", null, `Allow related-item edits (optional${selected.length ? `; ${selected.length} selected` : ""})`),
        h(SearchField, { "aria-label": "Find related items", value: query, placeholder: "Find a Workspace item…", onChange: value => { setQuery(value); setLimit(20); }, onClear: () => { setQuery(""); setLimit(20); } }),
        h("p", { role: "status" }, `${matches.length} matching items; ${selected.length} explicitly selected.`),
      matches.slice(0, limit).map((target) =>
        h(
          "section",
          { key: target.id, className: "ws-comment" },
          h(
            "label",
            { className: "ws-check" },
            h(Checkbox, {
              className: "ws-checkbox",
              "aria-label": `Allow edits to ${target.label}`,
              checked: selected.includes(target.id),
              disabled: busy || !target.available,
              onCheckedChange: (checked) =>
                setSelected((ids) =>
                  checked
                    ? [...ids, target.id]
                    : ids.filter((id) => id !== target.id),
                ),
            }),
            h(
              "span",
              null,
              `${target.label}${target.available ? "" : "; unavailable, not allowed"}`,
            ),
          ),
          h("details", null, h("summary", null, "Technical identity"), h("p", null, `Workspace item ID: ${target.id}`)),
          target.comments.map((comment) =>
            h("p", { key: comment.id }, comment.text),
          ),
        ),
      ),
      matches.length > limit && h(Action, { onClick: () => setLimit(value => value + 20) }, "Show more items")),
      error && h("div", { role: "alert" },
        h("p", null, operationError(error, { operation: "runStart", pageTitle: currentTitle, threadId: currentThreadId })),
        h("details", null, h("summary", null, "Technical details"), h("pre", null, error))),
      h(
        DialogFooter,
        { className: "ws-dialog-footer" },
        h(Action, { disabled: busy, onClick: onClose }, "Cancel"),
        h(
          Button,
          {
            "aria-label": selected.length ? "Address selected scope" : "Address current page",
            loading: busy,
            onClick: async () => {
              if (inFlight.current) return;
              inFlight.current = true;
              setBusy(true);
              setError("");
              try {
                if (selected.some(id => !review.targets.some(t => t.id === id && t.available)))
                  throw new Error("The selected related items are unavailable. Close and review this run again.");
                await onSubmit(selected);
                onClose();
              } catch (err) {
                setError(err.message);
              } finally {
                inFlight.current = false;
                setBusy(false);
              }
            },
          },
          selected.length ? "Address selected scope" : "Address current page",
        ),
      ),
    ),
  );
}
