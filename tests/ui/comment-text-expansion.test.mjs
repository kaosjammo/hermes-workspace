/** Real comment lifecycle in synthetic DOM; no anchor/highlight ownership. */
import { test, after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MessageChannel as NativeChannel } from 'node:worker_threads';
const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
const buildDir = await mkdtemp(path.join(tmpdir(), 'comment-text-expansion-'));
const esbuild = require('esbuild');
await esbuild.build({
  stdin: { contents: 'export {Comments} from "./frontend/comments.jsx"; export {CommentHighlights} from "./frontend/comment-highlights.jsx"; export {createElement as h,act,useState,useRef} from "react"; export {createRoot} from "react-dom/client"; export {flushSync} from "react-dom";', resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', outfile: path.join(buildDir, 'runtime.mjs'),
  alias: { '@hermes/plugin-sdk': path.resolve('tests/ui/sdk-fixture.jsx'), react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: process.env.COMMENT_CLICK_SOURCE ? [{ name: 'comment-click-predecessor', setup(build) {
    build.onLoad({ filter: /frontend\/comments\.jsx$/ }, async () => ({ contents: await readFile(process.env.COMMENT_CLICK_SOURCE, 'utf8'), loader: 'jsx' }));
  } }] : [],
});
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="app"></div><button id="outside">Outside</button>', { url: 'https://comment-click.test', pretendToBeVisual: true });
for (const key of ['window','document','HTMLElement','Node','Event','MouseEvent','KeyboardEvent']) globalThis[key] = dom.window[key];
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.getSelection = () => window.getSelection();
const channels = [], originalChannel = globalThis.MessageChannel;
globalThis.MessageChannel = class extends NativeChannel { constructor() { super(); channels.push(this); } };
const { Comments, CommentHighlights, h, act, useState, useRef, createRoot, flushSync } = await import(path.join(buildDir, 'runtime.mjs'));
const app = document.getElementById('app'), root = createRoot(app);
// Exercise discrete commits before the document's native outside-click listener.
// The host can flush React while the original native event is still bubbling.
const commit = () => flushSync(() => {});
app.addEventListener('click', commit);
const page = { id: 'p', kind: 'page', title: 'Garden' };
const comments = [
  { id: 'first', item_id: 'p', text: 'First feedback', resolved: false, anchor: null, replies: [] },
  { id: 'detached', item_id: 'p', text: 'update this wording to more elegant speech', resolved: false, anchor: { quote: 'Old missing wording' }, replies: [{ id:'r', author:'agent', text:'Updated passage' }] },
];
let commands = [], active;
function Harness({ initial = null }) {
  const [selected, setSelected] = useState(initial);
  active = selected;
  return h(Comments, { item: page, state: { items: [page], comments }, text: 'New wording', anchor: null, setAnchor: () => {}, activeComment: selected, setActiveComment: setSelected,
    command: async (...args) => commands.push(args), workflow: {}, onError: error => { throw error; }, onRun: () => {}, onRefresh: () => {} });
}
const mount = async initial => { await act(() => root.render(null)); await act(() => root.render(h(Harness, { initial }))); };
const click = async node => { assert.ok(node); await act(() => node.click()); };
const settleFocus = () => act(() => new Promise(resolve => window.requestAnimationFrame(resolve)));
afterEach(settleFocus);
const summary = id => document.getElementById(`ws-bubble-${id}`);
const preview = () => summary('detached').querySelector('.ws-bubble-preview');
const expanded = id => summary(id).getAttribute('aria-expanded') === 'true';
beforeEach(() => { commands = []; document.getSelection().removeAllRanges(); });
after(async () => {
  app.removeEventListener('click', commit);
  await act(() => root.unmount()); window.close();
  for (const channel of channels) { channel.port1.close(); channel.port2.close(); }
  globalThis.MessageChannel = originalChannel; esbuild.stop(); await rm(buildDir, { recursive: true, force: true });
});
test('clicking detached preview text opens the discussion and keeps it open after the preview unmounts', async () => {
  await mount(null);
  const target = preview();
  await click(target);
  assert.equal(target.isConnected, false, 'opening removes collapsed preview');
  assert.equal(expanded('detached'), true);
  assert.equal(active, 'detached');
  assert.equal(document.querySelector('#ws-discussion-detached').closest('[hidden]'), null);
  assert.deepEqual(commands, []);
});
test('clicking preview text switches from another expanded comment without outside-click collapse', async () => {
  await mount('first');
  await click(preview());
  assert.equal(expanded('detached'), true);
  assert.equal(expanded('first'), false);
  assert.equal(active, 'detached');
  assert.deepEqual(commands, []);
});
test('summary toggling, card whitespace and a later outside click retain their behavior', async () => {
  await mount(null);
  await click(summary('detached'));
  assert.equal(expanded('detached'), true);
  await click(summary('detached'));
  assert.equal(expanded('detached'), false);
  await click(summary('detached').closest('.ws-bubble'));
  assert.equal(expanded('detached'), true);
  await settleFocus();
  await click(document.getElementById('outside'));
  assert.equal(expanded('detached'), false);
});


test('a secondary changed span selects its discussion and survives native outside-click handling', async () => {
  const anchors = [{ quote: 'Azure', prefix: '', suffix: ' middle Ochre' }, { quote: 'Ochre', prefix: 'Azure middle ', suffix: '' }];
  const derived = { ...anchors[0], ranges: anchors };
  const rewritten = { ...comments[1], id: 'rewrite', section_change: { highlight_status: 'available', anchor: anchors[0], anchors } };
  const originalRects = window.Range.prototype.getClientRects;
  window.Range.prototype.getClientRects = function () {
    const left = this.toString() === 'Ochre' ? 200 : 20;
    return [{ left, right: left + 40, top: 20, bottom: 40, width: 40, height: 20 }];
  };
  function LinkedHarness() {
    const [selected, setSelected] = useState('first'), [geometry, setGeometry] = useState([]), editor = useRef(null);
    active = selected;
    return h('div', { className: 'ws-layout' },
      h('article', { className: 'ws-editor', ref: editor }, 'Azure middle Ochre'),
      h(CommentHighlights, { editorRef: editor, comments: [{ ...rewritten, anchor: derived }], active: selected, onComment: setSelected, onGeometry: setGeometry }),
      h(Comments, { item: page, state: { items: [page], comments: [comments[0], rewritten] }, text: 'Azure middle Ochre', geometry,
        anchor: null, setAnchor: () => {}, activeComment: selected, setActiveComment: setSelected,
        command: async (...args) => commands.push(args), workflow: {}, onError: error => { throw error; } }));
  }
  try {
    await act(() => root.render(null));
    await act(() => root.render(h(LinkedHarness)));
    await act(() => document.querySelector('.ws-editor').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 205, clientY: 25 })));
    assert.equal(active, 'rewrite');
    assert.equal(expanded('rewrite'), true);
    assert.equal(expanded('first'), false);
    assert.deepEqual(commands, []);
    // Ordinary editor text outside either changed span still closes the card.
    await act(() => document.querySelector('.ws-editor').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 400, clientY: 25 })));
    assert.equal(expanded('rewrite'), false);
  } finally {
    await act(() => root.render(null));
    window.Range.prototype.getClientRects = originalRects;
  }
});
