import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  sanitizeHTML,
  captureAnchor,
  locateAnchor,
  safeHref,
  safeImage,
} from "../../frontend/editor.mjs";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
test("production HTML boundary strips executable paste/import while preserving every editor capability", () => {
  const { window } = new JSDOM("");
  const raw =
    '<h1>Heading</h1><p><strong>Bold</strong><em>Italic</em><u>Underlined</u></p><ul><li>List</li></ul><ol><li>Ordered</li></ol><p><input type="checkbox" checked>Task</p><blockquote>Quote</blockquote><pre><code>let x=1</code></pre><table><tbody><tr><td>Cell</td></tr></tbody></table><a href="https://example.test" onclick="alert(1)">Link</a><img src="data:image/png;base64,aGVsbG8=" alt="Image"><script>bad()</script><svg onload="bad()"></svg><iframe srcdoc="bad"></iframe><img src="https://tracker.test/x"><a href="javascript:bad()">bad</a><p style="background:url(https://tracker.test)">Text</p>';
  const clean = sanitizeHTML(raw, window.document);
  const out = window.document.createElement("div");
  out.innerHTML = clean;
  for (const tag of [
    "h1",
    "strong",
    "em",
    "u",
    "ul",
    "ol",
    "input",
    "blockquote",
    "pre",
    "code",
    "table",
    "a",
    "img",
  ])
    assert.ok(out.querySelector(tag), tag);
  assert.equal(
    out.querySelectorAll("script,svg,iframe,[onclick],[onload],[style]").length,
    0,
  );
  assert.equal(out.querySelectorAll("img").length, 1);
  assert.equal(out.querySelector('a[href^="javascript:"]'), null);
  assert.ok(out.querySelector("input").checked);
  assert.equal(safeHref("java\nscript:alert(1)"), null);
  assert.equal(safeImage("data:image/svg+xml;base64,abcd"), null);
});
test("production selection anchor captures DOM selection and rejects selections outside editor", () => {
  const { window } = new JSDOM(
    '<div id="editor"><p>Prefix needle suffix</p></div><p id="other">outside</p>',
  );
  const root = window.document.querySelector("#editor");
  const selection = window.getSelection();
  const range = window.document.createRange();
  range.setStart(root.firstChild.firstChild, 7);
  range.setEnd(root.firstChild.firstChild, 13);
  selection.addRange(range);
  const anchor = captureAnchor(root, selection);
  assert.equal(anchor.quote, "needle");
  assert.equal(locateAnchor(root.textContent, anchor).status, "attached");
  range.selectNodeContents(window.document.querySelector("#other"));
  selection.removeAllRanges();
  selection.addRange(range);
  assert.equal(captureAnchor(root, selection), null);
});
test("production image hydration never fetches remote content and roundtrips immutable attachment references", async () => {
  const { editorHTML, hydrateImages } =
    await import("../../frontend/editor.mjs");
  const { window } = new JSDOM("");
  const root = window.document.createElement("div");
  root.innerHTML = sanitizeHTML(
    '<p><img src="attachment:img1" alt="Example"><img src="https://tracker.test/x"></p>',
    window.document,
  );
  hydrateImages(root, [
    { id: "img1", media_type: "image/png", data_base64: "aGVsbG8=" },
  ]);
  assert.equal(root.querySelectorAll("img").length, 1);
  assert.ok(root.querySelector("img").src.startsWith("data:image/png;base64,"));
  const saved = editorHTML(root);
  assert.match(saved, /src="attachment:img1"/);
  assert.doesNotMatch(saved, /data:image|data-workspace-attachment|https:/);
});
