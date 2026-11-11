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
  const state = { scope_id: 'numbering-workspace', revision: 1, items: [page], comments, attachments: [], versions: [], runs: [], recents: ['p'], templates: [] };
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
  assert.equal(document.querySelector('button[aria-label="Comment options"]'), null);
  const header = document.querySelector('header[aria-label="Page controls"]');
  assert.ok(header.closest(".ws-work"));
  assert.ok(header.querySelector('button[aria-label="Page actions"]'));
  assert.ok(header.querySelector(".ws-format-toggle"));
  assert.equal(header.querySelector('button[aria-label="Linked Hermes thread"]'), null);
  assert.ok([...header.querySelectorAll("button")].find(node => node.textContent === "Page thread"));
  await click(document.querySelector('button[aria-label^="Resolved comments ("]'));
  assert.deepEqual([...document.querySelectorAll('.ws-passage-marker')].map(node => node.textContent), ['2', '3']);
  assert.match(document.querySelector('#ws-bubble-visible').textContent, /Comment 3/);
  await click(document.querySelector('button[aria-label^="Resolved comments ("]'));
  assert.deepEqual([...document.querySelectorAll('.ws-passage-marker')].map(node => node.textContent), ['3']);
  assert.equal(commands.length, 1, 'Presentation and filtering never write discussions or document content');
  assert.equal(JSON.stringify(state), before);
});


test('one page-menu comment action remains available with highlighted, submitted and resolved feedback', async () => {
  for (const kind of ['page', 'record', 'database']) {
    await act(() => root.render(null));
    const item = { id: 'p', kind, title: `Commented ${kind}`, parent_id: null, content: '<p>North route.</p>', properties: {}, columns: [] };
    const state = { scope_id: `header-${kind}`, revision: 1, items: [item],
      comments: [{ id: 'highlight', item_id: 'p', text: 'Passage feedback', anchor: { quote: 'North route.' }, resolved: false, replies: [] }],
      attachments: [], versions: [], runs: [], recents: ['p'], templates: [] };
    const commands = [];
    const ctx = { onDispose: () => {}, rest: async (path, options) => {
      if (path === '/state') return structuredClone(state);
      assert.equal(path, '/command');
      const { op, payload } = options.body;
      commands.push({ op, payload });
      if (op === 'add_comment') state.comments.push({ ...payload, id: 'whole', anchor: payload.anchor ?? null, resolved: false, replies: [] });
      if (op === 'resolve_comment') state.comments.find(c => c.id === payload.id).resolved = payload.resolved;
      state.revision++;
      return { result: {}, state: structuredClone(state) };
    } };
    await act(() => root.render(h(Workspace, { ctx })));
    await tick();
    await click([...document.querySelectorAll('.ws-nav button')].find(node => node.getAttribute('aria-label') === item.title || node.textContent === item.title));
    const name = kind === 'database' ? 'Add database comment' : 'Add whole-page comment';
    const launcher = () => {
      const matches = [...document.querySelectorAll("button")].filter(button => button.textContent === name);
      assert.equal(matches.length, 1, 'exactly one launcher regardless of existing feedback');
      assert.ok(matches[0].closest('header[aria-label="Page controls"] .ws-page-actions'));
      assert.equal(matches[0].disabled, false);
      assert.equal([...document.querySelectorAll('button')].some(b => ['Use whole page', 'Comment on whole page', 'Comment on database'].includes(b.textContent)), false);
      return matches[0];
    };
    const button = launcher();
    assert.ok(button.closest('.ws-page-actions').querySelector('button[aria-label="Page actions"]'));
    await click(button);
    const input = document.querySelector('textarea[aria-label="New comment"]');
    assert.equal(document.activeElement, input);
    await act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'Feedback for this entire item');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click([...document.querySelectorAll('button')].find(b => b.textContent === 'Add comment'));
    assert.equal(launcher(), button, 'the same menu action survives submission');
    assert.equal(state.comments.at(-1).anchor, null);
    assert.deepEqual(commands.filter(c => c.op === 'add_comment'), [{ op: 'add_comment', payload: { item_id: 'p', text: 'Feedback for this entire item', target_item_ids: [], expected_revision: 2 } }]);
    assert.equal(item.content, '<p>North route.</p>');
    await click([...document.querySelectorAll('button')].find(b => b.textContent === 'Cancel comment'));
    assert.equal(launcher(), button);
    // Refresh to the all-resolved state through the normal client query.
    for (const c of state.comments) c.resolved = true;
    state.revision++;
    await click([...document.querySelectorAll('button')].find(b => b.textContent === 'Reload state'));
    assert.equal(launcher(), button, 'resolved discussions do not hide the menu action');
  }
});

after(async () => { await act(async () => root.unmount()); window.close(); });
