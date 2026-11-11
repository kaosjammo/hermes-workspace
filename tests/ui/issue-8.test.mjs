/** Issue #8 production component regressions. Synthetic DOM, not native acceptance. */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { commentAnchor } from '../../frontend/editor.mjs';
const evidence = process.env.ISSUE8_EVIDENCE ?? (process.env.HWS_QUALIFICATION_HOME && path.join(process.env.HWS_QUALIFICATION_HOME, 'issue-8'));
assert.ok(evidence, 'Set ISSUE8_EVIDENCE to task-owned external evidence directory');
for (const [key,name] of [['TMPDIR','tmp'],['HOME','home'],['HERMES_HOME','hermes']]) {
  const scratch=path.join(evidence,'scratch',name); mkdirSync(scratch,{recursive:true}); process.env[key]=scratch;
}
const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const { build } = require('esbuild');
mkdirSync(path.join(evidence,'build'),{recursive:true});
await build({ entryPoints:['tests/ui/issue-8-runtime.jsx'], bundle:true, platform:'node', format:'esm', outfile:path.join(evidence,'build/runtime.mjs'), alias:{'@hermes/plugin-sdk':path.resolve('tests/ui/sdk-fixture.jsx'),react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))}, define:{'process.env.NODE_ENV':'"development"'} });
const dom = new JSDOM('<div id="app"></div>',{url:'https://issue8.synthetic.test',pretendToBeVisual:true});
for (const key of ['window','document','HTMLElement','Node','MutationObserver','Event','MouseEvent','KeyboardEvent']) globalThis[key]=dom.window[key];
globalThis.getSelection=()=>window.getSelection();
globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const runtime=await import(path.join(evidence,'build/runtime.mjs')+'?'+Date.now());
const {Comments,CommentHighlights,createRoot,createElement:h,act,anchorRange}=runtime;
const root=createRoot(document.querySelector('#app'));
const page={id:'p',kind:'page',title:'Garden notes'};
const text='North river path. South river path. Meadow.';
const comments=[
 {id:'a',item_id:'p',text:'Clarify the first route',anchor:{quote:'North river path'},replies:[{id:'r',author:'agent',text:'Answered, still unresolved'}],resolved:false},
 {id:'b',item_id:'p',text:'Independent overlapping feedback',anchor:{quote:'river path',prefix:'North '},replies:[],resolved:false},
 {id:'c',item_id:'p',text:'Missing selection feedback',anchor:{quote:'Removed bridge'},replies:[],resolved:false},
 {id:'d',item_id:'p',text:'Ambiguous selection feedback',anchor:{quote:'river path'},replies:[],resolved:false},
 {id:'e',item_id:'p',text:'Whole item feedback',anchor:null,replies:[],resolved:false},
 {id:'f',item_id:'other',text:'Another document',anchor:{quote:'Meadow'},replies:[],resolved:false},
];
let active='a',hovered=null,showResolved=false,locked=false,current=structuredClone(comments),calls=[],errors=[],drafts={};
const props=()=>({item:page,state:{items:[page],comments:current},text,anchor:null,setAnchor:()=>{},activeComment:active,setActiveComment:id=>{active=id},showResolved,setShowResolved:v=>{showResolved=v},geometry:[],hoveredComment:hovered,setHoveredComment:id=>{hovered=id},onPassage:(id,anchor)=>calls.push(['passage',{id,anchor}]),command:async(name,args)=>{calls.push([name,args]);if(name==='resolve_comment')current=current.map(c=>c.id===args.id?{...c,resolved:args.resolved}:c)},workflow:{},locked,onError:e=>errors.push(e.message),onRun:()=>{},onRefresh:()=>{},draftBuffer:{read:()=>({draft:{replies:drafts}}),put:v=>{drafts=v.replies},discard:()=>{}}});
const render=async()=>act(async()=>root.render(h(Comments,props())));
const click=async node=>act(async()=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));
after(async()=>{await act(async()=>root.unmount());window.close()});
test('attached cards omit the repeated quotation and expose a compact numbered passage action',async()=>{await render();const card=document.querySelector('#ws-discussion-a');assert.ok(card);assert.ok(!card.textContent.includes('North river path'),'attached card must not repeat passage');assert.ok(card.textContent.includes('Answered, still unresolved'));const button=[...card.querySelectorAll('button')].find(n=>n.getAttribute('aria-label')==='Show passage for comment 1');assert.ok(button);await click(button);assert.deepEqual(calls.at(-1),['passage',{id:'a',anchor:comments[0].anchor}]);});
test('one immutable-ID number mapping precedes visibility filtering and includes whole-item threads',()=>{assert.equal(typeof runtime.numberComments,'function');const input=structuredClone(comments.slice(0,5));const snapshot=JSON.stringify(input);const mapped=runtime.numberComments(input);assert.deepEqual(mapped.map(c=>[c.id,c.passageNumber]),[['a',1],['b',2],['c',3],['d',4],['e',5]]);assert.equal(JSON.stringify(input),snapshot);const filtered=mapped.filter(c=>c.id!=='a');assert.equal(runtime.numberComments(filtered).find(c=>c.id==='b').passageNumber,2);assert.deepEqual(runtime.numberComments(input.filter(c=>c.id!=='a')).map(c=>c.id),['b','c','d','e']);});
test('detached and ambiguous anchors warn without a guessed passage and keep original context optional',async()=>{for(const id of ['c','d']){active=id;await render();const card=document.querySelector('#ws-discussion-'+id);assert.match(card.textContent,/missing|ambiguous/);const details=card.querySelector('.ws-anchor-recovery');assert.ok(details);assert.equal(details.open,false);assert.match(details.querySelector('summary').textContent,/original excerpt/i);assert.ok(details.textContent.includes(comments.find(c=>c.id===id).anchor.quote));assert.equal([...card.querySelectorAll('button')].some(b=>/Show passage/.test(b.textContent)),false)}});
test('whole page and database threads have a number but never invent a highlighted passage',async()=>{active='e';await render();const card=document.querySelector('#ws-discussion-e');assert.match(card.textContent,/Whole page/);assert.match(document.querySelector('#ws-bubble-e').textContent,/Comment 5/);assert.equal(card.querySelector('.ws-comment-passage'),null);assert.equal(anchorRange(document.createElement('div'),null),null)});
test('focus and pointer association do not command mutations or scroll; user controls retain lock guards',async()=>{active=null;await render();const button=document.querySelector('#ws-bubble-b');const before=calls.length;await act(async()=>button.focus());assert.equal(hovered,'b');assert.equal(calls.length,before);await click(button);await render();assert.equal(active,'b');locked=true;await render();assert.ok(document.querySelector('input[aria-label="Resolve: Independent overlapping feedback"]').disabled);locked=false;});
test('resolution/reopen retain immutable IDs, independent answered comments, quote metadata and draft replies',async()=>{active='a';await render();const before=JSON.stringify(current.map(c=>[c.id,c.anchor,c.replies]));const control=document.querySelector('input[aria-label="Resolve: Clarify the first route"]');await click(control);assert.equal(current.find(c=>c.id==='a').resolved,true);assert.equal(current.find(c=>c.id==='b').resolved,false);showResolved=true;active='a';await render();await click(document.querySelector('input[aria-label="Resolve: Clarify the first route"]'));assert.equal(current.find(c=>c.id==='a').resolved,false);assert.equal(JSON.stringify(current.map(c=>[c.id,c.anchor,c.replies])),before);assert.deepEqual(errors,[]);});
test('multiple and overlapping ranges stay independent; unavailable section mapping never broadens to old quote',()=>{const editor=document.createElement('div');editor.textContent=text;assert.equal(anchorRange(editor,comments[0].anchor).toString(),'North river path');assert.equal(anchorRange(editor,comments[1].anchor).toString(),'river path');assert.equal(anchorRange(editor,comments[3].anchor),null);const stored={...comments[0],section_change:{status:'unavailable'}};assert.equal(anchorRange(editor,commentAnchor(stored)),null);assert.equal(stored.anchor.quote,'North river path');});

test('marker numbers retain the full-item mapping across resolution filtering, including detached gaps',async()=>{
  const input=runtime.numberComments(comments.slice(0,5));
  const editor=document.createElement('div');editor.className='ws-editor';editor.textContent=text;document.body.append(editor);
  const original=window.Range.prototype.getClientRects;
  window.Range.prototype.getClientRects=function(){return [{top:this.startOffset*30,left:0,right:200,bottom:this.startOffset*30+20,width:200,height:20}]};
  const ref={current:editor};
  try{
    await act(async()=>root.render(h(CommentHighlights,{editorRef:ref,comments:input.filter(c=>c.id!=='a'),active:null,onComment:()=>{}})));
    const marker=document.querySelector('.ws-passage-marker');assert.equal(marker.textContent,'2');assert.match(marker.getAttribute('aria-label'),/^Open comment 2:/);
  }finally{await act(async()=>root.render(null));window.Range.prototype.getClientRects=original;editor.remove();}
});
