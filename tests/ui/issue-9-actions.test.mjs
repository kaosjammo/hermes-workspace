/** Production comment surfaces; synthetic DOM SDK, real SDK browser separately. */
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {MessageChannel as NativeChannel} from 'node:worker_threads';
const out=process.env.ISSUE9_EVIDENCE??process.env.HWS_QUALIFICATION_HOME;assert.ok(out,'External issue scratch required');
const require=createRequire(path.resolve('.local/toolchain/package.json'));
await fs.mkdir(out+'/build',{recursive:true});
await require('esbuild').build({stdin:{contents:'export {Comments} from "./frontend/comments.jsx";export {createElement as h,act} from "react";export {createRoot} from "react-dom/client";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:out+'/build/actions.mjs',alias:{'@hermes/plugin-sdk':path.resolve('tests/ui/sdk-fixture.jsx'),react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))},define:{'process.env.NODE_ENV':'"development"'},plugins:process.env.ISSUE9_PREDECESSOR?[{name:'exact-base',setup(build){build.onLoad({filter:/frontend\/(comments\.jsx|comment-styles\.mjs)$/},args=>({contents:execFileSync('git',['show','683c8ba30a9dd27d2256e5d61bb855cb7163e3d9:frontend/'+path.basename(args.path)],{encoding:'utf8'}),loader:path.extname(args.path)==='.jsx'?'jsx':'js'}));}}]:[]});
const {JSDOM}=require('jsdom'),dom=new JSDOM('<div id="app"></div>',{url:'https://issue9.synthetic.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','Node','Event','MouseEvent','KeyboardEvent'])globalThis[key]=dom.window[key];
globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const originalChannel=globalThis.MessageChannel,taskChannels=[];
globalThis.MessageChannel=class extends NativeChannel {constructor(){super();taskChannels.push(this)}};
const {Comments,h,act,createRoot}=await import(out+'/build/actions.mjs');
const root=createRoot(document.getElementById('app')),page={id:'page',kind:'page',title:'Garden'};
let active='a',locked=false,showResolved=true,calls=[],errors=[],release=null;
let comments=[{id:'a',item_id:'page',text:'North feedback',anchor:null,replies:[],resolved:false,section_change:{status:'available'}},
{id:'b',item_id:'page',text:'South feedback',anchor:{quote:'missing'},replies:[],resolved:false,section_change:{status:'unavailable',reason:'The section is detached.'}}];
const render=()=>act(()=>root.render(h(Comments,{item:page,state:{items:[page],comments},text:'Garden',anchor:null,setAnchor:()=>{},activeComment:active,setActiveComment:v=>{active=v},showResolved,setShowResolved:v=>{showResolved=v},command:async(op,args)=>{calls.push([op,args]);if(release===true)await new Promise(r=>release=r);if(op==='resolve_comment')comments=comments.map(c=>c.id===args.id?{...c,resolved:args.resolved}:c)},workflow:{},locked,onError:e=>errors.push(e.message),onRevertSection:async(c)=>{calls.push(['revert',c.id]);if(release===true)await new Promise(r=>release=r)}})));
after(async()=>{await act(()=>root.unmount());window.close();for(const channel of taskChannels){channel.port1.close();channel.port2.close()}globalThis.MessageChannel=originalChannel;require('esbuild').stop();console.log('ISSUE9_CLEANUP',JSON.stringify({channels:taskChannels.length,resources:process.getActiveResourcesInfo(),handles:process._getActiveHandles().map(h=>h.constructor.name)}))});
test('every collapsed/expanded surface has one sibling top-right group and exact tooltip copy',async()=>{
 await render();
 const groups=[...document.querySelectorAll('.ws-comment-actions')];assert.equal(groups.length,2);
 for(const group of groups){assert.deepEqual([...group.querySelectorAll('[data-tip]')].map(x=>x.dataset.tip),['Resolve','delete comment','Revert changes']);assert.equal(group.closest('.ws-bubble-summary'),null);assert.equal(group.querySelectorAll('button button,input button').length,0)}
 assert.match(document.getElementById('ws-bubble-a').textContent,/Comment 1/);assert.match(document.getElementById('ws-bubble-b').textContent,/Comment 2/);
 const unavailable=groups[1].querySelector('[aria-label^="Revert changes:"]');assert.equal(unavailable.disabled,true);assert.match(groups[1].parentElement.textContent,/detached/);
});
test('resolve is synchronously deduplicated and reopening retains drafts',async()=>{
 active='a';await render();let box=document.querySelector('.ws-bubble input[aria-label^="Resolve:"]');assert.ok(box);box.focus();release=true;
 await act(()=>{box.click();box.click()});assert.equal(calls.filter(c=>c[0]==='resolve_comment').length,1);
 await act(async()=>{release();release=null});await render();box=document.querySelector('.ws-bubble input[aria-label^="Resolve:"]');assert.equal(box.checked,true);
 await act(()=>box.click());await render();assert.equal(comments[0].resolved,false);assert.equal(comments[1].resolved,false);
});
test('revert double activation has one effect and failed/pending controls remain recoverable',async()=>{
 await render();const button=document.querySelector('button[aria-label="Revert changes: North feedback"]');assert.ok(button);release=true;
 const before=calls.length;await act(()=>{button.click();button.click()});assert.equal(calls.length-before,1);assert.equal(document.querySelector('button[aria-label="Revert changes: North feedback"]').disabled,true);
 await act(async()=>{release();release=null});await render();assert.equal(document.querySelector('button[aria-label="Revert changes: North feedback"]').disabled,false);
 locked=true;await render();assert.equal(document.querySelector('button[aria-label="Revert changes: North feedback"]').disabled,true);assert.equal(document.querySelector('button[aria-label^="delete comment:"]').disabled,true);locked=false;
});
test('delete opens existing confirmation and cancellation sends no command',async()=>{
 await render();await act(()=>document.querySelector('button[aria-label="delete comment: North feedback"]').click());
 const dialog=document.querySelector('[role="dialog"]');assert.ok(dialog);assert.match(dialog.textContent,/all its replies/);const before=calls.length;
 await act(()=>[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Cancel').click());assert.equal(calls.length,before);assert.equal(document.querySelector('[role="dialog"]'),null);assert.deepEqual(errors,[]);
});
test('reply submission synchronously blocks header actions and retains the reply until saved',async()=>{
 active='a';await render();const details=document.querySelector('.ws-reply-compose');await act(()=>{details.open=true;details.dispatchEvent(new Event('toggle'))});
 const textarea=document.querySelector('textarea');await act(()=>{const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;setter.call(textarea,'Reply draft');textarea.dispatchEvent(new Event('input',{bubbles:true}))});
 release=true;const before=calls.length;await act(()=>textarea.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 const box=document.querySelector('input[aria-label="Resolve: North feedback"]'),del=document.querySelector('button[aria-label="delete comment: North feedback"]');
 assert.equal(box.disabled,true);assert.equal(del.disabled,true);await act(()=>{box.click();del.click()});assert.equal(calls.length-before,1);assert.equal(document.querySelector('[role="dialog"]'),null);
 await act(async()=>{release();release=null});await render();assert.equal(document.querySelector('input[aria-label="Resolve: North feedback"]').disabled,false);assert.equal(document.querySelector('textarea').value,'');
});
