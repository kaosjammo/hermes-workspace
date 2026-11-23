/** Run separately: sandboxed Chromium, actual SDK UI/production API+Store. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out=process.env.HWS_QUALIFICATION_HOME,run=process.env.ISSUE10_RUN??'browser-main';
if(!out||!process.env.HWS_CHROMIUM)throw Error('Task-owned output and read-only pinned browser required');
const require=createRequire(path.resolve('.local/host/.build/webapp-workspace/apps/desktop/package.json'));
const {chromium}=require('@playwright/test');
const receipt={scope:'Full production Workspace -> production authenticated router/Store, real pinned SDK UI controls/styles and public avatar handler. Synthetic host admission/profile atoms/transport and generated data. Sandbox enabled. No Electron/provider/native touch/OS IME acceptance.',cases:[],screenshots:[],errors:[]};
const context=await chromium.launchPersistentContext(out+'/browsers/'+run,{headless:true,chromiumSandbox:true,executablePath:process.env.HWS_CHROMIUM,viewport:{width:1440,height:900}});
const page=context.pages()[0];page.setDefaultTimeout(10000);
page.on('pageerror',e=>receipt.errors.push(e.message));
const save=()=>fs.writeFile(out+'/logs/'+run+'.json',JSON.stringify(receipt,null,2));
const button=name=>page.getByRole('button',{name,exact:true});
const passed=name=>receipt.cases.push({name,status:'PASS'});
const state=()=>page.evaluate(()=>window.issue10.rest('/state'));
async function settled(){await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));}
async function capture(name){await settled();const file=out+'/screenshots/'+run+'-'+name+'.png';await page.screenshot({path:file,fullPage:true});receipt.screenshots.push({name,path:file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')});}
async function openPage(){await page.locator('.ws-nav').getByRole('button',{name:'River garden notes',exact:true}).first().click();await page.locator('.ws-bubble-summary').first().waitFor();await settled();}
async function openThread(){await page.locator('.ws-bubble-summary').first().click();await page.locator('.ws-reply').first().waitFor();}
async function username(){await button('Workspace menu').click();await page.getByRole('menuitem',{name:'set username',exact:true}).click();await page.getByRole('dialog',{name:'Set username'}).waitFor();}
async function saveName(name){await username();await page.getByRole('textbox',{name:'Username',exact:true}).fill(name);await page.getByRole('textbox',{name:'Username',exact:true}).press('Enter');await page.getByRole('dialog',{name:'Set username'}).waitFor({state:'hidden'});}
try{
 await page.goto('http://127.0.0.1:19570');await page.locator('.ws-nav').waitFor();await openPage();await openThread();
 let before=await state();
 if(process.env.ISSUE10_RESTART!=='1' && before.identity.human.name!=='user'){
  await saveName('');before=await state();
 }
 if(process.env.ISSUE10_RESTART==='1'){
  assert.equal(before.identity.human.name,'Restart retained 庭');
  assert.ok((await page.locator('.ws-author-name').allTextContents()).includes('Restart retained 庭'));
  passed('actual server process restart retains owner username and immutable author records');
  await capture('restart-retained');
  for(const width of [1440,420]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>window.issue10.theme('dark'));await username();
   await page.getByRole('textbox',{name:'Username'}).focus();await page.keyboard.press('Tab');
   assert.equal(await page.getByRole('dialog',{name:'Set username'}).evaluate(n=>n.contains(document.activeElement)),true);
   await capture('username-form-'+width+'-dark');await button('Cancel').click();
  }
  passed('compact native username dialog fits wide/narrow, retains focus and cancellation after process restart');
 }else{
  assert.equal(before.identity.human.name,'user');
  await page.waitForFunction(()=>[...document.querySelectorAll('.ws-reply img')].some(i=>i.complete&&i.naturalWidth===32));
  assert.ok((await page.locator('.ws-reply .ws-author-name').allTextContents()).includes('Aster Ω'));
  assert.ok((await page.locator('.ws-reply .ws-author-name').allTextContents()).includes('Hermes'));
  passed('default user, captured native agent name/avatar and honest legacy Hermes fallback');await capture('wide-light');
  await username();await page.getByRole('textbox',{name:'Username'}).fill('Cancelled rename');await button('Cancel').click();
  assert.equal((await state()).identity.human.name,'user');
  assert.equal(await button('Workspace menu').evaluate(n=>n===document.activeElement),true);
  passed('cancel does not mutate and returns keyboard focus to Workspace menu');
  await username();await page.getByRole('textbox',{name:'Username'}).fill('x'.repeat(81));await button('Save').click();
  await page.getByRole('alert').filter({hasText:'80 characters'}).waitFor();assert.equal((await state()).identity.human.name,'user');await button('Cancel').click();
  passed('server validation retains invalid draft and leaves saved identity unchanged');
  await saveName('庭 🌿 <b>literal</b>');
  const renamed=await state();
  const owned=renamed.comments.filter(c=>c.author_identity?.id===renamed.identity.human.id);
  assert.ok(owned.every(c=>c.author_identity.name==='庭 🌿 <b>literal</b>'));
  assert.equal(renamed.comments.find(c=>c.text.includes('another participant')).author_identity.name,'Other participant');
  assert.equal(await page.locator('.ws-author-name b').count(),0);
  assert.ok((await page.locator('.ws-reply .ws-author-name').allTextContents()).includes('庭 🌿 <b>literal</b>'));
  passed('save renames all known own comments/replies as text and isolates other participant');
  await username();assert.equal(await page.getByRole('textbox',{name:'Username'}).inputValue(),'庭 🌿 <b>literal</b>');
  await page.getByRole('textbox',{name:'Username'}).fill('Fail once');await button('Save').click();
  await page.getByRole('alert').filter({hasText:'Synthetic save unavailable'}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Username'}).inputValue(),'Fail once');
  await button('Save').click();await page.getByRole('dialog',{name:'Set username'}).waitFor({state:'hidden'});
  passed('failed save keeps the editable draft and recovers through explicit retry');
  await username();await page.getByRole('textbox',{name:'Username'}).fill('Slow save');
  const commandBefore=(await fs.readFile(out+'/logs/browser-api.jsonl','utf8')).split('\n').filter(Boolean).length;
  await button('Save').click();await button('Saving…').waitFor();assert.equal(await button('Cancel').isDisabled(),true);
  await page.keyboard.press('Enter');await page.keyboard.press('Escape');
  await page.getByRole('dialog',{name:'Set username'}).waitFor({state:'hidden'});
  const commands=(await fs.readFile(out+'/logs/browser-api.jsonl','utf8')).trim().split('\n').map(JSON.parse).slice(commandBefore);
  assert.equal(commands.filter(c=>c.op==='set_username').length,1);
  passed('pending save disables cancellation and deduplicates keyboard submits');
  await username();await button('Reset to user').click();await page.getByRole('dialog',{name:'Set username'}).waitFor({state:'hidden'});assert.equal((await state()).identity.human.name,'user');
  await saveName('');assert.equal((await state()).identity.human.name,'user');passed('reset and blank save return exact user fallback');
  const longName='庭🌿'.repeat(35);await saveName(longName);
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>window.issue10.theme(theme),theme);
   for(const width of [1440,420]){
    await page.setViewportSize({width,height:900});await settled();
    const geometry=await page.locator('.ws-author').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,width:window.innerWidth})));
    assert.ok(geometry.every(r=>r.left>=0&&r.right<=r.width+1),JSON.stringify(geometry));
    assert.ok((await page.locator('.ws-bubble-summary').allTextContents()).some(t=>t.includes('Comment 1')));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await capture(width+'-'+theme+'-long-unicode');
   }
  }
  passed('compact native headers and passage numbers fit wide/narrow Nous light/dark with long Unicode names');
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>window.issue10.theme('light'));
  const alpha=await state(),alphaAuthor=alpha.comments[0].replies.find(r=>r.author_identity?.kind==='agent');
  await page.evaluate(()=>window.issue10.switchProfile('beta'));await page.locator('.ws-nav').waitFor();await openPage();await openThread();
  await page.waitForFunction(()=>[...document.querySelectorAll('.ws-reply img')].some(i=>i.naturalWidth===32));
  assert.ok((await page.locator('.ws-reply .ws-author-name').allTextContents()).includes('Birch 東京'));
  assert.equal((await state()).identity.human.name,'user');
  const betaAvatar=await page.locator('.ws-reply img').first().getAttribute('src');
  await page.evaluate(()=>window.issue10.switchProfile('alpha'));await page.locator('.ws-nav').waitFor();await openPage();await openThread();
  await page.waitForFunction(()=>[...document.querySelectorAll('.ws-reply img')].some(i=>i.naturalWidth===32));
  assert.deepEqual((await state()).comments[0].replies.find(r=>r.id===alphaAuthor.id),alphaAuthor);
  assert.notEqual(await page.locator('.ws-reply img').first().getAttribute('src'),betaAvatar);
  passed('different executing profiles retain distinct names/images and historic alpha attribution survives owner/epoch switches');
  for(const mode of ['missing','oversize','unsafe','broken']){
   await page.request.post('http://127.0.0.1:19570/fixture/image-mode/'+mode);
   const response=page.waitForResponse(r=>r.url().includes('/fixture/avatar/alpha'));
   await page.evaluate(()=>window.issue10.advanceEpoch());await page.locator('.ws-nav').waitFor();await openPage();await openThread();
   await response;
   await page.waitForFunction(()=>!document.querySelector('.ws-reply img') && !document.querySelector('.ws-reply [data-avatar-state=loading]'));
   assert.ok((await page.locator('.ws-reply .ws-author-name').allTextContents()).includes('Aster Ω'));
  }
  await capture('image-failure-fallback');passed('missing/oversized/unsafe/failed-decode native images retain neutral initials and recorded names');
  await page.request.post('http://127.0.0.1:19570/fixture/image-mode/normal');
  await saveName('Restart retained 庭');await page.reload();await page.locator('.ws-nav').waitFor();await openPage();await openThread();
  assert.equal((await state()).identity.human.name,'Restart retained 庭');
  const after=await state();
  assert.deepEqual(after.comments.map(c=>[c.id,c.text,c.anchor,c.resolved,c.replies.map(r=>[r.id,r.text,r.author])]),before.comments.map(c=>[c.id,c.text,c.anchor,c.resolved,c.replies.map(r=>[r.id,r.text,r.author])]));
  passed('reload preserves username, immutable discussion IDs/text/anchors/resolution/replies');
  await capture('reload-retained');
 }
 assert.deepEqual(receipt.errors,[]);await save();console.log(JSON.stringify({cases:receipt.cases.length,screenshots:receipt.screenshots.length,errors:receipt.errors}));
}catch(error){receipt.failure=error.stack;await capture('FAILED').catch(()=>{});await save();throw error;}
finally{await context.close();}
