import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@hermes/plugin-sdk";
import { editorStyles } from "./editor-styles.mjs";
import {
  EditorHistory,
  formatBlocks,
  toggleList,
  insertBlockHTML,
  pasteBlockHTML,
} from "./editor-commands.mjs";
import { anchorRange, CommentHighlights } from "./comment-highlights.jsx";
import { itemLabel } from "./item-labels.mjs";
import {
  h,
  Action,
  Choice,
  Codicon,
  FormDialog,
  errorMessage,
  UnsavedEditError,
} from "./ui.jsx";
import {
  sanitizeHTML,
  captureAnchor,
  escapeHTML,
  safeHref,
  workspaceHref,
  editorHTML,
  hydrateImages,
  hydrateChecklists,
  elementScale,
} from "./editor.mjs";
/** Native editing retains browser selection/undo; persisted and pasted HTML crosses one allowlist. */
export function RichEditor({
  item,
  locked: authorityLocked,
  interactionBlocked = false,
  onSave,
  onAnchor,
  onText,
  registerFlush,
  registerPendingFiles = () => {},
  onError,
  onLink,
  attachments = [],
  workspaceItems = [],
  onImage,
  draftBuffer = null,
  comments = [],
  activeComment = null,
  hoveredComment = null,
  onCommentHover = () => {},
  onCommentGeometry = () => {},
  pendingAnchor = null,
  onComment = () => {},
  registerFocus = () => {},
}) {
  const locked = authorityLocked || interactionBlocked;
  const root = useRef(null),
    timer = useRef(null),
    draft = useRef(null),
    saving = useRef(Promise.resolve()),
    latest = useRef({ item, locked, onSave, onText, onError });
  latest.current = {
    item,
    locked: authorityLocked,
    interactionBlocked,
    onSave,
    onText,
    onError,
  };
  const mounted = useRef(true),
    retained = useRef(null);
  const pendingSave = useRef(0),
    editRevision = useRef(0);
  const uploading = useRef(null),
    [imageBusy, setImageBusy] = useState(false);
  const history = useRef(new EditorHistory());
  const [recovery, setRecovery] = useState(() => draftBuffer?.read() ?? null);
  const [blockStyle, setBlockStyle] = useState("p");
  const [formats, setFormats] = useState({});
  const recoveryRef = useRef(recovery);
  recoveryRef.current = recovery;
  const [status, setStatus] = useState("Saved"),
    [saveError, setSaveError] = useState(""),
    [dialog, setDialog] = useState(null),
    [selection, setSelection] = useState(null),
    [floating, setFloating] = useState(null),
    [formatting, setFormatting] = useState(false);
  const suppressedSelection = useRef(null);
  const selectionToolbar = useRef(null),
    stylePickerOpen = useRef(false),
    dialogRef = useRef(null);
  dialogRef.current = dialog;
  const composing = useRef(false);
  const range = useRef(null),
    image = useRef(null);
  const decorate = () => {
    hydrateImages(root.current, attachments);
    hydrateChecklists(
      root.current,
      latest.current.locked ||
        latest.current.interactionBlocked ||
        Boolean(recoveryRef.current),
    );
  };
  const flushContent = () => {
    clearTimeout(timer.current);
    if (draft.current === null) return saving.current;
    if (recoveryRef.current)
      return Promise.reject(
        new Error("Recover or discard the retained draft before continuing."),
      );
    const html = draft.current,
      revision = editRevision.current;
    const savedToken = retained.current?.token;
    const save = latest.current.onSave;
    draft.current = null;
    pendingSave.current++;
    setStatus("Saving…");
    setSaveError("");
    const promise = saving.current
      .catch(() => {})
      .then(async () => {
        if (latest.current.locked)
          throw new Error(
            "This page is read-only while Hermes is working. Your unsaved text remains in the editor.",
          );
        await save(html);
      })
      .then(
        () => {
          if (savedToken) draftBuffer?.acknowledge(savedToken);
          if (
            mounted.current &&
            revision === editRevision.current &&
            draft.current === null
          )
            setStatus("Saved");
        },
        (error) => {
          if (revision === editRevision.current) {
            if (draft.current === null) draft.current = html;
            if (mounted.current) {
              setStatus("Not saved");
              setSaveError(errorMessage(error));
            }
          }
          throw new UnsavedEditError(
            `Content not saved: ${errorMessage(error)}`,
            () => root.current?.focus(),
          );
        },
      );
    const settled = promise.finally(() => {
      pendingSave.current--;
    });
    saving.current = settled;
    settled.catch(() => {});
    return settled;
  };
  const flush = async () => {
    if (uploading.current) await uploading.current;
    return flushContent();
  };
  useEffect(() => registerFlush(flush), [registerFlush, recovery]);
  useEffect(
    () => registerPendingFiles(() => uploading.current ?? Promise.resolve()),
    [registerPendingFiles],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  useLayoutEffect(() => {
    if (!root.current) return;
    const clean = sanitizeHTML(item.content);
    // Polling preserves local drafts; authoritative restores replace saved content even with focus.
    if (
      draft.current === null &&
      pendingSave.current === 0 &&
      editorHTML(root.current) !== clean
    ) {
      root.current.innerHTML = clean;
      history.current.reset(root.current);
    }
    decorate();
    if (history.current.index < 0) history.current.reset(root.current);
    onText(root.current.textContent);
  }, [item.content, locked, attachments, recovery]);
  const changed = (_event, recordHistory = true) => {
    if (
      latest.current.locked ||
      latest.current.interactionBlocked ||
      recoveryRef.current
    )
      return;
    if (recordHistory) history.current.record(root.current);
    draft.current = editorHTML(root.current);
    editRevision.current++;
    try {
      retained.current = draftBuffer?.put(draft.current, item.content) ?? null;
    } catch (error) {
      latest.current.onError(error);
    }
    decorate();
    latest.current.onText(root.current.textContent);
    setStatus("Unsaved changes");
    setSaveError("");
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => void flush().catch(latest.current.onError),
      650,
    );
  };
  const remember = () => {
    if (!root.current) return;
    const selected = getSelection();
    if (
      selected?.rangeCount &&
      root.current.contains(selected.anchorNode) &&
      root.current.contains(selected.focusNode)
    ) {
      range.current = selected.getRangeAt(0).cloneRange();
      setFormats(
        Object.fromEntries(
          [
            "bold",
            "italic",
            "underline",
            "insertUnorderedList",
            "insertOrderedList",
          ].map((command) => {
            let pressed = false;
            try {
              pressed = Boolean(document.queryCommandState?.(command));
            } catch {
              /* Unsupported browser state is not a saved format. */
            }
            return [command, pressed];
          }),
        ),
      );
      const captured = captureAnchor(root.current);
      setSelection(
        selected.isCollapsed ||
          JSON.stringify(captured) === suppressedSelection.current
          ? null
          : (captured ?? {
              quote: selected.toString(),
              unavailableAnchor: true,
            }),
      );
      let node =
        selected.anchorNode.nodeType === 3
          ? selected.anchorNode.parentElement
          : selected.anchorNode;
      const block =
        node?.closest?.("pre,blockquote") ?? node?.closest?.("p,h1,h2,h3");
      setBlockStyle(
        block && root.current.contains(block) ? block.localName : "p",
      );
      const rect = range.current.getBoundingClientRect?.();
      if (rect) {
        const scale = elementScale(root.current.ownerDocument.documentElement);
        const pane = root.current.closest(".ws-work")?.getBoundingClientRect();
        const top = Math.max(8, pane?.top ?? 0),
          bottom = Math.min(
            window.innerHeight,
            pane?.bottom ?? window.innerHeight,
          );
        setFloating(
          rect.bottom < top || rect.top > bottom
            ? null
            : {
                left: rect.left / scale,
                top: rect.top / scale,
                width: Math.max(1, rect.width / scale),
                height: Math.max(1, rect.height / scale),
              },
        );
      }
    } else if (!(
      selectionToolbar.current?.contains(document.activeElement) ||
      stylePickerOpen.current ||
      dialogRef.current
    )) {
      setSelection(null);
      setFloating(null);
    }
  };
  useEffect(() => {
    document.addEventListener("selectionchange", remember);
    const reposition = () => {
      const rect = range.current?.getBoundingClientRect?.();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
        setFloating(null);
        return;
      }
      remember();
    };
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("selectionchange", remember);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, []);
  const restoreSelection = (preventScroll = false) => {
    root.current.focus({ preventScroll: preventScroll === true });
    if (
      range.current &&
      root.current.contains(range.current.commonAncestorContainer)
    ) {
      const selected = getSelection();
      selected.removeAllRanges();
      selected.addRange(range.current);
    }
  };
  useEffect(() => {
    registerFocus((anchor) => {
      const passage = anchor && anchorRange(root.current, anchor);
      if (!passage) {
        restoreSelection(true);
        return;
      }
      range.current = passage;
      // Showing an existing discussion selects its passage for reading/copying;
      // it is not an intent to create a second comment on that selection.
      setSelection(null);
      setFloating(null);
      restoreSelection(true);
      suppressedSelection.current = JSON.stringify(captureAnchor(root.current));
      // Reveal the selected Range, not the enclosing block: a paragraph can
      // span several screens. Pane scroll offsets are in unscaled layout pixels.
      const pane = root.current.closest(".ws-work"),
        rect = passage.getBoundingClientRect?.();
      if (pane && rect) {
        const bounds = pane.getBoundingClientRect(),
          scale = elementScale(pane);
        const banner = pane
          .querySelector(".ws-run-banner")
          ?.getBoundingClientRect();
        const top =
          Math.max(
            0,
            bounds.top,
            banner && banner.top <= bounds.top + 1 ? banner.bottom : 0,
          ) +
          12 * scale;
        const bottom = Math.min(window.innerHeight, bounds.bottom) - 12 * scale;
        const delta =
          rect.top < top || rect.height > bottom - top
            ? rect.top - top
            : rect.bottom > bottom
              ? rect.bottom - bottom
              : 0;
        if (delta) pane.scrollTop += delta / scale;
      }
    });
    return () => registerFocus(null);
  }, []);
  const beginComment = () => {
    if (
      latest.current.locked ||
      latest.current.interactionBlocked ||
      recoveryRef.current
    )
      return;
    // A keyboard action may precede selectionchange/mouseup. Retain the live
    // editor range before focus(), which can collapse it in some DOM hosts.
    const selected = getSelection();
    if (
      selected?.rangeCount &&
      root.current.contains(selected.anchorNode) &&
      root.current.contains(selected.focusNode)
    )
      range.current = selected.getRangeAt(0).cloneRange();
    restoreSelection(true);
    const currentSelection = captureAnchor(root.current);
    if (
      currentSelection &&
      !latest.current.locked &&
      !latest.current.interactionBlocked &&
      !recoveryRef.current
    ) {
      range.current = getSelection().getRangeAt(0).cloneRange();
      suppressedSelection.current = JSON.stringify(currentSelection);
      onAnchor(currentSelection);
      setSelection(null);
    }
  };
  const command = (name, value) => {
    if (
      latest.current.locked ||
      latest.current.interactionBlocked ||
      recoveryRef.current
    )
      return;
    restoreSelection();
    history.current.record(root.current);
    let succeeded;
    if (name === "undo" || name === "redo") {
      succeeded = history.current.move(root.current, name === "undo" ? -1 : 1);
      if (succeeded) {
        hydrateImages(root.current, attachments);
        changed(null, false);
        remember();
      }
      return;
    }
    if (name === "formatBlock") succeeded = formatBlocks(root.current, value);
    else if (name === "insertUnorderedList" || name === "insertOrderedList")
      succeeded = toggleList(
        root.current,
        name === "insertUnorderedList" ? "ul" : "ol",
      );
    else if (name === "insertBlockHTML")
      succeeded = insertBlockHTML(root.current, value);
    else if (name === "pasteBlockHTML")
      succeeded = pasteBlockHTML(root.current, value);
    else succeeded = document.execCommand(name, false, value);
    if (!succeeded) {
      remember();
      return;
    }
    decorate();
    changed();
    remember();
  };
  const insert = (html, paste = false) => {
    const safe = sanitizeHTML(html),
      probe = document.createElement("template");
    probe.innerHTML = safe;
    const block = [...probe.content.children].some((node) =>
      /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE|HR)$/.test(node.tagName),
    );
    command(
      block ? (paste ? "pasteBlockHTML" : "insertBlockHTML") : "insertHTML",
      safe,
    );
  };
  const copyWithoutLayout = (event, cut = false) => {
    const selected = getSelection();
    if (!event.clipboardData || !selected?.rangeCount) return;
    const actual = selected.getRangeAt(0);
    if (
      !root.current.contains(actual.startContainer) ||
      !root.current.contains(actual.endContainer)
    )
      return;
    const fragment = actual.cloneContents();
    if (!fragment.querySelector("[data-workspace-comment-gap]")) return;
    // Native clipboard HTML would otherwise carry tall, empty layout boxes.
    // Keep portable hydrated images and rich content; use the same allowlist.
    const copy = root.current.ownerDocument.createElement("div");
    copy.append(fragment);
    event.preventDefault();
    event.clipboardData.setData("text/plain", selected.toString());
    event.clipboardData.setData(
      "text/html",
      editorHTML(copy, { attachmentReferences: false }),
    );
    if (cut && !locked && !recoveryRef.current) {
      range.current = actual.cloneRange();
      command("delete");
    }
  };
  const tool = (label, cmd, icon) =>
    h(
      Action,
      {
        key: label,
        className: "ws-format-tool",
        size: "icon-sm",
        "aria-label": label,
        title: label,
        variant: formats[cmd] ? "secondary" : "ghost",
        "aria-pressed": [
          "bold",
          "italic",
          "underline",
          "insertUnorderedList",
          "insertOrderedList",
        ].includes(cmd)
          ? Boolean(formats[cmd])
          : undefined,
        disabled: locked,
        onMouseDown: (e) => e.preventDefault(),
        onClick: () => command(cmd),
      },
      icon === "underline"
        ? h("span", {
            className: "ws-format-underline-glyph",
            "aria-hidden": true,
          })
        : h(Codicon, { name: icon, "aria-hidden": true }),
      h("span", { className: "ws-format-tool-label" }, label),
    );
  const selectionScale = floating
    ? elementScale(root.current?.ownerDocument.documentElement)
    : 1;
  const selectionBoundary = root.current?.closest(".ws-work");
  let selectionPadding = 8;
  if (floating && selectionScale !== 1) {
    const rect = selectionBoundary?.getBoundingClientRect();
    const left = Math.max(0, rect?.left ?? 0),
      top = Math.max(0, rect?.top ?? 0);
    const right = Math.min(
      window.innerWidth,
      rect
        ? rect.left + selectionBoundary.clientWidth * selectionScale
        : window.innerWidth,
    );
    const bottom = Math.min(
      window.innerHeight,
      rect
        ? rect.top + selectionBoundary.clientHeight * selectionScale
        : window.innerHeight,
    );
    // The native positioner consumes unscaled reference/layout coordinates.
    // Convert its public clipping inset to that same frame at UI Scale !=100%.
    selectionPadding = {
      left: left / selectionScale - left + 8,
      top: top / selectionScale - top + 8,
      right: right - right / selectionScale + 8,
      bottom: bottom - bottom / selectionScale + 8,
    };
  }
  return h(
    "section",
    { className: "ws-rich-editor", "aria-label": "Visual editor" },
    h("style", null, editorStyles),
    recovery &&
      h(
        "div",
        { className: "ws-banner", role: "status" },
        h(
          "span",
          null,
          "Recoverable draft retained for this source. Recovering replaces the editor text and autosaves it. ",
          recovery.base_html !== item.content
            ? "The saved page has also changed; review before recovering."
            : "",
        ),
        h(
          Action,
          {
            disabled: locked,
            onClick: () => {
              root.current.innerHTML = sanitizeHTML(recovery.html);
              recoveryRef.current = null;
              setRecovery(null);
              draft.current = editorHTML(root.current);
              editRevision.current++;
              decorate();
              history.current.reset(root.current);
              try {
                retained.current =
                  draftBuffer?.put(draft.current, item.content) ?? null;
              } catch (error) {
                onError(error);
              }
              onText(root.current.textContent);
              setStatus("Unsaved recovered draft");
              clearTimeout(timer.current);
              timer.current = setTimeout(
                () => void flush().catch(onError),
                650,
              );
            },
          },
          "Recover draft",
        ),
        h(
          Action,
          {
            onClick: () => {
              draftBuffer?.discard();
              setRecovery(null);
            },
          },
          "Discard retained draft",
        ),
      ),
    h(
      "div",
      { className: "ws-editor-heading" },
      h(
        Action,
        {
          variant: "secondary",
          className: "ws-format-toggle",
          disabled: locked || Boolean(recovery),
          "aria-expanded": formatting,
          "aria-controls": `ws-format-${item.id}`,
          onMouseDown: (event) => event.preventDefault(),
          onClick: () => setFormatting((v) => !v),
        },
        h(Codicon, { name: "text-size", "aria-hidden": true }),
        "Format text",
        h(Codicon, {
          name: formatting ? "chevron-up" : "chevron-down",
          "aria-hidden": true,
        }),
      ),
    ),
    h(
      "div",
      {
        id: `ws-format-${item.id}`,
        hidden: !formatting,
        className: "ws-toolbar ws-format-toolbar",
        role: "toolbar",
        "aria-label": "Formatting",
      },
      h(
        "fieldset",
        { disabled: locked || Boolean(recovery) },
        h(
          "div",
          { className: "ws-format-row" },
          h(
            "div",
            {
              className: "ws-format-group",
              role: "group",
              "aria-label": "Text style",
            },
            h(Choice, {
              label: "Block style",
              showLabel: false,
              onCloseAutoFocus: (event) => {
                event.preventDefault();
                restoreSelection(true);
              },
              value: blockStyle,
              disabled: locked,
              options: [
                ["p", "Text"],
                ["h1", "Heading 1"],
                ["h2", "Heading 2"],
                ["h3", "Heading 3"],
                ["blockquote", "Quote"],
                ["pre", "Code block"],
              ],
              onChange: (value) => command("formatBlock", value),
            }),
          ),
          h(
            "div",
            {
              className: "ws-format-group",
              role: "group",
              "aria-label": "Text emphasis",
            },
            [
              ["Bold", "bold", "bold"],
              ["Italic", "italic", "italic"],
              ["Underline", "underline", "underline"],
            ].map(([label, cmd, icon]) => tool(label, cmd, icon)),
          ),
          h(
            "div",
            {
              className: "ws-format-group",
              role: "group",
              "aria-label": "Lists",
            },
            tool("Bullets", "insertUnorderedList", "list-unordered"),
            tool("Numbered list", "insertOrderedList", "list-ordered"),
            h(
              Action,
              {
                variant: "ghost",
                size: "icon-sm",
                className: "ws-format-tool",
                "aria-label": "Checklist",
                title: "Checklist",
                disabled: locked,
                onMouseDown: (e) => e.preventDefault(),
                onClick: () => insert('<p><input type="checkbox"> Task</p>'),
              },
              h(Codicon, { name: "checklist", "aria-hidden": true }),
              h("span", { className: "ws-format-tool-label" }, "Checklist"),
            ),
          ),
          h(
            "div",
            {
              className: "ws-format-group ws-format-history",
              role: "group",
              "aria-label": "Edit history",
            },
            tool("Undo", "undo", "discard"),
            tool("Redo", "redo", "redo"),
          ),
        ),
        h(
          "div",
          {
            className: "ws-format-insert",
            role: "group",
            "aria-label": "Insert",
          },
          h(
            Action,
            {
              variant: "ghost",
              disabled: locked,
              onClick: () => setDialog("link"),
            },
            h(Codicon, { name: "link", "aria-hidden": true }),
            "Link",
          ),
          h(
            Action,
            {
              variant: "ghost",
              disabled: locked,
              onClick: () => setDialog("table"),
            },
            h(Codicon, { name: "table", "aria-hidden": true }),
            "Table",
          ),
          h(
            Action,
            {
              variant: "ghost",
              disabled: locked || imageBusy,
              onClick: () => image.current.click(),
            },
            h(Codicon, { name: "file-media", "aria-hidden": true }),
            "Image",
          ),
          h(
            Action,
            {
              variant: "ghost",
              disabled: locked,
              onClick: () => setDialog("database"),
            },
            h(Codicon, { name: "references", "aria-hidden": true }),
            "Workspace link",
          ),
        ),
      ),
    ),
    h(
      "div",
      { className: "ws-editor-canvas" },
      h("div", {
        ref: root,
        className: "ws-editor",
        role: "textbox",
        "aria-label": "Page content",
        "aria-multiline": true,
        "aria-readonly": locked || Boolean(recovery),
        tabIndex: 0,
        "data-placeholder": "Start writing…",
        contentEditable: !locked && !recovery,
        suppressContentEditableWarning: true,
        onInput: changed,
        onCompositionStart: () => {
          composing.current = true;
        },
        onCompositionEnd: () => {
          composing.current = false;
        },
        onCopy: copyWithoutLayout,
        onCut: (event) => copyWithoutLayout(event, true),
        onKeyDown: (event) => {
          const native = event.nativeEvent ?? event;
          // Window-capture host bindings have already had first refusal.
          // Never also run editing/history when the host claimed the chord.
          if (
            event.defaultPrevented ||
            native.defaultPrevented ||
            composing.current ||
            event.isComposing ||
            native.isComposing ||
            native.keyCode === 229
          )
            return;
          // The host capture dispatcher owns effective user bindings first.
          // A scoped bubbling fallback needs no permanent plugin registration.
          if (
            event.ctrlKey &&
            !event.metaKey &&
            event.altKey &&
            !event.shiftKey &&
            event.key.toLowerCase() === "b"
          ) {
            if (
              !locked &&
              !recoveryRef.current &&
              event.target === root.current
            ) {
              event.preventDefault();
              command("bold");
            }
            return;
          }
          if (
            event.key === "Tab" &&
            !event.shiftKey &&
            selectionToolbar.current &&
            getSelection()?.toString()
          ) {
            const first = selectionToolbar.current.querySelector("button");
            if (first) {
              event.preventDefault();
              first.focus();
              return;
            }
          }
          if (event.key === "Escape") {
            setSelection(null);
            setFloating(null);
            return;
          }
          if (
            (event.ctrlKey || event.metaKey) &&
            event.altKey &&
            event.key.toLowerCase() === "m"
          ) {
            event.preventDefault();
            beginComment();
            return;
          }
          if (
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            !event.shiftKey &&
            ["i", "u"].includes(event.key.toLowerCase())
          ) {
            event.preventDefault();
            command(event.key.toLowerCase() === "i" ? "italic" : "underline");
            return;
          }
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "z"
          ) {
            event.preventDefault();
            command(event.shiftKey ? "redo" : "undo");
          } else if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "y"
          ) {
            event.preventDefault();
            command("redo");
          }
        },
        onMouseUp: () => {
          suppressedSelection.current = null;
          remember();
        },
        onKeyUp: (e) => {
          if (e.key !== "Escape") {
            suppressedSelection.current = null;
            remember();
          }
        },
        onClick: (e) => {
          if (e.target.matches("input[type=checkbox]")) {
            if (locked || recoveryRef.current) {
              e.preventDefault();
              return;
            }
            e.target.toggleAttribute("checked", e.target.checked);
            changed();
          }
          if (e.target.closest("a")) {
            e.preventDefault();
            const href = e.target.closest("a").getAttribute("href");
            if (href?.startsWith("#workspace/"))
              onAnchor({ navigate: href.slice(11) });
            else if (safeHref(href)) onLink(href);
          }
        },
        onPaste: (e) => {
          e.preventDefault();
          if (locked) return;
          const html = e.clipboardData.getData("text/html");
          const text = e.clipboardData.getData("text/plain");
          const pasted = document.createElement("div");
          pasted.innerHTML = sanitizeHTML(
            html || escapeHTML(text).replace(/\n/g, "<br>"),
          );
          for (const image of pasted.querySelectorAll("img")) image.remove();
          insert(pasted.innerHTML, true);
        },
        onDrop: (e) => e.preventDefault(),
        onDragOver: (e) => e.preventDefault(),
        onBeforeInput: (e) => {
          if (locked || recoveryRef.current) {
            e.preventDefault();
            return;
          }
          const inputType = e.nativeEvent?.inputType;
          if (inputType === "historyUndo" || inputType === "historyRedo") {
            e.preventDefault();
            command(inputType === "historyUndo" ? "undo" : "redo");
          } else history.current.record(root.current);
        },
      }),
      h(CommentHighlights, {
        editorRef: root,
        comments,
        active: activeComment,
        pendingAnchor,
        onComment,
        hovered: hoveredComment,
        onHover: onCommentHover,
        onGeometry: onCommentGeometry,
      }),
    ),
    selection &&
      floating &&
      !pendingAnchor &&
      !locked &&
      !recovery &&
      !dialog &&
      h(
        Popover,
        {
          open: true,
          modal: false,
          onOpenChange: (open) => {
            if (!open) setSelection(null);
          },
        },
        h(
          PopoverTrigger,
          { asChild: true },
          h("span", {
            "aria-hidden": true,
            tabIndex: -1,
            className: "ws-selection-anchor",
            style: { position: "fixed", zoom: 1 / selectionScale, ...floating },
          }),
        ),
        h(
          PopoverContent,
          {
            ref: selectionToolbar,
            role: "toolbar",
            "aria-label": "Selected text actions",
            className: "ws-selection-popover ws-editor-selection-tools",
            variant: "menu",
            side: "top",
            align: "start",
            collisionBoundary: selectionBoundary,
            collisionPadding: selectionPadding,
            hideWhenDetached: true,
            onOpenAutoFocus: (event) => event.preventDefault(),
            onCloseAutoFocus: (event) => event.preventDefault(),
            onInteractOutside: (event) => {
              if (
                root.current?.contains(event.target) ||
                stylePickerOpen.current
              )
                event.preventDefault();
            },
            onEscapeKeyDown: (event) => {
              event.preventDefault();
              if (stylePickerOpen.current) return;
              suppressedSelection.current = JSON.stringify(selection);
              setSelection(null);
              restoreSelection();
            },
          },
          h(Choice, {
            label: "Text style",
            showLabel: false,
            value: ["p", "h1", "h2", "h3"].includes(blockStyle)
              ? blockStyle
              : "p",
            options: [
              ["p", "Text"],
              ["h1", "Heading 1"],
              ["h2", "Heading 2"],
              ["h3", "Heading 3"],
            ],
            onOpenChange: (open) => {
              stylePickerOpen.current = open;
            },
            onCloseAutoFocus: (event) => {
              event.preventDefault();
              restoreSelection(true);
            },
            onChange: (value) => command("formatBlock", value),
          }),
          ...[
            ["Bold", "bold", "B"],
            ["Italic", "italic", "I"],
            ["Underline", "underline", "U"],
          ].map(([label, cmd, glyph]) =>
            h(
              Action,
              {
                key: cmd,
                variant: formats[cmd] ? "secondary" : "ghost",
                size: "icon-sm",
                "aria-label": label,
                "aria-pressed": Boolean(formats[cmd]),
                title: label,
                onMouseDown: (event) => event.preventDefault(),
                onClick: () => command(cmd),
              },
              h(
                "span",
                { className: `ws-format-${cmd}`, "aria-hidden": true },
                glyph,
              ),
            ),
          ),
          h(
            Action,
            {
              variant: "ghost",
              onMouseDown: (event) => event.preventDefault(),
              onClick: () => setDialog("link"),
            },
            "Link",
          ),
          h(
            Action,
            {
              variant: "ghost",
              disabled: selection.unavailableAnchor,
              "aria-label": "Add comment on selection",
              title: selection.unavailableAnchor
                ? "Select a distinct passage to attach a comment."
                : "Comment on selected text",
              onMouseDown: (event) => event.preventDefault(),
              onClick: beginComment,
            },
            "Comment",
          ),
        ),
      ),
    h(
      "div",
      { className: "ws-save", role: "status", "aria-live": "polite" },
      locked
        ? "Read-only during this run"
        : ({
            Saved: "Content saved",
            "Saving…": "Saving content…",
            "Not saved": "Content not saved",
            "Unsaved changes": "Unsaved content",
            "Unsaved recovered draft": "Unsaved recovered content",
          }[status] ?? status),
      status === "Not saved" &&
        h(
          Action,
          {
            disabled: locked || Boolean(recovery),
            onClick: (event) => {
              const opener = event.currentTarget;
              void flush()
                .then(() => {
                  if (
                    document.activeElement === document.body ||
                    document.activeElement === opener
                  )
                    root.current?.focus();
                })
                .catch(onError);
            },
          },
          "Retry save",
        ),
    ),
    imageBusy &&
      h(
        "p",
        { role: "status", className: "ws-muted" },
        "Adding image… Leaving this page waits for the image and its saved content.",
      ),
    saveError &&
      h("p", { className: "ws-save-error", role: "alert" }, saveError),
    h("input", {
      ref: image,
      type: "file",
      accept: "image/png,image/jpeg,image/gif,image/webp",
      hidden: true,
      onChange: async (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        if (!file || uploading.current || locked) return;
        const savedRange = range.current?.cloneRange(),
          owner = root.current,
          initiatingControl = document.activeElement;
        setImageBusy(true);
        const job = Promise.resolve()
          .then(async () => {
            if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type))
              throw new Error("Choose a PNG, JPEG, GIF or WebP image.");
            const attachment = await onImage(file);
            if (
              !mounted.current ||
              root.current !== owner ||
              latest.current.item.id !== item.id
            )
              throw new Error(
                "The image attachment was retained, but this editor changed before insertion. Reopen the page to use its attachment.",
              );
            if (
              savedRange &&
              !owner.contains(savedRange.commonAncestorContainer)
            )
              throw new Error(
                "The image attachment was retained. Its insertion point changed; select a new location and try again.",
              );
            range.current = savedRange ?? null;
            const focused = document.activeElement,
              pane = owner.closest(".ws-work");
            const scroll = pane && [pane.scrollLeft, pane.scrollTop];
            try {
              insert(
                `<img src="attachment:${escapeHTML(attachment.id)}" alt="${escapeHTML(file.name)}">`,
              );
            } finally {
              if (
                focused?.isConnected &&
                focused !== document.body &&
                focused !== owner &&
                focused !== initiatingControl
              ) {
                focused.focus({ preventScroll: true });
                if (pane && scroll) {
                  pane.scrollLeft = scroll[0];
                  pane.scrollTop = scroll[1];
                }
              }
            }
          })
          .finally(() => {
            uploading.current = null;
            if (mounted.current) setImageBusy(false);
          });
        uploading.current = job;
        void job.catch(onError);
      },
    }),
    dialog &&
      h(FormDialog, {
        confirm: dialog === "table" ? "Insert table" : "Insert link",
        title:
          dialog === "table"
            ? "Insert table"
            : dialog === "database"
              ? "Link to Workspace item"
              : "Insert link",
        description:
          dialog === "database"
            ? "Choose a page, database, record or folder in this Workspace."
            : undefined,
        initial:
          dialog === "table"
            ? { rows: "2", columns: "2" }
            : { text: selection?.quote ?? "" },
        fields:
          dialog === "table"
            ? [
                { name: "rows", label: "Rows", type: "number" },
                { name: "columns", label: "Columns", type: "number" },
              ]
            : dialog === "database"
              ? [
                  {
                    name: "id",
                    label: "Workspace item",
                    options: [
                      ["", "Choose an item…"],
                      ...workspaceItems
                        .filter((other) => !other.deleted_at)
                        .map((other) => [
                          other.id,
                          itemLabel(other, workspaceItems, attachments),
                        ])
                        .sort((a, b) => a[1].localeCompare(b[1])),
                    ],
                  },
                  { name: "text", label: "Link text" },
                ]
              : [
                  { name: "url", label: "URL" },
                  { name: "text", label: "Link text" },
                ],
        onClose: () => {
          setDialog(null);
          requestAnimationFrame(() => restoreSelection(true));
        },
        returnFocus: root.current,
        onSuccessFocus: restoreSelection,
        onSubmit: async (values) => {
          if (dialog === "table") {
            const rows = Number(values.rows),
              cols = Number(values.columns);
            if (
              !Number.isInteger(rows) ||
              !Number.isInteger(cols) ||
              rows < 1 ||
              cols < 1 ||
              rows > 30 ||
              cols > 12
            )
              throw new Error("Use 1–30 rows and 1–12 columns.");
            insert(
              "<table><tbody>" +
                Array.from(
                  { length: rows },
                  () =>
                    "<tr>" +
                    Array.from({ length: cols }, () => "<td>Cell</td>").join(
                      "",
                    ) +
                    "</tr>",
                ).join("") +
                "</tbody></table>",
            );
          } else {
            if (
              dialog === "database" &&
              !workspaceItems.some(
                (other) => other.id === values.id && !other.deleted_at,
              )
            )
              throw new Error("Choose an available Workspace item.");
            const href =
              dialog === "database" ? workspaceHref(values.id) : values.url;
            if (!safeHref(href))
              throw new Error(
                "Use an https, http, mailto or valid Workspace link.",
              );
            insert(
              `<a href="${escapeHTML(href)}">${escapeHTML(values.text)}</a>`,
            );
          }
        },
      }),
  );
}
