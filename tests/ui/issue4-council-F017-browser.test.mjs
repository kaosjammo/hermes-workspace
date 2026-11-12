// Explicit full Workspace/production persistence fixture; excluded from component discovery.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const out=process.env.F017_OUT,phase=process.env.F017_PHASE,base=process.env.F017_URL??'http://127.0.0.1:19757';
assert.ok(out&&process.env.TMPDIR?.startsWith(out),'Explicit task-owned output/temp required');
const {chromium,expect}=createRequire(process.env.F017_HOST_PACKAGE)('@playwright/test');
const report={phase,scope:'Actual production Workspace/API/Store/SQLite with pinned SDK controls/styles; synthetic admission/transport/profile atoms/data.',states:[],errors:[],writes:[]};
const save=()=>fs.writeFile(out+'/logs/'+phase+'.json',JSON.stringify(report,null,2));
let context,page;
const input=()=>page.locator('.ws-table tbody tr').filter({has:page.getByRole('button',{name:'Observation 01',exact:true})}).getByRole('textbox',{name:'Observation',exact:true});
const reader=()=>input().locator('..').getByRole('button',{name:'Read full Observation',exact:true});
const state=()=>page.evaluate(()=>window.issue9.rest('/state'));
const note=async()=> (await state()).items.find(i=>i.title==='Observation 01').properties.note;
async function settle(){await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));await page.evaluate(async()=>{let prev='';for(let i=0;i<25;i++){await new Promise(requestAnimationFrame);const next=JSON.stringify([...document.querySelectorAll('.ws-work,.ws-table-wrap,.ws-db-text-cell,[data-slot=tooltip-content]')].map(n=>{const r=n.getBoundingClientRect();return[r.x,r.y,r.width,r.height,n.scrollTop,n.scrollLeft]}));if(next===prev)return;prev=next;}throw Error('Geometry did not settle');});}
async function open(){const drawer=page.getByRole('button',{name:/^Pages ·/});if(await drawer.isVisible())await drawer.click();await page.locator('.ws-nav').getByRole('button',{name:'Long observations',exact:true}).first().click();await expect(page.locator('.ws-document h1')).toHaveText('Long observations');await input().scrollIntoViewIfNeeded();await settle();}
async function read(keyboard){await page.mouse.move(0,0);await settle();if(keyboard){await input().focus();await page.keyboard.press('Tab');await expect(reader()).toBeFocused();}else await reader().hover();const tip=page.getByRole('tooltip');await expect(tip).toBeVisible();assert.equal(await tip.textContent(),await input().inputValue());assert.equal(await tip.locator('b,script').count(),0);return tip;}
async function capture(label){await settle();const geometry=await input().evaluate(e=>{
  const cue=e.parentElement.querySelector('.ws-db-text-read'),cs=getComputedStyle(e),bs=getComputedStyle(cue),r=e.getBoundingClientRect(),b=cue.getBoundingClientRect();
  const rect=x=>({x:x.x,y:x.y,width:x.width,height:x.height,right:x.right,bottom:x.bottom});
  const px=v=>parseFloat(v)||0;
  // Native focus ring is an actual computed outer box shadow; retain raw shadows and outline.
  const shadows=bs.boxShadow.split(/,(?![^()]*\))/).filter(s=>s.trim()!=='none'&&!s.includes('inset')).map(s=>[...s.replace(/(?:rgba?|color)\([^)]*\)/g,'').matchAll(/(-?[\d.]+)px/g)].map(m=>Number(m[1])));
  const spread=Math.max(0,...shadows.map(v=>Math.max(0,(v[3]??0)+(v[2]??0)/2)));
  const outline=['none','hidden'].includes(bs.outlineStyle)?0:px(bs.outlineWidth)+Math.max(0,px(bs.outlineOffset));
  const focusExpansion=Math.max(spread,outline),contentEnd=r.right-px(cs.borderRightWidth)-px(cs.paddingRight);
  const inputExpansion=['none','hidden'].includes(cs.outlineStyle)?0:px(cs.outlineWidth)+Math.max(0,px(cs.outlineOffset));
  return{input:rect(r),tableCell:rect(e.closest('td').getBoundingClientRect()),inputFocus:{x:r.x-inputExpansion,y:r.y-inputExpansion,right:r.right+inputExpansion,bottom:r.bottom+inputExpansion},cue:rect(b),cueFocus:{x:b.x-focusExpansion,y:b.y-focusExpansion,right:b.right+focusExpansion,bottom:b.bottom+focusExpansion,expansion:focusExpansion},inputContentEnd:contentEnd,textToCueGap:b.x-contentEnd,textToFocusGap:b.x-focusExpansion-contentEnd,inputBoxSizing:cs.boxSizing,paddingInlineStart:cs.paddingInlineStart,paddingInlineEnd:cs.paddingInlineEnd,borderRight:cs.borderRightWidth,inputTextOverflow:cs.textOverflow,inputOutline:cs.outline,inputBoxShadow:cs.boxShadow,cueOutline:bs.outline,cueOutlineOffset:bs.outlineOffset,cueBoxShadow:bs.boxShadow,inputFontSize:cs.fontSize,inputOverflow:cs.overflow,containerOverflow:getComputedStyle(e.parentElement).overflow,value:e.value,selection:[e.selectionStart,e.selectionEnd],sameInput:e===window.__F017input,inputFocused:document.activeElement===e,readerFocused:document.activeElement===cue,readerFocusVisible:cue.matches(':focus-visible'),inputFocusVisible:e.matches(':focus-visible'),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth};
});
  const actual=await page.evaluate(()=>({title:document.querySelector('.ws-document h1')?.textContent,viewport:[innerWidth,innerHeight],theme:document.documentElement.classList.contains('dark')?'dark':'light',fonts:document.fonts.status,selectedIds:[...document.querySelectorAll('.ws-nav [aria-current="page"]')].map(n=>n.closest('[data-ws-item-id]')?.dataset.wsItemId),alerts:[...document.querySelectorAll('[role=alert]')].filter(n=>n.getClientRects().length).map(n=>n.textContent),tips:[...document.querySelectorAll('[data-slot=tooltip-content]')].filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return{text:n.textContent,x:r.x,y:r.y,width:r.width,height:r.height};})}));
  const failures=[];const check=(v,s)=>{if(!v)failures.push(s)};
  check(geometry.textToCueGap>=4,'Literal text/ellipsis content edge must stop at least4px before read cue');
  check(geometry.textToFocusGap>=4,'Literal content edge must stop at least4px before computed cue focus footprint');
  check(geometry.inputBoxSizing==='border-box','Keep native input border-box');check(geometry.inputFontSize==='13px','Keep existing input typography');check(geometry.containerOverflow==='visible','No wrapper focus clipping');check(geometry.sameInput,'Existing input node retained');
  check(geometry.cueFocus.x>=geometry.tableCell.x&&geometry.cueFocus.right<=geometry.tableCell.right&&geometry.cueFocus.y>=geometry.tableCell.y&&geometry.cueFocus.bottom<=geometry.tableCell.bottom,'Native cue focus footprint stays within its cell');
  check(geometry.scrollWidth>geometry.clientWidth,'Actual long literal overflow exercised');check(geometry.readerFocusVisible?geometry.cueFocus.expansion>=3:true,'Native visible reader ring retained');
  if(label.includes('resting'))check(geometry.inputTextOverflow==='ellipsis','Resting literal uses ellipsis');
  if(label.includes('input-focused'))check(geometry.inputFocused,'Input state actually focused');
  if(label.includes('reader-focused'))check(geometry.readerFocused&&geometry.readerFocusVisible,'Reader state actually keyboard focused');
  const file=out+'/screenshots/'+phase+'-'+label+'.png';await page.screenshot({path:file,fullPage:false});
  report.states.push({label,actual,geometry,failures,path:file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')});await save();
}
try{
  context=await chromium.launchPersistentContext(out+'/scratch/browser-'+phase,{headless:true,chromiumSandbox:true,executablePath:process.env.F017_CHROMIUM,viewport:{width:1440,height:900},args:['--disable-dev-shm-usage']});page=context.pages()[0];page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/api/command')&&r.postData()){const d=JSON.parse(r.postData());if(d.op==='update_item')report.writes.push(d);}});
  await page.goto(base);await page.locator('.ws-nav').waitFor();await open();report.before=await page.request.get(base+'/fixture/raw').then(r=>r.json());
  for(const[theme,width,height]of[['light',1440,900],['dark',1440,900],['light',420,740],['dark',420,740]]){
    await page.reload();await page.locator('.ws-nav').waitFor();await page.setViewportSize({width,height});await page.evaluate(m=>window.issue9.theme(m),theme);await open();const original=await input().inputValue(),tag=theme+'-'+width;
    await input().evaluate(e=>{window.__F017input=e;});
    try{
      await page.locator('.ws-db-count').first().click();await capture(tag+'-resting');
      await input().focus();await input().evaluate(e=>e.setSelectionRange(4,8));await capture(tag+'-input-focused');
      await read(false);await expect(input()).toBeFocused();assert.deepEqual(await input().evaluate(e=>[e.selectionStart,e.selectionEnd]),[4,8]);await page.keyboard.press('Escape');
      await read(true);assert.equal(await page.getByRole('tooltip').textContent(),original);await capture(tag+'-reader-focused');
      await page.keyboard.press('Escape');await input().fill(original+' retained 🌱 <literal>');const draft=await input().inputValue();await page.request.post(base+'/fixture/mode/text-fail-once');await input().press('Enter');await expect(page.getByRole('alert').filter({hasText:'Synthetic text save unavailable'})).toBeVisible();await expect(input()).toHaveValue(draft);await input().focus();await input().evaluate(e=>e.setSelectionRange(4,8));await capture(tag+'-failed-input-focused');
      await read(false);await expect(input()).toBeFocused();assert.deepEqual(await input().evaluate(e=>[e.selectionStart,e.selectionEnd]),[4,8]);await page.keyboard.press('Escape');await read(true);assert.equal(await page.getByRole('tooltip').textContent(),draft);await capture(tag+'-failed-reader-focused');await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Retry property save',exact:true}).click();await expect.poll(note).toBe(draft);
      const start=report.writes.length;await input().fill(original);await input().evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,keyCode:229,bubbles:true,cancelable:true}));});await expect(input()).toBeFocused();assert.equal(report.writes.length,start);await input().evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await page.request.post(base+'/fixture/mode/text-slow');await input().press('Enter');await expect(page.getByText('Saving property…',{exact:true})).toBeVisible();await input().focus();await input().press('Enter');await expect.poll(note).toBe(original);assert.equal(report.writes.length,start+1);assert.equal(await input().evaluate(e=>e===window.__F017input),true);
    }finally{await page.request.post(base+'/fixture/mode/normal');if(await input().inputValue()!==original){await input().fill(original);await input().press('Tab');await expect.poll(note).toBe(original);}}
  }
  report.after=await page.request.get(base+'/fixture/raw').then(r=>r.json());report.reopened=await page.request.get(base+'/fixture/reopen').then(r=>r.json());assert.deepEqual(report.reopened,report.after);assert.deepEqual(report.before.comments,report.after.comments);const after=new Map(report.after.items.map(i=>[i.id,i]));for(const old of report.before.items)for(const k of ['title','content','database_id','properties','columns'])if(k in old)assert.deepEqual(after.get(old.id)[k],old[k],old.id+':'+k);report.dataAndCommentsExact=true;report.sqliteReopenExact=true;report.editRetryImePendingIdentity=true;
}catch(error){report.errors.push(String(error.stack??error));}finally{await save();await context?.close();}
console.log(JSON.stringify({phase,states:report.states.length,failures:report.states.filter(s=>s.failures.length).map(s=>({label:s.label,failures:s.failures,gap:s.geometry.textToCueGap,focusGap:s.geometry.textToFocusGap,paddingEnd:s.geometry.paddingInlineEnd})),errors:report.errors,dataAndCommentsExact:report.dataAndCommentsExact,sqliteReopenExact:report.sqliteReopenExact},null,2));
if(report.states.some(s=>s.failures.length)||report.errors.length||report.states.length!==20)process.exitCode=1;
