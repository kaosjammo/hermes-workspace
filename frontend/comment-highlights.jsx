import { useId, useLayoutEffect, useRef, useState } from "react";
import { h, Action, ActionMenu } from "./ui.jsx";
import { locateAnchor, elementScale } from "./editor.mjs";

/** Display ordinals are derived before filtering, never persisted as identity.
 * Keep a supplied ordinal when a consumer receives an already filtered view. */
export function numberComments(comments) {
  return comments.map((comment, index) => ({
    ...comment,
    passageNumber: Number.isSafeInteger(comment.passageNumber) && comment.passageNumber > 0
      ? comment.passageNumber : index + 1,
  }));
}

/** Translate textContent offsets to live ranges without changing editor nodes. */
export function anchorRange(root, anchor) {
  const location = locateAnchor(root.textContent, anchor);
  if (location.status !== "attached") return null;
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  let node,
    offset = 0,
    start = null,
    end = null;
  while ((node = walker.nextNode())) {
    const next = offset + node.length;
    if (!start && location.start >= offset && location.start < next)
      start = [node, location.start - offset];
    if (location.end > offset && location.end <= next) {
      end = [node, location.end - offset];
      break;
    }
    offset = next;
  }
  if (!start || !end) return null;
  const range = root.ownerDocument.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  return range;
}

/** One discussion can address several replacements without highlighting gaps. */
export function anchorRanges(root, anchor) {
  if (locateAnchor(root.textContent, anchor).status !== "attached") return [];
  const ranges = (anchor.ranges ?? [anchor]).map(value => anchorRange(root, value));
  return ranges.every(Boolean) ? ranges : [];
}

/** CSS highlights and gutter controls are presentation only, never saved HTML. */
export function CommentHighlights({
  editorRef,
  comments,
  active,
  pendingAnchor,
  onComment,
  hovered = null,
  onHover = () => {},
  onGeometry = () => {},
}) {
  const callbacks = useRef({ onHover, onGeometry });
  callbacks.current = { onHover, onGeometry };
  const token = "ws-passage-" + useId().replace(/[^a-z0-9]/gi, "");
  const [groups, setGroups] = useState([]),
    [openGroup, setOpenGroup] = useState(null);
  const selectedDiscussion = useRef(false);
  const signature = JSON.stringify(
    comments.map((c) => [c.id, c.anchor, c.resolved, c.passageNumber, c.text]),
  );
  useLayoutEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const view = root.ownerDocument.defaultView;
    const raf =
      view.requestAnimationFrame?.bind(view) ??
      ((fn) => view.setTimeout(fn, 0));
    const caf =
      view.cancelAnimationFrame?.bind(view) ?? view.clearTimeout.bind(view);
    let frame = null;
    let current = [],
      currentGroups = [];
    const registry = globalThis.CSS?.highlights;
    const paint = () => {
      const base = root.parentElement.getBoundingClientRect();
      const layoutRoot = root.closest(".ws-layout") ?? root.parentElement;
      const layout = layoutRoot.getBoundingClientRect(), scale = elementScale(layoutRoot);
      current = numberComments(comments)
        .filter((c) => c.anchor)
        .map((c) => {
          const ranges = anchorRanges(root, c.anchor);
          return { comment: c, number: c.passageNumber, ranges, range: ranges[0] };
        })
        .filter((c) => c.range);
      if (registry && globalThis.Highlight) {
        // Native ::selection paints the full line box, including space reserved
        // for an inline discussion. Paint the unchanged native Range with the
        // host selection token instead, so only its text receives that colour.
        const selection = root.ownerDocument.getSelection();
        const decoratedSelection = root.querySelector("[data-workspace-comment-gap]") &&
          selection?.rangeCount && !selection.isCollapsed &&
          root.contains(selection.anchorNode) && root.contains(selection.focusNode);
        root.classList.toggle("ws-text-selection", Boolean(decoratedSelection));
        const selected = new Highlight(...(decoratedSelection ? [selection.getRangeAt(0).cloneRange()] : []));
        selected.priority = 10;
        registry.set(token + "-selection", selected);
        registry.set(token, new Highlight(...current.flatMap((c) => c.ranges)));
        registry.set(
          token + "-hover",
          new Highlight(...current.filter(c => c.comment.id === hovered).flatMap(c => c.ranges)),
        );
        registry.set(
          token + "-active",
          new Highlight(
            ...current
              .filter((c) => c.comment.id === active)
              .flatMap((c) => c.ranges),
          ),
        );
        const draft = pendingAnchor && anchorRange(root, pendingAnchor);
        registry.set(
          token + "-draft",
          new Highlight(...(draft ? [draft] : [])),
        );
      }
      const rows = current
        .map(({ comment, range, number }) => {
          const rect = range.getClientRects?.()[0];
          return (
            rect && {
              id: comment.id,
              quote: comment.anchor.quote,
              text: comment.text,
              top: (rect.top - base.top) / scale,
              index: number,
            }
          );
        })
        .filter(Boolean);
      // Keep multiple discussions on the actual line, using the native menu.
      currentGroups = [];
      for (const row of rows.sort((a, b) => a.top - b.top)) {
        const group = currentGroups.at(-1);
        if (group && Math.abs(group.top - row.top) < 24)
          group.markers.push(row);
        else currentGroups.push({ id: row.id, top: row.top, markers: [row] });
      }
      setGroups(currentGroups);
      const geometry = current.map(({ comment, range, number }) => {
        const rect = range.getClientRects?.()[0];
        if (!rect) return null;
        const end = range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement;
        const block = end?.closest("p,li,h1,h2,h3,h4,blockquote,pre,td,th") ?? root;
        const bounds = block.getBoundingClientRect();
        return { id: comment.id, number, anchor: comment.anchor, top: (rect.top-layout.top)/scale, bottom: (rect.bottom-layout.top)/scale,
          block, slotBlock: block.closest("table") ?? block, lineGroup: currentGroups.find(group => group.markers.some(marker => marker.id === comment.id))?.id ?? comment.id,
          blockBottom: (bounds.bottom-layout.top)/scale };
      }).filter(Boolean);
      if (pendingAnchor) {
        const draft = anchorRange(root,pendingAnchor), rect = draft?.getClientRects?.()[0];
        if (rect) {
          const end = draft.endContainer.nodeType === 1 ? draft.endContainer : draft.endContainer.parentElement;
          const block = end?.closest("p,li,h1,h2,h3,h4,blockquote,pre,td,th") ?? root;
          geometry.push({ id: "__workspace-comment-draft", anchor: pendingAnchor, top: (rect.top-layout.top)/scale, bottom: (rect.bottom-layout.top)/scale,
            block, slotBlock: block.closest("table") ?? block,
            lineGroup: currentGroups.find(group => Math.abs(group.top-(rect.top-base.top)/scale)<24)?.id ?? "__workspace-comment-draft",
            blockBottom: (block.getBoundingClientRect().bottom-layout.top)/scale });
        }
      }
      callbacks.current.onGeometry(geometry);
    };
    const schedule = () => {
      caf(frame);
      frame = raf(paint);
    };
    const observer = new view.MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    const resize = globalThis.ResizeObserver
      ? new ResizeObserver(schedule)
      : null;
    resize?.observe(root);
    if (root.closest(".ws-document")) resize?.observe(root.closest(".ws-document"));
    window.addEventListener("resize", schedule);
    root.ownerDocument.addEventListener("selectionchange", schedule);
    root.addEventListener("load", schedule, true);
    const hit = (event) =>
      current.filter(({ ranges }) =>
        ranges.flatMap(range => [...(range.getClientRects?.() ?? [])]).some(
          (r) =>
            event.clientX >= r.left &&
            event.clientX <= r.right &&
            event.clientY >= r.top &&
            event.clientY <= r.bottom,
        ),
      );
    const click = (event) => {
      if (!getSelection()?.isCollapsed || event.target.closest?.("a,input"))
        return;
      const match = hit(event);
      if (match.length === 1) onComment(match[0].comment.id);
      else if (match.length > 1)
        setOpenGroup(
          currentGroups.find((g) =>
            g.markers.some((m) => m.id === match[0].comment.id),
          )?.id ?? null,
        );
    };
    const hover = (event) => {
      const match = event.type === "pointerleave" ? null : hit(event)[0];
      callbacks.current.onHover(match?.comment.id ?? null);
      root.style.cursor = match ? "pointer" : "";
      if (registry && globalThis.Highlight)
        registry.set(
          token + "-hover",
          new Highlight(...(match ? match.ranges : [])),
        );
    };
    root.addEventListener("click", click);
    root.addEventListener("pointermove", hover);
    root.addEventListener("pointerleave", hover);
    paint();
    return () => {
      caf(frame);
      observer.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", schedule);
      root.ownerDocument.removeEventListener("selectionchange", schedule);
      root.removeEventListener("load", schedule, true);
      root.removeEventListener("click", click);
      root.removeEventListener("pointermove", hover);
      root.removeEventListener("pointerleave", hover);
      root.style.cursor = "";
      registry?.delete(token);
      registry?.delete(token + "-active");
      registry?.delete(token + "-draft");
      registry?.delete(token + "-hover");
      registry?.delete(token + "-selection");
      root.classList.remove("ws-text-selection");
    };
  }, [signature, active, pendingAnchor, token, hovered]);
  return h(
    "div",
    { className: "ws-passage-controls" },
    h(
      "style",
      null,
      `::highlight(${token}){background:color-mix(in srgb,var(--ui-accent) 19%,transparent);text-decoration:underline;text-decoration-color:var(--ui-accent)}::highlight(${token}-active),::highlight(${token}-hover),::highlight(${token}-draft){background:color-mix(in srgb,var(--ui-accent) 35%,transparent);text-decoration:underline double;text-decoration-color:var(--ui-accent);text-decoration-thickness:2px}::highlight(${token}-selection){background:var(--ui-selection-background);color:inherit}.ws-editor.ws-text-selection::selection,.ws-editor.ws-text-selection *::selection{background:transparent;color:inherit}`,
    ),
    groups.map((group) => {
      const marker = group.markers[0];
      const triggerProps = {
        className: "ws-passage-marker",
        style: { top: group.top },
        "aria-pressed": group.markers.some((m) => m.id === active),
        onPointerEnter: () => callbacks.current.onHover(marker.id),
        onPointerLeave: () => callbacks.current.onHover(null),
        onFocus: () => callbacks.current.onHover(marker.id),
        onBlur: () => callbacks.current.onHover(null),
      };
      if (group.markers.length === 1)
        return h(
          Action,
          {
            key: group.id,
            variant: "ghost",
            ...triggerProps,
            "aria-label": `Open comment ${marker.index}: ${marker.quote}`,
            onClick: () => onComment(marker.id),
          },
          String(marker.index),
        );
      return h(
        ActionMenu,
        {
          key: group.id,
          label: `Open comments ${group.markers.map((m) => m.index).join(", ")} on this line`,
          triggerLabel: `${marker.index}+`,
          triggerProps,
          showChevron: false,
          align: "start",
          open: openGroup === group.id,
          onOpenChange: (open) => setOpenGroup(open ? group.id : null),
          onCloseAutoFocus: (event) => {
            if (selectedDiscussion.current) {
              event.preventDefault();
              selectedDiscussion.current = false;
            }
          },
        },
        group.markers.map((m) =>
          h(
            Action,
            {
              key: m.id,
              onFocus: () => callbacks.current.onHover(m.id),
              onClick: () => {
                selectedDiscussion.current = true;
                onComment(m.id);
              },
            },
            `Comment ${m.index}: ${m.quote.slice(0, 48)} — ${m.text.slice(0, 72)}${active === m.id ? " (active)" : ""}`,
          ),
        ),
      );
    }),
  );
}
