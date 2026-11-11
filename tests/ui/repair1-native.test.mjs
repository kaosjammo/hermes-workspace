import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div>', {
  url: "https://workspace.test",
  pretendToBeVisual: true,
});
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "Node",
  "DocumentFragment",
  "MutationObserver",
  "Event",
  "MouseEvent",
  "InputEvent",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLFormElement",
  "HTMLButtonElement",
  "CustomEvent",
  "FocusEvent",
])
  globalThis[key] = dom.window[key];
globalThis.getSelection = () => dom.window.getSelection();
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {
  RichEditor,
  Property,
  RecordProperties,
  Database,
  createElement: h,
  createRoot,
  act,
} = await import("../../.local/frontend/repair-1/native-runtime.mjs");
const root = createRoot(document.querySelector("#app"));
const noop = () => {};
const props = {
  locked: false,
  onSave: async () => {},
  onText: noop,
  onAnchor: noop,
  registerFlush: () => noop,
  onError: (e) => {
    throw e;
  },
  attachments: [],
};
const choose = async (label, text) => {
  const group = [...document.querySelectorAll("label")].find((n) =>
    n.querySelector(`[role="combobox"][aria-label="${label}"]`),
  );
  const select = group?.querySelector("select");
  assert.ok(select, `actual Radix hidden select: ${label}`);
  const option = [...select.options].find(option => option.textContent.trim() === text);
  assert.ok(option, `actual Radix option: ${label}: ${text}`);
  await act(async () => {
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const caret = (node) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(true);
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
};
test("actual native Select tracks block selection and allows heading quote code -> Text; failed command does not lie", async () => {
  const commands = [];
  // Structural operations now use the production DOM transaction; this fixture
  // only verifies failure of a remaining native inline command.
  document.execCommand = (name, _, value) => {
    commands.push([name, value]);
    return false;
  };
  await act(async () =>
    root.render(
      h(
        "form",
        null,
        h(RichEditor, {
          ...props,
          item: { id: "p", content: "<p>First</p><h2>Second</h2>" },
        }),
      ),
    ),
  );
  const editor = document.querySelector("[contenteditable]");
  await act(async () => caret(editor.firstElementChild));
  for (const value of ["h1", "blockquote", "pre"]) {
    await choose("Block style", { h1: "Heading 1", blockquote: "Quote", pre: "Code block" }[value]);
    assert.equal(
      document
        .querySelector('button[aria-label="Block style"]')
        .textContent.trim(),
      { h1: "Heading 1", blockquote: "Quote", pre: "Code block" }[value],
    );
    await choose("Block style", "Text");
    assert.equal(editor.firstElementChild.tagName, "P");
  }
  await act(async () => caret(editor.lastElementChild));
  assert.equal(
    document
      .querySelector('button[aria-label="Block style"]')
      .textContent.trim(),
    "Heading 2",
  );
  const before = editor.innerHTML;
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "Bold")
      .click(),
  );
  assert.equal(editor.innerHTML, before);
  assert.equal(
    document
      .querySelector('button[aria-label="Block style"]')
      .textContent.trim(),
    "Heading 2",
  );
  assert.deepEqual(
    commands.map((c) => c[0]),
    ["bold"],
  );
  await act(async () => root.render(null));
});
test("actual native select and Input encode nullable clearing as null while text retains empty string", async () => {
  const values = [];
  const state = { items: [] };
  await act(async () =>
    root.render(
      h(
        "form",
        null,
        h(Property, {
          column: {
            id: "s",
            name: "Status",
            type: "select",
            options: ["Todo", "Done"],
          },
          value: "Done",
          state,
          onChange: (v) => values.push(["select", v]),
        }),
        h(Property, {
          column: { id: "d", name: "Due", type: "date" },
          value: "2026-11-07",
          state,
          onChange: (v) => values.push(["date", v]),
        }),
        h(Property, {
          column: { id: "t", name: "Text", type: "text" },
          value: "existing",
          state,
          onChange: (v) => values.push(["text", v]),
        }),
      ),
    ),
  );
  await choose("Status", "No value");
  for (const label of ["Due", "Text"]) {
    const node = document.querySelector(`input[aria-label="${label}"]`);
    await act(async () => {
      node.focus();
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      ).set.call(node, "");
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => node.blur());
  }
  assert.deepEqual(values, [
    ["select", null],
    ["date", null],
    ["text", ""],
  ]);
  await act(async () => root.render(null));
});
test("actual native board No value sends null without clearing unrelated properties", async () => {
  const db = {
    id: "db",
    kind: "database",
    columns: [
      { id: "s", name: "Status", type: "select", options: ["Todo", "Done"] },
      { id: "t", name: "Text", type: "text" },
    ],
  };
  const record = {
    id: "r",
    kind: "record",
    database_id: "db",
    title: "Record",
    properties: { s: "Done", t: "keep" },
  };
  const state = { items: [db, record] };
  const writes = [];
  await act(async () =>
    root.render(
      h(
        "form",
        null,
        h(Database, {
          item: db,
          state,
          locked: false,
          onOpen: noop,
          onError: (e) => {
            throw e;
          },
          confirm: noop,
          command: async (op, p) =>
            writes.push({
              op,
              payload: typeof p === "function" ? p(state) : p,
            }),
        }),
      ),
    ),
  );
  await choose("View", "Board");
  await choose("Move Record", "No value");
  assert.deepEqual(writes.at(-1).payload.patch.properties, {
    s: null,
    t: "keep",
  });
  await act(async () => root.render(null));
});
after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});
