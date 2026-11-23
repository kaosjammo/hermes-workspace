import {frontendRuntime} from './runtime-path.mjs';
// Full production Workspace, synthetic DOM/SDK/transport. Browser is separate.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
import { WorkspaceClient } from '../../frontend/client.mjs';
import { navigationOrderPayload } from '../../frontend/navigation-order.mjs';
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="app"></div>', { url: 'https://issue3.test', pretendToBeVisual: true });
for (const k of ['window','document','HTMLElement','Node','Event','MouseEvent','KeyboardEvent','InputEvent']) globalThis[k] = dom.window[k];
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.getSelection = () => dom.window.getSelection();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { Workspace, createElement: h, createRoot, act } = await import(frontendRuntime('ui-runtime.mjs'));
const root = createRoot(document.querySelector('#app'));
const tick = (ms=0) => act(() => new Promise(r=>setTimeout(r,ms)));
const b = name => [...document.querySelectorAll('.ws-folder-navigation button')].find(n=>(n.getAttribute('aria-label')??n.textContent)===name);
const click = async node => {assert.ok(node,'requested control exists');await act(()=>node.click());await tick();};
const key = async (node,key) => {await act(()=>node.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})));await tick();};
const item = (id,kind='page',parent_id=null) => ({id,title:id,kind,parent_id,database_id:null,deleted_at:null,content:'<p>Keep original content.</p>',properties:{},columns:[]});
let serial=0;
async function fixture(handler) {
  const state={scope_id:'issue3-'+ ++serial,revision:1,items:[item('Root','folder'),item('Nested','folder','Root'),item('Deep page','page','Nested'),item('Deep db','database','Nested'),item('Root page'),item('Root db','database')],comments:[],attachments:[],runs:[],versions:[],recents:[],templates:[]};
  const calls=[];let reads=0;
  const ctx={onDispose:()=>{},rest:async(path,options)=>{
    if(path==='/state'){reads++;return structuredClone(state);}
    const body=options.body;calls.push(body);
    if(body.op==='reorder_item'){
      if(handler)await handler(body,state);
      const p=body.payload;const moved=state.items.find(i=>i.id===p.id);const group=state.items.filter(i=>i.kind!=='record'&&i.parent_id===moved.parent_id);
      const order=group.filter(i=>i.id!==moved.id);const at=order.findIndex(i=>i.id===p.target_id)+(p.position==='after'?1:0);order.splice(at,0,moved);
      let n=0;state.items=state.items.map(i=>group.includes(i)?order[n++]:i);state.revision++;
    }
    return {result:{},state:structuredClone(state)};
  }};
  await act(()=>root.render(h(Workspace,{key:serial,ctx})));await tick();
  return {state,calls,reads:()=>reads};
}
const row = id => [...document.querySelectorAll('[data-ws-order-row]')].find(n=>n.dataset.wsOrderRow===id);
const roots = () => [...document.querySelector('.ws-folder-navigation ul').children].map(n=>n.dataset.wsItemId);
const treeHTML = () => document.querySelector('.ws-folder-navigation').innerHTML;
function dragEvent(node,type,transfer,y=0){const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{dataTransfer:{value:transfer},clientY:{value:y}});node.dispatchEvent(e);return e;}
function transfer(){const data=new Map();return {effectAllowed:'',dropEffect:'',setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)??'',types:[]};}
async function drag(id,target,position='after',foreign=false){const data=transfer();await act(()=>dragEvent(b('Drag '+id),'dragstart',data));const y=position==='after'?1:-1;await act(()=>dragEvent(row(target),'dragover',data,y));if(foreign)data.setData('application/x-hermes-workspace-order','foreign');await act(()=>dragEvent(row(target),'drop',data,y));await tick();}

test('visible keyboard ordering saves mixed root and deep siblings without navigation or remount',async()=>{
  const f=await fixture();await click(b('Deep page'));
  const editor=document.querySelector('.ws-editor'),work=document.querySelector('.ws-work'),details=[...document.querySelectorAll('.ws-nav details')];work.scrollTop=380;
  await click(b('Reorder'));assert.match(document.querySelector('.ws-order-help').textContent,/Move up.*Move down/);
  const down=b('Move Root down');down.focus();await key(down,'Enter'); // jsdom has no keyboard click default
  await click(down);assert.deepEqual(roots(),['Root page','Root','Root db']);
  assert.ok(document.activeElement===down,'focus remains on same control');
  b('Move Deep db up').focus();await click(b('Move Deep db up'));
  assert.ok(document.activeElement===b('Drag Deep db'),'boundary move focuses the same row handle instead of a disabled arrow');
  assert.equal(f.calls.filter(c=>c.op==='reorder_item').length,2);
  assert.ok(document.querySelector('.ws-editor')===editor);assert.equal(work.scrollTop,380);
  assert.ok([...document.querySelectorAll('.ws-nav details')].every((n,i)=>n===details[i]));
  assert.equal(b('Deep page').getAttribute('aria-current'),'page');
  assert.equal(f.calls.filter(c=>c.op==='open_item').length,1);
});

test('drag targets before/after, rejects reparent and foreign payloads, and Escape cancels',async()=>{
  const f=await fixture();await click(b('Reorder'));
  const startData=transfer(),beforeStart=treeHTML();
  await act(()=>dragEvent(b('Drag Root page'),'dragstart',startData));await tick();
  assert.equal(treeHTML(),beforeStart,'native drag capture starts without a render/layout mutation');
  await act(()=>dragEvent(b('Drag Root page'),'dragend',startData));await tick();
  await drag('Root db','Root','before');assert.deepEqual(roots(),['Root db','Root','Root page']);
  const before=f.calls.length;await drag('Root page','Deep page');await drag('Root page','Root','after',true);
  const data=transfer();await act(()=>dragEvent(b('Drag Root page'),'dragstart',data));await key(b('Drag Root page'),'Escape');
  await act(()=>dragEvent(row('Root'),'drop',data,1));await tick();assert.equal(f.calls.length,before);
  assert.match(document.querySelector('.ws-order-status').textContent,/cancel/i);
});

test('one global pending guard deduplicates rows; failure retains saved order and permits retry',async()=>{
  let reject;let first=true;
  const f=await fixture(()=>first?new Promise((_r,j)=>{reject=j;}):undefined);await click(b('Reorder'));
  const before=roots(),up=b('Move Root db up'),down=b('Move Root down');
  await act(()=>{up.click();down.click();up.click();});await tick();assert.equal(f.calls.length,1);
  assert.equal(b('Move Root down').disabled,true);
  await act(()=>reject(Error('Synthetic save unavailable')));await tick();assert.deepEqual(roots(),before);
  assert.match(document.querySelector('.ws-order-status').textContent,/Synthetic save unavailable/);
  assert.equal(document.querySelector('.ws-order-status').getAttribute('role'),'alert');
  first=false;await click(b('Move Root db up'));assert.equal(f.calls.length,2);assert.deepEqual(roots(),['Root','Root db','Root page']);
});

test('F001 remains fixed after reorder, polling and new folders; no stale dataset drag',async()=>{
  const f=await fixture();await click(b('Reorder'));await click(b('Move Root db up'));
  const nodes=[...document.querySelectorAll('.ws-nav details')];
  for(const open of [true,false]){
    await click(b(open?'Expand all':'Collapse all'));
    await act(()=>{nodes.forEach(n=>n.querySelector('summary').click());b(open?'Expand all':'Collapse all').click();});await tick(25);
    assert.deepEqual(nodes.map(n=>n.open),nodes.map(()=>open));
  }
  const data=transfer();await act(()=>dragEvent(b('Drag Root page'),'dragstart',data));
  f.state.items.push(item('New folder','folder','Root'));f.state.revision++;const before=f.reads();await tick(3100);assert.ok(f.reads()>before);
  assert.equal([...document.querySelectorAll('.ws-nav details')].at(-1).open,false);
  assert.ok(nodes.every(n=>n.isConnected));
  f.state.scope_id='replacement';f.state.revision++;await tick(3100);
  const commands=f.calls.length;await act(()=>dragEvent(row('Root'),'drop',data,1));await tick();assert.equal(f.calls.length,commands);
});

test('queued reorder cancels a changed sibling intent and never crosses owner/scope fences',async()=>{
  let owner=['local','profile-a',1],release;
  const state={scope_id:'queue-scope',revision:1,items:[item('A'),item('B')]};
  const calls=[];
  const client=new WorkspaceClient({rest:async(_path,{body})=>{
    calls.push(body);if(body.op==='update_item')await new Promise(r=>release=r);
    return {result:{},state:{...state,revision:state.revision+1}};
  }},()=>owner);
  client.accept(state);
  const request={scope:state.scope_id,parent:null,siblings:['A','B'],id:'B',target_id:'A',position:'before'};
  const first=client.command('update_item',{id:'A',patch:{title:'A'}});await tick();
  const reorder=client.command('reorder_item',current=>navigationOrderPayload(current,request));
  // A preceding queued mutation has changed the navigation order.
  state.items.reverse();release();await first;
  await assert.rejects(reorder,/folder order changed/);assert.equal(calls.length,1);
  for(const change of [()=>owner=['local','profile-b',1],()=>owner=['remote','profile-a',1],()=>owner=['local','profile-a',2]]){
    owner=['local','profile-a',1];client.accept({...state,revision:4});
    const queued=client.command('reorder_item',{id:'A',target_id:'B',position:'after'});change();
    await assert.rejects(queued,/source changed/);assert.equal(calls.length,1);
  }
  owner=['local','profile-a',1];client.accept({...state,revision:5});
  const queued=client.command('reorder_item',{id:'A',target_id:'B',position:'after'});
  client.accept({...state,scope_id:'replaced',revision:0});
  await assert.rejects(queued,/source changed/);assert.equal(calls.length,1);
});
after(async()=>{await act(()=>root.unmount());dom.window.close();});
