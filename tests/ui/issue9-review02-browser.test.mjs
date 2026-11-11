/** Original23 cases retained, then effective passages, chronology and corrected state captures. */
await import('./issue9-review01-browser.test.mjs');
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out=process.env.HWS_QUALIFICATION_HOME;
const require=createRequire(path.resolve('.local/host/.build/webapp-workspace/apps/desktop/package.json'));
const {chromium,expect}=require('@playwright/test');
const context=await chromium.launchPersistentContext(out+'/browsers/review02',{headless:true,chromiumSandbox:true,executablePath:process.env.HWS_CHROMIUM,viewport:{width:1440,height:900}});
const page=context.pages()[0];page.setDefaultTimeout(10000);
const base='http://127.0.0.1:'+(process.env.ISSUE9_PORT??'19579');
const report={cases:[],screenshots:[],errors:[],scope:'Real SDK controls/styles, production Workspace/API/SQLite. Synthetic admission/transport/profile atoms/data/native-shaped preparation. Emulated input and instrumented Range; installed Electron/IPC/provider/physical input/OS IME unproved.'};
page.on('pageerror',e=>report.errors.push(e.message));
const state=()=>page.evaluate(()=>window.issue9.rest('/state'));
const raw=async()=>await(await page.request.get(base+'/fixture/reopen')).json();
const button=name=>page.getByRole('button',{name,exact:true});
const passed=(name,data={})=>report.cases.push({name,status:'PASS',...data});
let manifest;
async function open(name){
 await page.setViewportSize({width:1440,height:900});
 const item=manifest.items.find(i=>i.title===name+' garden'),comment=item.comments.find(c=>c.text==='North feedback '+name);
 assert.ok(item&&comment);
 await page.locator('.ws-nav').getByRole('button',{name:item.title,exact:true}).first().click();
 await expect(page.getByRole('textbox',{name:'Page title',exact:true})).toHaveValue(item.title);
 await expect(page.locator('#ws-format-'+item.id)).toHaveCount(1); // Actual selected item ID in product DOM.
 await expect(page.locator('#ws-bubble-'+comment.id)).toHaveAttribute('aria-label',new RegExp(comment.text));
 await expect.poll(async()=>(await state()).recents[0]?.item_id).toBe(item.id);
 const summary=page.locator('#ws-bubble-'+comment.id);
 if(await summary.getAttribute('aria-expanded')!=='true')await summary.click();
 await expect(page.locator('#ws-discussion-'+comment.id)).toHaveAttribute('aria-label',comment.text);
 return {item,comment};
}
async function capture(name,expected,{footer=false}={}){
 const discussion=page.locator('#ws-discussion-'+expected.comment.id);
 await expect(page.getByRole('textbox',{name:'Page title',exact:true})).toHaveValue(expected.item.title);
 await expect(page.locator('#ws-format-'+expected.item.id)).toHaveCount(1);
 await expect(discussion).toHaveAttribute('aria-label',expected.comment.text);
 await expect(discussion).toContainText(expected.comment.text);
 if(footer){await page.getByRole('heading',{name:'Detached passages',exact:true}).waitFor();await discussion.scrollIntoViewIfNeeded()}
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));
 const geometry=await page.evaluate(async id=>{
  let prior='',stable=0;
  for(let i=0;i<300;i++){
   await new Promise(requestAnimationFrame);const pane=document.querySelector('.ws-work'),discussion=document.getElementById('ws-discussion-'+id),r=discussion.getBoundingClientRect();
   const value=JSON.stringify([pane.scrollTop,pane.scrollLeft,r.x,r.y,r.width,r.height].map(n=>Math.round(n*10)/10));stable=value===prior?stable+1:0;prior=value;
   if(stable>=8)return{scroll:pane.scrollTop,rect:{x:r.x,y:r.y,width:r.width,height:r.height},discussionId:discussion.id,discussionLabel:discussion.getAttribute('aria-label'),discussionText:discussion.innerText,pageTitle:document.querySelector('[aria-label="Page title"]').value,activeNav:[...document.querySelectorAll('.ws-nav [aria-current="page"]')].map(e=>e.innerText)};
  }throw Error('Selected discussion layout/scroll did not settle');
 },expected.comment.id);
 assert.equal(geometry.discussionId,'ws-discussion-'+expected.comment.id);assert.equal(geometry.discussionLabel,expected.comment.text);assert.equal(geometry.pageTitle,expected.item.title);
 if(footer){assert.ok(geometry.rect.y>=40);assert.ok(geometry.rect.y<850)}
 const file=out+'/screenshots/'+name+'.png';await page.screenshot({path:file});
 report.screenshots.push({name,file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex'),expectedItemId:expected.item.id,expectedDiscussionId:expected.comment.id,geometry,viewport:page.viewportSize()});
}
try{
 await page.goto(base);await page.locator('.ws-nav').waitFor();manifest=await(await page.request.get(base+'/fixture/review02-config')).json();
 for(const name of ['Unrelated','PostRevert']){
  const expected=await open(name),before=await raw(),c=(await state()).comments.find(c=>c.id===expected.comment.id);
  assert.equal(c.section_change.highlight_status,'available');assert.equal(c.section_change.anchor.quote,'stream');assert.equal(c.section_change.status,'unavailable');
  await button('Open comment 1: stream').press('Enter');await button('Show passage for comment 1').click();
  assert.equal(await button('Revert changes: '+expected.comment.text).isDisabled(),true);
  const current=await state(),old=manifest.cases[name].earlier_preview;
  const response=await page.request.post(base+'/api/command',{data:{op:'revert_section',expected_scope:current.scope_id,payload:{...Object.fromEntries(['version_id','generation_id','change_id','dataset_epoch','content_hash','manual_revision'].map(k=>[k,old[k]])),confirmed:true,expected_revision:current.revision}}});
  assert.equal(response.status(),409);assert.deepEqual(await raw(),before);
  const highlights=await page.evaluate(()=>[...CSS.highlights.values()].flatMap(ranges=>[...ranges].map(r=>r.toString())));assert.ok(highlights.includes('stream'));
  for(const mode of ['light','dark'])for(const width of [1440,420]){await page.setViewportSize({width,height:900});await page.evaluate(mode=>window.issue9.theme(mode),mode);await capture(name.toLowerCase()+'-earlier-stream-'+mode+'-'+width,expected)}
  await fs.writeFile(out+'/logs/F009-'+name+'.json',JSON.stringify({before,reopened:await raw(),view:c,refusalStatus:response.status(),highlights},null,2));passed(name+' earlier effective stream marker/navigation, latest-only409 unchanged and both themes/widths');
 }
 const expected=await open('Effective'),before=await raw(),old=(await state()).comments.find(c=>c.id===expected.comment.id);
 await page.locator('.ws-reply-compose summary').first().click();const reply=page.getByRole('textbox',{name:'Reply to '+expected.comment.text,exact:true});await reply.fill('Review02 retained reply draft');
 await page.evaluate(()=>{const pane=document.querySelector('.ws-work');pane.scrollTop=120;const node=[...document.querySelector('.ws-editor').querySelectorAll('p')].find(p=>p.textContent.startsWith('Observation 4:')).firstChild;const r=document.createRange();r.setStart(node,0);r.setEnd(node,5);getSelection().removeAllRanges();getSelection().addRange(r)});
 const position=await page.evaluate(()=>({scroll:document.querySelector('.ws-work').scrollTop,selection:getSelection().toString()}));
 await button('Revert changes: '+expected.comment.text).click();await expect.poll(async()=>(await state()).comments.find(c=>c.id===expected.comment.id).section_change.status).toBe('reverted');
 await expect(button('Open comment 1: stream')).toHaveCount(1);assert.equal(await button('Revert changes: '+expected.comment.text).isDisabled(),true);
 assert.equal(await reply.inputValue(),'Review02 retained reply draft');await expect.poll(()=>page.evaluate(()=>getSelection().toString())).toBe(position.selection);await expect.poll(()=>page.evaluate(()=>document.querySelector('.ws-work').scrollTop)).toBe(position.scroll);
 const after=await raw(),now=(await state()).comments.find(c=>c.id===expected.comment.id);assert.deepEqual(now.replies,old.replies.slice(0,-1));assert.equal(now.section_change.anchor.quote,'stream');
 const archive=after.versions.find(v=>v.section_revert_of===old.section_change.change_id);assert.deepEqual(archive._removed_responses,[{comment_id:old.id,reply:old.replies.at(-1)}]);
 await fs.writeFile(out+'/logs/F009-Effective.json',JSON.stringify({before,after,now,position,archive},null,2));
 await button('Show passage for comment 1').click();await capture('effective-reverted-to-stream',expected);
 await page.reload();await page.locator('.ws-nav').waitFor();await open('Effective');await expect(button('Open comment 1: stream')).toHaveCount(1);passed('Latest-run revert restores stream geometry and earlier outcomes; exact archive, retained draft/Range/scroll and refresh');
 for(const name of ['Restore','Uncertain2','Detached','Superseded']){
  const selected=await open(name),c=(await state()).comments.find(c=>c.id===selected.comment.id);assert.equal(c.section_change.highlight_status,'unavailable');assert.equal(c.section_change.anchor,undefined);assert.equal(await button('Revert changes: '+selected.comment.text).isDisabled(),true);assert.equal(await page.getByRole('button',{name:/^Open comment 1:/}).count(),0);
  await capture('review02-corrected-'+name.toLowerCase()+'-detached-footer',selected,{footer:true});passed(name+' exact selected item and rendered discussion confirmed; detached footer captured');
 }
 const timeline=await open('Chronology'),timelineBefore=await raw();await button('Revert changes: '+timeline.comment.text).click();await expect.poll(async()=>(await state()).comments.find(c=>c.id===timeline.comment.id).section_change.status).toBe('reverted');const cleaned=await raw();
 await button('delete comment: '+timeline.comment.text).click();await page.getByRole('dialog',{name:'Delete comment?'}).getByRole('button',{name:'Delete comment',exact:true}).click();await expect.poll(async()=>(await state()).comments.some(c=>c.id===timeline.comment.id)).toBe(false);const deleted=await raw();
 const checkpoint=cleaned.versions.find(v=>v.section_revert_of&&v._removed_responses?.some(e=>e.comment_id===timeline.comment.id));assert.ok(checkpoint._removed_responses.length);assert.deepEqual(deleted.versions.find(v=>v.id===checkpoint.id),checkpoint);
 for(const [index,mode]of ['explicit','omitted'].entries()){
  const bad=await(await page.request.get(base+'/fixture/chronology-invalid/'+mode)).json(),s=await state(),restore_id=String(index+3).repeat(32);
  for(let retry=0;retry<2;retry++){const r=await page.request.post(base+'/api/restore-backup',{data:{data_base64:bad.data_base64,expected_scope:s.scope_id,expected_revision:s.revision,restore_id,include_state:false}});assert.equal(r.status(),400);assert.deepEqual(await raw(),deleted)}
 }
 await page.reload();await page.locator('.ws-nav').waitFor();assert.deepEqual(await raw(),deleted);await fs.writeFile(out+'/logs/F010-browser-timeline.json',JSON.stringify({before:timelineBefore,cleaned,deletedAfterCleanup:deleted,reopened:await raw(),checkpoint},null,2));passed('F010 real revert then delete preserves original full archive; correctly framed explicit/omitted empty restores and retries refused without writes; reopen');
 assert.deepEqual(report.errors,[]);
}catch(error){report.failure=String(error.stack??error);throw error}
finally{await fs.writeFile(out+'/logs/review02-browser.json',JSON.stringify(report,null,2));await context.close()}
console.log(JSON.stringify({review02Cases:report.cases.length,screenshots:report.screenshots.length,errors:report.errors}));
