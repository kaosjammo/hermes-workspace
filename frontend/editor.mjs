const TAGS = new Set(
  "p br div span strong b em i u s strike h1 h2 h3 h4 ul ol li blockquote pre code a img table thead tbody tr th td input hr".split(
    " ",
  ),
);
const DROP = new Set(
  "script style iframe object embed svg math form button textarea select template link meta base video audio source".split(
    " ",
  ),
);
export function safeHref(value) {
  const text = String(value ?? "").trim();
  return /^(https?:\/\/|mailto:)/i.test(text) ||
    /^#workspace\/[\w-]+$/.test(text)
    ? text
    : null;
}
export function safeImage(value) {
  return /^data:image\/(png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(
    value ?? "",
  )
    ? value
    : null;
}
/** Native browser-hosted UI Scale uses CSS zoom. Rects are scaled viewport
 * values; inline position/spacing styles remain unscaled CSS coordinates. */
export function elementScale(element) {
  const current = element?.currentCSSZoom;
  if (Number.isFinite(current) && current > 0) return current;
  const width = parseFloat(
    element?.ownerDocument?.defaultView?.getComputedStyle(element)?.width,
  );
  const painted = element?.getBoundingClientRect?.().width;
  return width > 0 && painted > 0 ? painted / width : 1;
}
/** Rebuild nodes: never preserve executable attributes, styles, namespaces or URLs. */
export function sanitizeHTML(html, doc = globalThis.document) {
  const source = doc.createElement("template");
  source.innerHTML = String(html ?? "");
  const clean = (node) => {
    if (node.nodeType === 3) return doc.createTextNode(node.textContent);
    if (node.nodeType !== 1) return doc.createDocumentFragment();
    const name = node.localName.toLowerCase();
    const fragment = doc.createDocumentFragment();
    if (DROP.has(name)) return fragment;
    if (!TAGS.has(name)) {
      for (const child of node.childNodes) fragment.append(clean(child));
      return fragment;
    }
    if (name === "input" && node.getAttribute("type") !== "checkbox")
      return fragment;
    const target = doc.createElement(name);
    // Native Bold OFF inside headings is an explicit reset, not absence of a
    // <strong>. Preserve only that semantic; never pass arbitrary CSS through.
    if (
      name === "span" &&
      (node.getAttribute("data-workspace-weight") === "normal" ||
        /^\s*font-weight\s*:\s*(?:normal|400)\s*;?\s*$/i.test(
          node.getAttribute("style") ?? "",
        ))
    )
      target.setAttribute("data-workspace-weight", "normal");
    if (name === "ol" && /^[0-9]{1,6}$/.test(node.getAttribute("start") ?? ""))
      target.setAttribute("start", String(Number(node.getAttribute("start"))));
    if (name === "a") {
      const href = safeHref(node.getAttribute("href"));
      if (href) target.setAttribute("href", href);
      target.setAttribute("rel", "noopener noreferrer");
    }
    if (name === "img") {
      const raw = node.getAttribute("src");
      const src = /^attachment:[a-z\d_-]+$/i.test(raw ?? "")
        ? raw
        : safeImage(raw);
      if (!src) return fragment;
      target.setAttribute("src", src);
      target.setAttribute("alt", node.getAttribute("alt") ?? "");
    }
    if (name === "input") {
      target.type = "checkbox";
      if (node.hasAttribute("checked")) target.setAttribute("checked", "");
    }
    for (const child of node.childNodes) target.append(clean(child));
    return target;
  };
  const out = doc.createElement("div");
  for (const node of source.content.childNodes) out.append(clean(node));
  return out.innerHTML;
}
/** Derived display only: never fall back to a broad original range after an
 * unavailable agent-change mapping. The stored comment anchor stays intact. */
export function commentAnchor(comment) {
  const change = comment.section_change;
  if (!change || change.status === "reverted") return comment.anchor;
  if (change.anchor && (change.highlight_status === "available" || change.status === "available" && change.highlight_status !== "unavailable")) return change.anchor;
  return comment.anchor ? { ...comment.anchor, unavailable: true } : null;
}
export function locateAnchor(text, anchor) {
  if (anchor?.unavailable) return { status: "detached" };
  if (!anchor) return { status: "page" };
  const quote = anchor.quote;
  if (!quote) return { status: "detached" };
  const candidates = [];
  let pos = text.indexOf(quote);
  while (pos !== -1) {
    if (
      (!anchor.prefix || text.slice(0, pos).endsWith(anchor.prefix)) &&
      (!anchor.suffix ||
        text.slice(pos + quote.length).startsWith(anchor.suffix))
    )
      candidates.push(pos);
    pos = text.indexOf(quote, pos + 1);
  }
  return candidates.length === 1
    ? {
        status: "attached",
        start: candidates[0],
        end: candidates[0] + quote.length,
      }
    : { status: "detached" };
}
export function captureAnchor(root, selection = globalThis.getSelection()) {
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return null;
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  const quote = range.toString();
  const text = root.textContent;
  const anchor = {
    quote,
    prefix: text.slice(Math.max(0, start - 48), start),
    suffix: text.slice(start + quote.length, start + quote.length + 48),
  };
  return locateAnchor(text, anchor).status === "attached" ? anchor : null;
}
export function visibleComments(comments, showResolved) {
  return comments.filter((c) => showResolved || !c.resolved);
}
export function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}
export const MAX_BACKUP_FILE_BYTES = 64_069_632;
export function fileBase64(file) {
  return readFileBase64(
    file,
    20 * 1024 * 1024,
    "Choose a file smaller than 20 MB.",
  );
}
export function backupFileBase64(file) {
  return readFileBase64(
    file,
    MAX_BACKUP_FILE_BYTES,
    "Choose a Workspace backup no larger than 64,069,632 bytes.",
  );
}
function readFileBase64(file, limit, message) {
  if (file.size > limit) return Promise.reject(new Error(message));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}
export function downloadFile(file, doc = globalThis.document) {
  if (!file?.name || !file?.data_base64)
    throw new Error("The download did not contain a file.");
  const binary = atob(file.data_base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], { type: file.media_type ?? "application/octet-stream" }),
  );
  const link = doc.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Attachment references stay durable in saved HTML; display bytes never become authority. */
export function editorHTML(root, { attachmentReferences = true } = {}) {
  const copy = root.cloneNode(true);
  // Inline discussion space is a zero-text layout decoration, never document
  // structure. Remove it before history, drafts, autosave and export snapshots.
  for (const gap of copy.querySelectorAll("[data-workspace-comment-gap]"))
    gap.remove();
  for (const image of attachmentReferences
    ? copy.querySelectorAll("img[data-workspace-attachment]")
    : []) {
    image.setAttribute(
      "src",
      `attachment:${image.getAttribute("data-workspace-attachment")}`,
    );
    image.removeAttribute("data-workspace-attachment");
  }
  return sanitizeHTML(copy.innerHTML, root.ownerDocument);
}
/** Derived accessibility/lock decoration; sanitizeHTML excludes these attributes. */
export function hydrateChecklists(root, disabled = false) {
  [...root.querySelectorAll('input[type="checkbox"]')].forEach(
    (input, index) => {
      const context = input.closest("li,p,td,th");
      input.setAttribute(
        "aria-label",
        context?.textContent.trim() || `Checklist item ${index + 1}`,
      );
      input.setAttribute("contenteditable", "false");
      input.disabled = disabled;
    },
  );
}
export function hydrateImages(root, attachments = []) {
  for (const image of root.querySelectorAll("img")) {
    const source = image.getAttribute("src");
    const id = source?.startsWith("attachment:")
      ? source.slice(11)
      : image.getAttribute("data-workspace-attachment");
    if (!id) continue;
    const attachment = attachments.find((a) => a.id === id);
    const data =
      attachment &&
      `data:${attachment.media_type};base64,${attachment.data_base64}`;
    image.setAttribute("data-workspace-attachment", id);
    if (data && safeImage(data)) image.setAttribute("src", data);
    else {
      image.removeAttribute("src");
      image.setAttribute(
        "alt",
        image.getAttribute("alt") || "Image attachment unavailable",
      );
    }
  }
}

/** Canonical native fragment; shared unchanged with the interchange owner. */
export function workspaceHref(id) {
  const href = `#workspace/${id}`;
  if (!/^#workspace\/[\w-]+$/.test(href))
    throw new Error("Use a valid Workspace item ID.");
  return href;
}
