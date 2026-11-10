// Real pinned Desktop disk loader + public SDK + production Workspace API/Store.
// Owner admission is an explicitly synthetic fixture. No provider/native run.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const [phase, out, publicRoot] = process.argv.slice(2), root = process.cwd();
if (!phase || !out || process.env.LANE_A_ISOLATED !== '1') throw Error('Use scripts/qualify-lane-a.py');
const require = createRequire(publicRoot + '/toolchain/package.json');
const browserRequire = createRequire('/home/mike/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = browserRequire('playwright');
const receipt = {phase, scope:'Actual pinned browser-hosted Desktop loader/SDK and production API/Store with synthetic owner admission. Not installed/native/provider acceptance.', cases:[], timings:[], geometry:[], captures:[], errors:[], started:new Date().toISOString()};
const save = () => fs.writeFile(out+'/RESULT.json', JSON.stringify(receipt,null,2)+'\n');
const sha = b => createHash('sha256').update(b).digest('hex');
let server, browser, context, page, serverLog;
const python = String.raw`
import json,os,copy,uuid,time,asyncio
from pathlib import Path
from workspace_plugin.store import Store
root=Path.cwd();out=Path(os.environ['LANE_A_OUT']);home=out/'home/.hermes'
home.mkdir(parents=True,exist_ok=True)
(home/'config.yaml').write_text('plugins:\n  enabled: [workspace]\n')
(home/'plugins').mkdir(exist_ok=True)
# Fixture discovery points at the already read-only source; no installer runs.
(home/'plugins/workspace').symlink_to(root,target_is_directory=True)
if os.environ.get('LANE_A_PHASE') in {'council-smoke','review23','review24','review25','review26','review27','comment-fixes'}:
 from hermes_state import SessionDB
 native_db=SessionDB(home/'state.db')
 try:
  native_db.create_session('synthetic-review22-thread-a',source='gui')
  native_db.create_session('synthetic-review22-thread-b',source='gui')
 finally: native_db.close()
s=Store(home);parent=None;folders=[]
for i in range(6):
 f=s.execute('create_item',{'kind':'folder','title':f'Volume {i+1} seasonal river garden observations and research','parent_id':parent});folders.append(f);parent=f['id']
p=s.execute('create_item',{'kind':'page','title':'Deep chapter seven — seasonal river garden observations for a long field journal','parent_id':parent,'content':'<h2>River garden</h2><p>Keep the riverbank passage and its anchor intact.</p><p>Unsaved observations remain safe while searching.</p>'})
if os.environ.get('LANE_A_PHASE')=='wide':
 p=s.execute('update_item',{'id':p['id'],'patch':{'content':p['content']+'<p>A longer synthetic field note keeps seasonal observations, planting decisions, soil conditions, river levels and careful follow-up measurements together so wide document mode can show a genuinely longer readable line without changing the writing or its typography.</p>'}})
c=s.execute('add_comment',{'item_id':p['id'],'text':'Preserve this field observation.','anchor':{'quote':'riverbank passage','prefix':'Keep the ','suffix':' and its anchor intact.'}})
d=s.execute('create_item',{'kind':'database','title':'Observations database','parent_id':folders[0]['id']})
s.execute('set_columns',{'id':d['id'],'columns':[{'id':'observation','name':'Observation','type':'text'}]})
row=s.execute('create_item',{'kind':'record','title':'Record document','database_id':d['id'],'properties':{'observation':'submerged-iris-property'},'content':'<p>Record instructions remain available.</p>'})
snapshot=s.backup_snapshot()
for i in range(300):
 leaf=copy.deepcopy(p);leaf.update(id=uuid.uuid4().hex,title=f'Field observation {i:03d}',parent_id=folders[i%6]['id'],content=f'<p>Observation text {i}; '+('hidden-w19-body-needle' if i==299 else 'seasonal research')+'</p>')
 snapshot['items'].append(leaf)
s.restore_snapshot(snapshot)
fixture={'folders':folders,'page':p,'comment':c,'database':d,'record':row}
if os.environ.get('LANE_A_PHASE')=='workflows':
 for key,title in [('recovery','Recovery field journal'),('section','Section field journal')]:
  saved=s.execute('create_item',{'kind':'page','title':title,'content':'<p>Original passage.</p><p>Outside content.</p>'})
  feedback=s.execute('add_comment',{'item_id':saved['id'],'text':'Revise the original passage.','anchor':{'quote':'Original passage','prefix':'','suffix':'.'}})
  run=s.begin_run(saved['id'],'synthetic-'+key+'-thread')
  s.apply_run(run['id'],[{'item_id':saved['id'],'patch':{'content':'<p>Agent passage.</p><p>Outside content.</p>'}}],[{'comment_id':feedback['id'],'text':'Synthetic saved reply; not provider execution.'}])
  s.finish_run(run['id'],'completed')
  fixture[key]={'item':saved,'comment':feedback,'run':run}
if os.environ.get('LANE_A_PHASE') in {'database','database-context','review26','review27','comment-fixes'}:
 target=s.execute('create_item',{'kind':'database','title':'Related field sites'})
 related=s.execute('create_item',{'kind':'record','database_id':target['id'],'title':'North bank'})
 columns=[{'id':'observation','name':'Observation','type':'text'},{'id':'count','name':'Count','type':'number'},{'id':'status','name':'Status','type':'select','options':['Planned','Observed','Reviewed']},{'id':'checked','name':'Verified','type':'checkbox'},{'id':'date','name':'Observed on','type':'date'},{'id':'site','name':'Site','type':'relation','target_database_id':target['id']},{'id':'double','name':'Double count','type':'formula','formula':'coalesce(col("Count"), 0) * 2'}]
 s.execute('set_columns',{'id':d['id'],'columns':columns})
 s.execute('update_item',{'id':row['id'],'patch':{'properties':{'observation':'submerged-iris-property','count':4,'status':'Observed','checked':True,'date':'2026-11-10','site':[related['id']]}}})
 for title,count,status in [('Garden survey',2,'Planned'),('Water level check',9,'Reviewed')]:
  s.execute('create_item',{'kind':'record','database_id':d['id'],'title':title,'properties':{'observation':'Synthetic field note','count':count,'status':status,'checked':False}})
 empty=s.execute('create_item',{'kind':'database','title':'Empty seasonal journal'})
 locked=s.execute('create_item',{'kind':'database','title':'Locked seasonal journal'})
 long_db=s.execute('create_item',{'kind':'database','title':'Extended observations journal'})
 s.execute('set_columns',{'id':long_db['id'],'columns':columns})
 long_record=None
 for i in range(50):
  r=s.execute('create_item',{'kind':'record','database_id':long_db['id'],'title':f'Long sample {i:03d}','properties':{'observation':'Synthetic long-table note','count':i,'status':'Observed'}})
  if i==45:
   s.execute('update_item',{'id':r['id'],'patch':{'title':'Long sample 045 — detailed seasonal riverbank measurements and follow-up observations'}})
   long_record=next(row for row in s.snapshot()['items'] if row['id']==r['id'])
 fixture.update(empty=empty,locked=locked,related=related,long_database=long_db,long_record=long_record)
if os.environ.get('LANE_A_PHASE') in {'review23','review24','review25'}:
 s.execute('set_columns',{'id':d['id'],'columns':[{'id':'status','name':'Status','type':'select','options':['Observed','Unassigned','__none','option:0']}]})
 s.execute('create_item',{'kind':'record','title':'Literal option record','database_id':d['id'],'properties':{'status':'Unassigned'}})
if os.environ.get('LANE_A_PHASE')=='review24':
 p=s.execute('update_item',{'id':p['id'],'patch':{'content':p['content']+'<pre><code>def observe(value):\n    result = value + 1\n\treturn result</code></pre>'}});fixture['page']=p
if os.environ.get('LANE_A_PHASE')=='review25':
 from workspace_plugin import interchange as api
 raw=api.export_document({'title':'Numbered preservation','content':'<ol start="3"><li>Third</li><li>Fourth<ol start="7"><li>Nested seven</li></ol></li></ol><p>After lists.</p>'},'docx');doc=api.import_file('numbered.docx',raw)
 fixture['numbered']=s.import_document({k:doc[k] for k in ['title','content','original'] if k in doc})
 s.execute('set_columns',{'id':d['id'],'columns':[{'id':'status','name':'Status','type':'select','options':['Unassigned','Unassigned (no value)','Unassigned (no value) (no value)','__none']}]})
if os.environ.get('LANE_A_PHASE')=='comment-fixes':
 content='<h2>Synthetic long document</h2>'+''.join('<p><strong>Landmark %03d</strong> — unique observation %03d. Preserve the rich river garden context, careful measurements and surrounding sentences for this long synthetic page.</p>'%(i,i) for i in range(70))
 content=content.replace('<p><strong>Landmark 035</strong>', '<p>First original. Second original. <strong>Landmark 035</strong>')
 p=s.execute('update_item',{'id':p['id'],'patch':{'content':content}});s.execute('resolve_comment',{'id':c['id'],'resolved':True})
 def anch(q):
  from workspace_plugin.store import _plain
  t=_plain(content);at=t.index(q);return {'quote':q,'prefix':t[max(0,at-32):at],'suffix':t[at+len(q):at+len(q)+32]}
 first=s.execute('add_comment',{'item_id':p['id'],'text':'Independent first request','anchor':anch('First original')});second=s.execute('add_comment',{'item_id':p['id'],'text':'Independent second request','anchor':anch('Second original')});s.execute('reply_comment',{'id':first['id'],'text':'Earlier user context'})
 run=s.begin_run(p['id'],'synthetic-independent-comments');after=content.replace('First original','First addressed').replace('Second original','Second addressed');s.apply_run(run['id'],[{'item_id':p['id'],'patch':{'content':after}}],[{'comment_id':first['id'],'text':'Simulated first outcome'},{'comment_id':second['id'],'text':'Simulated second outcome'}]);s.finish_run(run['id'],'completed')
 fixture.update(page=p,commentFix={'first':first,'second':second,'before':content,'after':after,'run_id':run['id'],'scope':'Simulated Store agent effects only, not provider/native execution'})
fixture['inventory']={k:sum(i['kind']==k for i in s.backup_snapshot()['items']) for k in ['page','folder','database','record']}
(out/'fixture.json').write_text(json.dumps(fixture))
from hermes_cli import web_server
from hermes_cli.web_routers import webapp
from dashboard.plugin_api import create_router
import uvicorn
app=web_server.app
@app.post('/__fixture/database-lock')
async def fixture_database_lock():
 if os.environ.get('LANE_A_PHASE')!='database': raise RuntimeError('Not a database fixture')
 s.execute('add_comment',{'item_id':fixture['locked']['id'],'text':'Synthetic active-run lock qualification.'})
 s.begin_run(fixture['locked']['id'],'synthetic-database-lock')
 return {'syntheticOnly':True}
failed_search=False
failed_create=False
failed_visual_search=set()
failed_property=False
@app.middleware('http')
async def audit_fixture(request,call_next):
 global failed_search,failed_create,failed_property
 start=time.perf_counter();op=None;query=None
 if request.url.path.endswith('/command'):
  body=await request.json();op=body.get('op');query=body.get('payload',{}).get('query')
  if op=='search_page' and (query=='slow-obsolete-query' or str(query).startswith('slow-visual-')): await asyncio.sleep(.5)
 if op=='set_columns' and any(c.get('name')=='Retry transport property' for c in body.get('payload',{}).get('columns',[])) and not failed_property:
  failed_property=True
  from starlette.responses import JSONResponse
  response=JSONResponse({'detail':'Synthetic property request temporarily unavailable'},status_code=503)
 elif op=='create_item' and body.get('payload',{}).get('title')=='Retained pending record' and not failed_create:
  failed_create=True
  (out/'pending-create-entered.json').write_text(json.dumps({'syntheticOnly':True,'calls':1}))
  await asyncio.sleep(1.5)
  from starlette.responses import JSONResponse
  response=JSONResponse({'detail':'Synthetic creation temporarily unavailable'},status_code=503)
 elif op=='search_page' and query in {'retry-Light-fixture','retry-Dark-fixture'} and query not in failed_visual_search:
  failed_visual_search.add(query)
  from starlette.responses import JSONResponse
  response=JSONResponse({'detail':'Synthetic temporary search failure'},status_code=503)
 elif op=='search_page' and query=='retry-fixture' and not failed_search:
  from starlette.responses import JSONResponse
  failed_search=True;response=JSONResponse({'detail':'Synthetic temporary search failure'},status_code=503)
 else: response=await call_next(request)
 if request.url.path.startswith('/api/plugins/workspace/'):
  with (out/'api-audit.jsonl').open('a') as log:
   log.write(json.dumps({'path':request.url.path,'method':request.method,'op':op,'query':query,'status':response.status_code,'milliseconds':(time.perf_counter()-start)*1000,'bytes':response.headers.get('content-length')})+'\n')
 return response
# Fixture-only admission seam, production API/Store thereafter. No native grant.
async def synthetic_owner(): return None
api=create_router(owner_home=lambda:home,authorize=synthetic_owner)
app.router.routes[0:0]=[]
before=len(app.router.routes)
app.include_router(api,prefix='/api/plugins/workspace')
added=app.router.routes[before:];del app.router.routes[before:];app.router.routes[0:0]=added
app.state.ui_surface='webapp';app.state.web_dist=Path(os.environ['LANE_A_PUBLIC'])/'host/apps/desktop/dist-webapp'
app.state.bound_host='127.0.0.1';app.state.auth_required=False;app.state.initial_profile='default'
ticket=webapp.mint_printed_launch_ticket(app.state)
(out/'launch.json').write_text(json.dumps({'url':f'http://127.0.0.1:19444/webapp/launch#ticket={ticket}'}))
uvicorn.run(app,host='127.0.0.1',port=19444,lifespan='off',access_log=False)
`;
const btn = n => page.getByRole('button',{name:n,exact:true});
async function settle() { await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}); }
async function check(id, fn) {
  if(phase==='comment-fixes'&&!id.startsWith('comment-fixes-')){receipt.cases.push({id,status:'UNRUN',reason:'Only2reportedcommentdefects'});return;}
  if(phase==='review27'&&!id.startsWith('review27-')){receipt.cases.push({id,status:'UNRUN',reason:'Final affected proof only.'});return;}
  if(phase==='review26'&&!id.startsWith('review26-')){receipt.cases.push({id,status:'UNRUN',reason:'Only final affected checks and representative captures.'});return;}
  if(phase==='review25'&&!id.startsWith('review25-')){receipt.cases.push({id,status:'UNRUN',reason:'Only accepted priority-repair paths; full suites deferred.'});return;}
  if(phase==='review24'&&id!=='review24-select-identities-and-docx'){receipt.cases.push({id,status:'UNRUN',reason:'Affected select/picker/export smoke only; full tests deferred.'});return;}
  if(phase==='review23'&&id!=='review23-picker-description-contrast'){receipt.cases.push({id,status:'UNRUN',reason:'Affected smoke only; full tests deferred.'});return;}
  if(phase==='council-smoke'&&!['pointer-keyboard-width-and-editor-identity','home-and-search-current-visual-states','round22-details-comments-recent-picker'].includes(id)){receipt.cases.push({id,status:'UNRUN',reason:'Quick council smoke only; full suites deferred.'});return;}
  const focused={keyboard:'actual-host-capture-and-focused-editor-keyboard-routing',workflows:'actual-http-comments-files-and-recovery',editor:'actual-http-selection-editor-persistence',resources:'bounded-repeated-mount-search-navigation-resources','resources-diagnose':'bounded-repeated-mount-search-navigation-resources','resources-workspace':'bounded-repeated-mount-search-navigation-resources',wide:'per-page-wide-document-mode',database:'database-','database-context':'database-active-context-full-name'}[phase];
  if(focused&&(phase==='database'?!id.startsWith(focused):id!==focused)){
    receipt.cases.push({id,status:'UNRUN',reason:'Focused qualification; existing separate receipts retained.'});return;
  }
  try { await fn(); receipt.cases.push({id,status:'PASS'}); }
  catch(e) {receipt.cases.push({id,status:'FAIL',error:e.stack});if(!['review23','review25','comment-fixes'].includes(phase))throw e;}
  finally {await save();}
}
async function shot(name) {
  if(phase==='council-smoke'&&!/home-overview|search-results|search-error-Light|search-empty-Dark|search-loading-Light|current-|navigation-resized/.test(name))return;
  await settle();
  if(phase==='database'&&/board|populated/.test(name)){
    const rows=await page.locator('.ws-db-record-name').evaluateAll(nodes=>nodes.map(node=>{
      const title=node.querySelector(':scope > button:first-child'),action=node.querySelector('.ws-db-row-actions');
      if(!title||!action)return null;
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return {text:title.textContent,container:rect(node),title:rect(title),action:rect(action)};
    }).filter(row=>row&&row.container.width>0&&row.container.height>0));
    assert.ok(rows.length,'Visible record titles and their real menu targets are measured');
    for(const row of rows){assert.ok(row.title.right<=row.action.x+1&&row.action.right<=row.container.right+1&&row.title.x>=row.container.x-1,JSON.stringify({frame:name,...row}));}
    receipt.databaseTitleLayout??=[];receipt.databaseTitleLayout.push({frame:name,measured:rows.length,samples:rows.filter(x=>x.text.length>20).slice(0,8)});
  }
  const file=out+'/'+name+'.png';await page.screenshot({path:file,animations:'disabled'});
  receipt.captures.push({path:file,sha256:sha(await fs.readFile(file)),viewport:page.viewportSize()});await save();
}
async function open(title) {
  const toggle=page.getByRole('button',{name:/^Pages ·/});
  const button=page.locator('.ws-nav').getByRole('button',{name:title,exact:true}).first();
  if (!await button.isVisible() && await toggle.isVisible()) await toggle.click();
  await button.click();await page.waitForFunction(t=>document.querySelector('.ws-title')?.value===t,title);
}
async function menu(item) {await btn('Page actions').click();await page.getByRole('menuitem',{name:item,exact:true}).click();}
const choose=async(label,value,scope=page)=>{await scope.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();};
async function geometry(label) {
  await settle();
  const value=await page.evaluate(()=>{
    const box=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};};
    return {body:box('.ws-body'),nav:box('.ws-nav'),handle:box('.ws-nav-resize'),main:box('.ws-work'),document:box('.ws-document'),columns:getComputedStyle(document.querySelector('.ws-body')).gridTemplateColumns};
  });receipt.geometry.push({label,...value});return value;
}
async function clientContracts() {
  const {WorkspaceClient,StaleWorkspaceError}=await import('../../frontend/client.mjs');
  const state=(revision=1,scope_id='synthetic')=>({scope_id,revision,items:[]});
  const searchPage=(items,revision=1)=>({scope_id:'synthetic',revision,items,total:items.length,offset:0,limit:100,next_offset:null,has_more:false});
  const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
  await check('client-one-search-plus-latest-slot-does-not-block-writes',async()=>{
    const pending=[],calls=[];let owner='a';const c=new WorkspaceClient({rest:async(p,o)=>{
      calls.push(o.body);if(o.body.op==='search_page'){const d=deferred();pending.push(d);return d.promise;}
      return {result:'saved',state:state(2)};
    }},()=>[owner,1]);c.accept(state());
    const first=c.search('old').catch(e=>e),middle=c.search('middle').catch(e=>e),last=c.search('latest');
    assert.equal(calls.length,1);assert.equal((await middle).name,'StaleWorkspaceError');
    assert.equal(await c.command('update_item',{id:'p',patch:{content:'retained draft'}}),'saved');
    pending[0].resolve({result:searchPage([{id:'old'}])});assert.ok(await first instanceof StaleWorkspaceError);
    await Promise.resolve();assert.equal(calls.filter(b=>b.op==='search_page').length,2);assert.equal(calls.at(-1).payload.query,'latest');
    pending[1].resolve({result:searchPage([{id:'latest'}],2)});assert.deepEqual((await last).items,[{id:'latest'}]);assert.equal(c.snapshot().revision,2);
    const retired=c.search('retired').catch(e=>e);owner='b';pending[2].resolve({result:[{id:'wrong-owner'}],state:state(100)});assert.ok(await retired instanceof StaleWorkspaceError);c.dispose();assert.equal(c.listeners.size,0);assert.equal(c.searchPending,null);
  });
  await check('client-search-clear-dispose-scope-and-read-dedupe',async()=>{
    const d=deferred(),calls=[];const c=new WorkspaceClient({rest:(p,o)=>{calls.push(p);return d.promise;}},()=>['a',1]);
    const one=c.load(),two=c.load();assert.equal(one,two);assert.equal(calls.length,1);d.resolve(state());await one;await Promise.resolve();assert.equal(c.loadPending,null);
    const next=deferred();c.ctx.rest=()=>next.promise;const result=c.search('clear').catch(e=>e);c.cancelSearch();next.resolve({result:[{id:'late'}],state:state()});assert.ok(await result instanceof StaleWorkspaceError);
    const scope=deferred();c.ctx.rest=()=>scope.promise;const changed=c.search('scope').catch(e=>e);c.accept(state(0,'replacement'));scope.resolve({result:[],state:state()});assert.ok(await changed instanceof StaleWorkspaceError);c.dispose();
  });
}
try {
  if(!['baseline','council-smoke','review23','review24','review25','review26','review27','comment-fixes'].includes(phase)){
    await clientContracts();
    const regressionFiles=['tests/ui/client.test.mjs','tests/ui/repair3-restore.test.mjs','tests/ui/repair2-file-limits.test.mjs'];
    const regression=spawnSync(process.execPath,['--test',...regressionFiles],{cwd:root,encoding:'utf8',timeout:60000});
    await fs.writeFile(out+'/existing-client-tests.log',regression.stdout+regression.stderr);assert.equal(regression.status,0,regression.stdout+regression.stderr);receipt.existingClientTests={argv:[process.execPath,'--test',...regressionFiles],exit:regression.status};
  }
  const pluginDir=out+'/home/.hermes/desktop-plugins/workspace';await fs.mkdir(pluginDir,{recursive:true});
  const sourceRoot=phase==='baseline'?out+'/baseline-source':root;
  const build=await require('esbuild').build({entryPoints:[sourceRoot+(['council-smoke','review23','review24','review25','review26','review27','comment-fixes'].includes(phase)?'/tests/ui/lane-a-smoke-entry.jsx':'/frontend/index.jsx')],outfile:pluginDir+'/plugin.js',bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',external:['@hermes/plugin-sdk','react','react/jsx-runtime'],nodePaths:[publicRoot+'/toolchain/node_modules'],metafile:true});
  receipt.bundle={bytes:(await fs.stat(pluginDir+'/plugin.js')).size,sha256:sha(await fs.readFile(pluginDir+'/plugin.js')),inputs:build.metafile.inputs};
  if(['council-smoke','review23','review24','review25','review26','review27','comment-fixes'].includes(phase)){const production=await require('esbuild').build({entryPoints:[root+'/frontend/index.jsx'],outfile:out+'/production-plugin.js',bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',external:['@hermes/plugin-sdk','react','react/jsx-runtime'],nodePaths:[publicRoot+'/toolchain/node_modules'],metafile:true});receipt.productionBundle={sha256:sha(await fs.readFile(out+'/production-plugin.js')),inputs:production.metafile.inputs};receipt.syntheticTransport='Public SDK session.list/session.resume responses only; actual production Workspace/picker/adapter, canonical private SessionDB ids and production workflow/bind/Store. Fixture bundle includes disclosed transport seam; production bundle separately bound.';}
  await fs.writeFile(out+'/server.py',python);
  const log=serverLog=await fs.open(out+'/server.log','w');
  server=spawn(publicRoot+'/native-venv/bin/python',[out+'/server.py'],{cwd:root,env:{...process.env,LANE_A_OUT:out,LANE_A_PUBLIC:publicRoot,LANE_A_PHASE:phase},stdio:['ignore',log.fd,log.fd]});
  await new Promise((resolve,reject)=>{const until=Date.now()+90000;const t=setInterval(async()=>{if(server.exitCode!==null){clearInterval(t);reject(Error('Synthetic fixture exited '+server.exitCode));return;}try{await fs.access(out+'/launch.json');await fetch('http://127.0.0.1:19444/');clearInterval(t);resolve();}catch(e){if(Date.now()>until){clearInterval(t);reject(Error('Fixture readiness timeout'));}}},100);});
  browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/home/mike/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'});
  context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>receipt.errors.push(e.message));
  await page.goto(JSON.parse(await fs.readFile(out+'/launch.json','utf8')).url,{waitUntil:'domcontentloaded'});
  await btn('Capabilities').waitFor();await btn("I'll choose a provider later").waitFor();await btn("I'll choose a provider later").click();await btn("I'll choose a provider later").waitFor({state:'hidden'});
  await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');
  const enabled=page.getByRole('switch',{name:'Workspace',exact:true});await enabled.waitFor();if(!await enabled.isChecked())await enabled.click();
  const f=JSON.parse(await fs.readFile(out+'/fixture.json','utf8'));
  receipt.fixture={counts:f.inventory,syntheticOnly:true};
  const profiler=await context.newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');
  receipt.stateRequests=[];
  page.on('response',async response=>{if(response.url().endsWith('/api/plugins/workspace/state')){try{const body=await response.body();receipt.stateRequests.push({bytes:body.length,status:response.status(),timing:response.request().timing()});}catch{}}});
  // Same host/data, first mount and five warmed mounts. This is renderer first usable,
  // not process cold-start or installed-native load time.
  for(let i=0;i<(['council-smoke','review23','review24','review25','review26','review27','comment-fixes'].includes(phase)?1:6);i++){
    if(i){await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');await enabled.waitFor();}
    const start=performance.now();await page.locator('li').getByRole('button',{name:'Workspace',exact:true}).click();
    await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();
    await page.locator('.ws-nav').getByRole('button',{name:f.page.title,exact:true}).waitFor();await settle();
    receipt.timings.push({kind:i?'warm-first-usable':'cold-first-mount-usable',milliseconds:performance.now()-start});
  }
  const profile=await profiler.send('Profiler.stop');await fs.writeFile(out+'/mounts.cpuprofile',JSON.stringify(profile.profile));
  const hits=new Map();for(const node of profile.profile.nodes){const key=node.callFrame.functionName+' '+node.callFrame.url;hits.set(key,(hits.get(key)??0)+(node.hitCount??0));}
  receipt.cpuTopSamples=[...hits].sort((a,b)=>b[1]-a[1]).slice(0,20);await profiler.detach();
  const hide=btn('Hide sidebar');if(await hide.isVisible())await hide.click();
  await open(f.page.title);
  await page.setViewportSize({width:950,height:600});
  const baseline=await geometry('950x600');await shot('geometry-950');
  if(phase==='baseline'){
    receipt.baselineObservedMisplacedMain=Math.abs(baseline.main.x-baseline.handle.right)>2||baseline.main.y>baseline.body.y+2||baseline.main.width<300;
    assert.ok(receipt.baselineObservedMisplacedMain,'Retain actual baseline geometry defect');
    receipt.cases.push({id:'baseline-retains-known-950px-defect',status:'OBSERVED_FAIL'});
    receipt.status='BASELINE_RECORDED';
  } else {
    await check('950px-real-three-column-geometry',async()=>{
      assert.ok(Math.abs(baseline.main.x-baseline.handle.right)<2,JSON.stringify(baseline));
      assert.ok(Math.abs(baseline.main.y-baseline.body.y)<2);assert.ok(baseline.main.width>=380);
    });
    const separator=page.getByRole('separator',{name:'Resize Workspace navigation',exact:true});
    const editor=page.getByRole('textbox',{name:'Page content',exact:true});
    await check('pointer-keyboard-width-and-editor-identity',async()=>{
      await page.setViewportSize({width:1600,height:1000});await editor.focus();await editor.press('Control+End');await page.keyboard.type(' Synthetic unsaved navigation observation.');
      await editor.evaluate(e=>e.dataset.laneIdentity='editor-preserved');
      const caret=await editor.evaluate(()=>({text:getSelection()?.anchorNode?.textContent,offset:getSelection()?.anchorOffset}));
      const before=Number(await separator.getAttribute('aria-valuenow')),b=await separator.boundingBox();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+80,b.y+b.height/2,{steps:8});await page.mouse.up();
      assert.ok(Number(await separator.getAttribute('aria-valuenow'))>before);assert.equal(await editor.getAttribute('data-lane-identity'),'editor-preserved');
      assert.deepEqual(await editor.evaluate(()=>({text:getSelection()?.anchorNode?.textContent,offset:getSelection()?.anchorOffset})),caret);
      await separator.focus();await separator.press('Home');assert.equal(Number(await separator.getAttribute('aria-valuenow')),200);await separator.press('Shift+ArrowRight');assert.equal(Number(await separator.getAttribute('aria-valuenow')),240);
      await page.getByText('Content saved',{exact:true}).waitFor();
      await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');await enabled.waitFor();await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);assert.equal(Number(await separator.getAttribute('aria-valuenow')),240);if(phase==='council-smoke')await shot('navigation-resized-editor');
    });
    await check('live-search-body-properties-no-editor-retirement',async()=>{
      const search=page.getByRole('textbox',{name:'Search Workspace',exact:true});await editor.evaluate(e=>e.dataset.laneIdentity='search-preserved');
      const audit=async()=>{try{return (await fs.readFile(out+'/api-audit.jsonl','utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch{return [];}};
      const before=(await audit()).length;
      await search.fill('hidden-w19-body-needle');await page.locator('.ws-search-results').getByRole('button',{name:'Field observation 299',exact:true}).waitFor();
      assert.equal(await editor.getAttribute('data-lane-identity'),'search-preserved');
      await search.fill(' hidden-w19-body-needle ');await page.locator('.ws-search-results').getByRole('button',{name:'Field observation 299',exact:true}).waitFor();
      await search.fill('submerged-iris-property');await page.locator('.ws-search-results').getByRole('button',{name:'Record document',exact:true}).waitFor();
      assert.equal(await editor.getAttribute('data-lane-identity'),'search-preserved');
      await search.fill('not-present-anywhere');await page.getByText('No matches',{exact:true}).waitFor();await search.fill('');await page.locator('.ws-search-results').waitFor({state:'hidden'});
      const requests=(await audit()).slice(before);assert.ok(requests.some(r=>r.op==='search_page'),'Actual production API search observed');assert.equal(requests.filter(r=>r.op==='update_item').length,0);receipt.searchRequests=requests;
    });
    await check('rapid-debounce-clear-ime-and-keyboard-result-navigation',async()=>{
      const search=page.getByRole('textbox',{name:'Search Workspace',exact:true});
      const audit=async()=>{try{return (await fs.readFile(out+'/api-audit.jsonl','utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch{return [];}};
      const before=(await audit()).length;
      await search.pressSequentially('hidden-w19-body-needle',{delay:12});await page.locator('.ws-search-results').getByRole('button',{name:'Field observation 299',exact:true}).waitFor();
      const burst=(await audit()).slice(before).filter(r=>r.op==='search_page');assert.equal(burst.length,1,'200ms debounce sends only the settled burst');assert.equal(burst[0].query,'hidden-w19-body-needle');
      await search.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Field observation 299');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.ws-title')?.value==='Field observation 299');
      await search.fill('');await open(f.page.title);
      await search.dispatchEvent('compositionstart');await search.fill('hidden-w19-body-needle');
      const imeBefore=(await audit()).length;await page.waitForTimeout(260);assert.equal((await audit()).slice(imeBefore).filter(r=>r.op==='search_page').length,0);
      await search.dispatchEvent('compositionend');await page.locator('.ws-search-results').getByRole('button',{name:'Field observation 299',exact:true}).waitFor();await search.fill('');
      // Exercise an already-sent obsolete read, then clear it. Wait for the
      // actual delayed production response via the fixture audit barrier.
      const slowBefore=(await audit()).length;await search.fill('slow-obsolete-query');
      await page.locator('.ws-search-results[aria-busy="true"]').waitFor();await search.fill('');
      for(let i=0;i<100;i++){if((await audit()).slice(slowBefore).some(r=>r.query==='slow-obsolete-query'))break;await new Promise(r=>setTimeout(r,20));}
      assert.ok((await audit()).slice(slowBefore).some(r=>r.query==='slow-obsolete-query'));await page.locator('.ws-search-results').waitFor({state:'hidden'});
      await search.fill('Field observation');await page.getByText('Results 1–100 of 300.',{exact:true}).waitFor();await btn('Next results').click();await page.getByText('Results 101–200 of 300.',{exact:true}).waitFor();await btn('Next results').click();await page.getByText('Results 201–300 of 300.',{exact:true}).waitFor();assert.equal(await btn('Next results').count(),0);await btn('Previous results').click();await page.getByText('Results 101–200 of 300.',{exact:true}).waitFor();await search.fill('');
      await search.fill('retry-fixture');await page.getByRole('alert').filter({hasText:'Synthetic temporary search failure'}).waitFor();await btn('Retry search').click();await page.getByText('No matches',{exact:true}).waitFor();await search.fill('');
    });
    await check('home-and-search-current-visual-states',async()=>{
      for(const mode of ['Dark','Light']){
        await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');await page.goto('http://127.0.0.1:19444/#/workspace');await page.locator('.ws-nav').waitFor();await btn('Home').click();await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();const homeRow=page.locator('.ws-home-item').filter({has:page.getByRole('button',{name:f.page.title,exact:true})});const homeTitle=homeRow.getByRole('button',{name:f.page.title,exact:true}),location=homeRow.locator('.ws-home-location'),titleBox=await homeTitle.boundingBox(),locationBox=await location.boundingBox();assert.ok(locationBox.y>=titleBox.y+titleBox.height-1,JSON.stringify({titleBox,locationBox}));const fullContext=await homeTitle.evaluate(e=>document.getElementById(e.getAttribute('aria-describedby'))?.textContent);assert.ok(fullContext.includes(f.folders[0].title)&&fullContext.includes(f.folders.at(-1).title));receipt.homeHierarchy??=[];receipt.homeHierarchy.push({mode,titleBox,locationBox,fullContextAccessible:true});await shot('home-overview-'+mode);await open(f.page.title);
        const search=page.getByRole('textbox',{name:'Search Workspace',exact:true});await search.fill('slow-visual-'+mode);await page.locator('.ws-search-results[aria-busy="true"]').waitFor();await shot('search-loading-'+mode);await search.fill('hidden-w19-body-needle');await page.locator('.ws-search-results').getByRole('button',{name:'Field observation 299',exact:true}).waitFor();await shot('search-results-'+mode);await search.fill('no-visual-match');await page.getByText('No matches',{exact:true}).waitFor();await shot('search-empty-'+mode);
        await search.fill('retry-'+mode+'-fixture');await page.getByRole('alert').filter({hasText:'Synthetic temporary search failure'}).waitFor();await shot('search-error-'+mode);await btn('Retry search').click();await page.getByText('No matches',{exact:true}).waitFor();await search.fill('');
      }
    });
    await check('page-actions-details-exports-focus-and-recovery',async()=>{
      for(const [kind,title] of [['page',f.page.title],['database',f.database.title],['record',f.record.title]]){
        if(kind==='record'){await open(f.database.title);await page.locator('.ws-table').getByRole('button',{name:title,exact:true}).click();await page.waitForFunction(t=>document.querySelector('.ws-title')?.value===t,title);}else await open(title);
        assert.equal(await page.locator('summary').filter({hasText:/^(Page details|Export and recovery)$/}).count(),0);
        await btn('Page actions').focus();await page.keyboard.press('Enter');await page.getByRole('menuitem',{name:'Page details',exact:true}).press('Enter');await page.getByRole('dialog',{name:'Page details',exact:true}).waitFor();assert.ok((await page.getByRole('dialog').innerText()).includes(f[kind].id));await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Page actions');
        await menu('Export and recovery');const dialog=page.getByRole('dialog',{name:'Export and recovery',exact:true});await dialog.waitFor();
        for(const format of kind==='database'?['CSV']:['MD','DOCX','PDF']){const pending=page.waitForEvent('download');await dialog.getByRole('button',{name:'Export '+format,exact:true}).click();const download=await pending;assert.equal(await download.failure(),null);const file=out+'/'+kind+'.'+format.toLowerCase();await download.saveAs(file);receipt.downloads??=[];receipt.downloads.push({path:file,bytes:(await fs.stat(file)).size,sha256:sha(await fs.readFile(file))});await page.waitForFunction(label=>![...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent===label)?.disabled,'Export '+format);}
        assert.ok(await dialog.getByRole('button',{name:'Attach file',exact:true}).isEnabled());await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
      }
    });
    await open(f.page.title);
    await check('compact-header-reachable-commands-and-resize-focus',async()=>{
      await page.setViewportSize({width:700,height:600});await btn('Home').click();await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);await settle();await editor.evaluate(e=>e.dataset.compactIdentity='same-editor');
      await page.evaluate(()=>{window.__wsFocusTrace=[];window.__wsTraceFocus=e=>{window.__wsFocusTrace.push({tag:e.target.tagName,label:e.target.getAttribute('aria-label')});if(window.__wsFocusTrace.length>20)window.__wsFocusTrace.shift();};document.addEventListener('focusin',window.__wsTraceFocus,true);});
      await editor.focus();assert.equal(await editor.evaluate(e=>e===document.activeElement),true);await page.setViewportSize({width:420,height:540});await page.locator('.ws-topbar-compact').waitFor();await settle();assert.equal(await editor.getAttribute('data-compact-identity'),'same-editor');const focusProof=await page.evaluate(()=>({active:document.activeElement?.getAttribute('aria-label'),events:window.__wsFocusTrace}));receipt.compactResizeFocus=focusProof;assert.equal(await editor.evaluate(e=>e===document.activeElement),true,JSON.stringify(focusProof));await page.evaluate(()=>{document.removeEventListener('focusin',window.__wsTraceFocus,true);delete window.__wsTraceFocus;delete window.__wsFocusTrace;});
      await btn('Workspace menu').focus();await page.keyboard.press('Enter');await page.getByRole('menuitem',{name:'Home',exact:true}).waitFor();await page.getByRole('menuitem',{name:'New page',exact:true}).press('Enter');await page.getByRole('dialog',{name:'New page',exact:true}).waitFor();await shot('compact-header-new-page');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Workspace menu');
      await btn('Workspace menu').click();await page.getByRole('menuitem',{name:'Home',exact:true}).click();await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);
      await page.setViewportSize({width:700,height:600});await btn('Home').waitFor();await btn('Home').focus();await page.setViewportSize({width:420,height:540});await page.locator('.ws-topbar-compact').waitFor();await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Workspace menu');await shot('compact-header-focus');
    });
    await check('deep-narrow-short-enlarged-actual-geometry',async()=>{
      for(const mode of ['Dark','Light']){
        await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).waitFor();await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');
        await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);
      for(const [width,height,zoom] of [[950,600,1],[700,500,1],[420,540,1],[950,420,1.5],[420,420,1.5]]){
        await page.setViewportSize({width,height});await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
        const b=await geometry(`${mode}-${width}x${height}-css-root-zoom-${zoom}`);assert.ok(b.main.width>200);assert.ok(b.main.scrollWidth<=b.main.clientWidth+1);
        const visible=await separator.isVisible();if(visible){assert.ok(Math.abs(b.main.x-b.handle.right)<2);assert.ok(Math.abs(b.main.y-b.body.y)<2);}else{assert.ok(b.main.y>=b.nav.bottom-1);}
        await shot(`geometry-${mode}-${width}-${height}-${zoom}`);
        if(width===420&&zoom===1.5){
          await btn('Page actions').scrollIntoViewIfNeeded();await menu('Page details');const dialog=page.getByRole('dialog',{name:'Page details',exact:true});await dialog.waitFor();const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);await shot(`details-reachable-${mode}-${width}-${height}-${zoom}`);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.locator('.ws-work').evaluate(e=>e.scrollTop=0);
        }
      }
      await page.evaluate(()=>document.documentElement.style.zoom='1');await page.setViewportSize({width:1600,height:1000});
      }
    });
    await check('bounded-repeated-mount-search-navigation-resources',async()=>{
      await page.evaluate(()=>{
        const counts=window.__laneAResources={observers:0,listeners:0,timeouts:0,frames:0,objectURLs:0};
        const RO=window.ResizeObserver;
        window.ResizeObserver=class extends RO {
          constructor(fn){super(fn);this.targets=new WeakSet();this.count=0;}
          observe(target,options){if(target.closest?.('.ws-root')&&!this.targets.has(target)){this.targets.add(target);this.count++;counts.observers++;}return super.observe(target,options);}
          unobserve(target){if(this.targets.delete(target)){this.count--;counts.observers--;}return super.unobserve(target);}
          disconnect(){counts.observers-=this.count;this.count=0;this.targets=new WeakSet();return super.disconnect();}
        };
        const records=new WeakMap(),add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
        const plugin=()=>new Error().stack.includes('blob:');
        EventTarget.prototype.addEventListener=function(type,listener,options){
          if(listener&&plugin()){let map=records.get(this);if(!map)records.set(this,map=new Map());let keys=map.get(listener);if(!keys)map.set(listener,keys=new Set());const key=type+':'+Boolean(typeof options==='boolean'?options:options?.capture);if(!keys.has(key)){keys.add(key);counts.listeners++;}}
          return add.call(this,type,listener,options);
        };
        EventTarget.prototype.removeEventListener=function(type,listener,options){const keys=records.get(this)?.get(listener),key=type+':'+Boolean(typeof options==='boolean'?options:options?.capture);if(keys?.delete(key)){counts.listeners--;if(!keys.size)records.get(this).delete(listener);}return remove.call(this,type,listener,options);};
        const timers=new Set(),timeout=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window);
        window.setTimeout=(fn,delay,...args)=>{if(typeof fn!=='function'||!plugin())return timeout(fn,delay,...args);let id=timeout((...a)=>{if(timers.delete(id))counts.timeouts--;fn(...a);},delay,...args);timers.add(id);counts.timeouts++;return id;};
        window.clearTimeout=id=>{if(timers.delete(id))counts.timeouts--;return clear(id);};
        const frames=new Set(),raf=window.requestAnimationFrame.bind(window),caf=window.cancelAnimationFrame.bind(window);
        window.requestAnimationFrame=fn=>{if(!plugin())return raf(fn);let id=raf(t=>{if(frames.delete(id))counts.frames--;fn(t);});frames.add(id);counts.frames++;return id;};
        window.cancelAnimationFrame=id=>{if(frames.delete(id))counts.frames--;return caf(id);};
        const urls=new Set(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
        URL.createObjectURL=blob=>{const url=create(blob);if(plugin()){urls.add(url);counts.objectURLs++;}return url;};URL.revokeObjectURL=url=>{if(urls.delete(url))counts.objectURLs--;return revoke(url);};
      });
      const retire=async()=>{
        if(['resources-workspace','changed'].includes(phase)){
          await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn('Dark').waitFor();
        }else{await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');await enabled.waitFor();}
      };
      const samples=[];receipt.pickerCycles=[];
      for(let i=0;i<15;i++){
        await retire();await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);
        await editor.focus();const search=page.getByRole('textbox',{name:'Search Workspace',exact:true});await search.fill('Field observation 299');await page.locator('.ws-search-results').getByRole('button',{name:'Field observation 299',exact:true}).waitFor();await search.fill('');await settle();
        await page.getByText('Linked Hermes thread',{exact:true}).click();await btn('Select existing thread').click();
        const picker=page.getByRole('dialog',{name:'Select existing thread',exact:true});await picker.waitFor();
        await picker.getByRole('textbox',{name:'Search recent native threads',exact:true}).fill('synthetic field');
        if(i%3!==0)await picker.locator('.ws-thread-results[aria-busy="false"]').waitFor({state:'attached'});
        receipt.pickerCycles.push({cycle:i+1,closedWhileBusy:await picker.locator('.ws-thread-results').getAttribute('aria-busy')==='true',error:await picker.getByRole('alert').count()>0});
        await picker.getByRole('button',{name:'Cancel',exact:true}).click();await picker.waitFor({state:'hidden'});
        if([4,9,14].includes(i)){const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');samples.push({cycle:i+1,owned:await page.evaluate(()=>({...window.__laneAResources})),...await cdp.send('Memory.getDOMCounters'),...await cdp.send('Runtime.getHeapUsage')});await cdp.detach();}
      }
      await retire();await settle();
      const retired=await page.evaluate(()=>({...window.__laneAResources}));
      receipt.resources={samples,retired,limits:'15 actual host mount/editor-focus/search/picker-open-filter-close cycles on the source recorded in this invocation, including close during pending reads where observed. Providerless fixture may return unavailable/empty thread results; full-history and installed-native search are not qualified. Observer targets inside Workspace and listener/timer/frame/URL calls directly from plugin blob frames are instrumented; SDK-internal query caching is not directly enumerated. Whole-renderer samples include host caches; no retaining-path cause or mathematical zero-leak claim.'};
      receipt.resources.retirementRoute=['resources-workspace','changed'].includes(phase)?'Existing host Appearance settings route, without opening animated plugin catalog during measured cycles. No animation cancellation/core/product changes. Original catalog-inclusive FAILs remain.':'Capabilities plugin catalog; whole-renderer measurements include its animations and caches.';
      if(phase==='resources-diagnose'){
        const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');
        const chunks=[];const collect=event=>chunks.push(event.chunk);cdp.on('HeapProfiler.addHeapSnapshotChunk',collect);
        await cdp.send('HeapProfiler.takeHeapSnapshot',{});cdp.off('HeapProfiler.addHeapSnapshotChunk',collect);
        await fs.writeFile(out+'/RETIRED.heapsnapshot',chunks.join(''),{mode:0o600});
        const detached=await cdp.send('DOM.getDetachedDomNodes');await fs.writeFile(out+'/DETACHED-DOM.json',JSON.stringify(detached),{mode:0o600});await cdp.detach();
        receipt.heapDiagnosis={rawSnapshot:out+'/RETIRED.heapsnapshot',detachedDOM:out+'/DETACHED-DOM.json',detachedTreeCount:detached.detachedNodes.length,snapshotBeforeDOMEnumeration:true,scope:'Only task-private synthetic browser; raw snapshot may contain ephemeral synthetic session tokens and stays private, not a reviewer/delivery attachment. Retaining-path diagnosis pending.'};await save();
      }
      assert.ok(samples[2].nodes<samples[0].nodes*1.5);assert.ok(samples[2].jsEventListeners<samples[0].jsEventListeners*1.5);
      assert.deepEqual(retired,{observers:0,listeners:0,timeouts:0,frames:0,objectURLs:0});
    });
    await check('actual-host-capture-and-focused-editor-keyboard-routing',async()=>{
      // A focused run skips the preceding resource group's unmount. Explicitly
      // retire/reopen the plugin so this setup starts at Home in either mode.
      await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');await enabled.waitFor();
      await page.goto('http://127.0.0.1:19444/#/workspace');
      await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);
      await page.setViewportSize({width:1600,height:1000});
      await page.evaluate(()=>{
        window.__workspaceKeyClaims=[];
        document.addEventListener('keydown',event=>{
          if(event.ctrlKey&&['b','i','u','z','y','m'].includes(event.key.toLowerCase()))
            window.__workspaceKeyClaims.push({key:event.key.toLowerCase(),alt:event.altKey,shift:event.shiftKey,hostClaimed:event.defaultPrevented});
        },true); // Read-only observer AFTER actual window capture, BEFORE editor bubbling.
      });
      const selectPlain=async()=>{
        await editor.focus();await editor.evaluate(el=>{
          const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
          while(node=walker.nextNode())if(node.textContent.length>=4&&!node.parentElement.closest('h1,h2,h3,h4,h5,h6'))break;
          if(!node)throw Error('Synthetic plain passage unavailable');
          const range=document.createRange();range.setStart(node,0);range.setEnd(node,4);
          getSelection().removeAllRanges();getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));
        });await settle();
      };
      const sidebar=btn('Show sidebar');
      for(const target of [page.locator('.ws-work'),editor]){
        await target.focus();const before=await sidebar.isVisible(),html=await editor.innerHTML();
        await page.keyboard.press('Control+b');assert.equal(await sidebar.isVisible(),!before);
        await page.keyboard.press('Control+b');assert.equal(await sidebar.isVisible(),before);
        assert.equal(await editor.innerHTML(),html,'host Ctrl+B never formats');
      }
      await selectPlain();const beforeShift=await editor.innerHTML();
      await page.keyboard.press('Control+Shift+b');assert.equal(await editor.innerHTML(),beforeShift);
      const dialogOpened=await page.getByRole('dialog').count()>0;
      if(dialogOpened)await page.keyboard.press('Escape');
      await selectPlain();assert.equal(await editor.evaluate(()=>document.queryCommandState('bold')),false);
      await page.keyboard.press('Control+Alt+b');assert.equal(await editor.evaluate(()=>document.queryCommandState('bold')),true);
      await page.keyboard.press('Control+z');assert.equal(await editor.evaluate(()=>document.queryCommandState('bold')),false);
      await page.keyboard.press('Control+Shift+z');assert.equal(await editor.evaluate(()=>document.queryCommandState('bold')),true);
      await page.keyboard.press('Control+z');await page.keyboard.press('Control+y');assert.equal(await editor.evaluate(()=>document.queryCommandState('bold')),true);
      for(const [key,command] of [['i','italic'],['u','underline']]){
        for(const expected of [true,false]){
          await page.keyboard.press('Control+'+key);await settle();
          const observed=await editor.evaluate((element,command)=>({command,active:document.queryCommandState(command),
            selection:getSelection()?.toString(),focus:document.activeElement?.getAttribute('aria-label'),
            html:document.activeElement?.matches('[contenteditable]')?document.activeElement.innerHTML:null}),command);
          receipt.keyboardSteps??=[];receipt.keyboardSteps.push({key,expected,...observed});await save();
          assert.equal(observed.active,expected,JSON.stringify(observed));
        }
      }
      const outsideHTML=await editor.innerHTML();await page.locator('.ws-title').focus();
      await page.keyboard.press('Control+Alt+b');assert.equal(await editor.innerHTML(),outsideHTML,'title focus cannot format document');
      await selectPlain();await page.keyboard.press('Control+Alt+m');
      await page.getByRole('textbox',{name:'New comment',exact:true}).waitFor();await btn('Cancel comment').click();
      const claims=await page.evaluate(()=>window.__workspaceKeyClaims);
      assert.equal(claims.filter(x=>x.key==='b'&&!x.alt&&!x.shift).length,4);
      assert.ok(claims.filter(x=>x.key==='b'&&!x.alt).every(x=>x.hostClaimed));
      assert.ok(claims.filter(x=>x.alt||['i','u','z','y'].includes(x.key)).every(x=>!x.hostClaimed));
      receipt.keyboard={claims,newWorktreeDialogOpened:dialogOpened,scope:'Actual pinned browser-hosted global capture dispatcher plus production editor; Ctrl+B toggles once inside/outside without formatting; scoped CtrlAltB/I/U/undo/redo/Comment exercised.',limits:'No eligible native project is required by this fixture: CtrlShiftB capture claim is checked, not actual worktree creation. Installed Electron/effective real-user custom bindings and running native chat remain unqualified.'};
      await shot('host-keyboard-proof');
    });
    if(phase==='review26'){
      const modeSetup=async mode=>{await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();};
      await check('review26-whole-database-representative',async()=>{
        for(const mode of ['Light','Dark']){await modeSetup(mode);await open(f.database.title);const db=page.locator('.ws-database'),table=db.locator('.ws-table');await table.waitFor();await shot('review26-populated-typed-grid-'+mode);const row=table.locator('tbody tr').filter({has:page.getByRole('button',{name:'Record document',exact:true})});const count=row.getByRole('spinbutton',{name:'Count',exact:true});await count.fill('7');await count.press('Tab');await page.waitForFunction(()=>document.body.innerText.includes('14'));await shot('review26-typed-edit-'+mode);await btn('Sort').click();await shot('review26-sort-'+mode);await page.keyboard.press('Escape');await row.getByRole('button',{name:'Record document',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ws-title')?.value==='Record document');await shot('review26-record-properties-'+mode);await open(f.database.title);await choose('View','Board',db);await shot('review26-whole-grouped-board-'+mode);await choose('View','Table',db);await btn('Add property').click();const form=page.getByRole('form',{name:'New property',exact:true});await form.getByRole('textbox',{name:'Property name',exact:true}).fill('Formula recovery');await choose('Property type','Formula',form);await form.getByRole('textbox',{name:'Formula expression',exact:true}).fill('not_a_function(1)');await form.getByRole('button',{name:'Add property',exact:true}).click();await form.getByRole('alert').waitFor();await shot('review26-formula-error-recovery-'+mode);await form.getByRole('button',{name:'Cancel',exact:true}).click();}
      });
      await check('review26-visible-scope-and-picker-actions',async()=>{
        for(const mode of ['Light','Dark']){await modeSetup(mode);await open(f.page.title);await btn('Address comments (1)').click();const review=page.getByRole('dialog',{name:'Review edits for this run',exact:true});const details=review.locator('details.ws-related-scope');await details.locator(':scope > summary').click();const search=review.getByRole('textbox',{name:'Find related items',exact:true});await search.fill('Field observation');const box=review.getByRole('checkbox').first();assert.equal(await box.getAttribute('aria-checked'),'false');const selectedName=await box.getAttribute('aria-label');await box.click();await search.fill('no-such-result');await search.fill('');assert.equal(await review.getByRole('checkbox',{name:selectedName,exact:true}).getAttribute('aria-checked'),'true');const cancel=review.getByRole('button',{name:'Cancel',exact:true});const action=review.getByRole('button',{name:'Address selected scope',exact:true});const contain=async target=>{const b=await target.boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=page.viewportSize().height,JSON.stringify(b));};await contain(cancel);await contain(action);await shot('review26-scope-visible-actions-'+mode);await cancel.click();await page.getByText('Linked Hermes thread',{exact:true}).click();await page.evaluate(()=>window.__wsRecentMode='positive');await btn('Select existing thread').click();const picker=page.getByRole('dialog',{name:'Select existing thread',exact:true});await picker.getByRole('textbox',{name:'Search recent native threads',exact:true}).fill('Seasonal');await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');const pc=picker.getByRole('button',{name:'Cancel',exact:true});await contain(pc);await shot('review26-picker-visible-cancel-'+mode+'-420-175');await page.keyboard.press('Escape');await picker.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Select existing thread');await page.evaluate(()=>document.documentElement.style.zoom='1');}
      });
    }
    if(phase==='comment-fixes'){
      const readState=()=>page.evaluate(async()=>{const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);return(await(await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}})).json());});
      const position=()=>page.locator('.ws-work').evaluate(e=>({top:e.scrollTop,left:e.scrollLeft}));
      const preserve=async(label,submit)=>{await submit.scrollIntoViewIfNeeded();const before=await position();assert.ok(before.top>1000,JSON.stringify(before));const identity=await page.getByRole('textbox',{name:'Page content',exact:true}).elementHandle();await page.evaluate(()=>{window.__saveScroll=[];window.__saveScrollListener=e=>{if(e.target.matches?.('.ws-work'))window.__saveScroll.push(e.target.scrollTop);};document.addEventListener('scroll',window.__saveScrollListener,true);});await submit.click();await page.waitForFunction(()=>{const e=document.querySelector('textarea[aria-label="New comment"]');return !e||e.value==='';});await page.evaluate(async()=>{await new Promise(resolve=>{let n=0;const next=()=>{window.__saveScroll.push(document.querySelector('.ws-work').scrollTop);if(++n===6)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);});document.removeEventListener('scroll',window.__saveScrollListener,true);});const after=await position(),samples=await page.evaluate(()=>window.__saveScroll);receipt.scrollProof??=[];receipt.scrollProof.push({label,before,after,samples,sameEditor:await identity.evaluate(e=>e.isConnected&&e===document.querySelector('.ws-editor'))});await save();assert.ok(Math.abs(after.top-before.top)<=2,JSON.stringify({label,before,after,samples}));assert.ok(samples.every(n=>Math.abs(n-before.top)<=2),JSON.stringify({label,before,samples}));assert.equal(await identity.evaluate(e=>e.isConnected&&e===document.querySelector('.ws-editor')),true);};
      await check('comment-fixes-independent-ids-and-painted-ranges',async()=>{await page.setViewportSize({width:1600,height:1000});await open(f.page.title);await page.getByText('Landmark 035',{exact:true}).scrollIntoViewIfNeeded();await settle();const state=await readState();const a=state.comments.find(c=>c.id===f.commentFix.first.id),b=state.comments.find(c=>c.id===f.commentFix.second.id);assert.equal(a.text,'Independent first request');assert.equal(b.text,'Independent second request');assert.equal(a.replies.at(-1).text,'Simulated first outcome');assert.equal(b.replies.at(-1).text,'Simulated second outcome');assert.equal(a.resolved,false);assert.equal(b.resolved,false);const ranges=await page.evaluate(()=>[...CSS.highlights].filter(([key])=>/^ws-passage-[^-]+$/.test(key)).flatMap(([name,h])=>[...h].map(r=>({name,text:r.toString(),rects:[...r.getClientRects()].map(b=>({width:b.width,height:b.height}))}))));const visible=[];for(const c of [a,b])visible.push({id:c.id,visible:await page.locator('#ws-bubble-'+c.id).isVisible()});receipt.independentComments={comments:[a,b],painted:ranges,visible,scope:f.commentFix.scope};await shot('comment-independent-ranges');assert.ok(visible.every(x=>x.visible),'Each independent discussion has its own rendered bubble: '+JSON.stringify(visible));assert.equal(a.section_change.anchor.quote,'addressed');assert.equal(b.section_change.anchor.quote,'addressed');assert.equal(ranges.filter(r=>r.text==='addressed').length,2);});
      await check('comment-fixes-whole-page-save-keeps-scroll',async()=>{await open(f.page.title);for(const [n,text]of [[1,'Short whole-page feedback'],[2,'Long whole-page feedback. '.repeat(24)]]){const action=btn('Comment on whole page');if(await action.count()){await action.scrollIntoViewIfNeeded();await action.click();}const composer=page.getByRole('textbox',{name:'New comment',exact:true});await composer.fill(text);await preserve('whole'+n,btn('Add comment'));const state=await readState();assert.equal(state.comments.filter(c=>c.text===text).length,1);}await shot('comment-save-reading-position');});
      await check('comment-fixes-anchored-save-keeps-scroll',async()=>{await open(f.page.title);for(const i of [45,55]){const landmark=page.getByText('Landmark '+String(i).padStart(3,'0'),{exact:true});await landmark.scrollIntoViewIfNeeded();await landmark.dblclick();await page.getByRole('button',{name:'Add comment on selection',exact:true}).click();const composer=page.getByRole('textbox',{name:'New comment',exact:true});await composer.fill('Anchored saved feedback '+i);await preserve('anchored'+i,btn('Add comment'));const state=await readState();const c=state.comments.find(c=>c.text==='Anchored saved feedback '+i);assert.ok(c.anchor?.quote);}});
    }
    if(phase==='comment-fixes'){
      const position=()=>page.locator('.ws-work').evaluate(e=>({top:e.scrollTop,left:e.scrollLeft}));
      await check('comment-fixes-explicit-passage-navigation-and-user-scroll',async()=>{
        const bubble=page.locator('#ws-bubble-'+f.commentFix.first.id);await bubble.scrollIntoViewIfNeeded();await bubble.click();const action=page.locator('#ws-discussion-'+f.commentFix.first.id).getByRole('button',{name:/^Show passage for comment \d+$/});await action.click();const selected=await page.evaluate(()=>({text:getSelection()?.toString(),focused:document.activeElement?.getAttribute('aria-label'),top:document.querySelector('.ws-work').scrollTop}));assert.equal(selected.text,'addressed');assert.equal(selected.focused,'Page content');assert.ok(selected.top>0);await page.getByRole('textbox',{name:'Page content',exact:true}).hover();const before=await position();await page.mouse.wheel(0,350);await page.waitForFunction(n=>document.querySelector('.ws-work').scrollTop>n,before.top);const after=await position();await page.evaluate(async()=>{for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);});assert.ok((await position()).top>=after.top);receipt.deliberateNavigation={selected,before,after};
      });
    }
    if(phase==='review27'){
      const modeSetup=async mode=>{await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();};
      await check('review27-whole-database-representative',async()=>{
        for(const mode of ['Light','Dark']){await modeSetup(mode);await open(f.database.title);const db=page.locator('.ws-database'),table=db.locator('.ws-table');await table.waitFor();await shot('review27-populated-typed-grid-'+mode);const row=table.locator('tbody tr').filter({has:page.getByRole('button',{name:'Record document',exact:true})});const count=row.getByRole('spinbutton',{name:'Count',exact:true});await count.fill('7');await count.press('Tab');await page.waitForFunction(()=>document.body.innerText.includes('14'));await shot('review27-typed-edit-'+mode);await btn('Sort').click();await shot('review27-sort-'+mode);await page.keyboard.press('Escape');await row.getByRole('button',{name:'Record document',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ws-title')?.value==='Record document');await shot('review27-record-properties-'+mode);await open(f.database.title);await choose('View','Board',db);await shot('review27-whole-grouped-board-'+mode);await choose('View','Table',db);await btn('Add property').click();const form=page.getByRole('form',{name:'New property',exact:true});await form.getByRole('textbox',{name:'Property name',exact:true}).fill('Formula recovery');await choose('Property type','Formula',form);await form.getByRole('textbox',{name:'Formula expression',exact:true}).fill('not_a_function(1)');await form.getByRole('button',{name:'Add property',exact:true}).click();await form.getByRole('alert').waitFor();await shot('review27-formula-error-recovery-'+mode);await form.getByRole('button',{name:'Cancel',exact:true}).click();}
      });
      await check('review27-visible-scope-and-picker-actions',async()=>{
        for(const mode of ['Light','Dark']){await modeSetup(mode);await open(f.page.title);await btn('Address comments (1)').click();const review=page.getByRole('dialog',{name:'Review edits for this run',exact:true});const details=review.locator('details.ws-related-scope');await details.locator(':scope > summary').click();const search=review.getByRole('textbox',{name:'Find related items',exact:true});await search.fill('Field observation');const box=review.getByRole('checkbox').first();assert.equal(await box.getAttribute('aria-checked'),'false');const selectedName=await box.getAttribute('aria-label');await box.click();await search.fill('no-such-result');await search.fill('');assert.equal(await review.getByRole('checkbox',{name:selectedName,exact:true}).getAttribute('aria-checked'),'true');const cancel=review.getByRole('button',{name:'Cancel',exact:true});const action=review.getByRole('button',{name:'Address selected scope',exact:true});const contain=async target=>{const b=await target.boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=page.viewportSize().height,JSON.stringify(b));};await contain(cancel);await contain(action);await shot('review27-scope-visible-actions-'+mode);await cancel.click();await page.getByText('Linked Hermes thread',{exact:true}).click();await page.evaluate(()=>window.__wsRecentMode='positive');await btn('Select existing thread').click();const picker=page.getByRole('dialog',{name:'Select existing thread',exact:true});await picker.getByRole('textbox',{name:'Search recent native threads',exact:true}).fill('Seasonal');await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');const pc=picker.getByRole('button',{name:'Cancel',exact:true});await contain(pc);await shot('review27-picker-visible-cancel-'+mode+'-420-175');await page.keyboard.press('Escape');await picker.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Select existing thread');await page.evaluate(()=>document.documentElement.style.zoom='1');}
      });
      await check('review27-narrow-whole-board-context',async()=>{
        await modeSetup('Light');await open(f.database.title);const db=page.locator('.ws-database');await choose('View','Board',db);await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');const board=db.locator('.ws-board');await board.scrollIntoViewIfNeeded();const groups=board.getByRole('region');const names=await groups.evaluateAll(a=>a.map(e=>e.getAttribute('aria-label')));assert.ok(names.length>=4);receipt.narrowBoard={names,scope:'Current production board,420x540CSS175%; real horizontal scrolling and normal creation controls, not native device proof.'};const first=page.getByRole('region',{name:'Board group: Planned',exact:true});await first.locator('h3').scrollIntoViewIfNeeded();await first.getByRole('button',{name:'Garden survey',exact:true}).waitFor();await shot('review27-narrow-board-heading-card');const last=page.getByRole('region',{name:'Board group: Unassigned',exact:true});await last.locator('h3').scrollIntoViewIfNeeded();const add=last.getByRole('button',{name:'New record in Unassigned',exact:true});await add.scrollIntoViewIfNeeded();const hit=await add.evaluate(e=>{const b=e.getBoundingClientRect(),t=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {hit:t===e||e.contains(t),x:b.x,y:b.y,right:b.right,bottom:b.bottom};});assert.ok(hit.hit,JSON.stringify(hit));await shot('review27-narrow-board-scroll-target');await add.click();const title=last.getByRole('textbox',{name:'New record title',exact:true});await title.fill('Narrow board entry');await last.getByRole('button',{name:'Create record',exact:true}).click();await last.getByRole('button',{name:'Narrow board entry',exact:true}).waitFor();await shot('review27-narrow-board-created');await last.getByRole('button',{name:'Cancel new record',exact:true}).click();await page.evaluate(()=>document.documentElement.style.zoom='1');
      });
    }
    if(phase==='review25'){
      const db=page.getByRole('region',{name:'Database',exact:true});
      const docState=async id=>page.evaluate(async id=>{const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);return (await(await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}})).json()).items.find(i=>i.id===id);},id);
      await check('review25-numbered-editor-persistence',async()=>{
        await open(f.numbered.title);const editor=page.getByRole('textbox',{name:'Page content',exact:true});assert.equal(await editor.locator('ol').first().getAttribute('start'),'3');assert.equal(await editor.locator('ol ol').getAttribute('start'),'7');await editor.click();await editor.press('Control+End');await page.keyboard.type(' Ordinary saved edit.');
        await page.waitForFunction(async id=>{const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);const state=await(await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}})).json();return state.items.find(i=>i.id===id)?.content.includes('Ordinary saved edit.');},f.numbered.id);const saved=await docState(f.numbered.id);assert.match(saved.content,/<ol start="3">/);assert.match(saved.content,/<ol start="7">/);await open(f.page.title);await open(f.numbered.title);assert.equal(await editor.locator('ol').first().getAttribute('start'),'3');await menu('Export and recovery');const dialog=page.getByRole('dialog',{name:'Export and recovery',exact:true});const [download]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Export DOCX',exact:true}).click()]);await download.saveAs(out+'/numbered-edited.docx');receipt.numberedExport={path:out+'/numbered-edited.docx',sha256:sha(await fs.readFile(out+'/numbered-edited.docx'))};await page.keyboard.press('Escape');await shot('review25-numbered-reopened');
      });
      await check('review25-composition-and-normal-escape',async()=>{
        await open(f.page.title);await btn('Comment on whole page').click();let input=page.getByRole('textbox',{name:'New comment',exact:true});await input.fill('Keep composing feedback');await input.evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true}));});assert.equal(await input.inputValue(),'Keep composing feedback');await input.evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await input.press('Escape');await input.waitFor({state:'hidden'});
        await open(f.database.title);await btn('New record').click();input=page.getByRole('textbox',{name:'New record title',exact:true});await input.fill('Keep composing record');await input.evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true}));});assert.equal(await input.inputValue(),'Keep composing record');await input.evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await input.press('Escape');await input.waitFor({state:'hidden'});receipt.compositionScope='Synthetic DOM composition events on actual rendered controls; normal trusted Escape contrasted. Not OS/native IME execution.';
      });
      await check('review25-creation-drafts-guard-navigation',async()=>{
        await open(f.database.title);await btn('New record').click();const title=page.getByRole('textbox',{name:'New record title',exact:true});await title.fill('Retained pending record');await btn('Create record').click();await page.getByRole('alert').filter({hasText:'Synthetic creation temporarily unavailable'}).waitFor();await page.locator('.ws-nav').getByRole('button',{name:f.page.title,exact:true}).first().click();assert.equal(await page.locator('.ws-title').inputValue(),f.database.title);assert.equal(await title.inputValue(),'Retained pending record');await btn('Cancel new record').click();await open(f.page.title);await open(f.database.title);
        await btn('Add property').click();const form=page.getByRole('form',{name:'New property',exact:true});await form.getByRole('textbox',{name:'Property name',exact:true}).fill('Unfinished property');await choose('Property type','Number',form);await page.locator('.ws-nav').getByRole('button',{name:f.page.title,exact:true}).first().click();assert.equal(await page.locator('.ws-title').inputValue(),f.database.title);if(!await form.isVisible())await btn('Add property').click();await form.waitFor();assert.equal(await form.getByRole('textbox',{name:'Property name',exact:true}).inputValue(),'Unfinished property');assert.equal(await form.getByRole('combobox',{name:'Property type',exact:true}).textContent(),'Number');assert.equal(await page.locator('.ws-title').inputValue(),f.database.title);await form.getByRole('button',{name:'Cancel',exact:true}).click();await open(f.page.title);receipt.creationGuard='Internal Workspace navigation explicitly blocked for failed/unfinished creation; user Cancel releases guard; no silent autocreate. Host/plugin unmount retention not qualified.';
      });
      await check('review25-real-narrow-board-picker-and-scope',async()=>{
        for(const mode of ['Light','Dark']){
          await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.database.title);await choose('View','Board',db);
          const names=await db.locator('.ws-board-group').evaluateAll(nodes=>nodes.map(e=>e.getAttribute('aria-label')));assert.equal(names.length,5);assert.equal(new Set(names).size,5);const label='Unassigned (no value) (no value) (no value)';const group=page.getByRole('region',{name:'Board group: '+label,exact:true});await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');const add=group.getByRole('button',{name:'New record in '+label,exact:true});await add.scrollIntoViewIfNeeded();const hit=await add.evaluate(e=>{const b=e.getBoundingClientRect(),h=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {hit:h===e||e.contains(h),x:b.x,y:b.y,width:b.width,height:b.height};});assert.ok(hit.hit,JSON.stringify(hit));await add.click();await group.getByRole('textbox',{name:'New record title',exact:true}).fill('Second order '+mode);await group.getByRole('button',{name:'Create record',exact:true}).click();await group.getByRole('button',{name:'Second order '+mode,exact:true}).waitFor();await shot('review25-actual-board-controls-'+mode+'-420-175');await group.getByRole('button',{name:'Cancel new record',exact:true}).click();receipt.boardControls??=[];receipt.boardControls.push({mode,...hit,groupNames:names});await page.evaluate(()=>document.documentElement.style.zoom='1');await page.setViewportSize({width:1600,height:1000});await open(f.page.title);await page.getByText('Linked Hermes thread',{exact:true}).click();await page.evaluate(()=>window.__wsRecentMode='positive');await btn('Select existing thread').click();const picker=page.getByRole('dialog',{name:'Select existing thread',exact:true});await picker.getByRole('textbox',{name:'Search recent native threads',exact:true}).fill('Seasonal');await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');await shot('review25-compact-picker-'+mode+'-420-175');await picker.getByRole('button',{name:'Cancel',exact:true}).click();await picker.waitFor({state:'hidden'});await page.evaluate(()=>document.documentElement.style.zoom='1');
        }
        await page.setViewportSize({width:1200,height:850});await btn('Address comments (1)').click();const review=page.getByRole('dialog',{name:'Review edits for this run',exact:true});await review.waitFor();await review.getByRole('button',{name:'Address current page',exact:true}).waitFor();const details=review.locator('details.ws-related-scope');assert.equal(await details.getAttribute('open'),null);await details.locator(':scope > summary').click();const search=review.getByRole('textbox',{name:'Find related items',exact:true});await search.fill('Observations database');const checks=review.getByRole('checkbox');assert.ok(await checks.count()>0);assert.equal(await checks.first().getAttribute('aria-checked'),'false');await checks.first().click();await review.getByRole('button',{name:'Address selected scope',exact:true}).waitFor();await shot('review25-searchable-explicit-scope');await review.getByRole('button',{name:'Cancel',exact:true}).click();receipt.scopeReview='Current-page path compact; related choices explicitly unchecked/searchable, selection remains single existing review; cancelled before any native/provider start or review-grant call.';
      });
    }
    if(phase==='review24')await check('review24-select-identities-and-docx',async()=>{
      const db=page.getByRole('region',{name:'Database',exact:true});
      const saved=async()=>page.evaluate(async id=>{const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);const state=await(await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}})).json();return state.items.find(i=>i.id===id);},f.record.id);
      await open(f.database.title);let property=db.locator('tbody tr').filter({has:page.getByRole('button',{name:'Record document',exact:true})}).getByRole('combobox',{name:'Status',exact:true});
      await property.click();await page.getByRole('option',{name:'__none',exact:true}).click();
      await page.waitForFunction(async id=>{const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);const state=await(await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}})).json();return state.items.find(i=>i.id===id)?.properties.status==='__none';},f.record.id,{timeout:2500});
      assert.equal((await saved()).properties.status,'__none');
      for(const value of ['Unassigned','option:0','No value']){await property.click();await page.getByRole('option',{name:value,exact:true}).click();const expected=value==='No value'?null:value;await page.waitForFunction(async({id,expected})=>{const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);const s=await(await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}})).json();return s.items.find(i=>i.id===id)?.properties.status===expected;},{id:f.record.id,expected});assert.equal((await saved()).properties.status,expected);}
      await choose('View','Board',db);await choose('Group board by','Status',db);await choose('View','Table',db);
      for(const mode of ['Light','Dark']){
        await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.database.title);await shot('review24-grid-'+mode);await choose('View','Board',db);await shot('review24-board-'+mode);await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');await shot('review24-board-'+mode+'-420-175');await page.evaluate(()=>document.documentElement.style.zoom='1');await page.setViewportSize({width:1600,height:1000});await open(f.page.title);await page.getByText('Linked Hermes thread',{exact:true}).click();await page.evaluate(()=>window.__wsRecentMode='positive');await btn('Select existing thread').click();const picker=page.getByRole('dialog',{name:'Select existing thread',exact:true});const search=picker.getByRole('textbox',{name:'Search recent native threads',exact:true});await search.fill('Seasonal');await picker.getByRole('button').filter({hasText:'synthetic-review22-thread-b'}).waitFor();await shot('review24-picker-'+mode);await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');await search.scrollIntoViewIfNeeded();await shot('review24-picker-'+mode+'-420-175');await picker.getByRole('button',{name:'Cancel',exact:true}).click();await picker.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Select existing thread');await page.evaluate(()=>document.documentElement.style.zoom='1');
      }
      await page.setViewportSize({width:1200,height:850});await open(f.page.title);await menu('Export and recovery');const recovery=page.getByRole('dialog',{name:'Export and recovery',exact:true});const [download]=await Promise.all([page.waitForEvent('download'),recovery.getByRole('button',{name:'Export DOCX',exact:true}).click()]);await download.saveAs(out+'/public-code.docx');receipt.publicCodeExport={path:out+'/public-code.docx',sha256:sha(await fs.readFile(out+'/public-code.docx'))};await page.keyboard.press('Escape');
    });
    if(phase==='review23'){
      const database=page.getByRole('region',{name:'Database',exact:true});
      const modeSetup=async mode=>{
        await page.setViewportSize({width:1600,height:1000});await page.evaluate(()=>document.documentElement.style.zoom='1');await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();
      };
      await check('review23-existing-record-context',async()=>{
        for(const mode of ['Light','Dark']){
          await modeSetup(mode);await open(f.database.title);await page.setViewportSize({width:420,height:540});
          await page.evaluate(()=>{
            window.__recordTrace=[];const primitive=e=>({tag:e?.tagName,role:e?.getAttribute?.('role'),aria:e?.getAttribute?.('aria-label'),text:e?.textContent?.slice(0,100),connected:e?.isConnected,row:e?.closest?.('tr')?.textContent?.slice(0,120)});
            window.__recordSample=(boundary,event)=>{window.__recordTrace.push({boundary,time:performance.now(),event:event?.type,key:event?.key,target:primitive(event?.target),active:primitive(document.activeElement),context:document.querySelector('.ws-db-record-context')?.textContent,rows:[...document.querySelectorAll('.ws-table tbody tr')].map(e=>({text:e.textContent.slice(0,100),active:e.classList.contains('ws-db-active-row')})),draft:!!document.querySelector('.ws-db-record-draft')});};
            for(const type of ['pointerdown','click','focusin','focusout','keydown','keyup'])for(const capture of [true,false])document.addEventListener(type,event=>{if(event.target.closest?.('.ws-database')||event.key==='Escape')window.__recordSample(type+(capture?':capture':':bubble'),event);},{capture});
          });
          const property=database.locator('tbody tr').filter({has:page.getByRole('button',{name:'Record document',exact:true})}).getByRole('combobox',{name:'Status',exact:true});
          try{
            await page.evaluate(()=>window.__recordSample('before-click'));await property.click();await page.evaluate(()=>window.__recordSample('after-click'));await page.keyboard.press('Escape');await page.evaluate(()=>window.__recordSample('after-Escape'));
            await page.evaluate(async()=>{for(let n=0;n<6;n++){await new Promise(requestAnimationFrame);window.__recordSample('frame-'+n);}});
            await fs.writeFile(out+'/context-trace-'+mode+'.json',JSON.stringify(await page.evaluate(()=>window.__recordTrace),null,2));await shot('review23-context-after-Escape-'+mode);
            await page.locator('.ws-db-record-context').getByRole('button',{name:'Record document',exact:true}).waitFor({timeout:2000});
            await btn('New record').click();const draft=page.getByRole('textbox',{name:'New record title',exact:true});await draft.waitFor();await page.waitForFunction(()=>document.querySelector('.ws-db-record-context')?.textContent==='New record');await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');await draft.scrollIntoViewIfNeeded();await shot('review23-new-record-context-'+mode+'-420-175');await btn('Cancel new record').click();await page.evaluate(()=>document.documentElement.style.zoom='1');await page.setViewportSize({width:420,height:540});await property.click();await page.keyboard.press('Escape');await page.locator('.ws-db-record-context').getByRole('button',{name:'Record document',exact:true}).waitFor();
          }finally{await fs.writeFile(out+'/context-trace-'+mode+'.json',JSON.stringify(await page.evaluate(()=>window.__recordTrace),null,2));}
        }
      });
      await check('review23-unset-versus-literal-creation',async()=>{
        const {boardGroups}=await import(root+'/frontend/database.mjs');const groups=boardGroups([{id:'unset',properties:{}},{id:'literal',properties:{status:'Unassigned'}}],{id:'status',options:['Unassigned']});assert.equal(groups.get(null)[0].id,'unset');assert.equal(groups.get('Unassigned')[0].id,'literal');
        for(const mode of ['Light','Dark']){
          await modeSetup(mode);await open(f.database.title);await choose('View','Board',database);
          for(const [label,title,value] of [['Unassigned (no value)','Unset '+mode,null],['Unassigned','Literal '+mode,'Unassigned']]){
            const group=page.getByRole('region',{name:'Board group: '+label,exact:true});await group.getByRole('button',{name:'New record in '+label,exact:true}).click();await group.getByRole('textbox',{name:'New record title',exact:true}).fill(title);await group.getByRole('button',{name:'Create record',exact:true}).click();await group.getByRole('button',{name:title,exact:true}).waitFor();await group.getByRole('button',{name:'Cancel new record',exact:true}).click();
            const saved=await page.evaluate(async title=>{const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);const s=await(await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}})).json();return s.items.find(i=>i.title===title);},title);assert.equal(saved.properties.status,value);
          }
          await shot('review23-board-distinct-unset-'+mode);await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');await shot('review23-board-distinct-unset-'+mode+'-420-175');
        }
      });
      await check('review23-picker-description-contrast',async()=>{
        for(const mode of ['Light','Dark'])for(const [width,height,zoom]of [[1600,1000,1],[420,540,1.75]]){
          await modeSetup(mode);await open(f.page.title);await page.getByText('Linked Hermes thread',{exact:true}).click();await page.evaluate(()=>window.__wsRecentMode='positive');await btn('Select existing thread').click();const picker=page.getByRole('dialog',{name:'Select existing thread',exact:true});await picker.getByRole('textbox',{name:'Search recent native threads',exact:true}).waitFor();await page.setViewportSize({width,height});await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);await settle();
          const geometry=await picker.evaluate(e=>{const b=e.getBoundingClientRect(),body=e.querySelector('.ws-thread-picker-body');return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height,innerWidth,innerHeight,zoom:getComputedStyle(document.documentElement).zoom,bodyHeight:body.clientHeight,bodyScroll:body.scrollHeight};});assert.ok(geometry.x>=0&&geometry.y>=0&&geometry.right<=width+1&&geometry.bottom<=height+1,JSON.stringify(geometry));receipt.pickerGeometry??=[];receipt.pickerGeometry.push({mode,...geometry});
          const colors=await picker.locator('.ws-dialog-description').evaluate(e=>{
            const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1,1);const chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);for(const p of chain){ctx.fillStyle=getComputedStyle(p).backgroundColor;ctx.fillRect(0,0,1,1);}const background=[...ctx.getImageData(0,0,1,1).data].slice(0,3);ctx.fillStyle=getComputedStyle(e).color;ctx.fillRect(0,0,1,1);return {foreground:getComputedStyle(e).color,background:getComputedStyle(e.parentElement).backgroundColor,compositedForeground:[...ctx.getImageData(0,0,1,1).data].slice(0,3),compositedBackground:background};
          });const lum=a=>{const b=a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return b[0]*.2126+b[1]*.7152+b[2]*.0722;};const a=lum(colors.compositedForeground),b=lum(colors.compositedBackground),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(contrast>=4.5,JSON.stringify({mode,...colors,contrast}));receipt.pickerDescription??=[];receipt.pickerDescription.push({mode,width,height,zoom,...colors,contrast});
          const search=picker.getByRole('textbox',{name:'Search recent native threads',exact:true});await search.fill('Seasonal');const result=picker.getByRole('button').filter({hasText:'synthetic-review22-thread-b'});await result.waitFor();await result.scrollIntoViewIfNeeded();await result.hover();const resultHit=await result.evaluate(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {width:b.width,height:b.height,hit:e===hit||e.contains(hit)};});assert.ok(resultHit.width>0&&resultHit.height>0&&resultHit.hit,JSON.stringify(resultHit));receipt.pickerResultReachability??=[];receipt.pickerResultReachability.push({mode,width,height,zoom,...resultHit});await shot('review23-picker-'+mode+'-'+width+'-'+zoom);const cancel=picker.getByRole('button',{name:'Cancel',exact:true});await cancel.scrollIntoViewIfNeeded();const hit=await cancel.evaluate(e=>{const b=e.getBoundingClientRect();const t=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {hit:t===e||e.contains(t),x:b.x,y:b.y,right:b.right,bottom:b.bottom};});assert.ok(hit.hit&&hit.x>=0&&hit.y>=0&&hit.right<=width+1&&hit.bottom<=height+1,JSON.stringify(hit));await shot('review23-picker-cancel-'+mode+'-'+width+'-'+zoom);await cancel.click();await picker.waitFor({state:'hidden'});receipt.pickerFocus??=[];receipt.pickerFocus.push(await page.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,100),aria:document.activeElement?.getAttribute('aria-label')})));assert.equal(await btn('Select existing thread').evaluate(e=>e===document.activeElement),true);
          await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Select existing thread');await btn('Select existing thread').click();await picker.waitFor();await page.keyboard.press('Escape');await picker.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Select existing thread');await btn('Select existing thread').click();await picker.waitFor();const close=picker.getByRole('button',{name:'Close',exact:true});await close.click();await picker.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Select existing thread');
        }
      });
    }
    if(phase==='council-smoke')await check('round22-details-comments-recent-picker',async()=>{
      for(const mode of ['Dark','Light']){
        await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);
        await btn('Page actions').focus();await page.keyboard.press('Enter');await page.getByRole('menuitem',{name:'Page details',exact:true}).press('Enter');const details=page.getByRole('dialog',{name:'Page details',exact:true});await details.waitFor();assert.ok((await details.innerText()).includes(f.page.id));if(mode==='Light')await shot('current-page-details-Light');await page.keyboard.press('Escape');await details.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Page actions');
        await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');await btn('Comment on whole page').click();await page.getByRole('textbox',{name:'New comment',exact:true}).waitFor();await shot('current-comments-'+mode+'-420-175');assert.ok(await btn('Cancel comment').isVisible());await btn('Cancel comment').click();await page.evaluate(()=>document.documentElement.style.zoom='1');await page.setViewportSize({width:1600,height:1000});
      }
      const threads=async()=>{await page.getByText('Linked Hermes thread',{exact:true}).click();await btn('Select existing thread').click();await page.getByRole('dialog',{name:'Select existing thread',exact:true}).waitFor();};
      await page.evaluate(()=>window.__wsRecentMode='error');await threads();let picker=page.getByRole('dialog',{name:'Select existing thread',exact:true});await picker.getByRole('alert').waitFor();await shot('current-picker-error');await picker.getByRole('button',{name:'Cancel',exact:true}).click();
      await page.evaluate(()=>window.__wsRecentMode='empty');await btn('Select existing thread').click();picker=page.getByRole('dialog',{name:'Select existing thread',exact:true});await picker.getByText('No recent native threads available.',{exact:true}).waitFor();await shot('current-picker-empty');await picker.getByRole('button',{name:'Cancel',exact:true}).click();
      await page.evaluate(()=>window.__wsRecentMode='positive');await btn('Select existing thread').click();picker=page.getByRole('dialog',{name:'Select existing thread',exact:true});const search=picker.getByRole('textbox',{name:'Search recent native threads',exact:true});await search.fill('Seasonal');await picker.getByRole('button').filter({hasText:'synthetic-review22-thread-b'}).waitFor();await shot('current-picker-positive');await search.press('ArrowDown');await search.press('Enter');await picker.waitFor({state:'hidden'});
      await page.waitForFunction(async id=>{const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);const response=await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}});const state=await response.json();return state.items.find(x=>x.id===id)?.thread_id==='synthetic-review22-thread-b';},f.page.id);await shot('current-picker-bound');receipt.recentThreadSmoke={productionWorkspaceAndAdapter:true,actualPublicSDKControls:true,sessionRPCTransport:'Explicit synthetic live/stored/resume responses, no native gateway/provider/history acceptance.',durableSelectedId:'synthetic-review22-thread-b',restBinding:'Production scoped workflow/bind and Store; checked via authenticated synthetic state readback.'};
    });
    if(phase==='workflows')await check('actual-http-comments-files-and-recovery',async()=>{
      await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');await enabled.waitFor();
      await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();
      const savedState=async()=>page.evaluate(async()=>{
        const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);
        if(!token)throw Error('Synthetic host session is unavailable for readback');
        const response=await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}});
        if(!response.ok)throw Error(`Authenticated synthetic readback HTTP ${response.status}`);
        return response.json();
      });
      const openScope=async kind=>{
        if(kind==='record'){await open(f.database.title);const opener=page.locator('.ws-table').getByRole('button',{name:f.record.title,exact:true});await opener.scrollIntoViewIfNeeded();const before=await opener.boundingBox();await page.mouse.move(before.x+Math.min(20,before.width/2),before.y+before.height/2);await page.mouse.down();const after=await opener.boundingBox();assert.ok(Math.abs(after.y-before.y)<1&&Math.abs(after.x-before.x)<1,JSON.stringify({before,after}));receipt.recordOpeningGeometry??=[];receipt.recordOpeningGeometry.push({before,after,noDriverScrollBetweenPointerDownUp:true});await page.mouse.up();await page.waitForFunction(t=>document.querySelector('.ws-title')?.value===t,f.record.title);}
        else await open(f[kind].title);
      };
      receipt.commentCrud=[];
      for(const kind of ['page','database','record'])for(const resolved of [false,true]){
        await page.setViewportSize({width:420,height:540});await openScope(kind);
        const before=await savedState(),itemId=f[kind].id,original=before.items.find(i=>i.id===itemId).content;
        const existing=before.comments.some(c=>c.item_id===itemId);
        await btn(existing?(kind==='database'?'Comment on database':'Comment on whole page'):(kind==='database'?'Add database comment':'Add whole-page comment')).click();
        const composer=page.getByRole('textbox',{name:'New comment',exact:true});await composer.waitFor();await settle();
        const cancel=await btn('Cancel comment').boundingBox();assert.ok(cancel&&cancel.y>=34&&cancel.y+cancel.height<=520,'empty Cancel immediately contained without driver scroll');
        const text=`Synthetic ${kind} ${resolved?'resolved':'unresolved'} HTTP feedback`;
        await composer.fill(text);await composer.press('Control+Enter');
        await page.waitForFunction(text=>document.body.innerText.includes(text),text);await settle();
        let snapshot=await savedState();const added=snapshot.comments.filter(c=>c.text===text);assert.equal(added.length,1);assert.equal(added[0].item_id,itemId);
        await btn('Cancel comment').click();
        const bubble=page.locator('#ws-bubble-'+added[0].id);
        if(await bubble.getAttribute('aria-expanded')!=='true')await bubble.click();
        if(resolved){
          await page.getByRole('checkbox',{name:'Resolve: '+text,exact:true}).click();
          await bubble.waitFor({state:'hidden'});
          await btn('Comment options').click();await page.getByRole('checkbox',{name:'Show resolved comments',exact:true}).check();await page.keyboard.press('Escape');
          if(await bubble.getAttribute('aria-expanded')!=='true')await bubble.click();
          snapshot=await savedState();assert.equal(snapshot.comments.find(c=>c.id===added[0].id).resolved,true);
        }
        const card=page.locator('#ws-discussion-'+added[0].id);await card.getByRole('button',{name:'Delete comment',exact:true}).click();
        let dialog=page.getByRole('dialog',{name:'Delete comment?',exact:true});await dialog.waitFor();assert.match(await dialog.innerText(),/all its replies/);
        const unchanged=(await savedState()).revision;await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await savedState()).revision,unchanged,'cancel deletes nothing');
        await card.getByRole('button',{name:'Delete comment',exact:true}).click();dialog=page.getByRole('dialog',{name:'Delete comment?',exact:true});
        if(resolved)await shot('resolved-delete-'+kind);
        await dialog.getByRole('button',{name:'Delete comment',exact:true}).click();await dialog.waitFor({state:'hidden'});
        snapshot=await savedState();assert.equal(snapshot.comments.some(c=>c.id===added[0].id),false);assert.equal(snapshot.items.find(i=>i.id===itemId).content,original);
        assert.equal(JSON.stringify(snapshot.versions),JSON.stringify(before.versions));
        assert.equal(snapshot.comments.some(c=>c.id===f.comment.id),true,'unrelated anchored discussion preserved');
        await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');await enabled.waitFor();await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await openScope(kind);
        assert.equal(await page.locator('#ws-bubble-'+added[0].id).count(),0,'fresh mount cannot resurrect deleted discussion');
        receipt.commentCrud.push({kind,resolved,id:added[0].id,serverAbsentAfterReload:true});await save();
      }
      await page.setViewportSize({width:1200,height:850});await open(f.page.title);await menu('Export and recovery');
      let dialog=page.getByRole('dialog',{name:'Export and recovery',exact:true});
      const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAGAAAAAwCAIAAABhdOiYAAAApElEQVR4nO3asQnCUBhG0RdxxoDTiNMIzuQCDmBvr+Rd0M6cU+Z1ly/dv9wfz8G2w+QNgZoFBYGCQEGgIFA4bj2sl+vYmdv59PnRgr5d0CTq/5n8LhYUBAoCBYGCQEGgIFAQKAgUBAoCBYGCQEGgIFAQKAgUBAoCBYGCQEGgIFAQKAgUBAoCBYGCQEGgIFAQKAgUBAoCBYF+O15Y93cE88aCwuKQfM6CgkBBoCBQECgINOZeJBANV92gC30AAAAASUVORK5CYII=','base64');
      const choose=page.waitForEvent('filechooser');await dialog.getByRole('button',{name:'Attach file',exact:true}).click();await (await choose).setFiles({name:'synthetic-river-map.png',mimeType:'image/png',buffer:bytes});
      await page.getByText('synthetic-river-map.png',{exact:true}).waitFor({state:'attached'});await page.keyboard.press('Escape');
      const downloadPending=page.waitForEvent('download');await btn('synthetic-river-map.png').click();const download=await downloadPending;await download.saveAs(out+'/uploaded-map.png');assert.equal(sha(await fs.readFile(out+'/uploaded-map.png')),sha(bytes));await shot('uploaded-attachment');
      await open(f.recovery.item.title);assert.match(await editor.innerText(),/Agent passage/);await menu('Export and recovery');
      dialog=page.getByRole('dialog',{name:'Export and recovery',exact:true});await dialog.getByRole('button',{name:'Restore pre-run version',exact:true}).click();
      dialog=page.getByRole('dialog',{name:'Restore pre-run version',exact:true});await dialog.waitFor();await shot('pre-run-restore-dialog');
      await dialog.getByRole('button',{name:'Restore pre-run version',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.match(await editor.innerText(),/Original passage/);assert.match(await editor.innerText(),/Outside content/);
      await open(f.section.item.title);await editor.focus();await editor.press('Control+End');await page.keyboard.type(' Later manual note.');await page.getByText('Content saved',{exact:true}).waitFor();
      const sectionBubble=page.locator('#ws-bubble-'+f.section.comment.id);if(await sectionBubble.getAttribute('aria-expanded')!=='true')await sectionBubble.click();
      await page.locator('#ws-discussion-'+f.section.comment.id).getByRole('button',{name:'Revert section',exact:true}).click();
      dialog=page.getByRole('dialog',{name:'Revert section after manual edits?',exact:true});await dialog.waitFor();assert.match(await dialog.innerText(),/unrelated change stays intact/);await shot('section-later-edit-confirm');
      await dialog.getByRole('button',{name:'Revert section',exact:true}).click();await dialog.waitFor({state:'hidden'});
      const final=(await savedState()).items.find(i=>i.id===f.section.item.id);assert.match(final.content,/Original passage/);assert.match(final.content,/Outside content.*Later manual note/);assert.doesNotMatch(final.content,/Agent passage/);await shot('section-restored');
      receipt.recovery={positiveAttachmentUploadAndByteIdenticalDownload:true,preRunRestoreThroughPageActions:true,sectionOnlyRevertAfterExplicitLaterEditConfirmation:true,laterManualOutsideEditPreserved:true,scope:'Actual browser UI -> production HTTP/API/Store under synthetic owner admission; seeded saved runs are synthetic data, not native/provider execution.'};
    });
    if(['database','database-context'].includes(phase)){
      const db=page.locator('.ws-database'),table=db.locator('.ws-table'),filter=db.getByRole('textbox',{name:'Filter records',exact:true});
      const draft=()=>db.getByRole('textbox',{name:'New record title',exact:true});
      const property=()=>page.getByRole('form',{name:'New property',exact:true});
      const tabTo=async target=>{const path=[];for(let i=0;i<12;i++){if(await target.evaluate(e=>e===document.activeElement))return path;await page.keyboard.press('Tab');path.push(await page.evaluate(()=>({tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute('aria-label')??document.activeElement?.textContent})));}throw Error('Natural Tab target not reached: '+JSON.stringify(path));};
      const visible=async target=>{const b=await target.boundingBox(),w=await page.locator('.ws-work').boundingBox();assert.ok(b&&b.x>=w.x-1&&b.y>=w.y-1&&b.x+b.width<=Math.min(page.viewportSize().width,w.x+w.width)+1&&b.y+b.height<=Math.min(page.viewportSize().height,w.y+w.height)+1,JSON.stringify({b,w}));return b;};

      const read=()=>page.evaluate(async()=>{const t=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);const r=await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':t},cache:'no-store'});if(!r.ok)throw Error('State readback HTTP '+r.status);return r.json();});
      const saved=async predicate=>{for(let i=0;i<80;i++){const data=await read();if(predicate(data))return data;await new Promise(r=>setTimeout(r,50));}throw Error('Expected production persisted state not observed');};
      const contain=async label=>{const r=await db.evaluate(e=>{const t=e.querySelector('.ws-table-wrap'),b=e.getBoundingClientRect(),w=t?.getBoundingClientRect();return {right:b.right,viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,tableClient:t?.clientWidth,tableScroll:t?.scrollWidth,tableRight:w?.right};});receipt.geometry.push({label,...r});assert.ok(r.pageWidth<=r.clientWidth+1,JSON.stringify(r));if(r.tableScroll>r.tableClient)assert.ok(r.tableRight<=r.viewport+1,JSON.stringify(r));};
      await check('database-inline-row-pointer-keyboard-drafts',async()=>{
        await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn('Dark').click();await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.database.title);await table.waitFor();
        assert.equal(await db.getByRole('button',{name:'Add record',exact:true}).count(),0);assert.equal(await db.getByRole('button',{name:'Add column',exact:true}).count(),0);
        assert.equal(await table.locator('thead th').last().getByRole('button',{name:'Add property',exact:true}).count(),1);
        assert.equal(await table.locator('tbody tr').last().getByRole('button',{name:'New record',exact:true}).count(),1);
        await shot('database-populated-Dark');await btn('New record').click();await draft().waitFor();assert.equal(await draft().evaluate(e=>e===document.activeElement),true);await draft().fill('Discard this draft');await draft().press('Escape');await draft().waitFor({state:'hidden'});assert.equal(await btn('New record').evaluate(e=>e===document.activeElement),true);
        await btn('New record').focus();await page.keyboard.press('Enter');await draft().waitFor();await draft().fill('Keyboard observation');
        await draft().evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true,cancelable:true}));});assert.equal(await draft().inputValue(),'Keyboard observation');assert.equal(await table.getByRole('button',{name:'Keyboard observation',exact:true}).count(),0);
        await draft().evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await shot('database-inline-draft-Dark');await draft().press('Enter');
        await table.getByRole('button',{name:'Keyboard observation',exact:true}).waitFor();await saved(s=>s.items.some(i=>i.title==='Keyboard observation'));await page.getByText('Created “Keyboard observation”.',{exact:true}).waitFor();assert.equal(await draft().inputValue(),'');
        await draft().fill('Filter-preserved draft');await filter.fill('not-present-in-records');assert.equal(await draft().inputValue(),'Filter-preserved draft');await page.getByText('No records match this filter.',{exact:true}).waitFor();await btn('Create record').click();await page.getByText('Created “Filter-preserved draft”. It is hidden by the current filter.',{exact:true}).waitFor();await filter.fill('');await btn('Cancel new record').click();
      });
      await check('database-pending-failure-dedup-retry',async()=>{
        await btn('New record').click();await draft().fill('Retained pending record');await btn('Create record').click();
        let entered=false;for(let i=0;i<80;i++){try{await fs.access(out+'/pending-create-entered.json');entered=true;break;}catch{}await new Promise(r=>setTimeout(r,25));}assert.ok(entered,'Actual bridge request reached production fixture middleware');
        assert.equal(await btn('Cancel new record').isDisabled(),true);assert.equal(await draft().isDisabled(),true);await draft().evaluate(e=>e.closest('form').requestSubmit());assert.equal(JSON.parse(await fs.readFile(out+'/pending-create-entered.json','utf8')).calls,1);
        await page.getByText(/Synthetic creation temporarily unavailable/).first().waitFor();assert.equal(await draft().inputValue(),'Retained pending record');await shot('database-failed-record-Dark');const before=await read();assert.equal(before.items.filter(i=>i.title==='Retained pending record').length,0);
        await btn('Create record').click();await table.getByRole('button',{name:'Retained pending record',exact:true}).waitFor();const s=await saved(s=>s.items.some(i=>i.title==='Retained pending record'));assert.equal(s.items.filter(i=>i.title==='Retained pending record').length,1);await btn('Cancel new record').click();
      });
      await check('database-context-property-editor-validation-types',async()=>{
        await btn('Add property').click();await property().waitFor();await property().getByRole('textbox',{name:'Property name',exact:true}).fill('Calculation');await choose('Property type','Formula',property());await property().getByRole('textbox',{name:'Formula expression',exact:true}).fill('not_a_function(1)');await property().getByRole('button',{name:'Add property',exact:true}).click();await property().getByRole('alert').waitFor();assert.equal(await property().getByRole('textbox',{name:'Property name',exact:true}).inputValue(),'Calculation');assert.equal(await property().getByRole('textbox',{name:'Property name',exact:true}).getAttribute('aria-invalid'),'false');assert.equal(await property().getByRole('textbox',{name:'Formula expression',exact:true}).getAttribute('aria-invalid'),'true');assert.equal(await property().getByRole('textbox',{name:'Formula expression',exact:true}).getAttribute('aria-describedby'),await property().getByRole('alert').getAttribute('id'));await shot('database-property-invalid-Dark');
        await property().getByRole('textbox',{name:'Formula expression',exact:true}).fill('coalesce(col("Count"), 0) + 1');await property().getByRole('button',{name:'Add property',exact:true}).click();await property().waitFor({state:'hidden'});await saved(s=>s.items.find(i=>i.id===f.database.id).columns.some(c=>c.name==='Calculation'));
        await btn('Add property').click();await property().getByRole('textbox',{name:'Property name',exact:true}).fill('Category');await choose('Property type','Single select',property());await property().getByRole('button',{name:'Add property',exact:true}).click();await property().getByRole('alert').waitFor();await property().getByRole('textbox',{name:'Select options (comma separated)',exact:true}).fill('Field, Lab');await shot('database-property-editor-Dark');await property().getByRole('button',{name:'Cancel',exact:true}).click();await property().waitFor({state:'hidden'});assert.equal(await btn('Add property').evaluate(e=>e===document.activeElement),true);
        await btn('Add property').click();await property().getByRole('textbox',{name:'Property name',exact:true}).fill('Related test');await choose('Property type','Relation',property());await property().getByRole('button',{name:'Add property',exact:true}).click();await property().getByRole('alert').waitFor();assert.equal(await property().getByRole('combobox',{name:'Related database',exact:true}).getAttribute('aria-invalid'),'true');assert.equal(await property().getByRole('textbox',{name:'Property name',exact:true}).getAttribute('aria-invalid'),'false');await choose('Related database',/^Related field sites/,property());assert.equal(await property().getByRole('combobox',{name:'Related database',exact:true}).getAttribute('aria-invalid'),'false');await property().getByRole('button',{name:'Cancel',exact:true}).click();
        await btn('Add property').click();await property().getByRole('textbox',{name:'Property name',exact:true}).fill('Retry transport property');await property().getByRole('button',{name:'Add property',exact:true}).click();await property().getByRole('alert').filter({hasText:'Synthetic property request temporarily unavailable'}).waitFor();assert.equal(await property().getByRole('textbox',{name:'Property name',exact:true}).getAttribute('aria-invalid'),'false');assert.equal(await property().getByRole('combobox',{name:'Property type',exact:true}).getAttribute('aria-invalid'),'false');await shot('database-property-request-error-Dark');await property().getByRole('button',{name:'Add property',exact:true}).click();await property().waitFor({state:'hidden'});await saved(s=>s.items.find(i=>i.id===f.database.id).columns.some(c=>c.name==='Retry transport property'));
        await btn('Add property').hover();await page.getByRole('tooltip',{name:'Add property',exact:true}).waitFor();await shot('database-add-property-tip-Dark');await page.mouse.move(10,10);
        await btn('Column actions: Count').click();await page.getByRole('menuitem',{name:'Remove column',exact:true}).waitFor();await shot('database-column-menu-Dark');await page.keyboard.press('Escape');await btn('Record actions: Record document').click();await page.getByRole('menuitem',{name:'Move to Trash',exact:true}).waitFor();await shot('database-row-menu-Dark');await page.keyboard.press('Escape');
      });
      await check('database-typed-cells-sort-relations-board-row-document',async()=>{
        const row=table.locator('tbody tr').filter({has:page.getByRole('button',{name:'Record document',exact:true})});await row.getByRole('spinbutton',{name:'Count',exact:true}).fill('7');await row.getByRole('spinbutton',{name:'Count',exact:true}).press('Tab');await saved(s=>s.items.find(i=>i.id===f.record.id).properties.count===7);await row.locator('.ws-property-status').waitFor({state:'hidden'});assert.equal(await row.locator('.ws-property-status').count(),0);
        await row.getByRole('textbox',{name:'Observation',exact:true}).fill('Updated field observation');await row.getByRole('textbox',{name:'Observation',exact:true}).press('Tab');await saved(s=>s.items.find(i=>i.id===f.record.id).properties.observation==='Updated field observation');
        await row.getByRole('checkbox',{name:'Verified',exact:true}).uncheck();await saved(s=>s.items.find(i=>i.id===f.record.id).properties.checked===false);
        await row.getByLabel('Observed on',{exact:true}).fill('2026-11-11');await row.getByRole('spinbutton',{name:'Count',exact:true}).click();await saved(s=>s.items.find(i=>i.id===f.record.id).properties.date==='2026-11-11');
        await row.getByRole('button',{name:'Site',exact:true}).click();await page.getByRole('checkbox',{name:'Site: North bank',exact:true}).uncheck();await saved(s=>s.items.find(i=>i.id===f.record.id).properties.site.length===0);await page.getByRole('checkbox',{name:'Site: North bank',exact:true}).check();await saved(s=>s.items.find(i=>i.id===f.record.id).properties.site[0]===f.related.id);await page.keyboard.press('Escape');
        await btn('Sort').click();await choose('Sort','Count');await choose('Direction','Descending');await shot('database-sort-popover-Dark');await page.keyboard.press('Escape');assert.equal(await table.getByRole('columnheader',{name:/Count/}).first().getAttribute('aria-sort'),'descending');await btn('Sort: Count, descending').waitFor();assert.equal(await table.locator('tbody tr th button').first().innerText(),'Water level check');
        await choose('View','Board',db);await db.getByRole('region',{name:'Database board, scroll for more groups',exact:true}).waitFor();await choose('Move Record document','Reviewed',db);await saved(s=>s.items.find(i=>i.id===f.record.id).properties.status==='Reviewed');await shot('database-board-Dark');const observed=db.getByRole('region',{name:'Board group: Observed',exact:true});await observed.getByRole('button',{name:'New record in Observed',exact:true}).click();await draft().fill('Contextual board observation');await draft().press('Enter');await saved(s=>s.items.some(i=>i.database_id===f.database.id&&i.title==='Contextual board observation'&&i.properties.status==='Observed'));await observed.getByRole('button',{name:'Contextual board observation',exact:true}).waitFor();await shot('database-board-group-created-Dark');await btn('Cancel new record').click();assert.equal(await observed.getByRole('button',{name:'New record in Observed',exact:true}).evaluate(e=>e===document.activeElement),true);await btn('New record in Planned').click();await draft().fill('Board draft');await btn('Cancel new record').click();
        await db.getByRole('button',{name:'Record document',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ws-title')?.value==='Record document');await page.getByRole('textbox',{name:'Page content',exact:true}).waitFor();await open(f.database.title);
      });
      await check('database-empty-lock-and-responsive-two-themes',async()=>{
        await open(f.empty.title);await page.getByText('No records yet. Add your first record below.',{exact:true}).waitFor();await shot('database-empty-Dark');await btn('New record').click();await draft().fill('First empty database record');await draft().press('Enter');await table.getByRole('button',{name:'First empty database record',exact:true}).waitFor();await btn('Cancel new record').click();
        for(const mode of ['Light','Dark']){
          await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.database.title);await contain('database-'+mode+'-desktop');
          const contrast=await db.evaluate(e=>{const c=document.createElement('canvas'),x=c.getContext('2d');c.width=c.height=1;const rgba=value=>{x.clearRect(0,0,1,1);x.fillStyle=value;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));const luminance=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);return ['.ws-db-new-record','.ws-db-column-name'].map(selector=>{const n=e.querySelector(selector),chain=[];for(let p=n;p;p=p.parentElement)chain.push(p);let bg=[255,255,255];for(const p of chain.reverse())bg=blend(rgba(getComputedStyle(p).backgroundColor),bg);const color=getComputedStyle(n).color,fg=blend(rgba(color),bg),a=luminance(fg),b=luminance(bg);return {selector,color,backgroundRGB:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),font:getComputedStyle(n).fontSize};});});receipt.contrast??=[];receipt.contrast.push({mode,samples:contrast});for(const sample of contrast)assert.ok(sample.ratio>=4.5,JSON.stringify(sample));await shot('database-populated-'+mode+'-final');const titleCell=table.locator('tbody tr').filter({has:page.getByRole('button',{name:'Record document',exact:true})}).locator('th');await table.evaluate(e=>e.parentElement.scrollLeft=e.parentElement.scrollWidth);const pinned=await titleCell.boundingBox(),grid=await table.locator('..').boundingBox();assert.ok(Math.abs(pinned.x-grid.x)<2,JSON.stringify({pinned,grid}));await shot('database-pinned-record-'+mode);
          await table.locator('thead th').last().scrollIntoViewIfNeeded();await btn('Add property').click();await property().getByRole('textbox',{name:'Property name',exact:true}).fill('Sampling location');await shot('database-property-editor-'+mode+'-final');await page.keyboard.press('Escape');await choose('View','Board',db);await shot('database-board-'+mode+'-final');await choose('View','Table',db);
          for(const [width,height,zoom] of [[600,500,1],[420,540,1],[420,540,1.75]]){
            await page.setViewportSize({width,height});await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);await db.scrollIntoViewIfNeeded();if(zoom===1.75){const hb=await page.locator('.ws-topbar').boundingBox(),wb=await page.locator('.ws-work').boundingBox();assert.ok(hb.height<=74&&wb.height>=height*.45,JSON.stringify({hb,wb}));await btn('Workspace menu').focus();await page.keyboard.press('Enter');await page.getByRole('menuitem',{name:'Home',exact:true}).waitFor();await page.getByRole('menuitem',{name:'New page',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await btn('Workspace menu').evaluate(e=>e===document.activeElement),true);}await contain('database-'+mode+'-'+width+'-'+zoom);await table.evaluate(e=>e.parentElement.scrollLeft=0);await shot('database-'+mode+'-'+width+'-'+zoom);if(width===420&&zoom===1){const r=table.locator('tbody tr').filter({has:page.getByRole('button',{name:'Record document',exact:true})});await r.getByRole('spinbutton',{name:'Count',exact:true}).focus();await page.locator('.ws-db-record-context').getByRole('button',{name:'Record document',exact:true}).waitFor();await table.evaluate(e=>e.parentElement.scrollLeft=e.parentElement.scrollWidth);await shot('database-active-record-'+mode);await choose('View','Board',db);await shot('database-board-'+mode+'-420');await choose('View','Table',db);}
            await btn('New record').click();await draft().fill('Constrained draft');const cancelBox=await btn('Cancel new record').boundingBox();const workBox=await page.locator('.ws-work').boundingBox();assert.ok(cancelBox.y>=0&&cancelBox.y+cancelBox.height<=Math.min(height,workBox.y+workBox.height)+1,JSON.stringify({cancelBox,workBox}));await shot('database-inline-'+mode+'-'+width+'-'+zoom);await draft().press('Escape');
            await table.locator('thead th').last().scrollIntoViewIfNeeded();await btn('Add property').click();await property().waitFor();const box=await page.locator('.ws-db-property-popover').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,JSON.stringify(box));await visible(property().getByRole('button',{name:'Cancel',exact:true}));await visible(property().getByRole('button',{name:'Add property',exact:true}));await shot('database-property-'+mode+'-'+width+'-'+zoom);
            const name=property().getByRole('textbox',{name:'Property name',exact:true});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Property name');const columnName=`Constrained ${mode} ${width} ${zoom}`;await name.fill(columnName);await page.keyboard.press('Tab');assert.equal(await property().getByRole('combobox',{name:'Property type',exact:true}).evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');await page.getByRole('listbox').waitFor();await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='option');await page.keyboard.press('End');await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='option'&&document.activeElement?.textContent?.trim()==='Formula');await page.keyboard.press('Enter');await property().getByRole('textbox',{name:'Formula expression',exact:true}).waitFor();receipt.propertyCloseTransitions??=[];receipt.propertyCloseTransitions.push({mode,width,zoom,active:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')??document.activeElement?.getAttribute('role')),listboxes:await page.getByRole('listbox').count()});await page.getByRole('listbox').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Property type');await page.keyboard.press('Tab');const formula=property().getByRole('textbox',{name:'Formula expression',exact:true});assert.equal(await formula.evaluate(e=>e===document.activeElement),true);await formula.fill('not_a_function(1)');const add=property().getByRole('button',{name:'Add property',exact:true});const path=await tabTo(add);await page.keyboard.press('Enter');await property().getByRole('alert').waitFor();assert.equal(await formula.evaluate(e=>e===document.activeElement),true);await formula.fill('1 + 1');await tabTo(add);await visible(add);await shot('database-property-validation-'+mode+'-'+width+'-'+zoom);await page.keyboard.press('Enter');await property().waitFor({state:'hidden'});await saved(s=>s.items.find(i=>i.id===f.database.id).columns.some(c=>c.name===columnName&&c.type==='formula'));assert.equal(await btn('Add property').evaluate(e=>e===document.activeElement),true);
            await btn('Add property').click();await property().waitFor();await property().getByRole('textbox',{name:'Property name',exact:true}).fill('Cancel this property');const cancel=property().getByRole('button',{name:'Cancel',exact:true});await tabTo(cancel);await page.keyboard.press('Enter');await property().waitFor({state:'hidden'});assert.equal(await btn('Add property').evaluate(e=>e===document.activeElement),true);
            await btn('Add property').click();await property().getByRole('textbox',{name:'Property name',exact:true}).fill('Pointer '+columnName);await choose('Property type','Single select',property());const options=property().getByRole('textbox',{name:'Select options (comma separated)',exact:true});await options.fill('One, Two');await options.hover();await page.mouse.wheel(0,120);await visible(property().getByRole('button',{name:'Add property',exact:true}));await property().getByRole('button',{name:'Add property',exact:true}).click();await property().waitFor({state:'hidden'});await saved(s=>s.items.find(i=>i.id===f.database.id).columns.some(c=>c.name==='Pointer '+columnName&&c.options?.join(',')==='One,Two'));
            receipt.propertyTraversal??=[];receipt.propertyTraversal.push({mode,width,height,zoom,naturalTabPath:path,formulaValidationAndCreation:true,pointerConditionalSelectCreation:true,cancelRestoresExactOpener:true});
            if(width===420&&zoom===1.75){const context=page.locator('.ws-db-record-context'),action=context.getByRole('button',{name:'Record document',exact:true});await action.waitFor();await visible(action);const label=action.locator('.ws-db-record-label'),lb=await label.boundingBox(),ab=await action.boundingBox();assert.ok(lb.x+lb.width<=ab.x+ab.width+1,JSON.stringify({lb,ab}));await action.hover();await page.getByRole('tooltip',{name:'Record document',exact:true}).waitFor();await settle();await visible(page.getByRole('tooltip',{name:'Record document',exact:true}));await shot('database-record-context-tip-'+mode+'-175');await page.locator('.ws-topbar').hover();}
            await page.evaluate(()=>document.documentElement.style.zoom='1');
          }
        }
        await page.setViewportSize({width:420,height:540});await open(f.long_database.title);const longRow=table.locator('tbody tr').filter({has:page.getByRole('button',{name:f.long_record.title,exact:true})});const longValue=longRow.getByRole('spinbutton',{name:'Count',exact:true});await longValue.scrollIntoViewIfNeeded();await longValue.click();await table.evaluate(e=>e.parentElement.scrollLeft=e.parentElement.scrollWidth);const context=page.locator('.ws-db-record-context');await context.getByRole('button',{name:f.long_record.title,exact:true}).waitFor();const contextBox=await context.boundingBox(),workBox=await page.locator('.ws-work').boundingBox();assert.ok(contextBox.y>=workBox.y-1&&contextBox.y+contextBox.height<=Math.min(540,workBox.y+workBox.height)+1,JSON.stringify({contextBox,workBox}));const headings=table.getByRole('columnheader',{name:/Double count/});await visible(headings);assert.ok(await table.evaluate(e=>e.parentElement.scrollTop>0));await shot('database-long-active-record-Dark');await page.evaluate(()=>document.documentElement.style.zoom='1.75');await longValue.scrollIntoViewIfNeeded();await longValue.click();await table.evaluate(e=>e.parentElement.scrollLeft=e.parentElement.scrollWidth);await visible(headings);const recordAction=context.getByRole('button',{name:f.long_record.title,exact:true});await visible(recordAction);const recordLabel=recordAction.locator('.ws-db-record-label');assert.equal(await recordLabel.evaluate(e=>getComputedStyle(e).textOverflow),'ellipsis');await recordAction.hover();await page.getByRole('tooltip',{name:f.long_record.title,exact:true}).waitFor();await settle();await visible(page.getByRole('tooltip',{name:f.long_record.title,exact:true}));await shot('database-long-record-and-headings-Dark-175');await page.locator('.ws-topbar').hover();await page.getByRole('tooltip',{name:f.long_record.title,exact:true}).waitFor({state:'hidden'});await btn('Sort').click();await page.keyboard.press('Escape');await page.keyboard.press('Tab');assert.equal(await recordAction.evaluate(e=>e===document.activeElement),true);await page.getByRole('tooltip',{name:f.long_record.title,exact:true}).waitFor();await settle();await visible(page.getByRole('tooltip',{name:f.long_record.title,exact:true}));await page.keyboard.press('Enter');await page.waitForFunction(t=>document.querySelector('.ws-title')?.value===t,f.long_record.title);await shot('database-open-long-record-Dark-175');await page.evaluate(()=>document.documentElement.style.zoom='1');
        await page.setViewportSize({width:1600,height:1000});await open(f.database.title);const s=await read(),r=s.items.find(i=>i.id===f.record.id);assert.equal(r.content,'<p>Record instructions remain available.</p>');assert.equal(r.properties.count,7);assert.equal(r.properties.double,14);assert.equal(r.properties.status,'Reviewed');await page.evaluate(async()=>{const r=await fetch('/__fixture/database-lock',{method:'POST'});if(!r.ok)throw Error('Fixture lock setup HTTP '+r.status);});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn('Dark').waitFor();await page.goto('http://127.0.0.1:19444/#/workspace');await page.locator('.ws-nav').waitFor();await open(f.locked.title);await btn('New record').waitFor();await page.waitForFunction(()=>document.querySelector('.ws-db-new-record')?.disabled);assert.equal(await btn('Add property').isDisabled(),true);await shot('database-locked-Dark');receipt.database={completeFilteredRows:true,paging:'No database pager existed; complete in-memory table/board result preserved. Workspace file search paging is separately qualified.',syntheticOwner:true,nativeAcceptance:false};
      });
      if(phase==='database-context')await check('database-active-context-full-name',async()=>{
        await page.setViewportSize({width:420,height:540});await open(f.long_database.title);const row=table.locator('tbody tr').filter({has:page.getByRole('button',{name:f.long_record.title,exact:true})}),value=row.getByRole('spinbutton',{name:'Count',exact:true});await value.scrollIntoViewIfNeeded();await value.click();await page.evaluate(()=>document.documentElement.style.zoom='1.75');await value.scrollIntoViewIfNeeded();await value.click();await table.evaluate(e=>e.parentElement.scrollLeft=e.parentElement.scrollWidth);const action=page.locator('.ws-db-record-context').getByRole('button',{name:f.long_record.title,exact:true});await visible(action);
        const recordAction=action;
        const focusSample=target=>target.evaluate(e=>({same:e===document.activeElement,connected:e.isConnected,activeTag:document.activeElement?.tagName,activeAria:document.activeElement?.getAttribute('aria-label'),targetTag:e.tagName,targetAria:e.getAttribute('aria-label')}));
        const stableFocus=async(target,label)=>{
          const retained=await target.elementHandle();
          const samples=await page.evaluate(async({retained,label})=>{
            let frame;const samples=[];
            await new Promise((resolve,reject)=>{let count=0;const timeout=setTimeout(()=>{cancelAnimationFrame(frame);reject(Error('Bounded focus-frame observation timed out: '+label));},1000);
              const next=()=>{const a=document.activeElement,s={label,frame:++count,same:a===retained,connected:retained.isConnected,activeTag:a?.tagName,activeAria:a?.getAttribute('aria-label')};samples.push(s);if(!s.same||!s.connected){clearTimeout(timeout);reject(Error('Focus changed after immediate assertion: '+JSON.stringify(s)));}else if(count===6){clearTimeout(timeout);resolve();}else frame=requestAnimationFrame(next);};frame=requestAnimationFrame(next);});return samples;
          },{retained,label});receipt.focusStability??=[];receipt.focusStability.push(...samples);
        };
        await page.evaluate(()=>{window.__sortRegressionEvents=[];for(const type of ['focusin','focusout','keydown','keyup'])document.addEventListener(type,event=>{if(type.startsWith('key')&&!['Escape','Tab'].includes(event.key))return;window.__sortRegressionEvents.push({type,key:event.key??null,t:performance.now(),tag:event.target?.tagName,aria:event.target?.getAttribute?.('aria-label'),activeTag:document.activeElement?.tagName,activeAria:document.activeElement?.getAttribute('aria-label')});},true);});
        await action.hover();await page.getByRole('tooltip',{name:f.long_record.title,exact:true}).waitFor();await settle();await visible(page.getByRole('tooltip',{name:f.long_record.title,exact:true}));await shot('database-context-long-tip-Dark-175');await page.locator('.ws-topbar').hover();await page.getByRole('tooltip',{name:f.long_record.title,exact:true}).waitFor({state:'hidden'});
        // Original fast sequence and immediate exact-target assertion: no favourable wait.
        await btn('Sort').click();await page.keyboard.press('Escape');await page.keyboard.press('Tab');assert.equal(await recordAction.evaluate(e=>e===document.activeElement),true);
        await stableFocus(recordAction,'immediate-Escape-Tab');await page.getByRole('tooltip',{name:f.long_record.title,exact:true}).waitFor();await visible(page.getByRole('tooltip',{name:f.long_record.title,exact:true}));await shot('database-context-immediate-keyboard-Dark-175');
        await btn('Sort').click();await page.keyboard.press('Escape');assert.equal((await focusSample(btn('Sort'))).same,true,'Escape returns exact opener immediately');await stableFocus(btn('Sort'),'Escape-return');
        // Separate roomy outside-click control; the 420px/175% popover covers Filter.
        await page.evaluate(()=>document.documentElement.style.zoom='1');await page.setViewportSize({width:1600,height:1000});await filter.scrollIntoViewIfNeeded();
        await btn('Sort').click();
        receipt.outsideClickHitTest=await filter.evaluate(e=>{const b=e.getBoundingClientRect(),points=[{x:b.width/2,y:b.height/2},{x:Math.min(12,b.width/2),y:b.height/2},{x:Math.max(b.width-12,b.width/2),y:b.height/2}];const samples=points.map(point=>{const hit=document.elementFromPoint(b.left+point.x,b.top+point.y);return {point,exposed:hit===e||e.contains(hit),hitTag:hit?.tagName,hitAria:hit?.getAttribute('aria-label')};});return {viewport:{width:innerWidth,height:innerHeight},zoom:document.documentElement.style.zoom,rect:{x:b.x,y:b.y,width:b.width,height:b.height},samples,chosen:samples.find(s=>s.exposed)?.point??null};});
        assert.ok(receipt.outsideClickHitTest.chosen,'Outside control requires a genuinely exposed intended field; no force click');
        await filter.evaluate(e=>e.addEventListener('pointerdown',event=>{window.__outsideControlPointer={trusted:event.isTrusted,targetIsField:event.target===e,tag:event.target.tagName,aria:event.target.getAttribute('aria-label'),x:event.clientX,y:event.clientY};},{once:true}));
        await filter.click({position:receipt.outsideClickHitTest.chosen});receipt.outsideClickPointer=await page.evaluate(()=>window.__outsideControlPointer);
        assert.equal(receipt.outsideClickPointer?.targetIsField,true,'Physical click must actually reach the intended field');assert.equal((await focusSample(filter)).same,true,'Outside click preserves intended field');await page.locator('.ws-db-sort-popover').waitFor({state:'hidden'});await stableFocus(filter,'outside-click');
        await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');await value.scrollIntoViewIfNeeded();receipt.restoredRowHit=await value.evaluate(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {exposed:hit===e||e.contains(hit),tag:hit?.tagName,aria:hit?.getAttribute('aria-label'),rect:{x:b.x,y:b.y,width:b.width,height:b.height}};});assert.equal(receipt.restoredRowHit.exposed,true,'Original long-row Count click must be exposed');await value.click();await table.evaluate(e=>e.parentElement.scrollLeft=e.parentElement.scrollWidth);await visible(recordAction);receipt.restoredRecordHit=await recordAction.evaluate(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {exposed:hit===e||e.contains(hit),tag:hit?.tagName,aria:hit?.getAttribute('aria-label')};});assert.equal(receipt.restoredRecordHit.exposed,true,'Restored semantic record must be exposed without focusing it');receipt.restoredKeyboardViewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,zoom:document.documentElement.style.zoom}));assert.deepEqual(receipt.restoredKeyboardViewport,{width:420,height:540,zoom:'1.75'});
        await btn('Sort').click();await btn('Sort').click();assert.equal((await focusSample(btn('Sort'))).same,true,'Trigger toggle closes without changing focus');await stableFocus(btn('Sort'),'ordinary-trigger-close');
        await btn('Sort').click();await page.locator('.ws-db-sort-popover').getByRole('combobox',{name:'Direction',exact:true}).click();await page.getByRole('option',{name:'Descending',exact:true}).click();await page.getByRole('listbox').waitFor({state:'hidden'});assert.match(await page.locator('.ws-db-sort-popover').getByRole('combobox',{name:'Direction',exact:true}).innerText(),/Descending/);await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Direction');
        await page.keyboard.press('Escape');await page.keyboard.press('Tab');assert.equal((await focusSample(recordAction)).same,true,'Selection then fast Escape/Tab retains exact next target');await stableFocus(recordAction,'selection-Escape-Tab');await shot('database-context-close-controls-Dark-175');
        receipt.focusEvents=await page.evaluate(()=>window.__sortRegressionEvents);receipt.sortFocusControls={originalImmediateAssertion:true,sixSubsequentFramesEach:true,escapeReturn:true,outsideClickField:true,ordinaryTriggerClose:true,selection:true,programmaticClose:'Not separately exercised; default public close path retained when focus is body/inside, caller cancellation remains first. No programmatic record focus.'};
      });
    }
    if(phase==='wide')await check('per-page-wide-document-mode',async()=>{
      await page.setViewportSize({width:1920,height:1000});await open(f.page.title);await settle();
      const readState=()=>page.evaluate(async()=>{
        const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);
        const response=await fetch('/api/plugins/workspace/state',{cache:'no-store',headers:{'X-Hermes-Session-Token':token}});
        if(!response.ok)throw Error('Synthetic readback HTTP '+response.status);return response.json();
      });
      const original=await readState();await editor.evaluate(e=>e.dataset.widthIdentity='original-editor');
      const normalParagraph=await editor.locator('p').last().boundingBox();
      const normal=await editor.boundingBox();const font=await editor.evaluate(e=>({size:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,text:e.textContent}));
      await menu('Wide document mode: Off');await settle();const wide=await editor.boundingBox();
      assert.ok(wide.width>normal.width+100,JSON.stringify({normal,wide}));
      assert.ok((await editor.locator('p').last().boundingBox()).height<normalParagraph.height,'actual long prose wraps into fewer lines');
      assert.equal(await editor.getAttribute('data-width-identity'),'original-editor');
      assert.deepEqual(await editor.evaluate(e=>({size:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,text:e.textContent})),font);
      await shot('wide-desktop');await open('Field observation 000');assert.equal(await page.locator('.ws-wide-document').count(),0);
      await open(f.page.title);assert.equal(await page.locator('.ws-wide-document').count(),1);
      await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');await enabled.waitFor();await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);assert.equal(await page.locator('.ws-wide-document').count(),1);
      await btn('Page actions').focus();await page.keyboard.press('Enter');await page.getByRole('menuitem',{name:'Wide document mode: On',exact:true}).press('Enter');await settle();
      assert.equal(await page.locator('.ws-wide-document').count(),0);assert.ok(Math.abs((await editor.boundingBox()).width-normal.width)<1);
      await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Page actions');
      await menu('Wide document mode: Off');
      const drag=await separator.boundingBox();await page.mouse.move(drag.x+drag.width/2,drag.y+drag.height/2);await page.mouse.down();await page.mouse.move(drag.x+drag.width/2+90,drag.y+drag.height/2,{steps:6});await page.mouse.up();await settle();
      assert.ok((await editor.boundingBox()).width<wide.width);assert.ok((await editor.boundingBox()).width>normal.width);
      for(const mode of ['Dark','Light']){
        await page.setViewportSize({width:1200,height:850});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).waitFor();await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');
        await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);
        for(const zoom of [1,1.75]){
          await page.setViewportSize({width:420,height:540});await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);await settle();
          assert.equal(await page.locator('.ws-wide-document').count(),1);
          const bounds=await editor.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=421,JSON.stringify(bounds));
          assert.ok(await page.locator('.ws-work').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
          await editor.scrollIntoViewIfNeeded();await settle();
          assert.ok(await editor.evaluate(e=>{const r=e.getBoundingClientRect();return r.top<window.innerHeight-40&&r.bottom>80;}),'settled readable document is in frame');
          await shot('wide-'+mode+'-420-'+zoom);
        }
        await page.evaluate(()=>document.documentElement.style.zoom='1');
      }
      const final=await readState();assert.deepEqual(final.items,original.items,'display mode never rewrites document data');assert.deepEqual(final.versions,original.versions);assert.deepEqual(final.comments,original.comments);
      receipt.wide={normal:normal.width,wide:wide.width,font,otherPageStayedNormal:true,reopenRestored:true,keyboardNormalRestored:true,resizedNavigationUsable:true,twoThemeNarrowAnd175CSSZoom:true,documentVersionsCommentsUnchanged:true,limits:'Actual pinned browser-hosted UI and supported local preferences, synthetic data. Native installed reopen/profile/shared-member/read-only run cases remain separate; CSS zoom is not browser zoom.'};
    });
    if(phase==='editor')await check('actual-http-selection-editor-persistence',async()=>{
      await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');await enabled.waitFor();
      await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);
      const selectedTools=page.getByRole('toolbar',{name:'Selected text actions',exact:true});
      const select=async quote=>{
        await editor.focus();await editor.evaluate((element,quote)=>{
          const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;
          while(node=walker.nextNode())if(node.textContent.includes(quote))break;
          if(!node)throw Error('Synthetic selection not found: '+quote);
          const start=node.textContent.indexOf(quote),range=document.createRange();range.setStart(node,start);range.setEnd(node,start+quote.length);
          getSelection().removeAllRanges();getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));
        },quote);await selectedTools.waitFor();await settle();
        assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Page content','selection never steals document focus');
      };
      const persisted=async needle=>{
        let observed;
        for(let attempt=0;attempt<80;attempt++){
          observed=await page.evaluate(async id=>{
            const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);
            const response=await fetch('/api/plugins/workspace/state',{cache:'no-store',headers:{'X-Hermes-Session-Token':token}});
            if(!response.ok)throw Error('Synthetic readback HTTP '+response.status);
            const state=await response.json();return {revision:state.revision,content:state.items.find(i=>i.id===id)?.content};
          },f.page.id);
          if(observed.content?.includes(needle))break;
          await page.waitForTimeout(100);
        }
        receipt.persistedCheckpoints??=[];receipt.persistedCheckpoints.push({needle,...observed});await save();
        assert.ok(observed.content?.includes(needle),'Production HTTP persistence: '+JSON.stringify({needle,...observed}));
      };
      await select('River');assert.equal(await selectedTools.getByRole('button',{name:'Bold',exact:true}).getAttribute('aria-pressed'),'true');
      await selectedTools.getByRole('button',{name:'Bold',exact:true}).click();await persisted('data-workspace-weight="normal"');
      receipt.headingAfterOffHTML=await editor.locator('h2').innerHTML();await save();
      assert.equal(await editor.locator('h2').evaluate(e=>getComputedStyle(e.querySelector('[data-workspace-weight="normal"],span')??e).fontWeight),'400');
      await page.keyboard.press('Escape');await editor.focus();await page.keyboard.press('Control+z');await persisted('<h2>River garden</h2>');
      await page.keyboard.press('Control+Shift+z');await persisted('data-workspace-weight="normal"');
      await select('Keep');await selectedTools.getByRole('button',{name:'Bold',exact:true}).click();
      assert.match(await editor.innerHTML(),/<(?:b|strong)>Keep<\/(?:b|strong)>/);
      await select('riverbank passage');await selectedTools.getByRole('button',{name:'Link',exact:true}).click();
      let dialog=page.getByRole('dialog',{name:'Insert link',exact:true});await dialog.waitFor();
      assert.equal(await dialog.getByRole('textbox',{name:'Link text',exact:true}).inputValue(),'riverbank passage');
      await dialog.getByRole('textbox',{name:'URL',exact:true}).fill('https://example.invalid/synthetic-river');
      await dialog.getByRole('button',{name:'Insert link',exact:true}).click();await dialog.waitFor({state:'hidden'});
      await persisted('https://example.invalid/synthetic-river');assert.equal(await editor.locator('a').innerText(),'riverbank passage');
      await select('riverbank passage');await selectedTools.getByRole('button',{name:'Add comment on selection',exact:true}).click();
      const composer=page.getByRole('textbox',{name:'New comment',exact:true});await composer.fill('Synthetic selection toolbar anchored discussion.');await composer.press('Control+Enter');
      await page.getByText('Synthetic selection toolbar anchored discussion.',{exact:true}).waitFor();await composer.waitFor({state:'hidden'});
      receipt.preexistingAnchorAfterLink=await page.locator('#ws-bubble-'+f.comment.id).getAttribute('aria-label');
      const anchor=await page.evaluate(async()=>{
        const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);
        const state=await(await fetch('/api/plugins/workspace/state',{headers:{'X-Hermes-Session-Token':token}})).json();
        return state.comments.find(c=>c.text==='Synthetic selection toolbar anchored discussion.')?.anchor;
      });assert.equal(anchor.quote,'riverbank passage');
      await page.goto('http://127.0.0.1:19444/#/capabilities?tab=plugins');await enabled.waitFor();await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);
      assert.equal(await editor.locator('h2 [data-workspace-weight="normal"]').evaluate(e=>getComputedStyle(e).fontWeight),'400');
      assert.equal(await editor.locator('a').innerText(),'riverbank passage');assert.match(await editor.innerHTML(),/<(?:b|strong)>Keep<\/(?:b|strong)>/);
      assert.equal(await page.getByText('Select text to comment · Ctrl+Alt+M',{exact:true}).count(),0);
      for(const mode of ['Dark','Light']){
        await page.setViewportSize({width:1200,height:850});await page.goto('http://127.0.0.1:19444/#/settings?tab=config%3Aappearance&page=theme');await btn(mode).waitFor();await btn(mode).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,mode==='Dark');
        await page.goto('http://127.0.0.1:19444/#/workspace');await page.getByRole('heading',{name:'Your pages',exact:true}).waitFor();await open(f.page.title);
        await page.setViewportSize({width:420,height:540});await page.evaluate(()=>document.documentElement.style.zoom='1.75');
        await editor.scrollIntoViewIfNeeded();await select('Keep');
        const box=await selectedTools.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=421&&box.y+box.height<=541,JSON.stringify(box));
        await shot('selection-persisted-'+mode+'-420-175');await page.keyboard.press('Tab');assert.equal(await selectedTools.evaluate(e=>e.contains(document.activeElement)),true);
        await page.keyboard.press('Escape');await selectedTools.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Page content');
        await page.evaluate(()=>document.documentElement.style.zoom='1');
      }
      await page.setViewportSize({width:1200,height:850});await menu('Export and recovery');dialog=page.getByRole('dialog',{name:'Export and recovery',exact:true});
      const [download]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Export DOCX',exact:true}).click()]);await download.saveAs(out+'/integrated-editor.docx');await page.keyboard.press('Escape');
      receipt.editor={normalHeadingOffAutosaveReopenComputedWeight:400,undoRedo:true,boldAndLinkAutosaveReopen:true,selectionCommentOriginalQuote:anchor.quote,twoTheme420CSSZoom175PopupContained:true,keyboardToolbarEscapeFocusReturn:true,docx:{path:out+'/integrated-editor.docx',sha256:sha(await fs.readFile(out+'/integrated-editor.docx'))},limits:'Browser-hosted real SDK/host/UI/API/Store with synthetic owner. Range setup uses DOM selection followed by actual pointer/keyboard commands. CSS root zoom is not native browser zoom. Installed native and full W04 fidelity remain separate gates.'};
      // Fresh production user paths: preserve the original anchored document while
      // creating/editing a separate synthetic page through the real UI.
      const stateRead=()=>page.evaluate(async()=>{
        const token=sessionStorage.getItem(`hermes.webapp.session.v1:${JSON.stringify([location.origin,''])}`);
        const r=await fetch('/api/plugins/workspace/state',{cache:'no-store',headers:{'X-Hermes-Session-Token':token}});
        if(!r.ok)throw Error('W04 synthetic readback HTTP '+r.status);return r.json();
      });
      const beforeBroader=await stateRead();
      const waitDocument=async(title,test)=>{let doc;for(let i=0;i<80;i++){doc=(await stateRead()).items.find(x=>x.title===title&&!x.deleted_at);if(doc&&test(doc))return doc;await page.waitForTimeout(100);}throw Error('W04 production persistence not observed for '+title+': '+JSON.stringify(doc));};
      const richTitle='Formatting field notes';await btn('New page').click();let createDialog=page.getByRole('dialog',{name:'New page',exact:true});await createDialog.getByRole('textbox',{name:'Page title',exact:true}).fill(richTitle);await createDialog.getByRole('button',{name:'Save',exact:true}).click();await createDialog.waitFor({state:'hidden'});await page.waitForFunction(t=>document.querySelector('.ws-title')?.value===t,richTitle);
      await editor.click();await page.keyboard.type('Ordinary typed opening.');await btn('Format text').click();const formatting=page.getByRole('toolbar',{name:'Formatting',exact:true});await formatting.waitFor();
      const style=async value=>{await choose('Block style',value,formatting);await page.getByRole('listbox').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Page content');};
      await select('typed');await formatting.getByRole('button',{name:'Italic',exact:true}).click();await waitDocument(richTitle,d=>/<(?:i|em)>typed<\/(?:i|em)>/.test(d.content));await editor.press('Control+z');await waitDocument(richTitle,d=>!/<(?:i|em)>typed<\/(?:i|em)>/.test(d.content)&&d.content.includes('typed'));await editor.press('Control+Shift+z');await waitDocument(richTitle,d=>/<(?:i|em)>typed<\/(?:i|em)>/.test(d.content));
      await select('opening');await formatting.getByRole('button',{name:'Underline',exact:true}).click();await waitDocument(richTitle,d=>d.content.includes('<u>opening</u>'));await style('Heading 1');assert.match(await editor.locator('h1').innerText(),/Ordinary typed opening/);
      const paragraph=async text=>{await editor.focus();await editor.press('Control+End');await editor.press('Enter');await style('Text');await page.keyboard.type(text);};
      await paragraph('First bullet');await formatting.getByRole('button',{name:'Bullets',exact:true}).click();await page.keyboard.press('Enter');await page.keyboard.type('Second bullet');await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.type('First ordered note');await formatting.getByRole('button',{name:'Numbered list',exact:true}).click();await page.keyboard.press('Enter');await page.keyboard.type('Second ordered note');await page.keyboard.press('Enter');await page.keyboard.press('Enter');
      assert.match(await editor.locator('ul').first().innerText(),/First bullet[\s\S]*Second bullet/);assert.match(await editor.locator('ol').first().innerText(),/First ordered note[\s\S]*Second ordered note/);
      // Synthetic clipboard data dispatched to the production paste handler;
      // no OS/user clipboard is read or overwritten.
      await editor.evaluate(e=>{const data=new DataTransfer();data.setData('text/html','<p>Nested notes</p><ul><li>Outer observation<ul><li>Inner observation</li></ul></li></ul><p>After pasted notes.</p>');data.setData('text/plain','Nested notes\nOuter observation\nInner observation\nAfter pasted notes.');e.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
      assert.equal(await editor.locator('ul ul li').innerText(),'Inner observation');await paragraph('Quoted field note.');await style('Quote');assert.match(await editor.locator('blockquote').innerText(),/Quoted field note/);await paragraph('const level = 3;');await style('Code block');assert.match(await editor.locator('pre').innerText(),/const level = 3/);
      await formatting.getByRole('button',{name:'Checklist',exact:true}).click();const task=editor.locator('input[type=checkbox]').first();await task.check();await waitDocument(richTitle,d=>/<input[^>]*checked/.test(d.content));
      await formatting.getByRole('button',{name:'Table',exact:true}).click();let tableDialog=page.getByRole('dialog',{name:'Insert table',exact:true});await tableDialog.getByRole('spinbutton',{name:'Rows',exact:true}).fill('2');await tableDialog.getByRole('spinbutton',{name:'Columns',exact:true}).fill('2');await tableDialog.getByRole('button',{name:'Insert table',exact:true}).click();await tableDialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Page content');await page.keyboard.type('Measurement');assert.equal(await editor.locator('table tr').count(),2);assert.equal(await editor.locator('table td').first().innerText(),'Measurement');
      const imageBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');const fileChooser=page.waitForEvent('filechooser');await formatting.getByRole('button',{name:'Image',exact:true}).click();await(await fileChooser).setFiles({name:'synthetic-field-map.png',mimeType:'image/png',buffer:imageBytes});await editor.locator('img[alt="synthetic-field-map.png"]').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[contenteditable=true] img')].some(e=>e.complete&&e.naturalWidth===1));
      const rich=await waitDocument(richTitle,d=>d.content.includes('attachment:')&&d.content.includes('Measurement')&&d.content.includes('<pre>')&&d.content.includes('<blockquote>')&&d.content.includes('<ol>'));
      const semantic=html=>({heading:html.includes('<h1>'),italic:/<(?:i|em)>typed<\/(?:i|em)>/.test(html),underline:html.includes('<u>opening</u>'),bullets:html.includes('First bullet'),ordered:html.includes('First ordered note'),nested:html.includes('Inner observation'),quote:html.includes('<blockquote>'),code:html.includes('<pre>'),checkbox:/<input[^>]*checked/.test(html),table:html.includes('Measurement'),image:html.includes('attachment:')});assert.ok(Object.values(semantic(rich.content)).every(Boolean));await shot('w04-rich-production-desktop');
      await open(f.page.title);await open(richTitle);const reopened=await waitDocument(richTitle,d=>Object.values(semantic(d.content)).every(Boolean));assert.deepEqual(semantic(reopened.content),semantic(rich.content));assert.equal(await editor.locator('input[type=checkbox]').first().isChecked(),true);assert.equal(await editor.locator('img').first().evaluate(e=>e.complete&&e.naturalWidth===1),true);
      receipt.w04Exports=[];
      for(const [label,filename]of [['Export DOCX','w04-rich-editor.docx'],['Export PDF','w04-rich-editor.pdf'],['Export MD','w04-rich-editor.md']]){await menu('Export and recovery');const recovery=page.getByRole('dialog',{name:'Export and recovery',exact:true});const [dl]=await Promise.all([page.waitForEvent('download'),recovery.getByRole('button',{name:label,exact:true}).click()]);await dl.saveAs(out+'/'+filename);await page.keyboard.press('Escape');receipt.w04Exports.push({label,path:out+'/'+filename,sha256:sha(await fs.readFile(out+'/'+filename))});}
      // Existing Markdown is converted through the real user file-import flow,
      // then exported/imported again without claiming universal format fidelity.
      const importBytes=async(name,bytes,mime)=>{await btn('Workspace menu').click();const pending=page.waitForEvent('filechooser');await page.getByRole('menuitem',{name:'Import',exact:true}).click();await(await pending).setFiles({name,mimeType:mime,buffer:bytes});await page.waitForFunction(t=>document.querySelector('.ws-title')?.value===t,name.replace(/\.[^.]+$/,''));};
      const legacy='# Legacy field journal\n\nLegacy **bold** and *italic* notes.\n\n- Outer legacy observation\n  - Inner legacy observation\n- [x] Checked legacy task\n\n> Legacy quotation\n\n```\nlegacy_code = 4\n```\n\n| Measure | Value |\n| --- | --- |\n| Depth | Four |\n';await importBytes('Legacy field journal.md',Buffer.from(legacy),'text/markdown');assert.equal(await editor.locator('h1').innerText(),'Legacy field journal');assert.match(await editor.locator('ul ul').innerText(),/Inner legacy observation/);assert.match(await editor.locator('pre').innerText(),/legacy_code = 4/);assert.match(await editor.locator('table').innerText(),/Depth[\s\S]*Four/);assert.equal(await editor.locator('input[type=checkbox]').isChecked(),true);await shot('w04-legacy-markdown-import');
      await menu('Export and recovery');const recovery=page.getByRole('dialog',{name:'Export and recovery',exact:true});const [mdDownload]=await Promise.all([page.waitForEvent('download'),recovery.getByRole('button',{name:'Export MD',exact:true}).click()]);await mdDownload.saveAs(out+'/legacy-roundtrip.md');await page.keyboard.press('Escape');await importBytes('Legacy roundtrip.md',await fs.readFile(out+'/legacy-roundtrip.md'),'text/markdown');assert.match(await editor.locator('ul ul').innerText(),/Inner legacy observation/);assert.equal(await editor.locator('input[type=checkbox]').isChecked(),true);assert.match(await editor.innerHTML(),/<strong>bold<\/strong>/);
      await importBytes('Rich Word roundtrip.docx',await fs.readFile(out+'/w04-rich-editor.docx'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');assert.match(await editor.innerText(),/Ordinary typed opening/);assert.match(await editor.innerText(),/Measurement/);assert.match(await editor.innerText(),/const level = 3/);await shot('w04-docx-roundtrip');
      const afterBroader=await stateRead();assert.equal(afterBroader.items.find(x=>x.id===f.page.id).content,beforeBroader.items.find(x=>x.id===f.page.id).content);assert.deepEqual(afterBroader.comments.filter(x=>x.item_id===f.page.id),beforeBroader.comments.filter(x=>x.item_id===f.page.id));
      receipt.w04={createdThroughUI:true,actualTypingAndMultilineLists:true,marksHeadingsQuotesCodeTablesCheckboxImage:true,undoRedo:true,autosaveReopen:true,syntheticClipboardEvent:'Production paste handler with nested/multiline data; OS clipboard untouched, not native clipboard proof.',legacyMarkdownImportAndRoundtrip:true,docxRepresentativeTextTableRoundtrip:true,originalAnchoredPageAndCommentsUnchanged:true,rawImageAttachmentPreserved:true,limits:'Current production host/SDK/API/Store with synthetic owner only. DOCX images/checklist import, MD heading-normal reset and exact weight/layout losses remain named. Image fixture is1pixel, verifies decoding/persistence, not aesthetic image quality. Render actual new DOCX/PDF separately. No native/provider/model quality or universal interchange acceptance.'};
    });
    receipt.status=phase==='keyboard'?'PASS_FOCUSED_KEYBOARD':phase==='workflows'?'PASS_FOCUSED_HTTP_WORKFLOWS':phase==='editor'?'PASS_FOCUSED_HTTP_EDITOR':phase==='resources'?'PASS_FOCUSED_RESOURCES':phase==='wide'?'PASS_FOCUSED_WIDE':phase==='database'?'PASS_FOCUSED_DATABASE':'PASS';
    if(['review23','review25','comment-fixes'].includes(phase)&&receipt.cases.some(c=>c.status==='FAIL')){receipt.status='FAIL';process.exitCode=1;}
  }
}catch(error){receipt.status='FAIL';receipt.failure=error.stack;process.exitCode=1;if(page){receipt.debug=(await page.locator('body').innerText()).slice(-7000);await page.screenshot({path:out+'/FAILED.png',animations:'disabled'}).catch(()=>{});}}
finally{
  if(context)await context.close();if(browser)await browser.close();
  if(server){server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);});receipt.serverExit=server.exitCode;}
  if(serverLog)await serverLog.close();
  receipt.finished=new Date().toISOString();await save();console.log(JSON.stringify({phase,status:receipt.status,cases:receipt.cases,errors:receipt.errors,timings:receipt.timings,failure:receipt.failure}));
}
