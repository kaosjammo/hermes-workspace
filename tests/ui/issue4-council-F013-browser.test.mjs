// Full production Workspace/API/SQLite with pinned UI controls and synthetic admission/data.
// Requires the isolated score-free fixture, F013_OUT, F013_HOST_PACKAGE and F013_CHROMIUM.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const out=process.env.F013_OUT,phase=process.env.F013_PHASE??'green',base=process.env.F013_URL??'http://127.0.0.1:19713';
assert.ok(out&&process.env.TMPDIR?.startsWith(out),'Task-owned output/scratch required');
const {chromium,expect}=createRequire(process.env.F013_HOST_PACKAGE)('@playwright/test');
const report={scope:'Production Workspace/API/Store/SQLite, real pinned SDK controls/styles. Synthetic host atoms, admission, transport and data. No native/provider/OS IME acceptance.',phase,cases:[],screenshots:[],errors:[]};
const save=()=>fs.writeFile(out+'/logs/'+phase+'.json',JSON.stringify(report,null,2));
let context,page;
const form=()=>page.getByRole('form',{name:'New property',exact:true});
const name=()=>form().getByRole('textbox',{name:'Property name',exact:true});
const button=(text,scope=page)=>scope.getByRole('button',{name:text,exact:true});
const state=()=>page.evaluate(()=>window.issue9.rest('/state'));
async function settle(){
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));
  await page.evaluate(async()=>{let previous='';for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);const next=JSON.stringify([...document.querySelectorAll('.ws-work,.ws-table-wrap,.ws-db-property-popover')].map(n=>{const r=n.getBoundingClientRect();return[r.x,r.y,r.width,r.height,n.scrollTop,n.scrollLeft]}));if(next===previous)return;previous=next;}throw Error('Recovery geometry did not settle');});
}
async function observed(){return page.evaluate(()=>({heading:document.querySelector('.ws-document h1')?.textContent,view:document.querySelector('[aria-label="View"]')?.textContent,formVisible:Boolean(document.querySelector('form[aria-label="New property"]')?.getClientRects().length),draft:document.querySelector('input[aria-label="Property name"]')?.value,alerts:[...document.querySelectorAll('[role="alert"]')].filter(n=>n.getClientRects().length).map(n=>n.textContent),active:{label:document.activeElement?.getAttribute('aria-label'),text:document.activeElement?.textContent},fonts:document.fonts.status,theme:document.documentElement.classList.contains('dark')?'dark':'light',viewport:[innerWidth,innerHeight],selected:[...document.querySelectorAll('.ws-nav [aria-current="page"]')].map(n=>n.closest('[data-ws-item-id]')?.dataset.wsItemId),formBox:(()=>{const e=document.querySelector('form[aria-label="New property"]');if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()}));}
async function capture(label){await settle();const actual=await observed(),file=out+'/screenshots/'+phase+'-'+label+'.png';await page.screenshot({path:file,fullPage:false});report.screenshots.push({name:phase+'-'+label,path:file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex'),actual});await save();return actual;}
async function scenario(label,fn){try{const evidence=await fn();report.cases.push({name:label,result:'PASS',evidence});}catch(e){report.cases.push({name:label,result:'FAIL',error:String(e.stack??e),observed:await observed()});await capture(label+'-failed-observation');}await save();}
async function open(title,keyboard=false){
  const drawer=page.getByRole('button',{name:/^Pages ·/});if(await drawer.isVisible())await drawer.click();
  const target=page.locator('.ws-nav').getByRole('button',{name:title,exact:true}).first();
  if(keyboard){await target.focus();await page.keyboard.press('Enter');}else await target.click();
}
async function reload(){await page.reload();await page.locator('.ws-nav').waitFor();await open('Long observations');await expect(page.locator('.ws-document h1')).toHaveText('Long observations');await settle();}
async function attempt(action,keyboard){
  if(action==='item')return open('Programme overview',keyboard);
  const view=page.getByRole('combobox',{name:'View',exact:true});
  if(keyboard){await view.focus();await page.keyboard.press('Space');await page.getByRole('option',{name:'Board',exact:true}).focus();await page.keyboard.press('Enter');}
  else{await view.click();await page.getByRole('option',{name:'Board',exact:true}).click();}
}
async function recovered(title){
  await expect(form()).toBeVisible({timeout:2000});await settle();
  await expect(name()).toHaveValue(title);await expect(name()).toBeFocused();
  const explanation=form().getByRole('alert').filter({hasText:/Finish or cancel.*property/i});await expect(explanation).toBeVisible();
  const id=await explanation.getAttribute('id');assert.ok(id);assert.ok((await name().getAttribute('aria-describedby'))?.split(' ').includes(id));
  await expect(page.locator('.ws-document h1')).toHaveText('Long observations');
}
try{
  context=await chromium.launchPersistentContext(out+'/scratch/browser-'+phase,{headless:true,chromiumSandbox:true,executablePath:process.env.F013_CHROMIUM,viewport:{width:1440,height:900},args:['--disable-dev-shm-usage']});
  page=context.pages()[0];page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);await page.locator('.ws-nav').waitFor();await open('Long observations');
  if(!(await state()).items.some(i=>i.title==='F013 formula-error context')){
    await button('New record').click();const input=page.getByRole('textbox',{name:'New record title',exact:true});await input.fill('F013 formula-error context');await input.press('Enter');await expect.poll(async()=>(await state()).items.some(i=>i.title==='F013 formula-error context')).toBe(true);await button('Cancel new record').click();
  }
  report.before=await page.request.get(base+'/fixture/raw').then(r=>r.json());
  for(const dismissal of ['Escape','outside'])for(const action of ['view','item'])for(const keyboard of [false,true]){
    const label=dismissal+'-'+action+'-'+(keyboard?'keyboard':'pointer');
    await scenario(label,async()=>{
      await reload();const draft='Retained '+label;await button('Add property').click();await name().fill(draft);
      if(dismissal==='Escape')await page.keyboard.press('Escape');else await page.locator('.ws-db-count').first().click();
      await expect(form()).toBeHidden();await attempt(action,keyboard);await recovered(draft);
      await capture(label+'-recovered');
      const alerts=await page.getByRole('alert').allTextContents();assert.ok(alerts.some(t=>t.includes('Formula cannot compute these values')),'Unrelated formula error remains');
      await button('Cancel',form()).click();await attempt(action,keyboard);
      if(action==='view'){await expect(page.getByRole('combobox',{name:'View',exact:true})).toHaveText('Board');await expect(page.locator('.ws-board')).toBeVisible();}
      else await expect(page.locator('.ws-document h1')).toHaveText('Programme overview');
      return{draft,explicitCancelPermitsAction:true,unrelatedFormulaErrorPreserved:true};
    });
  }
  if(!phase.startsWith('red')){
    await scenario('narrow-dark-recovery',async()=>{
      await reload();await page.setViewportSize({width:420,height:740});await page.evaluate(()=>window.issue9.theme('dark'));
      await button('Add property').scrollIntoViewIfNeeded();await button('Add property').click();await name().fill('Narrow retained property');await page.keyboard.press('Escape');await attempt('view',true);await recovered('Narrow retained property');
      const actual=await capture('narrow-dark-recovered');assert.ok(actual.formBox.x>=0&&actual.formBox.x+actual.formBox.width<=421);await button('Cancel',form()).click();await attempt('view',false);await expect(page.locator('.ws-board')).toBeVisible();
      return{width:420,theme:'dark',visibleAccessibleRecovery:true};
    });
    await scenario('successful-create-clears-guard',async()=>{
      await page.setViewportSize({width:1440,height:900});await reload();await button('Add property').click();await name().fill('F013 verified property');await page.keyboard.press('Escape');await attempt('view',false);await recovered('F013 verified property');await button('Add property',form()).click();await expect(form()).toBeHidden();await expect.poll(async()=>(await state()).items.find(i=>i.title==='Long observations').columns.some(c=>c.name==='F013 verified property')).toBe(true);await attempt('view',false);await expect(page.locator('.ws-board')).toBeVisible();
      return{propertyCreated:true,guardCleared:true};
    });
    await scenario('grid-record-document-return',async()=>{
      await reload();const s=await state(),db=s.items.find(i=>i.title==='Long observations'),record=s.items.find(i=>i.database_id===db.id&&i.title==='Observation 01');
      await page.locator('.ws-table').getByRole('button',{name:record.title,exact:true}).click();await expect(page.locator('.ws-document h1')).toHaveText(record.title);await expect(page.locator('[contenteditable=true]')).toContainText('Retain synthetic record document.');
      await capture('record-document');const during=(await state()).items.find(i=>i.id===record.id);assert.equal(during.database_id,db.id);assert.deepEqual(during.properties,record.properties);assert.equal(during.content,record.content);
      await page.locator('.ws-document').getByRole('button',{name:db.title,exact:true}).click();await expect(page.locator('.ws-document h1')).toHaveText(db.title);await expect(page.locator('.ws-table').getByRole('button',{name:record.title,exact:true})).toBeVisible();await capture('returned-same-grid');
      return{databaseId:db.id,recordId:record.id,recordTitle:record.title,contentExact:true,typedPropertiesExact:true,relationIds:record.properties.site};
    });
  }
  report.after=await page.request.get(base+'/fixture/raw').then(r=>r.json());const reopened=await page.request.get(base+'/fixture/reopen').then(r=>r.json());assert.deepEqual(reopened,report.after);report.sqliteReopenExact=true;
  const current=new Map(report.after.items.map(i=>[i.id,i]));for(const old of report.before.items)if(old.kind==='record')for(const key of ['title','content','database_id','properties'])assert.deepEqual(current.get(old.id)[key],old[key],old.id+':'+key);report.originalTypedRecordFieldsPreserved=true;
}finally{await save();await context?.close();}
console.log(JSON.stringify({cases:report.cases,screenshots:report.screenshots.length,errors:report.errors,sqliteReopenExact:report.sqliteReopenExact,originalTypedRecordFieldsPreserved:report.originalTypedRecordFieldsPreserved},null,2));
if(report.errors.length||report.cases.some(c=>c.result==='FAIL'))process.exitCode=1;
