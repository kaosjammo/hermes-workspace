/** Actual SDK controls/styles + Workspace/API/SQLite; disclosed shared routing fixture. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out=process.env.HWS_QUALIFICATION_HOME,run=process.env.ISSUE10_RUN;
const require=createRequire(path.resolve('.local/host/.build/webapp-workspace/apps/desktop/package.json'));
const {chromium}=require('@playwright/test');
const receipt={scope:'Fresh full production Workspace, real pinned SDK UI/styles and production API/SQLite/SharedWorkspaces. Explicit synthetic shared routing, admitted selected-profile header, generated profiles/images/documents and native run preparation. No provider/installed Electron/shared activation/physical touch/OS IME proof.',cases:[],screenshots:[],errors:[]};
const context=await chromium.launchPersistentContext(out+'/browsers/'+run,{headless:true,chromiumSandbox:true,executablePath:process.env.HWS_CHROMIUM,viewport:{width:1440,height:900}});
const page=context.pages()[0];page.setDefaultTimeout(12000);page.on('pageerror',e=>receipt.errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
const pass=name=>receipt.cases.push({name,status:'PASS'});
const save=()=>fs.writeFile(out+'/logs/'+run+'.json',JSON.stringify(receipt,null,2));
const state=()=>page.evaluate(()=>window.issue10.rest('/state'));
async function settle(){await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));}
async function capture(name){await settle();const file=out+'/screenshots/'+run+'-'+name+'.png';await page.screenshot({path:file,fullPage:true});receipt.screenshots.push({name,path:file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')});}
async function openPage(name){await page.locator('.ws-nav').getByRole('button',{name,exact:true}).first().click();await page.locator('.ws-bubble-summary').first().waitFor();await settle();}
async function openThread(){await page.locator('.ws-bubble-summary').first().click();await page.locator('.ws-reply').first().waitFor();await settle();}
async function username(){await button('Workspace menu').click();await page.getByRole('menuitem',{name:'set username',exact:true}).click();await page.getByRole('dialog',{name:'Set username'}).waitFor();}
async function saveName(name){await username();await page.getByRole('textbox',{name:'Username',exact:true}).fill(name);await button('Save').click();await page.getByRole('dialog',{name:'Set username'}).waitFor({state:'hidden'});}
async function selectShared(profile){await page.evaluate(profile=>{window.issue10.switchProfile(profile);window.issue10.selectShared(true)},profile);await page.locator('.ws-nav').waitFor();await openPage('Shared garden notes');await openThread();}
async function disclosure(trigger,name,label){
 await trigger.scrollIntoViewIfNeeded();await trigger.focus();
 const scroll=await page.locator('.ws-work').evaluate(n=>n.scrollTop);
 await page.keyboard.press('Enter');await page.locator('.ws-author-details').waitFor();
 assert.equal(await page.locator('.ws-author-full-name').textContent(),name);
 assert.equal(await button('Close author name').evaluate(n=>n===document.activeElement),true);
 const rect=await page.locator('.ws-author-details').boundingBox(),viewport=page.viewportSize();
 assert.ok(rect.x>=0&&rect.x+rect.width<=viewport.width+1&&rect.y>=0&&rect.y+rect.height<=viewport.height+1,JSON.stringify(rect));
 await capture(label);await page.keyboard.press('Escape');await page.locator('.ws-author-details').waitFor({state:'hidden'});
 await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,'Show full author name: '+name);
 assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
 assert.equal(await page.locator('.ws-work').evaluate(n=>n.scrollTop),scroll);
}
try{
 await page.goto('http://127.0.0.1:19570');await page.locator('.ws-nav').waitFor();
 await selectShared('beta');
 const sharedBefore=await state();
 await username();const savedName=await page.getByRole('textbox',{name:'Username'}).inputValue();
 if(process.env.ISSUE10_RESTART==='1'){
  assert.ok(savedName.startsWith('Bob 東京'));await capture('shared-name-after-process-restart');await button('Save').click();await page.getByRole('dialog',{name:'Set username'}).waitFor({state:'hidden'});
  assert.equal((await state()).identity.human.name,savedName);pass('F002 shared form and unchanged save retain Bob preference after actual server process restart');
 }else{
  assert.ok(savedName.startsWith('Bob 東京'));await button('Save').click();await page.getByRole('dialog',{name:'Set username'}).waitFor({state:'hidden'});
  assert.equal((await state()).identity.human.name,savedName);
  await username();assert.equal(await page.getByRole('textbox',{name:'Username'}).inputValue(),savedName);await button('Cancel').click();
  await page.reload();await page.locator('.ws-nav').waitFor();await selectShared('beta');await username();
  assert.equal(await page.getByRole('textbox',{name:'Username'}).inputValue(),savedName);await button('Save').click();await page.getByRole('dialog',{name:'Set username'}).waitFor({state:'hidden'});
  pass('F002 production shared form initializes saved Bob preference on mutation/reopen/reload and unchanged save preserves it');
  const humanName='Bob 東京 '+ '庭🌿'.repeat(30);await saveName(humanName);
  const after=await state();assert.equal(after.identity.human.name,humanName);
  assert.equal(after.comments[0].author_identity.name,'Alice Ω');assert.equal(after.comments[0].replies[0].author_identity.name,humanName);
  assert.deepEqual(after.comments.map(c=>[c.id,c.text,c.resolved,c.replies.map(r=>[r.id,r.text])]),sharedBefore.comments.map(c=>[c.id,c.text,c.resolved,c.replies.map(r=>[r.id,r.text])]));
  await selectShared('alpha');assert.equal((await state()).identity.human.name,'Alice Ω');
  pass('F002 Alice/Bob IDs and names remain independent, including Bob replies on Alice thread');
  const humanTrigger=button('Show full author name: '+humanName);
  await page.locator('.ws-reply-compose summary').click();const draft=page.locator('.ws-reply-compose textarea');await draft.fill('Retain this unsent reply during name disclosure.');
  for(const theme of ['light','dark'])for(const width of [1440,420]){
   await page.setViewportSize({width,height:900});await page.evaluate(theme=>window.issue10.theme(theme),theme);await settle();
   await disclosure(humanTrigger,humanName,'human-'+width+'-'+theme);
   assert.equal(await draft.inputValue(),'Retain this unsent reply during name disclosure.');
   assert.equal(await page.locator('button button').count(),0);
   assert.ok((await page.locator('.ws-bubble-summary').allTextContents()).some(t=>t.includes('Comment 1')));
  }
  pass('F005 full long human reply name is keyboard-visible in both themes/widths, closes to trigger and preserves reply draft/scroll/numbering');
  // Native DOM selection is deliberately synthetic instrumentation, not a
  // physical selection/touch claim. Real pointer activation exercises disclosure.
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>window.issue10.theme('light'));
  await humanTrigger.scrollIntoViewIfNeeded();
  const pointerScroll=await page.locator('.ws-work').evaluate(n=>n.scrollTop);
  const selection=await page.locator('.ws-editor').evaluate(editor=>{const node=[...editor.querySelectorAll('p')][0].firstChild;const r=document.createRange();r.setStart(node,0);r.setEnd(node,5);const s=getSelection();s.removeAllRanges();s.addRange(r);return s.toString()});
  await humanTrigger.click();await page.locator('.ws-author-details').waitFor();assert.equal(await page.evaluate(()=>getSelection().toString()),selection);
  await button('Close author name').click();await page.locator('.ws-author-details').waitFor({state:'hidden'});
  await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,'Show full author name: '+humanName);
  assert.equal(await humanTrigger.evaluate(n=>n===document.activeElement),true);
  assert.equal(await page.evaluate(()=>getSelection().toString()),selection);
  assert.equal(await page.locator('.ws-work').evaluate(n=>n.scrollTop),pointerScroll);pass('F005 pointer open/close preserves selected reader text and returns focus');
  await page.evaluate(()=>{window.issue10.selectShared(false);window.issue10.switchProfile('alpha')});await page.locator('.ws-nav').waitFor();await openPage('River garden notes');await openThread();
  const longName=await page.evaluate(()=>window.issue10.config.long_agent_name);
  const row=page.locator('.ws-reply').filter({hasText:'Long native recorded response'});
  assert.equal(await row.locator('.ws-author-name').textContent(),longName);
  await page.waitForFunction(()=>[...document.querySelectorAll('.ws-reply')].find(n=>n.textContent.includes('Long native recorded response'))?.querySelector('img')?.naturalWidth===32);
  const nativeBefore=await state(),reply=nativeBefore.comments[0].replies.find(r=>r.text==='Long native recorded response');
  assert.ok(reply.author_identity.avatar_eligible);assert.ok(longName.includes('👩‍💻')&&longName.length>80);
  for(const theme of ['light','dark'])for(const width of [1440,420]){
   await page.setViewportSize({width,height:900});await page.evaluate(theme=>window.issue10.theme(theme),theme);await settle();
   await disclosure(row.getByRole('button',{name:'Show full author name: '+longName,exact:true}),longName,'agent-'+width+'-'+theme);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  pass('F003/F005 internally captured long ZWJ native name keeps its avatar and complete accessible disclosure in both themes/widths');
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>window.issue10.switchProfile('beta'));await page.locator('.ws-nav').waitFor();await openPage('River garden notes');await openThread();
  assert.ok((await page.locator('.ws-reply .ws-author-name').allTextContents()).includes('Birch 東京'));
  await page.evaluate(()=>window.issue10.switchProfile('alpha'));await page.locator('.ws-nav').waitFor();await openPage('River garden notes');await openThread();
  assert.deepEqual((await state()).comments[0].replies.find(r=>r.id===reply.id),reply);pass('F003 historic long executor identity survives profile/source switch without relabel');
  for(const mode of ['missing','oversize','unsafe','broken']){
   await page.request.post('http://127.0.0.1:19570/fixture/image-mode/'+mode);
   const response=page.waitForResponse(r=>r.url().includes('/fixture/avatar/alpha'));
   await page.evaluate(()=>window.issue10.advanceEpoch());await page.locator('.ws-nav').waitFor();await openPage('River garden notes');await openThread();await response;
   await page.waitForFunction(()=>!document.querySelector('.ws-reply img')&&!document.querySelector('.ws-reply [data-avatar-state=loading]'));
   assert.ok((await page.locator('.ws-reply .ws-author-name').allTextContents()).includes(longName));
   assert.ok((await page.locator('.ws-reply .ws-author-name').allTextContents()).includes('Hermes'));
  }
  await capture('native-image-and-legacy-fallback');pass('F003 bounded/missing/failed raster fallback preserves long known identity and honest legacy Hermes');
  await page.request.post('http://127.0.0.1:19570/fixture/image-mode/normal');
  await username();await page.getByRole('textbox',{name:'Username'}).fill('Fail once');await button('Save').click();
  await page.getByRole('alert').filter({hasText:'Synthetic save unavailable'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Username'}).inputValue(),'Fail once');await button('Cancel').click();
  await selectShared('beta');await username();assert.equal(await page.getByRole('textbox',{name:'Username'}).inputValue(),humanName);await button('Cancel').click();
  pass('shared preference and draft recover after a failed private save and owner/workspace switch');
 }
 assert.deepEqual(receipt.errors,[]);await save();console.log(JSON.stringify({cases:receipt.cases.length,screenshots:receipt.screenshots.length,errors:receipt.errors}));
}catch(error){receipt.failure=error.stack;await capture('FAILED').catch(()=>{});await save();throw error;}
finally{await context.close();}
