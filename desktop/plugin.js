// frontend/index.jsx
import { createElement as h2 } from "react";
import { ROUTES_AREA, SIDEBAR_NAV_AREA, host as host4, gatewayActivationEpoch as gatewayActivationEpoch3 } from "@hermes/plugin-sdk";

// frontend/workspace.jsx
import {
  useCallback as useCallback4,
  useEffect as useEffect8,
  useId as useId7,
  useLayoutEffect as useLayoutEffect9,
  useMemo as useMemo3,
  useRef as useRef15,
  useState as useState15,
  useSyncExternalStore,
  memo
} from "react";

// frontend/item-labels.mjs
function itemContext(item, items = [], attachments = []) {
  if (!item) return "Unavailable item";
  const path = [], seen = /* @__PURE__ */ new Set([item.id]);
  let parent = items.find((i) => i.id === (item.database_id || item.parent_id));
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    path.unshift(parent.title);
    parent = items.find((i) => i.id === (parent.database_id || parent.parent_id));
  }
  const files = attachments.filter((a) => a.item_id === item.id);
  const duplicate = items.some((other) => other.id !== item.id && !other.deleted_at && other.title === item.title && other.kind === item.kind && (other.database_id || other.parent_id) === (item.database_id || item.parent_id));
  const imports = files.filter((file) => /\.(md|csv|docx|pdf)$/i.test(file.name));
  const original = duplicate && (imports.find((file) => file.name.replace(/\.[^.]+$/, "") === item.title) || imports[0]);
  const filename = original && [...original.name];
  const shortName = filename && (filename.length > 48 ? `${filename.slice(0, 25).join("")}\u2026${filename.slice(-20).join("")}` : original.name);
  return [
    path.join(" / ") || "Workspace",
    item.kind,
    shortName,
    files.length && `${files.length} ${files.length === 1 ? "attachment" : "attachments"}`
  ].filter(Boolean).join(" \xB7 ");
}
function itemLabel(item, items = [], attachments = []) {
  return item ? `${item.title} \xB7 ${itemContext(item, items, attachments)}` : "Unavailable item";
}
function navigationContexts(items = [], attachments = []) {
  const groups = /* @__PURE__ */ new Map(), contexts = /* @__PURE__ */ new Map();
  for (const item of items.filter((item2) => !item2.deleted_at)) {
    const group = groups.get(item.title) ?? [];
    group.push(item);
    groups.set(item.title, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const details = group.map((item) => itemContext(item, items, attachments));
    const seen = /* @__PURE__ */ new Map(), totals = /* @__PURE__ */ new Map();
    details.forEach((detail) => totals.set(detail, (totals.get(detail) ?? 0) + 1));
    const locations = new Set(group.map((item) => item.database_id || item.parent_id));
    for (const [index, item] of group.entries()) {
      const detail = details[index], total = totals.get(detail);
      const ordinal = (seen.get(detail) ?? 0) + 1;
      seen.set(detail, ordinal);
      const files = attachments.filter((file) => file.item_id === item.id && /\.(md|csv|docx|pdf)$/i.test(file.name));
      const original = files.find((file) => file.name.replace(/\.[^.]+$/, "") === item.title) || files[0];
      const extension = original?.name.split(".").at(-1).toLowerCase();
      const format = { md: "Markdown", csv: "CSV", docx: "Word", pdf: "PDF" }[extension];
      const filename = original && original.name.replace(/\.[^.]+$/, "") !== item.title ? original.name : null;
      const parent = items.find((parent2) => parent2.id === (item.database_id || item.parent_id));
      const caption = [
        filename || format || item.kind,
        locations.size > 1 && (parent?.title || "Workspace"),
        total > 1 && `item ${ordinal} of ${total}`
      ].filter(Boolean).join(" \xB7 ");
      contexts.set(item.id, { caption, description: total > 1 ? `${detail} \xB7 item ${ordinal} of ${total}` : detail });
    }
  }
  return contexts;
}
function attachmentLabels(attachments) {
  const counts = /* @__PURE__ */ new Map(), seen = /* @__PURE__ */ new Map();
  for (const file of attachments) counts.set(file.name, (counts.get(file.name) ?? 0) + 1);
  const types = {
    "image/png": "PNG image",
    "image/jpeg": "JPEG image",
    "image/gif": "GIF image",
    "image/webp": "WebP image",
    "image/svg+xml": "SVG image",
    "application/pdf": "PDF document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
    "text/plain": "Text file",
    "text/markdown": "Markdown document",
    "text/csv": "CSV table"
  };
  const number = new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 });
  return attachments.map((attachment) => {
    const ordinal = (seen.get(attachment.name) ?? 0) + 1;
    seen.set(attachment.name, ordinal);
    const total = counts.get(attachment.name), data = attachment.data_base64;
    const bytes = typeof data === "string" ? Math.max(0, Math.floor(data.length * 3 / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0)) : null;
    const size = bytes === null ? "Size unavailable" : bytes < 1024 ? `${bytes} ${bytes === 1 ? "byte" : "bytes"}` : bytes < 1024 * 1024 ? `${number.format(bytes / 1024)} KiB` : `${number.format(bytes / (1024 * 1024))} MiB`;
    return {
      attachment,
      label: total > 1 ? `${attachment.name} \xB7 attachment ${ordinal} of ${total}` : attachment.name,
      detail: `${types[attachment.media_type] ?? "File"} \xB7 ${size}`
    };
  });
}

// frontend/folder-destinations.mjs
function folderDestinations(items, movingId) {
  const children = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (item.kind !== "folder" || item.deleted_at) continue;
    const siblings = children.get(item.parent_id) ?? [];
    siblings.push(item);
    children.set(item.parent_id, siblings);
  }
  const root = "Workspace root";
  const options = [["", root]];
  const seen = /* @__PURE__ */ new Set();
  const visit = (parent, depth, path) => {
    for (const folder of children.get(parent) ?? []) {
      if (folder.id === movingId || seen.has(folder.id)) continue;
      seen.add(folder.id);
      const location = [...path, folder.title];
      options.push([folder.id, folder.title, {
        depth,
        path: location.join(" / ")
      }]);
      visit(folder.id, depth + 1, location);
    }
  };
  visit(null, 1, [root]);
  return options;
}

// frontend/navigation-order.mjs
function navigationOrderPayload(state, request) {
  const siblings = state.items.filter((item) => !item.deleted_at && item.kind !== "record" && item.parent_id === request.parent);
  if (state.scope_id !== request.scope || siblings.length !== request.siblings.length || siblings.some((item, i) => item.id !== request.siblings[i]) || !siblings.some((item) => item.id === request.id) || !siblings.some((item) => item.id === request.target_id))
    throw new Error("The folder order changed. Try reordering the current items again.");
  return { id: request.id, target_id: request.target_id, position: request.position };
}

// frontend/workspace.jsx
import {
  host as host3,
  useValue,
  useQuery,
  useGatewayActivationEpoch,
  gatewayActivationEpoch as gatewayActivationEpoch2,
  ErrorState,
  GlyphSpinner as GlyphSpinner2
} from "@hermes/plugin-sdk";

// frontend/ui.jsx
import { createElement as h, cloneElement, Children, useState, useRef, useLayoutEffect } from "react";
import * as nativeSdk from "@hermes/plugin-sdk";

// frontend/editor.mjs
var TAGS = new Set(
  "p br div span strong b em i u s strike h1 h2 h3 h4 ul ol li blockquote pre code a img table thead tbody tr th td input hr".split(
    " "
  )
);
var DROP = new Set(
  "script style iframe object embed svg math form button textarea select template link meta base video audio source".split(
    " "
  )
);
function safeHref(value) {
  const text = String(value ?? "").trim();
  return /^(https?:\/\/|mailto:)/i.test(text) || /^#workspace\/[\w-]+$/.test(text) ? text : null;
}
function safeImage(value) {
  return /^data:image\/(png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(
    value ?? ""
  ) ? value : null;
}
function elementScale(element) {
  const current = element?.currentCSSZoom;
  if (Number.isFinite(current) && current > 0) return current;
  const width = parseFloat(
    element?.ownerDocument?.defaultView?.getComputedStyle(element)?.width
  );
  const painted = element?.getBoundingClientRect?.().width;
  return width > 0 && painted > 0 ? painted / width : 1;
}
function sanitizeHTML(html, doc = globalThis.document) {
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
    if (name === "span" && (node.getAttribute("data-workspace-weight") === "normal" || /^\s*font-weight\s*:\s*(?:normal|400)\s*;?\s*$/i.test(
      node.getAttribute("style") ?? ""
    )))
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
      const src = /^attachment:[a-z\d_-]+$/i.test(raw ?? "") ? raw : safeImage(raw);
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
function commentAnchor(comment) {
  const change = comment.section_change;
  if (!change || change.status === "reverted") return comment.anchor;
  if (change.status === "available" && change.anchor) return change.anchor;
  return comment.anchor ? { ...comment.anchor, unavailable: true } : null;
}
function locateAnchor(text, anchor) {
  if (anchor?.unavailable) return { status: "detached" };
  if (!anchor) return { status: "page" };
  const quote = anchor.quote;
  if (!quote) return { status: "detached" };
  const candidates = [];
  let pos = text.indexOf(quote);
  while (pos !== -1) {
    if ((!anchor.prefix || text.slice(0, pos).endsWith(anchor.prefix)) && (!anchor.suffix || text.slice(pos + quote.length).startsWith(anchor.suffix)))
      candidates.push(pos);
    pos = text.indexOf(quote, pos + 1);
  }
  return candidates.length === 1 ? {
    status: "attached",
    start: candidates[0],
    end: candidates[0] + quote.length
  } : { status: "detached" };
}
function captureAnchor(root, selection = globalThis.getSelection()) {
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer))
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
    suffix: text.slice(start + quote.length, start + quote.length + 48)
  };
  return locateAnchor(text, anchor).status === "attached" ? anchor : null;
}
function visibleComments(comments, showResolved) {
  return comments.filter((c) => showResolved || !c.resolved);
}
function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]
  );
}
var MAX_BACKUP_FILE_BYTES = 64069632;
function fileBase64(file) {
  return readFileBase64(
    file,
    20 * 1024 * 1024,
    "Choose a file smaller than 20 MB."
  );
}
function backupFileBase64(file) {
  return readFileBase64(
    file,
    MAX_BACKUP_FILE_BYTES,
    "Choose a Workspace backup no larger than 64,069,632 bytes."
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
function downloadFile(file, doc = globalThis.document) {
  if (!file?.name || !file?.data_base64)
    throw new Error("The download did not contain a file.");
  const binary = atob(file.data_base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], { type: file.media_type ?? "application/octet-stream" })
  );
  const link = doc.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function editorHTML(root, { attachmentReferences = true } = {}) {
  const copy = root.cloneNode(true);
  for (const gap of copy.querySelectorAll("[data-workspace-comment-gap]"))
    gap.remove();
  for (const image of attachmentReferences ? copy.querySelectorAll("img[data-workspace-attachment]") : []) {
    image.setAttribute(
      "src",
      `attachment:${image.getAttribute("data-workspace-attachment")}`
    );
    image.removeAttribute("data-workspace-attachment");
  }
  return sanitizeHTML(copy.innerHTML, root.ownerDocument);
}
function hydrateChecklists(root, disabled = false) {
  [...root.querySelectorAll('input[type="checkbox"]')].forEach(
    (input, index) => {
      const context = input.closest("li,p,td,th");
      input.setAttribute(
        "aria-label",
        context?.textContent.trim() || `Checklist item ${index + 1}`
      );
      input.setAttribute("contenteditable", "false");
      input.disabled = disabled;
    }
  );
}
function hydrateImages(root, attachments = []) {
  for (const image of root.querySelectorAll("img")) {
    const source = image.getAttribute("src");
    const id = source?.startsWith("attachment:") ? source.slice(11) : image.getAttribute("data-workspace-attachment");
    if (!id) continue;
    const attachment = attachments.find((a) => a.id === id);
    const data = attachment && `data:${attachment.media_type};base64,${attachment.data_base64}`;
    image.setAttribute("data-workspace-attachment", id);
    if (data && safeImage(data)) image.setAttribute("src", data);
    else {
      image.removeAttribute("src");
      image.setAttribute(
        "alt",
        image.getAttribute("alt") || "Image attachment unavailable"
      );
    }
  }
}
function workspaceHref(id) {
  const href = `#workspace/${id}`;
  if (!/^#workspace\/[\w-]+$/.test(href))
    throw new Error("Use a valid Workspace item ID.");
  return href;
}

// frontend/ui.jsx
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tip,
  Codicon
} from "@hermes/plugin-sdk";
var UnsavedEditError = class extends Error {
  constructor(message, focus) {
    super(message);
    this.name = "UnsavedEditError";
    this.focus = focus;
  }
};
function isSubmitEnter2(event) {
  if (typeof nativeSdk.isSubmitEnter === "function")
    return nativeSdk.isSubmitEnter(event);
  const native = event.nativeEvent ?? event;
  return event.key === "Enter" && !(event.isComposing || native.isComposing || event.keyCode === 229 || native.keyCode === 229);
}
var fallbackDateTime = new Intl.DateTimeFormat(void 0, { dateStyle: "medium", timeStyle: "short" });
function savedTime(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "Saved time unavailable";
  const formatter = typeof nativeSdk.fmtDateTime?.format === "function" ? nativeSdk.fmtDateTime : fallbackDateTime;
  const timeZone = formatter.resolvedOptions?.().timeZone;
  const zone = new Intl.DateTimeFormat(void 0, { timeZone, timeZoneName: "short" }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  return `${formatter.format(date)}${zone ? ` ${zone}` : ""}`;
}
function versionChoices(versions) {
  const labels = versions.map((version) => savedTime(version.created_at));
  const counts = /* @__PURE__ */ new Map();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return versions.map((version, index) => [
    version.id,
    counts.get(labels[index]) > 1 ? `${labels[index]} \xB7 version ${index + 1}` : labels[index]
  ]);
}
function errorMessage(error) {
  const raw = error?.message ?? String(error);
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const detail = JSON.parse(raw.slice(jsonStart)).detail;
      if (typeof detail === "string") return detail;
    } catch {
    }
  }
  return raw.replace(/^.*?failed\s*\(\d+\):\s*/i, "");
}
function operationError(error, context = {}) {
  const detail = errorMessage(error);
  if (context?.operation === "search") return "Workspace search could not finish. Try searching again.";
  if (context?.operation === "threads") return "Native threads could not be loaded for this connection.";
  if (context?.operation === "openThread") return "The native thread could not be opened.";
  if (context?.operation === "bindThread") return "The native thread could not be linked to this page.";
  if (context?.operation === "run") return "Hermes could not start this Workspace run.";
  if (context?.operation === "runStart") return `Hermes could not confirm that edits started for ${context.pageTitle ? `\u201C${context.pageTitle}\u201D` : "this page"}. Review the page and ${context.threadId ? "its linked thread" : "the connection"} before starting another run.`;
  if (context?.operation === "runStatus") return `The run status for ${context.pageTitle ? `\u201C${context.pageTitle}\u201D` : "this page"} could not be checked. Native execution may still continue. Review ${context.threadId ? "the linked thread and " : ""}the page before taking another action.`;
  if (context?.operation === "import") {
    const name = context.fileName ? `\u201C${context.fileName}\u201D` : "The selected file";
    if (/\.docx$/i.test(context.fileName ?? "") && /zip|central directory|malformed|invalid word/i.test(detail))
      return `${name} could not be read as a Word document. Choose a valid .docx file.`;
    return `${name} could not be imported. ${detail}`;
  }
  return detail;
}
function popupBounds(opener) {
  const boundary = opener?.closest(".ws-work") ?? opener?.closest(".ws-root") ?? void 0;
  const scale = elementScale(opener), rect = boundary?.getBoundingClientRect();
  const view = opener?.ownerDocument.defaultView;
  let padding = 8;
  if (rect && scale !== 1) {
    const left = Math.max(0, rect.left), top = Math.max(0, rect.top), right = Math.min(view.innerWidth, rect.right), bottom = Math.min(view.innerHeight, rect.bottom);
    padding = {
      left: left / scale - left + 8,
      top: top / scale - top + 8,
      right: right - right / scale + 8,
      bottom: bottom - bottom / scale + 8
    };
  }
  return { boundary, padding, scale, width: rect && (Math.min(view.innerWidth, rect.right) - Math.max(0, rect.left)) / scale - 16 };
}
function usePopupContainment(content, bounds) {
  useLayoutEffect(() => {
    if (!content || !bounds.scale || bounds.scale === 1) return;
    const boundary = bounds.boundary ?? content.ownerDocument.documentElement;
    const view = content.ownerDocument.defaultView;
    let frame, x = 0, y = 0;
    const contain = () => {
      const pane = boundary.getBoundingClientRect(), rect = content.getBoundingClientRect(), scale = elementScale(content);
      const left = Math.max(0, pane.left) + 8 * scale, top = Math.max(0, pane.top) + 8 * scale, right = Math.min(view.innerWidth, pane.right) - 8 * scale, bottom = Math.min(view.innerHeight, pane.bottom) - 8 * scale;
      const originX = rect.left - x * scale, originY = rect.top - y * scale;
      const nextX = (Math.max(left, Math.min(originX, right - rect.width)) - originX) / scale, nextY = (Math.max(top, Math.min(originY, bottom - rect.height)) - originY) / scale;
      if (Math.abs(nextX - x) > 0.1 || Math.abs(nextY - y) > 0.1) {
        x = nextX;
        y = nextY;
        content.style.translate = `${x}px ${y}px`;
      }
    };
    const schedule = () => {
      view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame(contain);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    observer.observe(boundary);
    view.addEventListener("resize", schedule);
    content.ownerDocument.addEventListener("scroll", schedule, true);
    schedule();
    return () => {
      view.cancelAnimationFrame(frame);
      observer.disconnect();
      view.removeEventListener("resize", schedule);
      content.ownerDocument.removeEventListener("scroll", schedule, true);
      content.style.removeProperty("translate");
    };
  }, [content, bounds]);
}
function ContextTip({ label, children }) {
  const [bounds, setBounds] = useState({ boundary: void 0, padding: 8 }), [content, setContent] = useState(null);
  usePopupContainment(content, bounds);
  return h(
    Tip,
    {
      label: h("span", { style: { display: "block", whiteSpace: "normal", overflowWrap: "anywhere" } }, label),
      // Tip also uses collisionPadding to decide whether its trigger is hidden.
      // Its width is bounded explicitly; keep the native trigger clip inset.
      ref: setContent,
      collisionBoundary: bounds.boundary,
      collisionPadding: 8,
      style: { maxWidth: bounds.width ? Math.max(1, bounds.width) : "calc(100vw - 16px)" }
    },
    cloneElement(children, { onMouseEnter: (event) => {
      children.props.onMouseEnter?.(event);
      setBounds(popupBounds(event.currentTarget));
    }, onFocus: (event) => {
      children.props.onFocus?.(event);
      setBounds(popupBounds(event.currentTarget));
    } })
  );
}
function ContextPopover({ open, onOpenChange, trigger, triggerTip, children, returnFocusOnEscape = false, ...contentProps }) {
  const opener = useRef(null), [bounds, setBounds] = useState({ boundary: void 0, padding: 8 });
  const [content, setContent] = useState(null);
  usePopupContainment(content, bounds);
  const nativeTrigger = h(PopoverTrigger, { asChild: true }, cloneElement(trigger, { ref: opener }));
  return h(
    Popover,
    { open, onOpenChange: (next) => {
      if (next) setBounds(popupBounds(opener.current));
      onOpenChange(next);
    } },
    triggerTip ? h(Tip, { label: triggerTip }, nativeTrigger) : nativeTrigger,
    h(PopoverContent, {
      ref: setContent,
      collisionBoundary: bounds.boundary,
      collisionPadding: bounds.padding,
      ...contentProps,
      ...returnFocusOnEscape ? {
        onEscapeKeyDown: (event) => {
          contentProps.onEscapeKeyDown?.(event);
          if (!event.defaultPrevented) opener.current?.focus({ preventScroll: true });
        },
        onCloseAutoFocus: (event) => {
          contentProps.onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const document2 = opener.current?.ownerDocument, active = document2?.activeElement;
          if (active?.isConnected && active !== document2.body && !content?.contains(active))
            event.preventDefault();
        }
      } : {}
    }, children)
  );
}
function ActionMenu({
  label,
  children,
  disabled = false,
  triggerLabel = label,
  triggerProps = {},
  showChevron = true,
  align = "end",
  open,
  onOpenChange,
  onCloseAutoFocus
}) {
  const opener = useRef(null);
  const openingPointer = useRef(null);
  const [menuBounds, setMenuBounds] = useState({ boundary: void 0, padding: 8 });
  const [content, setContent] = useState(null);
  usePopupContainment(content, menuBounds);
  const changeOpen = (value) => {
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
          onPointerDownCapture: (event) => {
            triggerProps.onPointerDownCapture?.(event);
            openingPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          },
          "aria-label": label
        },
        triggerLabel,
        showChevron && h(Codicon, { name: "chevron-down" })
      )
    ),
    h(
      DropdownMenuContent,
      {
        ref: setContent,
        align,
        className: "ws-menu",
        onCloseAutoFocus,
        collisionBoundary: menuBounds.boundary,
        collisionPadding: menuBounds.padding,
        style: {
          maxWidth: "min(32rem, var(--radix-dropdown-menu-content-available-width, 100vw))",
          maxHeight: "min(30rem, var(--radix-dropdown-menu-content-available-height, 80vh))"
        }
      },
      Children.toArray(children).map(
        (child) => child && h(
          DropdownMenuItem,
          {
            key: child.key,
            disabled: child.props.disabled,
            onPointerDownCapture: () => {
              openingPointer.current = null;
            },
            onPointerUpCapture: (event) => {
              const start = openingPointer.current;
              openingPointer.current = null;
              if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4)
                event.preventDefault();
            },
            onFocus: child.props.onFocus,
            onSelect: (event) => {
              opener.current?.focus({ preventScroll: true });
              child.props.onClick?.(event, opener.current);
            }
          },
          child.props.children
        )
      )
    )
  );
}
function Choice({
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
  displayValue
}) {
  const opener = useRef(null);
  const [bounds, setBounds] = useState({ boundary: void 0, padding: 8 });
  const [content, setContent] = useState(null);
  const selectedOption = options.find((option) => Array.isArray(option) && String(option[0]) === String(value));
  const selectedPath = selectedOption?.[2]?.path;
  usePopupContainment(content, bounds);
  const changeOpen = (value2) => {
    if (value2) setBounds(popupBounds(opener.current));
    onOpenChange?.(value2);
  };
  return h(
    "label",
    { className: "ws-choice" },
    showLabel && h("span", { className: "ws-label" }, label),
    h(
      Select,
      {
        value: (() => {
          const index = options.findIndex((option) => String(Array.isArray(option) ? option[0] : option) === String(value));
          return index < 0 ? "" : `choice:${index}`;
        })(),
        onValueChange: (key) => {
          const match = /^choice:(\d+)$/.exec(key);
          if (!match) return;
          const option = options[Number(match[1])];
          if (option !== void 0) onChange(String(Array.isArray(option) ? option[0] : option));
        },
        disabled,
        onOpenChange: changeOpen
      },
      h(SelectTrigger, { ref: opener, "aria-label": label, className: "ws-choice-trigger", title: selectedPath, ...triggerProps }, h(SelectValue, { className: "ws-choice-value" }, displayValue ?? selectedPath)),
      h(
        SelectContent,
        {
          ref: setContent,
          onCloseAutoFocus,
          className: "ws-choice-content",
          collisionBoundary: bounds.boundary,
          collisionPadding: bounds.padding,
          style: {
            maxWidth: "min(32rem, var(--radix-select-content-available-width, 100vw))",
            maxHeight: "min(18rem, var(--radix-select-content-available-height, 80vh))"
          }
        },
        options.map((option, index) => {
          const [id, text, hierarchy] = Array.isArray(option) ? option : [option, option];
          return h(
            SelectItem,
            {
              key: `choice:${index}`,
              value: `choice:${index}`,
              onFocus: onOptionFocus ? () => onOptionFocus(id) : void 0,
              ...hierarchy && {
                textValue: text,
                // Radix normally names an option from its title-only ItemText.
                "aria-labelledby": void 0,
                "aria-label": hierarchy.path,
                title: hierarchy.path,
                style: { paddingInlineStart: `${8 + hierarchy.depth * 14}px` }
              }
            },
            text
          );
        })
      )
    )
  );
}
function Action({ children, onClick, ...props }) {
  return h(
    Button,
    {
      variant: "secondary",
      size: "sm",
      type: "button",
      onClick,
      ...props
    },
    children
  );
}
function Field({ label, ...props }) {
  return h(
    "label",
    { className: "ws-field" },
    h("span", { className: "ws-label" }, label),
    h(Input, { "aria-label": label, ...props })
  );
}
function ContentDialog({ title, description, children, onClose, returnFocus, busy = false, skipReturnFocus = () => false }) {
  const opener = useRef(returnFocus ?? document.activeElement);
  return h(
    Dialog,
    { open: true, onOpenChange: (open) => {
      if (!open && !busy) onClose();
    } },
    h(
      DialogContent,
      {
        className: "ws-dialog",
        showCloseButton: !busy,
        onCloseAutoFocus: (event) => {
          event.preventDefault();
          if (!skipReturnFocus() && opener.current?.isConnected) opener.current.focus({ preventScroll: true });
        }
      },
      h(
        DialogHeader,
        null,
        h(DialogTitle, null, title),
        description && h(DialogDescription, { className: "ws-dialog-description" }, description)
      ),
      children,
      h(DialogFooter, { className: "ws-dialog-footer" }, h(Action, { disabled: busy, onClick: onClose }, "Close"))
    )
  );
}
function FormDialog({
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
  errorSummary
}) {
  const opener = useRef(returnFocus ?? document.activeElement);
  const returnScope = useRef(opener.current?.closest('[aria-label="Database"]') ?? opener.current?.closest(".ws-work") ?? opener.current?.closest(".ws-root")?.querySelector(".ws-work"));
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
        } : void 0,
        onCloseAutoFocus: (event) => {
          event.preventDefault();
          if (submitted.current && onSuccessFocus) {
            onSuccessFocus();
            return;
          }
          if (opener.current?.isConnected)
            opener.current.focus({ preventScroll: true });
          else if (returnScope.current?.isConnected) {
            const scope = returnScope.current;
            const target = [...scope.querySelectorAll("textarea,input,button,a[href],[tabindex]")].find((node) => {
              const closed = node.closest("details:not([open])");
              return node.tabIndex >= 0 && !node.matches(":disabled,[aria-disabled=true]") && (!closed || closed.querySelector(":scope > summary")?.contains(node)) && node.getClientRects().length && node.checkVisibility?.({ checkVisibilityCSS: true }) !== false;
            });
            (target ?? scope).focus({ preventScroll: true });
          }
        }
      },
      h(
        DialogHeader,
        null,
        h(DialogTitle, null, title),
        description && h(DialogDescription, { className: "ws-dialog-description" }, description)
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
          }
        },
        fields.filter((field) => !field.when || field.when(values)).map(
          (field) => field.options ? h(Choice, {
            key: field.name,
            label: field.label,
            value: values[field.name] ?? "",
            options: field.options,
            disabled: busy,
            onChange: (value) => setValues((v) => ({ ...v, [field.name]: value }))
          }) : h(Field, {
            key: field.name,
            label: field.label,
            type: field.type ?? "text",
            required: field.required !== false,
            disabled: busy,
            value: values[field.name] ?? "",
            onChange: (e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))
          })
        ),
        renderHelp?.(values),
        error && h(
          "div",
          { role: "alert" },
          h("p", null, errorSummary || error),
          errorSummary && h(
            "details",
            null,
            h("summary", null, "Technical details"),
            h("pre", null, error)
          )
        ),
        h(
          DialogFooter,
          { className: "ws-dialog-footer" },
          recoveryAction && h(Action, { disabled: busy, onClick: async () => {
            setBusy(true);
            setError("");
            try {
              await recoveryAction.onClick();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          } }, recoveryAction.label),
          h(Action, { disabled: busy, onClick: onClose }, "Cancel"),
          h(Button, { ref: confirmButton, type: "submit", "aria-label": confirm, disabled: submitDisabled, variant: destructive ? "destructive" : "default", loading: busy }, confirm)
        )
      )
    )
  );
}

// frontend/restore.jsx
import { useRef as useRef2, useState as useState2 } from "react";
import {
  Dialog as Dialog2,
  DialogContent as DialogContent2,
  DialogHeader as DialogHeader2,
  DialogTitle as DialogTitle2,
  DialogDescription as DialogDescription2,
  DialogFooter as DialogFooter2
} from "@hermes/plugin-sdk";
function RestoreDialog({
  client,
  ticket,
  data,
  onClose,
  onCommitted,
  onRefused,
  onUseCurrent
}) {
  const [receipt, setReceipt] = useState2({ status: "confirmation" });
  const [busy, setBusy] = useState2(false), [error, setError] = useState2(""), [inspection, setInspection] = useState2(null);
  const submitted = useRef2(false);
  const check = async (submit = false) => {
    if (busy || submit && submitted.current) return;
    if (submit) submitted.current = true;
    setBusy(true);
    setError("");
    try {
      const result = submit ? await client.restoreBackup(ticket, data) : await client.restoreStatus(ticket);
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
            detail: "Replacement was not sent. Close this dialog and select the backup again against the current Workspace."
          });
      }
    } finally {
      if (client.current()) setBusy(false);
    }
  };
  const status = receipt.status;
  const message = status === "confirmation" ? "This replaces the current Workspace, including documents, comments and attachments. Download a complete backup first. Native threads will be detached and no run will start." : status === "running" ? "The server is still processing this replacement. Its result has not been confirmed. Check status; do not submit it again." : status === "refused" ? "The server refused this replacement. Load the current Workspace before making changes." : "The replacement outcome is unknown. It may already have committed. A server restart or expired receipt can prevent confirmation. Do not repeat the replacement to recover a lost response. Check status or inspect the current Workspace.";
  return h(
    Dialog2,
    {
      open: true,
      onOpenChange: (value) => {
        if (!value && !busy && status === "confirmation") onClose();
      }
    },
    h(
      DialogContent2,
      { className: "ws-dialog", showCloseButton: !busy && status === "confirmation" },
      h(
        DialogHeader2,
        null,
        h(
          DialogTitle2,
          null,
          status === "confirmation" ? "Replace Workspace from backup?" : "Workspace replacement status"
        ),
        h(DialogDescription2, { className: "ws-dialog-description" }, message)
      ),
      busy && h(
        "p",
        { role: "status" },
        status === "confirmation" ? "Replacing Workspace\u2026" : "Checking replacement\u2026"
      ),
      receipt.detail && h("p", null, receipt.detail),
      error && h("p", { className: "ws-error", role: "alert" }, error),
      inspection && h(
        "p",
        { role: "status" },
        `Current readback: ${inspection.items.length} items, ${inspection.comments.length} comments, ${inspection.attachments.length} attachments. This readback does not confirm the replacement outcome. Editing remains paused.`
      ),
      h(
        DialogFooter2,
        { className: "ws-dialog-footer ws-recovery-actions" },
        status === "confirmation" ? [
          h(
            Action,
            { key: "cancel", disabled: busy, onClick: onClose },
            "Cancel"
          ),
          h(
            Action,
            {
              key: "restore",
              variant: "destructive",
              disabled: busy,
              onClick: () => void check(true)
            },
            "Replace Workspace"
          )
        ] : [
          h(
            Action,
            { key: "check", disabled: busy, onClick: () => void check() },
            "Check replacement status"
          ),
          status === "unknown" && inspection && h(
            Action,
            {
              key: "use",
              disabled: busy,
              onClick: () => onUseCurrent(ticket)
            },
            "Use current Workspace (outcome unknown)"
          ),
          status === "refused" ? h(
            Action,
            {
              key: "load",
              disabled: busy,
              onClick: () => onRefused(ticket)
            },
            "Load current Workspace"
          ) : h(
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
              }
            },
            "Inspect current Workspace"
          )
        ]
      )
    )
  );
}

// frontend/page-title.jsx
import { useEffect, useLayoutEffect as useLayoutEffect2, useRef as useRef3, useState as useState3 } from "react";
function PageTitle({ item, locked: authorityLocked, interactionBlocked = false, buffer, registerFlush, onSave, onError, headingId }) {
  const locked = authorityLocked || interactionBlocked;
  const input = useRef3(null), dirty = useRef3(null), saving = useRef3(Promise.resolve());
  const pending = useRef3(0), token = useRef3(null), mounted = useRef3(true), editRevision = useRef3(0);
  const [value, setValue] = useState3(item.title);
  const [recovery, setRecovery] = useState3(() => buffer?.read() ?? null);
  const [status, setStatus] = useState3("Saved"), [error, setError] = useState3("");
  const recoveryRef = useRef3(recovery), latest = useRef3(null);
  recoveryRef.current = recovery;
  latest.current = { item, locked: authorityLocked, onSave, buffer };
  const retain = (text) => {
    dirty.current = text;
    editRevision.current++;
    try {
      token.current = buffer?.put(text, item.title)?.token ?? null;
    } catch (err) {
      onError(err);
    }
  };
  const flush = () => {
    if (dirty.current === null) return saving.current;
    const title = dirty.current.trim();
    if (!title) {
      setError("Enter a title before saving or leaving this page.");
      setStatus("Title not saved");
      return Promise.reject(new UnsavedEditError("Title not saved. Enter a title before leaving this page.", () => input.current?.focus()));
    }
    if (recoveryRef.current) return Promise.reject(new UnsavedEditError("Recover or discard the retained title first.", () => input.current?.focus()));
    const savedToken = token.current, save = latest.current.onSave;
    const revision = editRevision.current, savedBuffer = latest.current.buffer;
    dirty.current = null;
    pending.current++;
    setStatus("Saving title\u2026");
    setError("");
    const promise = saving.current.catch(() => {
    }).then(async () => {
      if (latest.current.locked) throw new Error("The title is read-only while Hermes is working.");
      await save(title);
    }).then(() => {
      if (savedToken) savedBuffer?.acknowledge(savedToken);
      if (mounted.current && revision === editRevision.current && dirty.current === null) {
        setValue(title);
        setStatus("Saved");
      }
    }, (err) => {
      if (revision === editRevision.current) {
        if (dirty.current === null) dirty.current = title;
        if (mounted.current) {
          setStatus("Title not saved");
          setError(errorMessage(err));
        }
      }
      throw new UnsavedEditError(`Title not saved: ${errorMessage(err)}`, () => input.current?.focus());
    }).finally(() => {
      pending.current--;
    });
    saving.current = promise;
    promise.catch(() => {
    });
    return promise;
  };
  useEffect(() => registerFlush(flush), [registerFlush, recovery]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (dirty.current === null && pending.current === 0 && !recoveryRef.current) setValue(item.title);
  }, [item.title]);
  const resize = () => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${input.current.scrollHeight}px`;
    }
  };
  useLayoutEffect2(resize, [value]);
  useLayoutEffect2(() => {
    const parent = input.current?.parentElement;
    if (!parent || !globalThis.ResizeObserver) return;
    let width = parent.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width !== parent.clientWidth) {
        width = parent.clientWidth;
        resize();
      }
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  return h(
    "div",
    { className: "ws-title-wrap" },
    h("h1", { id: headingId, className: "ws-title-reader" }, value.trim() || item.title),
    recovery && h(
      "div",
      { className: "ws-title-recovery ws-banner", role: "status" },
      h("p", null, "A title draft is retained for this exact Workspace. Recovering applies and saves it: ", h("strong", null, recovery.title)),
      h(Action, { disabled: locked, onClick: () => {
        const text = recovery.title;
        recoveryRef.current = null;
        setRecovery(null);
        setValue(text);
        retain(text);
        void flush().catch(() => {
        });
      } }, "Recover title"),
      h(Action, { disabled: locked, onClick: () => {
        buffer?.discard();
        recoveryRef.current = null;
        setRecovery(null);
        dirty.current = null;
        setValue(item.title);
        setError("");
        setStatus("Saved");
      } }, "Discard retained title")
    ),
    h(Textarea, {
      ref: input,
      rows: 1,
      className: `ws-title${value.trim() ? "" : " ws-title-empty"}`,
      "aria-label": "Page title",
      value,
      placeholder: "Page title",
      "aria-invalid": Boolean(error),
      "aria-describedby": !value.trim() ? `${headingId}-empty${status !== "Saved" ? ` ${headingId}-status` : ""}` : status !== "Saved" ? `${headingId}-status` : void 0,
      disabled: locked || Boolean(recovery),
      onChange: (e) => {
        const text = e.target.value;
        setValue(text);
        retain(text);
        setStatus("Unsaved title");
        setError("");
      },
      onBlur: () => {
        if (!locked && !recoveryRef.current && !error) void flush().catch(() => {
        });
      },
      onKeyDown: (e) => {
        if (isSubmitEnter2(e)) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }
    }),
    !value.trim() && h("span", { id: `${headingId}-empty`, className: "ws-title-empty-cue" }, "Page title \u2014 enter a name"),
    status !== "Saved" && h(
      "div",
      { id: `${headingId}-status`, className: "ws-title-status", role: error ? "alert" : "status" },
      h("span", null, error ? `Title not saved. ${error}` : status),
      error && h(Action, { disabled: locked, onMouseDown: (event) => event.preventDefault(), onClick: (event) => {
        const opener = event.currentTarget;
        void flush().then(() => {
          if (document.activeElement === document.body || document.activeElement === opener) input.current?.focus();
        }).catch(() => {
        });
      } }, "Retry title save")
    )
  );
}

// frontend/drafts.mjs
var DraftRepository = class {
  constructor(storage, connectionId, profile) {
    this.storage = storage;
    this.connectionId = connectionId;
    this.profile = profile;
  }
  key(scopeId, field = "content") {
    if (!scopeId || !this.connectionId || !this.profile)
      throw new Error("Draft source is unavailable.");
    const prefix = { content: "recovery-drafts", title: "recovery-titles", property: "recovery-properties", discussion: "recovery-discussions" }[field];
    if (!prefix) throw new Error("Unknown recovery field.");
    return `${prefix}:v1:${JSON.stringify([this.connectionId, this.profile, scopeId])}`;
  }
  list(scopeId, field = "content") {
    const entries = this.storage.get(this.key(scopeId, field), []);
    return Array.isArray(entries) ? entries.filter((entry) => entry?.version === 1 && entry.connection_id === this.connectionId && entry.profile === this.profile && entry.scope_id === scopeId && typeof entry.item_id === "string" && typeof entry.token === "string" && (field === "property" ? typeof entry.property_id === "string" && Object.hasOwn(entry, "value") : field === "discussion" ? entry.draft && typeof entry.draft === "object" && !Array.isArray(entry.draft) : typeof entry[field === "title" ? "title" : "html"] === "string")) : [];
  }
  bind(scopeId, itemId, field = "content", propertyId = "") {
    if (field === "property" && !propertyId) throw new Error("A property draft needs its column.");
    const matches = (entry) => entry.item_id === itemId && (field !== "property" || entry.property_id === propertyId);
    const read = () => this.list(scopeId, field).find(matches) ?? null;
    const remove = () => this.storage.set(this.key(scopeId, field), this.list(scopeId, field).filter((entry) => !matches(entry)));
    return {
      read,
      put: (value, baseValue) => {
        const payload = field === "title" ? { title: value, base_title: baseValue, field: "title" } : field === "property" ? { value: structuredClone(value), base_value: structuredClone(baseValue), property_id: propertyId, field: "property" } : field === "discussion" ? { draft: structuredClone(value), field: "discussion" } : { html: value, base_html: baseValue };
        const entry = {
          version: 1,
          connection_id: this.connectionId,
          profile: this.profile,
          scope_id: scopeId,
          item_id: itemId,
          ...payload,
          token: crypto.randomUUID(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.storage.set(this.key(scopeId, field), [...this.list(scopeId, field).filter((old) => !matches(old)), entry]);
        if (read()?.token !== entry.token)
          throw new Error("Draft recovery could not be retained. Copy the text before leaving this page.");
        return entry;
      },
      acknowledge: (token) => {
        if (read()?.token === token) remove();
      },
      discard: remove
    };
  }
};

// frontend/navigation-resize.jsx
import { useCallback, useLayoutEffect as useLayoutEffect3, useRef as useRef4, useState as useState4 } from "react";
var DEFAULT_WIDTH = 280;
var MIN_WIDTH = 200;
var MAX_WIDTH = 560;
var bounded = (value, max = MAX_WIDTH) => Math.round(Math.max(MIN_WIDTH, Math.min(max, value)));
function useNavigationResize(storage, owner) {
  const key = `navigation-width:v1:${JSON.stringify(JSON.parse(owner).slice(0, 2))}`;
  const [preferred, setPreferred] = useState4(() => {
    try {
      const value = storage?.get(key, DEFAULT_WIDTH);
      return typeof value === "number" && Number.isFinite(value) ? bounded(value) : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });
  const [available, setAvailable] = useState4({ width: 0, height: 0 }), [error, setError] = useState4("");
  const body = useRef4(null), drag = useRef4(null), current = useRef4(preferred);
  const [bodyNode, setBodyNode] = useState4(null);
  const bindBody = useCallback((node) => {
    body.current = node;
    setBodyNode(node);
  }, []);
  current.current = preferred;
  useLayoutEffect3(() => {
    if (!body.current) return;
    if (globalThis.ResizeObserver) {
      const observer = new ResizeObserver((entries) => {
        const entry = entries.find((entry2) => entry2.target === body.current);
        if (entry) setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height });
      });
      observer.observe(body.current);
      return () => observer.disconnect();
    }
    const measure = () => setAvailable({ width: body.current.clientWidth, height: body.current.clientHeight });
    window.addEventListener("resize", measure);
    measure();
    return () => window.removeEventListener("resize", measure);
  }, [bodyNode]);
  const max = available.width ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, available.width - 390)) : MAX_WIDTH;
  const width = bounded(preferred, max);
  const persist = (value) => {
    try {
      storage?.set(key, value);
      setError("");
    } catch {
      setError("Navigation resized for this view. Its width could not be saved.");
    }
  };
  return {
    body: bindBody,
    width,
    max,
    error,
    availableWidth: available.width,
    availableHeight: available.height,
    start(event) {
      if (event.button !== 0 || drag.current) return;
      event.preventDefault();
      drag.current = { id: event.pointerId, x: event.clientX, width, preferred: current.current };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    move(event) {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      const next = bounded(start.width + (event.clientX - start.x) / elementScale(body.current), max);
      current.current = next;
      setPreferred(next);
    },
    end(event, cancelled = false) {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      drag.current = null;
      if (cancelled) {
        current.current = start.preferred;
        setPreferred(start.preferred);
      } else persist(current.current);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    key(event) {
      const step = event.shiftKey ? 40 : 10;
      const next = { ArrowLeft: width - step, ArrowRight: width + step, Home: MIN_WIDTH, End: max }[event.key];
      if (next === void 0) return;
      event.preventDefault();
      current.current = bounded(next, max);
      setPreferred(current.current);
      persist(current.current);
    }
  };
}
function NavigationResizeHandle({ navigation, controls }) {
  return h(
    "div",
    {
      className: "ws-nav-resize",
      role: "separator",
      tabIndex: 0,
      "aria-label": "Resize Workspace navigation",
      "aria-orientation": "vertical",
      "aria-controls": controls,
      "aria-valuemin": MIN_WIDTH,
      "aria-valuemax": navigation.max,
      "aria-valuenow": navigation.width,
      "aria-valuetext": `${navigation.width} pixels wide`,
      "aria-describedby": `${controls}-resize-help`,
      title: "Drag to resize navigation. Use Left and Right arrow keys when focused.",
      onPointerDown: navigation.start,
      onPointerMove: navigation.move,
      onPointerUp: (event) => navigation.end(event),
      onPointerCancel: (event) => navigation.end(event, true),
      onLostPointerCapture: (event) => navigation.end(event, true),
      onKeyDown: navigation.key
    },
    h("span", { "aria-hidden": true, className: "ws-nav-grip" }),
    h(
      "span",
      { id: `${controls}-resize-help`, className: "ws-title-reader" },
      "Drag to resize navigation. Left and Right arrows adjust by 10 pixels, Shift by 40. Home sets the minimum and End the maximum."
    )
  );
}

// frontend/document-width.mjs
import { useMemo, useState as useState5 } from "react";
function documentWidthKey(owner, scope, itemId) {
  const [connection, profile] = JSON.parse(owner);
  return `document-width:v1:${JSON.stringify([connection, profile, scope, itemId])}`;
}
function useDocumentWidth(storage, owner, scope, itemId) {
  const key = documentWidthKey(owner, scope, itemId);
  const initial = useMemo(() => {
    try {
      return storage?.get(key, false) === true;
    } catch {
      return false;
    }
  }, [storage, key]);
  const [local, setLocal] = useState5({ key, wide: initial, error: "" });
  const current = local.key === key ? local : { key, wide: initial, error: "" };
  return { wide: current.wide, error: current.error, toggle() {
    const next = !current.wide;
    let error = "";
    try {
      if (!storage) throw new Error("Local preferences unavailable");
      storage.set(key, next);
    } catch {
      error = "Document width changed for this view, but its preference could not be saved.";
    }
    setLocal({ key, wide: next, error });
  } };
}

// frontend/client.mjs
var StaleWorkspaceError = class extends Error {
  constructor() {
    super("Workspace source changed. Reopen the page in the selected profile.");
    this.name = "StaleWorkspaceError";
  }
};
var WorkspaceClient = class {
  constructor(ctx, readOwner) {
    this.ctx = ctx;
    this.readOwner = readOwner;
    this.owner = JSON.stringify(readOwner());
    this.value = null;
    this.scopeVersion = 0;
    this.listeners = /* @__PURE__ */ new Set();
    this.queue = Promise.resolve();
    this.active = true;
    this.replacement = null;
    this.searchActive = false;
    this.searchPending = null;
    this.searchVersion = 0;
    this.loadPending = null;
  }
  current() {
    return this.active && JSON.stringify(this.readOwner()) === this.owner;
  }
  assertCurrent() {
    if (!this.current()) throw new StaleWorkspaceError();
  }
  snapshot = () => this.value;
  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  accept(state) {
    this.assertCurrent();
    if (!state || !state.scope_id || !Array.isArray(state.items) || !Number.isFinite(state.revision))
      throw new Error("Workspace returned an invalid state.");
    if (this.value?.scope_id === state.scope_id && state.revision < this.value.revision)
      return;
    if (this.value?.scope_id !== state.scope_id) this.scopeVersion++;
    this.value = state.identity || this.value?.scope_id !== state.scope_id ? state : { ...state, identity: this.value?.identity };
    for (const fn of this.listeners) fn();
  }
  assertScope(scope) {
    this.assertCurrent();
    if (!scope || !this.value?.scope_id)
      throw new Error("Load Workspace before making changes.");
    if (this.value.scope_id !== scope) throw new StaleWorkspaceError();
  }
  load() {
    if (this.loadPending) return this.loadPending;
    const request = this.loadState();
    this.loadPending = request;
    request.finally(() => {
      if (this.loadPending === request) this.loadPending = null;
    }).catch(() => {
    });
    return request;
  }
  async loadState() {
    this.assertCurrent();
    if (this.replacement) return null;
    const generation = this.scopeVersion;
    const response = await this.ctx.rest("/state", { timeoutMs: 12e4 });
    this.assertCurrent();
    const state = response.state ?? response;
    if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
    this.accept(state);
    return state;
  }
  /** Read-only full Store search uses the supported ordinary command contract.
   * One transport plus one replaceable latest request bounds rapid typing. It
   * never waits behind draft writes or publishes a search snapshot into them.
   * ctx.rest exposes no cancellation signal; retired requests drain privately. */
  search(query, { offset = 0, revision = null } = {}) {
    this.assertScope(this.value?.scope_id);
    if (!Number.isInteger(offset) || offset < 0 || offset > 0 && !Number.isInteger(revision))
      throw new Error("Restart the search before opening another results page.");
    const version = ++this.searchVersion;
    if (this.searchPending) this.searchPending.reject(new StaleWorkspaceError());
    return new Promise((resolve, reject) => {
      this.searchPending = {
        query,
        offset,
        revision,
        scope: this.value.scope_id,
        generation: this.scopeVersion,
        version,
        resolve,
        reject
      };
      void this.drainSearch();
    });
  }
  cancelSearch() {
    this.searchVersion++;
    this.searchPending?.reject(new StaleWorkspaceError());
    this.searchPending = null;
  }
  async drainSearch() {
    if (this.searchActive) return;
    this.searchActive = true;
    try {
      while (this.searchPending) {
        const request = this.searchPending;
        this.searchPending = null;
        try {
          this.assertScope(request.scope);
          if (request.generation !== this.scopeVersion || request.version !== this.searchVersion)
            throw new StaleWorkspaceError();
          const expectedRevision = request.revision ?? this.value.revision;
          const response = await this.ctx.rest("/command", {
            method: "POST",
            timeoutMs: 3e4,
            body: {
              op: "search_page",
              expected_scope: request.scope,
              include_state: false,
              payload: {
                query: request.query,
                offset: request.offset,
                limit: 100,
                expected_revision: expectedRevision
              }
            }
          });
          this.assertScope(request.scope);
          if (request.generation !== this.scopeVersion || request.version !== this.searchVersion || response.state && response.state.scope_id !== request.scope) throw new StaleWorkspaceError();
          const result = response.result;
          if (!result || result.scope_id !== request.scope || result.revision !== expectedRevision || this.value.revision !== expectedRevision || !Array.isArray(result.items) || result.offset !== request.offset || !Number.isInteger(result.total) || result.total < result.items.length)
            throw new Error("Workspace returned invalid search results.");
          request.resolve(result);
        } catch (error) {
          request.reject(error);
        }
      }
    } finally {
      this.searchActive = false;
    }
  }
  command(op, payload = {}) {
    const scope = this.value?.scope_id, generation = this.scopeVersion;
    const invoke = async () => {
      this.assertScope(scope);
      if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
      const response = await this.ctx.rest("/command", {
        method: "POST",
        body: {
          op,
          expected_scope: this.value.scope_id,
          payload: {
            ...typeof payload === "function" ? payload(this.value) : payload,
            expected_revision: this.value.revision
          }
        }
      });
      this.assertScope(scope);
      if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
      if (response.state && response.state.scope_id !== scope)
        throw new StaleWorkspaceError();
      if (response.state) this.accept(response.identity ? { ...response.state, identity: response.identity } : response.state);
      return response.result;
    };
    const result = this.queue.then(invoke);
    this.queue = result.catch(() => {
    });
    return result;
  }
  /** Interchange shares the same write queue, owner fence and response publication. */
  transfer(path, body) {
    const scope = this.value?.scope_id, generation = this.scopeVersion;
    const invoke = async () => {
      this.assertScope(scope);
      if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
      const result2 = await this.ctx.rest(
        path,
        body === void 0 ? void 0 : {
          method: "POST",
          body: {
            ...body,
            expected_scope: this.value.scope_id,
            expected_revision: this.value.revision
          }
        }
      );
      this.assertScope(scope);
      if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
      if (result2.state && result2.state.scope_id !== scope)
        throw new StaleWorkspaceError();
      if (result2.state) this.accept(result2.state);
      return result2;
    };
    const result = this.queue.then(invoke);
    this.queue = result.catch(() => {
    });
    return result;
  }
  /** Capture once for file selection/confirmation; never bind to a later ambient snapshot. */
  captureRestore() {
    this.assertScope(this.value?.scope_id);
    if (this.replacement)
      throw new Error(
        "Check the previous replacement before starting another."
      );
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map((n) => n.toString(16).padStart(2, "0")).join("");
    return Object.freeze({
      restore_id: id,
      scope: this.value.scope_id,
      revision: this.value.revision,
      generation: this.scopeVersion
    });
  }
  assertRestore(ticket, before = false) {
    this.assertCurrent();
    if (before) {
      this.assertScope(ticket.scope);
      if (this.replacement || ticket.generation !== this.scopeVersion || ticket.revision !== this.value.revision)
        throw new StaleWorkspaceError();
    } else if (this.replacement !== ticket || this.scopeVersion !== ticket.generation + 1)
      throw new StaleWorkspaceError();
  }
  restoreBackup(ticket, data_base64) {
    const invoke = async () => {
      this.assertRestore(ticket, true);
      this.replacement = ticket;
      this.scopeVersion++;
      this.value = null;
      for (const fn of this.listeners) fn();
      let response;
      try {
        response = await this.ctx.rest("/restore-backup", {
          method: "POST",
          timeoutMs: 12e4,
          body: {
            data_base64,
            expected_scope: ticket.scope,
            expected_revision: ticket.revision,
            restore_id: ticket.restore_id,
            include_state: false
          }
        });
      } catch (error) {
        this.assertRestore(ticket);
        return this.restoreStatus(ticket);
      }
      this.assertRestore(ticket);
      return this.restoreReceipt(ticket, response);
    };
    const result = this.queue.then(invoke);
    this.queue = result.catch(() => {
    });
    return result;
  }
  restoreReceipt(ticket, response) {
    this.assertRestore(ticket);
    if (response?.restore_id !== ticket.restore_id || !["running", "committed", "refused", "unknown"].includes(response.status))
      return {
        restore_id: ticket.restore_id,
        status: "unknown",
        detail: "The server did not return a matching replacement receipt."
      };
    if (response.status === "committed" && response.result?.scope_id !== ticket.scope)
      throw new StaleWorkspaceError();
    return response;
  }
  async restoreStatus(ticket) {
    this.assertRestore(ticket);
    try {
      const response = await this.ctx.rest(
        "/restore-status/" + ticket.restore_id + "?expected_scope=" + encodeURIComponent(ticket.scope),
        { timeoutMs: 6e4 }
      );
      this.assertRestore(ticket);
      return this.restoreReceipt(ticket, response);
    } catch (error) {
      this.assertRestore(ticket);
      return {
        restore_id: ticket.restore_id,
        status: "unknown",
        detail: error.message
      };
    }
  }
  async inspectRestore(ticket) {
    this.assertRestore(ticket);
    const response = await this.ctx.rest("/state", { timeoutMs: 12e4 });
    this.assertRestore(ticket);
    const state = response.state ?? response;
    if (state.scope_id !== ticket.scope) throw new StaleWorkspaceError();
    return state;
  }
  async reloadRestore(ticket) {
    this.assertRestore(ticket);
    const response = await this.ctx.rest("/state", { timeoutMs: 12e4 });
    this.assertRestore(ticket);
    const state = response.state ?? response;
    if (state.scope_id !== ticket.scope) throw new StaleWorkspaceError();
    this.accept(state);
    this.replacement = null;
    return state;
  }
  dispose() {
    this.active = false;
    this.cancelSearch();
    this.value = null;
    this.listeners.clear();
  }
};

// frontend/workspace-search.jsx
import { useEffect as useEffect2, useId, useRef as useRef5, useState as useState6 } from "react";
import { SearchField, GlyphSpinner } from "@hermes/plugin-sdk";
function WorkspaceSearch({ client, scope, revision, destination, onOpen, contexts }) {
  const [query, setQuery] = useState6(""), [result, setResult] = useState6(null);
  const [composing, setComposing] = useState6(false), [retry, setRetry] = useState6(0);
  const [page, setPage] = useState6({ offset: 0, revision: null });
  const generation = useRef5(0), input = useRef5(null), list = useRef5(null);
  const statusId = useId();
  const text = query.trim();
  const change = (value) => {
    generation.current++;
    client.cancelSearch();
    setQuery(value);
    setResult(null);
    setPage({ offset: 0, revision: null });
  };
  useEffect2(() => {
    generation.current++;
    client.cancelSearch();
    setQuery("");
    setResult(null);
    setPage({ offset: 0, revision: null });
  }, [client, scope, destination]);
  useEffect2(() => {
    const node = input.current;
    if (!node) return;
    const start = () => {
      generation.current++;
      client.cancelSearch();
      setComposing(true);
      setResult(null);
    };
    const end = () => setComposing(false);
    node.addEventListener("compositionstart", start);
    node.addEventListener("compositionend", end);
    node.setAttribute("aria-describedby", statusId);
    return () => {
      node.removeEventListener("compositionstart", start);
      node.removeEventListener("compositionend", end);
    };
  }, [client, statusId]);
  useEffect2(() => {
    const version = ++generation.current;
    let active = true;
    if (!text || composing || text.length > 500) return;
    const timer = setTimeout(() => {
      setResult({ phase: "pending", query: text, items: [] });
      client.search(text, page).then((found) => {
        if (!active || version !== generation.current || !client.current()) return;
        const items = Array.isArray(found) ? found : found?.items ?? found?.results;
        if (!Array.isArray(items)) throw new Error("Workspace returned invalid search results.");
        setResult({
          phase: "success",
          query: text,
          items,
          total: found.total,
          offset: found.offset,
          limit: found.limit,
          revision: found.revision,
          nextOffset: found.next_offset,
          hasMore: found.has_more
        });
      }).catch((error) => {
        if (active && version === generation.current && client.current())
          setResult({ phase: "error", query: text, items: [], error: errorMessage(error) });
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, scope, revision, query, text, composing, retry, page]);
  useEffect2(() => () => {
    generation.current++;
    client.cancelSearch();
  }, [client, scope]);
  const current = result?.query === text ? result : null;
  const pending = Boolean(text && !composing && text.length <= 500 && (!current || current.phase === "pending"));
  const message = text.length > 500 ? "Use 500 characters or fewer." : composing ? "" : pending ? "Searching Workspace\u2026" : current?.phase === "error" ? "Search did not finish." : current?.phase === "success" ? current.items.length ? `Results ${current.offset + 1}\u2013${current.offset + current.items.length} of ${current.total}.` : "No matches" : "";
  const turnPage = (offset, revision2) => {
    generation.current++;
    client.cancelSearch();
    setResult(null);
    setPage({ offset, revision: revision2 });
    input.current?.focus();
  };
  return h(
    "div",
    { className: "ws-workspace-search", role: "search", "aria-label": "Workspace search" },
    h(SearchField, {
      "aria-label": "Search Workspace",
      placeholder: "Search Workspace\u2026",
      containerClassName: "w-full opacity-100",
      inputClassName: "ws-search-input",
      inputRef: input,
      value: query,
      onChange: change,
      onClear: () => change(""),
      loading: pending,
      trailingAction: pending && query ? h(Action, { variant: "ghost", size: "icon-xs", "aria-label": "Clear search", onClick: () => change("") }, h(Codicon, { name: "close", size: "0.875rem" })) : void 0,
      onKeyDown: (event) => {
        if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229) return;
        if (event.key === "Escape" && query) {
          event.preventDefault();
          change("");
        }
        if (event.key === "ArrowDown" && current?.phase === "success") {
          const first = list.current?.querySelector("button");
          if (first) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }),
    h("p", { id: statusId, className: "ws-search-status", role: "status", "aria-live": "polite", "aria-atomic": true }, message),
    current && h(
      "section",
      { className: "ws-search-results", "aria-label": "Workspace search results", "aria-busy": pending },
      current.phase === "pending" && h(GlyphSpinner, { ariaLabel: "Searching Workspace" }),
      current.phase === "error" && h(
        "div",
        null,
        h("p", { role: "alert" }, current.error),
        h(Action, { onClick: () => {
          setPage({ offset: 0, revision: null });
          setRetry((v) => v + 1);
        } }, "Retry search")
      ),
      h("ul", { ref: list }, current.items.map((row) => h(
        "li",
        { key: row.id ?? row.item_id },
        h(
          Action,
          {
            variant: "ghost",
            onClick: () => onOpen(row.id ?? row.item_id),
            "aria-label": row.title ?? row.name ?? "Open result",
            "aria-describedby": `${statusId}-${row.id ?? row.item_id}-description`
          },
          h(
            "span",
            { className: "ws-search-result-text" },
            h("span", null, row.title ?? row.name ?? "Open result"),
            h(
              "span",
              { id: `${statusId}-${row.id ?? row.item_id}-description` },
              contexts?.get(row.id ?? row.item_id) && h("small", null, contexts.get(row.id ?? row.item_id).description),
              (row.excerpt || row.snippet) && h("small", null, row.excerpt || row.snippet)
            )
          )
        )
      ))),
      current.phase === "success" && h(
        "div",
        { className: "ws-actions", "aria-label": "Search results pages" },
        current.offset > 0 && h(Action, { onClick: () => turnPage(Math.max(0, current.offset - current.limit), current.revision) }, "Previous results"),
        current.hasMore && h(Action, { onClick: () => turnPage(current.nextOffset, current.revision) }, "Next results")
      )
    )
  );
}

// frontend/workspace-navigation-styles.mjs
var workspaceNavigationStyles = `
.ws-body > .ws-nav { grid-column: 1; grid-row: 1; }
.ws-body > .ws-nav-resize { grid-column: 2; grid-row: 1; }
.ws-body > .ws-work { grid-column: 3; grid-row: 1; }
.ws-nav-content { min-width: 0; }
.ws-tree-actions { display: flex; flex-wrap: wrap; gap: 2px 4px; margin-block: 0 6px; }
.ws-tree-actions > [data-slot="button"] { min-height: 2rem; height: auto; padding: 4px 8px; }
.ws-workspace-search { min-width: 0; }
.ws-search-results { margin-block: 8px 16px; }
.ws-search-results > p { margin: 8px 0; }
.ws-nav .ws-search-results li > [data-slot="button"] {
  white-space: normal; align-items: start; height: auto;
}
.ws-search-result-text { min-width: 0; display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; }
.ws-search-result-text > span { white-space: normal; }
.ws-search-result-text small { color: var(--ui-text-secondary); font: inherit; white-space: normal; }
.ws-nav ul ul { min-width: 0; }
.ws-nav li { min-width: 0; }
.ws-order-help, .ws-order-status { font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.ws-order-help { margin: 4px 0 8px; color: var(--ui-text-secondary); }
.ws-order-status { margin: 0; }
.ws-order-status:not(:empty) { margin-block: 6px; }
.ws-folder-navigation[data-reordering="true"] .ws-order-status { height: 4.5em; overflow: auto; margin-block: 6px; }
.ws-order-status[role="alert"] { color: var(--ui-text-primary); border-inline-start: 2px solid var(--ui-accent); padding-inline-start: 6px; }
.ws-folder-navigation[data-reordering="true"] .ws-order-row { display: flex; align-items: center; flex-wrap: wrap; position: relative; }
.ws-folder-navigation[data-reordering="true"] .ws-order-row > [data-slot="button"] { flex: 1; width: auto; min-width: 72px; }
.ws-order-controls { display: inline-flex; gap: 0; flex: 0 0 auto; margin-inline-start: auto; }
.ws-order-controls > [data-slot="button"] { padding: 4px; width: 28px; min-width: 28px; height: 32px; }
.ws-order-controls .ws-order-handle { cursor: grab; }
.ws-order-controls .ws-order-handle:active { cursor: grabbing; }
.ws-order-controls > [data-slot="button"]:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: -2px; }
.ws-order-row[data-order-position] { background: var(--ui-bg-quaternary); }
.ws-order-row[data-order-position]::after {
  content: ""; position: absolute; inset-inline: 0; height: 2px; background: var(--ui-accent); pointer-events: none;
}
.ws-order-row[data-order-position="before"]::after { top: 0; }
.ws-order-row[data-order-position="after"]::after { bottom: 0; }
@container hermes-workspace (max-width: 600px) {
  .ws-nav { flex: 0 0 auto; max-height: min(240px, 40vh); }
  .ws-nav[data-expanded="true"] { flex-shrink: 1; }
}
`;

// frontend/styles.mjs
var styles = `
.ws-root {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: var(--ui-text-primary);
  font: inherit;
  font-size: var(--font-size-base, 13px);
  line-height: 1.5;
  isolation: isolate;
  container-name: hermes-workspace;
  container-type: inline-size;
}
.ws-root * {
  box-sizing: border-box;
}
.ws-root [hidden] {
  display: none !important;
}
.ws-root button {
  max-width: 100%;
}
.ws-muted,
.ws-label,
.ws-source {
  color: var(--ui-text-secondary);
}
.ws-root .ws-state-description,
.ws-root .ws-empty-state .text-muted-foreground {
  color: var(--ui-text-secondary);
}
.ws-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--ui-stroke-tertiary);
  min-height: 49px;
  flex-wrap: wrap;
}
.ws-topbar h1 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  margin: 0 auto 0 0;
}
.ws-source {
  font-size: 12px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-body {
  display: grid;
  grid-template-columns: var(--ws-nav-width, 280px) 10px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.ws-nav {
  padding: 16px 12px;
  overflow: auto;
  overscroll-behavior: contain;
  min-width: 0;
  background: transparent;
}
.ws-nav h2 {
  font-size: 12px;
  font-weight: 500;
  margin: 28px 8px 8px;
  color: var(--ui-text-secondary);
}
.ws-nav .ws-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
}
.ws-nav .ws-search .ws-field {
  margin: 0;
  flex: 1;
}
.ws-nav .ws-search .ws-label {
  position: absolute;
  clip-path: inset(50%);
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.ws-nav .ws-search input {
  width: 100%;
  min-width: 0;
}
.ws-root .ws-search-input::placeholder {
  color: var(--ui-text-secondary);
  opacity: 1;
}
.ws-nav .ws-search > [data-slot="button"] {
  justify-self: end;
  width: auto;
  margin: 0;
}
.ws-search-status { margin: 0; color: var(--ui-text-secondary); font-size: 12px; }
.ws-search-status:not(:empty) { margin: 6px 8px 0; }
.ws-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.ws-nav li ul {
  padding-left: 10px;
  border-left: 1px solid var(--ui-stroke-tertiary);
  margin-left: 4px;
}
.ws-nav summary {
  display: flex;
  align-items: center;
  gap: 2px;
}
.ws-disclosure-caret { flex-shrink: 0; transition: transform 150ms; }
.ws-nav details[open] > summary > .ws-disclosure-caret { transform: rotate(90deg); }

.ws-nav summary > [data-slot="button"] { width: auto; min-width: 0; flex: 1; }
.ws-nav li > [data-slot="button"],
.ws-nav-row > [data-slot="button"],
.ws-nav summary > [data-slot="button"],
.ws-nav > [data-slot="button"] {
  justify-content: flex-start;
  width: 100%;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 6px 8px;
  font-weight: 400;
  min-height: 2rem;
  height: auto;
}
.ws-nav [aria-current="page"] {
  background: var(--ui-bg-quaternary);
  color: var(--ui-text-primary);
  font-weight: 600;
  border-left: 2px solid var(--ui-accent);
}
.ws-nav-label { display: flex; flex-direction: column; min-width: 0; }
.ws-nav-label > span:first-child, .ws-nav-label small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-nav-resize { display: flex; align-items: center; justify-content: center; cursor: col-resize; touch-action: none; user-select: none; border-inline: 1px solid var(--ui-stroke-tertiary); }
.ws-nav-grip { width: 4px; height: 32px; border-inline: 1px solid var(--ui-text-secondary); border-radius: 2px; }
.ws-nav-resize:hover, .ws-nav-resize:focus-visible { background: var(--ui-bg-quaternary); }
.ws-nav-resize:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: -2px; }
.ws-nav-label small { font-size: 11px; line-height: 1.4; color: var(--ui-text-secondary); font-weight: 400; }
.ws-nav-row {
  min-width: 0;
}
.ws-page-utilities h3 { margin: 0 0 8px; font: inherit; font-weight: 600; }
.ws-page-utilities h3:not(:first-child) { margin-top: 20px; }
.ws-page-utilities p { margin: 10px 0; }
.ws-item-id { overflow-wrap: anywhere; }
.ws-nav > button:last-child {
  margin-top: 24px;
}
.ws-work {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.ws-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  min-height: 100%;
  align-items: start;
  position: relative;
}
.ws-folder-layout {
  grid-template-columns: minmax(0, 1fr);
}
.ws-document {
  padding: 32px clamp(24px, 3.4vw, 56px) 48px;
  min-width: 0;
  position: relative;
}
.ws-document-header { display: contents; }
.ws-page-kind {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--ui-text-secondary);
  font-size: 12px;
  margin-bottom: 12px;
}
.ws-title-wrap {
  position: relative;
  margin: 0 0 12px;
}
.ws-root .ws-title {
  display: block;
  resize: none;
  overflow: hidden;
  min-height: 1.4em;
  height: auto;
  width: 100%;
  max-width: 100%;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0;
  font: inherit;
  font-size: clamp(26px, 2.7vw, 36px) !important;
  line-height: 1.25;
  font-weight: 650;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
  color: var(--ui-text-primary);
}
.ws-title:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 6px;
}
.ws-root .ws-title-empty { outline: 1px dashed var(--ui-stroke-secondary); outline-offset: 6px; }
.ws-root .ws-title-empty:focus-visible { outline: 2px solid var(--ui-accent); }
.ws-title-empty-cue { display: block; margin-top: 8px; font-size: 12px; color: var(--ui-text-secondary); }
.ws-page-actions {
  display: flex;
  gap: 8px;
  margin: 0 -8px 24px;
  align-items: center;
}
.ws-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ws-document h2 {
  font-size: 18px;
  font-weight: 600;
}
.ws-document-footer {
  display: flex;
  gap: 8px;
  padding: 16px 0;
  border-top: 1px solid var(--ui-stroke-tertiary);
  margin-top: 24px;
}
.ws-rich-editor {
  min-width: 0;
}
.ws-editor-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin: 0 -8px 12px;
}
.ws-editor-hint {
  font-size: 11px;
  text-align: right;
}
.ws-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 12px;
  margin-bottom: 16px;
  background: var(--ui-bg-secondary);
  border: 1px solid var(--ui-stroke-tertiary);
  border-radius: var(--radius-sm, 4px);
}
.ws-toolbar fieldset {
  display: contents;
}
.ws-toolbar .ws-choice {
  margin: 0;
  min-width: 120px;
}
.ws-toolbar .ws-label {
  font-size: 11px;
}
.ws-toolbar fieldset:disabled {
  opacity: 0.5;
}
.ws-editor-canvas {
  position: relative;
  min-width: 0;
}
.ws-editor {
  min-height: 260px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  outline: none;
  max-width: 72ch;
  padding: 0 0 32px;
  font-size: 14px;
}
.ws-wide-document .ws-editor {
  max-width: 100%;
}
.ws-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--ui-text-secondary);
  pointer-events: none;
}
.ws-editor:focus-visible {
  outline: none;
  box-shadow: -2px 0 var(--ui-stroke-secondary);
}
:is(.ws-editor, .ws-section-fragment) h1 {
  font-size: 1.85em;
  font-weight: 650;
  line-height: 1.35;
  margin: 1.3em 0 0.4em;
}
:is(.ws-editor, .ws-section-fragment) h2 {
  font-size: 1.5em;
  line-height: 1.4;
  margin: 1.2em 0 0.4em;
}
:is(.ws-editor, .ws-section-fragment) h3 {
  font-size: 1.2em;
  line-height: 1.4;
  margin: 1.2em 0 0.4em;
}
:is(.ws-editor, .ws-section-fragment) p {
  margin: 0.6em 0;
}
:is(.ws-editor, .ws-section-fragment) > :first-child {
  margin-top: 0;
}
:is(.ws-editor, .ws-section-fragment) ul,
:is(.ws-editor, .ws-section-fragment) ol {
  padding-left: 1.6em;
}
:is(.ws-editor, .ws-section-fragment) ul { list-style-type: disc; }
:is(.ws-editor, .ws-section-fragment) ol { list-style-type: decimal; }
:is(.ws-editor, .ws-section-fragment) ul ul { list-style-type: circle; }
:is(.ws-editor, .ws-section-fragment) ul ul ul { list-style-type: square; }
:is(.ws-editor, .ws-section-fragment) ol ol { list-style-type: lower-alpha; }
:is(.ws-editor, .ws-section-fragment) ol ol ol { list-style-type: lower-roman; }
:is(.ws-editor, .ws-section-fragment) li:has(> input[type="checkbox"]) { list-style: none; }
:is(.ws-editor, .ws-section-fragment) li {
  margin: 0.2em 0;
}
:is(.ws-editor, .ws-section-fragment) input[type="checkbox"] {
  accent-color: var(--ui-accent);
  margin-right: 6px;
}
:is(.ws-editor, .ws-section-fragment) blockquote {
  border-left: 3px solid var(--ui-stroke-secondary);
  padding: 4px 0 4px 18px;
  margin: 20px 0;
  color: var(--ui-text-secondary);
}
:is(.ws-editor, .ws-section-fragment) pre {
  font-family: var(--font-mono, monospace);
  padding: 16px;
  background: var(--ui-bg-quaternary);
  border-radius: var(--radius-sm, 4px);
  white-space: pre-wrap;
}
:is(.ws-editor, .ws-section-fragment) img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm, 4px);
}
:is(.ws-editor, .ws-section-fragment) table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  table-layout: fixed;
}
:is(.ws-editor, .ws-section-fragment) td,
:is(.ws-editor, .ws-section-fragment) th {
  border: 1px solid var(--ui-stroke-tertiary);
  padding: 8px;
  text-align: left;
  overflow-wrap: anywhere;
}
:is(.ws-editor, .ws-section-fragment) a {
  color: var(--ui-accent);
  text-decoration: underline;
}
:is(.ws-editor, .ws-section-fragment)[contenteditable="false"] {
  color: var(--ui-text-secondary);
}
.ws-save {
  font-size: 11px;
  color: var(--ui-text-secondary);
  padding: 4px 0;
  display: flex;
  gap: 8px;
  align-items: center;
}
.ws-selection-anchor { pointer-events: none; }
.ws-attachment-detail { display: inline-block; margin-inline-start: 8px; }
.ws-selection-popover { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; width: auto; max-width: min(26rem, var(--radix-popover-content-available-width, calc(100vw - 16px))); padding: 4px; }
.ws-selection-popover .ws-choice { margin: 0; min-width: 0; width: 6.5rem; }
.ws-selection-popover .ws-choice-trigger { min-width: 0; }
.ws-selection-popover button { color: var(--ui-text-primary); }
.ws-format-bold { font-weight: 700; }
.ws-format-italic { font-style: italic; }
.ws-format-underline { text-decoration: underline; }
.ws-loading { display: inline-flex; gap: 8px; align-items: center; }
.ws-passage-marker {
  position: absolute !important;
  left: -25px;
  min-width: 20px;
  height: 23px;
  padding: 0 !important;
  font-size: 10px !important;
  border: 1px solid var(--ui-stroke-secondary);
  color: var(--ui-accent);
  background: var(--ui-bg-primary);
}
.ws-passage-marker[aria-pressed="true"] {
  outline: 2px solid var(--ui-accent);
  outline-offset: 1px;
}
.ws-menu [role="menuitem"] { white-space: normal; overflow-wrap: anywhere; max-width: min(32rem, calc(100vw - 32px)); }
.ws-dialog { max-width: min(32rem, calc(100vw - 32px)); }
.ws-dialog [data-slot="dialog-title"] { padding-inline-end: 2rem; overflow-wrap: anywhere; }
.ws-dialog .ws-dialog-footer { flex-wrap: wrap; }
.ws-dialog .ws-dialog-description { color: var(--ui-text-secondary); }
.ws-dialog .ws-dialog-footer button { max-width: 100%; white-space: normal; height: auto; }
.ws-dialog .ws-recovery-actions { flex-direction: column; align-items: stretch; }
.ws-checkbox[data-state="unchecked"] { border-color: var(--ui-text-secondary); }
.ws-formula-help { font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.ws-formula-help p { margin: 8px 0; }
.ws-formula-help ul { margin: 8px 0; padding-left: 18px; list-style: disc; }
.ws-properties .ws-choice, .ws-table .ws-choice { margin: 0; }
.ws-board:focus-visible, .ws-table-wrap:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
.ws-nav-toggle { display: none; }
.ws-nav-content { min-width: 0; }
.ws-title-reader { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ws-title-status { font-size: 12px; margin: 6px 0 12px; }
.ws-save-error { font-size: 13px; color: var(--ui-text-primary); border-left: 2px solid var(--ui-stroke-secondary); padding-left: 10px; overflow-wrap: anywhere; }
.ws-title-recovery { font-size: 12px; margin-bottom: 12px; }
.ws-notice { padding: 12px 20px; border-bottom: 1px solid var(--ui-stroke-tertiary); font-size: 12px; overflow-wrap: anywhere; }
.ws-outcome { padding: 16px; margin-bottom: 24px; border: 1px solid var(--ui-stroke-secondary); border-left: 3px solid var(--ui-accent); font-size: 13px; line-height: 1.6; }
.ws-outcome p { margin: 8px 0; }
.ws-outcome.ws-run-banner { font-size: 12px; line-height: 1.5; border-top: 0; border-right: 0; }
.ws-outcome details { flex-basis: 100%; min-width: 0; }
.ws-outcome .ws-actions { flex-wrap: wrap; }
.ws-comments {
  padding: 32px 20px 40px;
  border-left: 1px solid var(--ui-stroke-tertiary);
  position: sticky;
  top: 0;
  max-height: 100cqh;
  overflow: auto;
  min-width: 0;
  font-size: 12px;
}
.ws-comments-heading {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ws-comments h2 {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}
.ws-comment-count {
  padding: 0 6px;
  border: 1px solid var(--ui-stroke-tertiary);
  border-radius: var(--radius-sm, 4px);
  font-size: 11px;
  color: var(--ui-text-secondary);
}
.ws-comments > p {
  line-height: 1.65;
  margin: 10px 0 16px;
}
.ws-comments > .ws-check {
  margin: 16px 0;
}
.ws-comment {
  padding: 16px 0;
  border-top: 1px solid var(--ui-stroke-tertiary);
  overflow-wrap: anywhere;
  scroll-margin: 16px;
}
.ws-comment-active {
  border-left: 2px solid var(--ui-accent);
  padding-left: 12px;
  margin-left: -14px;
}
.ws-comment:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 5px;
}
.ws-comment-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.ws-comment-meta .ws-muted {
  font-size: 11px;
}
.ws-comment p {
  white-space: pre-wrap;
  line-height: 1.65;
  margin: 10px 0;
}
.ws-comment .ws-check {
  font-size: 11px;
  color: var(--ui-text-secondary);
}
.ws-comment textarea {
  min-height: 54px !important;
}
.ws-reply-compose {
  margin-top: 12px;
  font-size: 11px;
  color: var(--ui-text-secondary);
}
.ws-reply-compose form {
  margin-top: 10px;
}
.ws-reply-compose form > button {
  margin-top: 8px;
}
.ws-anchor {
  font-size: 12px;
  color: var(--ui-text-secondary);
  border-left: 2px solid var(--ui-accent);
  padding: 4px 0 4px 10px;
  line-height: 1.6;
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.ws-anchor button {
  display: block;
  margin-top: 4px;
}
.ws-target {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ui-stroke-tertiary);
  border-radius: var(--radius-sm, 4px);
  padding: 2px 6px;
  margin: 4px 4px 0 0;
  font-size: 11px;
  color: var(--ui-text-secondary);
  overflow-wrap: anywhere;
  max-width: 100%;
}
.ws-reply {
  margin-left: 10px;
  padding-top: 8px;
  border-left: 1px solid var(--ui-stroke-tertiary);
  padding-left: 10px;
}
.ws-reply strong {
  font-size: 11px;
}
.ws-comment-composer {
  margin: 24px 0;
  min-width: 0;
}
.ws-comment-composer-anchored {
  border-top: 2px solid var(--ui-accent);
  padding-top: 12px;
}
.ws-comment-composer textarea {
  min-height: 86px;
  resize: vertical;
}
.ws-comment-composer > button {
  margin: 10px 8px 0 0;
}
.ws-thread-divider {
  border-top: 1px solid var(--ui-stroke-tertiary);
  margin: 28px 0 20px;
}
.ws-comments > .ws-actions button {
  white-space: normal;
  text-align: left;
}
.ws-comments > .ws-choice {
  max-width: 100%;
}
.ws-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
}
.ws-field,
.ws-choice {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
  min-width: 0;
}
.ws-label {
  font-size: 12px;
}
.ws-choice-trigger { min-width: 0; max-width: 100%; width: 100%; }
.ws-choice-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.ws-choice-content [role="option"] { white-space: normal; overflow-wrap: anywhere; }
.ws-banner {
  padding: 14px 16px;
  background: var(--ui-bg-quaternary);
  border-left: 3px solid var(--ui-accent);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.ws-run-banner {
  grid-column: 1 / -1;
  position: sticky;
  top: 0;
  z-index: 20;
  margin: 0;
  padding: 10px 16px;
  background: var(--ui-bg-elevated, var(--ui-bg-editor));
  border-bottom: 1px solid var(--ui-stroke-tertiary);
}
.ws-property-status, .ws-field-error { font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.ws-property-status { margin-top: 6px; }
.ws-property-status .ws-actions { margin-top: 6px; }
.ws-formula-value { display: flex; flex-direction: column; gap: 4px; }
.ws-field-error { color: var(--ui-text-secondary); }
.ws-discussion-draft { margin: 8px 0; }
.ws-error {
  padding: 12px 16px;
  color: var(--ui-text-primary);
  border-left: 3px solid var(--ui-accent);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ws-error .ws-actions {
  margin-top: 8px;
}
.ws-error pre, .ws-dialog [role="alert"] pre { white-space: pre-wrap; overflow-wrap: anywhere; max-width: 100%; }
.ws-home {
  padding: 40px clamp(24px, 4vw, 64px);
  max-width: 980px;
  min-width: 0;
}
.ws-home > h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 36px 0 12px;
}
.ws-home > h2:first-child {
  font-size: 30px;
  margin-top: 0;
  letter-spacing: -0.02em;
}
.ws-home > p {
  max-width: 68ch;
  line-height: 1.8;
}
.ws-home > .ws-actions {
  margin: 24px 0;
}
.ws-list {
  list-style: none;
  padding: 0;
  margin: 16px 0;
}
.ws-list > li {
  padding: 14px 0;
  border-bottom: 1px solid var(--ui-stroke-tertiary);
  overflow-wrap: anywhere;
}
.ws-list > li > button {
  white-space: normal;
  text-align: left;
}
.ws-list > li > .ws-muted {
  font-size: 11px;
  margin-left: 12px;
}
.ws-list > .ws-home-item { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.ws-list > .ws-home-item > button { max-width: 100%; height: auto; font-weight: 500; padding-inline: 0; }
.ws-home-location { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-text-secondary); font-size: 12px; }
.ws-list .ws-actions {
  margin-top: 8px;
}
.ws-empty {
  color: var(--ui-text-secondary);
  padding: 20px 0;
  line-height: 1.7;
  max-width: 64ch;
}
.ws-properties {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px 24px;
  padding: 12px 0 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--ui-stroke-tertiary);
}
.ws-properties > .ws-field {
  margin: 0;
}
.ws-table-wrap {
  overflow: auto;
  max-width: 100%;
  overscroll-behavior: contain;
  border: 1px solid var(--ui-stroke-tertiary);
  margin: 16px 0;
}
.ws-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 520px;
  font-size: 12px;
}
.ws-table td,
.ws-table th {
  border-bottom: 1px solid var(--ui-stroke-tertiary);
  padding: 10px 12px;
  text-align: left;
  min-width: 140px;
  max-width: 280px;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.ws-table th {
  font-weight: 500;
  color: var(--ui-text-secondary);
  background: var(--ui-bg-secondary);
}
.ws-table th button {
  white-space: normal;
}
.ws-table thead th {
  border-right: 1px solid var(--ui-stroke-tertiary);
}
.ws-table input:not([type="checkbox"]) {
  background: transparent;
  box-shadow: none;
  min-width: 100px;
}
.ws-table .ws-choice {
  margin: 0;
}
.ws-table .ws-label {
  position: absolute;
  clip-path: inset(50%);
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.ws-table tbody tr:hover {
  background: var(--ui-bg-secondary);
}
.ws-database-tools {
  display: flex;
  gap: 12px;
  align-items: end;
  flex-wrap: wrap;
}
.ws-database-tools > .ws-choice {
  min-width: 100px;
  margin: 0 auto 0 0;
}
.ws-database-filters {
  width: 100%;
  padding: 12px 0;
  border-bottom: 1px solid var(--ui-stroke-tertiary);
}
.ws-database-filters > div {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.ws-database-filters .ws-field {
  flex: 1;
  min-width: 140px;
}
.ws-database-filters summary {
  font-size: 12px;
  color: var(--ui-text-secondary);
}
.ws-board {
  display: flex;
  gap: 20px;
  overflow: auto;
  padding: 20px 0;
}
.ws-board-group {
  min-width: 200px;
  flex: 1;
  max-width: 320px;
}
.ws-board-group h3 {
  font-size: 12px;
  font-weight: 600;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--ui-stroke-secondary);
}
.ws-board-record {
  padding: 12px;
  border: 1px solid var(--ui-stroke-tertiary);
  background: var(--ui-bg-secondary);
  margin: 10px 0;
  border-radius: var(--radius-sm, 4px);
}
.ws-board-record > button {
  white-space: normal;
  text-align: left;
}
.ws-board-record .ws-label {
  font-size: 11px;
}
.ws-attachments {
  margin-top: 32px;
}
.ws-attachments h2 {
  font-size: 12px;
  color: var(--ui-text-secondary);
  margin: 0 0 8px;
}
.ws-attachments:has(> h2:only-child) {
  display: none;
}
.ws-document > details,
.ws-document > div > details {
  margin-top: 24px;
  color: var(--ui-text-secondary);
  font-size: 12px;
}
.ws-root summary {
  cursor: pointer;
}
.ws-root summary:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 3px;
}
.ws-menu {
  max-width: calc(100vw - 24px);
  max-height: var(--radix-dropdown-menu-content-available-height);
  overflow-y: auto;
}
.ws-menu [role="menuitem"] {
  white-space: normal;
  overflow-wrap: anywhere;
}
@container hermes-workspace (max-width: 1200px) {
  .ws-layout {
    grid-template-columns: minmax(0, 1fr) 268px;
  }
  .ws-document {
    padding: 28px 28px 40px;
  }
  .ws-comments {
    padding: 28px 16px;
  }
  .ws-editor-hint {
    display: none;
  }
}
@container hermes-workspace (max-width: 980px) {
  .ws-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .ws-comments {
    position: static;
    border-left: 0;
    border-top: 1px solid var(--ui-stroke-tertiary);
    max-height: none;
    padding: 24px 28px;
  }
  .ws-comments-heading {
    margin-bottom: 10px;
  }
  .ws-comments > p {
    max-width: 64ch;
  }
  .ws-comment-composer {
    max-width: 64ch;
  }
  .ws-title {
    font-size: 30px !important;
  }
}
@container hermes-workspace (max-width: 600px) {
  .ws-nav-resize { display: none; }
  .ws-body {
    display: flex;
    flex-direction: column;
  }
  .ws-nav {
    max-height: min(240px, 45cqh);
    border-right: 0;
    border-bottom: 1px solid var(--ui-stroke-tertiary);
    padding: 10px 16px;
  }
  .ws-nav-toggle { display: flex; width: 100%; justify-content: flex-start; text-align: left; }
  .ws-nav-toggle span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .ws-nav[data-expanded="false"] .ws-nav-content { display: none; }
  .ws-nav[data-expanded="false"] { overflow: visible; flex-shrink: 0; }
  .ws-nav h2 {
    margin: 16px 8px 6px;
  }
  .ws-nav .ws-search {
    flex-wrap: nowrap;
  }
  .ws-work {
    flex: 1;
  }
  .ws-document,
  .ws-home {
    padding: 24px;
  }
  .ws-topbar {
    padding: 10px 12px;
    gap: 8px;
  }
  .ws-source {
    display: none;
  }
  .ws-comments {
    padding: 24px;
  }
  .ws-passage-marker {
    left: -21px;
  }
  .ws-root .ws-title {
    font-size: 28px !important;
  }
  .ws-table-wrap {
    max-width: 100%;
  }
  .ws-toolbar {
    padding: 8px;
  }
  .ws-document-footer {
    margin-top: 16px;
  }
}
@container hermes-workspace (max-width: 480px) {
  .ws-topbar-compact { flex-wrap: nowrap; min-height: 40px; padding: 4px 12px; }
  .ws-topbar-compact h1 { white-space: nowrap; }
  .ws-nav { padding: 4px 12px; }
}
/* Passage bubbles share the document's scroll surface; there is no feed scroller. */
.ws-layout { display: block; margin-inline: auto; --ws-inline-comments: 0; --ws-comment-controls-gap: 20px; }
.ws-layout:not(.ws-folder-layout) > .ws-document { margin-right: 300px; }
.ws-comments.ws-bubbles { position: absolute; inset: 0 0 auto auto; width: 300px; padding: 0; max-height: none; overflow: visible; border: 0; pointer-events: none; }
.ws-bubble-header, .ws-bubble-group, .ws-bubble-footer { position: absolute; left: 12px; right: 20px; min-width: 0; pointer-events: auto; }
.ws-bubble-header p { margin: 8px 0; line-height: 1.5; }
.ws-bubble-header > div { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ws-bubble-header .ws-comments-heading { margin: 0; flex: 1; }
.ws-bubble-header .ws-actions { margin: 0; }
.ws-bubble-header .ws-check { margin: 0; flex: 1; }
.ws-bubble-header .ws-discussion-draft { flex-basis: 100%; }
.ws-bubble-header .ws-linked-thread { flex-basis: 100%; font-size: 12px; }
.ws-linked-thread > summary { cursor: pointer; color: var(--ui-text-secondary); }
.ws-linked-thread[open] > summary { margin-bottom: 8px; }
.ws-status-announcement { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ws-search-diagnostic { margin-top: 16px; }
.ws-search-diagnostic pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.ws-bubble { border: 1px solid var(--ui-stroke-secondary); border-radius: var(--radius-md, 6px); background: var(--ui-bg-editor); margin-bottom: 10px; overflow-wrap: anywhere; }
.ws-bubble-emphasis:not(.ws-bubble-selected) { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
.ws-bubble-selected { border-color: var(--ui-accent); border-left: 3px solid var(--ui-accent); }
.ws-bubble-cluster { border: 1px solid var(--ui-stroke-secondary); border-radius: var(--radius-md, 6px); background: var(--ui-bg-editor); }
.ws-bubble-cluster:has(.ws-bubble-selected) { border-color: var(--ui-accent); border-left: 3px solid var(--ui-accent); }
.ws-cluster-heading { display: flex; align-items: center; gap: 8px; padding: 8px 12px 0; }
.ws-cluster-heading > .ws-bubble-context { flex: 0 0 auto; }
.ws-cluster-heading .ws-choice { flex: 1; min-width: 0; margin: 0; }
.ws-cluster-heading .ws-choice-trigger { border-color: transparent; background: transparent; }
.ws-cluster-context { height: 1.5em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ws-bubble-cluster-emphasis { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
.ws-bubble-cluster-emphasis .ws-bubble-emphasis { outline: none; }
.ws-bubble-cluster .ws-choice button { width: 100%; max-width: 100%; min-width: 0; }
.ws-bubble-cluster [data-slot="select-value"] { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.ws-bubble-cluster .ws-bubble { margin: 0; border: 0; background: transparent; }
.ws-root .ws-bubble-summary { display: flex; flex-direction: column; align-items: stretch; gap: 6px; white-space: normal; width: 100%; height: auto; padding: 12px; text-align: left; font-weight: 400; }
.ws-bubble-context { font-size: 11px; color: var(--ui-text-secondary); line-height: 1.4; }
.ws-bubble-preview { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.6; }
.ws-bubble .ws-comment { padding: 12px; border-top: 1px solid var(--ui-stroke-tertiary); margin: 0; border-left: 0; }
.ws-bubble .ws-comment-composer { padding: 12px; margin: 0; border: 0; }
.ws-bubble-footer > div > h2 { margin: 12px 0; }
.ws-comment-controls-slot { pointer-events: none; }
.ws-comment-options { width: 240px; max-width: calc(100vw - 16px); display: grid; gap: 12px; }
.ws-comment-options .ws-check { margin: 0; }
.ws-section-preview { display: grid; gap: 8px; }
.ws-section-fragment { max-height: min(22vh, 180px); overflow: auto; line-height: 1.6; padding: 4px 0; overflow-wrap: anywhere; }
.ws-section-fragment:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
@container hermes-workspace (max-width: 1200px) {
  .ws-layout:not(.ws-folder-layout) > .ws-document { margin-right: 268px; }
  .ws-comments.ws-bubbles { width: 268px; }
}
@container hermes-workspace (max-width: 980px) {
  .ws-layout { --ws-inline-comments: 1; --ws-comment-controls-gap: 12px; }
  .ws-document-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
    margin-bottom: 12px;
  }
  .ws-document-header > .ws-title-wrap { grid-column: 1 / -1; grid-row: 1; margin: 0; }
  .ws-document-header > .ws-page-kind { grid-column: 1; grid-row: 2; align-self: center; margin: 0; }
  .ws-document-header > .ws-page-actions { grid-column: 2; grid-row: 2; justify-self: end; margin: 0 -8px 0 0; }
  .ws-layout:not(.ws-folder-layout) > .ws-document { margin-right: 0; }
  .ws-comments.ws-bubbles { width: 100%; }
  .ws-bubble-header, .ws-bubble-group, .ws-bubble-footer { left: 28px; right: 28px; }
  .ws-bubble-group { margin-left: 12px; border-left: 1px solid var(--ui-stroke-secondary); padding-left: 12px; }
}
@container hermes-workspace (max-width: 600px) {
  .ws-layout { --ws-comment-controls-gap: 8px; }
  .ws-document { padding-top: 12px; }
  .ws-document-header { margin-bottom: 8px; }
  .ws-editor-heading { margin-bottom: 8px; }
  .ws-bubble-header, .ws-bubble-group, .ws-bubble-footer { left: 24px; right: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .ws-root *,
  .ws-menu * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
${workspaceNavigationStyles}
`;

// frontend/rich-editor.jsx
import { useEffect as useEffect3, useLayoutEffect as useLayoutEffect5, useRef as useRef7, useState as useState8 } from "react";
import { Popover as Popover2, PopoverTrigger as PopoverTrigger2, PopoverContent as PopoverContent2 } from "@hermes/plugin-sdk";

// frontend/editor-styles.mjs
var editorStyles = `
:is(.ws-editor, .ws-section-fragment) span[data-workspace-weight="normal"] { font-weight: 400; }
.ws-rich-editor .ws-editor-heading { margin: 0 0 10px; justify-content: flex-start; }
.ws-rich-editor .ws-format-toggle {
  border: 1px solid var(--ui-stroke-secondary);
  border-radius: var(--radius-sm, 4px);
  min-height: 32px;
  padding: 5px 10px;
  gap: 8px;
  color: var(--ui-text-primary);
}
.ws-rich-editor .ws-format-toggle[aria-expanded=true] { border-color: var(--ui-accent); }
.ws-rich-editor .ws-format-toolbar {
  display: block;
  padding: 6px;
  background: var(--ui-bg-editor, var(--ui-bg-primary));
  border: 1px solid var(--ui-stroke-secondary);
  border-radius: var(--radius-md, 6px);
  margin-bottom: 16px;
  min-width: 0;
}
.ws-rich-editor .ws-format-toolbar > fieldset { display: block; border: 0; padding: 0; margin: 0; min-width: 0; }
.ws-rich-editor .ws-format-row { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 0; }
.ws-rich-editor .ws-format-group { display: flex; align-items: center; gap: 2px; padding-inline: 5px; }
.ws-rich-editor .ws-format-group + .ws-format-group { border-left: 1px solid var(--ui-stroke-tertiary); }
.ws-rich-editor .ws-format-group:first-child { padding-left: 0; }
.ws-rich-editor .ws-format-toolbar .ws-choice { min-width: 0; width: 116px; margin: 0; }
.ws-rich-editor .ws-format-toolbar .ws-choice-trigger { min-width: 0; height: 32px; }
.ws-rich-editor .ws-format-toolbar .ws-format-tool { width: 32px; height: 32px; padding: 0; flex-shrink: 0; color: var(--ui-text-primary); }
.ws-rich-editor .ws-format-tool[aria-pressed=true] { box-shadow: inset 0 0 0 1px var(--ui-stroke-secondary); }
.ws-rich-editor .ws-format-tool-label { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ws-rich-editor .ws-format-underline-glyph::before { content: 'U'; text-decoration: underline; font-size: 14px; }
.ws-rich-editor .ws-format-insert { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; border-top: 1px solid var(--ui-stroke-tertiary); margin-top: 6px; padding-top: 6px; }
.ws-rich-editor .ws-format-insert > button { min-height: 30px; gap: 6px; color: var(--ui-text-primary); }
.ws-editor-selection-tools { max-width: min(26rem, var(--radix-popover-content-available-width, calc(100vw - 16px))); }
`;

// frontend/editor-commands.mjs
var BLOCKS = new Set(
  "P DIV H1 H2 H3 H4 H5 H6 UL OL LI BLOCKQUOTE PRE TABLE HR".split(" ")
);
var STYLES = /* @__PURE__ */ new Set(["p", "h1", "h2", "h3", "blockquote", "pre"]);
var selectionFor = (root) => root.ownerDocument.defaultView.getSelection();
function pathFor(root, node) {
  const path = [];
  while (node !== root && node?.parentNode) {
    path.unshift([...node.parentNode.childNodes].indexOf(node));
    node = node.parentNode;
  }
  return node === root ? path : null;
}
function selectionBookmark(root) {
  const selected = selectionFor(root);
  if (!selected?.rangeCount) return null;
  const range = selected.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer))
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
    backward: !range.collapsed && selected.anchorNode === range.endContainer && selected.anchorOffset === range.endOffset
  };
}
function restoreBookmark(root, bookmark, textOnly = false) {
  if (!bookmark) return;
  const doc = root.ownerDocument, range = doc.createRange();
  const locate = (path) => path?.reduce((node, index) => node?.childNodes[index], root);
  const textPoint = (offset, preferNext) => {
    const walker = doc.createTreeWalker(root, 4);
    let node, last;
    while (node = walker.nextNode()) {
      last = node;
      if (offset < node.length || offset === node.length && !preferNext)
        return [node, offset];
      offset -= node.length;
    }
    if (last) return [last, last.length];
    let leaf = root;
    while (leaf.firstChild?.nodeType === 1 && !["BR", "IMG", "INPUT", "HR"].includes(leaf.firstChild.tagName))
      leaf = leaf.firstChild;
    return [leaf, 0];
  };
  let start = !textOnly && locate(bookmark.start), end = !textOnly && locate(bookmark.end);
  const [sn, so] = start ? [
    start,
    Math.min(
      bookmark.startOffset,
      start.nodeType === 3 ? start.length : start.childNodes.length
    )
  ] : textPoint(bookmark.textStart, bookmark.startOffset === 0);
  const [en, eo] = end ? [
    end,
    Math.min(
      bookmark.endOffset,
      end.nodeType === 3 ? end.length : end.childNodes.length
    )
  ] : textPoint(bookmark.textEnd, bookmark.endOffset === 0);
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
    backward: !range.collapsed && selected.anchorNode === range.endContainer && selected.anchorOffset === range.endOffset
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
      refs.start.nodeType === 3 ? refs.start.length : refs.start.childNodes.length
    )
  );
  range.setEnd(
    refs.end,
    Math.min(
      refs.endOffset,
      refs.end.nodeType === 3 ? refs.end.length : refs.end.childNodes.length
    )
  );
  const selected = selectionFor(root);
  selected.removeAllRanges();
  selected.addRange(range);
  if (refs.backward && selected.setBaseAndExtent)
    selected.setBaseAndExtent(range.endContainer, range.endOffset, range.startContainer, range.startOffset);
  return true;
}
function normalizeBlocks(root) {
  const doc = root.ownerDocument;
  for (const node of [
    ...root.querySelectorAll("p,h1,h2,h3,h4,h5,h6,pre")
  ].reverse()) {
    if (![...node.children].some((child) => BLOCKS.has(child.tagName)))
      continue;
    const fragment = doc.createDocumentFragment();
    let inline2 = node.cloneNode(false);
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1 && BLOCKS.has(child.tagName)) {
        if (inline2.childNodes.length) fragment.append(inline2);
        fragment.append(child);
        inline2 = node.cloneNode(false);
      } else inline2.append(child);
    }
    if (inline2.childNodes.length) fragment.append(inline2);
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
  const selected = selectionFor(root), range = selected?.rangeCount ? selected.getRangeAt(0) : null;
  const element = (node) => node?.nodeType === 3 ? node.parentElement : node;
  const cell = element(range?.startContainer)?.closest?.("td,th");
  return cell && root.contains(cell) && cell.contains(range.endContainer) ? cell : root;
}
function selectedBlocks(root, region) {
  const selection = selectionFor(root);
  if (!selection?.rangeCount) return [];
  const range = selection.getRangeAt(0), doc = root.ownerDocument;
  const touches = (nodes) => {
    if (range.collapsed) {
      const point = range.startContainer.nodeType === 1 ? range.startContainer.childNodes[Math.min(
        range.startOffset,
        range.startContainer.childNodes.length - 1
      )] : range.startContainer;
      return nodes.some((node) => node === point || node.contains?.(point));
    }
    const probe = doc.createRange();
    probe.setStartBefore(nodes[0]);
    probe.setEndAfter(nodes.at(-1));
    const start = range.cloneRange(), end = range.cloneRange();
    start.collapse(true);
    end.collapse(false);
    const ps = probe.cloneRange(), pe = probe.cloneRange();
    ps.collapse(true);
    pe.collapse(false);
    return start.compareBoundaryPoints(0, pe) < 0 && end.compareBoundaryPoints(0, ps) > 0;
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
    const node = region.childNodes[Math.min(range.startOffset, region.childNodes.length - 1)];
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
  const before = parent.cloneNode(false), after = parent.cloneNode(false);
  while (parent.firstChild !== branch) before.append(parent.firstChild);
  while (branch.nextSibling) after.append(branch.nextSibling);
  if (before.childNodes.length) parent.before(before);
  if (after.childNodes.length) parent.after(after);
}
function removeSelectedQuotes(block, root) {
  let quote;
  while ((quote = block.parentElement?.closest("blockquote")) && root.contains(quote)) {
    const branch = isolateBranch(block, quote);
    quote.replaceWith(branch);
  }
  return block;
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
function formatBlocks(root, tag) {
  if (!STYLES.has(tag)) return false;
  const bookmark = selectionBookmark(root), refs = selectionReferences(root);
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
function toggleList(root, tag) {
  if (!["ul", "ol"].includes(tag)) return false;
  const bookmark = selectionBookmark(root), refs = selectionReferences(root);
  normalizeBlocks(root);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  const region = regionFor(root);
  normalizeBlocks(region);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  const blocks = selectedBlocks(root, region).map(
    (block) => removeSelectedQuotes(block, root)
  ), doc = root.ownerDocument;
  for (const block of blocks) {
    if (block.tagName === "TABLE" || block.tagName === "HR") continue;
    const li = block.parentElement?.closest("li");
    if (li && root.contains(li) && ["UL", "OL"].includes(li.parentElement?.tagName)) {
      const branch = isolateBranch(block, li);
      const list = li.parentElement;
      splitAround(li, list);
      if (list.tagName.toLowerCase() === tag) {
        list.replaceWith(branch);
      } else {
        const replacement = doc.createElement(tag), item = doc.createElement("li");
        item.append(branch);
        replacement.append(item);
        list.replaceWith(replacement);
      }
    } else {
      const list = doc.createElement(tag), item = doc.createElement("li");
      block.before(list);
      item.append(...block.childNodes);
      list.append(item);
      block.remove();
    }
  }
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
function insertBlockHTML(root, html) {
  const bookmark = selectionBookmark(root), refs = selectionReferences(root);
  normalizeBlocks(root);
  if (!restoreReferences(root, refs)) restoreBookmark(root, bookmark, true);
  const region = regionFor(root), doc = root.ownerDocument;
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
  const firstCell = nodes.flatMap(
    (node) => node.nodeType === 1 ? [...node.querySelectorAll("td,th")] : []
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
function pasteBlockHTML(root, html) {
  const doc = root.ownerDocument, selection = selectionFor(root);
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer))
    return false;
  const element = (node) => node.nodeType === 3 ? node.parentElement : node;
  const startCell = element(range.startContainer).closest?.("td,th");
  const endCell = element(range.endContainer).closest?.("td,th");
  const cell = startCell === endCell ? startCell : null;
  const template = doc.createElement("template");
  template.innerHTML = sanitizeHTML(html, doc);
  const nodes = [...template.content.childNodes];
  if (!nodes.length) return false;
  range.deleteContents();
  const marker = doc.createElement("span");
  range.insertNode(marker);
  let boundary = marker.parentElement;
  while (boundary !== root && boundary !== cell && !BLOCKS.has(boundary.tagName))
    boundary = boundary.parentElement;
  if (boundary === root || boundary === cell || ["LI", "BLOCKQUOTE", "DIV"].includes(boundary.tagName)) {
    marker.replaceWith(...nodes);
  } else {
    const tailRange = doc.createRange();
    tailRange.setStartAfter(marker);
    tailRange.setEnd(boundary, boundary.childNodes.length);
    const tail = boundary.cloneNode(false);
    tail.append(tailRange.extractContents());
    marker.remove();
    boundary.after(...nodes, ...tail.childNodes.length ? [tail] : []);
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
var EditorHistory = class {
  constructor() {
    this.entries = [];
    this.index = -1;
  }
  capture(root) {
    const bookmark = selectionBookmark(root), refs = selectionReferences(root);
    const parents = /* @__PURE__ */ new Set();
    for (const gap of root.querySelectorAll("[data-workspace-comment-gap]")) {
      parents.add(gap.parentNode);
      gap.remove();
    }
    for (const parent of parents) parent.normalize();
    if (parents.size && (parents.has(refs?.start) || parents.has(refs?.end) || !restoreReferences(root, refs)))
      restoreBookmark(root, bookmark, true);
    return { html: editorHTML(root), selection: selectionBookmark(root) };
  }
  reset(root) {
    this.entries = [this.capture(root)];
    this.index = 0;
  }
  record(root) {
    const next = this.capture(root), current = this.entries[this.index];
    if (current?.html === next.html) {
      current.selection = next.selection;
      return;
    }
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(next);
    this.index++;
    let bytes = this.entries.reduce(
      (size, entry) => size + entry.html.length * 2,
      0
    );
    while (this.entries.length > 1 && (this.entries.length > 100 || bytes > 16 * 1024 * 1024)) {
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
};

// frontend/comment-highlights.jsx
import { useId as useId2, useLayoutEffect as useLayoutEffect4, useRef as useRef6, useState as useState7 } from "react";
function numberComments(comments) {
  return comments.map((comment, index) => ({
    ...comment,
    passageNumber: Number.isSafeInteger(comment.passageNumber) && comment.passageNumber > 0 ? comment.passageNumber : index + 1
  }));
}
function anchorRange(root, anchor) {
  const location = locateAnchor(root.textContent, anchor);
  if (location.status !== "attached") return null;
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  let node, offset = 0, start = null, end = null;
  while (node = walker.nextNode()) {
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
function CommentHighlights({
  editorRef,
  comments,
  active,
  pendingAnchor,
  onComment,
  hovered = null,
  onHover = () => {
  },
  onGeometry = () => {
  }
}) {
  const callbacks = useRef6({ onHover, onGeometry });
  callbacks.current = { onHover, onGeometry };
  const token = "ws-passage-" + useId2().replace(/[^a-z0-9]/gi, "");
  const [groups, setGroups] = useState7([]), [openGroup, setOpenGroup] = useState7(null);
  const selectedDiscussion = useRef6(false);
  const signature = JSON.stringify(
    comments.map((c) => [c.id, c.anchor, c.resolved, c.passageNumber, c.text])
  );
  useLayoutEffect4(() => {
    const root = editorRef.current;
    if (!root) return;
    const view = root.ownerDocument.defaultView;
    const raf = view.requestAnimationFrame?.bind(view) ?? ((fn) => view.setTimeout(fn, 0));
    const caf = view.cancelAnimationFrame?.bind(view) ?? view.clearTimeout.bind(view);
    let frame = null;
    let current = [], currentGroups = [];
    const registry = globalThis.CSS?.highlights;
    const paint = () => {
      const base = root.parentElement.getBoundingClientRect();
      const layoutRoot = root.closest(".ws-layout") ?? root.parentElement;
      const layout = layoutRoot.getBoundingClientRect(), scale = elementScale(layoutRoot);
      current = numberComments(comments).filter((c) => c.anchor).map((c) => ({
        comment: c,
        number: c.passageNumber,
        range: anchorRange(root, c.anchor)
      })).filter((c) => c.range);
      if (registry && globalThis.Highlight) {
        const selection = root.ownerDocument.getSelection();
        const decoratedSelection = root.querySelector("[data-workspace-comment-gap]") && selection?.rangeCount && !selection.isCollapsed && root.contains(selection.anchorNode) && root.contains(selection.focusNode);
        root.classList.toggle("ws-text-selection", Boolean(decoratedSelection));
        const selected = new Highlight(...decoratedSelection ? [selection.getRangeAt(0).cloneRange()] : []);
        selected.priority = 10;
        registry.set(token + "-selection", selected);
        registry.set(token, new Highlight(...current.map((c) => c.range)));
        registry.set(
          token + "-hover",
          new Highlight(...current.filter((c) => c.comment.id === hovered).map((c) => c.range))
        );
        registry.set(
          token + "-active",
          new Highlight(
            ...current.filter((c) => c.comment.id === active).map((c) => c.range)
          )
        );
        const draft = pendingAnchor && anchorRange(root, pendingAnchor);
        registry.set(
          token + "-draft",
          new Highlight(...draft ? [draft] : [])
        );
      }
      const rows = current.map(({ comment, range, number }) => {
        const rect = range.getClientRects?.()[0];
        return rect && {
          id: comment.id,
          quote: comment.anchor.quote,
          text: comment.text,
          top: (rect.top - base.top) / scale,
          index: number
        };
      }).filter(Boolean);
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
        return {
          id: comment.id,
          number,
          anchor: comment.anchor,
          top: (rect.top - layout.top) / scale,
          bottom: (rect.bottom - layout.top) / scale,
          block,
          slotBlock: block.closest("table") ?? block,
          lineGroup: currentGroups.find((group) => group.markers.some((marker) => marker.id === comment.id))?.id ?? comment.id,
          blockBottom: (bounds.bottom - layout.top) / scale
        };
      }).filter(Boolean);
      if (pendingAnchor) {
        const draft = anchorRange(root, pendingAnchor), rect = draft?.getClientRects?.()[0];
        if (rect) {
          const end = draft.endContainer.nodeType === 1 ? draft.endContainer : draft.endContainer.parentElement;
          const block = end?.closest("p,li,h1,h2,h3,h4,blockquote,pre,td,th") ?? root;
          geometry.push({
            id: "__workspace-comment-draft",
            anchor: pendingAnchor,
            top: (rect.top - layout.top) / scale,
            bottom: (rect.bottom - layout.top) / scale,
            block,
            slotBlock: block.closest("table") ?? block,
            lineGroup: currentGroups.find((group) => Math.abs(group.top - (rect.top - base.top) / scale) < 24)?.id ?? "__workspace-comment-draft",
            blockBottom: (block.getBoundingClientRect().bottom - layout.top) / scale
          });
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
      subtree: true
    });
    const resize = globalThis.ResizeObserver ? new ResizeObserver(schedule) : null;
    resize?.observe(root);
    if (root.closest(".ws-document")) resize?.observe(root.closest(".ws-document"));
    window.addEventListener("resize", schedule);
    root.ownerDocument.addEventListener("selectionchange", schedule);
    root.addEventListener("load", schedule, true);
    const hit = (event) => current.filter(
      ({ range }) => [...range.getClientRects?.() ?? []].some(
        (r) => event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom
      )
    );
    const click = (event) => {
      if (!getSelection()?.isCollapsed || event.target.closest?.("a,input"))
        return;
      const match = hit(event);
      if (match.length === 1) onComment(match[0].comment.id);
      else if (match.length > 1)
        setOpenGroup(
          currentGroups.find(
            (g) => g.markers.some((m) => m.id === match[0].comment.id)
          )?.id ?? null
        );
    };
    const hover = (event) => {
      const match = event.type === "pointerleave" ? null : hit(event)[0];
      callbacks.current.onHover(match?.comment.id ?? null);
      root.style.cursor = match ? "pointer" : "";
      if (registry && globalThis.Highlight)
        registry.set(
          token + "-hover",
          new Highlight(...match ? [match.range] : [])
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
      `::highlight(${token}){background:color-mix(in srgb,var(--ui-accent) 19%,transparent);text-decoration:underline;text-decoration-color:var(--ui-accent)}::highlight(${token}-active),::highlight(${token}-hover),::highlight(${token}-draft){background:color-mix(in srgb,var(--ui-accent) 35%,transparent);text-decoration:underline double;text-decoration-color:var(--ui-accent);text-decoration-thickness:2px}::highlight(${token}-selection){background:var(--ui-selection-background);color:inherit}.ws-editor.ws-text-selection::selection,.ws-editor.ws-text-selection *::selection{background:transparent;color:inherit}`
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
        onBlur: () => callbacks.current.onHover(null)
      };
      if (group.markers.length === 1)
        return h(
          Action,
          {
            key: group.id,
            variant: "ghost",
            ...triggerProps,
            "aria-label": `Open comment ${marker.index}: ${marker.quote}`,
            onClick: () => onComment(marker.id)
          },
          String(marker.index)
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
          }
        },
        group.markers.map(
          (m) => h(
            Action,
            {
              key: m.id,
              onFocus: () => callbacks.current.onHover(m.id),
              onClick: () => {
                selectedDiscussion.current = true;
                onComment(m.id);
              }
            },
            `Comment ${m.index}: ${m.quote.slice(0, 48)} \u2014 ${m.text.slice(0, 72)}${active === m.id ? " (active)" : ""}`
          )
        )
      );
    })
  );
}

// frontend/rich-editor.jsx
function RichEditor({
  item,
  locked: authorityLocked,
  interactionBlocked = false,
  onSave,
  onAnchor,
  onText,
  registerFlush,
  registerPendingFiles = () => {
  },
  onError,
  onLink,
  attachments = [],
  workspaceItems = [],
  onImage,
  draftBuffer = null,
  comments = [],
  activeComment = null,
  hoveredComment = null,
  onCommentHover = () => {
  },
  onCommentGeometry = () => {
  },
  pendingAnchor = null,
  onComment = () => {
  },
  registerFocus = () => {
  }
}) {
  const locked = authorityLocked || interactionBlocked;
  const root = useRef7(null), timer = useRef7(null), draft = useRef7(null), saving = useRef7(Promise.resolve()), latest = useRef7({ item, locked, onSave, onText, onError });
  latest.current = {
    item,
    locked: authorityLocked,
    interactionBlocked,
    onSave,
    onText,
    onError
  };
  const mounted = useRef7(true), retained = useRef7(null);
  const pendingSave = useRef7(0), editRevision = useRef7(0);
  const uploading = useRef7(null), [imageBusy, setImageBusy] = useState8(false);
  const history = useRef7(new EditorHistory());
  const [recovery, setRecovery] = useState8(() => draftBuffer?.read() ?? null);
  const [blockStyle, setBlockStyle] = useState8("p");
  const [formats, setFormats] = useState8({});
  const recoveryRef = useRef7(recovery);
  recoveryRef.current = recovery;
  const [status, setStatus] = useState8("Saved"), [saveError, setSaveError] = useState8(""), [dialog, setDialog] = useState8(null), [selection, setSelection] = useState8(null), [floating, setFloating] = useState8(null), [formatting, setFormatting] = useState8(false);
  const suppressedSelection = useRef7(null);
  const selectionToolbar = useRef7(null), stylePickerOpen = useRef7(false), dialogRef = useRef7(null);
  dialogRef.current = dialog;
  const composing = useRef7(false);
  const range = useRef7(null), image = useRef7(null);
  const decorate = () => {
    hydrateImages(root.current, attachments);
    hydrateChecklists(
      root.current,
      latest.current.locked || latest.current.interactionBlocked || Boolean(recoveryRef.current)
    );
  };
  const flushContent = () => {
    clearTimeout(timer.current);
    if (draft.current === null) return saving.current;
    if (recoveryRef.current)
      return Promise.reject(
        new Error("Recover or discard the retained draft before continuing.")
      );
    const html = draft.current, revision = editRevision.current;
    const savedToken = retained.current?.token;
    const save = latest.current.onSave;
    draft.current = null;
    pendingSave.current++;
    setStatus("Saving\u2026");
    setSaveError("");
    const promise = saving.current.catch(() => {
    }).then(async () => {
      if (latest.current.locked)
        throw new Error(
          "This page is read-only while Hermes is working. Your unsaved text remains in the editor."
        );
      await save(html);
    }).then(
      () => {
        if (savedToken) draftBuffer?.acknowledge(savedToken);
        if (mounted.current && revision === editRevision.current && draft.current === null)
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
          () => root.current?.focus()
        );
      }
    );
    const settled = promise.finally(() => {
      pendingSave.current--;
    });
    saving.current = settled;
    settled.catch(() => {
    });
    return settled;
  };
  const flush = async () => {
    if (uploading.current) await uploading.current;
    return flushContent();
  };
  useEffect3(() => registerFlush(flush), [registerFlush, recovery]);
  useEffect3(
    () => registerPendingFiles(() => uploading.current ?? Promise.resolve()),
    [registerPendingFiles]
  );
  useEffect3(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  useLayoutEffect5(() => {
    if (!root.current) return;
    const clean = sanitizeHTML(item.content);
    if (draft.current === null && pendingSave.current === 0 && editorHTML(root.current) !== clean) {
      root.current.innerHTML = clean;
      history.current.reset(root.current);
    }
    decorate();
    if (history.current.index < 0) history.current.reset(root.current);
    onText(root.current.textContent);
  }, [item.content, locked, attachments, recovery]);
  const changed = (_event, recordHistory = true) => {
    if (latest.current.locked || latest.current.interactionBlocked || recoveryRef.current)
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
      650
    );
  };
  const remember = () => {
    if (!root.current) return;
    const selected = getSelection();
    if (selected?.rangeCount && root.current.contains(selected.anchorNode) && root.current.contains(selected.focusNode)) {
      range.current = selected.getRangeAt(0).cloneRange();
      setFormats(
        Object.fromEntries(
          [
            "bold",
            "italic",
            "underline",
            "insertUnorderedList",
            "insertOrderedList"
          ].map((command2) => {
            let pressed = false;
            try {
              pressed = Boolean(document.queryCommandState?.(command2));
            } catch {
            }
            return [command2, pressed];
          })
        )
      );
      const captured = captureAnchor(root.current);
      setSelection(
        selected.isCollapsed || JSON.stringify(captured) === suppressedSelection.current ? null : captured ?? {
          quote: selected.toString(),
          unavailableAnchor: true
        }
      );
      let node = selected.anchorNode.nodeType === 3 ? selected.anchorNode.parentElement : selected.anchorNode;
      const block = node?.closest?.("pre,blockquote") ?? node?.closest?.("p,h1,h2,h3");
      setBlockStyle(
        block && root.current.contains(block) ? block.localName : "p"
      );
      const rect = range.current.getBoundingClientRect?.();
      if (rect) {
        const scale = elementScale(root.current.ownerDocument.documentElement);
        const pane = root.current.closest(".ws-work")?.getBoundingClientRect();
        const top = Math.max(8, pane?.top ?? 0), bottom = Math.min(
          window.innerHeight,
          pane?.bottom ?? window.innerHeight
        );
        setFloating(
          rect.bottom < top || rect.top > bottom ? null : {
            left: rect.left / scale,
            top: rect.top / scale,
            width: Math.max(1, rect.width / scale),
            height: Math.max(1, rect.height / scale)
          }
        );
      }
    } else if (!(selectionToolbar.current?.contains(document.activeElement) || stylePickerOpen.current || dialogRef.current)) {
      setSelection(null);
      setFloating(null);
    }
  };
  useEffect3(() => {
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
    if (range.current && root.current.contains(range.current.commonAncestorContainer)) {
      const selected = getSelection();
      selected.removeAllRanges();
      selected.addRange(range.current);
    }
  };
  useEffect3(() => {
    registerFocus((anchor) => {
      const passage = anchor && anchorRange(root.current, anchor);
      if (!passage) {
        restoreSelection(true);
        return;
      }
      range.current = passage;
      setSelection(null);
      setFloating(null);
      restoreSelection(true);
      suppressedSelection.current = JSON.stringify(captureAnchor(root.current));
      const pane = root.current.closest(".ws-work"), rect = passage.getBoundingClientRect?.();
      if (pane && rect) {
        const bounds = pane.getBoundingClientRect(), scale = elementScale(pane);
        const banner = pane.querySelector(".ws-run-banner")?.getBoundingClientRect();
        const top = Math.max(
          0,
          bounds.top,
          banner && banner.top <= bounds.top + 1 ? banner.bottom : 0
        ) + 12 * scale;
        const bottom = Math.min(window.innerHeight, bounds.bottom) - 12 * scale;
        const delta = rect.top < top || rect.height > bottom - top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0;
        if (delta) pane.scrollTop += delta / scale;
      }
    });
    return () => registerFocus(null);
  }, []);
  const beginComment = () => {
    if (latest.current.locked || latest.current.interactionBlocked || recoveryRef.current)
      return;
    const selected = getSelection();
    if (selected?.rangeCount && root.current.contains(selected.anchorNode) && root.current.contains(selected.focusNode))
      range.current = selected.getRangeAt(0).cloneRange();
    restoreSelection(true);
    const currentSelection = captureAnchor(root.current);
    if (currentSelection && !latest.current.locked && !latest.current.interactionBlocked && !recoveryRef.current) {
      range.current = getSelection().getRangeAt(0).cloneRange();
      suppressedSelection.current = JSON.stringify(currentSelection);
      onAnchor(currentSelection);
      setSelection(null);
    }
  };
  const command = (name, value) => {
    if (latest.current.locked || latest.current.interactionBlocked || recoveryRef.current)
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
        name === "insertUnorderedList" ? "ul" : "ol"
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
    const safe = sanitizeHTML(html), probe = document.createElement("template");
    probe.innerHTML = safe;
    const block = [...probe.content.children].some(
      (node) => /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE|HR)$/.test(node.tagName)
    );
    command(
      block ? paste ? "pasteBlockHTML" : "insertBlockHTML" : "insertHTML",
      safe
    );
  };
  const copyWithoutLayout = (event, cut = false) => {
    const selected = getSelection();
    if (!event.clipboardData || !selected?.rangeCount) return;
    const actual = selected.getRangeAt(0);
    if (!root.current.contains(actual.startContainer) || !root.current.contains(actual.endContainer))
      return;
    const fragment = actual.cloneContents();
    if (!fragment.querySelector("[data-workspace-comment-gap]")) return;
    const copy = root.current.ownerDocument.createElement("div");
    copy.append(fragment);
    event.preventDefault();
    event.clipboardData.setData("text/plain", selected.toString());
    event.clipboardData.setData(
      "text/html",
      editorHTML(copy, { attachmentReferences: false })
    );
    if (cut && !locked && !recoveryRef.current) {
      range.current = actual.cloneRange();
      command("delete");
    }
  };
  const tool = (label, cmd, icon) => h(
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
        "insertOrderedList"
      ].includes(cmd) ? Boolean(formats[cmd]) : void 0,
      disabled: locked,
      onMouseDown: (e) => e.preventDefault(),
      onClick: () => command(cmd)
    },
    icon === "underline" ? h("span", {
      className: "ws-format-underline-glyph",
      "aria-hidden": true
    }) : h(Codicon, { name: icon, "aria-hidden": true }),
    h("span", { className: "ws-format-tool-label" }, label)
  );
  const selectionScale = floating ? elementScale(root.current?.ownerDocument.documentElement) : 1;
  const selectionBoundary = root.current?.closest(".ws-work");
  let selectionPadding = 8;
  if (floating && selectionScale !== 1) {
    const rect = selectionBoundary?.getBoundingClientRect();
    const left = Math.max(0, rect?.left ?? 0), top = Math.max(0, rect?.top ?? 0);
    const right = Math.min(
      window.innerWidth,
      rect ? rect.left + selectionBoundary.clientWidth * selectionScale : window.innerWidth
    );
    const bottom = Math.min(
      window.innerHeight,
      rect ? rect.top + selectionBoundary.clientHeight * selectionScale : window.innerHeight
    );
    selectionPadding = {
      left: left / selectionScale - left + 8,
      top: top / selectionScale - top + 8,
      right: right - right / selectionScale + 8,
      bottom: bottom - bottom / selectionScale + 8
    };
  }
  return h(
    "section",
    { className: "ws-rich-editor", "aria-label": "Visual editor" },
    h("style", null, editorStyles),
    recovery && h(
      "div",
      { className: "ws-banner", role: "status" },
      h(
        "span",
        null,
        "Recoverable draft retained for this source. Recovering replaces the editor text and autosaves it. ",
        recovery.base_html !== item.content ? "The saved page has also changed; review before recovering." : ""
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
              retained.current = draftBuffer?.put(draft.current, item.content) ?? null;
            } catch (error) {
              onError(error);
            }
            onText(root.current.textContent);
            setStatus("Unsaved recovered draft");
            clearTimeout(timer.current);
            timer.current = setTimeout(
              () => void flush().catch(onError),
              650
            );
          }
        },
        "Recover draft"
      ),
      h(
        Action,
        {
          onClick: () => {
            draftBuffer?.discard();
            setRecovery(null);
          }
        },
        "Discard retained draft"
      )
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
          onClick: () => setFormatting((v) => !v)
        },
        h(Codicon, { name: "text-size", "aria-hidden": true }),
        "Format text",
        h(Codicon, {
          name: formatting ? "chevron-up" : "chevron-down",
          "aria-hidden": true
        })
      )
    ),
    h(
      "div",
      {
        id: `ws-format-${item.id}`,
        hidden: !formatting,
        className: "ws-toolbar ws-format-toolbar",
        role: "toolbar",
        "aria-label": "Formatting"
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
              "aria-label": "Text style"
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
                ["pre", "Code block"]
              ],
              onChange: (value) => command("formatBlock", value)
            })
          ),
          h(
            "div",
            {
              className: "ws-format-group",
              role: "group",
              "aria-label": "Text emphasis"
            },
            [
              ["Bold", "bold", "bold"],
              ["Italic", "italic", "italic"],
              ["Underline", "underline", "underline"]
            ].map(([label, cmd, icon]) => tool(label, cmd, icon))
          ),
          h(
            "div",
            {
              className: "ws-format-group",
              role: "group",
              "aria-label": "Lists"
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
                onClick: () => insert('<p><input type="checkbox"> Task</p>')
              },
              h(Codicon, { name: "checklist", "aria-hidden": true }),
              h("span", { className: "ws-format-tool-label" }, "Checklist")
            )
          ),
          h(
            "div",
            {
              className: "ws-format-group ws-format-history",
              role: "group",
              "aria-label": "Edit history"
            },
            tool("Undo", "undo", "discard"),
            tool("Redo", "redo", "redo")
          )
        ),
        h(
          "div",
          {
            className: "ws-format-insert",
            role: "group",
            "aria-label": "Insert"
          },
          h(
            Action,
            {
              variant: "ghost",
              disabled: locked,
              onClick: () => setDialog("link")
            },
            h(Codicon, { name: "link", "aria-hidden": true }),
            "Link"
          ),
          h(
            Action,
            {
              variant: "ghost",
              disabled: locked,
              onClick: () => setDialog("table")
            },
            h(Codicon, { name: "table", "aria-hidden": true }),
            "Table"
          ),
          h(
            Action,
            {
              variant: "ghost",
              disabled: locked || imageBusy,
              onClick: () => image.current.click()
            },
            h(Codicon, { name: "file-media", "aria-hidden": true }),
            "Image"
          ),
          h(
            Action,
            {
              variant: "ghost",
              disabled: locked,
              onClick: () => setDialog("database")
            },
            h(Codicon, { name: "references", "aria-hidden": true }),
            "Workspace link"
          )
        )
      )
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
        "data-placeholder": "Start writing\u2026",
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
          if (event.defaultPrevented || native.defaultPrevented || composing.current || event.isComposing || native.isComposing || native.keyCode === 229)
            return;
          if (event.ctrlKey && !event.metaKey && event.altKey && !event.shiftKey && event.key.toLowerCase() === "b") {
            if (!locked && !recoveryRef.current && event.target === root.current) {
              event.preventDefault();
              command("bold");
            }
            return;
          }
          if (event.key === "Tab" && !event.shiftKey && selectionToolbar.current && getSelection()?.toString()) {
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
          if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "m") {
            event.preventDefault();
            beginComment();
            return;
          }
          if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && ["i", "u"].includes(event.key.toLowerCase())) {
            event.preventDefault();
            command(event.key.toLowerCase() === "i" ? "italic" : "underline");
            return;
          }
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            command(event.shiftKey ? "redo" : "undo");
          } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
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
            html || escapeHTML(text).replace(/\n/g, "<br>")
          );
          for (const image2 of pasted.querySelectorAll("img")) image2.remove();
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
        }
      }),
      h(CommentHighlights, {
        editorRef: root,
        comments,
        active: activeComment,
        pendingAnchor,
        onComment,
        hovered: hoveredComment,
        onHover: onCommentHover,
        onGeometry: onCommentGeometry
      })
    ),
    selection && floating && !pendingAnchor && !locked && !recovery && !dialog && h(
      Popover2,
      {
        open: true,
        modal: false,
        onOpenChange: (open) => {
          if (!open) setSelection(null);
        }
      },
      h(
        PopoverTrigger2,
        { asChild: true },
        h("span", {
          "aria-hidden": true,
          tabIndex: -1,
          className: "ws-selection-anchor",
          style: { position: "fixed", zoom: 1 / selectionScale, ...floating }
        })
      ),
      h(
        PopoverContent2,
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
            if (root.current?.contains(event.target) || stylePickerOpen.current)
              event.preventDefault();
          },
          onEscapeKeyDown: (event) => {
            event.preventDefault();
            if (stylePickerOpen.current) return;
            suppressedSelection.current = JSON.stringify(selection);
            setSelection(null);
            restoreSelection();
          }
        },
        h(Choice, {
          label: "Text style",
          showLabel: false,
          value: ["p", "h1", "h2", "h3"].includes(blockStyle) ? blockStyle : "p",
          options: [
            ["p", "Text"],
            ["h1", "Heading 1"],
            ["h2", "Heading 2"],
            ["h3", "Heading 3"]
          ],
          onOpenChange: (open) => {
            stylePickerOpen.current = open;
          },
          onCloseAutoFocus: (event) => {
            event.preventDefault();
            restoreSelection(true);
          },
          onChange: (value) => command("formatBlock", value)
        }),
        ...[
          ["Bold", "bold", "B"],
          ["Italic", "italic", "I"],
          ["Underline", "underline", "U"]
        ].map(
          ([label, cmd, glyph]) => h(
            Action,
            {
              key: cmd,
              variant: formats[cmd] ? "secondary" : "ghost",
              size: "icon-sm",
              "aria-label": label,
              "aria-pressed": Boolean(formats[cmd]),
              title: label,
              onMouseDown: (event) => event.preventDefault(),
              onClick: () => command(cmd)
            },
            h(
              "span",
              { className: `ws-format-${cmd}`, "aria-hidden": true },
              glyph
            )
          )
        ),
        h(
          Action,
          {
            variant: "ghost",
            onMouseDown: (event) => event.preventDefault(),
            onClick: () => setDialog("link")
          },
          "Link"
        ),
        h(
          Action,
          {
            variant: "ghost",
            disabled: selection.unavailableAnchor,
            "aria-label": "Add comment on selection",
            title: selection.unavailableAnchor ? "Select a distinct passage to attach a comment." : "Comment on selected text",
            onMouseDown: (event) => event.preventDefault(),
            onClick: beginComment
          },
          "Comment"
        )
      )
    ),
    h(
      "div",
      { className: "ws-save", role: "status", "aria-live": "polite" },
      locked ? "Read-only during this run" : {
        Saved: "Content saved",
        "Saving\u2026": "Saving content\u2026",
        "Not saved": "Content not saved",
        "Unsaved changes": "Unsaved content",
        "Unsaved recovered draft": "Unsaved recovered content"
      }[status] ?? status,
      status === "Not saved" && h(
        Action,
        {
          disabled: locked || Boolean(recovery),
          onClick: (event) => {
            const opener = event.currentTarget;
            void flush().then(() => {
              if (document.activeElement === document.body || document.activeElement === opener)
                root.current?.focus();
            }).catch(onError);
          }
        },
        "Retry save"
      )
    ),
    imageBusy && h(
      "p",
      { role: "status", className: "ws-muted" },
      "Adding image\u2026 Leaving this page waits for the image and its saved content."
    ),
    saveError && h("p", { className: "ws-save-error", role: "alert" }, saveError),
    h("input", {
      ref: image,
      type: "file",
      accept: "image/png,image/jpeg,image/gif,image/webp",
      hidden: true,
      onChange: async (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        if (!file || uploading.current || locked) return;
        const savedRange = range.current?.cloneRange(), owner = root.current, initiatingControl = document.activeElement;
        setImageBusy(true);
        const job = Promise.resolve().then(async () => {
          if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type))
            throw new Error("Choose a PNG, JPEG, GIF or WebP image.");
          const attachment = await onImage(file);
          if (!mounted.current || root.current !== owner || latest.current.item.id !== item.id)
            throw new Error(
              "The image attachment was retained, but this editor changed before insertion. Reopen the page to use its attachment."
            );
          if (savedRange && !owner.contains(savedRange.commonAncestorContainer))
            throw new Error(
              "The image attachment was retained. Its insertion point changed; select a new location and try again."
            );
          range.current = savedRange ?? null;
          const focused = document.activeElement, pane = owner.closest(".ws-work");
          const scroll = pane && [pane.scrollLeft, pane.scrollTop];
          try {
            insert(
              `<img src="attachment:${escapeHTML(attachment.id)}" alt="${escapeHTML(file.name)}">`
            );
          } finally {
            if (focused?.isConnected && focused !== document.body && focused !== owner && focused !== initiatingControl) {
              focused.focus({ preventScroll: true });
              if (pane && scroll) {
                pane.scrollLeft = scroll[0];
                pane.scrollTop = scroll[1];
              }
            }
          }
        }).finally(() => {
          uploading.current = null;
          if (mounted.current) setImageBusy(false);
        });
        uploading.current = job;
        void job.catch(onError);
      }
    }),
    dialog && h(FormDialog, {
      confirm: dialog === "table" ? "Insert table" : "Insert link",
      title: dialog === "table" ? "Insert table" : dialog === "database" ? "Link to Workspace item" : "Insert link",
      description: dialog === "database" ? "Choose a page, database, record or folder in this Workspace." : void 0,
      initial: dialog === "table" ? { rows: "2", columns: "2" } : { text: selection?.quote ?? "" },
      fields: dialog === "table" ? [
        { name: "rows", label: "Rows", type: "number" },
        { name: "columns", label: "Columns", type: "number" }
      ] : dialog === "database" ? [
        {
          name: "id",
          label: "Workspace item",
          options: [
            ["", "Choose an item\u2026"],
            ...workspaceItems.filter((other) => !other.deleted_at).map((other) => [
              other.id,
              itemLabel(other, workspaceItems, attachments)
            ]).sort((a, b) => a[1].localeCompare(b[1]))
          ]
        },
        { name: "text", label: "Link text" }
      ] : [
        { name: "url", label: "URL" },
        { name: "text", label: "Link text" }
      ],
      onClose: () => {
        setDialog(null);
        requestAnimationFrame(() => restoreSelection(true));
      },
      returnFocus: root.current,
      onSuccessFocus: restoreSelection,
      onSubmit: async (values) => {
        if (dialog === "table") {
          const rows = Number(values.rows), cols = Number(values.columns);
          if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 30 || cols > 12)
            throw new Error("Use 1\u201330 rows and 1\u201312 columns.");
          insert(
            "<table><tbody>" + Array.from(
              { length: rows },
              () => "<tr>" + Array.from({ length: cols }, () => "<td>Cell</td>").join(
                ""
              ) + "</tr>"
            ).join("") + "</tbody></table>"
          );
        } else {
          if (dialog === "database" && !workspaceItems.some(
            (other) => other.id === values.id && !other.deleted_at
          ))
            throw new Error("Choose an available Workspace item.");
          const href = dialog === "database" ? workspaceHref(values.id) : values.url;
          if (!safeHref(href))
            throw new Error(
              "Use an https, http, mailto or valid Workspace link."
            );
          insert(
            `<a href="${escapeHTML(href)}">${escapeHTML(values.text)}</a>`
          );
        }
      }
    })
  );
}

// frontend/rich-preview.jsx
import { Fragment, useLayoutEffect as useLayoutEffect6, useRef as useRef8 } from "react";
function RichPreview({ label, html, text, attachments }) {
  const root = useRef8(null);
  const safe = sanitizeHTML(html ?? "");
  useLayoutEffect6(() => {
    if (!root.current) return;
    hydrateImages(root.current, attachments);
    hydrateChecklists(root.current, true);
    root.current.querySelectorAll("a").forEach((link) => {
      link.tabIndex = -1;
    });
  }, [safe, attachments]);
  return h(
    Fragment,
    null,
    h("style", null, editorStyles),
    h("div", {
      ref: root,
      className: "ws-section-fragment",
      role: "region",
      "aria-label": label,
      tabIndex: 0,
      onClick: (event) => event.preventDefault(),
      ...html == null ? { children: text } : { dangerouslySetInnerHTML: { __html: safe } }
    })
  );
}

// frontend/tables.jsx
import { useCallback as useCallback2, useEffect as useEffect4, useId as useId3, useRef as useRef9, useState as useState9 } from "react";
import { Checkbox, SearchField as SearchField2 } from "@hermes/plugin-sdk";

// frontend/database-grid-styles.mjs
var databaseGridStyles = `
.ws-database { position: relative; min-width: 0; font-size: 13px; container-name: workspace-database; container-type: inline-size; }
.ws-root .ws-work:has(.ws-database) { scroll-padding-top: 40px; }
.ws-database .ws-database-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; margin: 0 0 10px; padding-inline-end: 80px; }
.ws-database .ws-database-tools > .ws-choice { width: 112px; margin: 0; }
.ws-database .ws-db-filter { flex: 1 1 150px; max-width: 260px; opacity: 1; }
.ws-database .ws-db-filter input::placeholder { color: var(--ui-text-secondary); opacity: 1; }
.ws-db-count { color: var(--ui-text-secondary); font-size: 12px; font-weight: 400; white-space: nowrap; }
.ws-database .ws-table-wrap { margin: 0; border-inline: 0; border-top: 0; container-type: inline-size; container-name: workspace-db-grid; max-height: max(9rem, min(34rem, calc(var(--ws-pane-height, 640px) - 104px))); scroll-padding-top: 42px; }
.ws-database .ws-table { font-size: 13px; min-width: 480px; }
.ws-database .ws-table :is(th,td) { padding: 5px 10px; min-width: 150px; max-width: 260px; vertical-align: middle; }
.ws-database .ws-table thead th { position: sticky; top: 0; z-index: 2; padding-block: 8px; font-size: 12px; font-weight: 500; background: var(--ui-bg-editor); border-right: 0; box-shadow: 0 1px 0 var(--ui-stroke-secondary); }
.ws-database .ws-table :is(th,td):not(:last-child) { border-right: 1px solid var(--ui-stroke-tertiary); }
.ws-database .ws-table tbody th { background: transparent; color: var(--ui-text-primary); font-weight: 500; min-width: 210px; }
.ws-database .ws-table tbody tr:hover { background: var(--ui-bg-secondary); }
.ws-db-column-heading,.ws-db-column-name,.ws-db-record-name { display: flex; align-items: center; min-width: 0; gap: 8px; }
.ws-db-column-heading,.ws-db-record-name { justify-content: space-between; }
.ws-db-column-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-db-column-name > .codicon { color: var(--ui-text-secondary); flex-shrink: 0; }
.ws-db-record-name > button:first-child { flex: 1 1 0%; max-width: 100%; white-space: normal; min-width: 0; justify-content: start; height: auto; padding-inline: 0; font-size: 13px; text-align: left; overflow-wrap: anywhere; }
.ws-db-row-actions { flex: 0 0 auto; color: var(--ui-text-secondary); }
.ws-database .ws-table .ws-db-property-header,.ws-database .ws-table .ws-db-property-spacer { width: 128px; min-width: 128px; max-width: 128px; padding: 4px; }
.ws-db-add-property { color: var(--ui-text-primary); white-space: nowrap; font-size: 12px; font-weight: 500; gap: 6px; }
.ws-database .ws-property :is(input:not([type=checkbox]),.ws-choice-trigger) { min-height: 30px; height: 30px; border-color: transparent; background: transparent; box-shadow: none; font-size: 13px; padding-inline: 5px; }
.ws-database .ws-property :is(input:not([type=checkbox]),.ws-choice-trigger):hover { background: var(--ui-bg-tertiary); }
.ws-database .ws-property :is(input:not([type=checkbox]),.ws-choice-trigger):focus-visible { border-color: var(--ui-accent); }
.ws-database .ws-property-status { font-size: 12px; padding-block: 5px; }
.ws-database .ws-formula-value output { display: block; padding: 5px; color: var(--ui-text-primary); }
.ws-database .ws-table .ws-db-create-row > td { padding: 0; max-width: none; }
.ws-db-new-record { width: 100%; justify-content: flex-start; min-height: 36px; color: var(--ui-text-primary); font-weight: 500; }
.ws-table .ws-db-new-record { position: sticky; left: 0; width: 100cqw; }
.ws-db-record-draft { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; max-width: 100%; }
.ws-table .ws-db-record-draft { position: sticky; left: 0; width: 100cqw; box-sizing: border-box; }
.ws-db-draft-label { color: var(--ui-text-primary); font-size: 12px; font-weight: 500; }
.ws-db-record-draft > input { flex: 1 1 180px; width: auto; max-width: 420px; }
.ws-db-record-draft > p { flex-basis: 100%; margin: 0; font-size: 12px; }
.ws-db-form-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.ws-db-empty-row > td,.ws-db-empty { color: var(--ui-text-secondary); padding: 20px 10px !important; font-size: 13px; }
.ws-db-schema-help { margin-top: 12px; font-size: 12px; color: var(--ui-text-secondary); }
.ws-db-property-popover,.ws-db-sort-popover,.ws-db-relation-popover { width: 300px; max-width: min(22rem, var(--radix-popover-content-available-width, calc(100vw - 24px))); max-height: min(30rem, var(--radix-popover-content-available-height, 80vh)); overflow: auto; font-size: 13px; }
.ws-db-property-popover { display: flex; padding: 0; overflow: hidden; }
.ws-db-property-popover > form { display: flex; flex-direction: column; min-height: 0; width: 100%; max-height: inherit; }
.ws-db-property-popover h3 { flex-shrink: 0; margin: 0; padding: 10px 8px; font-size: 13px; font-weight: 600; }
.ws-db-property-fields { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 8px; }
.ws-db-property-popover :is(.ws-field,.ws-choice),.ws-db-sort-popover .ws-choice { margin: 0 0 12px; }
.ws-db-property-popover .ws-db-form-actions { flex-shrink: 0; padding: 8px; border-top: 1px solid var(--ui-stroke-tertiary); background: var(--ui-bg-card); }
.ws-db-property-popover p { margin: 8px 0; }
.ws-db-property-popover details { font-size: 12px; margin-bottom: 12px; }
.ws-db-relation-trigger { width: 100%; justify-content: flex-start; height: auto; min-height: 30px; white-space: normal; font-size: 13px; }
.ws-db-board-tools { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.ws-db-board-tools .ws-choice { flex: 1; margin: 0; }
.ws-db-board-tools > span { font-size: 12px; color: var(--ui-text-secondary); }
.ws-database .ws-board { margin-block: 0; gap: 14px; }
.ws-database .ws-board-group { border: 0; background: var(--ui-bg-card); padding: 10px; }
.ws-database .ws-board-group > h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 13px; font-weight: 500; }
.ws-database .ws-board-record { background: var(--ui-bg-editor); border: 1px solid var(--ui-stroke-tertiary); border-radius: 4px; padding: 10px; }
.ws-db-board-create { margin-top: 12px; border-top: 1px solid var(--ui-stroke-tertiary); }
.ws-db-sort-label { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-db-status { position: absolute; top: 0; right: 0; height: 28px; display: flex; align-items: center; gap: 8px; min-width: 0; }
.ws-db-record-context { display: none; align-items: center; gap: 5px; min-width: 0; color: var(--ui-text-secondary); font-size: 12px; }
.ws-db-record-context > button { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-db-record-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-database .ws-db-active-row { outline: 1px solid var(--ui-stroke-secondary); outline-offset: -1px; }
@container workspace-database (max-width: 499px) {
  .ws-database .ws-database-tools { padding-inline-end: 0; }
  .ws-db-status { position: sticky; top: 0; z-index: 3; width: 100%; height: 32px; background: var(--ui-bg-editor); }
  .ws-db-record-context { display: flex; flex: 1; }
}
@container workspace-db-grid (min-width: 500px) {
  .ws-database .ws-table :is(thead th:first-child,tbody th[scope=row]) { position: sticky; left: 0; z-index: 1; background: var(--ui-bg-editor); box-shadow: 1px 0 0 var(--ui-stroke-secondary); }
  .ws-database .ws-table thead th:first-child { z-index: 3; }
}
`;

// frontend/database.mjs
function tableRows(records, columns, { sort = "", direction = "asc", filter = "" } = {}) {
  const needle = filter.toLocaleLowerCase();
  const result = records.filter(
    (r) => [r.title, ...Object.values(r.properties ?? {})].some(
      (v) => String(v ?? "").toLocaleLowerCase().includes(needle)
    )
  );
  const column = columns.find((c) => c.id === sort);
  if (sort)
    result.sort((a, b) => {
      const av = sort === "title" ? a.title : a.properties?.[sort];
      const bv = sort === "title" ? b.title : b.properties?.[sort];
      const comparison = column?.type === "number" ? Number(av ?? 0) - Number(bv ?? 0) : String(av ?? "").localeCompare(String(bv ?? ""), void 0, {
        numeric: true
      });
      return comparison * (direction === "desc" ? -1 : 1);
    });
  return result;
}
function boardGroups(records, column) {
  const groups = new Map(
    [...column?.options ?? [], null].map((name) => [name, []])
  );
  for (const record of records) {
    const name = record.properties?.[column.id] ?? null;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(record);
  }
  return groups;
}
function activeRun(state, id) {
  return state?.runs?.find(
    (run) => ["running", "pending", "starting", "stopping"].includes(run.status) && (run.allowed_item_ids ?? [run.item_id]).includes(id)
  );
}
function propertyPatch(state, id, columnId, value) {
  const record = state.items.find((i) => i.id === id);
  if (!record) throw new Error("Record is unavailable.");
  const database = state.items.find((i) => i.id === record.database_id);
  const editable = new Set(
    (database?.columns ?? []).filter((c) => c.type !== "formula").map((c) => c.id)
  );
  return {
    id,
    patch: {
      properties: {
        ...Object.fromEntries(
          Object.entries(record.properties ?? {}).filter(
            ([key]) => editable.has(key)
          )
        ),
        [columnId]: value
      }
    }
  };
}

// frontend/tables.jsx
function Property({ column, value, onChange, state, disabled: authorityDisabled, interactionBlocked = false, buffer, registerFlush, formulaError, onSettled, compact = false }) {
  const disabled = authorityDisabled || interactionBlocked;
  const initial = useRef9(buffer?.read() ?? null), recovery = useRef9(Boolean(initial.current));
  const scalar = ["text", "number", "date"].includes(column.type);
  const display = (next) => scalar ? String(next ?? "") : next;
  const [draft, setDraft] = useState9(() => initial.current ? initial.current.value : display(value));
  const [status, setStatus] = useState9(initial.current ? "Property draft retained. Retry or discard it." : ""), [error, setError] = useState9("");
  const [busy, setBusy] = useState9(false), container = useRef9(null), mounted = useRef9(true);
  const returnFocus = useRef9(null);
  const dirty = useRef9(null), revision = useRef9(0), saving = useRef9(Promise.resolve()), pending = useRef9(0);
  const latest = useRef9(null);
  latest.current = { onChange, disabled: authorityDisabled, buffer };
  const errorId = useId3(), focus = () => container.current?.querySelector("input,button,textarea")?.focus();
  useEffect4(() => {
    if (busy || !returnFocus.current) return;
    const opener = returnFocus.current;
    returnFocus.current = null;
    if (document.activeElement === document.body || document.activeElement === opener) focus();
  }, [busy, status, error]);
  const normalize = (raw) => column.type === "number" ? raw === "" ? null : Number(raw) : column.type === "date" && raw === "" ? null : raw;
  const flush = () => {
    if (recovery.current) return Promise.reject(new UnsavedEditError(`Review the retained ${column.name} property before leaving.`, focus));
    if (!dirty.current) return saving.current;
    const snapshot = dirty.current, save = latest.current.onChange, savedBuffer = latest.current.buffer;
    dirty.current = null;
    pending.current++;
    setBusy(true);
    setStatus("Saving property\u2026");
    setError("");
    const promise = saving.current.catch(() => {
    }).then(async () => {
      if (latest.current.disabled) throw Error("This property is read-only while Hermes is working.");
      await save(normalize(snapshot.value));
    }).then(() => {
      if (snapshot.token) savedBuffer?.acknowledge(snapshot.token);
      if (mounted.current && snapshot.revision === revision.current) {
        setDraft(display(normalize(snapshot.value)));
        setStatus("");
        setError("");
      }
    }, (err) => {
      if (snapshot.revision === revision.current) {
        if (!dirty.current) dirty.current = snapshot;
        if (mounted.current) {
          setStatus("Property not saved.");
          setError(errorMessage(err));
        }
      }
      throw new UnsavedEditError(`${column.name} not saved: ${errorMessage(err)}`, focus);
    }).finally(() => {
      pending.current--;
      if (mounted.current) setBusy(pending.current > 0);
      onSettled?.();
    });
    saving.current = promise;
    promise.catch(() => {
    });
    return promise;
  };
  const change = (next, immediate = false) => {
    revision.current++;
    recovery.current = false;
    setDraft(next);
    setStatus("Unsaved property");
    setError("");
    const snapshot = { value: next, revision: revision.current, token: null };
    dirty.current = snapshot;
    try {
      snapshot.token = buffer?.put(next, value)?.token ?? null;
    } catch (err) {
      setError(errorMessage(err));
    }
    if (immediate) void flush().catch(() => {
    });
  };
  useEffect4(() => column.type !== "formula" ? registerFlush?.(flush) : void 0, [registerFlush, column.type]);
  useEffect4(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const encoded = JSON.stringify(value);
  useEffect4(() => {
    if (!dirty.current && pending.current === 0 && !recovery.current) setDraft(display(value));
    else if (recovery.current && !buffer?.read() && JSON.stringify(normalize(draft)) === JSON.stringify(value)) {
      recovery.current = false;
      setDraft(display(value));
      setStatus("");
      setError("");
    }
  }, [encoded, buffer]);
  if (column.type === "formula") return h(
    "div",
    { className: "ws-formula-value" },
    h("output", { "aria-label": column.name, "aria-invalid": Boolean(formulaError), "aria-describedby": formulaError ? errorId : void 0 }, formulaError ? "Calculation failed" : String(value ?? "\u2014")),
    formulaError && h("span", { id: errorId, className: "ws-field-error", role: "alert" }, errorMessage(formulaError))
  );
  const accessibility = { "aria-invalid": Boolean(error), "aria-describedby": status || error ? errorId : void 0 };
  let control;
  if (column.type === "checkbox") control = h(Checkbox, { ...accessibility, className: "ws-checkbox", "aria-label": column.name, checked: Boolean(draft), disabled, onCheckedChange: (v) => change(v === true, true) });
  else if (column.type === "select") {
    const options = column.options ?? [];
    let emptyLabel = "No value";
    while (options.includes(emptyLabel)) emptyLabel += " (clear)";
    control = h(Choice, {
      triggerProps: accessibility,
      label: column.name,
      showLabel: false,
      value: draft ?? "",
      disabled,
      options: [["", emptyLabel], ...options],
      onChange: (next) => change(next === "" ? null : next, true)
    });
  } else if (column.type === "relation") {
    const records = state.items.filter((i) => !i.deleted_at && i.kind === "record" && i.database_id === column.target_database_id);
    const selected = Array.isArray(draft) ? draft : [];
    const choices = h("div", { ...accessibility, role: "group", "aria-label": column.name }, records.length ? records.map((record) => h(
      "label",
      { key: record.id, className: "ws-check" },
      h(Checkbox, {
        ...accessibility,
        className: "ws-checkbox",
        "aria-label": `${column.name}: ${record.title}`,
        disabled,
        checked: selected.includes(record.id),
        onCheckedChange: (checked) => change(checked ? [...selected, record.id] : selected.filter((id) => id !== record.id), true)
      }),
      record.title
    )) : h("span", { className: "ws-muted" }, "No records in related database."));
    control = compact ? h(RelationPicker, { accessibility, disabled, column, records, selected }, choices) : choices;
  } else control = h(Input, {
    "aria-label": column.name,
    "aria-invalid": Boolean(error),
    "aria-describedby": status || error ? errorId : void 0,
    disabled,
    type: column.type === "number" ? "number" : column.type === "date" ? "date" : "text",
    value: draft ?? "",
    onChange: (event) => change(event.target.value),
    onBlur: () => {
      if (!recovery.current && !error) void flush().catch(() => {
      });
    },
    onKeyDown: (event) => {
      if (isSubmitEnter2(event)) event.currentTarget.blur();
    }
  });
  return h(
    "div",
    { ref: container, className: "ws-property" },
    control,
    (status || error) && h(
      "div",
      { id: errorId, className: "ws-property-status", role: error ? "alert" : "status" },
      error ? `Property not saved. ${error}` : status,
      (error || recovery.current) && h(
        "div",
        { className: "ws-actions" },
        h(Action, { disabled: disabled || busy, onMouseDown: (event) => event.preventDefault(), onClick: (event) => {
          returnFocus.current = event.currentTarget;
          if (recovery.current) {
            recovery.current = false;
            revision.current++;
            dirty.current = { value: draft, revision: revision.current, token: buffer?.read()?.token };
          }
          void flush().catch(() => {
          });
        } }, "Retry property save"),
        h(Action, { disabled: disabled || busy, variant: "text", onMouseDown: (event) => event.preventDefault(), onClick: (event) => {
          returnFocus.current = event.currentTarget;
          revision.current++;
          dirty.current = null;
          recovery.current = false;
          saving.current = saving.current.catch(() => {
          });
          buffer?.discard();
          setDraft(display(value));
          setStatus("");
          setError("");
        } }, "Discard property draft")
      )
    )
  );
}
function RelationPicker({ accessibility, disabled, column, records, selected, children }) {
  const [open, setOpen] = useState9(false);
  return h(ContextPopover, {
    open,
    onOpenChange: setOpen,
    className: "ws-db-relation-popover",
    align: "start",
    trigger: h(
      Action,
      { ...accessibility, variant: "ghost", disabled, "aria-label": column.name, className: "ws-db-relation-trigger" },
      selected.length ? records.filter((r) => selected.includes(r.id)).map((r) => r.title).join(", ") : "Choose records\u2026"
    )
  }, children);
}
function RecordProperties({
  item,
  database,
  state,
  command,
  locked,
  onError,
  propertyBuffer,
  registerPropertyFlush,
  interactionBlocked = false
}) {
  const [, advanceDrafts] = useState9(0);
  const settled = useCallback2(() => advanceDrafts((version) => version + 1), []);
  return h(
    "div",
    { className: "ws-properties" },
    (database?.columns ?? []).map(
      (column) => h(
        "div",
        { className: "ws-field", key: column.id },
        h("span", { className: "ws-label" }, column.name),
        h(Property, {
          key: column.id,
          buffer: propertyBuffer?.(item.id, column.id),
          registerFlush: (fn) => registerPropertyFlush?.(`${item.id}:${column.id}`, fn),
          formulaError: item.formula_errors?.[column.id],
          onSettled: settled,
          column,
          value: item.properties?.[column.id],
          state,
          disabled: locked,
          interactionBlocked,
          onChange: (value) => command(
            "update_item",
            (latest) => propertyPatch(latest, item.id, column.id, value)
          )
        })
      )
    )
  );
}
var propertyIcons = { text: "symbol-string", number: "symbol-number", checkbox: "check", date: "calendar", select: "list-selection", relation: "link", formula: "symbol-operator" };
var propertyTypes = [["text", "Text"], ["number", "Number"], ["checkbox", "Checkbox"], ["date", "Date"], ["select", "Single select"], ["relation", "Relation"], ["formula", "Formula"]];
function PropertyCreator({ item, state, command, locked, registerFlush }) {
  const [open, setOpen] = useState9(false), [busy, setBusy] = useState9(false), [error, setError] = useState9(null);
  const empty = () => ({ name: "", type: "text", options: "", target: "", formula: "" });
  const [values, setValues] = useState9(empty), gate = useRef9(false), alive = useRef9(true), composing = useRef9(false);
  const input = useRef9(null), form = useRef9(null), errorId = useId3();
  const closePending = useRef9(false), reopenAfterClose = useRef9(false);
  const latest = useRef9(null);
  latest.current = { item, state, command, locked, values, error, busy };
  useEffect4(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect4(() => registerFlush?.(`creation:property:${item.id}`, async () => {
    const value = latest.current;
    const dirty = Object.entries(value.values).some(([key, text]) => key === "type" ? text !== "text" : Boolean(text));
    if (value.busy || value.error || dirty) throw new UnsavedEditError("Finish or cancel the new property before leaving this database.", () => {
      if (closePending.current) reopenAfterClose.current = true;
      else {
        setOpen(true);
        requestAnimationFrame(() => input.current?.focus());
      }
    });
  }), [registerFlush, item.id]);
  const fieldProps = (field) => ({ "aria-invalid": error?.field === field, "aria-describedby": error?.field === field ? errorId : void 0 });
  const invalid = (field, message) => Object.assign(Error(message), { propertyField: field });
  useEffect4(() => {
    if (error?.field && !busy && (document.activeElement === document.body || form.current?.contains(document.activeElement)))
      form.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [error, busy]);
  const change = (name) => (event) => {
    setValues((old) => ({ ...old, [name]: event.target.value }));
    setError(null);
  };
  const cancel = () => {
    if (gate.current) return;
    setOpen(false);
    setValues(empty());
    setError(null);
  };
  return h(
    ContextPopover,
    {
      open,
      onOpenChange: (next) => {
        if (!gate.current) {
          if (!next) closePending.current = true;
          setOpen(next);
        }
      },
      onCloseAutoFocus: (event) => {
        closePending.current = false;
        if (reopenAfterClose.current) {
          reopenAfterClose.current = false;
          event.preventDefault();
          setOpen(true);
        }
      },
      trigger: h(Action, { variant: "ghost", disabled: locked || busy, "aria-label": "Add property", className: "ws-db-add-property" }, h(Codicon, { name: "add", "aria-hidden": true }), "Add property"),
      className: "ws-db-property-popover",
      align: "end",
      side: "bottom",
      onEscapeKeyDown: (event) => {
        if (gate.current || composing.current || event.isComposing || event.keyCode === 229) event.preventDefault();
      },
      onOpenAutoFocus: (event) => {
        event.preventDefault();
        requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
      }
    },
    h(
      "form",
      {
        ref: form,
        "aria-label": "New property",
        "aria-busy": busy,
        "aria-describedby": error && !error.field ? errorId : void 0,
        onCompositionStart: () => {
          composing.current = true;
        },
        onCompositionEnd: () => {
          composing.current = false;
        },
        onKeyDown: (event) => {
          if (event.key === "Enter" && (composing.current || !isSubmitEnter2(event) || event.repeat || event.ctrlKey || event.metaKey || event.altKey)) event.preventDefault();
        },
        onSubmit: async (event) => {
          event.preventDefault();
          if (gate.current || latest.current.locked || composing.current) return;
          if (!values.name.trim()) {
            setError({ field: "name", message: "Enter a property name." });
            input.current?.focus();
            return;
          }
          gate.current = true;
          setBusy(true);
          setError(null);
          try {
            const column = { id: "col_" + crypto.randomUUID().replaceAll("-", ""), name: values.name.trim(), type: values.type };
            if (column.type === "select") {
              column.options = values.options.split(",").map((v) => v.trim()).filter(Boolean);
              if (!column.options.length) throw invalid("options", "Enter at least one select option.");
              if (new Set(column.options).size !== column.options.length) throw invalid("options", "Use each select option only once.");
            }
            if (column.type === "relation") {
              if (!values.target) throw invalid("target", "Choose a related database.");
              column.target_database_id = values.target;
            }
            if (column.type === "formula") {
              if (!values.formula.trim()) throw invalid("formula", "Enter a formula expression.");
              column.formula = values.formula;
            }
            const id = latest.current.item.id;
            await latest.current.command("set_columns", (current) => ({ id, columns: [...current.items.find((i) => i.id === id).columns, column] }));
            if (alive.current) {
              setOpen(false);
              setValues(empty());
            }
          } catch (err) {
            if (alive.current) {
              const message = errorMessage(err);
              const formulaValidation = /^(?:Formula (?:must contain|nesting limit|node limit|dependency)|Invalid formula syntax$|Unsupported formula operation$|Unknown formula column|Private names are forbidden$|Wrong number of function arguments$|col requires a literal column name or id$)/.test(message);
              const field = err.propertyField ?? (values.type === "formula" && formulaValidation ? "formula" : /^Select options|^select option must/.test(message) ? "options" : message === "Relation target must be a Workspace database" ? "target" : /^(?:Column IDs and names must be unique|Column names\/IDs must be unambiguous|column name must)/.test(message) ? "name" : message === "Unsupported property type" ? "type" : null);
              setError({ field, message });
            }
          } finally {
            gate.current = false;
            if (alive.current) setBusy(false);
          }
        }
      },
      h("h3", null, "New property"),
      h(
        "div",
        { className: "ws-db-property-fields" },
        h(Field, { ref: input, label: "Property name", value: values.name, required: true, maxLength: 200, disabled: locked || busy, ...fieldProps("name"), onChange: change("name") }),
        h(Choice, { label: "Property type", triggerProps: fieldProps("type"), value: values.type, options: propertyTypes, disabled: locked || busy, onChange: (value) => {
          setValues((old) => ({ ...old, type: value }));
          setError(null);
        } }),
        values.type === "select" && h(Field, { label: "Select options (comma separated)", ...fieldProps("options"), value: values.options, disabled: locked || busy, placeholder: "To do, In progress, Done", onChange: change("options") }),
        values.type === "relation" && h(Choice, {
          label: "Related database",
          triggerProps: fieldProps("target"),
          value: values.target,
          disabled: locked || busy,
          options: [["", "Choose database"], ...state.items.filter((i) => i.kind === "database" && !i.deleted_at).map((i) => [i.id, itemLabel(i, state.items, state.attachments)])],
          onChange: (value) => {
            setValues((old) => ({ ...old, target: value }));
            setError(null);
          }
        }),
        values.type === "formula" && h(Field, { label: "Formula expression", ...fieldProps("formula"), value: values.formula, disabled: locked || busy, onChange: change("formula") }),
        values.type === "formula" && h("details", null, h("summary", null, "Formula syntax and column IDs"), h(FormulaHelp, { columns: item.columns ?? [] })),
        error && h("p", { id: errorId, role: "alert", className: "ws-field-error" }, error.message),
        locked && h("p", { className: "ws-muted", role: "status" }, "Properties are read-only while Hermes is working.")
      ),
      h(
        "div",
        { className: "ws-db-form-actions" },
        h(Action, { disabled: busy, onClick: cancel }, "Cancel"),
        h(Action, { type: "submit", disabled: locked || busy || !values.name.trim() }, busy ? "Adding\u2026" : "Add property")
      )
    )
  );
}
function NewRecordCreator({ draft, locked, onDraft, onCreate, onCancel, label = "New record", groupKey, onFocus }) {
  const form = useRef9(null), input = useRef9(null), composing = useRef9(false);
  const titleId = useId3(), messageId = useId3();
  useEffect4(() => {
    if (draft.open && !draft.busy && (document.activeElement === document.body || form.current?.contains(document.activeElement))) {
      form.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      input.current?.focus({ preventScroll: true });
    }
  }, [draft.open, draft.busy]);
  if (!draft.open) return h(Action, {
    variant: "ghost",
    className: "ws-db-new-record",
    disabled: locked,
    "aria-label": label,
    "data-group-key": groupKey,
    onFocus,
    onPointerDown: onFocus,
    onClick: () => onDraft({ ...draft, open: true, error: "", status: "" })
  }, h(Codicon, { name: "add", "aria-hidden": true }), "New record");
  return h(
    "form",
    {
      ref: form,
      className: "ws-db-record-draft",
      "aria-label": label,
      "aria-busy": draft.busy,
      onFocusCapture: onFocus,
      onPointerDownCapture: onFocus,
      onCompositionStart: () => {
        composing.current = true;
      },
      onCompositionEnd: () => {
        composing.current = false;
      },
      onKeyDown: (event) => {
        if (event.key === "Escape" && !draft.busy && !composing.current && !event.isComposing && !event.nativeEvent?.isComposing) {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
        if (event.key === "Enter" && (composing.current || !isSubmitEnter2(event) || event.repeat || event.ctrlKey || event.metaKey || event.altKey)) event.preventDefault();
      },
      onSubmit: (event) => {
        event.preventDefault();
        if (!composing.current) void onCreate();
      }
    },
    h("label", { className: "ws-db-draft-label", htmlFor: titleId }, "New record"),
    h(Input, {
      ref: input,
      id: titleId,
      "aria-label": "New record title",
      "aria-describedby": draft.error || draft.status ? messageId : void 0,
      placeholder: "Enter record title\u2026",
      value: draft.title,
      maxLength: 500,
      required: true,
      disabled: locked || draft.busy,
      "aria-invalid": Boolean(draft.error),
      onChange: (event) => onDraft({ ...draft, title: event.target.value, error: "", status: "" })
    }),
    h(
      "div",
      { className: "ws-db-form-actions" },
      h(Action, { type: "submit", disabled: locked || draft.busy || !draft.title.trim() }, draft.busy ? "Creating\u2026" : "Create record"),
      h(Action, { "aria-label": "Cancel new record", disabled: draft.busy, onClick: onCancel }, "Cancel")
    ),
    (draft.error || draft.status) && h("p", { id: messageId, role: draft.error ? "alert" : "status", className: draft.error ? "ws-field-error" : "ws-muted" }, draft.error || draft.status)
  );
}
function Database({ item, state, command, onOpen, onError, locked, confirm, propertyBuffer, registerPropertyFlush }) {
  const [sort, setSort] = useState9(""), [direction, setDirection] = useState9("asc"), [filter, setFilter] = useState9(""), [view, setView] = useState9("table"), [group, setGroup] = useState9(""), [sortOpen, setSortOpen] = useState9(false);
  const [activeRecordId, setActiveRecordId] = useState9(null);
  const [creationFocused, setCreationFocused] = useState9(false);
  const focusCreation = () => {
    setActiveRecordId(null);
    setCreationFocused(true);
  };
  const [rowDraft, setRowDraft] = useState9({ open: false, title: "", error: "", status: "", busy: false });
  const creationGuards = useRef9(/* @__PURE__ */ new Map());
  const registerCreationFlush = useCallback2((id, fn) => {
    creationGuards.current.set(id, fn);
    const unregister = registerPropertyFlush?.(id, fn);
    return () => {
      if (creationGuards.current.get(id) === fn) creationGuards.current.delete(id);
      unregister?.();
    };
  }, [registerPropertyFlush]);
  const changeView = async (next) => {
    try {
      for (const flush of creationGuards.current.values()) await flush();
      setView(next);
    } catch (error) {
      if (error instanceof UnsavedEditError) error.focus();
      onError?.(error);
    }
  };
  const rowGate = useRef9(false), alive = useRef9(true), section = useRef9(null), latest = useRef9(null);
  latest.current = { command, locked, item, rowDraft };
  useEffect4(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect4(() => registerCreationFlush(`creation:record:${item.id}`, async () => {
    const draft = latest.current.rowDraft;
    if (draft.busy || draft.title || draft.error) throw new UnsavedEditError("Finish or cancel the new record before leaving this database.", () => section.current?.querySelector('input[aria-label="New record title"]')?.focus());
  }), [registerCreationFlush, item.id]);
  const [, advanceDrafts] = useState9(0), settled = useCallback2(() => advanceDrafts((v) => v + 1), []);
  const columns = item.columns ?? [], records = state.items.filter((i) => i.kind === "record" && !i.deleted_at && i.database_id === item.id);
  const rows = tableRows(records, columns, { sort, direction, filter }), selectColumns = columns.filter((c) => c.type === "select");
  const groupColumn = selectColumns.find((c) => c.id === group) ?? selectColumns[0];
  const activeRecord = records.find((record) => record.id === activeRecordId);
  const sortLabel = sort === "title" ? "Record title" : columns.find((column) => column.id === sort)?.name;
  const schemaLocked = locked || records.some((record) => Boolean(activeRun(state, record.id)));
  const write = (record, column, value) => command("update_item", (current) => propertyPatch(current, record.id, column.id, value));
  const cancelRecord = () => {
    if (rowGate.current) return;
    const key = rowDraft.target?.key;
    setRowDraft({ open: false, title: "", error: "", status: "", busy: false });
    requestAnimationFrame(() => [...section.current?.querySelectorAll(".ws-db-new-record") ?? []].find((button) => button.dataset.groupKey === key)?.focus());
  };
  const createRecord = async () => {
    const current = latest.current, title = current.rowDraft.title.trim();
    if (rowGate.current || current.locked) return;
    if (!title) {
      setRowDraft((old) => ({ ...old, error: "Enter a record title." }));
      return;
    }
    rowGate.current = true;
    setRowDraft((old) => ({ ...old, busy: true, error: "", status: "" }));
    try {
      const target = current.rowDraft.target;
      const record = await current.command("create_item", {
        kind: "record",
        database_id: current.item.id,
        title,
        ...target ? { properties: { [target.columnId]: target.value } } : {}
      });
      if (alive.current) setRowDraft((old) => ({
        ...old,
        open: true,
        title: "",
        error: "",
        busy: false,
        status: tableRows([record], columns, { filter }).length ? `Created \u201C${record.title}\u201D.` : `Created \u201C${record.title}\u201D. It is hidden by the current filter.`
      }));
    } catch (err) {
      if (alive.current) setRowDraft((old) => ({ ...old, busy: false, error: errorMessage(err) }));
    } finally {
      rowGate.current = false;
    }
  };
  const creation = h(NewRecordCreator, { draft: rowDraft, locked, onFocus: focusCreation, onDraft: setRowDraft, onCreate: createRecord, onCancel: cancelRecord });
  const groupName = (value) => {
    if (value !== null) return value;
    let label = "Unassigned";
    while ((groupColumn.options ?? []).includes(label)) label += " (no value)";
    return label;
  };
  const groupCreation = (value) => {
    const name = groupName(value);
    const key = JSON.stringify([groupColumn.id, value]), active = rowDraft.target?.key === key;
    return h(NewRecordCreator, {
      label: `New record in ${name}`,
      groupKey: key,
      onFocus: focusCreation,
      draft: active ? rowDraft : { open: false },
      locked: locked || rowDraft.open && !active,
      onDraft: (draft) => setRowDraft({ ...draft, title: draft.title ?? "", target: {
        key,
        columnId: groupColumn.id,
        value
      } }),
      onCreate: createRecord,
      onCancel: cancelRecord
    });
  };
  const rowActions = (record) => h(
    ActionMenu,
    {
      label: `Record actions: ${record.title}`,
      triggerLabel: h(Codicon, { name: "ellipsis", "aria-hidden": true }),
      showChevron: false,
      disabled: locked || Boolean(activeRun(state, record.id)),
      triggerProps: { className: "ws-db-row-actions", size: "icon-xs" }
    },
    h(Action, { onClick: (_event, opener) => confirm({ returnFocus: opener, title: `Move ${record.title} to Trash?`, description: "You can restore this record from Trash.", label: "Move to Trash", action: () => command("trash", { id: record.id }) }) }, "Move to Trash")
  );
  return h(
    "section",
    { ref: section, className: "ws-database", "aria-label": "Database" },
    h("style", null, databaseGridStyles),
    h(
      "div",
      { className: "ws-database-tools" },
      h(SearchField2, { value: filter, "aria-label": "Filter records", placeholder: "Filter records\u2026", containerClassName: "ws-db-filter opacity-100", onChange: setFilter, onClear: () => setFilter("") }),
      h(Choice, { label: "View", showLabel: false, value: view, disabled: rowDraft.open, options: [["table", "Table"], ["board", "Board"]], onChange: changeView }),
      h(
        ContextPopover,
        {
          open: sortOpen,
          onOpenChange: setSortOpen,
          className: "ws-db-sort-popover",
          align: "end",
          returnFocusOnEscape: true,
          trigger: h(Action, { variant: "ghost", "aria-label": sort ? `Sort: ${sortLabel}, ${direction === "asc" ? "ascending" : "descending"}` : "Sort" }, h(Codicon, { name: sort ? direction === "asc" ? "arrow-up" : "arrow-down" : "sort-precedence", "aria-hidden": true }), h("span", { className: "ws-db-sort-label" }, sort ? sortLabel : "Sort"))
        },
        h(Choice, { label: "Sort", value: sort, options: [["", "No sorting"], ["title", "Record title"], ...columns.map((c) => [c.id, c.name])], onChange: setSort }),
        h(Choice, { label: "Direction", value: direction, options: [["asc", "Ascending"], ["desc", "Descending"]], onChange: setDirection })
      )
    ),
    h(
      "div",
      { className: "ws-db-status", role: "status" },
      h("span", { className: "ws-db-count" }, filter ? `${rows.length} of ${records.length} records` : `${records.length} ${records.length === 1 ? "record" : "records"}`),
      creationFocused && view === "table" && h("span", { className: "ws-db-record-context" }, "New record"),
      activeRecord && !creationFocused && view === "table" && h(
        "span",
        { className: "ws-db-record-context" },
        "Record: ",
        h(ContextTip, { label: activeRecord.title }, h(Action, { variant: "link", onClick: () => onOpen(activeRecord.id) }, h("span", { className: "ws-db-record-label" }, activeRecord.title)))
      )
    ),
    view === "board" ? h(
      "div",
      { className: "ws-db-board-view" },
      h(
        "div",
        { className: "ws-db-board-tools" },
        groupColumn && h(Choice, { label: "Group board by", value: groupColumn.id, disabled: rowDraft.open, options: selectColumns.map((c) => [c.id, c.name]), onChange: setGroup }),
        h(PropertyCreator, { item, state, command, locked: schemaLocked, registerFlush: registerCreationFlush })
      ),
      !groupColumn ? h("p", { className: "ws-db-empty" }, "Add a single-select property to group records on a board.") : h(
        "div",
        { className: "ws-board", role: "region", "aria-label": "Database board, scroll for more groups", tabIndex: 0 },
        [...boardGroups(rows, groupColumn)].map(([value, groupRows]) => h(
          "section",
          { className: "ws-board-group", key: JSON.stringify(value), role: "region", "aria-label": `Board group: ${groupName(value)}` },
          h("h3", null, groupName(value), h("span", { className: "ws-db-count" }, String(groupRows.length))),
          groupRows.map((record) => h(
            "div",
            { key: record.id, className: "ws-board-record" },
            h("div", { className: "ws-db-record-name" }, h(Action, { variant: "ghost", onClick: () => onOpen(record.id) }, record.title), rowActions(record)),
            h(Property, {
              column: { ...groupColumn, name: `Move ${record.title}` },
              value: record.properties?.[groupColumn.id],
              state,
              disabled: locked || Boolean(activeRun(state, record.id)),
              buffer: propertyBuffer?.(record.id, groupColumn.id),
              onSettled: settled,
              registerFlush: (fn) => registerPropertyFlush?.(`${record.id}:${groupColumn.id}`, fn),
              onChange: (value2) => write(record, groupColumn, value2)
            })
          )),
          h("div", { className: "ws-db-board-create" }, groupCreation(value))
        ))
      ),
      !groupColumn && h("div", { className: "ws-db-board-create" }, creation)
    ) : h(
      "div",
      { className: "ws-table-wrap", role: "region", "aria-label": "Database table, scroll for more columns and records", tabIndex: 0 },
      h(
        "table",
        { className: "ws-table" },
        h("thead", null, h(
          "tr",
          null,
          h("th", { scope: "col", "aria-sort": sort === "title" ? direction === "asc" ? "ascending" : "descending" : void 0 }, h("span", { className: "ws-db-column-name" }, h(Codicon, { name: "symbol-string", "aria-hidden": true }), "Record")),
          columns.map((column) => h(
            "th",
            { key: column.id, scope: "col", "aria-sort": sort === column.id ? direction === "asc" ? "ascending" : "descending" : void 0 },
            h(
              "div",
              { className: "ws-db-column-heading" },
              h("span", { className: "ws-db-column-name", title: column.name }, h(Codicon, { name: propertyIcons[column.type], "aria-hidden": true }), column.name),
              h(ActionMenu, {
                label: `Column actions: ${column.name}`,
                triggerLabel: h(Codicon, { name: "ellipsis", "aria-hidden": true }),
                showChevron: false,
                disabled: schemaLocked,
                triggerProps: { size: "icon-xs" }
              }, h(Action, { onClick: (_event, opener) => confirm({
                returnFocus: opener,
                title: `Remove ${column.name}?`,
                description: "Values in this column will be removed from every record.",
                label: "Remove column",
                action: () => command("set_columns", (current) => ({ id: item.id, columns: current.items.find((i) => i.id === item.id).columns.filter((c) => c.id !== column.id) }))
              }) }, "Remove column"))
            )
          )),
          h("th", { key: "new-property", scope: "col", className: "ws-db-property-header" }, h(PropertyCreator, { item, state, command, locked: schemaLocked, registerFlush: registerCreationFlush }))
        )),
        h(
          "tbody",
          null,
          !rows.length && h("tr", { className: "ws-db-empty-row" }, h("td", { colSpan: columns.length + 2 }, filter ? "No records match this filter." : "No records yet. Add your first record below.")),
          rows.map((record) => h(
            "tr",
            { key: record.id, className: activeRecordId === record.id ? "ws-db-active-row" : void 0, onFocusCapture: () => {
              setActiveRecordId(record.id);
              setCreationFocused(false);
            }, onPointerDownCapture: () => {
              setActiveRecordId(record.id);
              setCreationFocused(false);
            } },
            h("th", { scope: "row" }, h("div", { className: "ws-db-record-name" }, h(Action, { variant: "ghost", onClick: () => onOpen(record.id) }, h(Codicon, { name: "file-text", "aria-hidden": true }), record.title), rowActions(record))),
            columns.map((column) => h("td", { key: column.id }, h(Property, {
              compact: true,
              key: `${record.id}:${column.id}`,
              buffer: propertyBuffer?.(record.id, column.id),
              registerFlush: (fn) => registerPropertyFlush?.(`${record.id}:${column.id}`, fn),
              formulaError: record.formula_errors?.[column.id],
              onSettled: settled,
              column,
              value: record.properties?.[column.id],
              state,
              disabled: locked || Boolean(activeRun(state, record.id)),
              onChange: (value) => write(record, column, value)
            }))),
            h("td", { className: "ws-db-property-spacer", "aria-hidden": true })
          )),
          h("tr", { className: "ws-db-create-row" }, h("td", { colSpan: columns.length + 2 }, creation))
        )
      )
    ),
    h("details", { className: "ws-db-schema-help" }, h("summary", null, "Column IDs for formulas"), h(FormulaHelp, { columns }))
  );
}
function FormulaHelp({ columns }) {
  const numeric = columns.filter((c) => c.type === "number");
  const example = numeric.length > 1 ? `col(${JSON.stringify(numeric[0].name)}) * col(${JSON.stringify(numeric[1].name)})` : numeric.length ? `col(${JSON.stringify(numeric[0].name)}) * 2` : columns.length ? `len(col(${JSON.stringify(columns[0].name)}))` : "2 + 3";
  return h(
    "section",
    { className: "ws-formula-help", "aria-label": "Formula syntax" },
    h(
      "p",
      null,
      'Use col("Column name") or a column ID from this database. For example: ',
      h("code", null, example)
    ),
    h("p", { className: "ws-muted" }, "Same-row arithmetic (+ \u2212 * / %), comparisons, and/or/not, conditional expressions, IF, abs, round, min, max, len, lower, upper, concat and coalesce. Formula errors appear on each record."),
    columns.length > 0 && h("ul", null, columns.map((c) => h("li", { key: c.id }, `${c.name}: `, h("code", null, c.id))))
  );
}

// frontend/scope-review.jsx
import { useRef as useRef10, useState as useState10 } from "react";
import {
  Checkbox as Checkbox2,
  SearchField as SearchField3,
  Button as Button2,
  Dialog as Dialog3,
  DialogContent as DialogContent3,
  DialogHeader as DialogHeader3,
  DialogTitle as DialogTitle3,
  DialogDescription as DialogDescription3,
  DialogFooter as DialogFooter3
} from "@hermes/plugin-sdk";
function reviewScope(state, itemId) {
  const comments = state.comments.filter(
    (c) => c.item_id === itemId && !c.resolved
  );
  const ids = [.../* @__PURE__ */ new Set([
    ...comments.flatMap((c) => c.target_item_ids ?? []),
    ...state.items.filter((i) => !i.deleted_at && i.kind !== "folder").map((i) => i.id)
  ])].filter((id) => id !== itemId).sort();
  const targets = ids.map((id) => {
    const item = state.items.find((i) => i.id === id);
    return {
      id,
      title: item?.title ?? "Unavailable item",
      label: itemLabel(item, state.items, state.attachments),
      kind: item?.kind ?? "unknown",
      available: Boolean(item && !item.deleted_at && item.kind !== "folder"),
      comments: comments.filter((c) => c.target_item_ids?.includes(id)).map((c) => ({ id: c.id, text: c.text }))
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
        targets: [...c.target_item_ids ?? []].sort()
      })),
      targets: targets.map((t) => ({
        id: t.id,
        title: t.title,
        label: t.label,
        kind: t.kind,
        available: t.available
      }))
    })
  };
}
function ScopeReviewDialog({
  review,
  currentTitle,
  currentId,
  currentThreadId,
  onSubmit,
  onClose
}) {
  const [selected, setSelected] = useState10([]), [busy, setBusy] = useState10(false), [error, setError] = useState10("");
  const inFlight = useRef10(false);
  const [query, setQuery] = useState10(""), [limit, setLimit] = useState10(20);
  const matches = review.targets.filter((target) => `${target.title} ${target.label} ${target.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return h(
    Dialog3,
    { open: true, onOpenChange: (open) => !open && !busy && onClose() },
    h(
      DialogContent3,
      { className: "ws-dialog ws-scope-review", bodyClassName: "ws-scope-review-body", showCloseButton: !busy },
      h(
        DialogHeader3,
        null,
        h(DialogTitle3, null, "Review edits for this run"),
        h(
          DialogDescription3,
          { className: "ws-dialog-description" },
          "Related items start unchecked. Text and references never grant edits."
        )
      ),
      h("p", { className: "ws-scope-current", title: currentTitle }, `Current page: ${currentTitle}`),
      h(
        "details",
        { className: "ws-related-scope" },
        h("summary", null, `Allow related-item edits (optional${selected.length ? `; ${selected.length} selected` : ""})`),
        h(SearchField3, { "aria-label": "Find related items", value: query, placeholder: "Find a Workspace item\u2026", onChange: (value) => {
          setQuery(value);
          setLimit(20);
        }, onClear: () => {
          setQuery("");
          setLimit(20);
        } }),
        h("p", { role: "status" }, `${matches.length} matching items; ${selected.length} explicitly selected.`),
        matches.slice(0, limit).map(
          (target) => h(
            "section",
            { key: target.id, className: "ws-comment" },
            h(
              "label",
              { className: "ws-check" },
              h(Checkbox2, {
                className: "ws-checkbox",
                "aria-label": `Allow edits to ${target.label}`,
                checked: selected.includes(target.id),
                disabled: busy || !target.available,
                onCheckedChange: (checked) => setSelected(
                  (ids) => checked ? [...ids, target.id] : ids.filter((id) => id !== target.id)
                )
              }),
              h(
                "span",
                null,
                `${target.label}${target.available ? "" : "; unavailable, not allowed"}`
              )
            ),
            h("details", null, h("summary", null, "Technical identity"), h("p", null, `Workspace item ID: ${target.id}`)),
            target.comments.map(
              (comment) => h("p", { key: comment.id }, comment.text)
            )
          )
        ),
        matches.length > limit && h(Action, { onClick: () => setLimit((value) => value + 20) }, "Show more items")
      ),
      error && h(
        "div",
        { role: "alert" },
        h("p", null, operationError(error, { operation: "runStart", pageTitle: currentTitle, threadId: currentThreadId })),
        h("details", null, h("summary", null, "Technical details"), h("pre", null, error))
      ),
      h(
        DialogFooter3,
        { className: "ws-dialog-footer" },
        h(Action, { disabled: busy, onClick: onClose }, "Cancel"),
        h(
          Button2,
          {
            "aria-label": selected.length ? "Address selected scope" : "Address current page",
            loading: busy,
            onClick: async () => {
              if (inFlight.current) return;
              inFlight.current = true;
              setBusy(true);
              setError("");
              try {
                if (selected.some((id) => !review.targets.some((t) => t.id === id && t.available)))
                  throw new Error("The selected related items are unavailable. Close and review this run again.");
                await onSubmit(selected);
                onClose();
              } catch (err) {
                setError(err.message);
              } finally {
                inFlight.current = false;
                setBusy(false);
              }
            }
          },
          selected.length ? "Address selected scope" : "Address current page"
        )
      )
    )
  );
}

// frontend/comments.jsx
import { useCallback as useCallback3, useEffect as useEffect7, useId as useId6, useLayoutEffect as useLayoutEffect8, useRef as useRef14, useState as useState14 } from "react";
import { Checkbox as Checkbox4, Textarea as Textarea2, Popover as Popover4, PopoverTrigger as PopoverTrigger4, PopoverContent as PopoverContent4, Tip as Tip3 } from "@hermes/plugin-sdk";

// frontend/comment-bubbles.jsx
import { useLayoutEffect as useLayoutEffect7, useRef as useRef11, useState as useState11 } from "react";
function passageGroups(geometry, inline) {
  const result = [];
  for (const position of [...geometry].sort((a, b) => a.top - b.top)) {
    const block = inline ? position.slotBlock ?? position.block : position.block;
    const group = result.find((g) => g.block === block && (inline && block?.tagName === "TABLE" || g.lineGroup === position.lineGroup));
    if (group) {
      group.ids.push(position.id);
      group.members.push(position);
    } else result.push({ ...position, block, ids: [position.id], members: [position] });
  }
  return result;
}
function CommentBubbles({ geometry, header, footer, renderGroup }) {
  const aside = useRef11(null), headerRef = useRef11(null), footerRef = useRef11(null);
  const slots = useRef11(/* @__PURE__ */ new Map()), frame = useRef11(null);
  const gaps = useRef11(/* @__PURE__ */ new Map());
  const paneSize = useRef11(null), resizeFocus = useRef11(null), focusFrame = useRef11(null);
  const settledFocus = useRef11(null);
  const [layout, setLayout] = useState11({ groups: [], footer: 0, header: 0, height: 0, inline: false });
  const latest = useRef11(null);
  latest.current = { geometry, renderGroup };
  const groups = passageGroups(geometry, layout.inline);
  const signature = groups.map((g) => g.ids.join(",")).join(";");
  const groupRefs = useRef11(/* @__PURE__ */ new Map());
  const blockKeys = useRef11(/* @__PURE__ */ new WeakMap()), blockSequence = useRef11(0);
  const blockKey = (block) => {
    if (!blockKeys.current.has(block)) blockKeys.current.set(block, `passage-block-${++blockSequence.current}`);
    return blockKeys.current.get(block);
  };
  const groupKey = (group) => `${blockKey(group.block)}:${group.lineGroup ?? "paragraph"}`;
  useLayoutEffect7(() => {
    const root = aside.current?.closest(".ws-layout"), page = root?.querySelector(".ws-document");
    if (!root || !page) return;
    const view = root.ownerDocument.defaultView;
    const raf = view.requestAnimationFrame?.bind(view) ?? ((fn) => view.setTimeout(fn, 0));
    const caf = view.cancelAnimationFrame?.bind(view) ?? view.clearTimeout.bind(view);
    const pane = root.closest(".ws-work");
    const cancelResizeFocus = () => {
      resizeFocus.current = null;
      caf(focusFrame.current);
      view.clearTimeout(settledFocus.current);
    };
    const revealOwnedFocus = (final) => {
      const target = resizeFocus.current;
      if (final) resizeFocus.current = null;
      if (target?.isConnected && root.ownerDocument.activeElement === target)
        target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    };
    const restore = (block) => {
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
      const editorWidth = editor && view.getComputedStyle(editor).maxWidth;
      if (!inline && editorWidth?.endsWith("px")) {
        const pageStyle = view.getComputedStyle(page);
        root.style.maxWidth = `${parseFloat(editorWidth) + parseFloat(pageStyle.paddingLeft) + parseFloat(pageStyle.paddingRight) + (aside.current?.offsetWidth ?? 300)}px`;
      } else root.style.removeProperty("max-width");
      const base = root.getBoundingClientRect(), pageBounds = page.getBoundingClientRect(), scale = elementScale(root);
      const pane2 = root.closest(".ws-work"), size = pane2 && [pane2.clientWidth, pane2.clientHeight];
      if (size && paneSize.current && size.some((value, index) => value !== paneSize.current[index])) {
        const focused = root.ownerDocument.activeElement;
        if (aside.current?.contains(focused)) resizeFocus.current = focused;
      }
      paneSize.current = size;
      const controlSlot = page.querySelector(".ws-comment-controls-slot");
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      if (controlSlot) controlSlot.style.height = inline ? `${headerHeight + controlsGap}px` : "0px";
      const current = latest.current.geometry;
      const byBlock = passageGroups(current.filter((p) => p.block?.isConnected), inline);
      const used = new Set(inline ? byBlock.filter((g) => g.block.tagName === "TABLE").map((g) => g.block) : []);
      for (const block of slots.current.keys()) if (!used.has(block)) restore(block);
      const gapKeys = new Set(inline ? byBlock.filter((g) => g.block.tagName !== "TABLE").map(groupKey) : []);
      for (const [key, gap] of gaps.current) if (!gapKeys.has(key)) {
        gap.remove();
        gaps.current.delete(key);
      }
      const headerTop = inline && controlSlot ? (controlSlot.getBoundingClientRect().top - base.top) / scale : (pageBounds.top - base.top) / scale + 32;
      let bottom = inline ? 0 : headerTop + headerHeight + 20;
      const positions = [];
      for (const group of byBlock) {
        const key = groupKey(group), height = groupRefs.current.get(key)?.offsetHeight ?? 84;
        let top;
        if (inline && group.block.tagName === "TABLE") {
          let saved = slots.current.get(group.block);
          if (!saved) {
            const property = "marginBottom";
            saved = { property, value: group.block.style[property], base: parseFloat(view.getComputedStyle(group.block)[property]) || 0, allocated: 0 };
            slots.current.set(group.block, saved);
          }
          const allocated = height + 24;
          if (saved.allocated !== allocated) {
            saved.allocated = allocated;
            group.block.style[saved.property] = `${saved.base + allocated}px`;
          }
          top = (group.block.getBoundingClientRect().bottom - base.top) / scale + 8;
        } else if (inline && editor) {
          const ranges = group.members.map((member) => anchorRange(editor, member.anchor)).filter(Boolean);
          const prefixLength = (range2) => {
            const prefix2 = range2.cloneRange();
            prefix2.selectNodeContents(editor);
            prefix2.setEnd(range2.endContainer, range2.endOffset);
            return prefix2.toString().length;
          };
          const range = ranges.sort((a, b) => prefixLength(b) - prefixLength(a))[0];
          if (!range) continue;
          let gap = gaps.current.get(key);
          const prefix = editor.ownerDocument.createRange();
          prefix.selectNodeContents(editor);
          if (gap?.isConnected) prefix.setEndBefore(gap);
          if (!gap?.isConnected || prefix.toString().length !== prefixLength(range)) {
            gap?.remove();
            gap = editor.ownerDocument.createElement("span");
            gap.setAttribute("data-workspace-comment-gap", "");
            gap.setAttribute("contenteditable", "false");
            gap.setAttribute("aria-hidden", "true");
            gap.style.cssText = "display:inline-block;width:0;vertical-align:text-top;user-select:none;pointer-events:none";
            const insertion = range.cloneRange();
            insertion.collapse(false);
            insertion.insertNode(gap);
            gaps.current.set(key, gap);
          }
          const lineHeight = parseFloat(view.getComputedStyle(group.block).lineHeight) || 24;
          const allocated = `${lineHeight + height + 24}px`;
          if (gap.style.height !== allocated) gap.style.height = allocated;
          top = (gap.getBoundingClientRect().top - base.top) / scale + lineHeight + 8;
        } else top = Math.max(group.top, bottom);
        positions.push({ key, ids: group.ids, top });
        bottom = Math.max(bottom, top + height + 12);
      }
      const footerTop = !inline && !byBlock.length ? headerTop + headerHeight + 16 : Math.max((page.getBoundingClientRect().bottom - base.top) / scale, bottom + 12);
      const result = {
        groups: positions,
        footer: footerTop,
        header: headerTop,
        height: footerTop + (footerRef.current?.offsetHeight ?? 0) + 32,
        inline
      };
      root.style.minHeight = `${result.height}px`;
      setLayout((old) => JSON.stringify(old) === JSON.stringify(result) ? old : result);
      if (resizeFocus.current) {
        caf(focusFrame.current);
        view.clearTimeout(settledFocus.current);
        focusFrame.current = raf(() => {
          focusFrame.current = raf(() => {
            revealOwnedFocus(false);
          });
        });
        settledFocus.current = view.setTimeout(() => revealOwnedFocus(true), 100);
      }
    };
    const schedule = () => {
      caf(frame.current);
      frame.current = raf(measure);
    };
    const observer = globalThis.ResizeObserver ? new ResizeObserver(schedule) : null;
    observer?.observe(page);
    observer?.observe(headerRef.current);
    observer?.observe(footerRef.current);
    if (root.closest(".ws-work")) observer?.observe(root.closest(".ws-work"));
    for (const node of groupRefs.current.values()) observer?.observe(node);
    window.addEventListener("resize", schedule);
    pane?.addEventListener("wheel", cancelResizeFocus, { passive: true });
    pane?.addEventListener("pointerdown", cancelResizeFocus, true);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      pane?.removeEventListener("wheel", cancelResizeFocus);
      pane?.removeEventListener("pointerdown", cancelResizeFocus, true);
      caf(frame.current);
      caf(focusFrame.current);
      view.clearTimeout(settledFocus.current);
    };
  }, [geometry, signature, header, footer]);
  useLayoutEffect7(() => () => {
    aside.current?.closest(".ws-layout")?.style.removeProperty("min-height");
    aside.current?.closest(".ws-layout")?.style.removeProperty("max-width");
    for (const [block, saved] of slots.current) {
      block.style[saved.property] = saved.value;
      if (!block.getAttribute("style")) block.removeAttribute("style");
    }
    for (const gap of gaps.current.values()) gap.remove();
  }, []);
  return h(
    "aside",
    { ref: aside, className: `ws-comments ws-bubbles${layout.inline ? " ws-bubbles-inline" : ""}`, "aria-label": "Comments and Hermes thread", style: { minHeight: `${layout.height}px` } },
    h("div", { ref: headerRef, className: "ws-bubble-header", style: { top: layout.header } }, header),
    groups.map((group) => {
      const key = groupKey(group), position = layout.groups.find((g) => g.key === key);
      return h("div", {
        key,
        ref: (node) => {
          if (node) groupRefs.current.set(key, node);
          else groupRefs.current.delete(key);
        },
        className: "ws-bubble-group",
        style: { top: position?.top ?? group.top },
        "aria-label": "Passage discussions"
      }, renderGroup(group.ids));
    }),
    h("div", { ref: footerRef, className: "ws-bubble-footer", style: { top: layout.footer } }, footer)
  );
}

// frontend/thread-picker.jsx
import { useEffect as useEffect5, useId as useId4, useRef as useRef12, useState as useState12 } from "react";
import { SearchField as SearchField4, Dialog as Dialog4, DialogContent as DialogContent4, DialogHeader as DialogHeader4, DialogTitle as DialogTitle4, DialogDescription as DialogDescription4, DialogFooter as DialogFooter4 } from "@hermes/plugin-sdk";
function ThreadPicker({ workflow, itemId, locked, onBound, onClose }) {
  const [rows, setRows] = useState12([]), [query, setQuery] = useState12("");
  const [loading, setLoading] = useState12(true), [busy, setBusy] = useState12(false);
  const [error, setError] = useState12(""), [attempt, setAttempt] = useState12(0);
  const [active, setActive] = useState12(0);
  const alive = useRef12(true), binding = useRef12(false), search = useRef12(null);
  const id = useId4();
  const opener = useRef12(document.activeElement);
  useEffect5(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect5(() => {
    let current2 = true;
    setLoading(true);
    setError("");
    setRows([]);
    Promise.resolve().then(() => workflow.listThreads()).then((result) => {
      if (!current2) return;
      setRows(Array.isArray(result) ? result : result.sessions);
    }).catch((err) => {
      if (current2) setError(errorMessage(err));
    }).finally(() => {
      if (current2) setLoading(false);
    });
    return () => {
      current2 = false;
    };
  }, [workflow, attempt]);
  const matches = rows.filter((row) => String(row.title ?? "").toLocaleLowerCase().includes(query.toLocaleLowerCase()) || row.id.includes(query));
  const choose = async (row) => {
    if (locked || loading || binding.current || row.running || row.pending?.length) return;
    binding.current = true;
    setBusy(true);
    setError("");
    try {
      await workflow.bindThread(itemId, row.id, row);
      if (!alive.current) return;
      await onBound();
      if (alive.current) onClose();
    } catch (err) {
      if (alive.current) setError(errorMessage(err));
    } finally {
      binding.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const current = Math.min(active, Math.max(0, matches.length - 1));
  return h(
    Dialog4,
    { open: true, onOpenChange: (open) => {
      if (!open && !binding.current) onClose();
    } },
    h(
      DialogContent4,
      {
        className: "ws-dialog ws-thread-picker",
        bodyClassName: "ws-thread-picker-body",
        onCloseAutoFocus: (event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus({ preventScroll: true });
          }
        },
        showCloseButton: !busy
      },
      h(
        DialogHeader4,
        null,
        h(DialogTitle4, null, "Select existing thread"),
        h(DialogDescription4, { className: "ws-dialog-description" }, "Recent only; older history is not searched.")
      ),
      h("div", { ref: search }, h(SearchField4, {
        containerClassName: "ws-thread-search",
        "aria-label": "Search recent native threads",
        placeholder: "Search recent threads\u2026",
        value: query,
        loading,
        onChange: (value) => {
          setQuery(value);
          setActive(0);
        },
        onClear: () => {
          setQuery("");
          setActive(0);
        },
        onKeyDown: (event) => {
          if (event.isComposing || event.nativeEvent?.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const next = Math.max(0, Math.min(matches.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
            setActive(next);
            document.getElementById(`${id}-${next}`)?.scrollIntoView?.({ block: "nearest" });
          } else if (isSubmitEnter2(event) && !event.repeat && matches[current]) {
            event.preventDefault();
            void choose(matches[current]);
          }
        }
      })),
      !loading && matches[current] && h(
        "p",
        { role: "status", className: "ws-thread-notice" },
        `${matches.length} recent ${matches.length === 1 ? "match" : "matches"}.`,
        h("span", { className: "sr-only" }, ` Selected: ${matches[current].title || "Untitled thread"}; ${matches[current].id}. Use arrows and Enter, or Tab to a result.`)
      ),
      loading && h("p", { role: "status" }, "Loading native threads\u2026"),
      !loading && !error && !matches.length && h("p", { role: "status" }, query ? "No matching recent threads. Older history has not been searched." : "No recent native threads available."),
      error && h(
        "div",
        { role: "alert" },
        h("p", null, error),
        h(Action, { disabled: busy, onClick: () => setAttempt((n) => n + 1) }, "Reload threads")
      ),
      h(
        "div",
        { className: "ws-thread-results", role: "group", "aria-label": "Recent native threads", "aria-busy": loading || busy },
        matches.map((row, index) => h(
          Action,
          {
            key: row.id,
            id: `${id}-${index}`,
            className: "ws-thread-result",
            variant: index === current ? "secondary" : "ghost",
            disabled: locked || busy || row.running || Boolean(row.pending?.length),
            onFocus: () => setActive(index),
            onClick: () => void choose(row)
          },
          h("span", null, row.title || "Untitled thread"),
          h("small", null, `${row.id}${row.running || row.pending?.length ? " \xB7 Busy" : ""}`)
        ))
      ),
      h(DialogFooter4, null, h(Action, { disabled: busy, onClick: onClose }, "Cancel"))
    )
  );
}

// frontend/comment-styles.mjs
var commentStyles = `
.ws-comment-heading { display:flex; align-items:flex-start; flex-wrap:wrap; gap:0; min-width:0; }
.ws-root .ws-comment-heading > .ws-bubble-summary { flex:1 1 110px; width:auto; min-width:0; padding-right:6px; }
.ws-comment-action-area { flex:0 0 96px; min-width:0; padding:8px 6px 4px 0; }
.ws-comment-actions { display:flex; align-items:center; justify-content:flex-end; gap:4px; }
.ws-comment-actions button, .ws-comment-revert-target { flex:0 0 28px; min-width:28px; width:28px; height:28px; }
.ws-comment-actions .ws-comment-resolve { margin:0; width:24px; height:24px; min-width:24px; border:1px solid var(--ui-text-secondary); }
.ws-comment-revert-target { display:inline-flex; border-radius:var(--radius-sm,4px); }
.ws-comment-revert-target:focus-visible { outline:2px solid var(--ui-accent); outline-offset:2px; }
.ws-comment-action-state { display:block; text-align:right; font-size:10px; line-height:1.5; color:var(--ui-text-secondary); }
.ws-comment-action-area { position:relative; }
.ws-comment-action-reason { display:none; position:absolute; right:0; top:100%; z-index:10; width:min(220px,calc(100vw - 64px)); padding:8px; border:1px solid var(--ui-stroke-secondary); border-radius:var(--radius-sm,4px); background:var(--ui-bg-elevated); color:var(--ui-text-secondary); font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
.ws-comment-action-area:focus-within .ws-comment-action-reason, .ws-comment-action-area:hover .ws-comment-action-reason { display:block; }
.ws-comment-touch-labels { display:none; color:var(--ui-text-secondary); font-size:10px; text-align:right; }
@media (pointer:coarse) {
 .ws-comment-action-area { flex-basis:132px; }
 .ws-comment-actions button, .ws-comment-revert-target { min-width:40px; width:40px; height:40px; }
 .ws-comment-actions .ws-comment-resolve { min-width:32px; width:32px; height:32px; }
 .ws-comment-touch-labels, .ws-comment-action-reason { display:block; }
 .ws-comment-action-reason { position:static; width:auto; border:0; padding:4px 0 0; background:transparent; }
}
.ws-comment-surfaces { display: contents; }
.ws-author { display:inline-flex; align-items:center; gap:6px; min-width:0; max-width:100%; vertical-align:middle; }
.ws-author-avatar { display:inline-flex; flex:0 0 20px; width:20px; height:20px; align-items:center; justify-content:center; border-radius:50%; overflow:hidden; background:var(--ui-bg-elevated); color:var(--ui-text-secondary); font-size:11px; font-weight:600; }
.ws-author-avatar img { width:20px; height:20px; object-fit:cover; }
.ws-author-name { min-width:0; overflow-wrap:anywhere; white-space:normal; text-align:left; color:var(--ui-text-primary); font-size:12px; line-height:1.4; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
.ws-author-disclosure { height:auto; max-width:100%; padding:2px; margin:-2px; justify-content:flex-start; text-align:left; white-space:normal; }
.ws-author-disclosure .ws-author-name { text-decoration:underline dotted; text-underline-offset:3px; }
.ws-author-details { max-width:min(24rem,calc(100vw - 32px)); max-height:min(24rem,60vh); overflow:auto; }
.ws-author-full-name { margin:0 0 8px; white-space:pre-wrap; overflow-wrap:anywhere; color:var(--ui-text-primary); }
.ws-bubble-author { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 8px; width:100%; min-width:0; }
.ws-bubble-author .ws-author { flex:1 1 100px; }
.ws-bubble-author .ws-bubble-context { flex:0 1 auto; }
.ws-username-dialog { width:min(24rem,calc(100% - 24px)); }
.ws-username-dialog input { width:100%; min-width:0; }
.ws-anchor-recovery summary { cursor:pointer; color:var(--ui-text-secondary); }
.ws-anchor-recovery blockquote { margin:8px 0 0; max-height:8rem; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; }
.ws-anchor-recovery summary:focus-visible { outline:2px solid var(--ui-accent); outline-offset:2px; }
.ws-comment .ws-anchor:has(.ws-comment-passage) { border:0; padding:0; margin:4px 0; }
.ws-comment-passage { min-height:28px; }
.ws-comment-compose-heading { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; }
.ws-comment-compose-heading label { flex:1 1 100px; }
.ws-comment-compose-heading button { flex:0 0 auto; color:var(--ui-text-secondary); }
.ws-comment-composer .ws-field textarea { min-height:4rem; max-height:min(12rem,30vh); }
.ws-comment-composer .ws-field textarea::placeholder { color:var(--ui-text-secondary); opacity:1; }
.ws-comment-composer .ws-anchor { max-height:6rem; overflow:auto; }
.ws-comment-composer .ws-anchor p { margin-block:4px; }
.ws-dialog.ws-thread-picker { width:min(36rem,calc(100% - 24px)); max-width:calc(100% - 24px); max-height:calc(100% - 24px); gap:0; }
.ws-thread-picker-body { display:flex; flex-direction:column; gap:8px; min-width:0; overflow:hidden; overscroll-behavior:contain; }
.ws-thread-picker-body > * { flex-shrink:0; }
.ws-thread-picker .ws-thread-search { width:100%; min-width:0; }
.ws-thread-picker .ws-thread-search input { flex:1; min-width:0; width:100%; }
.ws-thread-picker-body > .ws-thread-results { flex:1 1 auto; min-height:0; overflow:auto; max-height:45vh; display:flex; flex-direction:column; gap:4px; }
.ws-thread-result { width:100%; height:auto; text-align:left; white-space:normal; justify-content:flex-start; display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding:6px; }
.ws-thread-result span { overflow-wrap:anywhere; }
.ws-thread-result small { color:var(--ui-text-secondary); overflow-wrap:anywhere; }
.ws-thread-notice { margin:0; color:var(--ui-text-secondary); }
.ws-scope-review-body { display:flex; flex-direction:column; min-height:0; overflow:hidden; gap:10px; }
.ws-scope-review-body > :not(.ws-related-scope) { flex-shrink:0; }
.ws-scope-current { margin:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--ui-text-secondary); }
.ws-related-scope { min-height:0; overflow:auto; overscroll-behavior:contain; }
.ws-related-scope[open] { flex:1 1 auto; }
.ws-related-scope .ws-comment { padding:8px; margin-block:6px; }
`;

// frontend/comment-actions.jsx
import { useId as useId5 } from "react";
import { Checkbox as Checkbox3, Tip as Tip2 } from "@hermes/plugin-sdk";
function ResolveCheckbox({ "data-state": tooltipState, ...props }) {
  return h(Checkbox3, props);
}
function CommentActions({ comment, locked, pending, onResolve, onDelete, onRevert }) {
  const reasonId = useId5(), stateId = useId5();
  const change = comment.section_change;
  const reason = locked ? "This discussion is locked while an operation is active." : pending ? "Wait for the current comment action to finish." : change?.status === "available" ? null : change?.status === "reverted" ? "This section was reverted." : change?.reason ?? "No eligible addressed section is saved for this comment.";
  const disabled = locked || pending;
  const revert = h(Action, {
    variant: "ghost",
    size: "icon-xs",
    disabled: Boolean(reason),
    "aria-label": `Revert changes: ${comment.text}`,
    "aria-describedby": reason ? reasonId : void 0,
    onClick: (event) => {
      if (!reason) onRevert(event.currentTarget);
    }
  }, h(Codicon, { name: "discard", "aria-hidden": true }));
  return h(
    "div",
    { className: "ws-comment-action-area" },
    h(
      "div",
      { className: "ws-comment-actions", role: "group", "aria-label": `Actions for comment ${comment.passageNumber}` },
      h(Tip2, { label: "Resolve" }, h(ResolveCheckbox, {
        className: "ws-checkbox ws-comment-resolve",
        checked: comment.resolved,
        disabled,
        "aria-label": `Resolve: ${comment.text}`,
        "aria-describedby": stateId,
        onCheckedChange: (value) => onResolve(value === true)
      })),
      h(Tip2, { label: "delete comment" }, h(Action, {
        variant: "ghost",
        size: "icon-xs",
        disabled,
        "aria-label": `delete comment: ${comment.text}`,
        onClick: (event) => onDelete(event.currentTarget)
      }, h(Codicon, { name: "trash", "aria-hidden": true }))),
      h(Tip2, { label: "Revert changes" }, change?.status !== "available" ? h("span", {
        className: "ws-comment-revert-target",
        tabIndex: 0,
        "aria-label": `Revert changes unavailable: ${reason}`,
        "aria-describedby": reasonId
      }, revert) : revert)
    ),
    h("span", { id: stateId, className: "ws-comment-action-state" }, comment.resolved ? "Resolved. Uncheck to reopen." : "Open discussion"),
    reason && h("span", { id: reasonId, className: "ws-comment-action-reason" }, reason),
    h("span", { className: "ws-comment-touch-labels", "aria-hidden": true }, "Resolve \xB7 Delete \xB7 Revert")
  );
}

// frontend/identity.jsx
import { createContext, useContext, useEffect as useEffect6, useMemo as useMemo2, useRef as useRef13, useState as useState13 } from "react";
import { host } from "@hermes/plugin-sdk";
import {
  Dialog as Dialog5,
  DialogContent as DialogContent5,
  DialogHeader as DialogHeader5,
  DialogTitle as DialogTitle5,
  DialogDescription as DialogDescription5,
  DialogFooter as DialogFooter5,
  Popover as Popover3,
  PopoverTrigger as PopoverTrigger3,
  PopoverContent as PopoverContent3
} from "@hermes/plugin-sdk";

// frontend/identity.mjs
var MAX_AVATAR_BYTES = 256 * 1024;
function boundedDimensions(bytes, mime) {
  const b = (i) => bytes.charCodeAt(i), le = (i, n) => Array.from({ length: n }, (_, k) => b(i + k) * 2 ** (8 * k)).reduce((a, v) => a + v, 0);
  let width, height;
  if (mime === "image/png" && bytes.length >= 24 && bytes.slice(12, 16) === "IHDR") {
    const be = (i) => b(i) * 2 ** 24 + b(i + 1) * 2 ** 16 + b(i + 2) * 256 + b(i + 3);
    width = be(16);
    height = be(20);
  } else if (mime === "image/webp" && bytes.length >= 30) {
    const kind = bytes.slice(12, 16);
    if (kind === "VP8X") {
      width = le(24, 3) + 1;
      height = le(27, 3) + 1;
    } else if (kind === "VP8 " && bytes.slice(23, 26) === "\x9D*") {
      width = le(26, 2) & 16383;
      height = le(28, 2) & 16383;
    } else if (kind === "VP8L" && b(20) === 47) {
      width = 1 + (le(21, 2) & 16383);
      height = 1 + (le(22, 3) >> 6 & 16383);
    }
  } else if (mime === "image/jpeg") {
    let i = 2;
    while (i + 8 < bytes.length) {
      if (b(i++) !== 255) return false;
      while (b(i) === 255) i++;
      const marker = b(i++);
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      const size = b(i) * 256 + b(i + 1);
      if (size < 2 || i + size > bytes.length) return false;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        height = b(i + 3) * 256 + b(i + 4);
        width = b(i + 5) * 256 + b(i + 6);
        break;
      }
      i += size;
    }
  }
  return width > 0 && height > 0 && width <= 2048 && height <= 2048 && width * height <= 4194304;
}
function avatarData(result) {
  if (result?.found !== true || !Number.isInteger(result.size) || result.size < 12 || result.size > MAX_AVATAR_BYTES) return null;
  if (!["image/png", "image/jpeg", "image/webp"].includes(result.mime) || typeof result.data !== "string") return null;
  const prefix = `data:${result.mime};base64,`;
  if (!result.data.startsWith(prefix) || result.data.length > prefix.length + 4 * Math.ceil(MAX_AVATAR_BYTES / 3)) return null;
  const encoded = result.data.slice(prefix.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return null;
  let bytes;
  try {
    bytes = atob(encoded);
  } catch {
    return null;
  }
  if (bytes.length !== result.size) return null;
  const starts = (...magic) => magic.every((n, i) => bytes.charCodeAt(i) === n);
  const valid = result.mime === "image/png" ? starts(137, 80, 78, 71, 13, 10, 26, 10) : result.mime === "image/jpeg" ? starts(255, 216, 255) : bytes.slice(0, 4) === "RIFF" && bytes.slice(8, 12) === "WEBP";
  return valid && boundedDimensions(bytes, result.mime) ? result.data : null;
}
function createIdentityBridge(client, host5) {
  return async (author) => {
    client.assertCurrent();
    const state = client.snapshot(), source = state?.identity?.source_id;
    const [connectionId, profile] = JSON.parse(client.owner);
    if (!source || author?.kind !== "agent" || author.avatar_eligible !== true || author.source_id !== source || author.profile !== profile) return null;
    const scope = state.scope_id, generation = client.scopeVersion;
    const check = () => {
      client.assertScope(scope);
      if (client.scopeVersion !== generation || client.snapshot()?.identity?.source_id !== source)
        throw new Error("Workspace author source changed.");
    };
    const routes = await host5.profileRoutes();
    check();
    const matches = routes.filter((route2) => route2.connectionId === connectionId && route2.profile === author.profile);
    if (matches.length !== 1) return null;
    const route = Object.freeze({ ...matches[0] });
    const result = await host5.requestProfile(route, "profiles.get_asset", {
      name: author.profile,
      asset: "avatar",
      profile: route.targetProfile
    });
    check();
    return avatarData(result);
  };
}
function authorName(entry) {
  return entry?.author_identity?.name || (entry?.author === "agent" ? "Hermes" : "user");
}

// frontend/identity.jsx
var IdentityContext = createContext(null);
function IdentityProvider({ client, children }) {
  const loadAvatar = useMemo2(() => createIdentityBridge(client, host), [client]);
  return h(IdentityContext.Provider, { value: loadAvatar }, children);
}
function AuthorHeader({ entry }) {
  const loadAvatar = useContext(IdentityContext), author = entry?.author_identity;
  const name = authorName(entry), [loaded, setLoaded] = useState13(null);
  const [open, setOpen] = useState13(false), trigger = useRef13(null), close = useRef13(null);
  const key = JSON.stringify(author);
  const image = loaded && loaded.key === key ? loaded.data : null;
  const pending = Boolean(loadAvatar && author?.kind === "agent" && (!loaded || loaded.key !== key));
  useEffect6(() => {
    let current = true;
    setLoaded(null);
    if (loadAvatar && author?.kind === "agent")
      void loadAvatar(author).then((data) => {
        if (current) setLoaded({ key, data });
      }).catch(() => {
        if (current) setLoaded({ key, data: null });
      });
    return () => {
      current = false;
    };
  }, [loadAvatar, key]);
  const contents = [
    h("span", { className: "ws-author-avatar", "aria-hidden": true, "data-avatar-state": pending ? "loading" : image ? "image" : "fallback" }, image ? h("img", {
      src: image,
      alt: "",
      width: 20,
      height: 20,
      referrerPolicy: "no-referrer",
      onLoad: (e) => {
        if (e.currentTarget.naturalWidth > 2048 || e.currentTarget.naturalHeight > 2048) setLoaded({ key, data: null });
      },
      onError: () => setLoaded({ key, data: null })
    }) : h("span", null, Array.from(name)[0]?.toLocaleUpperCase() || "\u2022")),
    h("strong", { className: "ws-author-name" }, name)
  ];
  if (entry?.author !== "user" && entry?.author !== "agent")
    return h("span", { className: "ws-author", title: name, "aria-busy": pending }, ...contents);
  return h(
    Popover3,
    { open, onOpenChange: setOpen },
    h(
      PopoverTrigger3,
      { asChild: true },
      h(Action, {
        ref: trigger,
        variant: "ghost",
        className: "ws-author ws-author-disclosure",
        "aria-label": `Show full author name: ${name}`,
        "aria-busy": pending,
        onMouseDown: (event) => event.preventDefault()
      }, ...contents)
    ),
    h(
      PopoverContent3,
      {
        className: "ws-author-details",
        align: "start",
        onOpenAutoFocus: (event) => {
          event.preventDefault();
          close.current?.focus({ preventScroll: true });
        },
        onCloseAutoFocus: (event) => {
          event.preventDefault();
          trigger.current?.focus({ preventScroll: true });
        },
        onClick: (event) => event.stopPropagation()
      },
      h("p", { className: "ws-author-full-name" }, name),
      h(Action, { ref: close, variant: "text", onClick: () => setOpen(false), "aria-label": "Close author name" }, "Close")
    )
  );
}
function UsernameDialog({ client, onClose, returnFocus }) {
  const initial = client.snapshot()?.identity?.human?.name ?? "user";
  const [value, setValue] = useState13(initial === "user" ? "" : initial);
  const [busy, setBusy] = useState13(false), [error, setError] = useState13("");
  const pending = useRef13(false), opener = useRef13(returnFocus ?? document.activeElement);
  const save = async (name) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await client.command("set_username", { name });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return h(
    Dialog5,
    { open: true, onOpenChange: (open) => {
      if (!open && !pending.current) onClose();
    } },
    h(
      DialogContent5,
      {
        className: "ws-dialog ws-username-dialog",
        style: { width: "min(24rem,calc(100% - 24px))" },
        showCloseButton: !busy,
        onCloseAutoFocus: (e) => {
          e.preventDefault();
          if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
        }
      },
      h(
        DialogHeader5,
        null,
        h(DialogTitle5, null, "Set username"),
        h(DialogDescription5, null, "Shown on your comments and replies. Leave blank to use user.")
      ),
      h(
        "form",
        {
          onSubmit: (e) => {
            e.preventDefault();
            void save(value);
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" && !isSubmitEnter2(e)) e.preventDefault();
          }
        },
        h("label", { className: "ws-field" }, "Username", h(Input, {
          value,
          disabled: busy,
          "aria-label": "Username",
          "aria-invalid": Boolean(error),
          "aria-describedby": error ? "ws-username-error" : void 0,
          autoComplete: "off",
          onChange: (e) => setValue(e.target.value)
        })),
        error && h("p", { id: "ws-username-error", role: "alert" }, error),
        h(
          DialogFooter5,
          { className: "ws-dialog-footer" },
          h(Action, { disabled: busy, onClick: () => void save("") }, "Reset to user"),
          h(Action, { disabled: busy, onClick: onClose }, "Cancel"),
          h(Action, { type: "submit", disabled: busy }, busy ? "Saving\u2026" : "Save")
        )
      )
    )
  );
}

// frontend/comments.jsx
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
  retainReply = () => {
  },
  onResolutionFinished = () => {
  },
  onRevertSection = () => {
  },
  showContext = true,
  originalAnchor = comment.anchor,
  onDelete = () => {
  },
  onReplyPending = () => true
}) {
  const [reply, setReply] = useState14(retainedReply), [busy, setBusy] = useState14(false), [replyOpen, setReplyOpen] = useState14(Boolean(retainedReply));
  const replying = useRef14(false);
  const location = locateAnchor(text, comment.anchor);
  return h(
    "article",
    {
      id: `ws-discussion-${comment.id}`,
      className: `ws-comment${active ? " ws-comment-active" : ""}`,
      tabIndex: -1,
      "aria-label": comment.text,
      onFocusCapture: () => onActivate(comment.id),
      onClick: () => onActivate(comment.id)
    },
    showContext && h(
      "div",
      { className: "ws-comment-meta" },
      h(
        "strong",
        null,
        h(AuthorHeader, { entry: comment }),
        passageNumber ? ` \xB7 Comment ${passageNumber}` : ""
      ),
      h(
        "span",
        { className: "ws-muted" },
        comment.resolved ? "Resolved" : "Open discussion"
      )
    ),
    comment.anchor ? h(
      "div",
      { className: "ws-anchor" },
      location.status === "attached" && h(
        Action,
        {
          className: "ws-comment-passage",
          variant: "text",
          style: { color: "var(--ui-text-secondary)" },
          "aria-label": `Show passage for comment ${passageNumber}`,
          onClick: () => onPassage(comment.id, comment.anchor)
        },
        `Show passage ${passageNumber}`
      ),
      location.status === "detached" && h(
        "div",
        null,
        h("p", { role: "status" }, "The original text is missing or ambiguous. This comment has not been attached elsewhere."),
        originalAnchor?.quote && h(
          "details",
          { className: "ws-anchor-recovery" },
          h("summary", null, "Show original excerpt"),
          h("blockquote", null, originalAnchor.quote)
        )
      )
    ) : h("span", { className: "ws-muted" }, state.items.find((item) => item.id === comment.item_id)?.kind === "database" ? "Whole database" : "Whole page"),
    h("p", null, comment.text),
    comment.target_item_ids?.length > 0 && h(
      "div",
      { "aria-label": "Named edit targets" },
      h(
        "span",
        { className: "ws-muted" },
        "Referenced items; fresh run approval required: "
      ),
      comment.target_item_ids.map(
        (id) => h(
          "span",
          { key: id, className: "ws-target" },
          itemLabel(state.items.find((i) => i.id === id), state.items, state.attachments)
        )
      )
    ),
    comment.replies.map(
      (reply2) => h(
        "div",
        { className: "ws-reply", key: reply2.id },
        h(AuthorHeader, { entry: reply2 }),
        h("p", null, reply2.text)
      )
    ),
    h(
      "details",
      { className: "ws-reply-compose", open: replyOpen, onToggle: (event) => setReplyOpen(event.currentTarget.open) },
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
          }
        },
        h(Textarea2, {
          "aria-label": `Reply to ${comment.text}`,
          placeholder: "Reply\u2026",
          value: reply,
          disabled: locked || busy,
          onChange: (e) => {
            setReply(e.target.value);
            retainReply(comment.id, e.target.value);
          }
        }),
        h(
          Action,
          { type: "submit", disabled: locked || busy || !reply.trim() },
          "Reply"
        ),
        reply && h(Action, { variant: "text", style: { color: "var(--ui-text-secondary)" }, disabled: busy, onClick: (event) => {
          setReply("");
          retainReply(comment.id, "");
          event.currentTarget.closest("form")?.querySelector("textarea")?.focus();
        } }, "Discard reply")
      )
    )
  );
}
function Comments({
  item,
  state,
  text,
  anchor,
  setAnchor,
  activeComment,
  setActiveComment,
  showResolved = false,
  setShowResolved = () => {
  },
  returnToEditor = () => {
  },
  onPassage = () => {
  },
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
  setHoveredComment = () => {
  },
  onRevertSection = () => {
  }
}) {
  const retained = useRef14(draftBuffer?.read()?.draft ?? {});
  const composerId = useId6();
  const resolvedControl = useRef14(null);
  const resolvedAction = useRef14(null), composeFromOptions = useRef14(false);
  const [optionsOpen, setOptionsOpen] = useState14(false);
  const [deleting, setDeleting] = useState14(null);
  const deletedIds = useRef14(/* @__PURE__ */ new Set());
  const mutationInFlight = useRef14(false), composing = useRef14(false);
  const actionInFlight = useRef14(/* @__PURE__ */ new Set());
  const [pendingActions, setPendingActions] = useState14(/* @__PURE__ */ new Set());
  const commentAction = async (comment, work) => {
    if (locked || busy || mutationInFlight.current || actionInFlight.current.has(comment.id)) return;
    actionInFlight.current.add(comment.id);
    setPendingActions(new Set(actionInFlight.current));
    try {
      await work();
    } catch (error) {
      onError(error);
    } finally {
      actionInFlight.current.delete(comment.id);
      setPendingActions(new Set(actionInFlight.current));
    }
  };
  const revealFrame = useRef14(null);
  const saveViewport = useRef14(null);
  useEffect7(() => () => {
    window.cancelAnimationFrame?.(revealFrame.current);
    saveViewport.current?.stop();
  }, []);
  const retainSaveViewport = () => {
    saveViewport.current?.stop();
    const pane = composer.current?.closest(".ws-work");
    if (!pane) return;
    const view = pane.ownerDocument.defaultView, doc = pane.ownerDocument;
    const saved = { pane, top: pane.scrollTop, left: pane.scrollLeft, frame: null };
    saved.restore = () => {
      if (saveViewport.current === saved && pane.isConnected) {
        pane.scrollTop = saved.top;
        pane.scrollLeft = saved.left;
      }
    };
    saved.stop = () => {
      view.cancelAnimationFrame(saved.frame);
      for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) doc.removeEventListener(type, saved.stop, true);
      if (saveViewport.current === saved) saveViewport.current = null;
    };
    for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) doc.addEventListener(type, saved.stop, { capture: true, passive: true });
    saveViewport.current = saved;
  };
  useLayoutEffect8(() => {
    const saved = saveViewport.current;
    if (!saved) return;
    saved.restore();
    if (!busy) {
      window.cancelAnimationFrame(saved.frame);
      saved.frame = window.requestAnimationFrame(() => {
        saved.restore();
        saved.frame = window.requestAnimationFrame(() => {
          saved.restore();
          saved.stop();
        });
      });
    }
  });
  const [resolutionFocus, setResolutionFocus] = useState14(null);
  const discussion = useRef14({
    text: typeof retained.current.text === "string" ? retained.current.text : "",
    targets: Array.isArray(retained.current.targets) ? retained.current.targets.filter((id) => typeof id === "string") : [],
    anchor: retained.current.anchor ?? null,
    replies: Object.fromEntries(Object.entries(retained.current.replies ?? {}).filter(([, value]) => typeof value === "string"))
  });
  const retentionError = useRef14(null), [hasDraft, setHasDraft] = useState14(Boolean(draftBuffer?.read()));
  const persist = (patch) => {
    discussion.current = { ...discussion.current, ...patch };
    const saved = discussion.current, meaningful = Boolean(saved.text || saved.targets.length || saved.anchor || Object.values(saved.replies).some(Boolean));
    setHasDraft(meaningful);
    try {
      if (meaningful) draftBuffer?.put(saved);
      else draftBuffer?.discard();
      retentionError.current = null;
    } catch (err) {
      retentionError.current = err;
      onError(err);
    }
  };
  const retainReply = (id, value) => persist({ replies: { ...discussion.current.replies, [id]: value } });
  const [draft, setDraft] = useState14(discussion.current.text), [busy, setBusy] = useState14(false), [threads, setThreads] = useState14(false), [targets, setTargets] = useState14(discussion.current.targets);
  const composer = useRef14(null), focusWholePage = useRef14(false);
  const wholeScopeAction = useRef14(null);
  const transferComposerFocus = useRef14(false);
  const composerOwnsFocus = useRef14(false);
  const composerAnchor = useRef14(anchor), focusComposerOnMount = useRef14(Boolean(anchor));
  if (composerAnchor.current !== anchor) {
    composerAnchor.current = anchor;
    focusComposerOnMount.current = Boolean(anchor);
  }
  const mountComposer = useCallback3((node) => {
    const previous = composer.current;
    if (!node && (previous?.closest("form")?.contains(document.activeElement) || composerOwnsFocus.current && document.activeElement === document.body)) transferComposerFocus.current = true;
    composer.current = node;
    if (node && (transferComposerFocus.current || focusComposerOnMount.current || focusWholePage.current)) {
      transferComposerFocus.current = false;
      focusComposerOnMount.current = false;
      node.focus({ preventScroll: true });
      window.cancelAnimationFrame?.(revealFrame.current);
      revealFrame.current = window.requestAnimationFrame?.(() => {
        if (node.isConnected && node === document.activeElement)
          node.closest("form")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      });
    }
  }, []);
  useEffect7(() => {
    if (JSON.stringify(discussion.current.anchor) !== JSON.stringify(anchor ?? null)) persist({ anchor: anchor ?? null });
    if (anchor || focusWholePage.current) composer.current?.focus({ preventScroll: true });
    focusWholePage.current = false;
  }, [anchor]);
  useEffect7(() => registerFlush?.(async () => {
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
      (window.requestAnimationFrame ?? ((fn) => setTimeout(fn, 0)))(() => wholeScopeAction.current?.focus());
  };
  const composeWholePage = () => {
    focusWholePage.current = true;
    setPageComposerOpen(true);
    setAnchor(null);
    (window.requestAnimationFrame ?? ((fn) => setTimeout(fn, 0)))(() => {
      composer.current?.focus();
      focusWholePage.current = false;
    });
  };
  const currentCommentIds = new Set(state.comments.map((c) => c.id));
  for (const id of deletedIds.current) if (!currentCommentIds.has(id)) deletedIds.current.delete(id);
  const all = numberComments(state.comments.filter((c) => c.item_id === item.id && !deletedIds.current.has(c.id))).map((c) => ({ ...c, originalAnchor: c.anchor, anchor: commentAnchor(c) }));
  const [pageComposerOpen, setPageComposerOpen] = useState14(Boolean(discussion.current.text || discussion.current.targets.length));
  useEffect7(() => {
    const reply = all.find((c) => discussion.current.replies[c.id]);
    if (reply && !activeComment) setActiveComment(reply.id);
  }, []);
  const unresolved = all.filter((c) => !c.resolved);
  useLayoutEffect8(() => {
    if (!resolutionFocus) return;
    setResolutionFocus(null);
    const { id, card, control } = resolutionFocus;
    if (document.activeElement !== document.body && !card?.contains(document.activeElement)) return;
    const visible2 = visibleComments(all, showResolved), remaining = new Set(visible2.map((c) => c.id));
    const current = remaining.has(id) && (document.getElementById(`ws-discussion-${id}`) ?? document.getElementById(`ws-bubble-${id}`));
    if (current) {
      (control?.isConnected && !control.disabled ? control : current).focus();
      return;
    }
    const index = all.findIndex((c) => c.id === id);
    const next = [...all.slice(index + 1), ...all.slice(0, index).reverse()].find((c) => remaining.has(c.id));
    if (!next) {
      (resolvedAction.current ?? resolvedControl.current)?.focus();
      return;
    }
    const bubble2 = document.getElementById(`ws-bubble-${next.id}`);
    if (bubble2) bubble2.focus();
    else {
      setActiveComment(next.id);
      (window.requestAnimationFrame ?? ((fn) => setTimeout(fn, 0)))(() => {
        if (document.activeElement === document.body || card?.contains(document.activeElement))
          (document.getElementById(`ws-bubble-${next.id}`) ?? resolvedAction.current ?? resolvedControl.current)?.focus();
      });
    }
  }, [resolutionFocus, all, showResolved]);
  const submit = async (e) => {
    e.preventDefault();
    if (locked || busy || mutationInFlight.current || composing.current || !discussion.current.text.trim()) return;
    mutationInFlight.current = true;
    const sent = { text: discussion.current.text, targets: [...discussion.current.targets], anchor: anchor ?? null };
    retainSaveViewport();
    setBusy(true);
    try {
      await command("add_comment", {
        item_id: item.id,
        text: sent.text,
        target_item_ids: sent.targets,
        ...sent.anchor ? { anchor: sent.anchor } : {}
      });
      if (discussion.current.text === sent.text && JSON.stringify(discussion.current.anchor) === JSON.stringify(sent.anchor)) {
        setDraft("");
        setTargets([]);
        setAnchor(null);
        persist({ text: "", targets: [], anchor: null });
        returnToEditor();
      }
    } catch (error) {
      onError(error);
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  };
  const composerElement = h(
    "form",
    {
      className: `ws-comment-composer${anchor ? " ws-comment-composer-anchored" : ""}`,
      onFocusCapture: () => {
        composerOwnsFocus.current = true;
      },
      onBlurCapture: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) composerOwnsFocus.current = false;
      },
      onKeyDown: (e) => {
        if (e.key === "Escape" && !busy && !composing.current && !e.isComposing && !e.nativeEvent?.isComposing) {
          e.preventDefault();
          cancel();
        }
      },
      onSubmit: submit
    },
    h(
      "div",
      { className: "ws-field" },
      h(
        "div",
        { className: "ws-comment-compose-heading" },
        h("label", { htmlFor: composerId }, anchor ? "Comment on selection" : item.kind === "database" ? "Whole-database comment" : "Whole-page comment"),
        h(Action, { variant: "text", style: { color: "var(--ui-text-secondary)" }, disabled: busy, onClick: cancel }, "Cancel comment")
      ),
      anchor && h(
        "div",
        { className: "ws-anchor" },
        `\u201C${anchor.quote}\u201D`,
        locateAnchor(text, anchor).status === "detached" && h("p", { role: "status" }, "This passage changed. Your feedback is retained; choose a new passage or use the whole page."),
        h(
          Action,
          { variant: "text", style: { color: "var(--ui-text-secondary)" }, onClick: composeWholePage },
          "Use whole page"
        )
      ),
      h(Textarea2, {
        id: composerId,
        ref: mountComposer,
        "aria-label": "New comment",
        value: draft,
        disabled: locked || busy,
        onCompositionStart: () => {
          composing.current = true;
        },
        onCompositionEnd: () => {
          composing.current = false;
        },
        onKeyDown: (event) => {
          if (event.key !== "Enter" || !event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
          if (composing.current || !isSubmitEnter2(event)) return;
          if (event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          if (event.repeat || locked || busy || mutationInFlight.current) return;
          event.currentTarget.form?.requestSubmit();
        },
        placeholder: anchor ? "Describe the requested change\u2026" : item.kind === "database" ? "Leave feedback on this database\u2026" : "Leave feedback on this page\u2026",
        onChange: (e) => {
          setDraft(e.target.value);
          persist({ text: e.target.value });
        }
      })
    ),
    h(
      Tip3,
      { label: "Add comment (Ctrl+Enter)" },
      h(
        Action,
        { type: "submit", disabled: locked || busy || !draft.trim() },
        busy ? "Adding comment\u2026" : "Add comment",
        h(Codicon, { name: "arrow-right", "aria-hidden": true })
      )
    )
  );
  const visible = visibleComments(all, showResolved);
  const attached = new Set(geometry.map((p) => p.id));
  const select = (id) => {
    setActiveComment(id);
    (window.requestAnimationFrame ?? ((fn) => setTimeout(fn, 0)))(() => document.getElementById(`ws-discussion-${id}`)?.focus({ preventScroll: true }));
  };
  const bubble = (comment, grouped = false) => {
    const number = comment.passageNumber;
    const selected = activeComment === comment.id;
    const detached = comment.anchor && !attached.has(comment.id);
    const context = `Comment ${number}${comment.anchor ? detached ? " \xB7 Detached" : "" : item.kind === "database" ? " \xB7 Whole database" : " \xB7 Whole page"}`;
    return h(
      "section",
      {
        key: comment.id,
        className: `ws-bubble${selected ? " ws-bubble-selected" : ""}${hoveredComment === comment.id ? " ws-bubble-emphasis" : ""}`,
        onPointerEnter: () => setHoveredComment(comment.id),
        onPointerLeave: () => setHoveredComment(null),
        onFocusCapture: () => setHoveredComment(comment.id),
        onBlurCapture: (event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHoveredComment(null);
        }
      },
      h(
        "div",
        { className: "ws-comment-heading" },
        h(
          Action,
          {
            id: `ws-bubble-${comment.id}`,
            className: "ws-bubble-summary",
            variant: "ghost",
            "aria-expanded": selected,
            "aria-label": `${context}: ${comment.text} \xB7 ${authorName(comment)} \xB7 ${selected ? "Collapse thread" : "Open thread"}`,
            "aria-controls": selected ? `ws-discussion-${comment.id}` : void 0,
            onClick: () => selected ? setActiveComment(null) : select(comment.id)
          },
          h(
            "span",
            { className: "ws-bubble-author" },
            h(AuthorHeader, { entry: comment }),
            h("span", { className: "ws-bubble-context" }, `${!grouped ? context : `Comment ${number}`}${comment.resolved ? " \xB7 Resolved" : ""}`)
          ),
          !selected && h("span", { className: "ws-bubble-preview" }, comment.text),
          h("span", { className: "ws-bubble-context" }, `${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"} \xB7 ${selected ? "Collapse thread" : "Open thread"}${discussion.current.replies[comment.id] ? " \xB7 Draft reply" : ""}`)
        ),
        h(CommentActions, {
          comment,
          locked: locked || busy,
          pending: pendingActions.has(comment.id),
          onResolve: (resolved) => {
            const card = document.getElementById(`ws-discussion-${comment.id}`) ?? document.getElementById(`ws-bubble-${comment.id}`)?.closest("section");
            const control = document.activeElement, ownedFocus = card?.contains(control);
            return commentAction(comment, async () => {
              try {
                await command("resolve_comment", { id: comment.id, resolved });
              } finally {
                if (ownedFocus) setResolutionFocus({ id: comment.id, card, control });
              }
            });
          },
          onDelete: (opener) => {
            if (!locked && !busy && !actionInFlight.current.has(comment.id)) setDeleting({ comment, opener });
          },
          onRevert: (opener) => commentAction(comment, () => onRevertSection(comment, opener))
        })
      ),
      selected && h(Comment, {
        comment,
        text,
        command,
        locked: locked || pendingActions.has(comment.id),
        onError,
        state,
        retainedReply: discussion.current.replies[comment.id] ?? "",
        retainReply,
        onReplyPending: (value) => {
          if (value && actionInFlight.current.has(comment.id)) return false;
          if (value) actionInFlight.current.add(comment.id);
          else actionInFlight.current.delete(comment.id);
          setPendingActions(new Set(actionInFlight.current));
          return true;
        },
        passageNumber: number,
        originalAnchor: comment.originalAnchor,
        active: true,
        onActivate: setActiveComment,
        onPassage,
        onResolutionFinished: setResolutionFocus,
        onDelete: (comment2, opener) => setDeleting({ comment: comment2, opener }),
        onRevertSection,
        showContext: false
      })
    );
  };
  const linkedThread = h(
    "details",
    { className: "ws-linked-thread" },
    h("summary", null, "Linked Hermes thread"),
    h(
      "p",
      { className: "ws-muted" },
      item.thread_id ? `Native thread: ${item.thread_id}` : "A native thread will be created on the first run and reused."
    ),
    h(
      "div",
      { className: "ws-actions" },
      h(
        Action,
        {
          disabled: !item.thread_id || busy,
          onClick: () => void workflow.openThread(item.thread_id).catch((error) => onError(error, { operation: "openThread" }))
        },
        "Open thread"
      ),
      h(
        Action,
        {
          disabled: locked || busy,
          onClick: () => setThreads(true)
        },
        "Select existing thread"
      )
    ),
    threads && h(ThreadPicker, {
      workflow,
      itemId: item.id,
      locked,
      onBound: onRefresh,
      onClose: () => setThreads(false)
    }),
    run && h(
      "p",
      { role: "status" },
      `Run ${run.status}${run.error ? `: ${run.error}` : ""}`
    )
  );
  const header = h(
    "div",
    null,
    h(
      "div",
      { className: "ws-comments-heading" },
      h("h2", null, "Comments"),
      h(
        "span",
        {
          className: "ws-comment-count",
          "aria-label": `${unresolved.length} unresolved comments`
        },
        String(unresolved.length)
      )
    ),
    !all.length ? h(Action, {
      ref: wholeScopeAction,
      disabled: locked || busy,
      "aria-label": item.kind === "database" ? "Add database comment" : "Add whole-page comment",
      onClick: composeWholePage
    }, item.kind === "database" ? "Add database comment" : "Add whole-page comment") : h(
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
          }
        },
        `Address (${unresolved.length})`
      ) : h(Action, {
        ref: resolvedAction,
        variant: "text",
        style: { color: "var(--ui-text-secondary)" },
        onClick: () => setShowResolved(!showResolved)
      }, `${showResolved ? "Hide" : "Show"} resolved (${all.length})`)
    ),
    all.length > 0 && h(
      Popover4,
      { open: optionsOpen, onOpenChange: setOptionsOpen },
      h(PopoverTrigger4, { asChild: true }, h(Action, { ref: resolvedControl, variant: "ghost", size: "icon-xs", "aria-label": "Comment options" }, h(Codicon, { name: "ellipsis" }))),
      h(
        PopoverContent4,
        {
          align: "end",
          className: "ws-comment-options",
          onCloseAutoFocus: (event) => {
            if (composeFromOptions.current) {
              event.preventDefault();
              composeFromOptions.current = false;
            }
          }
        },
        h("label", { className: "ws-check" }, h(Checkbox4, {
          className: "ws-checkbox",
          "aria-label": "Show resolved comments",
          checked: showResolved,
          onCheckedChange: (value) => setShowResolved(value === true)
        }), "Show resolved comments"),
        h(Action, {
          variant: "text",
          style: { color: "var(--ui-text-secondary)" },
          disabled: locked || busy,
          "aria-label": item.kind === "database" ? "Add database comment" : "Add whole-page comment",
          onClick: () => {
            composeFromOptions.current = true;
            setOptionsOpen(false);
            composeWholePage();
          }
        }, item.kind === "database" ? "Comment on database" : "Comment on whole page")
      )
    ),
    hasDraft && h("p", { className: "ws-muted ws-discussion-draft", role: "status" }, "Unsubmitted feedback is retained for this Workspace."),
    linkedThread
  );
  const footer = h(
    "div",
    null,
    visible.some((c) => !c.anchor) && h("h2", null, item.kind === "database" ? "Database feedback" : "Page feedback"),
    visible.filter((c) => !c.anchor).map((comment) => bubble(comment)),
    visible.some((c) => c.anchor && !attached.has(c.id)) && h("h2", null, "Detached passages"),
    visible.filter((c) => c.anchor && !attached.has(c.id)).map((comment) => bubble(comment)),
    anchor && locateAnchor(text, anchor).status !== "attached" && !attached.has("__workspace-comment-draft") && composerElement,
    !anchor && (pageComposerOpen ? composerElement : all.length > 0 && h(Action, { ref: wholeScopeAction, disabled: locked || busy, onClick: composeWholePage }, item.kind === "database" ? "Comment on database" : "Comment on whole page")),
    !all.length && h("p", { className: "ws-muted" }, item.kind === "database" ? "No comments yet." : "Select a passage to add a comment beside it.")
  );
  return h(
    "div",
    { className: "ws-comment-surfaces" },
    h("style", null, commentStyles),
    deleting && h(FormDialog, {
      title: "Delete comment?",
      confirm: "Delete comment",
      destructive: true,
      description: "This deletes this discussion and all its replies. Document text and saved section history are kept. Agent edits will not be reverted.",
      returnFocus: deleting.opener,
      submitDisabled: locked,
      onClose: () => setDeleting(null),
      onSuccessFocus: () => {
        const next = all.find((c) => c.id !== deleting.comment.id && (!c.resolved || showResolved));
        if (next) {
          setActiveComment(next.id);
          requestAnimationFrame(() => document.getElementById(`ws-bubble-${next.id}`)?.focus());
        } else {
          setActiveComment(null);
          (resolvedControl.current ?? wholeScopeAction.current)?.focus();
        }
      },
      onSubmit: async () => {
        if (locked || busy || mutationInFlight.current || actionInFlight.current.size) throw new Error("Wait for the current operation before deleting this comment.");
        mutationInFlight.current = true;
        setBusy(true);
        try {
          await command("delete_comment", { id: deleting.comment.id });
          deletedIds.current.add(deleting.comment.id);
          const replies = { ...discussion.current.replies };
          delete replies[deleting.comment.id];
          persist({ replies });
          if (activeComment === deleting.comment.id) setActiveComment(null);
          if (hoveredComment === deleting.comment.id) setHoveredComment(null);
        } finally {
          mutationInFlight.current = false;
          setBusy(false);
        }
      }
    }),
    h(CommentBubbles, {
      geometry: geometry.filter((p) => !deletedIds.current.has(p.id)),
      header,
      footer,
      renderGroup: (ids) => {
        const comments = ids.map((id) => visible.find((c) => c.id === id)).filter(Boolean);
        return h(
          "div",
          null,
          ids.includes("__workspace-comment-draft") && h("div", { className: "ws-bubble ws-bubble-selected" }, composerElement),
          ...comments.map((comment) => bubble(comment))
        );
      }
    })
  );
}

// frontend/workflow.js
import { host as host2, gatewayActivationEpoch } from "@hermes/plugin-sdk";
function createWorkflowAdapter(ctx) {
  let disposed = false;
  const owners = /* @__PURE__ */ new Map();
  const creations = /* @__PURE__ */ new Map();
  let threadSelections = /* @__PURE__ */ new WeakMap();
  const selectedOwner = () => {
    const owner = { connectionId: host2.activeConnectionId(), profile: host2.state.profile.get() };
    if (!owner?.connectionId || !owner?.profile) throw new Error("Select a native Hermes profile first.");
    return { connectionId: owner.connectionId, profile: owner.profile };
  };
  const capture = () => ({ epoch: gatewayActivationEpoch(), owner: selectedOwner() });
  const check = (token) => {
    const now = selectedOwner();
    if (disposed || token.epoch !== gatewayActivationEpoch() || now.connectionId !== token.owner.connectionId || now.profile !== token.owner.profile)
      throw new Error("Hermes profile or connection changed. Reopen Workspace before continuing.");
  };
  const routeFor = async (token) => {
    const routes = await host2.profileRoutes();
    check(token);
    const matches = routes.filter((r) => r.connectionId === token.owner.connectionId && r.profile === token.owner.profile);
    if (matches.length !== 1) throw new Error("The selected Hermes profile route is unavailable or ambiguous.");
    return Object.freeze({ ...matches[0] });
  };
  const rpc = async (token, route, method, params) => {
    check(token);
    const result = await host2.requestProfile(route, method, { ...params, profile: route.targetProfile });
    check(token);
    return result;
  };
  const post = async (token, path, body) => {
    check(token);
    if (!token.scope_id) throw new Error("Workspace scope must be loaded before a mutation.");
    const result = await ctx.rest(path, { method: "POST", body: { ...body, expected_scope: token.scope_id } });
    check(token);
    return result;
  };
  const loadScope = async (token) => {
    check(token);
    const response = await ctx.rest("/state");
    check(token);
    const state = response.state ?? response;
    if (!state.scope_id) throw new Error("Workspace storage scope unavailable.");
    token.scope_id = state.scope_id;
    return state;
  };
  const snapshot = async (token, route, threadId) => {
    const result = await rpc(token, route, "session.resume", { session_id: threadId, omit_messages: true });
    if (result.info?.desktop_protocol !== "hermes-gateway-v1" || !result.stored_session_id)
      throw new Error("Workspace requires the native Hermes gateway session lifecycle.");
    if (result.running || result.pending?.length) throw new Error("This Hermes thread is busy. Wait or select another thread.");
    return result;
  };
  const adapter = {
    async listThreads() {
      const token = capture();
      const route = await routeFor(token);
      const live = await rpc(token, route, "session.list", { scope: "live", include_hidden: false });
      const stored = await rpc(token, route, "session.list", { scope: "stored", include_hidden: false });
      if (!Array.isArray(live.sessions) || !Array.isArray(stored.sessions))
        throw new Error("Native Hermes thread list is unavailable.");
      const threads = /* @__PURE__ */ new Map();
      for (const row of [...live.sessions, ...stored.sessions]) {
        const id = row?.stored_session_id ?? row?.session_id ?? row?.id;
        if (typeof id !== "string" || !id) throw new Error("Native Hermes thread identity is unavailable.");
        if (!threads.has(id)) {
          const selection = Object.freeze({ ...row, id });
          threadSelections.set(selection, { token, route });
          threads.set(id, selection);
        }
      }
      return [...threads.values()];
    },
    async bindThread(itemId, threadId, selection = null) {
      const saved = selection && threadSelections.get(selection);
      if (selection && (!saved || selection.id !== threadId))
        throw new Error("Reopen the native thread picker before linking this thread.");
      const token = saved?.token ?? capture();
      check(token);
      const route = saved?.route ?? await routeFor(token);
      await loadScope(token);
      const session = await snapshot(token, route, threadId);
      return post(token, "/workflow/bind", { item_id: itemId, thread_id: session.stored_session_id });
    },
    async addressComments(itemId, explicitItemIds = [], confirmedReview = null) {
      if (!Array.isArray(explicitItemIds) || explicitItemIds.some((id) => typeof id !== "string") || new Set(explicitItemIds).size !== explicitItemIds.length)
        throw new Error("Select valid Workspace targets for this run.");
      const targets = [...explicitItemIds];
      const token = capture();
      const route = await routeFor(token);
      const state = await loadScope(token);
      const item = state.items?.find((row) => row.id === itemId);
      if (!item) throw new Error("Workspace item is unavailable.");
      let reviewId;
      if (confirmedReview) {
        if (confirmedReview.scope_id !== state.scope_id || confirmedReview.revision !== state.revision)
          throw new Error("Workspace changed. Close and review this run again.");
        const reviewed = await post(token, "/workflow/review-scope", {
          item_id: itemId,
          selected_item_ids: targets,
          expected_revision: confirmedReview.revision
        });
        if (!reviewed || typeof reviewed.review_id !== "string" || !reviewed.review_id || reviewed.scope_id !== state.scope_id || reviewed.item_id !== itemId || reviewed.revision !== state.revision || !Array.isArray(reviewed.selected_item_ids) || JSON.stringify([...reviewed.selected_item_ids].sort()) !== JSON.stringify([...targets].sort()))
          throw new Error("Workspace could not verify this run review. Close and review again.");
        reviewId = reviewed.review_id;
      } else {
        const referenced = new Set(state.comments?.filter((c) => c.item_id === itemId && !c.resolved).flatMap((c) => c.target_item_ids ?? []) ?? []);
        if (targets.some((id) => !referenced.has(id)))
          throw new Error("These related items cannot be approved for this run. Your comments are unchanged.");
      }
      let session;
      if (item.thread_id) session = await snapshot(token, route, item.thread_id);
      else {
        const key = `${token.scope_id}:${itemId}`;
        const requestId = creations.get(key) || `workspace-${crypto.randomUUID()}`;
        creations.set(key, requestId);
        session = await rpc(token, route, "session.create", { source: "gui", title: `Workspace: ${String(item.title).slice(0, 100)} (${requestId})`, request_id: requestId });
        if (session.info?.desktop_protocol !== "hermes-gateway-v1") throw new Error("Native Hermes gateway required.");
      }
      const prepared = await post(token, "/workflow/prepare", {
        item_id: itemId,
        session_id: session.stored_session_id,
        explicit_item_ids: targets,
        ...reviewId ? { review_id: reviewId } : {}
      });
      owners.set(prepared.run.id, { token, route });
      creations.delete(`${token.scope_id}:${itemId}`);
      await rpc(token, route, "prompt.submit", { session_id: session.session_id, text: prepared.prompt, submission_id: prepared.submission_id, queued: true });
      await post(token, "/workflow/consume", { run_id: prepared.run.id });
      return (await post(token, "/workflow/status", { run_id: prepared.run.id })).run;
    },
    async status(run) {
      const token = owners.get(run.id)?.token || capture();
      if (!token.scope_id) await loadScope(token);
      if (!["completed", "cancelled", "error"].includes(run.status))
        await post(token, "/workflow/consume", { run_id: run.id });
      return (await post(token, "/workflow/status", { run_id: run.id })).run;
    },
    async stop(run) {
      const saved = owners.get(run.id);
      const token = saved?.token || capture();
      const route = saved?.route || await routeFor(token);
      if (!token.scope_id) await loadScope(token);
      const stopped = await post(token, "/workflow/stop", { run_id: run.id });
      if (stopped.control?.admission_id) {
        await rpc(token, route, "prompt.cancel", { session_id: stopped.control.session_id, admission_id: stopped.control.admission_id });
      }
      return (await post(token, "/workflow/status", { run_id: run.id })).run;
    },
    async recover(run) {
      const token = owners.get(run.id)?.token || capture();
      if (!token.scope_id) await loadScope(token);
      return (await post(token, "/workflow/recover", { run_id: run.id })).run;
    },
    async openThread(threadId) {
      const token = capture();
      const route = await routeFor(token);
      check(token);
      await host2.openSession(threadId, { route, intent: "tab", keepAllProfilesScope: true });
      check(token);
    },
    dispose() {
      disposed = true;
      owners.clear();
      creations.clear();
      threadSelections = /* @__PURE__ */ new WeakMap();
    }
  };
  ctx.onDispose?.(adapter.dispose);
  return adapter;
}

// frontend/workspace.jsx
var ownerNow = () => [
  host3.activeConnectionId(),
  host3.state.profile.get(),
  gatewayActivationEpoch2()
];
function Workspace({ ctx }) {
  const profile = useValue(host3.state.profile), connection = useValue(host3.state.connectionId), epoch = useGatewayActivationEpoch();
  const key = JSON.stringify([connection, profile, epoch]);
  return h(
    "div",
    { className: "ws-root" },
    h("style", null, styles),
    h(WorkspaceSource, { key, ctx, profile, sourceKey: key })
  );
}
function NavigationLabel({ item, context, descriptionId }) {
  return h(
    "span",
    { className: "ws-nav-label", title: item.title },
    h("span", null, item.title),
    context && h("small", { title: context.description }, context.caption),
    context && h("span", { className: "ws-title-reader", id: descriptionId }, context.description)
  );
}
function NavigationOrderControls({ item, siblings, order }) {
  if (!order.mode) return null;
  const index = siblings.findIndex((row) => row.id === item.id);
  const move = (direction) => {
    const target = siblings[index + direction];
    if (target) order.save(order.capture(item), target, direction < 0 ? "before" : "after");
  };
  return h(
    "span",
    {
      className: "ws-order-controls",
      role: "group",
      "aria-label": `${item.title}, position ${index + 1} of ${siblings.length}`,
      onClick: (e) => e.stopPropagation(),
      onKeyDown: (e) => {
        if (e.key !== "Escape") e.stopPropagation();
      }
    },
    h(Action, {
      variant: "ghost",
      className: "ws-order-handle",
      "aria-label": `Drag ${item.title}`,
      title: `Drag ${item.title}. Or use Move up and Move down.`,
      "aria-describedby": order.helpId,
      disabled: order.pending || siblings.length < 2,
      draggable: !order.pending && siblings.length > 1,
      onDragStart: (e) => order.start(e, item),
      onDragEnd: order.end
    }, h(Codicon, { name: "gripper" })),
    h(Action, {
      variant: "ghost",
      "aria-label": `Move ${item.title} up`,
      title: "Move up",
      disabled: order.pending || index === 0,
      onClick: () => move(-1)
    }, h(Codicon, { name: "arrow-up" })),
    h(Action, {
      variant: "ghost",
      "aria-label": `Move ${item.title} down`,
      title: "Move down",
      disabled: order.pending || index === siblings.length - 1,
      onClick: () => move(1)
    }, h(Codicon, { name: "arrow-down" }))
  );
}
var Tree = memo(function Tree2({ childrenByParent, contexts, parent = null, onOpen, selected, initializeDisclosure, order }) {
  return h(
    "ul",
    null,
    (childrenByParent.get(parent) ?? []).map(
      (item) => h(
        "li",
        { key: item.id, "data-ws-item-id": item.id },
        item.kind === "folder" ? h(
          "details",
          { ref: initializeDisclosure },
          h(
            "summary",
            order.row(item),
            h(Codicon, {
              name: "chevron-right",
              className: "ws-disclosure-caret"
            }),
            h(
              Action,
              {
                variant: "ghost",
                onClick: () => onOpen(item.id),
                "aria-current": selected === item.id ? "page" : void 0,
                "aria-label": contexts.has(item.id) ? item.title : void 0,
                "aria-describedby": contexts.has(item.id) ? `ws-tree-context-${item.id}` : void 0
              },
              h(NavigationLabel, { item, context: contexts.get(item.id), descriptionId: `ws-tree-context-${item.id}` })
            ),
            h(NavigationOrderControls, { item, siblings: childrenByParent.get(parent), order })
          ),
          h(Tree2, { childrenByParent, contexts, parent: item.id, onOpen, selected, initializeDisclosure, order })
        ) : h(
          "div",
          { ...order.row(item), className: "ws-nav-row ws-order-row" },
          h(
            Action,
            {
              className: "ws-tree-item",
              variant: "ghost",
              "aria-current": selected === item.id ? "page" : void 0,
              "aria-label": contexts.has(item.id) ? item.title : void 0,
              "aria-describedby": contexts.has(item.id) ? `ws-tree-context-${item.id}` : void 0,
              onClick: () => onOpen(item.id)
            },
            h(Codicon, {
              name: item.kind === "database" ? "table" : "file-text"
            }),
            h(NavigationLabel, { item, context: contexts.get(item.id), descriptionId: `ws-tree-context-${item.id}` })
          ),
          h(NavigationOrderControls, { item, siblings: childrenByParent.get(parent), order })
        )
      )
    )
  );
});
function FolderNavigation({ childrenByParent, contexts, onOpen, selected, scope, reorder }) {
  const treeId = useId7();
  const tree = useRef15(null), defaultOpen = useRef15(true);
  const initializeDisclosure = useCallback4((node) => {
    if (node) node.open = defaultOpen.current;
  }, []);
  const setAll = useCallback4((open) => {
    defaultOpen.current = open;
    tree.current?.querySelectorAll("details").forEach((node) => {
      node.open = open;
    });
  }, []);
  const [mode, setMode] = useState15(false), [pending, setPending] = useState15(false), [feedback, setFeedback] = useState15({ text: "", failed: false }), [target, setTarget] = useState15(null);
  const busy = useRef15(false), drag = useRef15(null), serial = useRef15(0), toggle = useRef15(null), mounted = useRef15(true);
  const restoreOrderFocus = useRef15(null);
  const helpId = `${treeId}-order-help`, mime = "application/x-hermes-workspace-order";
  const signature = JSON.stringify([...childrenByParent].map(([parent, rows]) => [parent, rows.map((row) => row.id)]));
  useLayoutEffect9(() => {
    drag.current = null;
    setTarget(null);
  }, [scope, signature]);
  useLayoutEffect9(() => {
    if (pending || !restoreOrderFocus.current) return;
    const { node, id, sourceScope } = restoreOrderFocus.current;
    restoreOrderFocus.current = null;
    if (sourceScope !== scope || document.activeElement !== document.body && document.activeElement !== node) return;
    const row = [...tree.current?.querySelectorAll("[data-ws-order-row]") ?? []].find((row2) => row2.dataset.wsOrderRow === id);
    const destination = node.isConnected && !node.disabled ? node : row?.querySelector(".ws-order-handle:not(:disabled)");
    destination?.focus({ preventScroll: true });
  }, [pending, scope]);
  useEffect8(() => () => {
    mounted.current = false;
    drag.current = null;
  }, []);
  const capture = (item) => ({
    id: item.id,
    parent: item.parent_id,
    scope,
    siblings: (childrenByParent.get(item.parent_id) ?? []).map((row) => row.id)
  });
  const cancel = () => {
    if (!drag.current) return;
    drag.current = null;
    setTarget(null);
    setFeedback({ text: "Reordering cancelled. Saved order unchanged.", failed: false });
  };
  const save = async (request, item, position) => {
    if (busy.current || request.id === item.id || request.parent !== item.parent_id || request.scope !== scope) return;
    const focused = document.activeElement;
    if (tree.current?.contains(focused)) restoreOrderFocus.current = { node: focused, id: request.id, sourceScope: scope };
    busy.current = true;
    drag.current = null;
    setTarget(null);
    setPending(true);
    setFeedback({ text: "Saving folder order\u2026", failed: false });
    try {
      await reorder({ ...request, target_id: item.id, position });
      if (mounted.current) setFeedback({ text: `Saved order. \u201C${request.title ?? request.id}\u201D ${position} \u201C${item.title}\u201D.`, failed: false });
    } catch (error) {
      if (mounted.current) setFeedback({ text: `Could not save order. ${error.message} Try again with the current order.`, failed: true });
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };
  const order = {
    mode,
    pending,
    helpId,
    capture: (item) => ({ ...capture(item), title: item.title }),
    save,
    start: (event, item) => {
      if (busy.current || !mode) {
        event.preventDefault();
        return;
      }
      const token = `${treeId}:${++serial.current}`;
      drag.current = { ...capture(item), title: item.title, token };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(mime, token);
      event.dataTransfer.setData("text/plain", item.title);
    },
    end: cancel,
    row: (item) => ({
      className: "ws-order-row",
      "data-ws-order-row": item.id,
      "data-order-position": target?.id === item.id ? target.position : void 0,
      onDragOver: (event) => {
        const request = drag.current;
        if (!mode || busy.current || !request || request.scope !== scope) return;
        if (request.parent !== item.parent_id || request.id === item.id) {
          event.dataTransfer.dropEffect = "none";
          setTarget(null);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        const box = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < box.top + box.height / 2 ? "before" : "after";
        setTarget((old) => old?.id === item.id && old.position === position ? old : { id: item.id, position });
        setFeedback((old) => {
          const text = `Drop ${position} \u201C${item.title}\u201D. Same folder only; use Move to change folders.`;
          return old.text === text ? old : { text, failed: false };
        });
      },
      onDragLeave: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setTarget((old) => old?.id === item.id ? null : old);
      },
      onDrop: (event) => {
        const request = drag.current;
        if (!request || request.token !== event.dataTransfer.getData(mime)) {
          cancel();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const box = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < box.top + box.height / 2 ? "before" : "after";
        void save(request, item, position);
      }
    })
  };
  const hasFolders = [...childrenByParent.values()].some((items) => items.some((item) => item.kind === "folder"));
  const canReorder = [...childrenByParent.values()].some((items) => items.length > 1);
  return h(
    "div",
    {
      className: "ws-folder-navigation",
      "data-reordering": mode,
      "aria-busy": pending,
      onKeyDown: (event) => {
        if (event.key !== "Escape" || event.isComposing || busy.current) return;
        event.stopPropagation();
        event.preventDefault();
        if (drag.current) cancel();
        else {
          setMode(false);
          toggle.current?.focus({ preventScroll: true });
        }
      }
    },
    h(
      "div",
      { className: "ws-tree-actions", role: "group", "aria-label": "Folder tree actions" },
      hasFolders && h(Action, {
        variant: "ghost",
        "aria-controls": treeId,
        onClick: () => setAll(true)
      }, "Expand all"),
      hasFolders && h(Action, {
        variant: "ghost",
        "aria-controls": treeId,
        onClick: () => setAll(false)
      }, "Collapse all"),
      canReorder && h(Action, {
        ref: toggle,
        variant: "ghost",
        "aria-pressed": mode,
        disabled: pending,
        "aria-controls": treeId,
        onClick: () => {
          cancel();
          setMode((value) => !value);
        }
      }, mode ? "Done reordering" : "Reorder")
    ),
    mode && h("p", { id: helpId, className: "ws-order-help" }, "Drag a handle, or use Move up and Move down. Escape cancels. Same folder only; use Move to change folders."),
    h("p", { className: "ws-order-status", role: feedback.failed ? "alert" : "status", "aria-atomic": true }, feedback.text),
    h("div", { id: treeId, ref: tree }, h(Tree, { childrenByParent, contexts, onOpen, selected, initializeDisclosure, order }))
  );
}
function WorkspaceSource({ ctx, profile, sourceKey }) {
  const queryInstance = useId7();
  const client = useMemo3(
    () => new WorkspaceClient(ctx, ownerNow),
    [ctx, sourceKey]
  );
  const workflow = useMemo3(() => createWorkflowAdapter(ctx), [ctx, sourceKey]);
  const navigation = useNavigationResize(ctx.storage, client.owner);
  const compactHeader = navigation.availableWidth > 0 && navigation.availableWidth <= 480;
  const header = useRef15(null), focusedHeaderAction = useRef15(null);
  useLayoutEffect9(() => {
    if (compactHeader && focusedHeaderAction.current && !focusedHeaderAction.current.isConnected && document.activeElement === document.body)
      header.current?.querySelector('[aria-label="Workspace menu"]')?.focus({ preventScroll: true });
  }, [compactHeader]);
  const trackHeaderFocus = { onFocus: (event) => {
    focusedHeaderAction.current = event.currentTarget;
  }, onBlur: () => {
    focusedHeaderAction.current = null;
  } };
  const drafts = useMemo3(() => {
    const [connectionId, ownerProfile] = JSON.parse(client.owner);
    return ctx.storage ? new DraftRepository(ctx.storage, connectionId, ownerProfile) : null;
  }, [ctx.storage, client]);
  const state = useSyncExternalStore(
    client.subscribe,
    client.snapshot,
    client.snapshot
  );
  const [usernameDialog, setUsernameDialog] = useState15(null);
  const [selected, setSelected] = useState15(null), [error, setError] = useState15(""), [dialog, setDialog] = useState15(null), [confirmation, setConfirmation] = useState15(null), [restore, setRestore] = useState15(null), [replacementLoad, setReplacementLoad] = useState15(null), [notice, setNotice] = useState15(""), [trash, setTrash] = useState15(false), [navExpanded, setNavExpanded] = useState15(false), [errorAction, setErrorAction] = useState15("action"), [errorContext, setErrorContext] = useState15(null);
  const navId = useId7(), navToggle = useRef15(null), workPane = useRef15(null);
  const importing = useRef15(false), [importBusy, setImportBusy] = useState15(false), [importedItem, setImportedItem] = useState15(null);
  useLayoutEffect9(() => {
    if (workPane.current) {
      workPane.current.scrollTop = 0;
      workPane.current.scrollLeft = 0;
    }
  }, [selected, trash]);
  const importInput = useRef15(null), backupInput = useRef15(null), flush = useRef15(async () => {
  }), selectionIntent = useRef15(0);
  const nextSelectionIntent = useCallback4(() => ++selectionIntent.current, []);
  const report = useCallback4(
    (err, action = "action") => {
      if (client.current() && err instanceof UnsavedEditError) return;
      if (client.current()) {
        const context = typeof action === "string" ? { operation: action } : action;
        setError(err?.message ?? String(err));
        setErrorAction(context?.operation ?? "action");
        setErrorContext(context);
      }
    },
    [client]
  );
  const command = useCallback4(
    (op, payload) => client.command(op, payload),
    [client]
  );
  const reorder = useCallback4((request) => client.command(
    "reorder_item",
    (current) => navigationOrderPayload(current, request)
  ), [client]);
  const refresh = useCallback4(() => client.load(), [client]);
  const loadReplacement = async (ticket, committed = true) => {
    client.assertCurrent();
    setRestore(null);
    setSelected(null);
    setTrash(false);
    setDialog(null);
    setConfirmation(null);
    setReplacementLoad({ ticket, committed });
    setError("");
    setNotice(
      committed === "unknown" ? "Replacement outcome remains unknown. Loading current Workspace only\u2026" : committed ? "Restore completed. Loading replaced Workspace\u2026" : "Replacement refused. Loading current Workspace\u2026"
    );
    try {
      if (client.replacement) await client.reloadRestore(ticket);
      else await client.load();
      client.assertCurrent();
      setReplacementLoad(null);
      setNotice(
        committed === "unknown" ? "Current Workspace loaded. The replacement outcome remains unknown. Do not repeat replacement to recover a lost response." : committed ? "Workspace restored." : "Current Workspace loaded. Replacement was refused."
      );
    } catch (err) {
      if (client.current())
        setNotice(
          (committed === "unknown" ? "Replacement outcome remains unknown; current Workspace could not be loaded. " : committed ? "Restore completed, but Workspace could not be loaded. " : "Replacement refused, but Workspace could not be loaded. ") + err.message + " Retry loading only; replacement will not be repeated."
        );
    }
  };
  const queryState = useQuery({
    queryKey: ["workspace", sourceKey, queryInstance],
    queryFn: refresh,
    refetchInterval: 3e3,
    gcTime: 0,
    retry: false
  });
  const runs = (state?.runs ?? []).filter(
    (r) => ["running", "pending", "starting", "stopping"].includes(r.status)
  );
  const runFailureContext = useRef15(null);
  const runQuery = useQuery({
    queryKey: ["workspace-runs", sourceKey, queryInstance, runs.map((r) => r.id).join(",")],
    enabled: runs.length > 0,
    queryFn: async () => {
      client.assertCurrent();
      for (const run of runs) {
        try {
          await workflow.status(run);
        } catch (error2) {
          runFailureContext.current = {
            operation: "runStatus",
            itemId: run.item_id,
            pageTitle: client.snapshot()?.items.find((item2) => item2.id === run.item_id)?.title,
            threadId: run.session_id
          };
          throw error2;
        }
        client.assertCurrent();
      }
      return refresh();
    },
    refetchInterval: 3e3,
    gcTime: 0,
    retry: false
  });
  useEffect8(() => {
    if (queryState.error) report(queryState.error, "load");
  }, [queryState.error, report]);
  useEffect8(() => {
    if (runQuery.error) report(runQuery.error, runFailureContext.current ?? { operation: "runStatus" });
  }, [runQuery.error, report]);
  useEffect8(
    () => () => {
      client.dispose();
      workflow.dispose();
    },
    [client, workflow]
  );
  const registerFlush = useCallback4((fn) => {
    flush.current = fn;
    return () => {
      if (flush.current === fn) flush.current = async () => {
      };
    };
  }, []);
  const open = useCallback4(async (id) => {
    const intent = nextSelectionIntent();
    try {
      await flush.current();
      client.assertCurrent();
      if (client.snapshot()?.items.find((i) => i.id === id)?.kind !== "folder")
        await command("open_item", { id });
      if (client.current() && intent === selectionIntent.current) {
        setSelected(id);
        setNavExpanded(false);
        requestAnimationFrame(() => {
          if (navToggle.current?.getClientRects().length) navToggle.current.focus();
        });
        setTrash(false);
      }
    } catch (err) {
      report(err);
    }
  }, [client, command, report, nextSelectionIntent]);
  const home = async () => {
    const intent = nextSelectionIntent();
    try {
      await flush.current();
      client.assertCurrent();
      if (intent !== selectionIntent.current) return;
      setSelected(null);
      setTrash(false);
    } catch (err) {
      report(err);
    }
  };
  const act = (fn, current = () => true) => void Promise.resolve().then(fn).catch((err) => {
    if (!current()) return;
    if (client.current() && err instanceof UnsavedEditError) err.focus();
    report(err);
  });
  const confirm = useCallback4((config) => setConfirmation(config), []);
  const transfer = async (path, body) => {
    await flush.current();
    const response = await client.transfer(path, body);
    client.assertCurrent();
    return response;
  };
  const download = async (path) => {
    const result = await transfer(path);
    client.assertCurrent();
    downloadFile(result.download ?? result.result ?? result);
  };
  const upload = async (file, backup = false) => {
    if (!file) return;
    if (!backup && importing.current) return;
    const intent = selectionIntent.current;
    if (!backup) {
      importing.current = true;
      setImportBusy(true);
      setImportedItem(null);
    }
    try {
      client.assertCurrent();
      if (backup) await flush.current();
      const ticket = backup ? client.captureRestore() : null;
      const data_base64 = await (backup ? backupFileBase64(file) : fileBase64(file));
      client.assertCurrent();
      if (backup) {
        client.assertRestore(ticket, true);
        setRestore({ ticket, data: data_base64 });
        return;
      }
      const result = await transfer("/import", {
        name: file.name,
        data_base64,
        ...selected && state.items.find((i) => i.id === selected)?.kind === "folder" ? { parent_id: selected } : {}
      });
      await refresh();
      const item2 = result.result?.item ?? result.item ?? result.result;
      if (item2?.id && intent === selectionIntent.current) await open(item2.id);
      else if (item2?.id) {
        setImportedItem(item2);
        setNotice(`Imported ${file.name}. Your current page stays open.`);
      }
      const warnings = result.result?.warnings ?? result.warnings;
      if (warnings?.length) setNotice(`Imported ${file.name}. ${warnings.join(" ")}`);
    } finally {
      if (!backup) {
        importing.current = false;
        if (client.current()) setImportBusy(false);
      }
    }
  };
  const create = (kind, returnFocus = document.activeElement) => act(async () => {
    await flush.current();
    client.assertCurrent();
    setDialog({ kind, returnFocus });
  });
  const items = useMemo3(() => state?.items.filter((i) => !i.deleted_at) ?? [], [state?.items]);
  const itemIndex = useMemo3(() => new Map(items.map((item2) => [item2.id, item2])), [items]);
  const childrenByParent = useMemo3(() => {
    const index = /* @__PURE__ */ new Map();
    for (const item2 of items) {
      if (item2.kind === "record") continue;
      const siblings = index.get(item2.parent_id) ?? [];
      siblings.push(item2);
      index.set(item2.parent_id, siblings);
    }
    return index;
  }, [items]);
  const navContexts = useMemo3(() => navigationContexts(state?.items, state?.attachments), [state?.items, state?.attachments]);
  const item = itemIndex.get(selected);
  const currentRun = item && activeRun(state, item.id);
  return h(IdentityProvider, { client }, h(
    "div",
    { className: "ws-root" },
    h(
      "header",
      { ref: header, className: `ws-topbar${compactHeader ? " ws-topbar-compact" : ""}` },
      h("h1", null, h(Codicon, { name: "notebook" }), "Workspace"),
      h("span", { className: "ws-source" }, profile),
      !compactHeader && h(Action, { ...trackHeaderFocus, onClick: () => act(home) }, "Home"),
      !compactHeader && h(
        Action,
        { ...trackHeaderFocus, disabled: !state, onClick: () => create("page") },
        "New page"
      ),
      h(
        ActionMenu,
        {
          label: "Workspace menu",
          disabled: !state,
          showChevron: !compactHeader,
          triggerLabel: compactHeader ? h(Codicon, { name: "ellipsis", "aria-hidden": true }) : "Workspace menu",
          triggerProps: compactHeader ? { size: "icon-sm" } : {}
        },
        compactHeader && h(Action, { onClick: () => act(home) }, "Home"),
        compactHeader && h(Action, { disabled: !state, onClick: (_event, opener) => create("page", opener) }, "New page"),
        h(Action, { disabled: !state, onClick: () => act(async () => {
          await flush.current();
          await refresh();
          setError("");
        }) }, "Reload state"),
        h(Action, { disabled: !state, onClick: (_event, opener) => setUsernameDialog({ opener }) }, "set username"),
        h(
          Action,
          { disabled: !state, onClick: (_event, opener) => create("folder", opener) },
          "New folder"
        ),
        h(
          Action,
          { disabled: !state, onClick: (_event, opener) => create("database", opener) },
          "New database"
        ),
        h(
          Action,
          { disabled: !state || importBusy, onClick: () => importInput.current.click() },
          "Import"
        ),
        h(
          Action,
          { disabled: !state, onClick: () => act(() => download("/backup")) },
          "Back up Workspace"
        ),
        h(
          Action,
          { disabled: !state, onClick: () => backupInput.current.click() },
          "Restore backup"
        )
      )
    ),
    notice && h(
      "div",
      { className: "ws-notice", role: "status" },
      notice,
      importedItem && h(Action, { onClick: () => act(() => open(importedItem.id)) }, "Open imported page"),
      !replacementLoad && h(Action, { variant: "text", onClick: () => setNotice("") }, "Dismiss notice"),
      replacementLoad && h(
        Action,
        {
          onClick: () => void loadReplacement(
            replacementLoad.ticket,
            replacementLoad.committed
          )
        },
        "Load replaced Workspace"
      )
    ),
    error && h(
      "div",
      { className: "ws-error", role: "alert" },
      h("p", null, operationError(error, errorContext)),
      operationError(error, errorContext) !== error && h("details", null, h("summary", null, "Technical details"), h("pre", null, error)),
      h(
        "div",
        { className: "ws-actions" },
        errorAction === "import" && h(Action, { onClick: () => importInput.current.click() }, "Choose another file"),
        errorAction === "load" && h(
          Action,
          {
            onClick: () => act(async () => {
              await refresh();
              setError("");
            })
          },
          "Reload state"
        ),
        errorContext?.retry && (!errorContext.itemId || errorContext.itemId === item?.id) && h(Action, {
          onClick: () => void errorContext.retry().then(() => setError("")).catch((err) => report(err, errorContext))
        }, "Retry thread list"),
        ["runStart", "runStatus"].includes(errorContext?.operation) && errorContext.itemId && errorContext.itemId !== item?.id && h(Action, {
          onClick: () => act(() => open(errorContext.itemId))
        }, "Open run page"),
        ["runStart", "runStatus"].includes(errorContext?.operation) && errorContext.threadId && h(Action, {
          onClick: () => act(() => workflow.openThread(errorContext.threadId))
        }, "Open linked thread"),
        h(
          Action,
          { variant: "text", onClick: () => setError("") },
          "Dismiss"
        )
      )
    ),
    h("input", {
      ref: importInput,
      type: "file",
      hidden: true,
      accept: ".md,.markdown,.csv,.docx,.pdf",
      onChange: (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        void upload(file).catch((err) => report(err, { operation: "import", fileName: file?.name }));
      }
    }),
    importBusy && h("div", { className: "ws-notice", role: "status" }, "Importing file\u2026 You can keep browsing Workspace."),
    h("input", {
      ref: backupInput,
      type: "file",
      hidden: true,
      accept: ".zip,.json",
      onChange: (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        void upload(file, true).catch((err) => report(err, "backup"));
      }
    }),
    !state ? h(
      "div",
      { className: "ws-home", role: "status" },
      queryState.error ? h(ErrorState, {
        title: "Workspace could not be loaded",
        description: h(
          "p",
          { className: "ws-state-description max-w-prose text-center text-sm leading-5" },
          "Check that the Workspace backend is enabled for this profile, then reload state."
        )
      }) : h(
        "span",
        { className: "ws-loading" },
        h(GlyphSpinner2, { ariaLabel: "Loading Workspace" }),
        "Loading Workspace\u2026"
      )
    ) : h(
      "div",
      { className: "ws-body", ref: navigation.body, style: { "--ws-nav-width": `${navigation.width}px`, "--ws-pane-height": `${navigation.availableHeight || 640}px` } },
      h(
        "nav",
        { className: "ws-nav", "aria-label": "Workspace pages", "data-expanded": navExpanded },
        h(Action, { ref: navToggle, className: "ws-nav-toggle", variant: "ghost", "aria-expanded": navExpanded, "aria-controls": navId, onClick: () => setNavExpanded((v) => !v) }, h(Codicon, { name: navExpanded ? "chevron-down" : "chevron-right" }), h("span", null, `Pages \xB7 ${item?.title ?? "Home"}`)),
        h(
          "div",
          { className: "ws-nav-content", id: navId },
          h(WorkspaceSearch, {
            client,
            scope: state.scope_id,
            revision: state.revision,
            destination: `${selected ?? "home"}:${trash}`,
            onOpen: open,
            contexts: navContexts
          }),
          h("h2", null, "Folders and pages"),
          items.length ? h(FolderNavigation, { childrenByParent, contexts: navContexts, onOpen: open, selected, scope: state.scope_id, reorder }) : h("p", { className: "ws-empty" }, "Create your first page."),
          h("h2", null, "Recents"),
          h(
            "ul",
            null,
            (state.recents ?? []).map((recent) => {
              const row = itemIndex.get(typeof recent === "string" ? recent : recent.item_id ?? recent.id);
              return row && h(
                "li",
                { key: row.id },
                h(
                  Action,
                  {
                    variant: "ghost",
                    onClick: () => open(row.id),
                    "aria-label": navContexts.has(row.id) ? row.title : void 0,
                    "aria-describedby": navContexts.has(row.id) ? `ws-recent-context-${row.id}` : void 0
                  },
                  h(NavigationLabel, { item: row, context: navContexts.get(row.id), descriptionId: `ws-recent-context-${row.id}` })
                )
              );
            })
          ),
          h(
            Action,
            {
              onClick: () => {
                const intent = nextSelectionIntent();
                act(async () => {
                  await flush.current();
                  if (intent !== selectionIntent.current) return;
                  setTrash(true);
                }, () => intent === selectionIntent.current);
              }
            },
            `Trash (${state.items.filter((i) => i.deleted_at).length})`
          )
        )
      ),
      h(NavigationResizeHandle, { navigation, controls: navId }),
      navigation.error && h("p", { className: "ws-status-announcement", role: "status" }, navigation.error),
      h(
        "main",
        { className: "ws-work", ref: workPane, tabIndex: -1, "aria-label": "Workspace content" },
        trash ? h(Trash, { state, command, onError: report, confirm }) : item ? h(Document, {
          key: JSON.stringify([state.scope_id, item.id]),
          item,
          state,
          client,
          ctx,
          drafts,
          workflow,
          command,
          refresh,
          onOpen: open,
          onError: report,
          registerFlush,
          flush,
          confirm,
          currentRun,
          setDialog
        }) : h(Home, {
          contexts: navContexts,
          itemIndex,
          items,
          state,
          drafts,
          onOpen: open,
          create,
          setDialog
        })
      )
    ),
    usernameDialog && h(UsernameDialog, { client, returnFocus: usernameDialog.opener, onClose: () => setUsernameDialog(null) }),
    dialog && h(CreateDialog, {
      dialog,
      items,
      state,
      command,
      onClose: () => setDialog(null),
      onOpen: open,
      parentId: item?.kind === "folder" ? item.id : null
    }),
    restore && h(RestoreDialog, {
      client,
      ticket: restore.ticket,
      data: restore.data,
      onClose: () => setRestore(null),
      onCommitted: (ticket) => void loadReplacement(ticket),
      onRefused: (ticket) => void loadReplacement(ticket, false),
      onUseCurrent: (ticket) => void loadReplacement(ticket, "unknown")
    }),
    confirmation && h(FormDialog, {
      returnFocus: confirmation.returnFocus,
      title: confirmation.title,
      description: confirmation.description,
      confirm: confirmation.label,
      destructive: true,
      focusConfirm: true,
      onClose: () => setConfirmation(null),
      onSubmit: async () => {
        if (!confirmation.skipFlush) await flush.current();
        client.assertCurrent();
        await confirmation.action();
      }
    })
  ));
}
function Home({ items, state, drafts, onOpen, create, setDialog, contexts, itemIndex }) {
  const descriptionPrefix = useId7();
  const recoverable = drafts ? ["content", "title", "property", "discussion"].flatMap((field) => drafts.list(state.scope_id, field)) : [];
  const pageRows = useMemo3(
    () => items.filter((item) => item.kind === "page" || item.kind === "database").map((item) => {
      const context = contexts?.get(item.id), description = `${descriptionPrefix}-${item.id}`;
      const parent = itemIndex?.get(item.parent_id);
      return h(
        "li",
        { key: item.id, className: "ws-home-item" },
        h(Action, { variant: "link", "aria-describedby": description, onClick: () => onOpen(item.id) }, item.title),
        h("span", { className: "ws-home-location", "aria-hidden": true }, context?.caption ?? `${parent?.title || "Workspace"} \xB7 ${item.kind}`),
        h("span", { id: description, className: "ws-title-reader" }, context?.description ?? itemContext(item, items, state.attachments))
      );
    }),
    [items, state.attachments, onOpen, contexts, itemIndex, descriptionPrefix]
  );
  return h(
    "section",
    { className: "ws-home" },
    recoverable.length > 0 && h(
      "section",
      { "aria-label": "Recoverable drafts" },
      h("h2", null, "Recoverable drafts"),
      h(
        "p",
        { className: "ws-muted" },
        "These local drafts belong to this exact connection, profile and Workspace. Open a page to recover or discard its draft; nothing is saved automatically."
      ),
      h(
        "ul",
        null,
        recoverable.map((entry) => {
          const page = items.find((i) => i.id === entry.item_id);
          return h(
            "li",
            { key: `${entry.field ?? "content"}:${entry.item_id}:${entry.property_id ?? ""}` },
            page ? h(
              Action,
              { onClick: () => onOpen(page.id) },
              `${entry.field === "title" ? "Recover title" : entry.field === "property" ? "Recover property" : entry.field === "discussion" ? "Continue feedback" : "Recover draft"}: ${page.title}${entry.property_id ? ` \xB7 ${state.items.find((i) => i.id === page.database_id)?.columns?.find((c) => c.id === entry.property_id)?.name ?? "Property"}` : ""}`
            ) : h(
              "span",
              null,
              `Draft for unavailable item ${entry.item_id}; restore the item from Trash to recover it.`
            )
          );
        })
      )
    ),
    h("h2", null, "Your pages"),
    h(
      "p",
      { className: "ws-muted" },
      "Keep documents and databases together. Leave comments when you want Hermes to work on a page."
    ),
    h(
      "div",
      { className: "ws-actions" },
      h(Action, { onClick: () => create("page") }, "New page"),
      h(Action, { onClick: () => create("database") }, "New database")
    ),
    h(
      "ul",
      { className: "ws-list" },
      pageRows
    ),
    h("h2", null, "Templates"),
    state.templates.length ? h(
      "ul",
      { className: "ws-list" },
      state.templates.map(
        (t) => h(
          "li",
          { key: t.id },
          h(Action, { onClick: () => setDialog({ template: t }) }, t.name)
        )
      )
    ) : h(
      "p",
      { className: "ws-empty" },
      "Save a page or record as a template to reuse its content and properties."
    ),
    h("h2", null, "Import and recovery"),
    h(
      "p",
      { className: "ws-muted" },
      "Import Markdown, CSV, Word (.docx) or text-based PDF. Word and PDF become editable content with their original attachments; exact layout and scanned-PDF OCR are not supported. Markdown and CSV exports are portable content. Use Back up Workspace to preserve comments, structure, history and attachments."
    )
  );
}
function Trash({ state, command, onError, confirm }) {
  const rows = state.items.filter((i) => i.deleted_at);
  return h(
    "section",
    { className: "ws-home" },
    h("h2", null, "Trash"),
    h(
      "p",
      { className: "ws-muted" },
      "Items stay here until you restore or permanently delete them. There is no automatic expiry."
    ),
    !rows.length && h("p", { className: "ws-empty" }, "Trash is empty."),
    h(
      "ul",
      { className: "ws-list" },
      rows.map(
        (item) => h(
          "li",
          { key: item.id },
          h("strong", null, item.title),
          h("span", { className: "ws-muted" }, ` (${item.kind})`),
          h(
            "div",
            { className: "ws-actions" },
            h(
              Action,
              {
                onClick: () => void command("restore", { id: item.id }).catch(onError)
              },
              "Restore"
            ),
            h(
              Action,
              {
                onClick: () => confirm({
                  title: `Permanently delete ${item.title}?`,
                  description: item.kind === "folder" ? "This permanently deletes the folder and its contents, comments and attachments. This cannot be undone." : "This permanently deletes this item, its comments and attachments. This cannot be undone.",
                  label: "Permanently delete",
                  action: () => command("purge", { id: item.id })
                })
              },
              "Permanently delete"
            )
          )
        )
      )
    )
  );
}
function CreateDialog({
  dialog,
  items,
  state,
  command,
  onClose,
  onOpen,
  parentId
}) {
  const template = dialog.template;
  const kind = dialog.kind ?? "page";
  const fields = [
    {
      name: "title",
      label: template ? "New item title" : `${kind[0].toUpperCase() + kind.slice(1)} title`
    },
    {
      name: "parent_id",
      label: "Folder",
      options: [
        ["", "Workspace root"],
        ...items.filter((i) => i.kind === "folder").map((i) => [i.id, i.title])
      ]
    }
  ];
  if (template?.kind === "record")
    fields.push({
      name: "database_id",
      label: "Database for record template",
      options: [
        ["", "Page template"],
        ...items.filter((i) => i.kind === "database").map((i) => [i.id, i.title])
      ]
    });
  return h(FormDialog, {
    title: template ? `Use ${template.name}` : `New ${kind}`,
    returnFocus: dialog.returnFocus,
    initial: { parent_id: parentId ?? "" },
    fields,
    onClose,
    onSubmit: async (v) => {
      if (template?.kind === "record" && !v.database_id)
        throw new Error(
          "Choose a compatible database for this record template."
        );
      const payload = {
        title: v.title,
        parent_id: template?.kind === "record" ? null : v.parent_id || null,
        ...v.database_id ? { database_id: v.database_id } : {}
      };
      const created = await command(
        template ? "apply_template" : "create_item",
        template ? { ...payload, template_id: template.id } : { ...payload, kind }
      );
      await onOpen(created.id);
    }
  });
}
function Document({
  item,
  state,
  client,
  ctx,
  drafts,
  workflow,
  command,
  refresh,
  onOpen,
  onError,
  registerFlush,
  flush,
  confirm,
  currentRun,
  setDialog
}) {
  const documentWidth = useDocumentWidth(ctx.storage, client.owner, state.scope_id, item.id);
  const draftBuffer = useMemo3(
    () => drafts?.bind(state.scope_id, item.id) ?? null,
    [drafts, state.scope_id, item.id]
  );
  const discussionBuffer = useMemo3(() => drafts?.bind(state.scope_id, item.id, "discussion") ?? null, [drafts, state.scope_id, item.id]);
  const retainedDiscussion = useMemo3(() => discussionBuffer?.read()?.draft ?? null, [discussionBuffer]);
  const [scopeReview, setScopeReview] = useState15(null);
  const [commentGeometry, setCommentGeometry] = useState15([]), [hoveredComment, setHoveredComment] = useState15(null);
  const receiveGeometry = useCallback4((next) => setCommentGeometry((old) => old.length === next.length && old.every((p, i) => p.id === next[i].id && p.block === next[i].block && p.slotBlock === next[i].slotBlock && p.lineGroup === next[i].lineGroup && JSON.stringify(p.anchor) === JSON.stringify(next[i].anchor) && Math.abs(p.top - next[i].top) < 0.5 && Math.abs(p.blockBottom - next[i].blockBottom) < 0.5) ? old : next), []);
  const [pending, setPending] = useState15(false);
  const [sectionBusy, setSectionBusy] = useState15(false), [sectionFrozen, setSectionFrozen] = useState15(false), [sectionReview, setSectionReview] = useState15(null);
  const sectionOperation = useRef15(null);
  const pendingFiles = useRef15(async () => {
  });
  const registerPendingFiles = useCallback4((fn) => {
    pendingFiles.current = fn;
    return () => {
      if (pendingFiles.current === fn) pendingFiles.current = async () => {
      };
    };
  }, []);
  const locked = Boolean(currentRun) || pending;
  const [text, setText] = useState15(""), [anchor, setAnchor] = useState15(() => retainedDiscussion?.anchor ?? null), [activeComment, setActiveComment] = useState15(null), [showResolved, setShowResolved] = useState15(() => state.comments.some((c) => c.item_id === item.id && c.resolved && retainedDiscussion?.replies?.[c.id])), [localDialog, setLocalDialog] = useState15(null);
  const localDialogOpener = useRef15(null);
  const [pageSurface, setPageSurface] = useState15(null), [surfaceBusy, setSurfaceBusy] = useState15(false), [surfaceError, setSurfaceError] = useState15("");
  const surfaceOpener = useRef15(null), surfaceTransfer = useRef15(false);
  const openPageSurface = (name, opener) => {
    surfaceOpener.current = opener ?? document.activeElement;
    surfaceTransfer.current = false;
    setSurfaceError("");
    setPageSurface(name);
  };
  const openLocalDialog = (name, opener) => {
    localDialogOpener.current = opener ?? document.activeElement;
    setLocalDialog(name);
  };
  const attachment = useRef15(null), editorFocus = useRef15(null);
  const headingId = useId7();
  const titleBuffer = useMemo3(() => drafts?.bind(state.scope_id, item.id, "title") ?? null, [drafts, state.scope_id, item.id]);
  const editorFlushes = useRef15({ title: async () => {
  }, body: async () => {
  }, discussion: async () => {
  } });
  const propertyFlushes = useRef15(/* @__PURE__ */ new Map());
  const propertyBuffer = useCallback4((recordId, columnId) => drafts?.bind(state.scope_id, recordId, "property", columnId) ?? null, [drafts, state.scope_id]);
  const registerPropertyFlush = useCallback4((id, fn) => {
    propertyFlushes.current.set(id, fn);
    return () => {
      if (propertyFlushes.current.get(id) === fn) propertyFlushes.current.delete(id);
    };
  }, []);
  const registerTitleFlush = useCallback4((fn) => {
    editorFlushes.current.title = fn;
    return () => {
      if (editorFlushes.current.title === fn) editorFlushes.current.title = async () => {
      };
    };
  }, []);
  const registerDiscussionFlush = useCallback4((fn) => {
    editorFlushes.current.discussion = fn;
    return () => {
      if (editorFlushes.current.discussion === fn) editorFlushes.current.discussion = async () => {
      };
    };
  }, []);
  const registerBodyFlush = useCallback4((fn) => {
    editorFlushes.current.body = fn;
    return () => {
      if (editorFlushes.current.body === fn) editorFlushes.current.body = async () => {
      };
    };
  }, []);
  const flushEditors = async () => {
    try {
      await editorFlushes.current.title();
      await editorFlushes.current.body();
      await editorFlushes.current.discussion();
      for (const save of propertyFlushes.current.values()) await save();
    } catch (err) {
      if (err instanceof UnsavedEditError) err.focus();
      throw err;
    }
  };
  useEffect8(() => registerFlush(async () => {
    if (sectionOperation.current) await sectionOperation.current;
    await flushEditors();
  }), [registerFlush]);
  const sectionTask = (work) => {
    if (sectionOperation.current) return sectionOperation.current;
    setSectionBusy(true);
    const operation = Promise.resolve().then(async () => {
      await pendingFiles.current();
      client.assertCurrent();
      setSectionFrozen(true);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return work();
    }).finally(() => {
      sectionOperation.current = null;
      if (client.current()) {
        setSectionBusy(false);
        setSectionFrozen(false);
      }
    });
    sectionOperation.current = operation;
    return operation;
  };
  const applySection = (preview, confirmed) => sectionTask(async () => {
    await flushEditors();
    client.assertCurrent();
    await command("revert_section", {
      version_id: preview.version_id,
      generation_id: preview.generation_id,
      change_id: preview.change_id,
      dataset_epoch: preview.dataset_epoch,
      content_hash: preview.content_hash,
      manual_revision: preview.manual_revision,
      confirmed
    });
  });
  const restoreSectionReading = (reading) => {
    if (!reading) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!client.current() || !reading.pane.isConnected) return;
      const editor = reading.pane.querySelector(".ws-editor[contenteditable]");
      const range = reading.anchor && editor && anchorRange(editor, reading.anchor);
      if (range) {
        const focused = document.activeElement, selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        focused?.focus?.({ preventScroll: true });
      }
      reading.pane.scrollTop = reading.top;
      reading.pane.scrollLeft = reading.left;
    }));
  };
  const revertSection = (comment, opener) => {
    const change = comment.section_change;
    if (!change || change.status !== "available" || locked) return;
    const pane = opener?.closest(".ws-work"), editor = pane?.querySelector(".ws-editor[contenteditable]");
    const reading = pane ? { pane, top: pane.scrollTop, left: pane.scrollLeft, anchor: editor && captureAnchor(editor) } : null;
    let reviewing = false;
    return sectionTask(async () => {
      await flushEditors();
      client.assertCurrent();
      const preview = await command("preview_section_revert", {
        version_id: change.version_id,
        generation_id: change.generation_id,
        change_id: change.change_id
      });
      if (preview.requires_confirmation) {
        reviewing = true;
        setSectionReview({ preview, opener, commentId: comment.id, reading });
      } else await command("revert_section", {
        version_id: preview.version_id,
        generation_id: preview.generation_id,
        change_id: preview.change_id,
        dataset_epoch: preview.dataset_epoch,
        content_hash: preview.content_hash,
        manual_revision: preview.manual_revision,
        confirmed: false
      });
    }).then(() => {
      if (!reviewing) restoreSectionReading(reading);
      requestAnimationFrame(() => {
        if (document.activeElement === document.body || document.activeElement === opener)
          document.getElementById(`ws-bubble-${comment.id}`)?.focus({ preventScroll: true });
      });
    }).catch((error) => {
      restoreSectionReading(reading);
      onError(error);
    });
  };
  const pageComments = numberComments(state.comments.filter(
    (c) => c.item_id === item.id
  ).map((c) => ({ ...c, anchor: commentAnchor(c) }))).filter((c) => showResolved || !c.resolved);
  const returnToEditor = () => editorFocus.current?.();
  const revealComment = (id) => {
    getSelection()?.removeAllRanges();
    setActiveComment(id);
    requestAnimationFrame(
      () => document.getElementById(`ws-discussion-${id}`)?.focus({ preventScroll: true })
    );
  };
  const lastRun = state.runs.filter((r) => r.item_id === item.id).at(-1);
  const database = state.items.find((i) => i.id === item.database_id);
  const versions = state.versions.filter((v) => v.item_id === item.id);
  const preRunVersions = versions.filter((v) => !v.section_revert_of), sectionVersions = versions.filter((v) => v.section_revert_of);
  const dialogVersions = localDialog === "section-version" ? sectionVersions : preRunVersions;
  const versionDialog = localDialog === "version" || localDialog === "section-version";
  const act = (fn) => void Promise.resolve().then(fn).catch(onError);
  const safeSave = useCallback4(
    (html) => command("update_item", { id: item.id, patch: { content: html } }),
    [command, item.id]
  );
  const submitRun = async (explicitItemIds, review = null) => {
    client.assertCurrent();
    if (review && (client.snapshot().scope_id !== review.scope_id || client.snapshot().revision !== review.revision || reviewScope(client.snapshot(), item.id).signature !== review.signature))
      throw new Error(
        "Comments or target items changed. Close and review this run again."
      );
    await flush.current();
    client.assertCurrent();
    if (review && (client.snapshot().scope_id !== review.scope_id || client.snapshot().revision !== review.revision || reviewScope(client.snapshot(), item.id).signature !== review.signature))
      throw new Error(
        "Comments or target items changed. Close and review this run again."
      );
    setPending(true);
    try {
      await workflow.addressComments(item.id, explicitItemIds, review && {
        scope_id: review.scope_id,
        revision: review.revision
      });
    } finally {
      if (client.current()) {
        setPending(false);
        await refresh();
      }
    }
  };
  const address = async () => {
    await flush.current();
    client.assertCurrent();
    const review = reviewScope(client.snapshot(), item.id);
    if (review.targets.length) setScopeReview(review);
    else await submitRun([]);
  };
  const stop = async () => {
    setPending(true);
    try {
      await workflow.stop(currentRun);
    } finally {
      if (client.current()) {
        setPending(false);
        await refresh();
      }
    }
  };
  const attachmentDownload = (attachment2) => {
    client.assertCurrent();
    downloadFile(attachment2);
  };
  return h(
    "div",
    {
      className: `ws-layout${item.kind === "folder" ? " ws-folder-layout" : ""}${documentWidth.wide ? " ws-wide-document" : ""}`
    },
    scopeReview && h(ScopeReviewDialog, {
      review: scopeReview,
      currentTitle: item.title,
      currentId: item.id,
      currentThreadId: item.thread_id,
      onClose: () => setScopeReview(null),
      onSubmit: (ids) => submitRun(ids, scopeReview)
    }),
    sectionBusy && h("div", { className: "ws-banner", role: "status" }, sectionFrozen ? "Reviewing the saved section\u2026 Editing will resume when this operation finishes." : "Finishing pending files before section review\u2026"),
    sectionReview && h(FormDialog, {
      key: `${sectionReview.preview.content_hash}:${sectionReview.preview.manual_revision}`,
      title: "Revert section after manual edits?",
      confirm: "Revert section",
      destructive: true,
      submitDisabled: sectionReview.expired === true,
      errorSummary: sectionReview.expired ? "This review has expired. Choose Review section again to see the current section before reverting." : void 0,
      recoveryAction: sectionReview.expired ? { label: "Review section again", onClick: () => sectionTask(async () => {
        await flushEditors();
        client.assertCurrent();
        const old = sectionReview.preview;
        const preview = await command("preview_section_revert", {
          version_id: old.version_id,
          generation_id: old.generation_id,
          change_id: old.change_id
        });
        setSectionReview({ ...sectionReview, preview, expired: false });
      }) } : void 0,
      returnFocus: sectionReview.opener,
      description: "You edited this page after Hermes changed it. Reverting restores only this highlighted section and removes its associated AI responses. Manual edits inside it may be overwritten; every unrelated change and human reply stays intact. Saved history retains the recovery receipt.",
      renderHelp: () => h(
        "div",
        { className: "ws-section-preview" },
        h("strong", null, "Current section"),
        h(RichPreview, {
          label: "Current section preview",
          html: sectionReview.preview.current_html,
          text: sectionReview.preview.current_text,
          attachments: state.attachments
        }),
        h("strong", null, "Restore this section"),
        h(RichPreview, {
          label: "Restored section preview",
          html: sectionReview.preview.before_html,
          text: sectionReview.preview.before_text,
          attachments: state.attachments
        }),
        sectionReview.preview.before_text === sectionReview.preview.current_text && sectionReview.preview.before_html !== sectionReview.preview.current_html && h("p", { className: "ws-muted" }, "The text is unchanged; the highlighted section\u2019s formatting will change."),
        h("p", { className: "ws-muted" }, "If the page changes while this dialog is open, this approval expires. Cancel keeps all current changes.")
      ),
      onClose: () => {
        setSectionReview(null);
        restoreSectionReading(sectionReview.reading);
      },
      onSubmit: async () => {
        try {
          await applySection(sectionReview.preview, true);
        } catch (error) {
          setSectionReview((current) => current?.preview === sectionReview.preview ? { ...current, expired: true } : current);
          throw error;
        }
      },
      onSuccessFocus: () => document.getElementById(`ws-bubble-${sectionReview.commentId}`)?.focus({ preventScroll: true })
    }),
    locked && h(
      "div",
      { className: "ws-banner ws-run-banner", role: "status", "aria-label": "Active Workspace run" },
      h(GlyphSpinner2, { ariaLabel: "Hermes is working" }),
      h(
        "strong",
        null,
        currentRun ? "Read-only while Hermes addresses comments" : "Preparing comment run\u2026"
      ),
      h(
        "span",
        null,
        typeof currentRun?.progress === "string" ? currentRun.progress : currentRun?.status ?? "Editing is disabled while this run is prepared."
      ),
      currentRun && h(Action, { disabled: pending, onClick: () => act(stop) }, "Stop"),
      currentRun && h(
        Action,
        {
          disabled: pending,
          onClick: () => confirm({
            title: "Recover document?",
            description: "The native thread may continue. This revokes its Workspace edit authority and unlocks this document. Saved partial changes and the pre-run version remain available for Restore. The native outcome remains unknown; this does not confirm the thread stopped.",
            label: "Revoke Workspace edits",
            skipFlush: true,
            action: async () => {
              try {
                await workflow.recover(currentRun);
              } finally {
                if (client.current()) await refresh();
              }
            }
          })
        },
        "Recover document"
      )
    ),
    lastRun && !locked && lastRun.status !== "completed" && h(
      "div",
      { className: "ws-banner ws-run-banner ws-outcome", role: "status", "aria-label": "Workspace run needs review" },
      h("strong", null, lastRun.status === "cancelled" ? "Run stopped \u2014 review saved changes" : "Run needs review"),
      h("span", null, "Saved changes may be partial. The native thread may still be running."),
      h(
        "div",
        { className: "ws-actions" },
        h(Action, { disabled: !preRunVersions.length, onClick: (event) => openLocalDialog("version", event.currentTarget) }, "Restore pre-run version"),
        h(Action, { disabled: !item.thread_id, onClick: () => act(() => workflow.openThread(item.thread_id)) }, "Open run thread")
      ),
      h(
        "details",
        null,
        h("summary", null, "Run outcome details"),
        h("p", null, lastRun.error ? errorMessage(lastRun.error) : `Last run: ${lastRun.status}. Saved partial changes may remain.`),
        h("p", null, "Restoring Workspace content does not confirm that the native thread stopped. Comments remain yours to resolve.")
      )
    ),
    h(
      "article",
      { className: "ws-document", "aria-labelledby": headingId },
      lastRun?.status === "completed" && !locked && h("div", { className: "ws-save", role: "status" }, "Last run completed. Comments remain yours to resolve."),
      h(
        "div",
        { className: "ws-document-header" },
        h(
          "div",
          { className: "ws-page-kind" },
          h(Codicon, {
            name: item.kind === "database" ? "table" : item.kind === "folder" ? "folder" : "file-text"
          }),
          item.kind === "record" ? "Record" : item.kind === "database" ? "Database" : item.kind === "folder" ? "Folder" : "Page"
        ),
        h(PageTitle, {
          item,
          locked,
          interactionBlocked: sectionFrozen,
          buffer: titleBuffer,
          headingId,
          registerFlush: registerTitleFlush,
          onError,
          onSave: (title) => command("update_item", { id: item.id, patch: { title } })
        }),
        h(
          "div",
          { className: "ws-page-actions" },
          h(
            ActionMenu,
            { label: "Page actions", disabled: sectionBusy },
            item.kind !== "folder" && h(Action, {
              onClick: (_event, opener) => openPageSurface("details", opener)
            }, "Page details"),
            item.kind !== "folder" && h(Action, {
              onClick: (_event, opener) => openPageSurface("export", opener)
            }, "Export and recovery"),
            ["page", "record"].includes(item.kind) && h(Action, {
              onClick: () => act(() => {
                client.assertCurrent();
                documentWidth.toggle();
              })
            }, `Wide document mode: ${documentWidth.wide ? "On" : "Off"}`),
            ["page", "record"].includes(item.kind) && h(
              Action,
              {
                disabled: locked,
                onClick: (_event, opener) => openLocalDialog("template", opener)
              },
              "Save as template"
            ),
            item.kind !== "record" && h(
              Action,
              {
                disabled: locked,
                onClick: (_event, opener) => openLocalDialog("move", opener)
              },
              "Move to folder"
            ),
            h(
              Action,
              {
                disabled: locked,
                onClick: () => confirm({
                  title: `Move ${item.title} to Trash?`,
                  description: item.kind === "folder" ? "This folder and every page, database and record inside it move to Trash. You can restore them later." : "You can restore this item from Trash.",
                  label: "Move to Trash",
                  action: () => command("trash", { id: item.id })
                })
              },
              "Move to Trash"
            )
          )
        )
      ),
      documentWidth.error && h("p", { className: "ws-muted", role: "status" }, documentWidth.error),
      item.kind === "folder" ? h(
        "section",
        null,
        h("h2", null, "In this folder"),
        h(
          "div",
          { className: "ws-actions" },
          h(
            Action,
            { onClick: () => setDialog({ kind: "page" }) },
            "New page"
          ),
          h(
            Action,
            { onClick: () => setDialog({ kind: "folder" }) },
            "New subfolder"
          ),
          h(
            Action,
            { onClick: () => setDialog({ kind: "database" }) },
            "New database"
          )
        ),
        h(
          "ul",
          { className: "ws-list" },
          state.items.filter((i) => !i.deleted_at && i.parent_id === item.id).map(
            (i) => h(
              "li",
              { key: i.id },
              h(
                Action,
                { variant: "link", onClick: () => onOpen(i.id) },
                i.title
              )
            )
          )
        )
      ) : h(
        "div",
        null,
        item.kind === "record" && h(
          "div",
          null,
          database && h(
            Action,
            { variant: "link", onClick: () => onOpen(database.id) },
            database.title
          ),
          h(RecordProperties, {
            item,
            database,
            propertyBuffer,
            registerPropertyFlush,
            state,
            command,
            locked,
            interactionBlocked: sectionFrozen,
            onError
          })
        ),
        h("div", { className: "ws-comment-controls-slot", "aria-hidden": true }),
        item.kind === "database" ? h(Database, {
          item,
          propertyBuffer,
          registerPropertyFlush,
          state,
          command,
          onOpen,
          onError,
          locked,
          confirm
        }) : h(RichEditor, {
          item,
          registerKeybind: ctx.register,
          workspaceItems: state.items,
          locked,
          interactionBlocked: sectionFrozen,
          registerPendingFiles,
          onSave: safeSave,
          onText: setText,
          registerFlush: registerBodyFlush,
          onError,
          draftBuffer,
          attachments: state.attachments,
          onImage: async (file) => {
            const data_base64 = await fileBase64(file);
            client.assertCurrent();
            return command("add_attachment", {
              item_id: item.id,
              name: file.name,
              media_type: file.type,
              data_base64
            });
          },
          onLink: (url) => act(() => ctx.os.openExternal(url)),
          comments: pageComments,
          activeComment,
          hoveredComment,
          onCommentHover: setHoveredComment,
          onCommentGeometry: receiveGeometry,
          pendingAnchor: anchor,
          onComment: revealComment,
          registerFocus: (focus) => {
            editorFocus.current = focus;
          },
          onAnchor: (value) => value.navigate ? onOpen(value.navigate) : setAnchor(value)
        }),
        h("input", {
          ref: attachment,
          type: "file",
          hidden: true,
          onChange: (e) => {
            const file = e.target.files[0];
            e.target.value = "";
            if (file)
              act(async () => {
                const data_base64 = await fileBase64(file);
                client.assertCurrent();
                await command("add_attachment", {
                  item_id: item.id,
                  name: file.name,
                  media_type: file.type || "application/octet-stream",
                  data_base64
                });
              });
          }
        }),
        h(
          "div",
          { className: "ws-attachments" },
          h("h2", null, "Attachments"),
          attachmentLabels(state.attachments.filter((a) => a.item_id === item.id)).map(
            ({ attachment: a, label, detail }) => h(
              "div",
              { key: a.id },
              h(
                Action,
                { variant: "link", "aria-describedby": `ws-attachment-${a.id}`, onClick: () => attachmentDownload(a) },
                label
              ),
              h("span", { id: `ws-attachment-${a.id}`, className: "ws-muted ws-attachment-detail" }, detail)
            )
          )
        )
      ),
      pageSurface && h(ContentDialog, {
        title: pageSurface === "details" ? "Page details" : "Export and recovery",
        description: item.title,
        returnFocus: surfaceOpener.current,
        busy: surfaceBusy,
        skipReturnFocus: () => surfaceTransfer.current,
        onClose: () => {
          if (!surfaceBusy) setPageSurface(null);
        }
      }, pageSurface === "details" ? h("p", { className: "ws-muted ws-item-id" }, `Workspace item ID: ${item.id}`) : h(
        "div",
        { className: "ws-page-utilities" },
        h("h3", null, item.kind === "database" ? "Export table" : "Export document"),
        h(
          "div",
          { className: "ws-actions" },
          ["md", "csv", "docx", "pdf"].filter((format) => item.kind === "database" ? format === "csv" : format !== "csv").map((format) => h(Action, {
            key: format,
            disabled: surfaceBusy,
            onClick: async () => {
              if (surfaceBusy) return;
              setSurfaceBusy(true);
              setSurfaceError("");
              try {
                await flush.current();
                const result = await client.transfer(`/export/${encodeURIComponent(item.id)}?format=${format}`);
                client.assertCurrent();
                downloadFile(result.download ?? result.result ?? result);
              } catch (error) {
                setSurfaceError(errorMessage(error));
              } finally {
                setSurfaceBusy(false);
              }
            }
          }, `Export ${format.toUpperCase()}`))
        ),
        h("p", { className: "ws-muted" }, "Document exports are not a full Workspace backup. Use the Workspace menu for a complete backup."),
        h("h3", null, "Attachments and recovery"),
        h(
          "div",
          { className: "ws-actions" },
          h(Action, { disabled: locked || surfaceBusy, onClick: () => attachment.current.click() }, "Attach file"),
          h(Action, {
            disabled: locked || surfaceBusy || !preRunVersions.length,
            onClick: () => {
              surfaceTransfer.current = true;
              setPageSurface(null);
              openLocalDialog("version", surfaceOpener.current);
            }
          }, "Restore pre-run version"),
          sectionVersions.length > 0 && h(Action, {
            disabled: locked || surfaceBusy,
            onClick: () => {
              surfaceTransfer.current = true;
              setPageSurface(null);
              openLocalDialog("section-version", surfaceOpener.current);
            }
          }, "Recover before section revert")
        ),
        surfaceBusy && h("p", { role: "status" }, "Preparing export\u2026"),
        surfaceError && h("p", { role: "alert", className: "ws-save-error" }, surfaceError)
      )),
      localDialog && h(FormDialog, {
        returnFocus: localDialogOpener.current,
        confirm: versionDialog ? localDialog === "section-version" ? "Restore whole-page version" : "Restore pre-run version" : "Save",
        title: localDialog === "template" ? "Save template" : localDialog === "move" ? "Move to folder" : localDialog === "section-version" ? "Recover before section revert" : "Restore pre-run version",
        description: versionDialog ? localDialog === "section-version" ? "This restores the whole page, title and properties saved immediately before a section revert. It can replace later changes elsewhere on the page. Comments and replies remain user controlled." : "Restoring replaces the saved content and properties with the snapshot from before that run. Comments remain user controlled." : void 0,
        fields: localDialog === "template" ? [{ name: "name", label: "Template name" }] : localDialog === "move" ? [
          {
            name: "parent_id",
            label: "Destination folder",
            options: folderDestinations(state.items, item.id)
          }
        ] : [
          {
            name: "id",
            label: localDialog === "section-version" ? "Before section revert" : "Pre-run version",
            options: versionChoices(dialogVersions)
          }
        ],
        initial: localDialog === "move" ? { parent_id: item.parent_id ?? "" } : versionDialog ? { id: dialogVersions.at(-1)?.id } : {},
        onClose: () => setLocalDialog(null),
        renderHelp: versionDialog ? (values) => {
          const version = dialogVersions.find((row) => row.id === values.id);
          return version && h(
            "details",
            null,
            h("summary", null, "Version details"),
            h("p", null, "Exact saved time: ", h("time", { dateTime: version.created_at }, version.created_at)),
            h("p", null, "Version ID: ", h("code", null, version.id))
          );
        } : void 0,
        onSubmit: async (values) => {
          await flush.current();
          if (localDialog === "template")
            await command("save_template", {
              item_id: item.id,
              name: values.name
            });
          else if (localDialog === "move")
            await command("update_item", {
              id: item.id,
              patch: { parent_id: values.parent_id || null }
            });
          else await command("restore_version", { id: values.id });
        }
      })
    ),
    item.kind !== "folder" && h(Comments, {
      key: item.id,
      item,
      draftBuffer: discussionBuffer,
      registerFlush: registerDiscussionFlush,
      state,
      text,
      anchor,
      setAnchor,
      activeComment,
      setActiveComment,
      geometry: commentGeometry,
      hoveredComment,
      setHoveredComment,
      showResolved,
      setShowResolved,
      returnToEditor,
      onPassage: (id, passage) => {
        setActiveComment(id);
        editorFocus.current?.(passage);
      },
      command,
      workflow,
      run: lastRun,
      locked: locked || pending || sectionBusy,
      onRevertSection: revertSection,
      onError,
      onRun: address,
      onRefresh: refresh
    })
  );
}

// frontend/backend-activation.mjs
async function activateWorkspaceBackend(ctx, host5, activationEpoch, publish = () => {
}) {
  let disposed = false;
  ctx.onDispose(() => {
    disposed = true;
  });
  const connectionId = host5.activeConnectionId();
  const profile = host5.state.profile.get();
  const epoch = activationEpoch();
  const current = () => {
    if (disposed) return false;
    if (host5.activeConnectionId() !== connectionId || host5.state.profile.get() !== profile || activationEpoch() !== epoch)
      throw new Error("Hermes profile or connection changed while enabling Workspace. Toggle Workspace on again.");
    return true;
  };
  const complete = () => {
    if (!current()) return false;
    publish();
    return true;
  };
  if (!connectionId || !profile)
    throw new Error("Select a Hermes profile before enabling Workspace.");
  const routes = await host5.profileRoutes();
  if (!current()) return false;
  const matches = routes.filter((route2) => route2.connectionId === connectionId && route2.profile === profile);
  if (matches.length !== 1)
    throw new Error("The selected Hermes profile route is unavailable or ambiguous.");
  const route = Object.freeze({ ...matches[0] });
  const request = (params) => host5.requestProfile(route, "plugins.manage", { ...params, profile: route.targetProfile });
  const pluginRow = (result2) => {
    const rows = Array.isArray(result2?.plugins) ? result2.plugins.filter((row) => row.key === "workspace") : [];
    if (rows?.length !== 1)
      throw new Error("Workspace is not installed unambiguously in this profile. Install its package before enabling it.");
    return rows[0];
  };
  const inventory = await request({ action: "list" });
  if (!current()) return false;
  if (pluginRow(inventory).status === "enabled") return complete();
  if (host5.pluginDecisions?.get()?.workspace !== true)
    throw new Error("Workspace backend is off. Turn Workspace on in Capabilities \u2192 Plugins to enable it.");
  const result = await request({ action: "toggle", key: "workspace", enable: true });
  if (!current()) return false;
  if (result?.ok !== true)
    throw new Error(result?.error || "Hermes refused to enable the Workspace backend.");
  if (result.activation?.missing_dependencies?.length)
    throw new Error("Workspace was enabled, but Hermes must restart to load its dependencies.");
  const confirmed = await request({ action: "list" });
  if (!current()) return false;
  if (pluginRow(confirmed).status !== "enabled")
    throw new Error("Hermes did not confirm that the Workspace backend is enabled.");
  return complete();
}

// frontend/index.jsx
var index_default = {
  id: "workspace",
  name: "Workspace",
  defaultEnabled: true,
  register(ctx) {
    return activateWorkspaceBackend(ctx, host4, gatewayActivationEpoch3, () => {
      ctx.register({
        id: "page",
        area: ROUTES_AREA,
        data: { path: "/workspace" },
        render: () => h2(Workspace, { ctx })
      });
      ctx.register({
        id: "nav",
        area: SIDEBAR_NAV_AREA,
        data: { path: "/workspace", label: "Workspace", codicon: "notebook" }
      });
    });
  }
};
export {
  index_default as default
};
