/** Canonical component entry: no Playwright or task-specific environment required. */
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {MessageChannel as NativeChannel} from 'node:worker_threads';
const require=createRequire(path.resolve('.local/toolchain/package.json'));
const output=await fs.mkdtemp(path.join(process.env.HWS_QUALIFICATION_HOME??process.env.TMPDIR??path.resolve('.local/frontend'),'issue9-user-ux-'));
await require('esbuild').build({stdin:{contents:'export {Comments} from "./frontend/comments.jsx";export {createElement as h,useState,act} from "react";export {createRoot} from "react-dom/client";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:output+'/surface.mjs',alias:{'@hermes/plugin-sdk':path.resolve('tests/ui/sdk-fixture.jsx'),react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))},define:{'process.env.NODE_ENV':'"development"'}});
const {JSDOM}=require('jsdom'),dom=new JSDOM('<button id="outside">Outside</button><main class="ws-work"><div id="app"></div></main>',{url:'https://workspace.synthetic.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','Node','Event','MouseEvent','KeyboardEvent'])globalThis[key]=dom.window[key];
globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const originalChannel=globalThis.MessageChannel,channels=[];
globalThis.MessageChannel=class extends NativeChannel{constructor(){super();channels.push(this)}};
const {Comments,h,useState,act,createRoot}=await import(output+'/surface.mjs');
const root=createRoot(document.getElementById('app')),page={id:'page',kind:'page',title:'Garden'};
const human={id:'human',author:'user',text:'Human reply: I intentionally wrote this literal prefix.',author_identity:{kind:'human',id:'1'.repeat(64),name:'Hermes'}};
const agent={id:'agent',author:'agent',text:'Actual agent outcome.',author_identity:{kind:'agent',name:'user'}};
const unknown={id:'unknown',text:'Unknown origin is neutral.'};
let active,calls,errors,saved,instance=0;
function Harness({initial=null,locked=false}){
 const [selected,setSelected]=useState(initial),[comments,setComments]=useState([
  {id:'a',item_id:page.id,text:'North feedback',anchor:null,resolved:false,replies:[human,agent,unknown],section_change:{status:'available'}},
  {id:'b',item_id:page.id,text:'South feedback with a long independent discussion',anchor:null,resolved:false,replies:[],section_change:{status:'unavailable',reason:'No trusted historical outcome.'}},
 ]);
 active=selected;
 return h(Comments,{item:page,state:{items:[page],comments},text:'North river. South garden.',anchor:null,setAnchor:()=>{},activeComment:selected,setActiveComment:setSelected,showResolved:true,locked,onError:e=>errors.push(e.message),draftBuffer:{read:()=>saved,put:d=>{saved={draft:structuredClone(d)}},discard:()=>{saved=null}},workflow:{},command:async(op,payload)=>{calls.push({op,payload});if(op==='resolve_comment')setComments(old=>old.map(c=>c.id===payload.id?{...c,resolved:payload.resolved}:c))},onRevertSection:async c=>{calls.push({op:'revert',id:c.id})}});
}
async function reset(props={}){calls=[];errors=[];saved=null;await act(()=>root.render(h(Harness,{key:++instance,...props})));}
const summary=id=>document.getElementById('ws-bubble-'+id);
const card=id=>summary(id).closest('.ws-bubble');
const click=node=>act(()=>node.click());
const tick=()=>act(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
after(async()=>{await act(()=>root.unmount());dom.window.close();for(const c of channels){c.port1.close();c.port2.close()}globalThis.MessageChannel=originalChannel;require('esbuild').stop();console.log('UX_CLEANUP',JSON.stringify({taskChannelsClosed:channels.length}));});
test('new UX: collapsed headers keep counts and accessible expansion without visible top clutter',async()=>{
 await reset();assert.doesNotMatch(document.querySelector('.ws-comment-surfaces').textContent,/Open discussion|Collapse thread|Draft reply/);
 assert.equal(summary('a').getAttribute('aria-expanded'),'false');assert.match(summary('b').textContent,/Comment 2/);assert.match(summary('a').textContent,/3 replies/);
 assert.equal(document.querySelectorAll('.ws-bubble-summary button,.ws-bubble-summary input').length,0);
});
test('new UX: card background expands; outside click/focus collapse without commands and draft survives',async()=>{
 await reset();await click(card('a'));await tick();assert.equal(active,'a');assert.equal(summary('a').getAttribute('aria-expanded'),'true');
 const details=card('a').querySelector('.ws-reply-compose');await act(()=>{details.open=true;details.dispatchEvent(new Event('toggle'))});
 const textarea=card('a').querySelector('textarea');await act(()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(textarea,'Unsent 庭');textarea.dispatchEvent(new Event('input',{bubbles:true}))});
 await click(textarea);assert.equal(active,'a');await click(document.getElementById('outside'));await tick();assert.equal(active,null);assert.deepEqual(calls,[]);
 await click(summary('a'));await tick();assert.equal(active,'a');assert.equal(card('a').querySelector('textarea').value,'Unsent 庭');
 await act(()=>document.getElementById('outside').focus());await tick();assert.equal(active,'a','internal programmatic focus does not invent outside intent');
 await act(()=>{summary('a').focus();summary('a').dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));document.getElementById('outside').focus()});await tick();assert.equal(active,null);assert.deepEqual(calls,[]);assert.deepEqual(errors,[]);
});
test('new UX: literal saved prefix survives; reply origin controls alignment and composer follows history',async()=>{
 await reset({initial:'a'});const body=document.getElementById('ws-discussion-a'),replies=[...body.querySelectorAll('.ws-reply')];
 assert.equal(replies[0].querySelector('p').textContent,human.text);assert.equal(replies[0].dataset.origin,'human');assert.equal(replies[1].dataset.origin,'agent');assert.equal(replies[2].dataset.origin,'unknown');
 assert.ok(replies.at(-1).compareDocumentPosition(body.querySelector('.ws-reply-compose'))&Node.DOCUMENT_POSITION_FOLLOWING);
 assert.match(replies[0].textContent,/Hermes/);assert.match(replies[1].textContent,/user/);assert.deepEqual(calls,[]);
});
test('native action semantics: exact tooltips, checked/reopen and delete cancellation remain independent',async()=>{
 await reset({initial:'a'});const group=card('a').querySelector('.ws-comment-actions');assert.deepEqual([...group.querySelectorAll('[data-tip]')].map(e=>e.dataset.tip),['Resolve','delete comment','Revert changes']);
 const box=group.querySelector('input[type=checkbox]');await click(box);assert.equal(box.checked,true);await click(box);assert.equal(box.checked,false);assert.deepEqual(calls.map(c=>c.op),['resolve_comment','resolve_comment']);
 await click(group.querySelector('[aria-label^="delete comment:"]'));assert.ok(document.querySelector('[role=dialog]'));
 await click([...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent==='Cancel'));assert.equal(active,'a');assert.equal(calls.length,2);
 const unavailable=card('b').querySelector('[aria-label^="Revert changes:"]');assert.equal(unavailable.disabled,true);assert.match(card('b').textContent,/No trusted historical outcome/);
});
