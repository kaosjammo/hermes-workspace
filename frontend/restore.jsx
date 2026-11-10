import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@hermes/plugin-sdk";
import { h, Action, errorMessage } from "./ui.jsx";
/** One user-approved replacement. Ambiguous delivery never exposes a second POST. */
export function RestoreDialog({
  client,
  ticket,
  data,
  onClose,
  onCommitted,
  onRefused,
  onUseCurrent,
}) {
  const [receipt, setReceipt] = useState({ status: "confirmation" });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [inspection, setInspection] = useState(null);
  const submitted = useRef(false);
  const check = async (submit = false) => {
    if (busy || (submit && submitted.current)) return;
    if (submit) submitted.current = true;
    setBusy(true);
    setError("");
    try {
      const result = submit
        ? await client.restoreBackup(ticket, data)
        : await client.restoreStatus(ticket);
      client.assertCurrent();
      if (result.status === "committed") {
        onCommitted(ticket);
        return;
      }
      setReceipt(result);
    } catch (err) {
      if (client.current()) {
        setError(errorMessage(err));
        if (!client.replacement)
          setReceipt({
            status: "refused",
            detail:
              "Replacement was not sent. Close this dialog and select the backup again against the current Workspace.",
          });
      }
    } finally {
      if (client.current()) setBusy(false);
    }
  };
  const status = receipt.status;
  const message =
    status === "confirmation"
      ? "This replaces the current Workspace, including documents, comments and attachments. Download a complete backup first. Native threads will be detached and no run will start."
      : status === "running"
        ? "The server is still processing this replacement. Its result has not been confirmed. Check status; do not submit it again."
        : status === "refused"
          ? "The server refused this replacement. Load the current Workspace before making changes."
          : "The replacement outcome is unknown. It may already have committed. A server restart or expired receipt can prevent confirmation. Do not repeat the replacement to recover a lost response. Check status or inspect the current Workspace.";
  return h(
    Dialog,
    {
      open: true,
      onOpenChange: (value) => {
        if (!value && !busy && status === "confirmation") onClose();
      },
    },
    h(
      DialogContent,
      { className: "ws-dialog", showCloseButton: !busy && status === "confirmation" },
      h(
        DialogHeader,
        null,
        h(
          DialogTitle,
          null,
          status === "confirmation"
            ? "Replace Workspace from backup?"
            : "Workspace replacement status",
        ),
        h(DialogDescription, { className: "ws-dialog-description" }, message),
      ),
      busy &&
        h(
          "p",
          { role: "status" },
          status === "confirmation"
            ? "Replacing Workspace…"
            : "Checking replacement…",
        ),
      receipt.detail && h("p", null, receipt.detail),
      error && h("p", { className: "ws-error", role: "alert" }, error),
      inspection &&
        h(
          "p",
          { role: "status" },
          `Current readback: ${inspection.items.length} items, ${inspection.comments.length} comments, ${inspection.attachments.length} attachments. This readback does not confirm the replacement outcome. Editing remains paused.`,
        ),
      h(
        DialogFooter,
        { className: "ws-dialog-footer ws-recovery-actions" },
        status === "confirmation"
          ? [
              h(
                Action,
                { key: "cancel", disabled: busy, onClick: onClose },
                "Cancel",
              ),
              h(
                Action,
                {
                  key: "restore",
                  variant: "destructive",
                  disabled: busy,
                  onClick: () => void check(true),
                },
                "Replace Workspace",
              ),
            ]
          : [
              h(
                Action,
                { key: "check", disabled: busy, onClick: () => void check() },
                "Check replacement status",
              ),
              status === "unknown" &&
                inspection &&
                h(
                  Action,
                  {
                    key: "use",
                    disabled: busy,
                    onClick: () => onUseCurrent(ticket),
                  },
                  "Use current Workspace (outcome unknown)",
                ),
              status === "refused"
                ? h(
                    Action,
                    {
                      key: "load",
                      disabled: busy,
                      onClick: () => onRefused(ticket),
                    },
                    "Load current Workspace",
                  )
                : h(
                    Action,
                    {
                      key: "inspect",
                      disabled: busy,
                      onClick: async () => {
                        setBusy(true);
                        setError("");
                        try {
                          const state = await client.inspectRestore(ticket);
                          if (client.current()) setInspection(state);
                        } catch (err) {
                          if (client.current()) setError(errorMessage(err));
                        } finally {
                          if (client.current()) setBusy(false);
                        }
                      },
                    },
                    "Inspect current Workspace",
                  ),
            ],
      ),
    ),
  );
}
