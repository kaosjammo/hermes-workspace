/** Pinned synthetic SDK composition; no browser/native/provider acceptance. */
import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
const out = process.env.HWS_QUALIFICATION_HOME;
assert.ok(out && process.env.HOME?.startsWith(out) && process.env.HERMES_HOME?.startsWith(out) && process.env.TMPDIR?.startsWith(out), 'Private synthetic homes and TMPDIR required');
await mkdir(path.join(out, 'build'), { recursive: true });
await require('esbuild').build({
  stdin: { contents: `export * as direct from './tests/ui/sdk-fixture.jsx';
    export * as owned from './frontend/owned-popups.jsx';
    export {Choice} from './frontend/ui.jsx';
    export {Database} from './frontend/tables.jsx';
    export {createElement as h, useState, act} from 'react';
    export {createRoot} from 'react-dom/client';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', outfile: path.join(out, 'build/select-composition.mjs'),
  alias: { '@hermes/plugin-sdk': path.resolve('tests/ui/sdk-fixture.jsx'), react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"' },
});
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<span id="sort-label">Sort</span><span id="sort-help">Choose a property</span><div id="app"></div>', { url: 'https://workspace.synthetic.test', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'MouseEvent']) globalThis[key] = dom.window[key];
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { direct, owned, Choice, Database, h, useState, act, createRoot } = await import(path.join(out, 'build/select-composition.mjs'));
const root = createRoot(document.getElementById('app'));
afterEach(async () => { await act(() => root.render(null)); });
after(async () => { await act(() => root.unmount()); dom.window.close(); require('esbuild').stop(); });
const attrs = { 'aria-describedby': 'sort-help', 'aria-invalid': 'true', 'aria-required': 'true' };
const selectOption = async (label, text) => {
  // Keep the exact existing rendered.test.mjs label selector and option oracle.
  const node = document.querySelector(`select[aria-label="${label}"]`);
  assert.ok(node, `Select exists: ${label}`);
  const option = [...node.options].find(option => option.textContent.trim() === text);
  assert.ok(option, `Option exists: ${label}: ${text}`);
  await act(() => { node.value = option.value; node.dispatchEvent(new Event('change', { bubbles: true })); });
  return node;
};
function assertAttributes(node, expected) {
  assert.ok(node);
  for (const [key, value] of Object.entries(expected)) assert.equal(node.getAttribute(key), value, key);
}
function SelectHarness({ kit, triggerProps, disabled = false, changes, distractor = {} }) {
  const [value, setValue] = useState('title');
  return h(kit.Select, { value, disabled, onValueChange: next => { changes.push(next); setValue(next); } },
    h(kit.SelectTrigger, triggerProps, h(direct.SelectValue)),
    h(kit.SelectContent, distractor,
      h(direct.SelectItem, { value: 'title' }, 'Title'),
      h(direct.SelectItem, { value: 'n' }, 'Count')));
}
for (const [name, kit] of [['direct SDK', direct], ['owned forwardRef', owned]]) {
  test(`${name} trigger keeps its accessible label, aria props, option selection and disabled state`, async () => {
    const changes = [], triggerProps = { 'aria-label': 'Sort', ...attrs };
    const render = disabled => act(() => root.render(h(SelectHarness, { kit, triggerProps, disabled, changes })));
    await render(false);
    let node = document.querySelector('select[aria-label="Sort"]');
    assert.ok(node, 'Select exists: Sort');
    assertAttributes(node, triggerProps);
    assert.equal(node.disabled, false); assert.equal(node.value, 'title');
    node = await selectOption('Sort', 'Count');
    assert.deepEqual(changes, ['n']); assert.equal(node.value, 'n');
    await render(true);
    assert.equal(document.querySelector('select[aria-label="Sort"]'), node);
    assert.equal(node.disabled, true); assert.equal(node.matches(':disabled'), true); assert.equal(node.value, 'n');
    assertAttributes(node, triggerProps);
  });
  test(`${name} trigger forwards aria-labelledby without requiring aria-label`, async () => {
    await act(() => root.render(h(SelectHarness, { kit, triggerProps: { 'aria-labelledby': 'sort-label', ...attrs }, changes: [] })));
    const node = document.querySelector('select');
    assertAttributes(node, { 'aria-labelledby': 'sort-label', ...attrs });
    assert.equal(document.getElementById(node.getAttribute('aria-labelledby')).textContent, 'Sort');
    assert.equal(node.getAttribute('aria-label'), null);
  });
}
test('production Choice renders the Sort label and trigger aria props, maps Count and respects disabled state', async () => {
  const changes = [];
  function Harness({ disabled }) {
    const [value, setValue] = useState('title');
    return h(Choice, { label: 'Sort', value, options: [['title', 'Title'], ['n', 'Count']], disabled,
      triggerProps: attrs, onChange: next => { changes.push(next); setValue(next); } });
  }
  await act(() => root.render(h(Harness, { disabled: false })));
  assert.equal(document.querySelector('.ws-label').textContent, 'Sort');
  const node = await selectOption('Sort', 'Count');
  assertAttributes(node, { 'aria-label': 'Sort', ...attrs });
  assert.deepEqual(changes, ['n']); assert.equal(node.selectedOptions[0].textContent, 'Count');
  await act(() => root.render(h(Harness, { disabled: true })));
  assert.equal(document.querySelector('select[aria-label="Sort"]'), node);
  assert.equal(node.disabled, true); assert.equal(node.matches(':disabled'), true);
});
test('production Database retains exact Sort/Count selection and typed table/board move behavior', async () => {
  const database = { id: 'db', kind: 'database', title: 'Tasks', columns: [
    { id: 'status', name: 'Status', type: 'select', options: ['Todo', 'Done'] },
    { id: 'n', name: 'Count', type: 'number' }, { id: 'f', name: 'Double', type: 'formula', formula: 'n*2' }] };
  const records = [
    { id: 'r1', kind: 'record', database_id: 'db', title: 'First', properties: { status: 'Todo', n: 10, f: 20 } },
    { id: 'r2', kind: 'record', database_id: 'db', title: 'Second', properties: { status: 'Done', n: 2, f: 4 } }];
  const state = { items: [database, ...records] }, commands = [];
  await act(() => root.render(h(Database, { item: database, state, locked: false, onOpen: () => {}, confirm: () => {},
    onError: error => { throw error; }, command: async (op, payload) => {
      const p = typeof payload === 'function' ? payload(state) : payload;
      commands.push({ op, payload: p });
      if (op === 'update_item') Object.assign(records.find(row => row.id === p.id).properties, p.patch.properties);
    } })));
  const sort = [...document.querySelectorAll('button')].find(node => (node.getAttribute('aria-label') ?? node.textContent) === 'Sort');
  assert.ok(sort); await act(() => sort.click());
  await selectOption('Sort', 'Count');
  assert.equal(document.querySelector('tbody tr th button').textContent, 'Second');
  await selectOption('View', 'Board'); await selectOption('Move First', 'Done');
  assert.equal(records[0].properties.status, 'Done');
  assert.equal(commands.at(-1).payload.patch.properties.f, undefined);
  assert.equal(commands.at(-1).payload.patch.properties.n, 10);
});
test('non-trigger content aria props never overwrite the trigger accessibility', async () => {
  for (const kit of [direct, owned]) {
    await act(() => root.render(h(SelectHarness, { kit, changes: [], triggerProps: { 'aria-label': 'Sort', ...attrs }, distractor: { 'aria-describedby': 'unrelated-content' } })));
    assertAttributes(document.querySelector('select'), { 'aria-label': 'Sort', ...attrs });
  }
});
