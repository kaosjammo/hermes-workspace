import { test } from "node:test";
import assert from "node:assert/strict";
import { commentAnchor, locateAnchor } from "../../frontend/editor.mjs";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
const { anchorRange } = await import("../../.local/frontend/ui-runtime.mjs");
function root(html) {
  const { window } = new JSDOM("<article>" + html + "</article>");
  return window.document.querySelector("article");
}
test("per-comment addressed display stays small and unavailable changes never use a broad fallback", () => {
  const el = root("<p>First addressed. Second addressed. Unchanged outside.</p>");
  const first = { quote: "addressed", prefix: "First ", suffix: ". Second addressed. Unchanged out" };
  const second = { quote: "addressed", prefix: "First addressed. Second ", suffix: ". Unchanged outside." };
  for (const value of [first, second]) {
    const c = { anchor: { quote: el.textContent }, section_change: { status: "available", anchor: value } };
    assert.equal(anchorRange(el, commentAnchor(c)).toString(), "addressed");
  }
  assert.notEqual(locateAnchor(el.textContent, first).start, locateAnchor(el.textContent, second).start);
  const original = { quote: el.textContent };
  for (const change of [{ status: "unavailable" }, { status: "available", highlight_status: "unavailable" }]) {
    const c = { anchor: original, section_change: change };
    assert.equal(anchorRange(el, commentAnchor(c)), null);
    assert.equal(c.anchor, original, "derived display must not mutate stored selection");
  }
  assert.equal(commentAnchor({ anchor: original, section_change: { status: "reverted" } }), original);
});
test("passage decorations span inline formatting and blocks without changing saved HTML", () => {
  const el = root("<p>North <strong>river</strong></p><p>walk south.</p>");
  const html = el.innerHTML;
  const range = anchorRange(el, {
    quote: "riverwalk",
    prefix: "North ",
    suffix: " south.",
  });
  assert.equal(range.toString(), "riverwalk");
  assert.equal(el.innerHTML, html);
});
test("repeated, missing and changed-context passages remain detached", () => {
  const el = root("<p>same text; same text</p>");
  assert.equal(anchorRange(el, { quote: "same text" }), null);
  assert.equal(anchorRange(el, { quote: "missing" }), null);
  assert.equal(
    anchorRange(el, { quote: "same text", prefix: "changed" }),
    null,
  );
  const range = anchorRange(el, { quote: "same text", prefix: "same text; " });
  assert.equal(range.startOffset, 11);
});
test("Unicode selection offsets remain DOM UTF-16 offsets and exclude gutter numbering", () => {
  const el = root("<p>🌱 A <em>café</em> journey.</p>");
  const range = anchorRange(el, {
    quote: "A café",
    prefix: "🌱 ",
    suffix: " journey.",
  });
  assert.equal(range.toString(), "A café");
  assert.equal(el.textContent, "🌱 A café journey.");
});
