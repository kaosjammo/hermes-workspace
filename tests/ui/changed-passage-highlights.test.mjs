/** Production highlight component; synthetic DOM and saved Store responses. */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { MessageChannel as NativeChannel } from 'node:worker_threads';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { commentAnchor, locateAnchor } from '../../frontend/editor.mjs';

const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
const { JSDOM } = require('jsdom'), { build } = require('esbuild');
const out = mkdtempSync(path.join(tmpdir(), 'hws-changed-highlights-'));
const fixture = JSON.parse(execFileSync(process.env.HWS_PYTHON ?? 'python3', ['-c', `
import json,tempfile
from pathlib import Path
from workspace_plugin.store import Store
with tempfile.TemporaryDirectory() as home:
 s=Store(Path(home));before='<p>Scarlet hue. Unchanged middle. Violet hue.</p>'
 p=s.execute('create_item',{'kind':'page','title':'Synthetic','content':before})
 c=s.execute('add_comment',{'item_id':p['id'],'text':'Change both colours.','anchor':{'quote':'Scarlet hue. Unchanged middle. Violet hue.','prefix':'','suffix':''}})
 run=s.begin_run(p['id'],'synthetic');s.apply_run(run['id'],[{'item_id':p['id'],'patch':{'content':before.replace('Scarlet','Azure').replace('Violet','Ochre')}}],[{'comment_id':c['id'],'text':'Updated both.'}]);s.finish_run(run['id'],'completed')
 print(json.dumps(Store(Path(home)).snapshot()))
`], { cwd: process.cwd(), env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, encoding: 'utf8' }));
await build({ stdin: { contents: `export * from './frontend/comment-highlights.jsx'; export {act,createElement} from 'react'; export {createRoot} from 'react-dom/client';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', outfile: path.join(out, 'runtime.mjs'),
  alias: { '@hermes/plugin-sdk': path.resolve('tests/ui/sdk-fixture.jsx'), react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"' } });
const dom = new JSDOM('<div id="app"></div><div><article class="ws-editor"></article></div>', { pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'MutationObserver', 'Event', 'MouseEvent']) globalThis[key] = dom.window[key];
globalThis.getSelection = () => window.getSelection();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.CSS = { highlights: new Map() };
globalThis.Highlight = class extends Set { constructor(...ranges) { super(ranges); } };
const channels = [], originalChannel = globalThis.MessageChannel;
globalThis.MessageChannel = class extends NativeChannel { constructor() { super(); channels.push(this); } };
const { act, createRoot, createElement: h, CommentHighlights, anchorRanges } = await import(path.join(out, 'runtime.mjs'));
const root = createRoot(document.querySelector('#app')), editor = document.querySelector('article');
editor.innerHTML = fixture.items[0].content;
window.Range.prototype.getClientRects = function () {
  const start = this.startOffset * 8;
  return [{ top: 20, bottom: 40, left: start, right: start + this.toString().length * 8, width: this.toString().length * 8, height: 20 }];
};
const source = fixture.comments[0], anchor = commentAnchor(source), calls = [];
const comment = { ...source, anchor };
const render = active => act(async () => root.render(h(CommentHighlights, {
  editorRef: { current: editor }, comments: [comment], active, onComment: id => calls.push(id),
})));
const painted = suffix => [...CSS.highlights].filter(([key]) => suffix ? key.endsWith(suffix) : /^ws-passage-[^-]+$/.test(key))
  .flatMap(([, ranges]) => [...ranges].map(range => range.toString()));
after(async () => {
  await act(async () => root.unmount()); window.close();
  for (const channel of channels) { channel.port1.close(); channel.port2.close(); }
  globalThis.MessageChannel = originalChannel;
  delete globalThis.CSS; delete globalThis.Highlight;
  require('esbuild').stop(); rmSync(out, { recursive: true, force: true });
});

test('saved multi-part rewrites locate exact replacement ranges without changing the stored anchor', () => {
  assert.equal(source.section_change.highlight_status, 'available');
  assert.equal(locateAnchor(editor.textContent, anchor).status, 'attached');
  assert.deepEqual(anchorRanges(editor, anchor).map(range => range.toString()), ['Azure', 'Ochre']);
  assert.equal(source.anchor.quote, 'Scarlet hue. Unchanged middle. Violet hue.');
  assert.equal(source.resolved, false);
});

test('one comment paints all its replacements; hover, click and active state retain the same discussion', async () => {
  const html = editor.innerHTML;
  await render(source.id);
  assert.deepEqual(painted(), ['Azure', 'Ochre']);
  assert.deepEqual(painted('-active'), ['Azure', 'Ochre']);
  assert.equal(document.querySelectorAll('.ws-passage-marker').length, 1);
  assert.equal(document.querySelector('.ws-passage-marker').textContent, '1');
  const second = anchorRanges(editor, anchor)[1].getClientRects()[0];
  await act(async () => editor.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: second.left + 1, clientY: 25 })));
  assert.deepEqual(painted('-hover'), ['Azure', 'Ochre']);
  await act(async () => editor.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: second.left + 1, clientY: 25 })));
  assert.deepEqual(calls, [source.id]);
  assert.equal(editor.innerHTML, html);
});

test('missing secondary ranges detach without painting a partial or broad stale selection', () => {
  const incomplete = document.createElement('div'); incomplete.textContent = 'Azure hue. Unchanged middle. Removed hue.';
  assert.equal(locateAnchor(incomplete.textContent, anchor).status, 'detached');
  assert.deepEqual(anchorRanges(incomplete, anchor), []);
});
