// Run only after the isolated issue-4-server.py and browser build. Native/provider acceptance is separate.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const out=process.env.ISSUE4_OUT,run=process.env.ISSUE4_RUN??'browser-1',physical=process.env.ISSUE4_PHYSICAL_OUT??out;
if(!out||!process.env.TMPDIR?.startsWith(out))throw Error('Task-owned output/scratch required');
if(!process.env.ISSUE4_PLAYWRIGHT||!process.env.ISSUE4_CHROMIUM)throw Error('Read-only ISSUE4_PLAYWRIGHT package.json and ISSUE4_CHROMIUM executable required');
const require=createRequire(process.env.ISSUE4_PLAYWRIGHT);
const {chromium}=require('playwright');
const receipt={scope:'Production Database and Store; real pinned host component exports/compiled styling; synthetic local HTTP adapter/dataset shell. Not installed native host or provider/OS IME/touch evidence.',cases:[],screenshots:[],errors:[]};
const save=()=>fs.writeFile(out+'/logs/'+run+'.json',JSON.stringify(receipt,null,2));
const context=await chromium.launchPersistentContext(out+'/scratch/'+run,{headless:true,executablePath:process.env.ISSUE4_CHROMIUM,viewport:{width:1280,height:800},args:['--no-sandbox']});
const page=context.pages()[0];page.setDefaultTimeout(8000);
page.on('pageerror',error=>receipt.errors.push(error.message));
const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
const title=()=>page.getByRole('textbox',{name:'New record title',exact:true});
const dataset=async name=>{await page.goto('http://127.0.0.1:'+ (process.env.ISSUE4_PORT??'19564'));await page.getByRole('heading',{name:'Field observations',exact:true}).waitFor();await page.getByLabel('Fixture dataset').selectOption({label:name});await page.getByRole('heading',{name,exact:true}).waitFor();};
const choose=async(name,value,scope=page)=>{await scope.getByRole('combobox',{name,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();};
const shot=async name=>{await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().map(a=>a.finished));});const file=out+'/screenshots/'+run+'-'+name+'.png';await page.screenshot({path:file,fullPage:false});receipt.screenshots.push({name,path:physical+'/screenshots/'+run+'-'+name+'.png',sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')});await save();};
const check=async(name,fn)=>{try{await fn();receipt.cases.push({name,result:'PASS'});}catch(error){receipt.cases.push({name,result:'FAIL',message:error.message});await shot(name+'-failure');}await save();};
try {
  await check('empty-inline-keyboard',async()=>{
    await dataset('Empty observations');const add=button('Add property');assert.match(await add.innerText(),/Add property/);
    assert.equal(await page.locator('thead .ws-db-add-property').count(),1);assert.equal(await page.locator('.ws-db-new-record').count(),1);
    await shot('empty-light');await button('New record').focus();await page.keyboard.press('Enter');await title().fill('Keyboard empty record');
    assert.equal(await page.locator('label.ws-db-draft-label').innerText(),'New record');await page.keyboard.press('Enter');
    await button('Keyboard empty record').waitFor();await page.getByText('Created “Keyboard empty record”.',{exact:true}).waitFor();await shot('empty-created');
    await page.keyboard.press('Escape');await button('New record').waitFor();assert.equal(await button('New record').evaluate(e=>e===document.activeElement),true);
  });
  await check('normal-density-and-property-enter',async()=>{
    await dataset('Field observations');const row=page.locator('tbody tr').first();const box=await row.boundingBox();assert.ok(box.height<=50,'Retain compact row density');receipt.rowHeight=box.height;
    await page.locator('thead .ws-db-add-property').scrollIntoViewIfNeeded();await shot('normal-light-header');await button('Add property').click();
    const form=page.getByRole('form',{name:'New property',exact:true});await form.getByRole('textbox',{name:'Property name',exact:true}).fill('Field remarks');await page.keyboard.press('Enter');
    await page.getByText('Field remarks',{exact:true}).first().waitFor();assert.equal(await page.getByRole('form',{name:'New property',exact:true}).count(),0);await shot('property-created');
  });
  await check('failed-record-retry-and-duplicate-pending',async()=>{
    await dataset('Field observations');await button('New record').click();await title().fill('Fail once record');await button('Create record').click();
    await page.getByRole('alert').filter({hasText:'Synthetic save unavailable'}).waitFor();assert.equal(await title().inputValue(),'Fail once record');await shot('record-failed-retained');
    await button('Create record').click();await button('Fail once record').waitFor();await title().fill('Delayed record');
    let requests=0;const count=req=>{if(req.url().endsWith('/command')&&req.postData()?.includes('Delayed record'))requests++;};page.on('request',count);
    await title().evaluate(e=>{e.form.requestSubmit();e.form.requestSubmit();e.form.requestSubmit();});
    await page.locator('.ws-db-record-draft[aria-busy=true]').waitFor();assert.equal(await title().isDisabled(),true);await button('Delayed record').waitFor();page.off('request',count);assert.equal(requests,1);
    await page.keyboard.press('Escape');
  });
  await check('property-failure-validation-ime-and-escape',async()=>{
    await dataset('Field observations');await button('Add property').click();let form=page.getByRole('form',{name:'New property',exact:true});const name=form.getByRole('textbox',{name:'Property name',exact:true});
    await name.fill('Fail once property');await button('Add property',form).click();await form.getByRole('alert').waitFor();assert.equal(await name.inputValue(),'Fail once property');await shot('property-failed-retained');
    await button('Add property',form).click();await form.waitFor({state:'hidden'});await button('Add property').click();form=page.getByRole('form',{name:'New property',exact:true});
    const field=form.getByRole('textbox',{name:'Property name',exact:true});await field.fill('IME draft');
    await field.evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true}));e.form.requestSubmit();});
    assert.equal(await field.inputValue(),'IME draft');assert.equal(await form.count(),1);
    await field.evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await page.keyboard.press('Escape');await form.waitFor({state:'hidden'});
    await button('Add property').click();form=page.getByRole('form',{name:'New property',exact:true});await form.getByRole('textbox',{name:'Property name',exact:true}).fill('Delayed property');
    let requests=0;const count=req=>{if(req.url().endsWith('/command')&&req.postData()?.includes('Delayed property'))requests++;};page.on('request',count);
    await form.evaluate(e=>{e.requestSubmit();e.requestSubmit();});await page.locator('form[aria-label="New property"][aria-busy=true]').waitFor();await page.keyboard.press('Escape');assert.equal(await form.count(),1);await form.waitFor({state:'hidden'});page.off('request',count);assert.equal(requests,1);
    await button('Add property').click();form=page.getByRole('form',{name:'New property',exact:true});await form.getByRole('textbox',{name:'Property name',exact:true}).fill('Count');await button('Add property',form).click();await form.getByRole('alert').waitFor();await shot('property-validation');await button('Cancel',form).click();
  });
  await check('filtered-hidden-save-and-ime',async()=>{
    await dataset('Field observations');await page.getByRole('textbox',{name:'Filter records',exact:true}).fill('ZZ-no-match');await page.getByText('No records match this filter.').waitFor();
    await button('New record').click();await title().fill('Filtered new record');await page.keyboard.press('Enter');await page.getByText('Created “Filtered new record”. It is hidden by the current filter.',{exact:true}).waitFor();await shot('filtered-created');
    await title().fill('入力保持');await title().evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true}));e.form.requestSubmit();});assert.equal(await title().inputValue(),'入力保持');
    await title().evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await page.keyboard.press('Escape');await button('New record').waitFor();
  });
  await check('long-table-and-horizontal-draft',async()=>{
    await dataset('Long observations');await button('New record').scrollIntoViewIfNeeded();await button('New record').click();await title().fill('Long table new record');
    await page.locator('.ws-table-wrap').evaluate(e=>e.scrollLeft=e.scrollWidth);
    const bounds=await title().boundingBox();assert.ok(bounds.x>=0&&bounds.x<420,'Sticky draft remains reachable after horizontal scroll');await shot('long-scroll-draft');
    await button('Create record').click();await page.getByText('Created “Long table new record”.',{exact:true}).waitFor();await button('Cancel new record').click();
  });
  await check('board-group-and-no-value-creation',async()=>{
    await dataset('Field observations');await choose('View','Board');
    for(const name of ['Done','Unassigned']) {const group=page.getByRole('region',{name:'Board group: '+name,exact:true});await button('New record in '+name,group).click();await title().fill('Board '+name+' record');await button('Create record',group).click();await button('Board '+name+' record',group).waitFor();await button('Cancel new record',group).click();}
    await shot('board-light');await button('Toggle fixture theme').click();await shot('board-dark');
  });
  await check('locked-controls',async()=>{
    await dataset('Locked observations');assert.equal(await button('Add property').isDisabled(),true);assert.equal(await button('New record').isDisabled(),true);
    await choose('View','Board');assert.equal(await button('New record in Planned').isDisabled(),true);await shot('locked');
  });
  await check('narrow-light-dark-and-property-form',async()=>{
    await page.setViewportSize({width:420,height:540});await dataset('Field observations');
    for(const theme of ['light','dark']) {await page.evaluate(t=>window.issue4Theme(t),theme);await page.locator('thead .ws-db-add-property').scrollIntoViewIfNeeded();await shot('narrow-'+theme+'-header');await button('Add property').click();const form=page.getByRole('form',{name:'New property',exact:true});await form.getByRole('textbox',{name:'Property name',exact:true}).fill('Narrow draft');await shot('narrow-'+theme+'-property');const b=await form.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=421,'Contextual form fits narrow viewport');await button('Cancel',form).click();await page.locator('.ws-table-wrap').evaluate(e=>e.scrollLeft=0);await button('New record').scrollIntoViewIfNeeded();await button('New record').click();await title().fill('Narrow draft');await shot('narrow-'+theme+'-record');await button('Cancel new record').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  });
  receipt.persistenceState=await page.request.get('http://127.0.0.1:'+(process.env.ISSUE4_PORT??'19564')+'/state').then(r=>r.json());
} finally {await save();await context.close();}
console.log(JSON.stringify({cases:receipt.cases,screenshots:receipt.screenshots.length,errors:receipt.errors},null,2));
if(receipt.cases.some(c=>c.result!=='PASS')||receipt.errors.length)process.exitCode=1;
