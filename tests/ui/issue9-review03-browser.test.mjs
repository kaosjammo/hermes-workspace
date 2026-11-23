/** Existing31 interactions retained; F012 uses unchanged native production UI. */
await import('./issue9-review02-browser.test.mjs');
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('.local/host/.build/webapp-workspace/apps/desktop/package.json'));
const {chromium,expect}=require('@playwright/test'),out=process.env.HWS_QUALIFICATION_HOME,base='http://127.0.0.1:'+(process.env.ISSUE9_PORT??'19579');
const context=await chromium.launchPersistentContext(out+'/browsers/review03',{headless:true,chromiumSandbox:true,executablePath:process.env.HWS_CHROMIUM,viewport:{width:1440,height:900}});
const page=context.pages()[0];page.setDefaultTimeout(10000);
const report={cases:[],screenshots:[],errors:[],scope:'Real SDK controls/styles and production Workspace/API/Store/SQLite. Synthetic admission/transport/profile atoms/data/native preparation. Emulated touch and instrumented Range; no installed Electron/IPC/provider/physical-input/OS IME proof.'};page.on('pageerror',e=>report.errors.push(e.message));
const state=p=>p.evaluate(()=>window.issue9.rest('/state'));
const raw=async p=>await(await p.request.get(base+'/fixture/reopen')).json();
const control=(p,c)=>p.getByRole('button',{name:'Revert changes: North feedback '+c.name,exact:true});
async function open(p,c,touch=false){
 if(!touch)await p.setViewportSize({width:1440,height:900});
 const nav=p.locator('.ws-nav').getByRole('button',{name:'NoEffect '+c.name,exact:true}).first();
 if(touch)await nav.tap();else await nav.click();
 await expect(p.getByRole('textbox',{name:'Page title',exact:true})).toHaveValue('NoEffect '+c.name);
 await expect(p.locator('#ws-format-'+c.item_id)).toHaveCount(1);
 await expect.poll(async()=>(await state(p)).recents[0]?.item_id).toBe(c.item_id);
 const summary=p.locator('#ws-bubble-'+c.comment_id);await expect(summary).toHaveAttribute('aria-label',new RegExp('North feedback '+c.name));
 if(await summary.getAttribute('aria-expanded')!=='true'){if(touch)await summary.tap();else await summary.click()}
 await expect(p.locator('#ws-discussion-'+c.comment_id)).toHaveAttribute('aria-label','North feedback '+c.name);
}
async function capture(p,name,c){
 await expect(p.getByRole('textbox',{name:'Page title',exact:true})).toHaveValue('NoEffect '+c.name);await expect(p.locator('#ws-format-'+c.item_id)).toHaveCount(1);
 await expect(p.locator('#ws-discussion-'+c.comment_id)).toHaveAttribute('aria-label','North feedback '+c.name);
 await p.evaluate(()=>document.fonts.ready);await p.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));
 const geometry=await p.evaluate(async id=>{let prior='',stable=0;for(let i=0;i<300;i++){await new Promise(requestAnimationFrame);const pane=document.querySelector('.ws-work'),d=document.getElementById('ws-discussion-'+id),r=d.getBoundingClientRect(),now=JSON.stringify([pane.scrollTop,r.x,r.y,r.width,r.height].map(n=>Math.round(n*10)/10));stable=now===prior?stable+1:0;prior=now;if(stable>=8)return{discussionId:d.id,discussionText:d.innerText,discussionLabel:d.getAttribute('aria-label'),pageTitle:document.querySelector('[aria-label="Page title"]').value,scroll:pane.scrollTop,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}}throw Error('No-effect discussion geometry failed to settle')},c.comment_id);
 assert.equal(geometry.discussionLabel,'North feedback '+c.name);assert.equal(geometry.pageTitle,'NoEffect '+c.name);
 const file=out+'/screenshots/'+name+'.png';await p.screenshot({path:file});report.screenshots.push({name,file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex'),expectedItemId:c.item_id,expectedDiscussionId:c.comment_id,geometry,viewport:p.viewportSize()});
}
try{
 await page.goto(base);await page.locator('.ws-nav').waitFor();const cases=await(await page.request.get(base+'/fixture/review03-config')).json();
 for(const c of cases){
  await open(page,c);const initial=await raw(page),comment=(await state(page)).comments.find(x=>x.id===c.comment_id);
  assert.equal(initial.items.find(i=>i.id===c.item_id).content,c.expected_content);assert.equal(comment.section_change.highlight_basis,'no_effect');assert.equal(comment.section_change.highlight_status,'available');assert.equal(comment.section_change.status,'unavailable');assert.deepEqual(comment.anchor,c.source_anchor);assert.equal(comment.replies.length,4);assert.equal(comment.resolved,false);
  const marker=page.getByRole('button',{name:'Open comment 1: North river.',exact:true});await expect(marker).toHaveCount(1);assert.equal(await marker.innerText(),'1');await marker.press('Enter');await page.getByRole('button',{name:'Show passage for comment 1',exact:true}).click();
  const highlights=await page.evaluate(()=>[...CSS.highlights.values()].flatMap(h=>[...h].map(r=>r.toString())));assert.ok(highlights.includes('North river.'));assert.equal(await control(page,c).isDisabled(),true);
  await page.keyboard.press('Tab');await control(page,c).locator('..').focus();assert.match(await control(page,c).locator('..').getAttribute('aria-label'),/passage unchanged.*no eligible/i);
  let reply,position;
  if(c.name==='plain'){
   await page.locator('.ws-reply-compose summary').first().click();reply=page.getByRole('textbox',{name:'Reply to North feedback plain',exact:true});await reply.fill('Retained no-effect reply draft');
   const editor=page.locator('.ws-editor[contenteditable="true"]').first();await editor.press('Control+End');await editor.press('Enter');await editor.pressSequentially('Retained no-effect document draft outside passage.');
   await expect.poll(async()=>(await state(page)).items.find(i=>i.id===c.item_id).content).toContain('Retained no-effect document draft outside passage.');
   await page.evaluate(()=>{const n=[...document.querySelector('.ws-editor').querySelectorAll('p')].find(p=>p.textContent.startsWith('South')).firstChild,r=document.createRange();r.setStart(n,0);r.setEnd(n,5);getSelection().removeAllRanges();getSelection().addRange(r)});
   position=await page.evaluate(()=>({scroll:document.querySelector('.ws-work').scrollTop,selection:getSelection().toString()}));
  }
  const before=await raw(page),publicBefore=await state(page);
  for(let retry=0;retry<2;retry++){
   const r=await page.request.post(base+'/api/command',{data:{op:'revert_section',expected_scope:publicBefore.scope_id,payload:{...c.cleanup_attempt,confirmed:true,expected_revision:publicBefore.revision}}});assert.equal(r.status(),409);assert.match(await r.text(),/superseded/);assert.deepEqual(await raw(page),before);assert.deepEqual(await state(page),publicBefore);
  }
  if(reply){assert.equal(await reply.inputValue(),'Retained no-effect reply draft');assert.deepEqual(await page.evaluate(()=>({scroll:document.querySelector('.ws-work').scrollTop,selection:getSelection().toString()})),position)}
  const after=await raw(page);assert.deepEqual(after,before);
  for(const mode of ['light','dark'])for(const width of [1440,420]){await page.setViewportSize({width,height:900});await page.evaluate(mode=>window.issue9.theme(mode),mode);await capture(page,'no-effect-'+c.name+'-'+mode+'-'+width,c);assert.equal(await marker.count(),1);assert.equal(await control(page,c).isDisabled(),true)}
  await page.reload();await page.locator('.ws-nav').waitFor();await open(page,c);await expect(page.getByRole('button',{name:'Open comment 1: North river.',exact:true})).toHaveCount(1);
  const reopened=await raw(page);assert.deepEqual(reopened.comments.find(x=>x.id===c.comment_id),before.comments.find(x=>x.id===c.comment_id));
  await fs.writeFile(out+'/logs/F012-'+c.name+'-comparison.json',JSON.stringify({initial,before,after,reopened,publicBefore,highlights,position,sourceAnchor:c.source_anchor,cleanupAttempt:c.cleanup_attempt},null,2));
  report.cases.push({name:c.name+' exact no-effect passage attached/numbered, native navigation/highlight, disabled reason,409 retry no mutation and reopen',status:'PASS'});
 }
 const touch=await context.browser().newContext({hasTouch:true,isMobile:true,viewport:{width:420,height:900}});
 try{
  const mobile=await touch.newPage();await mobile.goto(base);const toggle=mobile.getByRole('button',{name:/^Pages ·/});await toggle.waitFor();await toggle.tap();const c=cases[0];await open(mobile,c,true);
  await mobile.getByRole('button',{name:'Open comment 1: North river.',exact:true}).tap();await mobile.getByRole('button',{name:'Show passage for comment 1',exact:true}).tap();assert.equal(await control(mobile,c).isDisabled(),true);
  for(const mode of ['light','dark']){await mobile.evaluate(mode=>window.issue9.theme(mode),mode);await capture(mobile,'no-effect-touch-'+mode,c)}
  report.cases.push({name:'Emulated touch reaches original no-effect passage and disabled revert reason without losing feedback',status:'PASS'});
 }finally{await touch.close()}
 assert.deepEqual(report.errors,[]);
}catch(error){report.failure=String(error.stack??error);throw error}
finally{await fs.writeFile(out+'/logs/review03-browser.json',JSON.stringify(report,null,2));await context.close()}
console.log(JSON.stringify({review03Cases:report.cases.length,screenshots:report.screenshots.length,errors:report.errors}));
