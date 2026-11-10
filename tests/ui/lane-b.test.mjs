import { test, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(process.env.LANE_B_TOOLCHAIN
  ? `${process.env.LANE_B_TOOLCHAIN}/package.json`
  : new URL('../../.local/toolchain/package.json', import.meta.url));
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div>', { url: "https://lane-b.test", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "InputEvent", "CompositionEvent"])
  globalThis[key] = dom.window[key];
globalThis.getSelection = () => dom.window.getSelection();
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { Comments, ThreadPicker, reviewScope, ScopeReviewDialog, createWorkflowAdapter, host,
  switchProfile, advanceEpoch, createElement: h, createRoot, act, useState } = await import(
    process.env.LANE_B_RUNTIME ?? new URL('../../.local/frontend/ui-runtime.mjs', import.meta.url));
const root = createRoot(document.querySelector("#app"));
const tick = () => act(() => new Promise(r => setTimeout(r, 0)));
const buttons = (name, scope = document) => [...scope.querySelectorAll("button")].filter(b => (b.getAttribute("aria-label") ?? b.textContent.trim()) === name);
const click = async (name, scope) => {
  const b = buttons(name, scope)[0]; assert.ok(b, name);
  await act(async () => b.click()); await tick();
};
const type = async (node, value) => act(async () => {
  const proto = node.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(node, value);
  node.dispatchEvent(new Event("input", { bubbles: true }));
});
const key = async (node, options = {}) => {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...options });
  await act(async () => node.dispatchEvent(event)); return event;
};
const item = (id = "p", kind = "page") => ({ id, kind, title: `Synthetic ${id}`, thread_id: null });
const comment = (id, extras = {}) => ({ id, item_id: "p", text: `Feedback ${id}`, resolved: false, anchor: null, replies: [], ...extras });
let current;
function Harness({ kind = "page", comments = [], retained = {}, fail = false, delay = null, locked = false, anchor: initialAnchor = null }) {
  const [state, setState] = useState({ scope_id: "synthetic", items: [item("p", kind), item("q"), item("r")], comments, attachments: [] });
  const [anchor, setAnchor] = useState(initialAnchor), [active, setActive] = useState(comments[0]?.id ?? null);
  const [showResolved, setShowResolved] = useState(true), [hovered, setHovered] = useState(comments[0]?.id ?? null);
  const calls = current?.calls ?? [], errors = current?.errors ?? [];
  current = { calls, errors, state, anchor, active, hovered, retained };
  return h(Comments, { item: state.items[0], state, text: "Synthetic passage", anchor, setAnchor,
    activeComment: active, setActiveComment: setActive, hoveredComment: hovered, setHoveredComment: setHovered,
    geometry: anchor ? [{ id: "__workspace-comment-draft", block: document.querySelector("#app"), top: 0, lineGroup: "draft" }] : [],
    showResolved, setShowResolved, locked, workflow: {}, onError: e => errors.push(e.message), onRun: () => {}, onRefresh: () => {},
    returnToEditor: () => {}, draftBuffer: { read: () => ({ draft: retained }), put: d => Object.assign(retained, d), discard: () => Object.assign(retained, { text: "", targets: [], anchor: null, replies: {} }) },
    command: async (op, payload) => {
      calls.push({ op, payload }); if (delay) await delay;
      if (fail) throw new Error("Synthetic refusal");
      setState(s => ({ ...s, comments: op === "delete_comment" ? s.comments.filter(c => c.id !== payload.id)
        : op === "add_comment" ? [...s.comments, comment(`new-${calls.length}`, payload)] : s.comments }));
    },
  });
}
async function render(props = {}) { current = null; await act(async () => root.render(h(Harness, props))); await tick(); }
async function open() { await click("Add whole-page comment"); return document.querySelector('textarea[aria-label="New comment"]'); }

test("empty/cleared/postsubmit composers expose first-row Cancel, no per-comment targets, retain unrelated replies", async () => {
  for (const kind of ["page", "database", "record"]) {
    await render({ kind, retained: { replies: { unrelated: "Keep reply" } } });
    await click(kind === "database" ? "Add database comment" : "Add whole-page comment");
    const input = document.querySelector('textarea[aria-label="New comment"]'), form = input.form;
    assert.equal(form.querySelector("button").textContent, "Cancel comment");
    assert.ok(form.querySelector(".ws-comment-compose-heading button"));
    assert.doesNotMatch(form.textContent, /Also allow edits to|Selected target items/);
    await type(input, "Draft"); await type(input, "");
    await click("Cancel comment"); assert.equal(document.querySelector('textarea[aria-label="New comment"]'), null);
    assert.equal(current.retained.replies.unrelated, "Keep reply"); assert.equal(current.calls.length, 0);
    await act(async () => root.render(null));
  }
  await render(); let input = await open(); await type(input, "Saved feedback"); await click("Add comment");
  input = document.querySelector('textarea[aria-label="New comment"]');
  assert.ok(input); assert.equal(input.value, ""); assert.ok(buttons("Cancel comment")[0]);
  await click("Cancel comment"); assert.equal(current.state.comments.length, 1);
});

test("Ctrl+Enter uses form validation, Enter remains newline, IME/repeat/empty/locked are refused", async () => {
  await render(); const input = await open();
  await key(input, { ctrlKey: true }); assert.equal(current.calls.length, 0);
  await type(input, "Keyboard feedback");
  assert.equal((await key(input)).defaultPrevented, false);
  await key(input, { ctrlKey: true, isComposing: true });
  await key(input, { ctrlKey: true, keyCode: 229 });
  await key(input, { ctrlKey: true, repeat: true }); assert.equal(current.calls.length, 0);
  await key(input, { ctrlKey: true }); assert.equal(current.calls.length, 1);
  assert.deepEqual(current.calls[0], { op: "add_comment", payload: { item_id: "p", text: "Keyboard feedback", target_item_ids: [] } });
  assert.ok(document.querySelector('[data-tip="Add comment (Ctrl+Enter)"]'));
  await act(async () => root.render(null));
  await render({ locked: true, retained: { text: "Locked draft" } });
  await act(async () => document.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.equal(current.calls.length, 0);
});

test("simultaneous click/key submit is one write; failure retains exact draft, anchor and legacy inert targets", async () => {
  let finish; const delay = new Promise(r => { finish = r; });
  const anchor = { quote: "Synthetic", prefix: "", suffix: " passage", start: 0, end: 9 };
  await render({ delay, fail: true, anchor, retained: { text: "Keep exact", targets: ["q"], anchor, replies: { other: "Keep" } } });
  const input = document.querySelector('textarea[aria-label="New comment"]');
  await act(async () => {
    input.form.requestSubmit(); input.form.requestSubmit();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
  });
  assert.equal(current.calls.length, 1); assert.equal(buttons("Cancel comment")[0].disabled, true);
  await act(async () => finish()); await tick();
  assert.equal(input.value, "Keep exact"); assert.equal(current.retained.replies.other, "Keep");
  assert.deepEqual(current.calls[0].payload.target_item_ids, ["q"]);
  assert.deepEqual(current.calls[0].payload.anchor, anchor);
  assert.equal(current.errors[0], "Synthetic refusal");
  await click("Cancel comment"); assert.equal(current.retained.replies.other, "Keep"); assert.equal(current.retained.anchor, null);
});

test("delete unresolved/resolved anchored/whole page/database/record only after confirmation, preserving other drafts/content", async () => {
  for (const kind of ["page", "database", "record"]) for (const resolved of [false, true]) {
    for (const anchored of [false, true]) {
      await render({ kind, comments: [comment("c1", { resolved, anchor: anchored ? { quote: "Synthetic", start: 0, end: 9 } : null, replies: [{ id: "reply", author: "agent", text: "Synthetic reply" }] }), comment("c2")],
        retained: { replies: { c1: "Remove this draft only", c2: "Keep other draft" } } });
      await click("Delete comment"); let dialog = document.querySelector('[role="dialog"]');
      assert.match(dialog.textContent, /all its replies/); await click("Cancel", dialog); assert.equal(current.calls.length, 0);
      await click("Delete comment"); dialog = document.querySelector('[role="dialog"]');
      await click("Delete comment", dialog);
      assert.deepEqual(current.calls, [{ op: "delete_comment", payload: { id: "c1" } }]);
      assert.deepEqual(current.state.comments.map(c => c.id), ["c2"]);
      assert.equal(current.retained.replies.c1, undefined); assert.equal(current.retained.replies.c2, "Keep other draft");
      assert.notEqual(current.active, "c1"); assert.notEqual(current.hovered, "c1");
      assert.equal(document.querySelector('[aria-label="1 unresolved comments"]').textContent, "1");
      await act(async () => root.render(null));
    }
  }
});

test("delete refusal keeps saved discussion, replies and retained reply; locked blocks confirmation", async () => {
  await render({ fail: true, comments: [comment("c1")], retained: { replies: { c1: "Retry draft" } } });
  await click("Delete comment"); await click("Delete comment", document.querySelector('[role="dialog"]'));
  assert.ok(document.querySelector('[role="dialog"]')); assert.match(document.querySelector('[role="alert"]').textContent, /Synthetic refusal/);
  assert.equal(current.state.comments.length, 1); assert.equal(current.retained.replies.c1, "Retry draft");
  await act(async () => root.render(h(Harness, { locked: true, fail: true, comments: [comment("c1")], retained: current.retained })));
  assert.equal(buttons("Delete comment", document.querySelector('[role="dialog"]'))[0].disabled, true);
});

test("single run-review includes all related choices and inert unavailable legacy refs, none preselected; signature binds metadata", async () => {
  const s = { items: [item(), item("q"), item("r"), { ...item("f"), kind: "folder" }], attachments: [], comments: [comment("c1", { target_item_ids: ["missing"] })] };
  const review = reviewScope(s, "p"); assert.deepEqual(review.targets.map(t => t.id), ["missing", "q", "r"]);
  assert.notEqual(review.signature, reviewScope({ ...s, items: s.items.map(i => i.id === "r" ? { ...i, title: "Changed" } : i) }, "p").signature);
  const submitted = [];
  await act(async () => root.render(h(ScopeReviewDialog, { review, currentTitle: "Synthetic", onSubmit: ids => submitted.push(ids), onClose: () => {} })));
  const checks = [...document.querySelectorAll('input[type="checkbox"]')];
  assert.equal(checks.length, 3); assert.ok(checks.every(c => !c.checked)); assert.equal(checks[0].disabled, true);
  await act(async () => checks[1].click()); await click("Address selected scope"); assert.deepEqual(submitted, [["q"]]);
});

test("picker labels bounded coverage; keyboard chooses exact duplicate-title row with captured selection; unmounted reads do not publish", async () => {
  const rows = [{ id: "durable-a", title: "Same" }, { id: "durable-b", title: "Same" }, { id: "busy", title: "Busy", running: true }];
  const bound = []; const workflow = { listThreads: async () => rows, bindThread: async (...args) => bound.push(args) };
  await act(async () => root.render(h(ThreadPicker, { workflow, itemId: "p", onBound: () => {}, onClose: () => {}, locked: false }))); await tick();
  assert.match(document.body.textContent, /older history has not been searched/i);
  const search = document.querySelector('input[aria-label="Search recent native threads"]');
  await type(search, "Same"); await key(search, { key: "ArrowDown" }); await key(search);
  assert.deepEqual(bound, [["p", "durable-b", rows[1]]]);
  await type(search, "not present"); assert.match(document.body.textContent, /Older history has not been searched/);
  await act(async () => root.render(null));
  let finish;
  const delayed = { listThreads: () => new Promise(resolve => { finish = resolve; }) };
  await act(async () => root.render(h(ThreadPicker, { workflow: delayed, itemId: "p", onBound: () => { throw new Error("late binding"); }, onClose: () => {} })));
  await act(async () => root.render(null));
  await act(async () => finish(rows));
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test("picker rejects stale list publication after workflow replacement, busy row binding and duplicate selection", async () => {
  let finish, release;
  const old = { listThreads: () => new Promise(resolve => { finish = resolve; }) };
  const writes = [];
  const pending = new Promise(resolve => { release = resolve; });
  const fresh = { listThreads: async () => [{ id: "fresh", title: "Fresh" }, { id: "busy", title: "Busy", running: true }],
    bindThread: async (...args) => { writes.push(args); await pending; } };
  const props = { itemId: "p", onBound: () => {}, onClose: () => {} };
  await act(async () => root.render(h(ThreadPicker, { ...props, workflow: old })));
  await act(async () => root.render(h(ThreadPicker, { ...props, workflow: fresh })));
  await act(async () => finish([{ id: "stale", title: "Stale" }]));
  assert.doesNotMatch(document.body.textContent, /Stale/);
  assert.equal([...document.querySelectorAll("button")].find(b => b.textContent.includes("Busy")).disabled, true);
  const choose = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Fresh"));
  await act(async () => { choose.click(); choose.click(); }); assert.equal(writes.length, 1);
  await act(async () => release());
});

test("adapter selection rejects profile/epoch drift before bind and retains native resume+scope identity", async () => {
  await switchProfile("lane-b"); const original = { routes: host.profileRoutes, request: host.requestProfile };
  const calls = []; host.profileRoutes = async () => [{ connectionId: host.activeConnectionId(), profile: "lane-b", targetProfile: "lane-b" }];
  host.requestProfile = async (route, method, params) => {
    calls.push({ method, params });
    if (method === "session.list") return { sessions: [{ stored_session_id: "durable", id: "runtime", title: "Synthetic" }] };
    if (method === "session.resume") return { stored_session_id: "durable", session_id: "runtime", info: { desktop_protocol: "hermes-gateway-v1" }, running: false, pending: [] };
    throw new Error(method);
  };
  const writes = []; const adapter = createWorkflowAdapter({ rest: async (path, opts) => {
    if (path === "/state") return { scope_id: "synthetic", items: [item()], comments: [comment("c1")] };
    writes.push({ path, opts }); return {};
  } });
  try {
    const rows = await adapter.listThreads(); assert.equal(rows.length, 1);
    await adapter.bindThread("p", rows[0].id, rows[0]);
    assert.deepEqual(writes[0].opts.body, { item_id: "p", thread_id: "durable", expected_scope: "synthetic" });
    await advanceEpoch(); await assert.rejects(adapter.bindThread("p", rows[0].id, rows[0]), /changed/);
    assert.equal(writes.length, 1);
    const before = calls.length; await assert.rejects(adapter.addressComments("p", ["q"]), /cannot be approved/);
    assert.equal(calls.length, before, "unagreed review contract refuses before native create/resume");
  } finally { adapter.dispose(); host.profileRoutes = original.routes; host.requestProfile = original.request; }
});

test("confirmed review is issued before native creation and consumed without an intervening bind", async () => {
  await switchProfile('review-confirmed');
  const original = host.requestProfile, events = [];
  host.requestProfile = async (route, method, params) => {
    events.push({native:method}); return original(route, method, params);
  };
  const saved = {scope_id:'review-scope',revision:7,items:[item('p'),item('q')],comments:[comment('c1')]};
  const run = {id:'review-run',status:'completed'};
  const adapter = createWorkflowAdapter({rest:async(path,opts) => {
    events.push({path,body:opts?.body});
    if(path==='/state') return structuredClone(saved);
    if(path==='/workflow/review-scope') return {review_id:'one-use-review',scope_id:saved.scope_id,
      revision:saved.revision,item_id:'p',selected_item_ids:['q']};
    if(path==='/workflow/prepare') return {run,prompt:'Synthetic feedback',submission_id:run.id};
    if(path==='/workflow/consume'||path==='/workflow/status') return {run};
    throw new Error(path);
  }});
  try {
    await adapter.addressComments('p',['q'],{scope_id:saved.scope_id,revision:7});
    const review=events.findIndex(x=>x.path==='/workflow/review-scope');
    const create=events.findIndex(x=>x.native==='session.create');
    const prepare=events.findIndex(x=>x.path==='/workflow/prepare');
    assert.ok(review>=0&&review<create&&create<prepare);
    assert.equal(events.some(x=>x.path==='/workflow/bind'),false);
    assert.equal(events[prepare].body.review_id,'one-use-review');
    assert.deepEqual(events[prepare].body.explicit_item_ids,['q']);
    assert.equal(events.filter(x=>x.path==='/workflow/review-scope').length,1);
    assert.equal(events.some(x=>x.body?.reviewed_item_ids),false);
  } finally {adapter.dispose();host.requestProfile=original;}
});

test("stale or mismatched review ends before native effects; prepare failure never renews consent", async () => {
  await switchProfile('review-stale');
  const original=host.requestProfile;
  let native=0, issued=0, prepares=0, badResponse=false;
  host.requestProfile=async(route,method,params)=>{native++;return original(route,method,params);};
  const saved={scope_id:'review-scope',revision:7,items:[item('p'),item('q')],comments:[comment('c1')]};
  const adapter=createWorkflowAdapter({rest:async(path,opts)=>{
    if(path==='/state')return structuredClone(saved);
    if(path==='/workflow/review-scope') {issued++;return {review_id:'receipt',scope_id:saved.scope_id,
      revision:7,item_id:'p',selected_item_ids:badResponse?[]:['q']};}
    if(path==='/workflow/prepare'){prepares++;throw new Error('Review expired; re-review required.');}
    throw new Error(path);
  }});
  try {
    await assert.rejects(adapter.addressComments('p',['q'],{scope_id:saved.scope_id,revision:6}),/review.*again/i);
    assert.equal(issued,0);assert.equal(native,0);
    badResponse=true;
    await assert.rejects(adapter.addressComments('p',['q'],{scope_id:saved.scope_id,revision:7}),/verify.*review/i);
    assert.equal(issued,1);assert.equal(native,0);
    badResponse=false;
    await assert.rejects(adapter.addressComments('p',['q'],{scope_id:saved.scope_id,revision:7}),/expired/);
    assert.equal(issued,2);assert.equal(prepares,1);assert.equal(native,1);
  } finally {adapter.dispose();host.requestProfile=original;}
});

afterEach(async () => { await act(async () => root.render(null)); current = null; });
after(async () => {
  await act(async () => root.unmount()); dom.window.close();
  console.log("Lane B post-cleanup resources:", process.getActiveResourcesInfo());
});
