// Component seam only. Native hover/focus reading is qualified by the explicit browser fixture.
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const rootPath=process.cwd(),out=process.env.ISSUE4_OUT;
assert.ok(out&&process.env.TMPDIR?.startsWith(out),'Canonical task-owned ISSUE4_OUT/TMPDIR required');
const require=createRequire(rootPath+'/.local/toolchain/package.json'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="app"></div>',{url:'https://workspace.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','Node','Event','MouseEvent','KeyboardEvent'])globalThis[key]=dom.window[key];
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
await require('esbuild').build({stdin:{contents:'export {Database,Property} from "./frontend/tables.jsx";export {createElement as h,act} from "react";export {createRoot} from "react-dom/client";',resolveDir:rootPath},bundle:true,platform:'node',format:'esm',outfile:out+'/build/minor-components.mjs',alias:{'@hermes/plugin-sdk':path.join(rootPath,'tests/ui/sdk-fixture.jsx'),react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))},define:{'process.env.NODE_ENV':'"development"'}});
const {Database,Property,h,act,createRoot}=await import(out+'/build/minor-components.mjs');
const root=createRoot(document.querySelector('#app'));let serial=0;
const tick=()=>act(()=>new Promise(resolve=>setTimeout(resolve,30)));
const button=name=>[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent)===name);
const click=async node=>{assert.ok(node);await act(async()=>node.click());await tick();};
const input=async(node,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});};
const submit=async form=>{await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await tick();};
async function creator(message){const item={id:'db',kind:'database',columns:[{id:'n',name:'Count',type:'number'}]};await act(async()=>root.render(h(Database,{key:++serial,item,state:{items:[item],runs:[],attachments:[]},command:async()=>{throw Error(message);},onOpen:()=>{},confirm:()=>{}})));await click(button('Add property'));const field=document.querySelector('input[aria-label="Property name"]');await input(field,'Count');await submit(field.form);return field;}

test('known duplicate and ambiguous names give actionable copy at the retained name field',async()=>{
  for(const diagnostic of ['Column IDs and names must be unique','Column names/IDs must be unambiguous']){
    const field=await creator(diagnostic),alert=document.querySelector('form[aria-label="New property"] [role=alert]');
    assert.equal(alert.textContent,'A property with this name already exists. Choose another name.');assert.equal(field.value,'Count');assert.equal(field.getAttribute('aria-invalid'),'true');assert.equal(field.getAttribute('aria-describedby'),alert.id);assert.equal(document.activeElement,field);
  }
});
test('unrelated transport, revision, authority and formula diagnostics stay exact',async()=>{
  for(const diagnostic of ['Synthetic transport unavailable','Workspace revision changed; reload before editing','Permission denied for this scope','Unknown formula column: Missing','Column IDs and names must be unique after reconnect']){
    const field=await creator(diagnostic);assert.equal(document.querySelector('form[aria-label="New property"] [role=alert]').textContent,diagnostic);assert.equal(field.value,'Count');
  }
});
test('compact literal text retains its input, selection, IME Enter and one blur save',async()=>{
  const original='漢字 🌿 <b>literal</b> & "quoted" text',calls=[];
  await act(async()=>root.render(h(Property,{key:++serial,column:{id:'note',name:'Observation',type:'text'},value:original,state:{items:[]},compact:true,onChange:async value=>calls.push(value)})));
  const field=document.querySelector('input');await act(async()=>field.focus());field.setSelectionRange(2,5);await act(async()=>field.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})));
  assert.equal(document.querySelector('input'),field);assert.equal(document.activeElement,field);assert.equal(field.selectionStart,2);assert.equal(field.selectionEnd,5);
  await input(field,original+' edited');await act(async()=>field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,keyCode:229,bubbles:true,cancelable:true})));assert.equal(document.activeElement,field);assert.equal(calls.length,0);
  await act(async()=>field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));await tick();assert.deepEqual(calls,[original+' edited']);assert.equal(document.querySelector('input'),field);assert.equal(field.value,original+' edited');assert.equal(document.querySelectorAll('b,script').length,0);
});
test('compact text pending deduplication and failed-save retry retain the literal draft',async()=>{
  let release,calls=0;const value='Long literal draft 🌿 <script>no execution</script>';
  await act(async()=>root.render(h(Property,{key:++serial,column:{id:'note',name:'Observation',type:'text'},value:'Saved original',state:{items:[]},compact:true,onChange:()=>{calls++;return calls===1?new Promise((_resolve,reject)=>{release=()=>reject(Error('Synthetic save unavailable'));}):Promise.resolve();}})));
  const field=document.querySelector('input');await act(async()=>field.focus());await input(field,value);await act(async()=>field.blur());await tick();await act(async()=>{field.focus();field.blur();});await tick();assert.equal(calls,1);
  await act(async()=>release());await tick();assert.equal(field.value,value);assert.match(document.querySelector('[role=alert]').textContent,/Synthetic save unavailable/);await click(button('Retry property save'));assert.equal(calls,2);assert.equal(field.value,value);assert.equal(document.querySelector('[role=alert]'),null);
});
after(async()=>{await act(async()=>root.unmount());dom.window.close();require('esbuild').stop();});
