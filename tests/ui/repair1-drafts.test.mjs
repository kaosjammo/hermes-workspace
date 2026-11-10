import { test, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div>', {
  url: "https://workspace.test",
});
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
  createElement: h,
  createRoot,
  act,
  host,
  switchProfile,
  switchConnection,
  advanceEpoch,
} = await import("../../.local/frontend/ui-runtime.mjs");
const root = createRoot(document.querySelector("#app"));
const tick = (ms) => act(() => new Promise((r) => setTimeout(r, ms ?? 0)));
const button = (text) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === text);
const click = async (text) => {
  assert.ok(button(text), text);
  await act(async () => button(text).click());
  await tick();
};
beforeEach(async () => {
  await act(async () => root.render(null));
});
afterEach(async () => {
  await act(async () => root.render(null));
});
const storage = () => {
  const data = new Map();
  return {
    get: (key, fallback) =>
      data.has(key) ? structuredClone(data.get(key)) : fallback,
    set: (key, value) => data.set(key, structuredClone(value)),
    remove: (key) => data.delete(key),
  };
};
function fixture({ pending = false, rejectTitle = false } = {}) {
  const snapshots = new Map(),
    calls = [];
  let release;
  const key = () => `${host.activeConnectionId()}/${host.state.profile.get()}`;
  const snapshot = () => {
    if (!snapshots.has(key()))
      snapshots.set(key(), {
        scope_id: "scope-" + key(),
        revision: 1,
        items: [
          {
            id: "same-item",
            kind: "page",
            title: "Draft page",
            content: "<p>Saved text</p>",
            parent_id: null,
            properties: {},
            columns: [],
          },
        ],
        comments: [],
        runs: [],
        versions: [],
        attachments: [],
        templates: [],
        recents: [],
      });
    return snapshots.get(key());
  };
  const ctx = {
    storage: storage(),
    onDispose: () => {},
    rest: async (path, opts) => {
      const state = snapshot();
      if (path === "/state") return structuredClone(state);
      calls.push({ key: key(), ...opts.body });
      if (opts.body.op === "update_item") {
        if (rejectTitle && opts.body.payload.patch.title !== undefined) throw new Error("Synthetic rejected rename");
        if (pending) await new Promise((r) => (release = r));
        Object.assign(state.items[0], opts.body.payload.patch);
        state.revision++;
      }
      return { result: state.items[0], state: structuredClone(state) };
    },
  };
  return { ctx, calls, release: () => release(), snapshot, allowTitle: () => { rejectTitle = false; } };
}
const type = async (text) => {
  const editor = document.querySelector("[contenteditable]");
  await act(async () => {
    editor.innerHTML = `<p>${text}</p>`;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
};
async function mount(ctx) {
  await act(async () => root.render(h(Workspace, { ctx })));
  await tick();
  await click("Draft page");
}
for (const boundary of ["profile", "connection", "epoch", "disable"])
  test(`draft survives ${boundary} before timer, recovery is visible and never auto-writes a new source`, async () => {
    await act(async () => {
      switchConnection("local");
      switchProfile("draft-a");
    });
    const f = fixture();
    await mount(f.ctx);
    await type(`Unsent ${boundary}`);
    if (boundary === "profile") {
      await act(async () => switchProfile("draft-b"));
      await tick(750);
      await act(async () => switchProfile("draft-a"));
    }
    if (boundary === "connection") {
      await act(async () => switchConnection("remote"));
      await tick(750);
      await act(async () => switchConnection("local"));
    }
    if (boundary === "epoch") {
      await act(async () => advanceEpoch());
      await tick(750);
    }
    if (boundary === "disable") {
      await act(async () => root.render(null));
      await tick(750);
      await act(async () => root.render(h(Workspace, { ctx: { ...f.ctx } })));
    }
    await tick();
    assert.equal(f.calls.filter((c) => c.op === "update_item").length, 0);
    assert.match(document.body.textContent, /Recoverable draft/);
    await click("Draft page");
    assert.equal(
      document.querySelector("[contenteditable]").textContent,
      "Saved text",
    );
    await click("Recover draft");
    assert.equal(
      document.querySelector("[contenteditable]").textContent,
      `Unsent ${boundary}`,
    );
    await tick(750);
    const write = f.calls.find((c) => c.op === "update_item");
    assert.equal(write.key, "local/draft-a");
    assert.equal(write.expected_scope, "scope-local/draft-a");
    await act(async () => root.render(null));
  });
test("in-flight source save stays recoverable after unmount and late response cannot remove a newer local draft", async () => {
  await act(async () => {
    switchConnection("local");
    switchProfile("inflight-a");
  });
  const f = fixture({ pending: true });
  await mount(f.ctx);
  await type("In-flight original");
  await tick(700);
  assert.equal(f.calls.filter((c) => c.op === "update_item").length, 1);
  await act(async () => switchProfile("inflight-b"));
  await tick();
  await act(async () => f.release());
  await tick();
  await act(async () => switchProfile("inflight-a"));
  await tick();
  assert.match(document.body.textContent, /Recoverable draft/);
  await click("Draft page");
  assert.ok(button("Recover draft"));
  assert.equal(f.calls.filter((c) => c.op === "update_item").length, 1);
  await act(async () => root.render(null));
});
test("saved-scope identity isolates recovery from a replaced dataset with colliding item ID", async () => {
  await act(async () => {
    switchConnection("local");
    switchProfile("scope-a");
  });
  const f = fixture();
  await mount(f.ctx);
  await type("Original dataset draft");
  await act(async () => root.render(null));
  f.snapshot().scope_id = "replacement-scope";
  await act(async () => root.render(h(Workspace, { ctx: { ...f.ctx } })));
  await tick();
  assert.doesNotMatch(document.body.textContent, /Recoverable draft/);
  await click("Draft page");
  assert.equal(button("Recover draft"), undefined);
  await act(async () => root.render(null));
  f.snapshot().scope_id = "scope-local/scope-a";
  await act(async () => root.render(h(Workspace, { ctx: { ...f.ctx } })));
  await tick();
  assert.match(document.body.textContent, /Recoverable draft/);
  await act(async () => root.render(null));
});
after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});
test("disable while save is in-flight retains bytes; old acknowledgement cannot discard a newer recovered edit", async () => {
  await act(async () => {
    switchConnection("local");
    switchProfile("disable-inflight");
  });
  const f = fixture({ pending: true });
  await mount(f.ctx);
  await type("Older in-flight");
  await tick(700);
  await act(async () => root.render(null));
  await act(async () => root.render(h(Workspace, { ctx: { ...f.ctx } })));
  await tick();
  assert.match(document.body.textContent, /Recoverable draft/);
  await click("Draft page");
  await click("Recover draft");
  await type("Newer recovered local edit");
  await act(async () => f.release());
  await tick();
  await act(async () => root.render(null));
  await act(async () => root.render(h(Workspace, { ctx: { ...f.ctx } })));
  await tick();
  await click("Draft page");
  await click("Recover draft");
  assert.equal(
    document.querySelector("[contenteditable]").textContent,
    "Newer recovered local edit",
  );
  await act(async () => root.render(null));
});


test("failed rename survives a source switch without writing the new profile", async () => {
  await act(async () => { switchConnection("local"); switchProfile("title-source-a"); });
  const f = fixture({ rejectTitle: true });
  await mount(f.ctx);
  await act(async () => {
    const title = document.querySelector('[aria-label="Page title"]');
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(title, "Retained rename");
    title.dispatchEvent(new Event("input", { bubbles: true }));
    title.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await click("Home");
  assert.match(document.body.textContent, /Title not saved/);
  assert.equal(document.querySelector('[aria-label="Page title"]').value, "Retained rename");
  await act(async () => switchProfile("title-source-b")); await tick();
  assert.doesNotMatch(document.body.textContent, /Recover title: Draft page/);
  assert.equal(f.calls.filter(c => c.key === "local/title-source-b" && c.op === "update_item").length, 0);
  await act(async () => switchProfile("title-source-a")); await tick();
  await click("Recover title: Draft page");
  assert.ok(button("Recover title"));
  assert.equal(document.querySelector('[aria-label="Page title"]').value, "Draft page");
  f.allowTitle(); await click("Recover title"); await tick();
  assert.equal(f.snapshot().items[0].title, "Retained rename");
  assert.equal(document.querySelector('[aria-label="Page title"]').value, "Retained rename");
  await click("Home");
  assert.doesNotMatch(document.body.textContent, /Recover title:/);
});
