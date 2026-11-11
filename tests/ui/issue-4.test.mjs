// Component behaviour with the disclosed synthetic SDK seam; browser/native gates are separate.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const rootPath = process.cwd();
const out = process.env.ISSUE4_OUT;
assert.ok(out && process.env.TMPDIR?.startsWith(out), 'Use task-owned ISSUE4_OUT and TMPDIR');
const require = createRequire(rootPath + '/.local/toolchain/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="app"></div>', { url: 'https://workspace.test', pretendToBeVisual: true });
for (const key of ['window','document','HTMLElement','Node','Event','MouseEvent','KeyboardEvent','CompositionEvent']) globalThis[key] = dom.window[key];
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await require('esbuild').build({
  stdin: { contents: 'export { Database } from "./frontend/tables.jsx"; export { createElement as h, act } from "react"; export { createRoot } from "react-dom/client";', resolveDir: rootPath },
  bundle: true, platform: 'node', format: 'esm', outfile: out + '/build/components.mjs',
  alias: { '@hermes/plugin-sdk': path.join(rootPath,'tests/ui/sdk-fixture.jsx'), react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: process.env.ISSUE4_BASELINE ? [{name:'exact-baseline',setup(build){build.onLoad({filter:/frontend\/(tables\.jsx|database-grid-styles\.mjs)$/},({path:file})=>({contents:execFileSync('git',['show','a8c076ea35800a287723d34f14cec4fa17d42178:'+path.relative(rootPath,file)],{encoding:'utf8'}),loader:file.endsWith('.jsx')?'jsx':'js'}));}}] : [],
});
const { Database, h, act, createRoot } = await import(out + '/build/components.mjs');
const root = createRoot(document.querySelector('#app'));
const tick = () => act(() => new Promise(resolve => setTimeout(resolve, 30)));
const button = name => [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent) === name);
const click = async node => { assert.ok(node, 'control exists'); await act(() => node.click()); await tick(); };
const input = async (node, value) => {
  assert.ok(node, 'input exists');
  await act(() => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(node,value); node.dispatchEvent(new Event('input',{bubbles:true})); });
};
const submit = async form => { await act(async () => { form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); }); await tick(); };
const key = async (node, key, extra = {}) => { await act(() => node.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}))); await tick(); };
let serial = 0;
const fixture = async ({ count = 1, locked = false, command } = {}) => {
  const item = {id:'db',kind:'database',columns:[{id:'n',name:'Count',type:'number'},{id:'s',name:'Status',type:'select',options:['Planned','Done']}]};
  const record = {id:'r',kind:'record',database_id:'db',title:'Original',content:'<p>Keep document</p>',properties:{n:7,s:'Planned'}};
  const state = {items:[item,...Array.from({length:count},(_,i)=>({...record,id:'r'+i}))],runs:[],attachments:[]};
  const calls = [], guards = new Map();
  await act(() => root.render(h(Database,{key:++serial,item,state,locked,onOpen:()=>{},confirm:()=>{},
    registerPropertyFlush:(id,fn)=>{guards.set(id,fn);return()=>guards.delete(id);},
    command:async(op,payload)=>{calls.push({op,payload:typeof payload==='function'?payload(state):payload}); return command ? command(op,payload,state) : {id:'new',title:payload.title,properties:payload.properties??{}};}
  })));
  await tick(); return {item,state,calls,guards};
};
const title = () => document.querySelector('input[aria-label="New record title"]');

test('creation actions have visible labels in their existing table positions', async () => {
  await fixture({count:0});
  const add = button('Add property'); assert.ok(add.closest('thead th:last-child'));
  assert.match(add.textContent,/Add property/, 'header action must be readable without a tooltip');
  assert.equal(document.querySelectorAll('.ws-db-add-property').length,1);
  assert.ok(button('New record').closest('tbody tr:last-child'));
  await click(button('New record'));
  const label = document.querySelector('label[for="'+title().id+'"]');
  assert.equal(label?.textContent,'New record');
});

test('record creation retains failure, prevents duplicate pending writes, and uses existing command', async () => {
  let release;
  const f = await fixture({command:()=>new Promise((_resolve,reject)=>{release=()=>reject(Error('Synthetic save unavailable'));})});
  const before = JSON.stringify(f.state);
  await click(button('New record')); await input(title(),'Retain this draft');
  const form = title().form; await submit(form); await submit(form);
  assert.equal(f.calls.length,1); assert.equal(title().disabled,true);
  assert.deepEqual(f.calls[0],{op:'create_item',payload:{kind:'record',database_id:'db',title:'Retain this draft'}});
  await act(()=>release()); await tick();
  assert.equal(title().value,'Retain this draft'); assert.match(document.querySelector('[role=alert]').textContent,/Synthetic save unavailable/);
  assert.equal(title().getAttribute('aria-describedby'),document.querySelector('.ws-db-record-draft [role=alert]').id);
  await assert.rejects(f.guards.get('creation:record:db')(),/Finish or cancel/);
  assert.equal(JSON.stringify(f.state),before);
});

test('record composition and Escape preserve IME text; explicit cancel returns focus', async () => {
  const f=await fixture(); await click(button('New record')); await input(title(),'入力');
  await act(()=>title().dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true})));
  await key(title(),'Escape',{isComposing:true}); await submit(title().form);
  assert.equal(title().value,'入力'); assert.equal(f.calls.length,0);
  await act(()=>title().dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
  await key(title(),'Escape'); assert.equal(title(),null); assert.equal(document.activeElement,button('New record'));
});

test('empty, normal, filtered and long scrollable tables retain one inline creation path', async () => {
  for (const count of [0,1,65]) {
    const f=await fixture({count});
    await input(document.querySelector('input[aria-label="Filter records"]'),'not visible');
    assert.match(document.body.textContent,/No records match/);
    assert.equal(document.querySelectorAll('.ws-db-new-record').length,1);
    await click(button('New record')); await input(title(),'Created elsewhere'); await submit(title().form);
    assert.equal(f.calls.length,1); assert.match(document.querySelector('.ws-db-record-draft [role=status]').textContent,/hidden by the current filter/);
    assert.equal(title().value,''); await click(button('Cancel new record'));
  }
});

test('board creation writes the exact group value including no-value group', async () => {
  for (const name of ['Planned','Unassigned']) {
    const f=await fixture();
    const view=document.querySelector('select[aria-label="View"]');
    await act(()=>{view.value='choice:1';view.dispatchEvent(new Event('change',{bubbles:true}));}); await tick();
    await click(button('New record in '+name)); await input(title(),'Board draft'); await submit(title().form);
    assert.deepEqual(f.calls[0].payload.properties,{s:name==='Unassigned'?null:name});
    assert.equal(document.querySelectorAll('.ws-db-record-draft').length,1);
  }
});

test('property save retains draft and validation, gates duplicates, appends to current schema', async () => {
  let release;
  const f=await fixture({command:()=>new Promise((_resolve,reject)=>{release=()=>reject(Error('Synthetic property unavailable'));})});
  const before=JSON.stringify(f.state);
  await click(button('Add property')); const name=document.querySelector('input[aria-label="Property name"]');
  await input(name,'New field'); const form=name.form;
  await submit(form); await submit(form); assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].op,'set_columns'); assert.deepEqual(f.calls[0].payload.columns.slice(0,-1),f.item.columns);
  await act(()=>release()); await tick(); assert.equal(name.value,'New field');
  assert.match(form.textContent,/Synthetic property unavailable/); assert.equal(JSON.stringify(f.state),before);
  await assert.rejects(f.guards.get('creation:property:db')(),/Finish or cancel/);
  await click([...form.querySelectorAll('button')].find(b=>b.textContent==='Cancel'));
  await click(button('Add property')); assert.equal(document.querySelector('input[aria-label="Property name"]').value,'');
});

test('property IME, required fields, and locks never submit', async () => {
  const f=await fixture(); await click(button('Add property'));
  let name=document.querySelector('input[aria-label="Property name"]'); await submit(name.form);
  assert.equal(f.calls.length,0); assert.match(document.body.textContent,/Enter a property name/);
  await input(name,'入力'); await act(()=>name.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true})));
  await submit(name.form); assert.equal(f.calls.length,0);
  await fixture({locked:true}); assert.equal(button('Add property').disabled,true); assert.equal(button('New record').disabled,true);
});
test('top New menu creates records without opening the bottom draft', async () => {
  const f = await fixture({ count: 65 });
  assert.ok(button('New').closest('.ws-db-create-toolbar'));
  await click(button('New')); await click(button('New record'));
  assert.equal(document.querySelectorAll('input[aria-label="New record title"]').length, 1);
  assert.ok(title().closest('.ws-db-create-toolbar'));
  await input(title(), 'Top record'); await submit(title().form);
  assert.deepEqual(f.calls[0], { op: 'create_item', payload: { kind: 'record', database_id: 'db', title: 'Top record' } });
  await click(button('Cancel new record')); assert.equal(title(), null);
  assert.equal(document.activeElement, button('New'));
});

test('top property and inline property drafts have independent navigation guards', async () => {
  const f = await fixture();
  await click(button('New')); await click(button('New property'));
  const name = document.querySelector('input[aria-label="Property name"]');
  await input(name, 'Top property');
  await assert.rejects(f.guards.get('creation:property:db:toolbar')(), /Finish or cancel/);
  await f.guards.get('creation:property:db')();
  await submit(name.form);
  assert.equal(f.calls[0].op, 'set_columns');
  assert.equal(f.calls[0].payload.columns.at(-1).name, 'Top property');
  await f.guards.get('creation:property:db:toolbar')();
});

test('top record retries retain their title and prevent duplicate pending writes', async () => {
  let release;
  const f = await fixture({ command: () => new Promise((_resolve, reject) => { release = () => reject(Error('Synthetic top save failure')); }) });
  await click(button('New')); await click(button('New record')); await input(title(), 'Keep top draft');
  await submit(title().form); await submit(title().form);
  assert.equal(f.calls.length, 1); assert.equal(title().disabled, true);
  await act(() => release()); await tick();
  assert.equal(title().value, 'Keep top draft');
  assert.match(title().form.textContent, /Synthetic top save failure/);
  await assert.rejects(f.guards.get('creation:record:db')(), /Finish or cancel/);
});

test('top New works in board view and respects database and schema locks', async () => {
  const f = await fixture();
  const view = document.querySelector('select[aria-label="View"]');
  await act(() => { view.value = 'choice:1'; view.dispatchEvent(new Event('change', { bubbles: true })); }); await tick();
  await click(button('New')); await click(button('New record')); await input(title(), 'Top board record'); await submit(title().form);
  assert.equal(f.calls[0].payload.title, 'Top board record');
  await click(button('Cancel new record'));
  await fixture({ locked: true }); assert.equal(button('New').disabled, true);
});
after(async()=>{await act(()=>root.unmount()); dom.window.close(); require('esbuild').stop();});
