// Full production Workspace wiring; synthetic DOM/transport, not native acceptance.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="app"></div>', { url: 'https://workspace.test', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'InputEvent']) globalThis[key] = dom.window[key];
globalThis.getSelection = () => window.getSelection();
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Layout is synthetic here; real geometry is verified in the browser fixture.
window.Range.prototype.getClientRects = function () {
  return [{ top: this.startOffset * 30, bottom: this.startOffset * 30 + 20, left: 10, right: 210, width: 200, height: 20 }];
};
const { Workspace, createElement: h, createRoot, act } = await import('../../.local/frontend/ui-runtime.mjs');
const root = createRoot(document.querySelector('#app'));
const tick = () => act(() => new Promise(resolve => setTimeout(resolve, 30)));
const click = async node => { assert.ok(node); await act(async () => node.click()); await tick(); };

test('Workspace keeps full-item numbers aligned between markers and discussions when resolved threads are hidden', async () => {
  const page = { id: 'page', kind: 'page', title: 'Synthetic page', parent_id: null, content: '<p>North route. South route.</p>', properties: {}, columns: [] };
  const comments = [
    { id: 'whole', item_id: page.id, text: 'Whole-page feedback', anchor: null, replies: [], resolved: false },
    { id: 'resolved', item_id: page.id, text: 'Earlier resolved feedback', anchor: { quote: 'North route' }, replies: [], resolved: true },
    { id: 'visible', item_id: page.id, text: 'Independent current feedback', anchor: { quote: 'South route' }, replies: [], resolved: false },
  ];
  const state = { scope_id: 'numbering-workspace', revision: 1, items: [page], comments, attachments: [], versions: [], runs: [], recents: [], templates: [] };
  const before = JSON.stringify(state), commands = [];
  const ctx = { onDispose: () => {}, rest: async (path, options) => {
    if (path === '/state') return structuredClone(state);
    assert.equal(path, '/command');
    assert.equal(options.body.op, 'open_item');
    commands.push(options.body);
    return { result: {}, state: structuredClone(state) };
  } };
  await act(async () => root.render(h(Workspace, { ctx })));
  await tick();
  await click([...document.querySelectorAll('.ws-nav button')].find(node => node.textContent === page.title));
  assert.match(document.querySelector('#ws-bubble-visible').textContent, /Comment 3/);
  assert.deepEqual([...document.querySelectorAll('.ws-passage-marker')].map(node => node.textContent), ['3']);
  assert.equal(document.querySelector('#ws-bubble-resolved'), null);
  await click(document.querySelector('button[aria-label="Comment options"]'));
  await click(document.querySelector('input[aria-label="Show resolved comments"]'));
  assert.deepEqual([...document.querySelectorAll('.ws-passage-marker')].map(node => node.textContent), ['2', '3']);
  assert.match(document.querySelector('#ws-bubble-visible').textContent, /Comment 3/);
  await click(document.querySelector('input[aria-label="Show resolved comments"]'));
  assert.deepEqual([...document.querySelectorAll('.ws-passage-marker')].map(node => node.textContent), ['3']);
  assert.equal(commands.length, 1, 'Presentation and filtering never write discussions or document content');
  assert.equal(JSON.stringify(state), before);
});

after(async () => { await act(async () => root.unmount()); window.close(); });
