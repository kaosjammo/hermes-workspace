/** Fresh original interaction matrix, then repair-specific real rendered cases. */
await import('./issue-9-browser.test.mjs');
const {default:fs}=await import('node:fs/promises');
const {createRequire}=await import('node:module');
const {default:path}=await import('node:path');
const {default:assert}=await import('node:assert/strict');
const {createHash}=await import('node:crypto');
const out=process.env.HWS_QUALIFICATION_HOME;
const require=createRequire(path.resolve('.local/host/.build/webapp-workspace/apps/desktop/package.json'));
const {chromium,expect}=require('@playwright/test');
const context=await chromium.launchPersistentContext(out+'/browsers/repair',{headless:true,chromiumSandbox:true,executablePath:process.env.HWS_CHROMIUM,viewport:{width:1440,height:900}});
const page=context.pages()[0];page.setDefaultTimeout(10000);
const base='http://127.0.0.1:'+(process.env.ISSUE9_PORT??'19579');
const report={cases:[],screenshots:[],errors:[],scope:'Synthetic transport/admission/native-shaped preparation; real production Store/API and pinned SDK controls/styles. Chromium emulated input; no installed Electron/IPC/provider or physical input proof.'};
page.on('pageerror',e=>report.errors.push(e.message));
const state=()=>page.evaluate(()=>window.issue9.rest('/state'));
const button=name=>page.getByRole('button',{name,exact:true});
const passed=(name,data={})=>report.cases.push({name,status:'PASS',...data});
async function settled(){await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));}
async function capture(name){await settled();const file=out+'/screenshots/'+name+'.png';await page.screenshot({path:file,fullPage:true});report.screenshots.push({name,path:file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')});}
async function open(name){await page.setViewportSize({width:1440,height:900});await page.locator('.ws-nav').getByRole('button',{name:name+' garden',exact:true}).first().click();await page.getByRole('checkbox',{name:'Resolve: North feedback '+name,exact:true}).waitFor();await settled();}
try{
 await page.goto(base);await page.locator('.ws-nav').waitFor();
 for(const name of ['Prefix','Suffix','RichPrefix','RichSuffix']){
  await open(name);const before=await state(),c=before.comments.find(c=>c.text==='North feedback '+name),south=before.comments.find(c=>c.text==='South feedback '+name);
  const rawBefore=await(await page.request.get(base+'/fixture/reopen')).json();
  const expected=c.replies.slice(2),keep=c.replies.slice(0,2);assert.equal(expected.length,2);
  await button('Revert changes: North feedback '+name).click();
  await expect.poll(async()=>(await state()).comments.find(x=>x.id===c.id).section_change.status).toBe('reverted');
  await page.reload();await page.locator('.ws-nav').waitFor();await open(name);
  const after=await state(),now=after.comments.find(x=>x.id===c.id),rawAfter=await(await page.request.get(base+'/fixture/reopen')).json();
  assert.deepEqual(now.replies,keep);assert.deepEqual({...now,section_change:null,anchor_status:null,replies:[]},{...c,section_change:null,anchor_status:null,replies:[]});
  assert.deepEqual(rawAfter.comments.find(x=>x.id===south.id),rawBefore.comments.find(x=>x.id===south.id));
  assert.equal(after.comments.find(x=>x.id===south.id).section_change.anchor.quote,'orchard');
  assert.ok(after.items.find(i=>i.id===c.item_id).content.includes('<p>North river.</p><p>South orchard.</p>'));
  const receipt=rawAfter.versions.find(v=>v.section_revert_of===c.section_change.change_id);
  assert.deepEqual(receipt.section_revert_receipt.removed_reply_ids,expected.map(r=>r.id));
  assert.deepEqual(receipt._removed_responses,expected.map(reply=>({comment_id:c.id,reply})));
  assert.equal(receipt.section_revert_receipt.cleanup_mode,'responses_archived');
  await fs.writeFile(out+'/logs/'+name+'-reopen-comparison.json',JSON.stringify({rawBefore,rawAfter,expectedRemoved:expected,publicBefore:before,publicAfter:after},null,2));
  for(const mode of ['light','dark']){await page.evaluate(mode=>window.issue9.theme(mode),mode);await capture(name.toLowerCase()+'-reopened-'+mode)}
  passed(name+' exact two-operation response IDs archived after SQLite reopen; human/unrelated/south/identities/numbers retained',{removedIds:expected.map(r=>r.id),checkpoint:receipt.id});
 }
 for(const name of ['Legacy','Missing','Imported']){
  if(name==='Imported'){await page.goto(base+'/?imported');await page.locator('.ws-nav').waitFor()}
  await open(name);const before=await state(),c=before.comments.find(c=>c.text==='North feedback '+name);
  assert.equal(c.section_change.status,'unavailable');assert.equal(c.section_change.highlight_status,'available');assert.equal(c.section_change.anchor.quote,'stream');
  const marker=button('Open comment 1: stream');await marker.waitFor();assert.equal(await marker.innerText(),'1');
  await marker.click();await button('Show passage for comment 1').click();
  const highlights=await page.evaluate(()=>[...CSS.highlights.entries()].flatMap(([name,ranges])=>[...ranges].map(r=>({name,text:r.toString(),width:r.getBoundingClientRect().width}))));
  assert.ok(highlights.some(h=>h.text==='stream'&&h.width>0));
  const control=button('Revert changes: North feedback '+name);assert.equal(await control.isDisabled(),true);
  await page.keyboard.press('Tab');await control.locator('..').focus();
  const reason=await control.locator('..').getAttribute('aria-label');assert.match(reason,/trusted|imported|historical|no outcome/i);
  assert.equal(await page.getByRole('heading',{name:'Detached passages',exact:true}).count(),0);
  for(const mode of ['light','dark'])for(const width of [1440,420]){
   await page.setViewportSize({width,height:900});await page.evaluate(mode=>window.issue9.theme(mode),mode);await capture(name.toLowerCase()+'-attached-'+mode+'-'+width);
   assert.equal(await marker.count(),1);assert.equal(await control.isDisabled(),true);
  }
  assert.deepEqual(await state(),before);passed(name+' exact attached marker, number and navigation while unavailable revert explains provenance',{reason,highlights});
 }
 await page.goto(base);await page.locator('.ws-nav').waitFor();
 for(const name of ['Uncertain','Superseded','Detached']){
  await open(name);const before=await state(),c=before.comments.find(c=>c.text==='North feedback '+name);
  assert.equal(c.section_change.highlight_status,'unavailable');assert.equal(c.section_change.anchor,undefined);
  assert.equal(await page.getByRole('button',{name:/^Open comment 1:/}).count(),0);
  await page.getByRole('heading',{name:'Detached passages',exact:true}).waitFor();assert.equal(await button('Revert changes: North feedback '+name).isDisabled(),true);
  await capture(name.toLowerCase()+'-detached');assert.deepEqual(await state(),before);passed(name+' stays detached with no stale quote marker or actionable revert');
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.failure=String(error.stack??error);await capture('repair-failed').catch(()=>{});throw error}
finally{await fs.writeFile(out+'/logs/review01-browser.json',JSON.stringify(report,null,2));await context.close()}
console.log(JSON.stringify({repairCases:report.cases.length,repairScreenshots:report.screenshots.length,errors:report.errors}));
