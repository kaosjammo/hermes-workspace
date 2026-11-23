import { useId } from "react";
import { Checkbox, Tip } from "@hermes/plugin-sdk";
import { h, Action, Codicon } from "./ui.jsx";

function ResolveCheckbox({ "data-state": tooltipState, ...props }) {
  // Tip's asChild state describes the tooltip. Keep the native Checkbox's own
  // checked/unchecked state so its tick, colours and keyboard semantics survive.
  return h("span", { className: "ws-comment-resolve-wrap" },
    h(Checkbox, props),
    !props.checked && h(Codicon, { name: "check", className: "ws-comment-resolve-tick", "aria-hidden": true }));
}

/** Sibling of the summary trigger: never nest interactive controls in it. */
export function CommentActions({ comment, locked, pending, onResolve, onDelete, onRevert }) {
  const reasonId = useId(), stateId = useId();
  const change = comment.section_change;
  const reason = locked ? "This discussion is locked while an operation is active."
    : pending ? "Wait for the current comment action to finish."
    : change?.status === "available" ? null
    : change?.status === "reverted" ? "This section was reverted."
    : change?.reason ?? "No eligible addressed section is saved for this comment.";
  const disabled = locked || pending;
  const revert = h(Action, { className: "ws-comment-control", variant: "ghost", size: "icon-xs", disabled: Boolean(reason),
    "aria-label": `Revert changes: ${comment.text}`, "aria-describedby": reason ? reasonId : undefined,
    onClick: event => { if (!reason) onRevert(event.currentTarget); },
  }, h(Codicon, { name: "discard", "aria-hidden": true }));
  return h("div", { className: "ws-comment-action-area" },
    h("div", { className: "ws-comment-actions", role: "group", "aria-label": `Actions for comment ${comment.passageNumber}` },
      h(Tip, { label: "Resolve" }, h(ResolveCheckbox, {
        className: "ws-checkbox ws-comment-resolve ws-comment-control", checked: comment.resolved, disabled,
        "aria-label": `Resolve: ${comment.text}`, "aria-describedby": stateId,
        onCheckedChange: value => onResolve(value === true),
      })),
      h(Tip, { label: "delete comment" }, h(Action, { className: "ws-comment-control", variant: "ghost", size: "icon-xs",
        disabled, "aria-label": `delete comment: ${comment.text}`,
        onClick: event => onDelete(event.currentTarget),
      }, h(Codicon, { name: "trash", "aria-hidden": true }))),
      h(Tip, { label: "Revert changes" }, change?.status !== "available" ? h("span", { className: "ws-comment-revert-target",
        tabIndex: 0, "aria-label": `Revert changes unavailable: ${reason}`, "aria-describedby": reasonId,
      }, revert) : revert)),
    h("span", { id: stateId, className: "ws-comment-action-state" }, comment.resolved ? "Resolved. Uncheck to reopen." : "Unresolved."),
    reason && h("span", { id: reasonId, className: "ws-comment-action-reason" }, reason),
    h("span", { className: "ws-comment-touch-labels", "aria-hidden": true }, "Resolve · Delete · Revert"));
}
