/** Production adapter, documented Desktop routes, synthetic host/backend only. */
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
const out = process.env.HWS_QUALIFICATION_HOME;
const privateRoot=process.env.HWS_PRIVATE_RUNTIME_ROOT ?? out;
const inside=value=>typeof value==='string' && !path.relative(privateRoot,value).startsWith('..') && !path.isAbsolute(path.relative(privateRoot,value));
assert.ok(out && privateRoot && inside(out) && ['HOME','HERMES_HOME','TMPDIR'].every(k=>inside(process.env[k])));
await mkdir(path.join(out,'build'), {recursive:true});
const sdkHost = {};
globalThis.__workspacePublicHost = sdkHost;
globalThis.__workspacePublicEpoch = 1;
await require('esbuild').build({entryPoints:['frontend/workflow.js'], bundle:true, platform:'node', format:'esm',
 outfile:path.join(out,'build/public-workflow.mjs'), plugins:[{name:'documented-synthetic-sdk', setup(build){
 build.onResolve({filter:/^@hermes\/plugin-sdk$/},()=>({path:'sdk', namespace:'synthetic'}));
 build.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:'export const host = globalThis.__workspacePublicHost; export const gatewayActivationEpoch = () => globalThis.__workspacePublicEpoch;'}));
 }}]});
const {createWorkflowAdapter} = await import(path.join(out,'build/public-workflow.mjs'));
after(()=>require('esbuild').stop());
function fixture({title='Aster Ω', missingAdmission=false, profileFailure=false, switchDuringList=false, stoppedBeforeAcknowledgement=false}={}) {
 let selected='route-alpha'; const events=[];
 const route={connectionId:'source-one',profile:'route-alpha',targetProfile:'alpha'};
 let run={id:'run-one',session_id:'stored-one',status:'running'};
 Object.assign(sdkHost, {
 activeConnectionId:()=> 'source-one',state:{profile:{get:()=>selected}},
 profileRoutes:async()=>[route],
 requestProfile:async (actual, method, params)=>{
  assert.deepEqual(actual,route); assert.equal(params.profile,'alpha'); events.push({kind:'rpc',method,params});
  if(method==='profiles.list') {
   assert.equal(params.include_sessions,false);
   if(switchDuringList) selected='other';
   if(profileFailure) throw new Error('Synthetic title unavailable');
   return {profiles:[{name:'other',ui_meta:{'hermes-bots':{title:'Wrong route'}}},
    {name:'alpha',display_name:'Display alpha',ui_meta:{'hermes-bots':{title}}}]};
  }
  if(method==='session.resume') return {info:{desktop_protocol:'hermes-gateway-v1'},stored_session_id:'stored-one',session_id:'live-one',running:false,pending:[]};
  if(method==='prompt.submit') return missingAdmission?{}:{admission_id:'admission-exact'};
  if(method==='prompt.cancel') return {cancelled:true};
  throw new Error('Unexpected RPC '+method);
 },openSession:async()=>{}
 });
 const adapter=createWorkflowAdapter({rest:async (url,options)=>{
  if(url==='/state') return {scope_id:'scope-one',revision:1,items:[{id:'page',title:'Page',thread_id:'stored-one'}],comments:[]};
  const body=options.body; assert.equal(body.expected_scope,'scope-one'); events.push({kind:'post',url,body});
  if(url==='/workflow/prepare') return {run,prompt:'Exact server prompt',submission_id:run.id};
  if(url==='/workflow/submitted') {
   if(stoppedBeforeAcknowledgement) {
    run={...run,status:'cancelled'};
    return {run,control:{session_id:'stored-one',admission_id:'admission-exact'}};
   }
   return {run};
  }
  if(url==='/workflow/consume') return {run,native_terminal:'UNKNOWN'};
  if(url==='/workflow/stop') {run={...run,progress:'Locally revoked'};return {run,control:{session_id:'stored-one',admission_id:'admission-exact'}};}
  if(url==='/workflow/status') return {run};
  throw new Error('Unexpected REST '+url);
 }});
 return {adapter,events,run};
}
test('admission captures friendly title from exact selected backend profile as inert text',async()=>{
 const {adapter,events}=fixture();await adapter.addressComments('page');
 const prepare=events.find(e=>e.url==='/workflow/prepare');
 assert.equal(prepare.body.display_title,'Aster Ω');
 assert.deepEqual(Object.keys(prepare.body).sort(),['display_title','expected_scope','explicit_item_ids','item_id','session_id']);
 assert.ok(events.findIndex(e=>e.method==='profiles.list')<events.indexOf(prepare));
});
test('missing or unavailable friendly title leaves server canonical fallback',async()=>{
 for(const options of [{title:null},{profileFailure:true}]) {
  const {adapter,events}=fixture(options);await adapter.addressComments('page');
  assert.equal(events.find(e=>e.url==='/workflow/prepare').body.display_title, options.title===null?'Display alpha':undefined);
 }
});
test('title fetch cannot continue admission after profile selection changes',async()=>{
 const {adapter,events}=fixture({switchDuringList:true});
 await assert.rejects(adapter.addressComments('page'),/profile or connection changed/);
 assert.equal(events.some(e=>e.url==='/workflow/prepare'),false);
});
test('native cancel follows durable local revocation using exact acknowledged admission',async()=>{
 const {adapter,events}=fixture();const run=await adapter.addressComments('page');await adapter.stop(run);
 const submitted=events.find(e=>e.url==='/workflow/submitted');assert.equal(submitted.body.admission_id,'admission-exact');
 const revoke=events.findIndex(e=>e.url==='/workflow/stop');const cancel=events.findIndex(e=>e.method==='prompt.cancel');
 assert.ok(revoke>=0&&cancel>revoke);assert.equal(events[cancel].params.admission_id,submitted.body.admission_id);
 assert.equal(events[cancel].params.session_id,'stored-one');
});
test('missing submission acknowledgement is unknown and never invents native cancellation target',async()=>{
 const {adapter,events}=fixture({missingAdmission:true});
 await assert.rejects(adapter.addressComments('page'),/acknowledgement is unknown/);
 assert.equal(events.some(e=>e.url==='/workflow/submitted'||e.method==='prompt.cancel'),false);
});
test('Stop before submission acknowledgement still cancels the exact late admission',async()=>{
 const {adapter,events}=fixture({stoppedBeforeAcknowledgement:true});
 const run=await adapter.addressComments('page');assert.equal(run.status,'cancelled');
 const submitted=events.findIndex(e=>e.url==='/workflow/submitted');
 const cancel=events.findIndex(e=>e.method==='prompt.cancel');assert.ok(cancel>submitted);
 assert.equal(events[cancel].params.admission_id,'admission-exact');
 assert.equal(events[cancel].params.session_id,'stored-one');
});
