import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { DraftRepository } from "../../frontend/drafts.mjs";
import { editorHTML } from "../../frontend/editor.mjs";
const require = createRequire(new URL("../../.local/toolchain/package.json", import.meta.url));
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div>', { url: "https://workspace.test", pretendToBeVisual: true });
for (const name of ["window", "document", "HTMLElement", "Node", "Event", "MouseEvent", "InputEvent"])
  globalThis[name] = dom.window[name];
globalThis.getSelection = () => dom.window.getSelection();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { PageTitle, RichEditor, RecordProperties, Comments, isSubmitEnter, createElement: h, createRoot, act } = await import("../../.local/frontend/ui-runtime.mjs");
const root = createRoot(document.querySelector("#app"));
const tick = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));
const storage = () => {
  const data = new Map();
  return { get: (key, fallback) => data.has(key) ? structuredClone(data.get(key)) : fallback,
    set: (key, value) => data.set(key, structuredClone(value)) };
};
const type = async (input, value) => act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(input, value);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
});

test("title and body recovery remain independent across acknowledgement and source boundaries", () => {
  const data = storage(), repo = new DraftRepository(data, "connection-a", "profile-a");
  const body = repo.bind("scope-a", "same-page"), title = repo.bind("scope-a", "same-page", "title");
  const b = body.put("<p>Body draft</p>", "<p>Saved</p>"), t = title.put("Older title", "Saved title");
  title.put("Newer title", "Saved title");
  title.acknowledge(t.token); body.acknowledge(b.token);
  assert.equal(body.read(), null);
  assert.equal(title.read().title, "Newer title");
  assert.equal(repo.bind("replacement-scope", "same-page", "title").read(), null);
  assert.equal(new DraftRepository(data, "connection-b", "profile-a").bind("scope-a", "same-page", "title").read(), null);
  assert.equal(new DraftRepository(data, "connection-a", "profile-b").bind("scope-a", "same-page", "title").read(), null);
});

test("failed title flush retains the rename and exposes retry without a false saved acknowledgement", async () => {
  const buffer = new DraftRepository(storage(), "local", "test").bind("scope", "page", "title");
  let flush, reject = true, saved, calls = 0;
  await act(async () => root.render(h(PageTitle, { item: { id: "page", title: "Saved title" }, buffer,
    locked: false, headingId: "page-heading", onError: () => {},
    registerFlush: fn => { flush = fn; return () => {}; },
    onSave: async value => { calls++; if (reject) throw Error("Synthetic rename failure"); saved = value; },
  })));
  await type(document.querySelector("textarea"), "Retained title");
  await act(async () => { await assert.rejects(flush(), /Title not saved/); });
  assert.equal(document.querySelector("textarea").value, "Retained title");
  assert.equal(buffer.read().title, "Retained title");
  assert.match(document.querySelector('[role="alert"]').textContent, /Title not saved/);
  reject = false;
  await act(async () => [...document.querySelectorAll("button")].find(b => b.textContent === "Retry title save").click());
  await tick();
  assert.equal(saved, "Retained title"); assert.equal(calls, 2); assert.equal(buffer.read(), null);
  await act(async () => root.render(null));
});

test("blank title blocks navigation flush and IME Enter never submits", async () => {
  let flush, calls = 0;
  await act(async () => root.render(h(PageTitle, { item: { id: "page", title: "Saved title" }, locked: false,
    headingId: "page-heading", onError: () => {}, registerFlush: fn => { flush = fn; return () => {}; }, onSave: async () => calls++,
  })));
  await type(document.querySelector("textarea"), "   ");
  await act(async () => { await assert.rejects(flush(), /Enter a title/); });
  assert.equal(calls, 0); assert.match(document.querySelector('[role="alert"]').textContent, /Enter a title/);
  assert.equal(isSubmitEnter({ key: "Enter", nativeEvent: { isComposing: true } }), false);
  assert.equal(isSubmitEnter({ key: "Enter", nativeEvent: { keyCode: 229 } }), false);
  assert.equal(isSubmitEnter({ key: "Enter", isComposing: true }), false);
  assert.equal(isSubmitEnter({ key: "Enter" }), true);
  await act(async () => root.render(null));
});

test("inline checklist derives its accessible name and true lock state without serializing decorations", async () => {
  const props = { item: { id: "page", content: '<p><input type="checkbox"> Review the watering plan</p>' },
    locked: false, onSave: async () => {}, onText: () => {}, onError: () => {}, registerFlush: () => () => {}, onAnchor: () => {} };
  await act(async () => root.render(h(RichEditor, props)));
  let input = document.querySelector('input[type="checkbox"]');
  assert.equal(input.getAttribute("aria-label"), "Review the watering plan"); assert.equal(input.disabled, false);
  assert.equal(input.getAttribute("contenteditable"), "false");
  await act(async () => root.render(h(RichEditor, { ...props, locked: true })));
  input = document.querySelector('input[type="checkbox"]'); assert.equal(input.disabled, true);
  const html = editorHTML(document.querySelector("[contenteditable]"));
  assert.doesNotMatch(html, /aria-label|disabled|contenteditable/); assert.match(html, /Review the watering plan/);
  await act(async () => root.render(null));
});

test("comment shortcut can reopen the current range without waiting for selection state", async () => {
  const anchors = [];
  await act(async () => root.render(h(RichEditor, {
    item: { id: "selection-page", content: "<p>Keep the young trees shaded.</p>" }, locked: false,
    onSave: async () => {}, onText: () => {}, onError: () => {}, registerFlush: () => () => {}, onAnchor: anchor => anchors.push(anchor),
  })));
  const editor = document.querySelector("[contenteditable]");
  const range = document.createRange(); range.setStart(editor.firstChild.firstChild, 9); range.setEnd(editor.firstChild.firstChild, 20);
  getSelection().removeAllRanges(); getSelection().addRange(range);
  for (let i = 0; i < 2; i++) await act(async () => {
    editor.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "m", ctrlKey: true, altKey: true, bubbles: true }));
  });
  assert.equal(anchors.length, 2); assert.equal(anchors[0].quote, "young trees"); assert.equal(anchors[1].quote, "young trees");
  await act(async () => root.render(null));
});

test("queued title/body acknowledgements cannot replace or replay newer edits", async () => {
  for (const kind of ["title", "body"]) for (const rejectFirst of [false, true]) for (const thirdEdit of [false, true]) {
    const calls = [], buffer = new DraftRepository(storage(), "local", "queue").bind("scope", "page", kind === "title" ? "title" : "content");
    let flush, first, second;
    // A successful HTTP acknowledgement publishes the authoritative snapshot before resolving.
    const onSave = value => new Promise((resolve, reject) => calls.push({ value, resolve: () => {
      common.item[kind === "title" ? "title" : "content"] = value; resolve();
    }, reject }));
    const common = { item: { id: "page", title: "Original title", content: "<p>Original body</p>" }, locked: false,
      onSave, onError: () => {}, registerFlush: fn => { flush = fn; return () => {}; } };
    await act(async () => root.render(kind === "title" ? h(PageTitle, { ...common, buffer, headingId: "queue-title" }) :
      h(RichEditor, { ...common, draftBuffer: buffer, onText: () => {}, onAnchor: () => {} })));
    const values = kind === "title" ? ["First edit", "Second edit", "Third edit"] : ["<p>First edit</p>", "<p>Second edit</p>", "<p>Third edit</p>"];
    const edit = async value => kind === "title" ? type(document.querySelector("textarea"), value) : act(async () => {
      const editor = document.querySelector(".ws-editor"); editor.innerHTML = value;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    });
    const visible = () => kind === "title" ? document.querySelector("textarea").value : document.querySelector(".ws-editor").innerHTML;
    const status = () => document.querySelector(kind === "title" ? ".ws-title-status" : ".ws-save")?.textContent ?? "Saved";
    await edit(values[0]); await act(() => { first = flush(); }); await tick();
    await edit(values[1]); await act(() => { second = flush(); }); await tick();
    assert.equal(calls.length, 1); if (thirdEdit) await edit(values[2]);
    await act(async () => { if (rejectFirst) { calls[0].reject(Error("Older rejected edit")); await assert.rejects(first); }
      else { calls[0].resolve(); await first; } }); await tick();
    assert.equal(calls.length, 2); assert.equal(visible(), values[thirdEdit ? 2 : 1]);
    assert.match(status(), thirdEdit ? /Unsaved/i : /Saving/); assert.equal(buffer.read()[kind === "title" ? "title" : "html"], values[thirdEdit ? 2 : 1]);
    await act(async () => { calls[1].resolve(); await second; }); await tick();
    if (thirdEdit) {
      assert.equal(visible(), values[2]); assert.match(status(), /Unsaved/i); assert.equal(buffer.read()[kind === "title" ? "title" : "html"], values[2]);
      await act(() => { first = flush(); }); await tick(); assert.equal(calls[2].value, values[2]);
      await act(async () => { calls[2].resolve(); await first; });
    }
    await act(async () => { await flush(); }); assert.equal(calls.length, thirdEdit ? 3 : 2);
    assert.equal(visible(), values[thirdEdit ? 2 : 1]); assert.equal(status(), kind === "title" ? "Saved" : "Content saved"); assert.equal(buffer.read(), null);
    await act(async () => root.render(null));
  }
});

test("property failure retains exact field draft across unmount and requires explicit retry or discard", async () => {
  const repo = new DraftRepository(storage(), "connection", "profile"), buffer = repo.bind("scope", "record", "property", "notes");
  const item = { id: "record", database_id: "db", properties: { notes: "Saved note" } }, database = { id: "db", columns: [{ id: "notes", name: "Notes", type: "text" }] };
  const state = { items: [item, database] }; let flush, reject = true, calls = 0;
  const props = { item, database, state, locked: false, onError: () => {}, propertyBuffer: () => buffer,
    registerPropertyFlush: (_id, fn) => { flush = fn; return () => {}; },
    command: async (_op, build) => { calls++; if (reject) throw Error("Synthetic property failure"); Object.assign(item, build(state).patch); } };
  const edit = async value => act(async () => { const input = document.querySelector('input[aria-label="Notes"]');
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => root.render(h(RecordProperties, props))); await edit("Retained property");
  await act(async () => assert.rejects(flush(), /Notes not saved/)); assert.equal(buffer.read().value, "Retained property");
  await act(async () => root.render(null)); await act(async () => root.render(h(RecordProperties, props)));
  assert.equal(document.querySelector('input[aria-label="Notes"]').value, "Retained property");
  await act(async () => assert.rejects(flush(), /Review the retained/)); assert.equal(calls, 1);
  reject = false; await act(async () => [...document.querySelectorAll("button")].find(b => b.textContent === "Retry property save").click()); await tick();
  assert.equal(item.properties.notes, "Retained property"); assert.equal(buffer.read(), null);
  await act(async () => root.render(h(RecordProperties, props)));
  reject = true; await edit("Discard this failed property"); await act(async () => assert.rejects(flush()));
  await act(async () => [...document.querySelectorAll("button")].find(b => b.textContent === "Discard property draft").click());
  await act(async () => flush()); assert.equal(document.querySelector('input[aria-label="Notes"]').value, "Retained property"); assert.equal(buffer.read(), null);
  await act(async () => root.render(null));
});

test("discussion drafts retain text, anchor, targets and replies within the exact source without submitting", async () => {
  const backing = storage(), repo = new DraftRepository(backing, "connection", "profile"), buffer = repo.bind("scope", "page", "discussion");
  let anchor = { quote: "Young trees", prefix: "", suffix: " need shade." }, calls = 0;
  // Stored legacy references remain data after removing per-comment controls.
  buffer.put({ text: '', anchor, targets: ['other'], replies: {} });
  const item = { id: "page", kind: "page" }, state = { items: [item, { id: "other", kind: "page", title: "Other page" }],
    comments: [{ id: "comment", item_id: "page", text: "First comment", resolved: false, replies: [], target_item_ids: [] }] };
  const props = () => ({ item, state, text: "Young trees need shade.", anchor, setAnchor: value => { anchor = value; root.render(h(Comments, props())); },
    draftBuffer: buffer, activeComment: "comment", setActiveComment: () => {}, command: async () => { calls++; }, workflow: {}, onError: () => {}, onRun: async () => {},
    // Document supplies live range geometry in production. This isolated
    // discussion fixture supplies the already-located anchored composer slot.
    geometry: anchor ? [{ id: "__workspace-comment-draft", block: document.querySelector("#app"), top: 0 }] : [] });
  await act(async () => root.render(h(Comments, props())));
  await type(document.querySelector('textarea[aria-label="New comment"]'), "Retained anchored feedback");
  await type(document.querySelector('textarea[aria-label="Reply to First comment"]'), "Retained reply");
  assert.equal(document.querySelector('input[aria-label^="Also allow edits to"]'), null);
  const retained = buffer.read().draft; assert.equal(retained.text, "Retained anchored feedback"); assert.deepEqual(retained.anchor, anchor);
  assert.deepEqual(retained.targets, ["other"]); assert.equal(retained.replies.comment, "Retained reply"); assert.equal(calls, 0);
  await act(async () => root.render(null)); await act(async () => root.render(h(Comments, props())));
  assert.equal(document.querySelector('textarea[aria-label="New comment"]').value, "Retained anchored feedback");
  assert.equal(document.querySelector('textarea[aria-label="Reply to First comment"]').value, "Retained reply"); assert.equal(calls, 0);
  assert.equal(new DraftRepository(backing, "other-connection", "profile").bind("scope", "page", "discussion").read(), null);
  assert.equal(new DraftRepository(backing, "connection", "other-profile").bind("scope", "page", "discussion").read(), null);
  assert.equal(repo.bind("replacement-scope", "page", "discussion").read(), null);
  await act(async () => [...document.querySelectorAll("button")].find(b => b.textContent === "Use whole page").click());
  const wholePageComposer = document.querySelector('textarea[aria-label="New comment"]');
  assert.equal(anchor, null); assert.equal(document.activeElement, wholePageComposer);
  assert.equal(wholePageComposer.value, "Retained anchored feedback");
  assert.equal(buffer.read().draft.anchor, null); assert.deepEqual(buffer.read().draft.targets, ["other"]);
  assert.equal(buffer.read().draft.replies.comment, "Retained reply"); assert.equal(calls, 0);
  await act(async () => [...document.querySelectorAll("button")].find(b => b.textContent === "Cancel comment").click());
  assert.equal(buffer.read().draft.replies.comment, "Retained reply"); assert.equal(buffer.read().draft.text, "");
  await act(async () => [...document.querySelectorAll("button")].find(b => b.textContent === "Discard reply").click()); assert.equal(buffer.read(), null);
  await act(async () => root.render(null));
});

after(async () => { await act(async () => root.unmount()); dom.window.close(); });
