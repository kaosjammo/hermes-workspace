import {frontendRuntime} from './runtime-path.mjs';
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { sanitizeHTML, editorHTML } from "../../frontend/editor.mjs";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div>', {
  url: "https://synthetic.test",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "Node",
  "MutationObserver",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "InputEvent",
])
  globalThis[key] = dom.window[key];
globalThis.getSelection = () => dom.window.getSelection();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {
  RichEditor,
  createElement: h,
  createRoot,
  act,
} = await import(frontendRuntime('ui-runtime.mjs'));
const root = createRoot(document.querySelector("#app"));
test("normal weight is a narrow semantic reset rather than CSS passthrough", () => {
  const safe = sanitizeHTML(
    '<h2><span style=" FONT-WEIGHT : Normal ; " onclick="bad()">Normal</span> heading</h2><span data-workspace-weight="bold" style="color:green">Ignore</span>',
  );
  assert.equal(
    safe,
    '<h2><span data-workspace-weight="normal">Normal</span> heading</h2><span>Ignore</span>',
  );
  assert.equal(sanitizeHTML(safe), safe);
  const el = document.createElement("div");
  el.innerHTML = safe;
  assert.equal(editorHTML(el), safe);
  assert.equal(
    sanitizeHTML('<span style="font-weight:400">Reset</span>'),
    '<span data-workspace-weight="normal">Reset</span>',
  );
  assert.equal(
    sanitizeHTML(
      '<span style="font-weight:normal;color:red;position:fixed">Mixed</span>',
    ),
    "<span>Mixed</span>",
  );
  assert.equal(
    sanitizeHTML(
      '<span style="font-weight:normal;background:url(https://example.invalid)">URL</span>',
    ),
    "<span>URL</span>",
  );
});
let registered = 0,
  flush;
const errors = [],
  commands = [];
document.execCommand = (name) => {
  commands.push(name);
  return true;
};
const props = {
  item: { id: "c", content: "<p>First passage.</p>" },
  locked: false,
  onSave: async () => {},
  onText: () => {},
  onAnchor: () => {},
  onLink: () => {},
  onError: (e) => errors.push(e),
  registerFlush: (fn) => {
    flush = fn;
    return () => {};
  },
  registerKeybind: () => {
    registered++;
    return () => {};
  },
};
const render = async (patch) =>
  act(async () => root.render(h(RichEditor, { ...props, ...patch })));
const key = async (options) => {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...options,
  });
  await act(async () =>
    document.querySelector(".ws-editor").dispatchEvent(event),
  );
  return event;
};
test("format disclosure is a labelled button, controls one panel, and removes inert hint", async () => {
  await render();
  const toggle = document.querySelector(".ws-format-toggle"),
    panel = document.querySelector(".ws-format-toolbar");
  assert.equal(toggle.tagName, "BUTTON");
  assert.equal(toggle.textContent, "Format text");
  assert.equal(toggle.getAttribute("aria-controls"), panel.id);
  assert.equal(panel.hidden, true);
  assert.ok(!document.body.textContent.includes("Select text to comment"));
  await act(async () => toggle.click());
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(panel.hidden, false);
  assert.equal(panel.querySelectorAll('[aria-label="Bold"]').length, 1);
  assert.ok(panel.querySelector('[aria-label="Block style"]'));
});
test("unclaimed editor Ctrl+Alt+B acts once; other host chords and claimed events remain untouched", async () => {
  commands.length = 0;
  document.querySelector(".ws-editor").focus();
  assert.equal(
    (await key({ key: "b", ctrlKey: true, altKey: true })).defaultPrevented,
    true,
  );
  assert.deepEqual(commands, ["bold"]);
  assert.equal(
    (await key({ key: "b", ctrlKey: true })).defaultPrevented,
    false,
  );
  assert.equal(
    (await key({ key: "B", ctrlKey: true, shiftKey: true })).defaultPrevented,
    false,
  );
  const claim = (event) => event.preventDefault();
  window.addEventListener("keydown", claim, true);
  await key({ key: "b", ctrlKey: true, altKey: true });
  window.removeEventListener("keydown", claim, true);
  await key({ key: "b", ctrlKey: true, altKey: true, isComposing: true });
  assert.deepEqual(commands, ["bold"]);
  await act(async () => flush());
});
test("focus churn creates no permanent keybind contributions; locks block formatting", async () => {
  const editor = document.querySelector(".ws-editor");
  for (let i = 0; i < 30; i++) {
    editor.focus();
    editor.blur();
  }
  assert.equal(registered, 0);
  await render({ locked: true });
  assert.equal(
    document.querySelector(".ws-editor").getAttribute("contenteditable"),
    "false",
  );
  assert.ok(document.querySelector(".ws-format-toggle").disabled);
  assert.ok(
    document
      .querySelector('.ws-format-toolbar [aria-label="Bold"]')
      .matches(":disabled"),
  );
  commands.length = 0;
  await key({ key: "b", ctrlKey: true, altKey: true });
  assert.deepEqual(commands, []);
  assert.deepEqual(errors, []);
});
test("comment chord uses a fresh live range before focus can collapse it", async () => {
  const anchors = [];
  await render({ onAnchor: (anchor) => anchors.push(anchor) });
  const editor = document.querySelector(".ws-editor"),
    n = editor.querySelector("p").firstChild;
  const range = document.createRange();
  range.setStart(n, 0);
  range.setEnd(n, 5);
  getSelection().removeAllRanges();
  getSelection().addRange(range);
  for (let i = 0; i < 2; i++)
    await key({ key: "m", ctrlKey: true, altKey: true });
  assert.deepEqual(
    anchors.map((anchor) => anchor.quote),
    ["First", "First"],
  );
});
after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});
