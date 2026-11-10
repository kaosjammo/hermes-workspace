import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="app"></div>', { url: 'https://issue-2.test', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'InputEvent']) globalThis[key] = dom.window[key];
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.getSelection = () => dom.window.getSelection();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { Workspace, createElement: h, createRoot, act } = await import('../../.local/frontend/ui-runtime.mjs');
const root = createRoot(document.querySelector('#app'));
const tick = (ms = 0) => act(() => new Promise(resolve => setTimeout(resolve, ms)));
const button = name => [...document.querySelectorAll('button')].find(node => (node.getAttribute('aria-label') ?? node.textContent) === name);
const click = async node => { assert.ok(node, 'requested control exists'); await act(async () => node.click()); await tick(); };
const disclosure = title => [...document.querySelectorAll('.ws-nav details')].find(node => node.querySelector('summary button')?.textContent === title);
const folder = (id, parent_id = null) => ({ id, parent_id, kind: 'folder', title: id, deleted_at: null });
const page = (id, parent_id) => ({ ...folder(id, parent_id), kind: 'page', content: '<p>Unchanged synthetic content.</p>', properties: {}, columns: [] });

test('bulk actions include every nested level and preserve open content, selection and reading position through refresh/navigation', async () => {
  const state = { scope_id: 'issue-2', revision: 1, items: [folder('Root'), folder('Nested', 'Root'), folder('Deep', 'Nested'), folder('Other'), page('Reading page', 'Deep'), page('Second page', 'Other')], comments: [], runs: [], attachments: [], versions: [], recents: [], templates: [] };
  const original = structuredClone(state), calls = [];
  let reads = 0;
  const ctx = { onDispose: () => {}, rest: async (path, options) => {
    if (path === '/state') { reads++; return structuredClone(state); }
    assert.equal(path, '/command');
    calls.push(options.body);
    assert.equal(options.body.op, 'open_item', 'tree expansion never writes product data');
    return { result: {}, state: structuredClone(state) };
  } };
  await act(async () => root.render(h(Workspace, { ctx }))); await tick();
  await click(button('Reading page'));
  const work = document.querySelector('.ws-work'), editor = document.querySelector('.ws-editor');
  work.scrollTop = 380;
  for (let i = 0; i < 3; i++) {
    await click(button('Collapse all'));
    assert.ok([...document.querySelectorAll('.ws-nav details')].every(node => !node.open));
    assert.equal(document.querySelector('.ws-editor'), editor);
    assert.equal(work.scrollTop, 380);
    assert.equal(button('Reading page').getAttribute('aria-current'), 'page');
    await click(button('Expand all'));
    assert.ok([...document.querySelectorAll('.ws-nav details')].every(node => node.open));
  }
  await click(disclosure('Nested').querySelector('summary'));
  assert.equal(disclosure('Nested').open, false);
  assert.equal(disclosure('Root').open, true);
  assert.equal(disclosure('Deep').open, true);
  assert.equal(disclosure('Other').open, true);
  // Native toggle notifications are asynchronous; let the controlled state settle.
  await tick(20);
  const readsBefore = reads;
  state.revision++;
  await tick(3100);
  assert.ok(reads > readsBefore, 'actual useQuery polling refreshed the snapshot');
  assert.equal(disclosure('Nested').open, false);
  assert.equal(disclosure('Deep').open, true);
  assert.equal(document.querySelector('.ws-editor'), editor);
  assert.equal(work.scrollTop, 380);
  await click(button('Second page'));
  assert.equal(disclosure('Nested').open, false);
  await click(button('Expand all'));
  await click(button('Reading page'));
  assert.equal(document.querySelector('.ws-editor').innerHTML, editor.innerHTML);
  assert.deepEqual(calls.map(call => call.payload.id), ['Reading page', 'Second page', 'Reading page']);
  assert.deepEqual(state.items, original.items);
  assert.deepEqual(state.comments, original.comments);
  assert.deepEqual(state.versions, original.versions);
  assert.equal(button('Expand all').getAttribute('aria-controls'), button('Collapse all').getAttribute('aria-controls'));
  assert.ok(document.getElementById(button('Expand all').getAttribute('aria-controls')));
  await act(async () => root.render(null));
});

test('new nested folders follow the last bulk action while native toggles remain independent', async () => {
  const state = { scope_id: 'new-folders', revision: 1, items: [folder('Root')], comments: [], runs: [], attachments: [], versions: [], recents: [], templates: [] };
  let reads = 0;
  const ctx = { onDispose: () => {}, rest: async path => { assert.equal(path, '/state'); reads++; return structuredClone(state); } };
  await act(async () => root.render(h(Workspace, { ctx }))); await tick();
  await click(button('Collapse all'));
  state.items.push(folder('Added empty folder', 'Root'));
  state.revision++;
  const before = reads;
  await tick(3100);
  assert.ok(reads > before);
  assert.equal(disclosure('Added empty folder').open, false);
  await click(disclosure('Root').querySelector('summary'));
  assert.equal(disclosure('Root').open, true);
  assert.equal(disclosure('Added empty folder').open, false);
  await click(disclosure('Added empty folder').querySelector('summary'));
  await click(button('Expand all'));
  assert.ok([...document.querySelectorAll('.ws-nav details')].every(node => node.open));
  await act(async () => { button('Collapse all').click(); button('Expand all').click(); button('Collapse all').click(); });
  await tick(20);
  assert.ok([...document.querySelectorAll('.ws-nav details')].every(node => !node.open));
  await act(async () => root.render(null));
});

test('empty and folder-free trees offer no inert bulk controls', async () => {
  for (const items of [[], [page('Root page', null)]]) {
    const ctx = { onDispose: () => {}, rest: async () => ({ scope_id: 'empty', revision: 1, items, comments: [], runs: [], attachments: [], versions: [], recents: [], templates: [] }) };
    await act(async () => root.render(h(Workspace, { ctx }))); await tick();
    assert.equal(button('Expand all'), undefined);
    assert.equal(button('Collapse all'), undefined);
    await act(async () => root.render(null));
  }
});

for (const initialOpen of [true, false]) {
  test(`F001: pending native ${initialOpen ? 'close then Expand all' : 'open then Collapse all'} respects the later bulk intent at every level`, async () => {
    const state = { scope_id: 'pending-toggle', revision: 1, items: [folder('Root'), folder('Nested', 'Root'), folder('Deep', 'Nested'), folder('Other'), page('Reading page', 'Deep')], comments: [], runs: [], attachments: [], versions: [], recents: [], templates: [] };
    const original = structuredClone(state), calls = [];
    const ctx = { onDispose: () => {}, rest: async (path, options) => {
      if (path === '/state') return structuredClone(state);
      calls.push(options.body);
      assert.equal(options.body.op, 'open_item');
      return { result: {}, state: structuredClone(state) };
    } };
    try {
      await act(async () => root.render(h(Workspace, { ctx }))); await tick();
      await click(button('Reading page'));
      const editor = document.querySelector('.ws-editor'), work = document.querySelector('.ws-work');
      const nodes = [...document.querySelectorAll('.ws-nav details')];
      work.scrollTop = 380;
      if (!initialOpen) await click(button('Collapse all'));
      await tick(20);
      const beforeCommands = calls.length;
      let notifications = 0;
      nodes.forEach(node => node.addEventListener('toggle', () => notifications++));
      await act(async () => {
        // No await/timer separates the native defaults from the bulk click.
        // React still holds the previous prop when the DOM already differs.
        for (const node of nodes.slice(0, 3)) {
          node.querySelector('summary').click();
          assert.equal(node.open, !initialOpen, 'native default changes the actual DOM immediately');
        }
        assert.equal(notifications, 0, 'bulk action precedes native toggle delivery');
        button(initialOpen ? 'Expand all' : 'Collapse all').click();
      });
      assert.deepEqual(nodes.map(node => node.open), nodes.map(() => initialOpen), 'bulk intent wins before queued toggle events');
      await tick(25);
      assert.ok(notifications > 0, 'queued native notifications were actually delivered');
      assert.deepEqual(nodes.map(node => node.open), nodes.map(() => initialOpen), 'late notifications cannot undo the bulk intent');
      assert.deepEqual([...document.querySelectorAll('.ws-nav details')], nodes, 'tree nodes were not remounted');
      assert.equal(document.querySelector('.ws-editor'), editor);
      assert.equal(work.scrollTop, 380);
      assert.equal(button('Reading page').getAttribute('aria-current'), 'page');
      assert.equal(calls.length, beforeCommands, 'disclosure actions issue zero transport commands');
      assert.deepEqual(state, original);
    } finally { await act(async () => root.render(null)); }
  });
}

test('F001: mixed same-task manual and bulk orderings preserve the latest action without remounting', async () => {
  const state = { scope_id: 'mixed-toggle', revision: 1, items: [folder('Root'), folder('Nested', 'Root'), folder('Deep', 'Nested'), folder('Other'), page('Reading page', 'Deep')], comments: [], runs: [], attachments: [], versions: [], recents: [], templates: [] };
  const calls = [], original = structuredClone(state);
  const ctx = { onDispose: () => {}, rest: async (path, options) => {
    if (path === '/state') return structuredClone(state);
    calls.push(options.body);
    assert.equal(options.body.op, 'open_item');
    return { result: {}, state: structuredClone(state) };
  } };
  try {
    await act(async () => root.render(h(Workspace, { ctx }))); await tick();
    await click(button('Reading page'));
    const nodes = [...document.querySelectorAll('.ws-nav details')], editor = document.querySelector('.ws-editor');
    const work = document.querySelector('.ws-work'); work.scrollTop = 380;
    const manual = index => nodes[index].querySelector('summary').click();
    const sequences = [
      { setup: 'Expand all', run: () => { manual(0); button('Expand all').click(); manual(1); }, expected: [true, false, true, true] },
      { setup: 'Collapse all', run: () => { manual(0); button('Collapse all').click(); manual(1); }, expected: [false, true, false, false] },
      { setup: 'Expand all', run: () => { manual(2); button('Collapse all').click(); manual(0); button('Expand all').click(); manual(2); }, expected: [true, true, false, true] },
      { setup: 'Collapse all', run: () => { button('Expand all').click(); manual(1); button('Collapse all').click(); manual(3); }, expected: [false, false, false, true] },
    ];
    for (const { setup, run, expected } of sequences) {
      await click(button(setup)); await tick(20);
      await act(async () => run());
      assert.deepEqual(nodes.map(node => node.open), expected, 'last same-task action per folder wins');
      await tick(25);
      assert.deepEqual(nodes.map(node => node.open), expected, 'delayed/coalesced notifications preserve the same result');
      assert.deepEqual([...document.querySelectorAll('.ws-nav details')], nodes);
      assert.equal(document.querySelector('.ws-editor'), editor);
      assert.equal(work.scrollTop, 380);
      assert.equal(button('Reading page').getAttribute('aria-current'), 'page');
      assert.equal(calls.length, 1, 'only the initial explicit document navigation used transport');
      assert.deepEqual(state, original);
    }
  } finally { await act(async () => root.render(null)); }
});
after(async () => { await act(async () => root.unmount()); dom.window.close(); });
