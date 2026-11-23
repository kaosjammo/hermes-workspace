/** Mounted production Workspace/Document + production adapter; synthetic SDK/REST.
 * This proves component wiring, not actual SQLite/HTTP/native lifecycle delivery.
 */
import {test,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(new URL('../../.local/toolchain/package.json',import.meta.url));
const out=process.env.HWS_QUALIFICATION_HOME;
const privateRoot=process.env.HWS_PRIVATE_RUNTIME_ROOT ?? out;
const inside=value=>typeof value==='string' && !path.relative(privateRoot,value).startsWith('..') && !path.isAbsolute(path.relative(privateRoot,value));
assert.ok(out && privateRoot && inside(out) && ['HOME','HERMES_HOME','TMPDIR','XDG_CACHE_HOME'].every(k=>inside(process.env[k])));
await mkdir(path.join(out,'ui-build'),{recursive:true});
await require('esbuild').build({stdin:{contents:'export {Workspace} from "./frontend/workspace.jsx";export {host} from "./tests/ui/sdk-fixture.jsx";export {createElement as h,act} from "react";export {createRoot} from "react-dom/client";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:path.join(out,'ui-build/prready-document.mjs'),alias:{'@hermes/plugin-sdk':path.resolve('tests/ui/sdk-fixture.jsx'),react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))},define:{'process.env.NODE_ENV':'"development"'}});
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="app"></main>',{url:'https://workspace.synthetic.test',pretendToBeVisual:true});
for(const k of ['window','document','HTMLElement','Node','DocumentFragment','MutationObserver','Event','MouseEvent','InputEvent','KeyboardEvent','HTMLInputElement','HTMLTextAreaElement'])globalThis[k]=dom.window[k];
globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
globalThis.getSelection=()=>window.getSelection();globalThis.getComputedStyle=window.getComputedStyle.bind(window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {Workspace,host,h,act,createRoot}=await import(path.join(out,'ui-build/prready-document.mjs'));
const root=createRoot(document.getElementById('app'));
let fixture;
const button=text=>[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent)===text);
const tick=(ms=20)=>act(()=>new Promise(r=>setTimeout(r,ms)));
const click=async node=>{assert.ok(node,'Actual control exists');await act(async()=>{node.click();await Promise.resolve();});await tick();};
async function until(check,label){const end=Date.now()+4200;while(!check()&&Date.now()<end)await tick(25);assert.ok(check(),label);}
function makeFixture({cancelFailure=false}={}) {
 const events=[],storage=new Map(),dispose=[];
 let resolveAck,rejectAck,acknowledged=false;
 const ack=new Promise((resolve,reject)=>{resolveAck=value=>{acknowledged=true;resolve(value)};rejectAck=reject});
 const page=(id,title)=>({id,kind:'page',title,parent_id:null,deleted_at:null,thread_id:'stored-'+id,content:'<p>Before '+id+'.</p>',properties:{},columns:[],created_at:'2026-11-12T00:00:00Z',updated_at:'2026-11-12T00:00:00Z'});
 const state={scope_id:'r01-scope',revision:1,items:[page('page','Current page'),page('other','Other page')],
 comments:[{id:'new',item_id:'page',text:'New request',resolved:false,anchor:null,target_item_ids:[],replies:[]},
 {id:'answered',item_id:'page',text:'Answered unresolved',resolved:false,anchor:null,target_item_ids:[],replies:[{id:'old-reply',author:'agent',text:'Earlier answer'}]},
 {id:'resolved',item_id:'page',text:'Excluded',resolved:true,anchor:null,target_item_ids:[],replies:[]}],runs:[],versions:[],attachments:[],recents:[],templates:[]};
 const clone=()=>structuredClone(state), run=()=>state.runs[0];
 host.requestProfile=async(route,method,params)=>{
  assert.equal(route.connectionId,'local');assert.equal(params.profile,'synthetic-a');events.push({kind:'rpc',method,params});
  if(method==='session.resume')return {session_id:'live-page',stored_session_id:'stored-page',info:{desktop_protocol:'hermes-gateway-v1'},running:false,pending:[]};
  if(method==='profiles.list')return {profiles:[{name:'synthetic-a',display_name:'Synthetic bot'}]};
  if(method==='prompt.submit'){events.push({kind:'held-ack'});return ack;}
  if(method==='prompt.cancel'){if(cancelFailure)throw Error('Synthetic cancellation failed; native outcome unknown');return {status:'terminal'};}
  throw Error('Unexpected RPC '+method);
 };
 const ctx={onDispose:fn=>dispose.push(fn),storage:{get:(k,f)=>storage.has(k)?storage.get(k):f,set:(k,v)=>storage.set(k,v),remove:k=>storage.delete(k)},
 rest:async(url,options)=>{
  if(url==='/state')return clone();
  const body=options.body;assert.equal(body.expected_scope,state.scope_id);events.push({kind:'post',url,body});
  if(url==='/command'){
   const {op,payload}=body;
   if(op==='open_item')state.recents=[payload.id];
   else if(op==='update_item'){
    assert.ok(!state.runs.some(r=>r.status==='running'&&r.allowed_item_ids.includes(payload.id)),'Scoped active document stays locked');
    Object.assign(state.items.find(i=>i.id===payload.id),payload.patch);events.push({kind:'save',id:payload.id});
   }else throw Error('Unexpected command '+op);
   state.revision++;return {result:{},state:clone()};
  }
  if(url==='/workflow/review-scope')return {review_id:'review-r01',scope_id:state.scope_id,item_id:body.item_id,revision:state.revision,selected_item_ids:body.selected_item_ids};
  if(url==='/workflow/prepare'){
   assert.deepEqual(body.explicit_item_ids,[]);
   const r={id:'run-r01',item_id:'page',session_id:'stored-page',status:'running',progress:'Prepared; awaiting native ACK',allowed_item_ids:['page'],comment_ids:['new','answered'],version_ids:['pre-run']};
   state.runs.push(r);state.versions.push({id:'pre-run',item_id:'page',run_id:r.id,content:state.items[0].content,title:'Pre-run',created_at:'2026-11-12T00:00:00Z'});state.revision++;
   return {run:structuredClone(r),prompt:'Full current context: '+state.items[0].content,submission_id:r.id};
  }
  if(url==='/workflow/consume'||url==='/workflow/status')return {run:structuredClone(run()),native_terminal:'UNKNOWN'};
  if(url==='/workflow/stop'||url==='/workflow/recover'){
   run().revoked=true;run().status=url.endsWith('stop')?'cancelled':'error';state.revision++;
   events.push({kind:'local-revocation',action:url});
   return {run:structuredClone(run()),native_terminal:'UNKNOWN',...(acknowledged&&url.endsWith('stop')?{control:{session_id:'stored-page',admission_id:'ack-exact'}}:{})};
  }
  if(url==='/workflow/submitted')return {run:structuredClone(run()),...(run().revoked&&run().status==='cancelled'?{control:{session_id:'stored-page',admission_id:body.admission_id}}:{})};
  throw Error('Unexpected REST '+url);
 }};
 return {state,ctx,events,resolveAck:()=>resolveAck({admission_id:'ack-exact'}),rejectAck:()=>rejectAck(Error('Synthetic unavailable ACK')),dispose};
}
async function open(options={}) {
 fixture=makeFixture(options);await act(async()=>root.render(h(Workspace,{ctx:fixture.ctx})));await tick();
 await click(button('Current page'));
}
async function begin() {
 const editor=document.querySelector('.ws-editor[contenteditable]');assert.ok(editor);
 await act(()=>{editor.innerHTML='<p>Flushed current context.</p>';editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));});
 await click(button('Address comments (2)'));
 if(button('Address current page'))await click(button('Address current page'));
 await until(()=>fixture.events.some(e=>e.kind==='held-ack'),'Submission acknowledgement is actually held');
 await until(()=>button('Stop'),'Normal state query publishes the persisted active run');
 assert.ok(fixture.events.findIndex(e=>e.kind==='save')<fixture.events.findIndex(e=>e.url==='/workflow/prepare'),'Pending content save flushes before admission');
 assert.match(fixture.events.find(e=>e.method==='prompt.submit').params.text,/Flushed current context/);
 assert.deepEqual(fixture.state.runs[0].comment_ids,['new','answered']);
}
afterEach(async()=>{await act(async()=>{fixture?.resolveAck();await Promise.resolve();});await tick();await act(async()=>root.render(null));for(const fn of fixture?.dispose??[])fn();fixture=null;});
after(async()=>{await act(()=>root.unmount());dom.window.close();require('esbuild').stop();});

test('mounted Document can Stop held ACK; local unlock and Restore precede exact late cancellation',async()=>{
 await open();await begin();assert.equal(button('Stop').disabled,false,'Stop remains usable during outstanding Address');
 assert.equal(button('Recover document').disabled,false,'Explicit recovery remains usable');
 fixture.state.items[0].content='<p>Accepted partial work.</p>';fixture.state.revision++;
 await click(button('Stop'));
 assert.equal(fixture.state.runs[0].revoked,true);assert.equal(fixture.state.runs[0].status,'cancelled');
 assert.equal(document.querySelector('.ws-editor').getAttribute('contenteditable'),'true','Local document unlocks before ACK arrives');
 assert.equal(button('Restore pre-run version').disabled,false);assert.match(document.querySelector('.ws-editor').textContent,/Accepted partial work/);
 assert.equal(fixture.events.some(e=>e.method==='prompt.cancel'),false);
 await act(()=>fixture.resolveAck());await tick();
 const revoke=fixture.events.findIndex(e=>e.kind==='local-revocation'),cancel=fixture.events.findIndex(e=>e.method==='prompt.cancel');
 assert.ok(cancel>revoke);assert.deepEqual(fixture.events[cancel].params,{session_id:'stored-page',admission_id:'ack-exact',profile:'synthetic-a'});
 assert.equal(fixture.state.runs[0].revoked,true);assert.equal(fixture.state.comments[0].resolved,false);
});
test('mounted pending Address allows explicit Recover with unavailable ACK',async()=>{
 await open();await begin();assert.equal(button('Recover document').disabled,false);
 await click(button('Recover document'));await click(button('Revoke Workspace edits'));
 assert.equal(fixture.state.runs[0].revoked,true);assert.equal(fixture.state.runs[0].status,'error');
 assert.equal(document.querySelector('.ws-editor').getAttribute('contenteditable'),'true');
 await act(()=>fixture.rejectAck());await tick();
 assert.match(document.querySelector('[role=alert]')?.textContent??'',/unavailable ACK/);assert.equal(fixture.events.some(e=>e.method==='prompt.cancel'),false);
 assert.equal(button('Restore pre-run version').disabled,false);
});
test('mounted Stop retains local cancellation, partial work and truthful error when late native cancel fails',async()=>{
 await open({cancelFailure:true});await begin();assert.equal(button('Stop').disabled,false);
 await click(button('Stop'));await act(()=>fixture.resolveAck());await tick();
 assert.equal(fixture.state.runs[0].status,'cancelled');assert.equal(fixture.state.runs[0].revoked,true);
 assert.equal(document.querySelector('.ws-editor').getAttribute('contenteditable'),'true');
 assert.match(document.body.textContent,/cancellation failed/);assert.match(document.body.textContent,/native thread may still be running/i);
 assert.equal(button('Restore pre-run version').disabled,false);
});

test('mounted pending run leaves other page editable and preserves its explicit user save',async()=>{
 await open();await begin();await click(button('Other page'));
 const editor=document.querySelector('.ws-editor');assert.equal(editor.getAttribute('contenteditable'),'true');
 await act(()=>{editor.innerHTML='<p>Other page remains usable.</p>';editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));});
 await tick(750);assert.equal(fixture.state.items[1].content,'<p>Other page remains usable.</p>');
 assert.equal(fixture.state.runs[0].status,'running');assert.equal(fixture.events.some(e=>e.kind==='local-revocation'),false);
});
