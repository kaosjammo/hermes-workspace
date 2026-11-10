import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  formatBlocks,
  toggleList,
  insertBlockHTML,
  EditorHistory,
} from "../../frontend/editor-commands.mjs";
import { sanitizeHTML } from "../../frontend/editor.mjs";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
function fixture(html) {
  const { window } = new JSDOM(
    '<div id="editor" contenteditable="true"></div>',
  );
  const root = window.document.querySelector("#editor");
  root.innerHTML = html;
  const caret = (node) => {
    const range = window.document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);
  };
  return { root, window, caret };
}
test("production block transactions preserve list/quote/code structure and table cells across sanitization/reparse", () => {
  const { root, window, caret } = fixture("<p>Nested block</p><p>Tail</p>");
  caret(root.firstChild);
  formatBlocks(root, "h1");
  formatBlocks(root, "p");
  toggleList(root, "ul");
  formatBlocks(root, "blockquote");
  formatBlocks(root, "p");
  assert.equal(root.querySelectorAll("blockquote").length, 0);
  assert.equal(root.querySelectorAll("ul li").length, 1);
  formatBlocks(root, "pre");
  assert.equal(root.querySelectorAll("ul li pre code").length, 1);
  formatBlocks(root, "p");
  assert.equal(root.querySelectorAll("ul li").length, 1);
  insertBlockHTML(
    root,
    "<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>",
  );
  const saved = sanitizeHTML(root.innerHTML, window.document);
  const reopen = window.document.createElement("div");
  reopen.innerHTML = saved;
  assert.equal(reopen.querySelectorAll("table td").length, 4);
  assert.equal(
    reopen.querySelectorAll("p table,p ul,p blockquote,pre ul").length,
    0,
  );
  assert.match(reopen.textContent, /Nested block/);
  assert.match(reopen.textContent, /Tail/);
  assert.ok(
    (window.getSelection().anchorNode.nodeType === 3
      ? window.getSelection().anchorNode.parentElement
      : window.getSelection().anchorNode
    ).closest("td"),
  );
});
test("production structural history restores content and caret and truncates redo only for a new edit", () => {
  const { root, window, caret } = fixture("<p>Alpha</p>");
  caret(root.firstChild);
  const history = new EditorHistory();
  history.reset(root);
  formatBlocks(root, "blockquote");
  history.record(root);
  const quoted = root.innerHTML;
  insertBlockHTML(root, "<table><tbody><tr><td>Cell</td></tr></tbody></table>");
  history.record(root);
  assert.equal(history.move(root, -1), true);
  assert.equal(root.innerHTML, quoted);
  assert.equal(history.move(root, 1), true);
  assert.equal(root.querySelectorAll("td").length, 1);
  assert.ok(
    (window.getSelection().anchorNode.nodeType === 3
      ? window.getSelection().anchorNode.parentElement
      : window.getSelection().anchorNode
    ).closest("td"),
  );
  history.move(root, -1);
  root.firstElementChild.append(window.document.createTextNode("New"));
  history.record(root);
  assert.equal(history.move(root, 1), false);
});
test("empty paragraph style keeps the caret inside the structural block", () => {
  const { root, window, caret } = fixture("");
  caret(root);
  formatBlocks(root, "h1");
  assert.equal(root.firstElementChild.tagName, "H1");
  const anchor = window.getSelection().anchorNode;
  assert.ok(
    anchor === root.firstElementChild ||
      root.firstElementChild.contains(anchor),
  );
});
