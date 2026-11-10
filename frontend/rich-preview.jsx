import { Fragment, useLayoutEffect, useRef } from "react";
import { h } from "./ui.jsx";
import { editorStyles } from "./editor-styles.mjs";
import { sanitizeHTML, hydrateImages, hydrateChecklists } from "./editor.mjs";

/** Read-only consent rendering uses the same rich boundary as the editor. */
export function RichPreview({ label, html, text, attachments }) {
  const root = useRef(null);
  const safe = sanitizeHTML(html ?? "");
  useLayoutEffect(() => {
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
      ...(html == null
        ? { children: text }
        : { dangerouslySetInnerHTML: { __html: safe } }),
    }),
  );
}
