import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Checkbox, Textarea, Popover, PopoverTrigger, PopoverContent, Tip } from "@hermes/plugin-sdk";
import { h, Action, Choice, Codicon, UnsavedEditError, FormDialog, isSubmitEnter } from "./ui.jsx";
import { CommentBubbles } from "./comment-bubbles.jsx";
import { numberComments, anchorRange } from "./comment-highlights.jsx";
import { ThreadPicker } from "./thread-picker.jsx";
import { commentStyles } from "./comment-styles.mjs";
import { CommentActions } from "./comment-actions.jsx";
import { AuthorHeader } from "./identity.jsx";
import { authorName } from "./identity.mjs";
import { itemLabel } from "./item-labels.mjs";
import { locateAnchor, visibleComments, commentAnchor } from "./editor.mjs";
function Comment({
  comment,
  text,
  command,
  locked,
  onError,
  state,
  active,
  onActivate,
  onPassage,
  passageNumber,
  retainedReply = "",
  retainReply = () => {},
  onResolutionFinished = () => {},
  onRevertSection = () => {},
  showContext = true,
  originalAnchor = comment.anchor,
  onDelete = () => {},
  onReplyPending = () => true,
}) {
  const [reply, setReply] = useState(retainedReply),
    [busy, setBusy] = useState(false), [replyOpen, setReplyOpen] = useState(Boolean(retainedReply));
  const replying = useRef(false);
  const location = locateAnchor(text, comment.anchor);
  return h(
    "article",
    {
      id: `ws-discussion-${comment.id}`,
      className: `ws-comment${active ? " ws-comment-active" : ""}`,
      tabIndex: -1,
      "aria-label": comment.text,
      onFocusCapture: () => onActivate(comment.id),
      onClick: () => onActivate(comment.id),
    },
    showContext && h(
      "div",
      { className: "ws-comment-meta" },
      h(
        "strong",
        null,
        h(AuthorHeader, {entry:comment}),
        passageNumber ? ` · Comment ${passageNumber}` : "",
      ),
      h(
        "span",
        { className: "ws-muted" },
        comment.resolved ? "Resolved" : "Unresolved",
      ),
    ),
    comment.anchor
      ? h(
          "div",
          { className: "ws-anchor" },
          location.status === "attached" &&
            h(
              Action,
              {
                className: "ws-comment-passage", variant: "text", style: { color: "var(--ui-text-secondary)" },
                "aria-label": `Show passage for comment ${passageNumber}`,
                onClick: () => onPassage(comment.id, comment.anchor),
              },
              `Show passage ${passageNumber}`,
            ),
          location.status === "detached" &&
            h(
              "div",
              null,
              h("p", { role: "status" }, "The original text is missing or ambiguous. This comment has not been attached elsewhere."),
              originalAnchor?.quote && h("details", { className: "ws-anchor-recovery" },
                h("summary", null, "Show original excerpt"),
                h("blockquote", null, originalAnchor.quote)),
            ),
        )
      : h("span", { className: "ws-muted" }, state.items.find(item => item.id === comment.item_id)?.kind === "database" ? "Whole database" : "Whole page"),
    h("p", null, comment.text),
    comment.target_item_ids?.length > 0 &&
      h(
        "div",
        { "aria-label": "Named edit targets" },
        h(
          "span",
          { className: "ws-muted" },
          "Referenced items; fresh run approval required: ",
        ),
        comment.target_item_ids.map((id) =>
          h(
            "span",
            { key: id, className: "ws-target" },
            itemLabel(state.items.find(i => i.id === id), state.items, state.attachments),
          ),
        ),
      ),
    comment.replies.map((reply) =>
      h(
        "div",
        { className: "ws-reply", key: reply.id,
          // Saved origin is display authority; names and literal content are not.
          "data-origin": reply.author === "user" ? "human" : reply.author === "agent" ? "agent" : "unknown" },
        h(AuthorHeader, {entry:reply}),
        h("p", null, reply.text),
      ),
    ),
    h(
      "details",
      { className: "ws-reply-compose", open: replyOpen, onToggle: event => setReplyOpen(event.currentTarget.open) },
      h("summary", null, "Reply"),
      h(
        "form",
        {
          onSubmit: async (e) => {
            e.preventDefault();
            if (locked || busy || replying.current || !reply.trim()) return;
            if (!onReplyPending(true)) return;
            replying.current = true;
            setBusy(true);
            try {
              await command("reply_comment", { id: comment.id, text: reply });
              setReply("");
              retainReply(comment.id, "");
            } catch (error) {
              onError(error);
            } finally {
              replying.current = false;
              onReplyPending(false);
              setBusy(false);
            }
          },
        },
        h(Textarea, {
          "aria-label": `Reply to ${comment.text}`,
          placeholder: "Reply…",
          value: reply,
          disabled: locked || busy,
          onChange: (e) => { setReply(e.target.value); retainReply(comment.id, e.target.value); },
        }),
        h(
          Action,
          { type: "submit", disabled: locked || busy || !reply.trim() },
          "Reply",
        ),
        reply && h(Action, { variant: "text", style: { color: "var(--ui-text-secondary)" }, disabled: busy, onClick: event => { setReply(""); retainReply(comment.id, ""); event.currentTarget.closest("form")?.querySelector("textarea")?.focus(); } }, "Discard reply"),
      ),
    ),
  );
}
export function Comments({
  item,
  state,
  text,
  anchor,
  setAnchor,
  activeComment,
  setActiveComment,
  showResolved = false,
  setShowResolved = () => {},
  returnToEditor = () => {},
  onPassage = () => {},
  command,
  workflow,
  run,
  locked,
  onError,
  onRun,
  onRefresh,
  draftBuffer,
  registerFlush,
  geometry = [],
  hoveredComment = null,
  setHoveredComment = () => {},
  onRevertSection = () => {},
}) {
  const retained = useRef(draftBuffer?.read()?.draft ?? {});
  const surfaces = useRef(null), opened = useRef(new Set()), pointerStart = useRef(null);
  if (activeComment) opened.current.add(activeComment);
  const composerId = useId();
  const resolvedControl = useRef(null);
  const resolvedAction = useRef(null), composeFromOptions = useRef(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const deletedIds = useRef(new Set());
  const mutationInFlight = useRef(false), composing = useRef(false);
  const actionInFlight = useRef(new Set());
  const [pendingActions, setPendingActions] = useState(new Set());
  const commentAction = async (comment, work) => {
    if (locked || busy || mutationInFlight.current || actionInFlight.current.has(comment.id)) return;
    actionInFlight.current.add(comment.id);
    setPendingActions(new Set(actionInFlight.current));
    try { await work(); }
    catch (error) { onError(error); }
    finally {
      actionInFlight.current.delete(comment.id);
      setPendingActions(new Set(actionInFlight.current));
    }
  };
  const revealFrame = useRef(null);
  const saveViewport = useRef(null);
  useEffect(() => () => { window.cancelAnimationFrame?.(revealFrame.current); saveViewport.current?.stop(); }, []);
  const retainSaveViewport = (pane = composer.current?.closest(".ws-work"), range = null) => {
    saveViewport.current?.stop();
    if (!pane) return;
    const view = pane.ownerDocument.defaultView, doc = pane.ownerDocument;
    const bounds = range?.getBoundingClientRect?.();
    const saved = { pane, top: pane.scrollTop, left: pane.scrollLeft, range, rangeTop: bounds?.height ? bounds.top : null, frame: null };
    saved.restore = () => {
      if (saveViewport.current !== saved || !pane.isConnected) return;
      pane.scrollTop = saved.top; pane.scrollLeft = saved.left;
      const next = saved.range?.startContainer.isConnected && saved.range.getBoundingClientRect?.();
      if (saved.rangeTop !== null && next?.height) pane.scrollTop += next.top-saved.rangeTop;
    };
    saved.stop = () => {
      view.cancelAnimationFrame(saved.frame);
      for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) doc.removeEventListener(type,saved.stop,true);
      if (saveViewport.current === saved) saveViewport.current = null;
    };
    // New user intent wins over completion of an older save. No input is blocked.
    for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) doc.addEventListener(type,saved.stop,{ capture:true, passive:true });
    saveViewport.current = saved;
  };
  useLayoutEffect(() => {
    const saved = saveViewport.current;
    if (!saved) return;
    saved.restore();
    if (!busy) {
      window.cancelAnimationFrame(saved.frame);
      saved.frame = window.requestAnimationFrame(() => {
        saved.restore();
        saved.frame = window.requestAnimationFrame(() => { saved.restore(); saved.stop(); });
      });
    }
  });
  const [resolutionFocus, setResolutionFocus] = useState(null);
  const discussion = useRef({ text: typeof retained.current.text === "string" ? retained.current.text : "",
    targets: Array.isArray(retained.current.targets) ? retained.current.targets.filter(id => typeof id === "string") : [],
    anchor: retained.current.anchor ?? null,
    replies: Object.fromEntries(Object.entries(retained.current.replies ?? {}).filter(([, value]) => typeof value === "string")) });
  const retentionError = useRef(null), [hasDraft, setHasDraft] = useState(Boolean(draftBuffer?.read()));
  const persist = patch => {
    discussion.current = { ...discussion.current, ...patch };
    const saved = discussion.current, meaningful = Boolean(saved.text || saved.targets.length || saved.anchor || Object.values(saved.replies).some(Boolean));
    setHasDraft(meaningful);
    try { if (meaningful) draftBuffer?.put(saved); else draftBuffer?.discard(); retentionError.current = null; }
    catch (err) { retentionError.current = err; onError(err); }
  };
  const retainReply = (id, value) => persist({ replies: { ...discussion.current.replies, [id]: value } });
  const [draft, setDraft] = useState(discussion.current.text),
    [busy, setBusy] = useState(false),
    [threads, setThreads] = useState(false),
    [targets, setTargets] = useState(discussion.current.targets);
  const composer = useRef(null), focusWholePage = useRef(false);
  const wholeScopeAction = useRef(null);
  const transferComposerFocus = useRef(false);
  const composerOwnsFocus = useRef(false);
  const composerAnchor = useRef(anchor), focusComposerOnMount = useRef(Boolean(anchor));
  if (composerAnchor.current !== anchor) {
    composerAnchor.current = anchor;
    focusComposerOnMount.current = Boolean(anchor);
  }
  const mountComposer = useCallback(node => {
    const previous = composer.current;
    if (!node && (previous?.closest("form")?.contains(document.activeElement) || composerOwnsFocus.current && document.activeElement === document.body)) transferComposerFocus.current = true;
    composer.current = node;
    if (node && (transferComposerFocus.current || focusComposerOnMount.current || focusWholePage.current)) {
      transferComposerFocus.current = false;
      focusComposerOnMount.current = false;
      node.focus({ preventScroll: true });
      window.cancelAnimationFrame?.(revealFrame.current);
      revealFrame.current = window.requestAnimationFrame?.(() => {
        // Opening intent reveals the composer itself, including its FIRST-row
        // Cancel. Tests must inspect this before scrolling or refocusing it.
        if (node.isConnected && node === document.activeElement)
          node.closest("form")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      });
    }
  }, []);
  useEffect(() => {
    if (JSON.stringify(discussion.current.anchor) !== JSON.stringify(anchor ?? null)) persist({ anchor: anchor ?? null });
    if (anchor || focusWholePage.current) composer.current?.focus({ preventScroll: true });
    focusWholePage.current = false;
  }, [anchor]);
  useEffect(() => registerFlush?.(async () => {
    if (retentionError.current) throw new UnsavedEditError("Feedback could not be retained. Copy or submit it before leaving.", () => composer.current?.focus());
  }), [registerFlush]);
  const cancel = () => {
    if (mutationInFlight.current) return;
    setAnchor(null);
    setDraft("");
    setTargets([]);
    persist({ text: "", targets: [], anchor: null });
    setPageComposerOpen(false);
    returnToEditor();
    if (item.kind === "database")
      (window.requestAnimationFrame ?? (fn => setTimeout(fn,0)))(() => wholeScopeAction.current?.focus());
  };
  const composeWholePage = () => {
    focusWholePage.current = true;
    setPageComposerOpen(true);
    setAnchor(null);
    (window.requestAnimationFrame ?? (fn => setTimeout(fn,0)))(() => {
      composer.current?.focus();
      focusWholePage.current = false;
    });
  };
  // Once authoritative state omits an ID, the normal client's monotonic
  // revision fence rejects older refreshes. Drop that temporary UI marker;
  // repeated add/delete cycles must not grow a per-page tombstone cache.
  const currentCommentIds = new Set(state.comments.map(c => c.id));
  for (const id of deletedIds.current) if (!currentCommentIds.has(id)) deletedIds.current.delete(id);
  for (const id of opened.current) if (!currentCommentIds.has(id)) opened.current.delete(id);
  const all = numberComments(state.comments.filter((c) => c.item_id === item.id && !deletedIds.current.has(c.id)))
    .map(c => ({ ...c, originalAnchor: c.anchor, anchor: commentAnchor(c) }));
  const [pageComposerOpen, setPageComposerOpen] = useState(Boolean(discussion.current.text || discussion.current.targets.length));
  useEffect(() => {
    const reply = all.find(c => discussion.current.replies[c.id]);
    if (reply && !activeComment) setActiveComment(reply.id);
  }, []);
  const unresolved = all.filter((c) => !c.resolved);
  useLayoutEffect(() => {
    if (!resolutionFocus) return;
    setResolutionFocus(null);
    const { id, card, control } = resolutionFocus;
    if (document.activeElement !== document.body && !card?.contains(document.activeElement)) return;
    const visible = visibleComments(all, showResolved), remaining = new Set(visible.map(c => c.id));
    const current = remaining.has(id) && (document.getElementById(`ws-discussion-${id}`) ?? document.getElementById(`ws-bubble-${id}`));
    if (current) {
      (control?.isConnected && !control.disabled ? control : current).focus();
      return;
    }
    const index = all.findIndex(c => c.id === id);
    const next = [...all.slice(index + 1), ...all.slice(0, index).reverse()].find(c => remaining.has(c.id));
    if (!next) { (resolvedAction.current ?? resolvedControl.current)?.focus(); return; }
    const bubble = document.getElementById(`ws-bubble-${next.id}`);
    if (bubble) bubble.focus();
    else {
      // A compact collision group renders one chosen discussion. Select its
      // next member before returning focus; never focus a removed card/body.
      setActiveComment(next.id);
      (window.requestAnimationFrame ?? (fn => setTimeout(fn,0)))(() => {
        if (document.activeElement === document.body || card?.contains(document.activeElement))
          (document.getElementById(`ws-bubble-${next.id}`) ?? resolvedAction.current ?? resolvedControl.current)?.focus();
      });
    }
  }, [resolutionFocus, all, showResolved]);
  const submit = async e => {
    e.preventDefault();
    if (locked || busy || mutationInFlight.current || composing.current || !discussion.current.text.trim()) return;
    mutationInFlight.current = true;
    const sent = { text: discussion.current.text, targets: [...discussion.current.targets], anchor: anchor ?? null };
    retainSaveViewport();
    setBusy(true);
    try {
      await command("add_comment", {
        item_id: item.id, text: sent.text, target_item_ids: sent.targets,
        ...(sent.anchor ? { anchor: sent.anchor } : {}),
      });
      if (discussion.current.text === sent.text && JSON.stringify(discussion.current.anchor) === JSON.stringify(sent.anchor)) {
        setDraft(""); setTargets([]); setAnchor(null);
        persist({ text: "", targets: [], anchor: null });
        returnToEditor();
      }
    } catch (error) { onError(error); }
    finally { mutationInFlight.current = false; setBusy(false); }
  };
  const composerElement = h(
    "form",
    {
      className: `ws-comment-composer${anchor ? " ws-comment-composer-anchored" : ""}`,
      onFocusCapture: () => { composerOwnsFocus.current = true; },
      onBlurCapture: event => { if (!event.currentTarget.contains(event.relatedTarget)) composerOwnsFocus.current = false; },
      onKeyDown: (e) => {
        if (e.key === "Escape" && !busy && !composing.current && !e.isComposing && !e.nativeEvent?.isComposing) {
          e.preventDefault();
          cancel();
        }
      },
      onSubmit: submit,
    },
    h(
      "div",
      { className: "ws-field" },
      h("div", { className: "ws-comment-compose-heading" },
        h("label", { htmlFor: composerId }, anchor ? "Comment on selection" : item.kind === "database" ? "Whole-database comment" : "Whole-page comment"),
        h(Action, { variant: "text", style: { color: "var(--ui-text-secondary)" }, disabled: busy, onClick: cancel }, "Cancel comment")),
      anchor &&
        h(
          "div",
          { className: "ws-anchor" },
          `“${anchor.quote}”`,
          locateAnchor(text, anchor).status === "detached" && h("p", { role: "status" }, "This passage changed. Your feedback is retained; choose a new passage or use the whole page."),
          h(
            Action,
            { variant: "text", style: { color: "var(--ui-text-secondary)" }, onClick: composeWholePage },
            "Use whole page",
          ),
        ),
      h(Textarea, {
        id: composerId,
        ref: mountComposer,
        "aria-label": "New comment",
        value: draft,
        disabled: locked || busy,
        onCompositionStart: () => { composing.current = true; },
        onCompositionEnd: () => { composing.current = false; },
        onKeyDown: event => {
          if (event.key !== "Enter" || !event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
          if (composing.current || !isSubmitEnter(event)) return;
          // No global listener/remapping. The real host dispatcher must be
          // independently qualified; a host-claimed event never also posts.
          if (event.defaultPrevented) return;
          event.preventDefault(); event.stopPropagation();
          if (event.repeat || locked || busy || mutationInFlight.current) return;
          event.currentTarget.form?.requestSubmit();
        },
        placeholder: anchor
          ? "Describe the requested change…"
          : item.kind === "database" ? "Leave feedback on this database…" : "Leave feedback on this page…",
        onChange: (e) => { setDraft(e.target.value); persist({ text: e.target.value }); },
      }),
    ),
    h(Tip, { label: "Add comment (Ctrl+Enter)" },
      h(Action, { type: "submit", disabled: locked || busy || !draft.trim() },
        busy ? "Adding comment…" : "Add comment", h(Codicon, { name: "arrow-right", "aria-hidden": true }))),
  );
  const visible = visibleComments(all, showResolved);
  const attached = new Set(geometry.map(p => p.id));
  useEffect(() => {
    if (!activeComment) return;
    const doc = surfaces.current?.ownerDocument;
    if (!doc) return;
    let pointer = false, tabFocus = false, tabFrame = null;
    const popup = '[role="dialog"],[role="menu"],[role="listbox"],[data-slot="popover-content"],[data-slot="dropdown-menu-content"]';
    const protectedTarget = target => target?.closest?.('.ws-bubble') === doc.getElementById(`ws-bubble-${activeComment}`)?.closest('.ws-bubble') ||
      target?.closest?.('.ws-passage-controls') || target?.closest?.(popup) || doc.querySelector(popup);
    const passageHit = event => {
      const editor = event.target?.closest?.('.ws-editor');
      if (!editor || event.target.closest('a,input') || !doc.getSelection()?.isCollapsed) return false;
      return geometry.some(position => {
        const range = anchorRange(editor, position.anchor);
        return [...(range?.getClientRects?.() ?? [])].some(r =>
          event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom);
      });
    };
    const collapse = target => {
      if (deleting || locked || busy || mutationInFlight.current || actionInFlight.current.size || protectedTarget(target)) return;
      const pane = doc.getElementById(`ws-bubble-${activeComment}`)?.closest('.ws-work');
      const selection = doc.getSelection(), range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      retainSaveViewport(pane, pane?.contains(range?.startContainer) ? range : null);
      setActiveComment(null);
    };
    const down = () => { pointer = true; tabFocus = false; };
    const click = event => {
      pointer = false;
      if (!event.defaultPrevented && !event.target?.closest?.('.ws-bubble') && !passageHit(event)) collapse(event.target);
    };
    const key = event => {
      tabFocus = event.key === 'Tab' && !event.isComposing;
      if (tabFocus) {
        pointer = false;
        doc.defaultView.cancelAnimationFrame(tabFrame);
        tabFrame = doc.defaultView.requestAnimationFrame(() => { tabFocus = false; });
      }
    };
    const focus = event => {
      const keyboard = tabFocus; tabFocus = false;
      // Passage navigation and section-reading recovery move focus internally.
      // Only a user's Tab transition is outside keyboard intent.
      if (!pointer && keyboard) collapse(event.target);
    };
    const cancelPointer = () => { pointer = false; };
    // Wait for a pointer gesture to finish before collapsing. Native focus,
    // selections and portaled dialog/popover interactions keep their lifecycle.
    doc.addEventListener('pointerdown', down, true);
    doc.addEventListener('pointercancel', cancelPointer, true);
    doc.addEventListener('click', click);
    doc.addEventListener('focusin', focus);
    doc.addEventListener('keydown', key, true);
    return () => {
      doc.removeEventListener('pointerdown', down, true);
      doc.removeEventListener('pointercancel', cancelPointer, true);
      doc.removeEventListener('click', click);
      doc.removeEventListener('focusin', focus);
      doc.removeEventListener('keydown', key, true);
      doc.defaultView.cancelAnimationFrame(tabFrame);
    };
  }, [activeComment, geometry, deleting, locked, busy, setActiveComment]);
  const select = id => {
    setActiveComment(id);
    (window.requestAnimationFrame ?? (fn => setTimeout(fn,0)))(() => document.getElementById(`ws-discussion-${id}`)?.focus({ preventScroll: true }));
  };
  const bubble = (comment, grouped = false) => {
    const number = comment.passageNumber;
    const selected = activeComment === comment.id;
    const detached = comment.anchor && !attached.has(comment.id);
    const context = `Comment ${number}${comment.anchor ? detached ? " · Detached" : "" : item.kind === "database" ? " · Whole database" : " · Whole page"}`;
    return h("section", { key: comment.id, className: `ws-bubble${selected ? " ws-bubble-selected" : ""}${hoveredComment === comment.id ? " ws-bubble-emphasis" : ""}`,
      onPointerDown: event => { pointerStart.current = [event.clientX, event.clientY]; },
      onClick: event => {
        if (event.target.closest('button,input,textarea,select,a,summary,[role="button"],[role="checkbox"],[contenteditable="true"]')) return;
        if (pointerStart.current && Math.hypot(event.clientX-pointerStart.current[0], event.clientY-pointerStart.current[1]) > 4) return;
        const selection = event.currentTarget.ownerDocument.getSelection();
        if (!selection?.isCollapsed && selection?.rangeCount && selection.getRangeAt(0).intersectsNode(event.currentTarget)) return;
        select(comment.id);
      },
      onKeyDown: event => {
        if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.nativeEvent?.isComposing ||
            event.target.closest('[role="dialog"],[role="menu"],[data-slot="popover-content"]') || actionInFlight.current.size) return;
        event.preventDefault(); event.stopPropagation();
        retainSaveViewport(event.currentTarget.closest('.ws-work'));
        setActiveComment(null);
        document.getElementById(`ws-bubble-${comment.id}`)?.focus({ preventScroll: true });
      },
      onPointerEnter: () => setHoveredComment(comment.id), onPointerLeave: () => setHoveredComment(null),
      onFocusCapture: () => setHoveredComment(comment.id), onBlurCapture: event => { if (!event.currentTarget.contains(event.relatedTarget)) setHoveredComment(null); } },
      h("div", { className: "ws-comment-heading" },
      h(Action, { id: `ws-bubble-${comment.id}`, className: "ws-bubble-summary", variant: "ghost", "aria-expanded": selected,
        "aria-label": `${context}: ${comment.text} · ${authorName(comment)} · ${selected ? "Collapse comment" : "Expand comment"}`,
        "aria-controls": selected ? `ws-discussion-${comment.id}` : undefined,
        onClick: () => selected ? setActiveComment(null) : select(comment.id) },
        h("span", { className: "ws-bubble-author" }, h(AuthorHeader, {entry:comment}),
          h("span", {className:"ws-bubble-context"}, `${!grouped ? context : `Comment ${number}`}${comment.resolved ? " · Resolved" : ""}`)),
        !selected && h("span", { className: "ws-bubble-preview" }, comment.text),
        h("span", { className: "ws-bubble-context" }, `${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"}`)),
      h(CommentActions, { comment, locked: locked || busy, pending: pendingActions.has(comment.id),
        onResolve: resolved => {
          const card = document.getElementById(`ws-discussion-${comment.id}`) ?? document.getElementById(`ws-bubble-${comment.id}`)?.closest("section");
          const control = document.activeElement, ownedFocus = card?.contains(control);
          return commentAction(comment, async () => {
            try { await command("resolve_comment", { id: comment.id, resolved }); }
            finally { if (ownedFocus) setResolutionFocus({ id: comment.id, card, control }); }
          });
        },
        onDelete: opener => { if (!locked && !busy && !actionInFlight.current.has(comment.id)) setDeleting({ comment, opener }); },
        onRevert: opener => commentAction(comment, () => onRevertSection(comment, opener)),
      })),
      opened.current.has(comment.id) && h("div", { className: "ws-comment-body", hidden: !selected },
      h(Comment, { comment, text, command, locked: locked || pendingActions.has(comment.id), onError, state, retainedReply: discussion.current.replies[comment.id] ?? "", retainReply,
        onReplyPending: value => {
          if (value && actionInFlight.current.has(comment.id)) return false;
          if (value) actionInFlight.current.add(comment.id); else actionInFlight.current.delete(comment.id);
          setPendingActions(new Set(actionInFlight.current));
          return true;
        },
        passageNumber: number, originalAnchor: comment.originalAnchor, active: true, onActivate: setActiveComment, onPassage, onResolutionFinished: setResolutionFocus,
        onDelete: (comment, opener) => setDeleting({ comment, opener }),
        onRevertSection, showContext: false })));
  };
  const linkedThread = h("details", { className: "ws-linked-thread" },
    h("summary", null, "Linked Hermes thread"),
    h(
      "p",
      { className: "ws-muted" },
      item.thread_id
        ? `Native thread: ${item.thread_id}`
        : "A native thread will be created on the first run and reused.",
    ),
    h(
      "div",
      { className: "ws-actions" },
      h(
        Action,
        {
          disabled: !item.thread_id || busy,
          onClick: () =>
            void workflow.openThread(item.thread_id).catch(error => onError(error, { operation: "openThread" })),
        },
        "Open thread",
      ),
      h(
        Action,
        {
          disabled: locked || busy,
          onClick: () => setThreads(true),
        },
        "Select existing thread",
      ),
    ),
    threads && h(ThreadPicker, { workflow, itemId: item.id, locked,
      onBound: onRefresh, onClose: () => setThreads(false) }),
    run &&
      h(
        "p",
        { role: "status" },
        `Run ${run.status}${run.error ? `: ${run.error}` : ""}`,
      ));
  const header = h("div", null,
    h(
      "div",
      { className: "ws-comments-heading" },
      h("h2", null, "Comments"),
      h(
        "span",
        {
          className: "ws-comment-count",
          "aria-label": `${unresolved.length} unresolved comments`,
        },
        String(unresolved.length),
      ),
    ),
    !all.length ? h(Action, { ref: wholeScopeAction, disabled: locked || busy,
      "aria-label": item.kind === "database" ? "Add database comment" : "Add whole-page comment",
      onClick: composeWholePage }, item.kind === "database" ? "Add database comment" : "Add whole-page comment") : h(
      "div",
      { className: "ws-actions" },
      unresolved.length ? h(
        Action,
        {
          disabled: locked || busy || !unresolved.length,
          "aria-label": `Address comments (${unresolved.length})`,
          onClick: async () => {
            setBusy(true);
            try {
              await onRun();
            } catch (e) {
              onError(e, { operation: "runStart", itemId: item.id, pageTitle: item.title });
            } finally {
              setBusy(false);
            }
          },
        },
        `Address (${unresolved.length})`,
      ) : h(Action, { ref: resolvedAction, variant: "text", style: { color: "var(--ui-text-secondary)" },
        onClick: () => setShowResolved(!showResolved) }, `${showResolved ? "Hide" : "Show"} resolved (${all.length})`),
    ),
    all.length > 0 && h(Popover, { open: optionsOpen, onOpenChange: setOptionsOpen },
      h(PopoverTrigger, { asChild: true }, h(Action, { ref: resolvedControl, variant: "ghost", size: "icon-xs", "aria-label": "Comment options" }, h(Codicon, { name: "ellipsis" }))),
      h(PopoverContent, { align: "end", className: "ws-comment-options",
        onCloseAutoFocus: event => { if (composeFromOptions.current) { event.preventDefault(); composeFromOptions.current = false; } } },
        h("label", { className: "ws-check" }, h(Checkbox, { className: "ws-checkbox",
          "aria-label": "Show resolved comments", checked: showResolved,
          onCheckedChange: value => setShowResolved(value === true) }), "Show resolved comments"),
        h(Action, { variant: "text", style: { color: "var(--ui-text-secondary)" }, disabled: locked || busy,
          "aria-label": item.kind === "database" ? "Add database comment" : "Add whole-page comment",
          onClick: () => { composeFromOptions.current = true; setOptionsOpen(false); composeWholePage(); } }, item.kind === "database" ? "Comment on database" : "Comment on whole page"))),
    hasDraft && h("p", { className: "ws-comment-action-state", role: "status" }, "Unsubmitted feedback is retained for this Workspace."),
    linkedThread);
  const footer = h("div", null,
    visible.some(c => !c.anchor) && h("h2", null, item.kind === "database" ? "Database feedback" : "Page feedback"),
    visible.filter(c => !c.anchor).map(comment => bubble(comment)),
    visible.some(c => c.anchor && !attached.has(c.id)) && h("h2", null, "Detached passages"),
    visible.filter(c => c.anchor && !attached.has(c.id)).map(comment => bubble(comment)),
    anchor && locateAnchor(text,anchor).status !== "attached" && !attached.has("__workspace-comment-draft") && composerElement,
    !anchor && (pageComposerOpen ? composerElement : all.length > 0 && h(Action, { ref: wholeScopeAction, disabled: locked || busy, onClick: composeWholePage }, item.kind === "database" ? "Comment on database" : "Comment on whole page")),
    !all.length && h("p", { className: "ws-muted" }, item.kind === "database" ? "No comments yet." : "Select a passage to add a comment beside it."),
);
  return h("div", { ref: surfaces, className: "ws-comment-surfaces" },
    h("style", null, commentStyles),
    deleting && h(FormDialog, {
      title: "Delete comment?", confirm: "Delete comment", destructive: true,
      description: "This deletes this discussion and all its replies. Document text and saved section history are kept. Agent edits will not be reverted.",
      returnFocus: deleting.opener, submitDisabled: locked,
      onClose: () => setDeleting(null),
      onSuccessFocus: () => {
        const next = all.find(c => c.id !== deleting.comment.id && (!c.resolved || showResolved));
        if (next) { setActiveComment(next.id); requestAnimationFrame(() => document.getElementById(`ws-bubble-${next.id}`)?.focus()); }
        else { setActiveComment(null); (resolvedControl.current ?? wholeScopeAction.current)?.focus(); }
      },
      onSubmit: async () => {
        if (locked || busy || mutationInFlight.current || actionInFlight.current.size) throw new Error("Wait for the current operation before deleting this comment.");
        mutationInFlight.current = true; setBusy(true);
        try {
          await command("delete_comment", { id: deleting.comment.id });
          deletedIds.current.add(deleting.comment.id);
          const replies = { ...discussion.current.replies }; delete replies[deleting.comment.id];
          persist({ replies });
          if (activeComment === deleting.comment.id) setActiveComment(null);
          if (hoveredComment === deleting.comment.id) setHoveredComment(null);
        } finally { mutationInFlight.current = false; setBusy(false); }
      },
    }),
    h(CommentBubbles, { geometry: geometry.filter(p => !deletedIds.current.has(p.id)), header, footer,
    renderGroup: ids => {
      const comments = ids.map(id => visible.find(c => c.id === id)).filter(Boolean);
      return h("div", null,
        ids.includes("__workspace-comment-draft") && h("div", { className: "ws-bubble ws-bubble-selected" }, composerElement),
        ...comments.map(comment => bubble(comment)));
    } }));
}
