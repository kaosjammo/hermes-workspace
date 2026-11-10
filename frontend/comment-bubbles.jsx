import { useLayoutEffect, useRef, useState } from "react";
import { h } from "./ui.jsx";
import { elementScale } from "./editor.mjs";
import { anchorRange } from "./comment-highlights.jsx";

function passageGroups(geometry, inline) {
  const result = [];
  for (const position of [...geometry].sort((a,b) => a.top-b.top)) {
    const block = inline ? position.slotBlock ?? position.block : position.block;
    const group = result.find(g => g.block === block && ((inline && block?.tagName === "TABLE") || g.lineGroup === position.lineGroup));
    if (group) { group.ids.push(position.id); group.members.push(position); }
    else result.push({ ...position, block, ids: [position.id], members: [position] });
  }
  return result;
}

/** One margin in the document's scroll context. Inline space is decoration only:
 * editorHTML/history rebuild the allowlist and never retain these CSS values. */
export function CommentBubbles({ geometry, header, footer, renderGroup }) {
  const aside = useRef(null), headerRef = useRef(null), footerRef = useRef(null);
  const slots = useRef(new Map()), frame = useRef(null);
  const gaps = useRef(new Map());
  const paneSize = useRef(null), resizeFocus = useRef(null), focusFrame = useRef(null);
  const settledFocus = useRef(null);
  const [layout, setLayout] = useState({ groups: [], footer: 0, header: 0, height: 0, inline: false });
  const latest = useRef(null); latest.current = { geometry, renderGroup };
  const groups = passageGroups(geometry,layout.inline);
  const signature = groups.map(g => g.ids.join(",")).join(";");
  const groupRefs = useRef(new Map());
  const blockKeys = useRef(new WeakMap()), blockSequence = useRef(0);
  const blockKey = block => {
    if (!blockKeys.current.has(block)) blockKeys.current.set(block,`passage-block-${++blockSequence.current}`);
    return blockKeys.current.get(block);
  };
  const groupKey = group => `${blockKey(group.block)}:${group.lineGroup ?? "paragraph"}`;
  useLayoutEffect(() => {
    const root = aside.current?.closest(".ws-layout"), page = root?.querySelector(".ws-document");
    if (!root || !page) return;
    const view = root.ownerDocument.defaultView;
    const raf = view.requestAnimationFrame?.bind(view) ?? (fn => view.setTimeout(fn,0));
    const caf = view.cancelAnimationFrame?.bind(view) ?? view.clearTimeout.bind(view);
    const pane = root.closest(".ws-work");
    const cancelResizeFocus = () => {
      resizeFocus.current = null;
      caf(focusFrame.current);
      view.clearTimeout(settledFocus.current);
    };
    const revealOwnedFocus = final => {
      const target = resizeFocus.current;
      if (final) resizeFocus.current = null;
      if (target?.isConnected && root.ownerDocument.activeElement === target)
        target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    };
    const restore = block => {
      const saved = slots.current.get(block);
      if (!saved) return;
      block.style[saved.property] = saved.value;
      if (!block.getAttribute("style")) block.removeAttribute("style");
      slots.current.delete(block);
    };
    const measure = () => {
      const layoutStyle = view.getComputedStyle(root);
      const inline = layoutStyle.getPropertyValue("--ws-inline-comments").trim() === "1";
      const controlsGap = parseFloat(layoutStyle.getPropertyValue("--ws-comment-controls-gap")) || 20;
      const editor = page.querySelector(".ws-editor");
      // Keep the comment margin beside the native-sized reading column as the
      // pane grows. Databases retain their full-width table/board composition.
      const editorWidth = editor && view.getComputedStyle(editor).maxWidth;
      if (!inline && editorWidth?.endsWith("px")) {
        const pageStyle = view.getComputedStyle(page);
        root.style.maxWidth = `${parseFloat(editorWidth) + parseFloat(pageStyle.paddingLeft) + parseFloat(pageStyle.paddingRight) + (aside.current?.offsetWidth ?? 300)}px`;
      } else root.style.removeProperty("max-width");
      const base = root.getBoundingClientRect(), pageBounds = page.getBoundingClientRect(), scale = elementScale(root);
      const pane = root.closest(".ws-work"), size = pane && [pane.clientWidth,pane.clientHeight];
      if (size && paneSize.current && size.some((value,index) => value !== paneSize.current[index])) {
        const focused = root.ownerDocument.activeElement;
        if (aside.current?.contains(focused)) resizeFocus.current = focused;
      }
      paneSize.current = size;
      const controlSlot = page.querySelector(".ws-comment-controls-slot");
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      if (controlSlot) controlSlot.style.height = inline ? `${headerHeight+controlsGap}px` : "0px";
      const current = latest.current.geometry;
      const byBlock = passageGroups(current.filter(p => p.block?.isConnected),inline);
      const used = new Set(inline ? byBlock.filter(g => g.block.tagName === "TABLE").map(g => g.block) : []);
      for (const block of slots.current.keys()) if (!used.has(block)) restore(block);
      const gapKeys = new Set(inline ? byBlock.filter(g => g.block.tagName !== "TABLE").map(groupKey) : []);
      for (const [key,gap] of gaps.current) if (!gapKeys.has(key)) {
        gap.remove(); gaps.current.delete(key);
      }
      const headerTop = inline && controlSlot ? (controlSlot.getBoundingClientRect().top-base.top)/scale : (pageBounds.top-base.top)/scale+32;
      let bottom = inline ? 0 : headerTop+headerHeight+20;
      const positions = [];
      for (const group of byBlock) {
        const key = groupKey(group), height = groupRefs.current.get(key)?.offsetHeight ?? 84;
        let top;
        if (inline && group.block.tagName === "TABLE") {
          let saved = slots.current.get(group.block);
          if (!saved) {
            // A table's parallel cells must stay unobstructed. Reserve the
            // inline discussion slot after the whole table using its margin.
            const property = "marginBottom";
            saved = { property, value: group.block.style[property], base: parseFloat(view.getComputedStyle(group.block)[property])||0, allocated: 0 };
            slots.current.set(group.block,saved);
          }
          const allocated = height+24;
          if (saved.allocated !== allocated) {
            saved.allocated = allocated;
            group.block.style[saved.property] = `${saved.base+allocated}px`;
          }
          top = (group.block.getBoundingClientRect().bottom-base.top)/scale+8;
        } else if (inline && editor) {
          // Reserve space beneath the actual selection line, rather than after
          // an arbitrarily long paragraph. This empty inline box adds no text,
          // breaks no rich structure and is excluded by editorHTML snapshots.
          const ranges = group.members.map(member => anchorRange(editor,member.anchor)).filter(Boolean);
          const prefixLength = range => {
            const prefix = range.cloneRange(); prefix.selectNodeContents(editor);
            prefix.setEnd(range.endContainer,range.endOffset);
            return prefix.toString().length;
          };
          const range = ranges.sort((a,b) => prefixLength(b)-prefixLength(a))[0];
          if (!range) continue;
          let gap = gaps.current.get(key);
          const prefix = editor.ownerDocument.createRange(); prefix.selectNodeContents(editor);
          if (gap?.isConnected) prefix.setEndBefore(gap);
          if (!gap?.isConnected || prefix.toString().length !== prefixLength(range)) {
            gap?.remove();
            gap = editor.ownerDocument.createElement("span");
            gap.setAttribute("data-workspace-comment-gap", "");
            gap.setAttribute("contenteditable", "false");
            gap.setAttribute("aria-hidden", "true");
            gap.style.cssText = "display:inline-block;width:0;vertical-align:text-top;user-select:none;pointer-events:none";
            const insertion = range.cloneRange(); insertion.collapse(false); insertion.insertNode(gap);
            gaps.current.set(key,gap);
          }
          const lineHeight = parseFloat(view.getComputedStyle(group.block).lineHeight) || 24;
          const allocated = `${lineHeight+height+24}px`;
          if (gap.style.height !== allocated) gap.style.height = allocated;
          top = (gap.getBoundingClientRect().top-base.top)/scale+lineHeight+8;
        } else top = Math.max(group.top,bottom);
        positions.push({ key, ids: group.ids, top });
        bottom = Math.max(bottom,top+height+12);
      }
      const footerTop = !inline && !byBlock.length
        ? headerTop+headerHeight+16
        : Math.max((page.getBoundingClientRect().bottom-base.top)/scale, bottom+12);
      const result = { groups: positions, footer: footerTop, header: headerTop,
        height: footerTop+(footerRef.current?.offsetHeight ?? 0)+32, inline };
      root.style.minHeight = `${result.height}px`;
      setLayout(old => JSON.stringify(old) === JSON.stringify(result) ? old : result);
      // Explicit pane resizing may move a currently owned comment field. Keep
      // it visible after layout settles, without focusing it or reacting to hover.
      if (resizeFocus.current) {
        caf(focusFrame.current);
        view.clearTimeout(settledFocus.current);
        focusFrame.current = raf(() => { focusFrame.current = raf(() => {
          revealOwnedFocus(false);
        }); });
        // Range measurement and reserved inline space can settle in separate
        // observer deliveries. Correct the final placement after those stop,
        // rather than consuming the resize intent on the first intermediate box.
        settledFocus.current = view.setTimeout(() => revealOwnedFocus(true),100);
      }
    };
    const schedule = () => { caf(frame.current); frame.current = raf(measure); };
    const observer = globalThis.ResizeObserver ? new ResizeObserver(schedule) : null;
    observer?.observe(page); observer?.observe(headerRef.current); observer?.observe(footerRef.current);
    if (root.closest(".ws-work")) observer?.observe(root.closest(".ws-work"));
    for (const node of groupRefs.current.values()) observer?.observe(node);
    window.addEventListener("resize",schedule);
    pane?.addEventListener("wheel",cancelResizeFocus,{ passive: true });
    pane?.addEventListener("pointerdown",cancelResizeFocus,true);
    measure();
    return () => {
      observer?.disconnect(); window.removeEventListener("resize",schedule);
      pane?.removeEventListener("wheel",cancelResizeFocus);
      pane?.removeEventListener("pointerdown",cancelResizeFocus,true);
      caf(frame.current); caf(focusFrame.current); view.clearTimeout(settledFocus.current);
    };
  }, [geometry,signature,header,footer]);
  useLayoutEffect(() => () => {
    aside.current?.closest(".ws-layout")?.style.removeProperty("min-height");
    aside.current?.closest(".ws-layout")?.style.removeProperty("max-width");
    for (const [block,saved] of slots.current) {
      block.style[saved.property] = saved.value;
      if (!block.getAttribute("style")) block.removeAttribute("style");
    }
    for (const gap of gaps.current.values()) gap.remove();
  }, []);
  // This spacer belongs to the layout, outside the editable document.
  return h("aside", { ref: aside, className: `ws-comments ws-bubbles${layout.inline ? " ws-bubbles-inline" : ""}`, "aria-label": "Comments and Hermes thread", style: { minHeight: `${layout.height}px` } },
    h("div", { ref: headerRef, className: "ws-bubble-header", style: { top: layout.header } }, header),
    groups.map(group => {
      const key = groupKey(group), position = layout.groups.find(g => g.key === key);
      return h("div", { key, ref: node => { if (node) groupRefs.current.set(key,node); else groupRefs.current.delete(key); },
        className: "ws-bubble-group", style: { top: position?.top ?? group.top }, "aria-label": "Passage discussions" }, renderGroup(group.ids));
    }),
    h("div", { ref: footerRef, className: "ws-bubble-footer", style: { top: layout.footer } }, footer));
}
