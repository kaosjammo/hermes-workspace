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
after(() => dom.window.close());
