import { editorHTML, sanitizeHTML } from "./editor.mjs";

const BLOCKS = new Set(
  "P DIV H1 H2 H3 H4 H5 H6 UL OL LI BLOCKQUOTE PRE TABLE HR".split(" "),
);
const STYLES = new Set(["p", "h1", "h2", "h3", "blockquote", "pre"]);
const selectionFor = (root) => root.ownerDocument.defaultView.getSelection();
function pathFor(root, node) {
  const path = [];
  while (node !== root && node?.parentNode) {
    path.unshift([...node.parentNode.childNodes].indexOf(node));
    node = node.parentNode;
  }
  return node === root ? path : null;
}
export function selectionBookmark(root) {
  const selected = selectionFor(root);
  if (!selected?.rangeCount) return null;
  const range = selected.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return null;
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  return {
    start: pathFor(root, range.startContainer),
    startOffset: range.startOffset,
    end: pathFor(root, range.endContainer),
    endOffset: range.endOffset,
    textStart: before.toString().length,
    textEnd: before.toString().length + range.toString().length,
    backward: !range.collapsed && selected.anchorNode === range.endContainer &&
      selected.anchorOffset === range.endOffset,
  };
}
export function restoreBookmark(root, bookmark, textOnly = false) {
  if (!bookmark) return;
  const doc = root.ownerDocument,
    range = doc.createRange();
  const locate = (path) =>
    path?.reduce((node, index) => node?.childNodes[index], root);
  const textPoint = (offset, preferNext) => {
    const walker = doc.createTreeWalker(root, 4);
    let node, last;
    while ((node = walker.nextNode())) {
      last = node;
      if (offset < node.length || (offset === node.length && !preferNext))
        return [node, offset];
      offset -= node.length;
    }
    if (last) return [last, last.length];
    let leaf = root;
    while (
      leaf.firstChild?.nodeType === 1 &&
      !["BR", "IMG", "INPUT", "HR"].includes(leaf.firstChild.tagName)
    )
      leaf = leaf.firstChild;
    return [leaf, 0];
  };
  let start = !textOnly && locate(bookmark.start),
    end = !textOnly && locate(bookmark.end);
  const [sn, so] = start
    ? [
        start,
        Math.min(
          bookmark.startOffset,
          start.nodeType === 3 ? start.length : start.childNodes.length,
        ),
      ]
    : textPoint(bookmark.textStart, bookmark.startOffset === 0);
  const [en, eo] = end
    ? [
        end,
        Math.min(
          bookmark.endOffset,
          end.nodeType === 3 ? end.length : end.childNodes.length,
        ),
      ]
    : textPoint(bookmark.textEnd, bookmark.endOffset === 0);
  range.setStart(sn, so);
  range.setEnd(en, eo);
  const selected = selectionFor(root);
  selected.removeAllRanges();
  selected.addRange(range);
  if (bookmark.backward && selected.setBaseAndExtent)
    selected.setBaseAndExtent(en, eo, sn, so);
}
function selectionReferences(root) {
  const selected = selectionFor(root);
  if (!selected?.rangeCount) return null;
  const range = selected.getRangeAt(0);
  return {
    start: range.startContainer,
    startOffset: range.startOffset,
    end: range.endContainer,
    endOffset: range.endOffset,
    backward: !range.collapsed && selected.anchorNode === range.endContainer &&
      selected.anchorOffset === range.endOffset,
  };
}
function restoreReferences(root, refs) {
  if (!refs || !root.contains(refs.start) || !root.contains(refs.end))
    return false;
  if (refs.start === root && root.childNodes.length && !root.textContent)
    return false;
  const range = root.ownerDocument.createRange();
  range.setStart(
    refs.start,
    Math.min(
      refs.startOffset,
      refs.start.nodeType === 3
        ? refs.start.length
        : refs.start.childNodes.length,
    ),
  );
  range.setEnd(
    refs.end,
    Math.min(
      refs.endOffset,
      refs.end.nodeType === 3 ? refs.end.length : refs.end.childNodes.length,
    ),
  );
  const selected = selectionFor(root);
  selected.removeAllRanges();
  selected.addRange(range);
  if (refs.backward && selected.setBaseAndExtent)
    selected.setBaseAndExtent(range.endContainer, range.endOffset, range.startContainer, range.startOffset);
  return true;
}
/** Split invalid phrasing wrappers instead of reparsing away lists/table children. */
export function normalizeBlocks(root) {
  const doc = root.ownerDocument;
  for (const node of [
    ...root.querySelectorAll("p,h1,h2,h3,h4,h5,h6,pre"),
  ].reverse()) {
    if (![...node.children].some((child) => BLOCKS.has(child.tagName)))
      continue;
    const fragment = doc.createDocumentFragment();
    let inline = node.cloneNode(false);
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1 && BLOCKS.has(child.tagName)) {
        if (inline.childNodes.length) fragment.append(inline);
        fragment.append(child);
        inline = node.cloneNode(false);
      } else inline.append(child);
    }
    if (inline.childNodes.length) fragment.append(inline);
    node.replaceWith(fragment);
  }
  let inline = null;
  for (const node of [...root.childNodes]) {
    if (node.nodeType === 1 && BLOCKS.has(node.tagName)) {
      inline = null;
      continue;
    }
    if (!inline) {
      inline = doc.createElement("p");
      root.insertBefore(inline, node);
    }
    inline.append(node);
  }
}
function regionFor(root) {
  const selected = selectionFor(root),
    range = selected?.rangeCount ? selected.getRangeAt(0) : null;
  const element = (node) => (node?.nodeType === 3 ? node.parentElement : node);
  const cell = element(range?.startContainer)?.closest?.("td,th");
  return cell && root.contains(cell) && cell.contains(range.endContainer)
    ? cell
    : root;
}
/** Select editable leaves, never a containing list and its untouched siblings. */
function selectedBlocks(root, region) {
  const selection = selectionFor(root);
  if (!selection?.rangeCount) return [];
  const range = selection.getRangeAt(0),
    doc = root.ownerDocument;
  const touches = (nodes) => {
    if (range.collapsed) {
      const point =
        range.startContainer.nodeType === 1
          ? range.startContainer.childNodes[
              Math.min(
                range.startOffset,
                range.startContainer.childNodes.length - 1,
              )
            ]
          : range.startContainer;
      return nodes.some((node) => node === point || node.contains?.(point));
    }
    const probe = doc.createRange();
    probe.setStartBefore(nodes[0]);
    probe.setEndAfter(nodes.at(-1));
    // Compare zero-width boundary ranges: touching an endpoint is not selection.
    const start = range.cloneRange(),
      end = range.cloneRange();
    start.collapse(true);
    end.collapse(false);
    const ps = probe.cloneRange(),
      pe = probe.cloneRange();
    ps.collapse(true);
    pe.collapse(false);
    return (
      start.compareBoundaryPoints(0, pe) < 0 &&
      end.compareBoundaryPoints(0, ps) > 0
    );
  };
  const result = [];
  const visit = (container) => {
    let inline = [];
    const flush = () => {
      if (inline.length && touches(inline)) {
        const leaf = doc.createElement("p");
        container.insertBefore(leaf, inline[0]);
        leaf.append(...inline);
        result.push(leaf);
      }
      inline = [];
    };
    for (const node of [...container.childNodes]) {
      if (node.nodeType !== 1 || !BLOCKS.has(node.tagName)) {
        inline.push(node);
        continue;
      }
      flush();
      if (/^(UL|OL|LI|BLOCKQUOTE|DIV)$/.test(node.tagName)) visit(node);
      else if (touches([node])) result.push(node);
    }
    flush();
  };
  visit(region);
  if (!result.length && range.collapsed && range.startContainer === region) {
    const node =
      region.childNodes[
        Math.min(range.startOffset, region.childNodes.length - 1)
      ];
    if (node) {
      const r = doc.createRange();
      r.selectNodeContents(node);
      r.collapse(true);
      selection.removeAllRanges();
      selection.addRange(r);
      return selectedBlocks(root, region);
    }
  }
  return result;
}
/** Isolate a branch while preserving before/after sibling subtrees and valid wrappers. */
function isolateBranch(node, ancestor) {
  let branch = node;
  while (branch.parentNode !== ancestor) {
    const parent = branch.parentNode;
    splitAround(branch, parent);
    branch = branch.parentNode;
  }
  splitAround(branch, ancestor);
  return branch;
}
function splitAround(branch, parent) {
  const before = parent.cloneNode(false),
    after = parent.cloneNode(false);
  while (parent.firstChild !== branch) before.append(parent.firstChild);
  while (branch.nextSibling) after.append(branch.nextSibling);
  if (before.childNodes.length) parent.before(before);
  if (after.childNodes.length) parent.after(after);
}
function removeSelectedQuotes(block, root) {
  let quote;
  while (
    (quote = block.parentElement?.closest("blockquote")) &&
    root.contains(quote)
  ) {
    const branch = isolateBranch(block, quote);
    quote.replaceWith(branch);
  }
  return block;
}
function unwrapQuotes(block) {
  for (const quote of [...block.querySelectorAll("blockquote")].reverse())
    quote.replaceWith(...quote.childNodes);
  if (block.tagName === "BLOCKQUOTE") {
    const children = [...block.childNodes];
    block.replaceWith(...children);
    return children;
  }
  return [block];
}
function textWithBreaks(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeName === "BR") return "\n";
  return [...node.childNodes].map(textWithBreaks).join("");
}
function replaceStyle(block, tag) {
  const doc = block.ownerDocument;
  if (block.nodeType !== 1) return;
  if (["UL", "OL", "LI", "DIV", "TD", "TH"].includes(block.tagName)) {
    // List containers and nested lists stay structural. Only their text blocks change.
    let inline = [];
    const flush = () => {
      if (!inline.length) return;
      const leaf = doc.createElement("p");
      block.insertBefore(leaf, inline[0]);
      leaf.append(...inline);
      inline = [];
      replaceStyle(leaf, tag);
    };
    for (const child of [...block.childNodes]) {
      if (child.nodeType === 1 && BLOCKS.has(child.tagName)) {
        flush();
        replaceStyle(child, tag);
      } else inline.push(child);
    }
    flush();
    return;
  }
  if (block.tagName === "TABLE" || block.tagName === "HR") return;
  // Preserve the logical caret anchor of an already-Text leaf, especially an
  // empty P whose text offset also identifies the end of the preceding quote.
  if (block.tagName === "P" && tag === "p") return;
  const replacement = doc.createElement(tag);
  if (tag === "pre") {
    const code = doc.createElement("code");
    code.textContent = textWithBreaks(block);
    replacement.append(code);
  } else if (block.tagName === "PRE") {
    const lines = textWithBreaks(block).split("\n");
    lines.forEach((line, index) => {
      if (index) replacement.append(doc.createElement("br"));
      replacement.append(doc.createTextNode(line));
    });
  } else replacement.append(...block.childNodes);
  if (!replacement.childNodes.length)
    replacement.append(doc.createElement("br"));
  block.replaceWith(replacement);
}
export function formatBlocks(root, tag) {
  if (!STYLES.has(tag)) return false;
  const bookmark = selectionBookmark(root),
    refs = selectionReferences(root);
  normalizeBlocks(root);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  const region = regionFor(root);
  normalizeBlocks(region);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  let blocks = selectedBlocks(root, region);
  if (!blocks.length) {
    const p = root.ownerDocument.createElement("p");
    p.append(root.ownerDocument.createElement("br"));
    region.append(p);
    blocks = [p];
  }
  if (tag === "blockquote") {
    for (const block of blocks) {
      if (block.closest("blockquote")) continue;
      const quote = root.ownerDocument.createElement("blockquote");
      block.replaceWith(quote);
      quote.append(block);
    }
  } else {
    blocks = blocks.map((block) => removeSelectedQuotes(block, root));
    for (const block of blocks) replaceStyle(block, tag);
  }
  normalizeBlocks(root);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  return true;
}
export function toggleList(root, tag) {
  if (!["ul", "ol"].includes(tag)) return false;
  const bookmark = selectionBookmark(root),
    refs = selectionReferences(root);
  normalizeBlocks(root);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  const region = regionFor(root);
  normalizeBlocks(region);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  const blocks = selectedBlocks(root, region).map((block) =>
      removeSelectedQuotes(block, root),
    ),
    doc = root.ownerDocument;
  for (const block of blocks) {
    if (block.tagName === "TABLE" || block.tagName === "HR") continue;
    const li = block.parentElement?.closest("li");
    if (
      li &&
      root.contains(li) &&
      ["UL", "OL"].includes(li.parentElement?.tagName)
    ) {
      // Split at both item and list levels; nested sibling lists are never transformed.
      const branch = isolateBranch(block, li);
      const list = li.parentElement;
      splitAround(li, list);
      if (list.tagName.toLowerCase() === tag) {
        list.replaceWith(branch);
      } else {
        const replacement = doc.createElement(tag),
          item = doc.createElement("li");
        item.append(branch);
        replacement.append(item);
        list.replaceWith(replacement);
      }
    } else {
      const list = doc.createElement(tag),
        item = doc.createElement("li");
      block.before(list);
      item.append(...block.childNodes);
      list.append(item);
      block.remove();
    }
  }
  // Rejoin adjacent lists of the same kind without absorbing intervening content.
  for (const list of [...root.querySelectorAll("ul,ol")]) {
    if (list.previousSibling?.nodeName === list.nodeName) {
      list.previousSibling.append(...list.childNodes);
      list.remove();
    }
  }
  normalizeBlocks(root);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  return true;
}
/** Block fragments are inserted at a block boundary, never in a phrasing context. */
export function insertBlockHTML(root, html) {
  const bookmark = selectionBookmark(root),
    refs = selectionReferences(root);
  normalizeBlocks(root);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  const region = regionFor(root),
    doc = root.ownerDocument;
  let anchor = selectionFor(root)?.anchorNode;
  while (anchor?.parentNode && anchor.parentNode !== region)
    anchor = anchor.parentNode;
  const template = doc.createElement("template");
  template.innerHTML = sanitizeHTML(html, doc);
  const nodes = [...template.content.childNodes];
  if (!nodes.length) return false;
  if (anchor && anchor !== region && anchor.parentNode === region)
    anchor.after(...nodes);
  else region.append(...nodes);
  const firstCell = nodes.flatMap((node) =>
    node.nodeType === 1 ? [...node.querySelectorAll("td,th")] : [],
  )[0];
  const focus = firstCell ?? nodes.at(-1);
  root.focus();
  const range = doc.createRange();
  range.selectNodeContents(focus);
  if (!firstCell) range.collapse(false);
  const selected = selectionFor(root);
  selected.removeAllRanges();
  selected.addRange(range);
  return true;
}
/** Rich clipboard blocks replace the actual range; table-button insertion is separate. */
export function pasteBlockHTML(root, html) {
  const doc = root.ownerDocument,
    selection = selectionFor(root);
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return false;
  // Capture the shared owning cell before deletion can move the range endpoints.
  const element = (node) => (node.nodeType === 3 ? node.parentElement : node);
  const startCell = element(range.startContainer).closest?.("td,th");
  const endCell = element(range.endContainer).closest?.("td,th");
  const cell = startCell === endCell ? startCell : null;
  const template = doc.createElement("template");
  template.innerHTML = sanitizeHTML(html, doc);
  const nodes = [...template.content.childNodes];
  if (!nodes.length) return false;
  range.deleteContents();
  // A marker lets Range split inline wrappers exactly at the caret without serializing them.
  const marker = doc.createElement("span");
  range.insertNode(marker);
  let boundary = marker.parentElement;
  while (
    boundary !== root &&
    boundary !== cell &&
    !BLOCKS.has(boundary.tagName)
  )
    boundary = boundary.parentElement;
  if (
    boundary === root ||
    boundary === cell ||
    ["LI", "BLOCKQUOTE", "DIV"].includes(boundary.tagName)
  ) {
    marker.replaceWith(...nodes);
  } else {
    const tailRange = doc.createRange();
    tailRange.setStartAfter(marker);
    tailRange.setEnd(boundary, boundary.childNodes.length);
    const tail = boundary.cloneNode(false);
    tail.append(tailRange.extractContents());
    marker.remove();
    boundary.after(...nodes, ...(tail.childNodes.length ? [tail] : []));
    if (!boundary.textContent && !boundary.querySelector("img,input,br"))
      boundary.remove();
  }
  normalizeBlocks(root);
  const focus = nodes.at(-1);
  root.focus();
  const caret = doc.createRange();
  caret.selectNodeContents(focus);
  caret.collapse(false);
  selection.removeAllRanges();
  selection.addRange(caret);
  return true;
}
/** One bounded history owns native input plus DOM structural transactions. */
export class EditorHistory {
  constructor() {
    this.entries = [];
    this.index = -1;
  }
  capture(root) {
    // History bookmarks address the persisted tree. Empty layout boxes can
    // split a text node; remove them and rejoin text before recording paths.
    // Live browser ranges track normalize(), so the user's selection survives.
    const bookmark = selectionBookmark(root), refs = selectionReferences(root);
    const parents = new Set();
    for (const gap of root.querySelectorAll("[data-workspace-comment-gap]")) {
      parents.add(gap.parentNode); gap.remove();
    }
    for (const parent of parents) parent.normalize();
    // An element-boundary caret in a normalized parent also changes its child
    // index when the box disappears. Its unchanged node reference is not enough.
    if (parents.size && (parents.has(refs?.start) || parents.has(refs?.end) || !restoreReferences(root, refs)))
      restoreBookmark(root, bookmark, true);
    return { html: editorHTML(root), selection: selectionBookmark(root) };
  }
  reset(root) {
    this.entries = [this.capture(root)];
    this.index = 0;
  }
  record(root) {
    const next = this.capture(root),
      current = this.entries[this.index];
    if (current?.html === next.html) {
      current.selection = next.selection;
      return;
    }
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(next);
    this.index++;
    let bytes = this.entries.reduce(
      (size, entry) => size + entry.html.length * 2,
      0,
    );
    while (
      this.entries.length > 1 &&
      (this.entries.length > 100 || bytes > 16 * 1024 * 1024)
    ) {
      bytes -= this.entries.shift().html.length * 2;
      this.index--;
    }
  }
  move(root, delta) {
    const next = this.index + delta;
    if (next < 0 || next >= this.entries.length) return false;
    this.index = next;
    const entry = this.entries[next];
    root.innerHTML = sanitizeHTML(entry.html, root.ownerDocument);
    root.focus();
    restoreBookmark(root, entry.selection);
    return true;
  }
}
