import { SelectTrigger, DropdownMenuTrigger, PopoverTrigger, Select, SelectContent, Dialog, DialogContent, DropdownMenu, DropdownMenuContent, Popover, PopoverContent } from "./owned-popups.jsx";
import { createElement as h, cloneElement, Children, useState, useRef, useLayoutEffect } from "react";
import * as nativeSdk from "@hermes/plugin-sdk";
import { elementScale } from "./editor.mjs";
import {
  Button,
  Input,
  Textarea,
  SelectValue,
  SelectItem,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenuItem,
  Tip,
  Codicon,
} from "@hermes/plugin-sdk";
export { h, Button, Input, Textarea, Codicon };
/** A retained edit already explains its failure beside the relevant field. */
export class UnsavedEditError extends Error {
  constructor(message, focus) { super(message); this.name = "UnsavedEditError"; this.focus = focus; }
}
// The newer public SDK owns this policy. Older supported SDKs do not export
// the helper, so probe the public namespace without raising the plugin ABI floor.
export function isSubmitEnter(event) {
  if (typeof nativeSdk.isSubmitEnter === "function")
    return nativeSdk.isSubmitEnter(event);
  const native = event.nativeEvent ?? event;
  return event.key === "Enter" && !(
    event.isComposing || native.isComposing ||
    event.keyCode === 229 || native.keyCode === 229
  );
}
const fallbackDateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
/** Prefer the supported host formatter without adding a required SDK export. */
export function savedTime(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "Saved time unavailable";
  const formatter = typeof nativeSdk.fmtDateTime?.format === "function" ? nativeSdk.fmtDateTime : fallbackDateTime;
  const timeZone = formatter.resolvedOptions?.().timeZone;
  const zone = new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: "short" })
    .formatToParts(date).find(part => part.type === "timeZoneName")?.value;
  return `${formatter.format(date)}${zone ? ` ${zone}` : ""}`;
}
export function versionChoices(versions) {
  const labels = versions.map(version => savedTime(version.created_at));
  const counts = new Map();
  labels.forEach(label => counts.set(label, (counts.get(label) ?? 0) + 1));
  return versions.map((version, index) => [version.id,
    counts.get(labels[index]) > 1
      ? `${labels[index]} · version ${index + 1}` : labels[index]]);
}
/** Keep public validation detail readable, with transport diagnostics separate. */
export function errorMessage(error) {
  const raw = error?.message ?? String(error);
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const detail = JSON.parse(raw.slice(jsonStart)).detail;
      if (typeof detail === "string") return detail;
    } catch { /* A plain message needs no transport decoding. */ }
  }
  return raw.replace(/^.*?failed\s*\(\d+\):\s*/i, "");
}
/** Context belongs to the operation, never a word matched inside a diagnostic. */
export function operationError(error, context = {}) {
  const detail = errorMessage(error);
  if (context?.operation === "search") return "Workspace search could not finish. Try searching again.";
  if (context?.operation === "threads") return "Native threads could not be loaded for this connection.";
  if (context?.operation === "openThread") return "The native thread could not be opened.";
  if (context?.operation === "bindThread") return "The native thread could not be linked to this page.";
  if (context?.operation === "run") return "Hermes could not start this Workspace run.";
  if (context?.operation === "runStart") return `Hermes could not confirm that edits started for ${context.pageTitle ? `“${context.pageTitle}”` : "this page"}. Review the page and ${context.threadId ? "its linked thread" : "the connection"} before starting another run.`;
  if (context?.operation === "runStatus") return `The run status for ${context.pageTitle ? `“${context.pageTitle}”` : "this page"} could not be checked. Native execution may still continue. Review ${context.threadId ? "the linked thread and " : ""}the page before taking another action.`;
  if (context?.operation === "import") {
    const name = context.fileName ? `“${context.fileName}”` : "The selected file";
    if (/\.docx$/i.test(context.fileName ?? "") && /zip|central directory|malformed|invalid word/i.test(detail))
      return `${name} could not be read as a Word document. Choose a valid .docx file.`;
    return `${name} could not be imported. ${detail}`;
  }
  return detail;
}
/** Native poppers share the pane boundary; UI Scale uses layout-pixel insets. */
function popupBounds(opener) {
  const boundary = opener?.closest(".ws-work") ?? opener?.closest(".ws-root") ?? undefined;
  const scale = elementScale(opener), rect = boundary?.getBoundingClientRect();
  const view = opener?.ownerDocument.defaultView;
  let padding = 8;
  if (rect && scale !== 1) {
    const left = Math.max(0, rect.left), top = Math.max(0, rect.top),
      right = Math.min(view.innerWidth, rect.right), bottom = Math.min(view.innerHeight, rect.bottom);
    padding = { left: left/scale-left+8, top: top/scale-top+8,
      right: right-right/scale+8, bottom: bottom-bottom/scale+8 };
  }
  return { boundary, padding, scale, width: rect && (Math.min(view.innerWidth, rect.right) - Math.max(0, rect.left)) / scale - 16 };
}
function usePopupContainment(content, bounds) {
  // The pinned native popper's fixed translate is itself zoomed by the
  // host at UI Scale !=100%. Its public collision props constrain size but do
  // not correct that final viewport translation. Keep native placement/focus,
  // then clip only this public content element back into the owning pane.
  useLayoutEffect(() => {
    if (!content || !bounds.scale || bounds.scale === 1) return;
    const boundary = bounds.boundary ?? content.ownerDocument.documentElement;
    const view = content.ownerDocument.defaultView;
    let frame, x = 0, y = 0;
    const contain = () => {
      const pane = boundary.getBoundingClientRect(), rect = content.getBoundingClientRect(), scale = elementScale(content);
      const left = Math.max(0, pane.left) + 8 * scale, top = Math.max(0, pane.top) + 8 * scale,
        right = Math.min(view.innerWidth, pane.right) - 8 * scale, bottom = Math.min(view.innerHeight, pane.bottom) - 8 * scale;
      const originX = rect.left - x * scale, originY = rect.top - y * scale;
      const nextX = (Math.max(left, Math.min(originX, right - rect.width)) - originX) / scale,
        nextY = (Math.max(top, Math.min(originY, bottom - rect.height)) - originY) / scale;
      if (Math.abs(nextX-x) > .1 || Math.abs(nextY-y) > .1) {
        x = nextX; y = nextY; content.style.translate = `${x}px ${y}px`;
      }
    };
    const schedule = () => { view.cancelAnimationFrame(frame); frame = view.requestAnimationFrame(contain); };
    const observer = new ResizeObserver(schedule);
    observer.observe(content); observer.observe(boundary);
    view.addEventListener("resize", schedule); content.ownerDocument.addEventListener("scroll", schedule, true);
    schedule();
    return () => {
      view.cancelAnimationFrame(frame); observer.disconnect();
      view.removeEventListener("resize", schedule); content.ownerDocument.removeEventListener("scroll", schedule, true);
      content.style.removeProperty("translate");
    };
  }, [content, bounds]);
}
/** Long native labels share the existing scaled-pane containment policy. */
export function ContextTip({ label, children }) {
  const [bounds, setBounds] = useState({ boundary: undefined, padding: 8 }), [content, setContent] = useState(null);
  usePopupContainment(content, bounds);
  return h(Tip, { label: h("span", { style: { display: "block", whiteSpace: "normal", overflowWrap: "anywhere" } }, label),
    // Tip also uses collisionPadding to decide whether its trigger is hidden.
    // Its width is bounded explicitly; keep the native trigger clip inset.
    ref: setContent, collisionBoundary: bounds.boundary, collisionPadding: 8,
    style: { maxWidth: bounds.width ? Math.max(1, bounds.width) : "calc(100vw - 16px)" } },
    cloneElement(children, { onMouseEnter: event => {
      children.props.onMouseEnter?.(event); setBounds(popupBounds(event.currentTarget));
    }, onFocus: event => {
      children.props.onFocus?.(event); setBounds(popupBounds(event.currentTarget));
    } }));
}
/** Public native contextual forms use the same pane/scale policy as menus and choices. */
export function ContextPopover({ open, onOpenChange, trigger, triggerTip, children, returnFocusOnEscape = false, ...contentProps }) {
  const opener = useRef(null), [bounds, setBounds] = useState({ boundary: undefined, padding: 8 });
  const [content, setContent] = useState(null);
  usePopupContainment(content, bounds);
  const nativeTrigger = h(PopoverTrigger, { asChild: true }, cloneElement(trigger, { ref: opener }));
  return h(Popover, { open, onOpenChange: next => {
    if (next) setBounds(popupBounds(opener.current));
    onOpenChange(next);
  } },
    triggerTip ? h(Tip, { label: triggerTip }, nativeTrigger) : nativeTrigger,
    h(PopoverContent, { ref: setContent, collisionBoundary: bounds.boundary, collisionPadding: bounds.padding,
      ...contentProps,
      ...(returnFocusOnEscape ? {
        onEscapeKeyDown: event => {
          contentProps.onEscapeKeyDown?.(event);
          if (!event.defaultPrevented) opener.current?.focus({ preventScroll: true });
        },
        onCloseAutoFocus: event => {
          contentProps.onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const document = opener.current?.ownerDocument, active = document?.activeElement;
          // Native unmount autofocus is deferred. Preserve focus already returned
          // on Escape, or advanced by a subsequent Tab/outside interaction.
          if (active?.isConnected && active !== document.body && !content?.contains(active))
            event.preventDefault();
        },
      } : {}) }, children));
}
/** Retains command handlers while native Radix owns focus, dismissal and keys. */
export function ActionMenu({
  label,
  children,
  disabled = false,
  triggerLabel = label,
  triggerProps = {},
  showChevron = true,
  align = "end",
  open,
  onOpenChange,
  onCloseAutoFocus,
}) {
  const opener = useRef(null);
  const openingPointer = useRef(null);
  const [menuBounds, setMenuBounds] = useState({ boundary: undefined, padding: 8 });
  const [content, setContent] = useState(null);
  usePopupContainment(content, menuBounds);
  const changeOpen = value => {
    if (!value) openingPointer.current = null;
    if (value && opener.current) {
      setMenuBounds(popupBounds(opener.current));
    }
    onOpenChange?.(value);
  };
  return h(
    DropdownMenu,
    { open, onOpenChange: changeOpen },
    h(
      DropdownMenuTrigger,
      { asChild: true },
      h(
        Action,
        {
          ref: opener,
          variant: "ghost",
          disabled,
          ...triggerProps,
          onPointerDownCapture: event => {
            triggerProps.onPointerDownCapture?.(event);
            openingPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          },
          "aria-label": label,
        },
        triggerLabel,
        showChevron && h(Codicon, { name: "chevron-down" }),
      ),
    ),
    h(
      DropdownMenuContent,
      { ref: setContent, align, className: "ws-menu", onCloseAutoFocus, collisionBoundary: menuBounds.boundary, collisionPadding: menuBounds.padding,
        style: {
          maxWidth: "min(32rem, var(--radix-dropdown-menu-content-available-width, 100vw))",
          maxHeight: "min(30rem, var(--radix-dropdown-menu-content-available-height, 80vh))",
        } },
      Children.toArray(children).map(
        (child) =>
          child &&
          h(
            DropdownMenuItem,
            {
              key: child.key,
              disabled: child.props.disabled,
              onPointerDownCapture: () => { openingPointer.current = null; },
              onPointerUpCapture: event => {
                const start = openingPointer.current;
                openingPointer.current = null;
                // Native menu collision/scale placement may move a row beneath
                // the opener during the opening press. A stationary release
                // must not become an unintended selection. A deliberate drag
                // or subsequent item press keeps the native behavior.
                if (start?.id === event.pointerId && Math.hypot(event.clientX-start.x,event.clientY-start.y) < 4)
                  event.preventDefault();
              },
              onFocus: child.props.onFocus,
              onSelect: (event) => {
                // Dialogs need a return target that survives menu dismissal.
                opener.current?.focus({ preventScroll: true });
                child.props.onClick?.(event, opener.current);
              },
            },
            child.props.children,
          ),
      ),
    ),
  );
}
export function Choice({
  label,
  value = "",
  options = [],
  onChange,
  disabled = false,
  showLabel = true,
  triggerProps = {},
  onOptionFocus,
  onOpenChange,
  onCloseAutoFocus,
  displayValue,
}) {
  const opener = useRef(null);
  const [bounds, setBounds] = useState({ boundary: undefined, padding: 8 });
  const [content, setContent] = useState(null);
  const selectedOption = options.find(option => Array.isArray(option) && String(option[0]) === String(value));
  const selectedPath = selectedOption?.[2]?.path;
  usePopupContainment(content, bounds);
  const changeOpen = value => {
    if (value) setBounds(popupBounds(opener.current));
    onOpenChange?.(value);
  };
  return h(
    "label",
    { className: "ws-choice" },
    showLabel && h("span", { className: "ws-label" }, label),
    h(
      Select,
      {
        value: (() => { const index = options.findIndex(option => String(Array.isArray(option) ? option[0] : option) === String(value)); return index < 0 ? "" : `choice:${index}`; })(),
        onValueChange: key => { const match = /^choice:(\d+)$/.exec(key); if (!match) return; const option = options[Number(match[1])]; if (option !== undefined) onChange(String(Array.isArray(option) ? option[0] : option)); },
        disabled,
        onOpenChange: changeOpen,
      },
      h(SelectTrigger, { ref: opener, "aria-label": label, className: "ws-choice-trigger", title: selectedPath, ...triggerProps }, h(SelectValue, { className: "ws-choice-value" }, displayValue ?? selectedPath)),
      h(
        SelectContent,
        { ref: setContent, onCloseAutoFocus, className: "ws-choice-content", collisionBoundary: bounds.boundary, collisionPadding: bounds.padding,
          style: { maxWidth: "min(32rem, var(--radix-select-content-available-width, 100vw))",
            maxHeight: "min(18rem, var(--radix-select-content-available-height, 80vh))" } },
        options.map((option, index) => {
          const [id, text, hierarchy] = Array.isArray(option) ? option : [option, option];
          return h(
            SelectItem,
            { key: `choice:${index}`, value: `choice:${index}`, onFocus: onOptionFocus ? () => onOptionFocus(id) : undefined,
              ...(hierarchy && {
                textValue: text,
                // Radix normally names an option from its title-only ItemText.
                "aria-labelledby": undefined,
                "aria-label": hierarchy.path,
                title: hierarchy.path,
                style: { paddingInlineStart: `${8 + hierarchy.depth * 14}px` },
              }) },
            text,
          );
        }),
      ),
    ),
  );
}
export function Action({ children, onClick, ...props }) {
  return h(
    Button,
    {
      variant: "secondary",
      size: "sm",
      type: "button",
      onClick,
      ...props,
    },
    children,
  );
}
export function Field({ label, ...props }) {
  return h(
    "label",
    { className: "ws-field" },
    h("span", { className: "ws-label" }, label),
    h(Input, { "aria-label": label, ...props }),
  );
}
/** Read-only details and multi-action surfaces use the public native dialog,
 * with their own actions inside its scrollable body rather than inside a menu. */
export function ContentDialog({ title, description, children, onClose, returnFocus, busy = false, skipReturnFocus = () => false }) {
  const opener = useRef(returnFocus ?? document.activeElement);
  return h(Dialog, { open: true, onOpenChange: open => { if (!open && !busy) onClose(); } },
    h(DialogContent, {
      className: "ws-dialog", showCloseButton: !busy,
      onCloseAutoFocus: event => {
        event.preventDefault();
        if (!skipReturnFocus() && opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      },
    }, h(DialogHeader, null, h(DialogTitle, null, title),
      description && h(DialogDescription, { className: "ws-dialog-description" }, description)),
    children,
    h(DialogFooter, { className: "ws-dialog-footer" }, h(Action, { disabled: busy, onClick: onClose }, "Close"))));
}
export function FormDialog({
  title,
  description,
  fields = [],
  initial = {},
  confirm = "Save",
  onSubmit,
  onClose,
  onSuccessFocus,
  returnFocus,
  renderHelp,
  destructive = false,
  focusConfirm = false,
  submitDisabled = false,
  recoveryAction,
  errorSummary,
}) {
  const opener = useRef(returnFocus ?? document.activeElement);
  const returnScope = useRef(opener.current?.closest('[aria-label="Database"]') ??
    opener.current?.closest(".ws-work") ?? opener.current?.closest(".ws-root")?.querySelector(".ws-work"));
  const confirmButton = useRef(null);
  const submitted = useRef(false);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return h(
    Dialog,
    { open: true, onOpenChange: (v) => !v && !busy && onClose() },
    h(
      DialogContent,
      {
        className: "ws-dialog",
        showCloseButton: !busy,
        onOpenAutoFocus: focusConfirm ? (event) => {
          event.preventDefault();
          confirmButton.current?.focus();
        } : undefined,
        onCloseAutoFocus: (event) => {
          event.preventDefault();
          if (submitted.current && onSuccessFocus) {
            onSuccessFocus();
            return;
          }
          if (opener.current?.isConnected)
            opener.current.focus({ preventScroll: true });
          else if (returnScope.current?.isConnected) {
            // Successful removal can delete its opener. Stay in the surviving
            // table/page context using the existing native focus lifecycle.
            const scope = returnScope.current;
            const target = [...scope.querySelectorAll("textarea,input,button,a[href],[tabindex]")]
              .find(node => {
                const closed = node.closest("details:not([open])");
                return node.tabIndex >= 0 && !node.matches(":disabled,[aria-disabled=true]") &&
                  (!closed || closed.querySelector(":scope > summary")?.contains(node)) &&
                  node.getClientRects().length && node.checkVisibility?.({ checkVisibilityCSS: true }) !== false;
              });
            (target ?? scope).focus({ preventScroll: true });
          }
        },
      },
      h(
        DialogHeader,
        null,
        h(DialogTitle, null, title),
        description && h(DialogDescription, { className: "ws-dialog-description" }, description),
      ),
      h(
        "form",
        {
          onSubmit: async (e) => {
            e.preventDefault();
            if (busy || submitDisabled) return;
            setBusy(true);
            setError("");
            try {
              await onSubmit(values);
              submitted.current = true;
              onClose();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          },
        },
        fields
          .filter((field) => !field.when || field.when(values))
          .map((field) =>
            field.options
              ? h(Choice, {
                  key: field.name,
                  label: field.label,
                  value: values[field.name] ?? "",
                  options: field.options,
                  disabled: busy,
                  onChange: (value) =>
                    setValues((v) => ({ ...v, [field.name]: value })),
                })
              : h(Field, {
                  key: field.name,
                  label: field.label,
                  type: field.type ?? "text",
                  required: field.required !== false,
                  disabled: busy,
                  value: values[field.name] ?? "",
                  onChange: (e) =>
                    setValues((v) => ({ ...v, [field.name]: e.target.value })),
                }),
          ),
        renderHelp?.(values),
        error && h("div", { role: "alert" },
          h("p", null, errorSummary || error),
          errorSummary && h("details", null,
            h("summary", null, "Technical details"), h("pre", null, error))),
        h(
          DialogFooter,
          { className: "ws-dialog-footer" },
          recoveryAction && h(Action, { disabled: busy, onClick: async () => {
            setBusy(true);
            setError("");
            try { await recoveryAction.onClick(); }
            catch (err) { setError(errorMessage(err)); }
            finally { setBusy(false); }
          } }, recoveryAction.label),
          h(Action, { disabled: busy, onClick: onClose }, "Cancel"),
          h(Button, { ref: confirmButton, type: "submit", "aria-label": confirm, disabled: submitDisabled, variant: destructive ? "destructive" : "default", loading: busy }, confirm),
        ),
      ),
    ),
  );
}
