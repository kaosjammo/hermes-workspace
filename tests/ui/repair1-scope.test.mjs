import { test, after, afterEach } from "node:test";
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
  "Event",
  "MouseEvent",
  "InputEvent",
])
  globalThis[key] = dom.window[key];
globalThis.getSelection = () => dom.window.getSelection();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {
  Workspace,
  Comments,
  createElement: h,
  createRoot,
  act,
  switchProfile,
} = await import("../../.local/frontend/ui-runtime.mjs");
const root = createRoot(document.querySelector("#app"));
const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));
const button = (text) =>
  [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent) === text);
const click = async (text) => {
  assert.ok(button(text), text);
  await act(async () => button(text).click());
  await tick();
};
const item = (id, title) => ({
  id,
  title,
  kind: "page",
  parent_id: null,
  content: "<p>Text</p>",
  properties: {},
  columns: [],
  thread_id: null,
});
const state = () => ({
  scope_id: "scope-review",
  revision: 1,
  items: [item("p", "Draft"), item("q", "Budget"), item("r", "Do not touch")],
  comments: [],
  runs: [],
  versions: [],
  attachments: [],
  templates: [],
  recents: [],
});
test("comment composer has no permission panel; legacy saved references remain inert", async () => {
  const s = state(),
    commands = [];
  const props = {
    item: s.items[0],
    state: s,
    text: "Text",
    anchor: null,
    setAnchor: () => {},
    locked: false,
    workflow: {},
    onError: (e) => {
      throw e;
    },
    onRun: async () => {},
    onRefresh: async () => {},
    command: async (op, payload) => commands.push({ op, payload }),
  };
  await act(async () => root.render(h(Comments, props)));
  await click("Add whole-page comment");
  assert.equal(document.querySelector('input[aria-label^="Also allow edits to"]'), null);
  assert.doesNotMatch(document.querySelector('form').textContent, /Also allow edits to/);
  const text = document.querySelector('textarea[aria-label="New comment"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      dom.window.HTMLTextAreaElement.prototype,
      "value",
    ).set.call(text, "Update these totals. Do not edit Do not touch.");
    text.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Add comment");
  assert.deepEqual(commands[0].payload.target_item_ids, []);
  assert.equal(commands.length, 1);
  const comment = {
    id: "c",
    ...commands[0].payload,
    resolved: false,
    replies: [],
  };
  s.comments.push(comment, { ...comment, id: 'legacy', target_item_ids: ['q'] });
  await act(async () =>
    root.render(h(Comments, { ...props, activeComment: "legacy", state: { ...s } })),
  );
  assert.match(document.querySelector('[aria-label="Named edit targets"]').textContent, /Budget.*Workspace.*page/);
  assert.doesNotMatch(
    document.querySelector('[aria-label="Named edit targets"]').textContent,
    /Do not touch/,
  );
});
test("inert comment target refs require fresh unchecked per-run approval; default only current page, profile switch abandons modal", async () => {
  await act(async () => switchProfile("scope-user"));
  const s = state();
  s.comments = [
    {
      id: "c",
      item_id: "p",
      text: "Budget is quoted here. Do not edit Do not touch.",
      target_item_ids: ["q"],
      anchor: null,
      resolved: false,
      replies: [],
    },
  ];
  const preparations = [],
    consumptions = [];
  let lastRun;
  const ctx = {
    onDispose: () => {},
    rest: async (path, opts) => {
      if (path === "/state") return structuredClone(s);
      if (path === "/command") return { result: {}, state: structuredClone(s) };
      if (path === '/workflow/review-scope') return {
        review_id: 'synthetic-review-' + preparations.length,
        scope_id: s.scope_id, revision: s.revision,
        item_id: opts.body.item_id, selected_item_ids: opts.body.selected_item_ids,
      };
      if (path === "/workflow/prepare") {
        preparations.push(opts.body);
        lastRun = {
          id: "run" + preparations.length,
          item_id: "p",
          status: "completed",
          allowed_item_ids: ["p", ...opts.body.explicit_item_ids],
        };
        return {
          run: lastRun,
          prompt: "Process comments",
          submission_id: lastRun.id,
        };
      }
      if (path === "/workflow/consume") {
        assert.equal(opts.method, "POST");
        assert.deepEqual(opts.body, {
          run_id: lastRun.id,
          expected_scope: s.scope_id,
        });
        consumptions.push(opts.body);
        return { run: structuredClone(lastRun), native_terminal: "completed" };
      }
      if (path === "/workflow/status") return { run: lastRun };
      throw new Error(path);
    },
  };
  await act(async () => root.render(h(Workspace, { ctx })));
  await tick();
  await click("Draft");
  await click("Address comments (1)");
  assert.equal(preparations.length, 0);
  assert.ok(document.querySelector('[role="dialog"]'));
  assert.match(
    document.querySelector('[role="dialog"]').textContent,
    /Budget is quoted/,
  );
  let target = document.querySelector(
    'input[aria-label="Allow edits to Budget · Workspace · page"]',
  );
  assert.ok(target);
  assert.equal(target.checked, false);
  await click("Address current page");
  assert.deepEqual(preparations[0].explicit_item_ids, []);
  assert.deepEqual(consumptions.map((body) => body.run_id), ["run1"]);
  assert.equal(Boolean(document.querySelector('[role="dialog"]')), false);
  await click("Address comments (1)");
  target = document.querySelector(
    'input[aria-label="Allow edits to Budget · Workspace · page"]',
  );
  assert.equal(target.checked, false);
  await act(async () => target.click());
  await click("Address selected scope");
  assert.deepEqual(preparations[1].explicit_item_ids, ["q"]);
  assert.deepEqual(consumptions.map((body) => body.run_id), ["run1", "run2"]);
  assert.equal(Boolean(document.querySelector('[role="dialog"]')), false);
  await click("Address comments (1)");
  assert.equal(
    document.querySelector('input[aria-label="Allow edits to Budget · Workspace · page"]')
      .checked,
    false,
  );
  await act(async () => switchProfile("other-source"));
  await tick();
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(preparations.length, 2);
  assert.equal(consumptions.length, 2);
});
afterEach(async () => {
  await act(async () => root.render(null));
});
after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});
test("scope confirmation rejects edited target metadata while the review is open", async () => {
  await act(async () => switchProfile("scope-change"));
  const s = state();
  s.comments = [
    {
      id: "c",
      item_id: "p",
      text: "Change Budget",
      target_item_ids: ["q"],
      anchor: null,
      resolved: false,
      replies: [],
    },
  ];
  let prepares = 0;
  const ctx = {
    onDispose: () => {},
    rest: async (path, opts) => {
      if (path === "/state") return structuredClone(s);
      if (path === "/command") return { result: {}, state: structuredClone(s) };
      if (path === "/workflow/prepare") {
        prepares++;
        throw new Error("must not prepare");
      }
      throw new Error(path);
    },
  };
  await act(async () => root.render(h(Workspace, { ctx })));
  await tick();
  await click("Draft");
  await click("Address comments (1)");
  const check = document.querySelector(
    'input[aria-label="Allow edits to Budget · Workspace · page"]',
  );
  await act(async () => check.click());
  s.comments[0].target_item_ids = ["r"];
  s.revision++;
  // Let the normal SDK query publish the changed comment references.
  await act(() => new Promise((r) => setTimeout(r, 3100)));
  await click("Address selected scope");
  assert.equal(prepares, 0);
  assert.match(
    document.querySelector('[role="dialog"]').textContent,
    /changed.*review/i,
  );
});
