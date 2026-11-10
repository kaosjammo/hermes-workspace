import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as commands from "../../frontend/editor-commands.mjs";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
function fixture(html) {
  const { window } = new JSDOM('<div contenteditable="true"></div>');
  const root = window.document.querySelector("div");
  root.innerHTML = html;
  return {
    root,
    window,
    select(a, ao, b = a, bo = ao) {
      const r = window.document.createRange();
      r.setStart(a, ao);
      r.setEnd(b, bo);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    },
  };
}
test("caret and partial range styles preserve unselected multi-item and nested list leaves", () => {
  const f = fixture(
    "<ul><li>Alpha<ul><li>Inner one</li><li>Inner two</li></ul></li><li>Beta</li><li>Gamma</li></ul>",
  );
  const { root, select } = f;
  select(root.firstChild.firstChild.firstChild, 2);
  commands.formatBlocks(root, "h1");
  assert.equal(root.querySelectorAll("h1").length, 1);
  assert.equal(root.querySelector("h1").textContent, "Alpha");
  assert.equal(root.querySelectorAll("ul ul h1").length, 0);
  assert.equal(root.querySelector("ul").lastElementChild.innerHTML, "Gamma");
  const inner = root.querySelector("ul ul");
  select(inner.firstChild.firstChild, 2, inner.lastChild.firstChild, 4);
  commands.formatBlocks(root, "blockquote");
  assert.equal(inner.querySelectorAll("blockquote").length, 2);
  assert.equal(root.querySelector("ul").lastElementChild.innerHTML, "Gamma");
  select(inner.firstChild.querySelector("p").firstChild, 1);
  commands.formatBlocks(root, "p");
  assert.equal(inner.querySelectorAll("blockquote").length, 1);
});
test("list toggle splits only selected items and keeps nested/unselected content valid through reparse", () => {
  const { root, window, select } = fixture(
    "<ul><li>Alpha</li><li>Beta<ul><li>Inner one</li><li>Inner two</li></ul></li><li>Gamma</li></ul>",
  );
  select(root.firstChild.firstChild.firstChild, 2);
  commands.toggleList(root, "ul");
  assert.equal(root.firstChild.outerHTML, "<p>Alpha</p>");
  assert.equal(root.querySelector("ul").children.length, 2);
  assert.equal(root.querySelector("ul li").firstChild.textContent, "Beta");
  const inner = root.querySelector("ul ul");
  select(inner.firstChild.firstChild, 1);
  commands.toggleList(root, "ol");
  assert.equal(root.querySelector("ol li").textContent, "Inner one");
  assert.equal(root.querySelector("ul ul li").textContent, "Inner two");
  const html = root.innerHTML;
  const parsed = window.document.createElement("div");
  parsed.innerHTML = html;
  assert.equal(parsed.innerHTML, html);
  assert.equal(root.lastElementChild.lastElementChild.textContent, "Gamma");
});
test("rich paste replaces partial selection and inserts at collapsed caret with one safe history unit", () => {
  for (const collapsed of [false, true]) {
    const { root, window, select } = fixture(
      "<p>Alpha <strong>Bravo</strong> Charlie</p><p>Tail</p>",
    );
    const text = root.querySelector("strong").firstChild;
    select(text, collapsed ? 2 : 0, text, collapsed ? 2 : 5);
    const history = new commands.EditorHistory();
    history.reset(root);
    const before = root.innerHTML;
    // Existing block insertion is intentionally the failing baseline until paste has its own transaction.
    (commands.pasteBlockHTML ?? commands.insertBlockHTML)(
      root,
      '<p>Replacement</p><table><tbody><tr><td>Cell</td></tr></tbody></table><p onclick="bad()">After<script>bad()</script></p>',
    );
    history.record(root);
    assert.equal(
      root.textContent,
      collapsed
        ? "Alpha BrReplacementCellAfteravo CharlieTail"
        : "Alpha ReplacementCellAfter CharlieTail",
    );
    assert.equal(
      root.firstElementChild.textContent,
      collapsed ? "Alpha Br" : "Alpha ",
    );
    assert.equal(root.querySelectorAll("p table,p p").length, 0);
    assert.equal(root.querySelector("script"), null);
    assert.equal(root.querySelector("[onclick]"), null);
    const after = root.innerHTML;
    assert.equal(history.move(root, -1), true);
    assert.equal(root.innerHTML, before);
    assert.equal(history.move(root, 1), true);
    assert.equal(root.innerHTML, after);
    const s = window.getSelection();
    assert.equal(s.isCollapsed, true);
    assert.equal(s.anchorNode.textContent, "After");
  }
});

test("bare TD and TH rich paste retains the owning table for caret, selected text and cell endpoints", () => {
  for (const tag of ["td", "th"]) {
    for (const mode of ["selection", "caret", "cell-endpoints"]) {
      const { root, window, select } = fixture(
        `<table><tbody><tr><${tag}>Alpha Bravo</${tag}><td>Beta</td></tr><tr><td>Gamma</td><td>Delta</td></tr></tbody></table><p>Tail</p>`,
      );
      const table = root.firstElementChild,
        cell = table.rows[0].cells[0];
      const siblings = [...table.querySelectorAll("td,th")]
        .slice(1)
        .map((n) => n.outerHTML);
      if (mode === "cell-endpoints")
        select(cell, 0, cell, cell.childNodes.length);
      else
        select(cell.firstChild, 6, cell.firstChild, mode === "caret" ? 6 : 11);
      const history = new commands.EditorHistory();
      history.reset(root);
      const before = root.innerHTML;
      commands.pasteBlockHTML(
        root,
        '<p onclick="bad()">Replacement<script>bad()</script></p>',
      );
      history.record(root);
      assert.equal(
        root.querySelectorAll("table").length,
        1,
        `${tag}/${mode} table`,
      );
      assert.equal(table.rows.length, 2);
      assert.equal(table.querySelectorAll("td,th").length, 4);
      assert.equal(table.isConnected, true);
      assert.equal(
        cell.textContent,
        mode === "caret"
          ? "Alpha ReplacementBravo"
          : mode === "selection"
            ? "Alpha Replacement"
            : "Replacement",
      );
      assert.equal(cell.querySelector("p").textContent, "Replacement");
      assert.deepEqual(
        [...table.querySelectorAll("td,th")].slice(1).map((n) => n.outerHTML),
        siblings,
      );
      assert.equal(root.lastElementChild.outerHTML, "<p>Tail</p>");
      assert.equal(root.querySelector("script,[onclick]"), null);
      assert.equal(window.getSelection().isCollapsed, true);
      assert.ok(cell.contains(window.getSelection().anchorNode));
      const after = root.innerHTML,
        parsed = window.document.createElement("div");
      parsed.innerHTML = after;
      assert.equal(parsed.innerHTML, after);
      assert.equal(history.move(root, -1), true);
      assert.equal(root.innerHTML, before);
      assert.equal(history.move(root, 1), true);
      assert.equal(root.innerHTML, after);
      assert.ok(
        root.querySelector(tag).contains(window.getSelection().anchorNode),
      );
    }
  }
});

test("same-cell mixed endpoints and wrapped rich fragments preserve other rows and nested safe blocks", () => {
  for (const wrapped of [false, true]) {
    const { root, window, select } = fixture(
      `<table><tbody><tr><td>${wrapped ? "<p>" : ""}Alpha <strong>Bravo</strong> Charlie${wrapped ? "</p>" : ""}</td><td>Beta</td></tr><tr><td>Gamma</td><td>Delta</td></tr></tbody></table>`,
    );
    const table = root.firstElementChild,
      cell = table.rows[0].cells[0],
      block = wrapped ? cell.firstChild : cell;
    const siblings = [...table.rows].map((row) =>
      [...row.cells].map((c) => c.outerHTML),
    );
    select(block.firstChild, 3, block.lastChild, 4);
    commands.pasteBlockHTML(
      root,
      "<blockquote><p>Replacement</p></blockquote><table><tbody><tr><td>Nested</td></tr></tbody></table><pre><code>Code</code></pre>",
    );
    assert.equal(root.children.length, 1);
    assert.equal(root.firstElementChild, table);
    assert.equal(table.rows.length, 2);
    assert.equal(table.rows[0].cells.length, 2);
    assert.equal(cell.textContent, "AlpReplacementNestedCoderlie");
    assert.equal(cell.querySelectorAll("blockquote,pre,table").length, 3);
    assert.equal(table.rows[0].cells[1].outerHTML, siblings[0][1]);
    assert.deepEqual(
      [...table.rows[1].cells].map((c) => c.outerHTML),
      siblings[1],
    );
    assert.ok(cell.contains(window.getSelection().anchorNode));
    const html = root.innerHTML,
      parsed = window.document.createElement("div");
    parsed.innerHTML = html;
    assert.equal(parsed.innerHTML, html);
  }
});

test("comment layout gaps never enter history and selection survives normalized undo and redo", () => {
  const { root, window, select } = fixture("<p>Opening <strong>orchard</strong> passage and closing note.</p>");
  const history = new commands.EditorHistory();
  const text = root.querySelector("p").lastChild;
  const tail = text.splitText(9), gap = window.document.createElement("span");
  gap.setAttribute("data-workspace-comment-gap", ""); gap.setAttribute("contenteditable", "false"); gap.style.height = "150px";
  tail.before(gap);
  select(tail, 1, tail, 4);
  const selected = window.getSelection().toString();
  history.reset(root);
  assert.equal(window.getSelection().toString(), selected);
  assert.equal(root.querySelector("[data-workspace-comment-gap]"), null);
  assert.equal(history.entries[0].html, "<p>Opening <strong>orchard</strong> passage and closing note.</p>");
  root.querySelector("strong").textContent = "garden"; history.record(root);
  assert.equal(history.move(root, -1), true);
  assert.equal(window.getSelection().toString(), selected);
  assert.equal(history.move(root, 1), true);
  assert.doesNotMatch(root.innerHTML, /comment-gap|height/);
  assert.match(root.innerHTML, /<strong>garden<\/strong>/);
  root.innerHTML = '<p>Opening<span data-workspace-comment-gap=""></span> remaining text.</p>';
  select(root.firstChild, 2);
  history.reset(root);
  const caret = window.getSelection().getRangeAt(0), before = caret.cloneRange();
  before.selectNodeContents(root); before.setEnd(caret.startContainer, caret.startOffset);
  assert.equal(before.toString().length, 7, "An element-boundary caret stays after Opening, not at the paragraph end");
});


test("Text style keeps the entered empty quoted paragraph caret through typing and code formatting", () => {
  for (const offset of [0, 1]) {
    const { root, window, select } = fixture("<div><blockquote><p>Quoted field note.</p><p><br></p></blockquote></div>");
    const empty = root.querySelector("blockquote").lastElementChild;
    select(empty, offset);
    assert.equal(commands.formatBlocks(root, "p"), true);
    const paragraph = root.firstElementChild.lastElementChild;
    const selected = window.getSelection();
    assert.equal(paragraph.tagName, "P");
    assert.equal(root.querySelector("blockquote").innerHTML, "<p>Quoted field note.</p>");
    assert.equal(selected.anchorNode === paragraph, true, "Collapsed caret owns the new Text paragraph, not previous quote text");
    assert.equal(selected.focusNode === paragraph, true);
    assert.equal(selected.anchorOffset, offset);
    assert.equal(selected.focusOffset, offset);
    const insertion = window.document.createTextNode("const level = 3;");
    const range = selected.getRangeAt(0);range.insertNode(insertion);range.setStartAfter(insertion);range.collapse(true);selected.removeAllRanges();selected.addRange(range);
    commands.formatBlocks(root, "pre");
    assert.equal(root.querySelector("blockquote").innerHTML, "<p>Quoted field note.</p>");
    assert.equal(root.querySelector("pre code").textContent.trim(), "const level = 3;");
    window.close();
  }
});

test("block formatting and text fallback preserve backward selection direction and nonempty offsets", () => {
  const { root, window } = fixture("<p>Alpha</p><p>Tail</p>");
  const selected = window.getSelection(), text = root.firstChild.firstChild;
  selected.setBaseAndExtent(text, 4, text, 1);
  const bookmark = commands.selectionBookmark(root);
  commands.formatBlocks(root, "h2");
  assert.equal(selected.toString(), "lph");
  assert.equal(selected.anchorOffset, 4, "Backward anchor remains at the end");
  assert.equal(selected.focusOffset, 1);
  assert.equal(root.lastElementChild.outerHTML, "<p>Tail</p>");
  root.innerHTML = root.innerHTML;
  commands.restoreBookmark(root, bookmark, true);
  assert.equal(selected.toString(), "lph");
  assert.equal(selected.anchorOffset, 4);
  assert.equal(selected.focusOffset, 1);
  window.close();
});
