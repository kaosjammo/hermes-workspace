/** Headless Chromium, production editor/comments, saved synthetic Store data. No server. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('.local/toolchain/package.json'));
const hostRequire = createRequire(path.resolve('.local/host/.build/webapp-workspace/apps/desktop/package.json'));
const { chromium } = hostRequire('@playwright/test');
const { build } = require('esbuild');
const out = path.resolve(process.env.HWS_HIGHLIGHT_OUT ?? '.local/highlight-replacement-fix/browser');
await mkdir(out, { recursive: true });
const fixture = JSON.parse(execFileSync('python3', ['-c', `
import json,tempfile
from pathlib import Path
from workspace_plugin.store import Store
with tempfile.TemporaryDirectory() as home:
 s=Store(Path(home));before='<p>Scarlet hue. Unchanged middle. Violet hue.</p><p>Outside stays untouched.</p>'
 p=s.execute('create_item',{'kind':'page','title':'Replacement passage','content':before})
 c=s.execute('add_comment',{'item_id':p['id'],'text':'Revise both colours.','anchor':{'quote':'Scarlet hue. Unchanged middle. Violet hue.','prefix':'','suffix':'Outside stays untouched.'}})
 r=s.begin_run(p['id'],'synthetic');s.apply_run(r['id'],[{'item_id':p['id'],'patch':{'content':before.replace('Scarlet','Azure').replace('Violet','Ochre')}}],[{'comment_id':c['id'],'text':'Updated both colours.'}]);s.finish_run(r['id'],'completed')
 print(json.dumps(Store(Path(home)).snapshot()))
`], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
const entry = `
import {createElement as h,useState,useRef} from 'react';import{createRoot}from'react-dom/client';
import{RichEditor}from'./frontend/rich-editor.jsx';import{Comments}from'./frontend/comments.jsx';
import{numberComments,anchorRanges}from'./frontend/comment-highlights.jsx';import{commentAnchor}from'./frontend/editor.mjs';import{styles}from'./frontend/styles.mjs';
const state=window.fixture,item=state.items[0],comments=numberComments(state.comments).map(c=>({...c,anchor:commentAnchor(c)}));
window.evidence={errors:[],calls:[]};
function App(){const[active,setActive]=useState(null),[hovered,setHovered]=useState(null),[geometry,setGeometry]=useState([]),[text,setText]=useState(''),[anchor,setAnchor]=useState(null);const focus=useRef(null);
window.test={active:()=>active,ranges:()=>anchorRanges(document.querySelector('.ws-editor'),comments[0].anchor).map(r=>({text:r.toString(),rects:[...r.getClientRects()].map(x=>({x:x.x,y:x.y,width:x.width,height:x.height}))}))};
return h('main',{className:'ws-root',style:{height:'100vh'}},h('style',null,styles),h('div',{className:'ws-work',style:{width:'100%',height:'100%',overflow:'auto'}},h('div',{className:'ws-layout'},h('div',{className:'ws-document'},h('h1',null,item.title),h(RichEditor,{item,locked:false,onSave:async()=>{},onText:setText,onAnchor:setAnchor,onError:e=>evidence.errors.push(e.message),onLink:()=>{},comments,activeComment:active,hoveredComment:hovered,onCommentHover:setHovered,onCommentGeometry:setGeometry,onComment:setActive,registerFocus:f=>{focus.current=f},registerFlush:()=>()=>{}})),h(Comments,{item,state,text,anchor,setAnchor,activeComment:active,setActiveComment:setActive,geometry,hoveredComment:hovered,setHoveredComment:setHovered,onPassage:(id,a)=>{setActive(id);focus.current?.(a)},command:async(...args)=>evidence.calls.push(args),workflow:{},locked:false,onError:e=>evidence.errors.push(e.message),onRun:()=>{},onRefresh:()=>{}}))));}
createRoot(document.querySelector('#app')).render(h(App));`;
const built = await build({ stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, platform: 'browser', format: 'iife', write: false,
  alias: { '@hermes/plugin-sdk': path.resolve('tests/ui/sdk-fixture.jsx'), react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) }, define: { 'process.env.NODE_ENV': '"production"' } });
const browser = await chromium.launch({ headless: true, chromiumSandbox: true,
  executablePath: process.env.HWS_CHROMIUM ?? '/home/mike/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.setContent('<html><head><style>:root{--ui-accent:#3579d0;--ui-bg:#fff;--ui-bg-primary:#fff;--ui-bg-secondary:#f5f5f5;--ui-bg-tertiary:#eee;--ui-bg-quaternary:#e8e8e8;--ui-text-primary:#202020;--ui-text-secondary:#555;--ui-stroke-tertiary:#ccc;--ui-stroke-secondary:#aaa}body{margin:0;font:16px sans-serif;background:var(--ui-bg-primary);color:var(--ui-text-primary)}button{font:inherit}</style></head><body><div id="app"></div></body></html>');
  await page.evaluate(f => { window.fixture = f; }, fixture);
  await page.addScriptTag({ content: built.outputFiles[0].text });
  await page.waitForFunction(() => [...CSS.highlights].some(([name, ranges]) => /^ws-passage-[^-]+$/.test(name) && ranges.size === 2));
  assert.deepEqual(await page.evaluate(() => test.ranges().map(r => r.text)), ['Azure', 'Ochre']);
  assert.equal(await page.getByRole('heading', { name: 'Detached passages', exact: true }).count(), 0);
  const ranges = await page.evaluate(() => test.ranges());
  const second = ranges[1].rects[0];
  await page.mouse.click(second.x + second.width / 2, second.y + second.height / 2);
  const cid = fixture.comments[0].id;
  await page.waitForFunction(id => document.getElementById('ws-bubble-' + id)?.getAttribute('aria-expanded') === 'true', cid);
  assert.equal(await page.evaluate(() => test.active()), cid);
  const painted = await page.evaluate(() => [...CSS.highlights].filter(([key]) => /^ws-passage-[^-]+$/.test(key)).flatMap(([,set]) => [...set].map(r => r.toString())));
  assert.deepEqual(painted, ['Azure', 'Ochre']);
  assert.deepEqual(await page.evaluate(() => evidence.calls), []);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.evaluate(() => {
      for (const [key,value] of Object.entries({'--ui-bg-primary':'#17191c','--ui-bg-secondary':'#202329','--ui-bg-tertiary':'#292d34','--ui-bg-quaternary':'#242831','--ui-text-primary':'#e1e3e6','--ui-text-secondary':'#adb3bd','--ui-stroke-tertiary':'#363c47'})) document.documentElement.style.setProperty(key,value);
    });
    await page.screenshot({ path: path.join(out, theme + '.png'), fullPage: true });
  }
  const receipt = { painted, secondReplacementOpensDiscussion: true, detachedHeading: false, mutations: 0, errors: [...errors, ...await page.evaluate(() => evidence.errors)], scope: 'Real headless Chromium, synthetic Store data and SDK fixture; no installed-native claim.' };
  assert.deepEqual(receipt.errors, []);
  await writeFile(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); require('esbuild').stop(); }
