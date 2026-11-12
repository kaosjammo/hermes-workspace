import {frontendRuntime} from './runtime-path.mjs';
import { test, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { attachmentLabels } from "../../frontend/item-labels.mjs";
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
  "FileReader",
  "Blob",
  "File",
  "Event",
  "MouseEvent",
  "InputEvent",
])
  globalThis[key] = dom.window[key];
globalThis.getSelection = () => dom.window.getSelection();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {
  Workspace,
  RichEditor,
  Database,
  plugin,
  createElement: h,
  createRoot,
  act,
  nativeCalls,
  switchProfile,
  FormDialog,
  ScopeReviewDialog,
} = await import(frontendRuntime('ui-runtime.mjs'));
const tick = async (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
const button = (text) =>
  [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent) === text);
const click = async (node) => {
  assert.ok(node, "control exists");
  await act(async () => node.click());
  await tick();
};
const selectOption = async (label, text) => {
  const node = document.querySelector(`select[aria-label="${label}"]`);
  assert.ok(node, `Select exists: ${label}`);
  const option = [...node.options].find(option => option.textContent.trim() === text);
  assert.ok(option, `Option exists: ${label}: ${text}`);
  await act(async () => {
    node.value = option.value;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const input = async (node, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      node.tagName === "TEXTAREA"
        ? dom.window.HTMLTextAreaElement.prototype
        : dom.window.HTMLInputElement.prototype,
      "value",
    ).set.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const root = createRoot(document.querySelector("#app"));
test("confirmation names survive pending success and failure without a duplicate submission", async () => {
  for (const fail of [false, true]) {
    let release, submitted = 0, closed = 0;
    await act(async () => root.render(h(FormDialog, {
      key: String(fail), title: "Review a section", confirm: "Revert section",
      onClose: () => closed++, onSubmit: () => {
        submitted++; return new Promise((resolve, reject) => { release = () => fail ? reject(Error("Synthetic delayed failure")) : resolve(); });
      },
    })));
    const action = button("Revert section");
    assert.equal(action.getAttribute("aria-label"), "Revert section");
    await click(action);
    assert.equal(action.disabled, true);
    assert.equal(action.getAttribute("aria-label"), "Revert section");
    await act(async () => action.closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(submitted, 1);
    await act(async () => release()); await tick();
    assert.equal(action.disabled, false);
    assert.equal(action.getAttribute("aria-label"), "Revert section");
    assert.equal(closed, fail ? 0 : 1);
    if (fail) assert.match(document.querySelector('[role="alert"]').textContent, /Synthetic delayed failure/);
    await act(async () => root.render(null));
  }
});
test("scope submit retains its name and unchecked permissions while pending and after failure", async () => {
  let release, submissions = 0;
  await act(async () => root.render(h(ScopeReviewDialog, {
    review: { targets: [{ id: "other", label: "Other page", available: true, comments: [] }] },
    currentTitle: "Current page", currentId: "page", onClose: () => {},
    onSubmit: ids => { submissions++; assert.deepEqual(ids, []); return new Promise((_resolve, reject) => { release = () => reject(Error("Synthetic pending scope failure")); }); },
  })));
  const action = button("Address current page"), permission = document.querySelector('input[type="checkbox"]');
  assert.equal(action.getAttribute("aria-label"), "Address current page"); assert.equal(permission.checked, false);
  await click(action);
  assert.equal(action.disabled, true); assert.equal(permission.disabled, true);
  assert.equal(action.getAttribute("aria-label"), "Address current page");
  await click(action); assert.equal(submissions, 1);
  await act(async () => release()); await tick();
  assert.equal(action.disabled, false); assert.equal(permission.checked, false);
  assert.equal(action.getAttribute("aria-label"), "Address current page");
  await act(async () => root.render(null));
});
test("same-name attachment labels distinguish exact files without changing their download identity", () => {
  const files = [
    { id: "one", name: "plan.png", media_type: "image/png", data_base64: "YQ==" },
    { id: "two", name: "plan.png", media_type: "image/png", data_base64: "YmI=" },
    { id: "single", name: "notes.txt", media_type: "text/plain", data_base64: "" },
  ], before = structuredClone(files), labels = attachmentLabels(files);
  assert.deepEqual(labels.map(x => x.label), ["plan.png · attachment 1 of 2", "plan.png · attachment 2 of 2", "notes.txt"]);
  assert.equal(labels[0].detail, "PNG image · 1 byte"); assert.equal(labels[1].detail, "PNG image · 2 bytes");
  assert.equal(labels[2].detail, "Text file · 0 bytes");
  labels.forEach((row, index) => assert.equal(row.attachment, files[index]));
  const appended = attachmentLabels([...files, { ...files[0], id: "three" }]);
  assert.match(appended[0].label, /attachment 1 of 3$/); assert.match(appended[1].label, /attachment 2 of 3$/);
  assert.deepEqual(files, before);
});
test("production editor shows authoritative restored content even when editor retains focus", async () => {
  const props = {
    item: { id: "p", content: "<p>Before</p>" },
    locked: false,
    onSave: async () => {},
    onAnchor: () => {},
    onText: () => {},
    registerFlush: () => () => {},
    onError: (e) => {
      throw e;
    },
  };
  await act(async () => root.render(h(RichEditor, props)));
  document.querySelector("[contenteditable]").focus();
  await act(async () =>
    root.render(
      h(RichEditor, {
        ...props,
        item: { id: "p", content: "<p>Restored content</p>" },
      }),
    ),
  );
  assert.equal(
    document.querySelector("[contenteditable]").textContent,
    "Restored content",
  );
  await act(async () => root.render(null));
});
test("production plugin registration defaults available after backend confirmation; host opt-outs stay host-owned", async () => {
  const contributions = [];
  await plugin.register({ register: (c) => contributions.push(c), onDispose: () => {} });
  assert.equal(plugin.defaultEnabled, true);
  assert.equal(plugin.id, "workspace");
  assert.equal(
    contributions.find((c) => c.area === "sidebar.nav").data.path,
    "/workspace",
  );
  assert.equal(
    contributions.find((c) => c.area === "routes").render().type,
    Workspace,
  );
});
test("colliding navigation titles expose distinct context descriptions and open the intended page", async () => {
  const items = ["pdf", "markdown-one", "markdown-two", "unique"].map(id => ({
    id, title: id === "unique" ? "Unique page" : "Imported notes", kind: "page",
    parent_id: null, content: `<p>Content for ${id}</p>`, properties: {}, columns: [], deleted_at: null,
  }));
  const state = { scope_id: "navigation-scope", revision: 1, items,
    attachments: items.slice(0, 3).map(item => ({ id: `file-${item.id}`, item_id: item.id,
      name: item.id === "pdf" ? "Imported notes.pdf" : "Imported notes.md" })),
    comments: [], runs: [], versions: [], recents: items.slice(0, 3).map(item => item.id), templates: [] };
  const original = structuredClone(state), opened = [];
  const ctx = { onDispose: () => {}, rest: async (path, options) => {
    if (path === "/state") return structuredClone(state);
    assert.equal(path, "/command"); assert.equal(options.body.op, "open_item");
    opened.push(options.body.payload.id);
    return { result: {}, state: structuredClone(state) };
  } };
  await act(async () => root.render(h(Workspace, { ctx }))); await tick();
  const described = prefix => [...document.querySelectorAll(`.ws-nav button[aria-describedby^="${prefix}"]`)];
  const description = control => document.getElementById(control.getAttribute("aria-describedby"))?.textContent;
  const tree = described("ws-tree-context-"), recent = described("ws-recent-context-");
  assert.equal(tree.length, 3); assert.equal(recent.length, 3);
  assert.equal(new Set(tree.map(description)).size, 3);
  assert.deepEqual(tree.map(description), recent.map(description));
  assert.match(description(tree[0]), /Imported notes\.pdf/);
  assert.match(description(tree[1]), /Imported notes\.md.*item 1 of 2/);
  assert.match(description(tree[2]), /Imported notes\.md.*item 2 of 2/);
  assert.ok(tree.every(control => control.getAttribute("aria-label") === "Imported notes"));
  assert.equal(button("Unique page").hasAttribute("aria-describedby"), false);
  await click(tree[1]); assert.match(document.querySelector(".ws-editor").textContent, /Content for markdown-one/);
  await click(described("ws-recent-context-")[0]); assert.match(document.querySelector(".ws-editor").textContent, /Content for pdf/);
  assert.deepEqual(opened, ["markdown-one", "pdf"]); assert.deepEqual(state, original);
  await act(async () => root.render(null));
});
test("production Workspace renders editor/comments, autosaves, resolves only user action, and exposes exact native Stop", async () => {
  const item = (id, title) => ({
    id,
    title,
    kind: "page",
    parent_id: null,
    content: "<p>Initial text</p>",
    properties: {},
    columns: [],
    deleted_at: null,
    thread_id: null,
  });
  const state = {
    scope_id: "scope-a",
    revision: 1,
    items: [item("p", "Project notes"), item("q", "Other page")],
    comments: [],
    runs: [],
    versions: [],
    attachments: [],
    recents: [],
    templates: [],
  };
  const calls = [];
  const clone = () => structuredClone(state);
  const ctx = {
    onDispose: () => {},
    os: { openExternal: async () => true },
    rest: async (path, opts) => {
      calls.push({ path, opts });
      if (path === "/state") return clone();
      if (path === "/command") {
        assert.equal(opts.body.expected_scope, "scope-a");
        const { op, payload: p } = opts.body;
        if (op === "open_item") state.recents = [p.id];
        if (op === "update_item")
          Object.assign(
            state.items.find((i) => i.id === p.id),
            p.patch,
          );
        if (op === "add_comment")
          state.comments.push({
            id: `c${state.comments.length}`,
            item_id: p.item_id,
            text: p.text,
            anchor: p.anchor ?? null,
            resolved: false,
            replies: [],
          });
        if (op === "resolve_comment")
          state.comments.find((c) => c.id === p.id).resolved = p.resolved;
        state.revision++;
        return { result: {}, state: clone() };
      }
      if (path === '/workflow/review-scope') return {
        review_id: 'synthetic-review', scope_id: state.scope_id,
        revision: state.revision, item_id: opts.body.item_id,
        selected_item_ids: opts.body.selected_item_ids,
      };
      if (path === "/workflow/prepare") {
        const run = {
          id: "run1",
          item_id: "p",
          session_id: "thread-new",
          allowed_item_ids: ["p"],
          status: "running",
          progress: "Native admission queued",
        };
        state.items[0].thread_id = "thread-new";
        state.runs.push(run);
        state.revision++;
        return { run, prompt: "Address unresolved", submission_id: "run1" };
      }
      if (path === "/workflow/submitted") {
        assert.equal(opts.body.run_id,state.runs[0].id);
        assert.equal(typeof opts.body.admission_id,'string');
        assert.ok(opts.body.admission_id.length>0);
        return {run:structuredClone(state.runs[0])};
      }
      if (path === "/workflow/consume") return {run:structuredClone(state.runs[0])};
      if (path === "/workflow/status")
        return { run: structuredClone(state.runs[0]) };
      if (path === "/workflow/stop") {
        state.runs[0].status = "cancelled";
        state.revision++;
        return {
          run: state.runs[0],
          control: { session_id: "runtime-new", admission_id: "admission-new" },
        };
      }
      throw new Error(`Unexpected ${path}`);
    },
  };
  await act(async () => root.render(h(Workspace, { ctx })));
  await tick();
  await click(button("Project notes"));
  const editor = document.querySelector("[contenteditable]");
  await act(async () => {
    editor.innerHTML = "<h2>Changed heading</h2><p>Editable paragraph</p>";
    editor.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText" }),
    );
  });
  await tick(750);
  assert.match(state.items[0].content, /Changed heading/);
  assert.equal(document.querySelector(".ws-save").textContent, "Content saved");
  assert.equal(button("Comment on whole page"), undefined);
  assert.equal(button("Add whole-page comment").textContent, "Add whole-page comment");
  await click(button("Add whole-page comment"));
  await input(
    document.querySelector('textarea[aria-label="New comment"]'),
    "Please improve this",
  );
  await click(button("Add comment"));
  assert.equal(state.comments.length, 1);
  assert.equal(
    nativeCalls.filter((c) => c.method === "prompt.submit").length,
    0,
  );
  // An agent reply leaves the comment eligible for the next explicit run.
  state.comments[0].replies.push({
    id: "r",
    author: "agent",
    text: "Earlier answer",
  });
  await click(button("Address comments (1)"));
  await click(button('Address current page'));
  assert.equal(
    document.querySelector("[contenteditable]").getAttribute("contenteditable"),
    "false",
  );
  assert.equal(button("Bold").disabled, true);
  assert.ok(button("Stop"));
  assert.equal(state.comments[0].resolved, false);
  assert.equal(
    nativeCalls.find((c) => c.method === "prompt.submit").params.submission_id,
    "run1",
  );
  await click(button("Other page"));
  assert.equal(
    document.querySelector("[contenteditable]").getAttribute("contenteditable"),
    "true",
  );
  await click(button("Project notes"));
  assert.equal(
    document.querySelector("[contenteditable]").getAttribute("contenteditable"),
    "false",
  );
  await click(button("Stop"));
  assert.equal(state.runs[0].status, "cancelled");
  assert.equal(
    document.querySelector("[contenteditable]").getAttribute("contenteditable"),
    "true",
  );
  assert.ok(
    nativeCalls.find(
      (c) =>
        c.method === "prompt.cancel" &&
        c.params.admission_id === "admission-new",
    ),
  );
  await click(document.getElementById(`ws-bubble-${state.comments[0].id}`));
  await click(
    document.querySelector('input[aria-label="Resolve: Please improve this"]'),
  );
  assert.equal(state.comments[0].resolved, true);
  assert.equal(
    document.querySelector('article[aria-label="Please improve this"]'),
    null,
  );
  await click(button("Page actions"));
  await click(document.querySelector('button[aria-label^="Resolved comments ("]'));
  assert.ok(
    document.querySelector('article[aria-label="Please improve this"]'),
  );
  await click(
    document.querySelector('input[aria-label="Resolve: Please improve this"]'),
  );
  assert.equal(state.comments[0].resolved, false);
  await click(button("Other page"));
  assert.equal(
    document.querySelector('[aria-label="Page title"]').value,
    "Other page",
  );
  await act(async () => root.render(null));
});

test("selection paint stays editor-owned and retires on selection exit and page replacement without saving", async () => {
  const previousCSS = globalThis.CSS, previousHighlight = globalThis.Highlight;
  const highlights = new Map();
  // A DOM lifecycle contract double, not browser paint/contrast evidence.
  globalThis.CSS = { highlights };
  globalThis.Highlight = class extends Set {
    constructor(...ranges) { super(ranges); }
  };
  let saves = 0;
  const props = {
    item: { id: "selection-owner", content: "<p>Keep young trees shaded.</p>" },
    locked: false, onSave: async () => saves++, onAnchor: () => {},
    onText: () => {}, registerFlush: () => () => {}, onError: e => { throw e; },
    comments: [{ id: "selection-comment", text: "Keep this passage", resolved: false,
      anchor: { quote: "young trees", prefix: "Keep ", suffix: " shaded." } }],
  };
  let retiredEditor;
  try {
    await act(async () => root.render(h(RichEditor, { ...props, key: props.item.id })));
    const editor = document.querySelector(".ws-editor");
    retiredEditor = editor;
    const gap = document.createElement("span");
    gap.setAttribute("data-workspace-comment-gap", "test-layout-only");
    await act(async () => editor.querySelector("p").append(gap));
    const text = editor.querySelector("p").firstChild;
    const select = async () => {
      await act(async () => {
        const range = document.createRange();
        range.setStart(text, 5); range.setEnd(text, 16);
        getSelection().removeAllRanges(); getSelection().addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      });
      await tick(40);
    };
    await select();
    assert.equal(getSelection().toString(), "young trees");
    assert.equal(editor.classList.contains("ws-text-selection"), true);
    const ownedKeys = [...highlights.keys()];
    const selected = [...highlights].find(([key]) => key.endsWith("-selection"))[1];
    assert.equal([...selected][0].toString(), "young trees");
    assert.equal(saves, 0);
    await act(async () => {
      getSelection().removeAllRanges();
      document.dispatchEvent(new Event("selectionchange"));
    });
    await tick(40);
    assert.equal(editor.classList.contains("ws-text-selection"), false);
    assert.equal([...highlights].find(([key]) => key.endsWith("-selection"))[1].size, 0);
    await select();
    await act(async () => root.render(h(RichEditor, {
      ...props, key: "another-page", item: { id: "another-page", content: "<p>Another page.</p>" },
      comments: [],
    })));
    await tick(40);
    assert.equal(retiredEditor.classList.contains("ws-text-selection"), false);
    assert.ok(ownedKeys.every(key => !highlights.has(key)), "Previous page retires every owned highlight");
    assert.equal(document.querySelector(".ws-editor").classList.contains("ws-text-selection"), false);
    assert.equal(document.querySelector(".ws-editor").innerHTML, "<p>Another page.</p>");
    assert.equal(saves, 0, "Selection and page replacement never submit content");
    await act(async () => root.render(null));
    assert.equal(highlights.size, 0);
  } finally {
    await act(async () => root.render(null));
    getSelection().removeAllRanges();
    if (previousCSS === undefined) delete globalThis.CSS;
    else globalThis.CSS = previousCSS;
    if (previousHighlight === undefined) delete globalThis.Highlight;
    else globalThis.Highlight = previousHighlight;
  }
});

afterEach(async () => { await act(async () => root.render(null)); });
after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});
test("production database table/board controls persist typed edits and exact board move through command entrypoint", async () => {
  const database = {
    id: "db",
    kind: "database",
    title: "Tasks",
    columns: [
      {
        id: "status",
        name: "Status",
        type: "select",
        options: ["Todo", "Done"],
      },
      { id: "n", name: "Count", type: "number" },
      { id: "f", name: "Double", type: "formula", formula: "n*2" },
    ],
  };
  const records = [
    {
      id: "r1",
      kind: "record",
      database_id: "db",
      title: "First",
      properties: { status: "Todo", n: 10, f: 20 },
    },
    {
      id: "r2",
      kind: "record",
      database_id: "db",
      title: "Second",
      properties: { status: "Done", n: 2, f: 4 },
    },
  ];
  const state = { items: [database, ...records] };
  const commands = [];
  const command = async (op, payload) => {
    const p = typeof payload === "function" ? payload(state) : payload;
    commands.push({ op, payload: p });
    if (op === "update_item")
      Object.assign(
        records.find((r) => r.id === p.id).properties,
        p.patch.properties,
      );
  };
  const props = {
    item: database,
    state,
    command,
    onOpen: () => {},
    onError: (e) => {
      throw e;
    },
    locked: false,
    confirm: () => {},
  };
  await act(async () => root.render(h(Database, props)));
  await click(button("Sort"));
  await selectOption("Sort", "Count");
  assert.equal(document.querySelector("tbody tr th button").textContent, "Second");
  await input(
    document.querySelector('input[aria-label="Filter records"]'),
    "First",
  );
  assert.equal(document.querySelectorAll("tbody tr:not(.ws-db-create-row)").length, 1);
  await input(document.querySelector('input[aria-label="Filter records"]'), "");
  await selectOption("View", "Board");
  await selectOption("Move First", "Done");
  assert.equal(records[0].properties.status, "Done");
  assert.equal(commands.at(-1).payload.patch.properties.f, undefined);
  assert.equal(commands.at(-1).payload.patch.properties.n, 10);
  await act(async () => root.render(null));
});
test("inline database record creation retains failed drafts, prevents concurrent submits and respects locks", async () => {
  const item = { id: "inline-db", kind: "database", columns: [] };
  const state = { items: [item], runs: [] };
  let finish, calls = 0;
  const command = (_op, payload) => { calls++; return new Promise((resolve, reject) => { finish = error => error ? reject(error) : resolve({ id: "new-record", ...payload }); }); };
  const props = { item, state, command, onOpen: () => {}, confirm: () => {}, locked: false };
  await act(async () => root.render(h(Database, props)));
  assert.equal(button("Add record"), undefined); assert.equal(button("Add column"), undefined);
  assert.ok(document.querySelector("thead th:last-child button[aria-label='Add property']"));
  await click(button("New record"));
  const title = document.querySelector("input[aria-label='New record title']");
  assert.equal(button("Create record").disabled, true);
  await input(title, " Retain this record ");
  const form = title.closest("form");
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(calls, 1); assert.equal(title.disabled, true); assert.equal(button("Cancel new record").disabled, true);
  await act(async () => finish(Error("Synthetic record failure")));
  assert.equal(title.value, " Retain this record "); assert.match(document.querySelector("[role='alert']").textContent, /Synthetic record failure/);
  await click(button("Create record")); await act(async () => finish());
  assert.equal(calls, 2); assert.equal(title.value, ""); assert.match(document.querySelector(".ws-db-record-draft [role='status']").textContent, /Created/);
  await click(button("Cancel new record")); assert.equal(document.querySelector(".ws-db-record-draft"), null);
  await act(async () => root.render(h(Database, { ...props, locked: true })));
  assert.equal(button("New record").disabled, true); assert.equal(button("Add property").disabled, true);
  await act(async () => root.render(null));
});
test("board group creation keeps its exact typed target through failure, retry and cancellation", async () => {
  const item = { id: "group-db", kind: "database", columns: [{ id: "status", name: "Status", type: "select", options: ["Planned", "Observed"] }] };
  const state = { items: [item], runs: [] }, calls = [];
  let finish;
  const command = (_op, payload) => { calls.push(payload); return new Promise((resolve, reject) => { finish = error => error ? reject(error) : resolve({ id: "new-group-record", ...payload }); }); };
  await act(async () => root.render(h(Database, { item, state, locked: false, onOpen: () => {}, confirm: () => {}, command })));
  const view = document.querySelector("select[aria-label='View']");
  await selectOption("View", "Board");
  await click(button("New record in Observed"));
  assert.equal(view.disabled, true); assert.equal(button("New record in Planned").disabled, true);
  const title = document.querySelector("input[aria-label='New record title']"); await input(title, "Keep this group");
  const form = title.closest("form");
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].properties, { status: "Observed" }); assert.equal(button("Cancel new record").disabled, true);
  await act(async () => finish(Error("Group creation failed"))); assert.equal(title.value, "Keep this group");
  await click(button("Create record")); await act(async () => finish());
  assert.deepEqual(calls[1].properties, { status: "Observed" }); assert.equal(title.value, "");
  await click(button("Cancel new record"));
  const groupOpener = button("New record in Observed");
  assert.ok(groupOpener, "The exact restored group opener exists");
  const focusDescription = actual => JSON.stringify({
    actualTag: actual?.tagName ?? null,
    actualAria: actual?.getAttribute("aria-label") ?? null,
    expectedTag: groupOpener.tagName,
    expectedAria: groupOpener.getAttribute("aria-label"),
  });
  const assertGroupFocus = actual => assert.equal(actual === groupOpener, true,
    "Focus must return to the exact group opener: " + focusDescription(actual));
  assert.throws(() => assertGroupFocus(document.body), { code: "ERR_ASSERTION" },
    "The focus assertion must reject the wrong element");
  // Cancel restores focus in requestAnimationFrame; a zero-delay timer can run first.
  await act(async () => new Promise((resolve, reject) => {
    let frame;
    const timeout = setTimeout(() => {
      cancelAnimationFrame(frame);
      reject(Error("Group focus did not settle within 1000ms: " + focusDescription(document.activeElement)));
    }, 1000);
    const checkFocus = () => {
      if (document.activeElement === groupOpener) {
        clearTimeout(timeout);
        resolve();
      } else frame = requestAnimationFrame(checkFocus);
    };
    checkFocus();
  }));
  assertGroupFocus(document.activeElement);
  assert.equal(view.disabled, false);
  await click(button("New record in Unassigned")); await input(document.querySelector("input[aria-label='New record title']"), "No group");
  await click(button("Create record")); assert.deepEqual(calls[2].properties, { status: null }); await act(async () => finish());
  await click(button("Cancel new record")); await act(async () => root.render(null));
});
test("property validation identifies its field while transport failures remain form-level", async () => {
  const item = { id: "validation-db", kind: "database", columns: [] }, state = { items: [item], runs: [] };
  let calls = 0, failure = "Unsupported formula operation";
  await act(async () => root.render(h(Database, { item, state, locked: false, onOpen: () => {}, confirm: () => {}, command: async () => { calls++; throw Error(failure); } })));
  await click(button("Add property"));
  const name = document.querySelector("input[aria-label='Property name']"); await input(name, "Calculation");
  const choose = value => selectOption("Property type", { formula: "Formula", select: "Single select", relation: "Relation" }[value]);
  const submit = async () => { await act(async () => name.closest("form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))); await tick(); };
  await choose("formula"); const formula=document.querySelector("input[aria-label='Formula expression']"); await input(formula,"unsupported(1)"); await submit();
  assert.equal(calls,1);assert.equal(formula.getAttribute("aria-invalid"),"true");assert.equal(name.getAttribute("aria-invalid"),"false");assert.equal(formula.getAttribute("aria-describedby"),document.querySelector("[role='alert']").id);assert.equal(document.activeElement,formula);
  failure="Synthetic transport failure";await submit();assert.equal(calls,2);assert.equal(formula.getAttribute("aria-invalid"),"false");assert.equal(name.getAttribute("aria-invalid"),"false");assert.equal(name.closest("form").getAttribute("aria-describedby"),document.querySelector("[role='alert']").id);assert.equal(formula.value,"unsupported(1)");
  await choose("select");await submit();assert.equal(calls,2);const options=document.querySelector("input[aria-label='Select options (comma separated)']");assert.equal(options.getAttribute("aria-invalid"),"true");await input(options,"Same, Same");await submit();assert.equal(calls,2);assert.equal(options.getAttribute("aria-invalid"),"true");
  await choose("relation");await submit();assert.equal(calls,2);assert.equal(document.querySelector("select[aria-label='Related database']").getAttribute("aria-invalid"),"true");assert.equal(name.getAttribute("aria-invalid"),"false");
  await act(async () => root.render(null));
});
test("production editor retains local content while an autosave is pending across remote polling", async () => {
  let finish;
  const pending = new Promise((r) => (finish = r));
  const props = {
    item: { id: "p", content: "<p>Saved</p>" },
    locked: false,
    attachments: [],
    onSave: () => pending,
    onAnchor: () => {},
    onText: () => {},
    registerFlush: () => () => {},
    onError: (e) => {
      throw e;
    },
  };
  await act(async () => root.render(h(RichEditor, props)));
  const editor = document.querySelector("[contenteditable]");
  await act(async () => {
    editor.innerHTML = "<p>Local pending</p>";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
  await tick(700);
  await act(async () =>
    root.render(h(RichEditor, { ...props, attachments: [] })),
  );
  assert.equal(editor.textContent, "Local pending");
  await act(async () => finish());
  await act(async () => root.render(null));
});
test("production Workspace drops an old profile in-flight response after source switch", async () => {
  let finish;
  const old = new Promise((r) => (finish = r));
  let count = 0;
  const state = (scope, title) => ({
    scope_id: scope,
    revision: 1,
    items: [
      {
        id: "same-id",
        title,
        kind: "page",
        parent_id: null,
        content: "",
        properties: {},
        deleted_at: null,
      },
    ],
    comments: [],
    runs: [],
    versions: [],
    attachments: [],
    recents: [],
    templates: [],
  });
  const ctx = {
    onDispose: () => {},
    rest: async () =>
      ++count === 1 ? old : state("scope-b", "Profile B only"),
  };
  await act(async () => root.render(h(Workspace, { ctx })));
  await tick();
  await act(async () => switchProfile("synthetic-b"));
  await tick();
  assert.match(document.body.textContent, /Profile B only/);
  await act(async () => finish(state("scope-a", "Private A late response")));
  await tick();
  assert.doesNotMatch(document.body.textContent, /Private A late response/);
  await act(async () => root.render(null));
});

test("production user recovery confirms UNKNOWN native outcome and revokes only Workspace edits without cancelling the thread", async () => {
  const run = {
    id: "run-unknown",
    item_id: "recover-page",
    session_id: "thread-existing",
    allowed_item_ids: ["recover-page"],
    status: "running",
    progress: "Native outcome unknown",
  };
  const state = {
    scope_id: "recover-scope",
    revision: 1,
    items: [
      {
        id: "recover-page",
        title: "Recover me",
        kind: "page",
        parent_id: null,
        content: "<p>Saved partial changes</p>",
        properties: {},
        thread_id: "thread-existing",
      },
    ],
    comments: [],
    runs: [run],
    versions: [
      { id: "before", item_id: "recover-page", created_at: "before run" },
    ],
    attachments: [],
    recents: [],
    templates: [],
  };
  const calls = [];
  const nativeCount = nativeCalls.length;
  const ctx = {
    onDispose: () => {},
    rest: async (path, opts) => {
      calls.push({ path, opts });
      if (path === "/state") return structuredClone(state);
      if (path === "/command") {
        state.revision++;
        return { result: {}, state: structuredClone(state) };
      }
      if (path === "/workflow/status")
        throw new Error("Native status unavailable; outcome unknown");
      if (path === "/workflow/recover") {
        assert.equal(opts.body.expected_scope, "recover-scope");
        run.status = "error";
        run.error = "User recovered document; native terminal UNKNOWN";
        state.revision++;
        return { run, native_terminal: "UNKNOWN" };
      }
      throw new Error(path);
    },
  };
  await act(async () => root.render(h(Workspace, { ctx })));
  await tick();
  await click(button("Recover me"));
  await tick();
  assert.equal(
    document.querySelector("[contenteditable]").getAttribute("contenteditable"),
    "false",
  );
  await click(button("Recover document"));
  assert.match(
    document.querySelector('[role="dialog"]').textContent,
    /native thread may continue/i,
  );
  assert.match(
    document.querySelector('[role="dialog"]').textContent,
    /partial changes.*pre-run/i,
  );
  assert.equal(calls.filter((c) => c.path === "/workflow/recover").length, 0);
  await click(button("Revoke Workspace edits"));
  assert.equal(run.status, "error");
  assert.equal(
    document.querySelector("[contenteditable]").getAttribute("contenteditable"),
    "true",
  );
  assert.equal(
    document.querySelector("[contenteditable]").textContent,
    "Saved partial changes",
  );
  assert.match(document.body.textContent, /native terminal UNKNOWN/);
  assert.equal(button("Restore pre-run version").disabled, false);
  assert.equal(
    nativeCalls
      .slice(nativeCount)
      .some(
        (c) => c.method === "prompt.cancel" || c.method === "prompt.submit",
      ),
    false,
  );
  await act(async () => root.render(null));
});

const searchPageResult = (state, items) => ({result:{scope_id:state.scope_id,revision:state.revision,
  items,total:items.length,offset:0,limit:100,next_offset:null,has_more:false}});
const settledSearch = () => tick(230);

test("live search rejects obsolete completion across explicit navigation, clear and newer queries", async () => {
  for (const destination of ["Home", "folder", "Clear", "Trash", "search"]) for (const rejectOld of [false,true]) {
    const item=(id,title,kind='page')=>({id,title,kind,parent_id:null,database_id:null,content:'<p>Saved content</p>',properties:{},columns:[],deleted_at:null,thread_id:null});
    const state={scope_id:'search-scope',revision:1,items:[item('p','Search page'),item('f','Search folder','folder')],comments:[],runs:[],versions:[],attachments:[],recents:[],templates:[]};
    const requests=[],ctx={onDispose:()=>{},rest:async(path,options)=>{
      if(path==='/state')return structuredClone(state);
      if(options.body.op==='search_page')return new Promise((resolve,reject)=>requests.push({query:options.body.payload.query,resolve:items=>resolve(searchPageResult(state,items)),reject}));
      return {result:{},state:structuredClone(state)};
    }};
    await act(async()=>root.render(h(Workspace,{ctx})));await tick();await click(button('Search page'));
    await input(document.querySelector('[aria-label="Search Workspace"]'),'old query');await settledSearch();
    assert.equal(requests.length,1);assert.match(document.querySelector('.ws-search-status').textContent,/Searching/);
    if(destination==='Home')await click(button('Home'));
    else if(destination==='folder')await click(button('Search folder'));
    else if(destination==='Clear')await click(button('Clear search'));
    else if(destination==='Trash')await click(button('Trash (0)'));
    else {await input(document.querySelector('[aria-label="Search Workspace"]'),'new query');await settledSearch();}
    await act(async()=>rejectOld?requests[0].reject(Error('Obsolete search error')):requests[0].resolve([{id:'p',title:'Obsolete result'}]));await tick();
    assert.doesNotMatch(document.querySelector('.ws-work').textContent,/Obsolete result|Obsolete search error/);
    assert.doesNotMatch(document.querySelector('.ws-workspace-search').textContent,/Obsolete result|Obsolete search error/);
    if(destination==='search'){
      assert.equal(requests.length,2);await act(async()=>requests[1].resolve([{id:'p',title:'Current result'}]));await tick();
      assert.match(document.querySelector('.ws-search-results').textContent,/Current result/);
      assert.equal(document.querySelector('.ws-search-status').textContent,'Results 1–1 of 1.');
    }else assert.equal(document.querySelector('.ws-search-status').textContent,'');
    await act(async()=>root.render(null));
  }
});

test("live search announces empty/error/retry and clear without a duplicate global error",async()=>{
  const state={scope_id:'search-outcome',revision:1,items:[],comments:[],runs:[],versions:[],attachments:[],recents:[],templates:[]};let fail=false;
  const ctx={onDispose:()=>{},rest:async(path,opts)=>{
    if(path==='/state')return structuredClone(state);
    if(opts.body.op==='search_page'){if(fail)throw Error('Synthetic search transport failure');return searchPageResult(state,[]);}
    return {result:{},state:structuredClone(state)};
  }};
  await act(async()=>root.render(h(Workspace,{ctx})));await tick();
  await input(document.querySelector('[aria-label="Search Workspace"]'),'nothing');await settledSearch();
  assert.equal(document.querySelector('.ws-search-status').textContent,'No matches');fail=true;
  await input(document.querySelector('[aria-label="Search Workspace"]'),'failing');await settledSearch();
  assert.match(document.querySelector('.ws-search-status').textContent,/Search did not finish/);
  assert.match(document.querySelector('.ws-search-results [role="alert"]').textContent,/Synthetic search transport failure/);
  assert.equal(document.querySelector('.ws-error'),null);
  fail=false;await click(button('Retry search'));await settledSearch();assert.equal(document.querySelector('.ws-search-status').textContent,'No matches');
  await input(document.querySelector('[aria-label="Search Workspace"]'),'');assert.equal(document.querySelector('.ws-search-status').textContent,'');
  await act(async()=>root.render(null));
});

test("failed section consent retires the old approval and re-review requires explicit fresh submission", async () => {
  const page = { id: "consent-page", kind: "page", title: "Section consent", parent_id: null, content: "<p>Young trees sheltered.</p>", properties: {}, columns: [], deleted_at: null };
  const change = { status: "available", version_id: "version", generation_id: "generation", change_id: "change" };
  const comment = { id: "consent-comment", item_id: page.id, text: "Review the shade", anchor: { quote: "Young trees sheltered.", prefix: "", suffix: "" }, resolved: false, replies: [], section_change: change };
  const state = { scope_id: "consent-scope", revision: 1, items: [page], comments: [comment], runs: [], versions: [], attachments: [], recents: [], templates: [] };
  let reviews = 0, applications = 0;
  const ctx = { onDispose: () => {}, rest: async (path, options) => {
    if (path === "/state") return structuredClone(state);
    const { op, payload } = options.body;
    if (op === "preview_section_revert") {
      reviews++;
      return { result: { ...change, content_hash: "hash-" + reviews, manual_revision: reviews, dataset_epoch: 1,
        current_html: "<p>Young trees sheltered.</p>", before_html: "<p>Young trees shaded.</p>",
        current_text: "Young trees sheltered.", before_text: "Young trees shaded.", requires_confirmation: true } };
    }
    if (op === "revert_section") {
      applications++;
      assert.equal(payload.confirmed, true);
      if (applications === 1) throw Error("This page was edited after section review. Close and review the section again.");
      assert.equal(payload.content_hash, "hash-2");
      return { result: {}, state: structuredClone(state) };
    }
    return { result: {}, state: structuredClone(state) };
  } };
  await act(async () => root.render(h(Workspace, { ctx }))); await tick();
  await click(button("Section consent"));
  await click(document.getElementById("ws-bubble-consent-comment"));
  await click(document.querySelector('button[aria-label="Revert changes: Review the shade"]')); await tick(30);
  assert.equal(reviews, 1); assert.equal(applications, 0);
  await click(button("Revert section")); await tick(30);
  assert.equal(applications, 1);
  assert.equal(button("Revert section").disabled, true);
  const expired = document.querySelector('[role="alert"]');
  assert.match(expired.querySelector('p').textContent, /Choose Review section again/);
  assert.doesNotMatch(expired.querySelector('p').textContent, /Close and review/);
  assert.match(expired.querySelector('details pre').textContent, /edited after section review/);
  const form = button("Revert section").closest("form");
  await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); await tick();
  assert.equal(applications, 1, "Disabled consent cannot be resubmitted through Enter/form submission");
  await click(button("Review section again")); await tick(30);
  assert.equal(reviews, 2); assert.equal(applications, 1, "Re-review must never auto-apply");
  assert.equal(button("Revert section").disabled, false);
  await click(button("Revert section")); await tick(30);
  assert.equal(applications, 2);
  await act(async () => root.render(null));
});

test("new pending/error query cannot impersonate previous successful results",async()=>{
  for(const populated of [false,true]){
    const state={scope_id:'query-phases',revision:1,items:[],comments:[],runs:[],versions:[],attachments:[],recents:[],templates:[]};
    const requests=[],ctx={onDispose:()=>{},rest:async(path,opts)=>{
      if(path==='/state')return structuredClone(state);
      if(opts.body.op==='search_page')return new Promise((resolve,reject)=>requests.push({resolve:items=>resolve(searchPageResult(state,items)),reject}));
      return {result:{},state:structuredClone(state)};
    }};
    await act(async()=>root.render(h(Workspace,{ctx})));await tick();
    await input(document.querySelector('[aria-label="Search Workspace"]'),'earlier');await settledSearch();
    await act(async()=>requests[0].resolve(populated?[{id:'old',title:'Old result'}]:[]));await tick();
    await input(document.querySelector('[aria-label="Search Workspace"]'),'new');await settledSearch();
    assert.equal(document.querySelector('.ws-search-results').getAttribute('aria-busy'),'true');
    assert.doesNotMatch(document.querySelector('.ws-search-results').textContent,/Old result|No matches/);
    await act(async()=>requests[1].reject(Error('Synthetic search refusal')));await tick();
    assert.match(document.querySelector('.ws-search-status').textContent,/did not finish/);
    assert.doesNotMatch(document.querySelector('.ws-search-results').textContent,/Old result|No matches/);
    await input(document.querySelector('[aria-label="Search Workspace"]'),'next');await settledSearch();
    await act(async()=>requests[2].resolve([{id:'new',title:'Current result'}]));await tick();
    assert.match(document.querySelector('.ws-search-results').textContent,/Current result/);await act(async()=>root.render(null));
  }
});

test("live search does not flush an unsaved title; opening a result preserves a failed departure",async()=>{
  const item=(id,title)=>({id,kind:'page',title,parent_id:null,content:'<p>Saved text</p>',properties:{},columns:[],deleted_at:null,thread_id:null});
  const state={scope_id:'draft-search',revision:1,items:[item('p','Draft search page'),item('q','Target page')],comments:[],runs:[],versions:[],attachments:[],recents:[],templates:[]};
  let rejectSave,searchCalls=0;
  const ctx={onDispose:()=>{},rest:async(path,opts)=>{
    if(path==='/state')return structuredClone(state);
    const {op,payload}=opts.body;
    if(op==='update_item'&&payload.patch?.title)return new Promise((resolve,reject)=>{rejectSave=reject;});
    if(op==='search_page'){searchCalls++;return searchPageResult(state,[{id:'q',title:'Target result'}]);}
    return {result:{},state:structuredClone(state)};
  }};
  await act(async()=>root.render(h(Workspace,{ctx})));await tick();await click(button('Draft search page'));
  await input(document.querySelector('[aria-label="Page title"]'),'Retain this unsaved title');
  await input(document.querySelector('[aria-label="Search Workspace"]'),'orchard');await settledSearch();
  assert.equal(searchCalls,1);assert.equal(rejectSave,undefined,'search typing did not flush the title');
  assert.equal(document.querySelector('[aria-label="Page title"]').value,'Retain this unsaved title');
  await click(button('Target result'));assert.equal(typeof rejectSave,'function');
  await act(async()=>rejectSave(Error('Synthetic title refusal')));await tick();
  assert.equal(document.querySelector('[aria-label="Page title"]').value,'Retain this unsaved title');
  assert.match(document.querySelector('.ws-work').textContent,/Title not saved/);await act(async()=>root.render(null));
});

test("run-status failure names its page, retains diagnostics and offers existing recovery without replay", async () => {
  const state = { scope_id: "run-error-scope", revision: 1,
    items: [{ id: "p", kind: "page", title: "Status recovery page", parent_id: null, content: "<p>Saved partial text</p>", properties: {}, columns: [], deleted_at: null, thread_id: "thread-existing" }],
    comments: [], runs: [{ id: "status-run", item_id: "p", session_id: "thread-existing", status: "running", allowed_item_ids: ["p"], comment_ids: [], progress: "Checking native status" }],
    versions: [], attachments: [], recents: [], templates: [] };
  const calls = [], before = nativeCalls.length;
  const ctx = { onDispose: () => {}, rest: async (path, options) => {
    calls.push(path);
    if (path === "/state") return structuredClone(state);
    if (path === "/workflow/consume") throw Error("Synthetic internal owner status diagnostic");
    if (path === "/command") return { result: {}, state: structuredClone(state) };
    throw Error("Unexpected operation " + path);
  } };
  await act(async () => root.render(h(Workspace, { ctx }))); await tick(); await tick();
  const banner = document.querySelector(".ws-error");
  assert.match(banner.querySelector("p").textContent, /run status for “Status recovery page” could not be checked/);
  assert.match(banner.querySelector("p").textContent, /Native execution may still continue/);
  assert.equal(banner.querySelector("pre").textContent, "Synthetic internal owner status diagnostic");
  await click(button("Open run page"));
  assert.equal(document.querySelector('[aria-label="Page title"]').value, "Status recovery page");
  await click(button("Open linked thread"));
  assert.ok(nativeCalls.slice(before).some(call => call.method === "open" && call.id === "thread-existing"));
  const consumeCount = calls.filter(path => path === "/workflow/consume").length;
  await click(button("Dismiss"));
  await tick(3300);
  assert.equal(calls.filter(path => path === "/workflow/consume").length, consumeCount, "a failed status is not retried forever");
  assert.equal(document.querySelector(".ws-error"), null, "dismissed status error stays dismissed");
  assert.equal(calls.includes("/workflow/prepare"), false);
  assert.equal(nativeCalls.slice(before).some(call => call.method === "prompt.submit"), false);
  await act(async () => root.render(null));
});


test("run review message dismisses across refresh and reopen, and a later run is visible", async () => {
  const saved = new Map();
  const run = { id: "failed-run", item_id: "p", session_id: "thread-existing", status: "error", updated_at: "first", error: "Edits were not saved" };
  const state = { scope_id: "dismiss-run-scope", revision: 1,
    items: [{ id: "p", kind: "page", title: "Dismiss run page", parent_id: null, content: "<p>Unchanged</p>", properties: {}, columns: [], deleted_at: null, thread_id: "thread-existing" }],
    comments: [], runs: [run], versions: [], attachments: [], recents: [], templates: [] };
  const calls = [];
  const ctx = { storage: { get: (key, fallback) => saved.get(key) ?? fallback, set: (key, value) => saved.set(key, value) },
    onDispose: () => {}, rest: async (path, options) => {
      calls.push(path);
      if (path === "/state") return structuredClone(state);
      if (path === "/command") return { result: {}, state: structuredClone(state) };
      throw Error("Unexpected operation " + path);
    } };
  const banner = () => document.querySelector('[aria-label="Workspace run needs review"]');
  await act(async () => root.render(h(Workspace, { ctx }))); await tick();
  await click(button("Dismiss run page")); assert.ok(banner());
  await click(button("Dismiss run message")); assert.equal(banner(), null);
  await tick(3200); assert.equal(banner(), null, "polling keeps dismissal");
  await act(async () => root.render(null));
  await act(async () => root.render(h(Workspace, { ctx }))); await tick();
  await click(button("Dismiss run page")); assert.equal(banner(), null, "reopening keeps dismissal");
  run.id = "later-failed-run"; run.updated_at = "second"; state.revision++;
  await tick(3200); assert.ok(banner(), "new run gets its own warning");
  assert.equal(calls.some(path => path.startsWith('/workflow/')), false, "dismissal has no run effects");
  await act(async () => root.render(null));
});
