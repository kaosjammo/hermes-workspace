"""Canonical RPC, Desktop adapter and source-policy integration qualification.

Private owner/row-journal workflow tests were consolidated into the production
public contract suites. See phase-04-integration/workflow-retired-tests.json in
the local task evidence for the exact names, replacements and unqualified lanes.
No full native/IPC/provider acceptance is claimed by that consolidation.
"""
import json
import os
from runtime_paths import node_command
from pathlib import Path
import tempfile
import unittest
from workspace_plugin.workflow import Workflow
from workspace_plugin.native import NativeSessions


class NativeProtocolTests(unittest.IsolatedAsyncioTestCase):
    """Actual canonical handlers + SQLite; queue scheduling held by a fixture.

    No gateway owner/port is started, no provider is called, and no live inference
    or Electron transport acceptance is asserted by this deterministic fixture.
    """
    def setUp(self):
        from hermes_constants import set_hermes_home_override
        from gateway.config import GatewayConfig
        from gateway.session import SessionStore
        from gateway.session_authority import initialize_session_authority
        from gateway.session_controls import AuthorityConnection
        from types import SimpleNamespace
        self.temp=tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.home=Path(self.temp.name)/'profiles'/'alpha'
        self.home.mkdir(parents=True)
        self.home_token=set_hermes_home_override(self.home)
        # Synthetic non-routable provider identity; creation is lazy and held
        # queue scheduling ensures this test never invokes it.
        (self.home/'config.yaml').write_text('model: {default: fixture-model, provider: custom, base_url: "http://127.0.0.1:9/v1"}\n')
        self.store=SessionStore(self.home/'sessions',GatewayConfig())
        runner=SimpleNamespace(session_store=self.store,_session_db=self.store._db,adapters={},_draining=False,_cached_agent_for=lambda route:None)
        runner._adapter_for_source=lambda source:runner.adapters.get(source.platform)
        self.runner=runner

    async def asyncSetUp(self):
        import asyncio
        from gateway.session_authority import initialize_session_authority
        from gateway.session_controls import AuthorityConnection
        self.authority=await asyncio.wait_for(initialize_session_authority(self.runner,profile_id=str(self.home),instance_id='synthetic-protocol-runtime'), timeout=10)
        self.authority._schedule=lambda ref:None
        class FixtureTransport:
            desktop_local=True
            def write(self,frame): return True
        self.connection=AuthorityConnection(self.authority,FixtureTransport(),{'user_id':'synthetic-user','native_bootstrap':True})

    async def asyncTearDown(self):
        from hermes_constants import reset_hermes_home_override
        await self.connection.close()
        self.store._db.close()
        reset_hermes_home_override(self.home_token)
        self.temp.cleanup()

    async def call(self,method,**params):
        reply=await self.connection.dispatch({'id':1,'method':method,'params':params})
        self.assertIn('result',reply,repr(reply))
        return reply['result']

    async def test_gui_create_resume_reuse_select_submit_cancel_real_handlers(self):
        from workspace_plugin.store import Store
        created=await self.call('session.create',source='gui',request_id='workspace-page',title='Workspace fixture')
        self.assertEqual(created['info']['desktop_protocol'],'hermes-gateway-v1')
        sid=created['stored_session_id']
        again=await self.call('session.create',source='gui',request_id='workspace-page',title='Workspace fixture')
        self.assertEqual(again['stored_session_id'],sid)
        resumed=await self.call('session.resume',session_id=sid,omit_messages=True)
        self.assertEqual(resumed['stored_session_id'],sid)
        store=Store(self.home)
        page=store.execute('create_item',{'kind':'page','title':'Native fixture page','content':'Before'})
        comment=store.execute('add_comment',{'item_id':page['id'],'text':'Edit this fixture page.'})
        flow=Workflow(self.home,store=store)
        prepared=flow.prepare(page['id'],sid,principal_id='synthetic-owner')
        receipt=await self.call('prompt.submit',session_id=resumed['session_id'],text=prepared['prompt'],submission_id=prepared['submission_id'])
        self.assertEqual(receipt['status'],'queued')
        flow.record_submission(prepared['run']['id'],receipt['admission_id'])
        stopped=flow.stop(prepared['run']['id'])
        cancelled=await self.call('prompt.cancel',session_id=stopped['control']['session_id'],admission_id=stopped['control']['admission_id'])
        self.assertEqual(cancelled['status'],'terminal')
        self.assertEqual(flow.status(prepared['run']['id'])['run']['status'],'cancelled')
        second=await self.call('session.create',source='gui',request_id='user-selected-existing')
        flow.bind_thread(page['id'],second['stored_session_id'])
        self.assertEqual(flow.prepare(page['id'],second['stored_session_id'],principal_id='synthetic-owner')['run']['session_id'],second['stored_session_id'])


class FrontendAdapterTests(unittest.TestCase):
    def test_thread_picker_merges_native_ids_and_fences_both_feeds(self):
        """Deterministic SDK adversaries supplement the real canonical feed test."""
        import subprocess
        script=r'''
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
let epoch,selected,calls,mode,busy;
const route={connectionId:'chosen',profile:'chosen-profile',targetProfile:'native-profile'};
const live=[{session_id:'shared',id:'live-alias',title:'Live title',running:true},
 {session_id:'live-only',id:'live-only',title:'Same name'},
 {stored_session_id:'stable',session_id:'transient',id:'alias',title:'Stable identity'}];
const stored=[{session_id:'shared',id:'stored-alias',title:'Stored title',running:false,resolved_id:'shared'},
 {id:'stored-only',title:'Same name'}];
const reset=value=>{epoch=1;selected={connectionId:'chosen',profile:'chosen-profile'};calls=[];mode=value;busy=null;};
reset('ok');
globalThis.fixtureSdk={gatewayActivationEpoch:()=>epoch,host:{
 activeConnectionId:()=>selected.connectionId,
 state:{profile:{get:()=>selected.profile},focusedSessionOwner:{get:()=>({connectionId:'background',profile:'foreign'})}},
 profileRoutes:async()=>[route,{connectionId:'background',profile:'foreign',targetProfile:'foreign'}],
 requestProfile:async(r,method,params)=>{
  calls.push({kind:'rpc',route:r,method,params});
  assert.deepEqual(r,route);assert.equal(params.profile,route.targetProfile);
  if(method==='session.resume')return {stored_session_id:params.session_id,running:busy==='running',
   pending:busy==='pending'?[{id:'queued'}]:[],info:{desktop_protocol:'hermes-gateway-v1'}};
  assert.equal(method,'session.list');assert.equal(params.include_hidden,false);
  if(mode===`error-${params.scope}`)throw new Error(`native ${params.scope} failed`);
  if(params.scope==='live'){
   if(mode==='epoch-between')epoch++;
   if(mode==='profile-between')selected.profile='foreign';
   if(mode==='connection-between')selected.connectionId='foreign';
   return {sessions:live};
  }
  assert.equal(params.scope,'stored');
  if(mode==='epoch-last')epoch++;
  if(mode==='bad-shape')return {};
  if(mode==='bad-id')return {sessions:[{title:'No native identity'}]};
  return {sessions:stored};
 }}};
const source=(await readFile('frontend/workflow.js','utf8')).replace("import { host, gatewayActivationEpoch } from '@hermes/plugin-sdk';","const {host,gatewayActivationEpoch}=globalThis.fixtureSdk;");
const {createWorkflowAdapter}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const flow=createWorkflowAdapter({rest:async(path,options)=>{
 calls.push({kind:'rest',path,options});
 if(path==='/state')return {scope_id:'scope-chosen',items:[]};
 throw new Error('Busy native threads must never reach a mutation');
}});
const rows=await flow.listThreads();
assert.ok(Array.isArray(rows));
assert.deepEqual(rows.map(r=>r.id),['shared','live-only','stable','stored-only']);
assert.equal(rows[0].title,'Live title');assert.equal(rows[0].running,true);
assert.equal(rows[0].resolved_id,undefined);
assert.deepEqual(calls.map(c=>c.params.scope),['live','stored']);
assert.strictEqual(calls[0].route,calls[1].route,'One captured exact route descriptor');
assert.equal(calls.filter(c=>c.kind==='rest').length,0,'Picker never requests server mutation scope');
for(const scope of ['live','stored']){
 reset(`error-${scope}`);
 await assert.rejects(flow.listThreads(),new RegExp(`native ${scope} failed`));
 assert.equal(calls.length,scope==='live'?1:2,'No partial success or feed retry');
}
for(const switchMode of ['epoch-between','profile-between','connection-between']){
 reset(switchMode);
 await assert.rejects(flow.listThreads(),/changed/);
 assert.equal(calls.length,1,'No stale second feed request');
}
reset('epoch-last');await assert.rejects(flow.listThreads(),/changed/);
assert.equal(calls.length,2,'A switch during the last read blocks publication');
for(const invalid of ['bad-shape','bad-id']){
 reset(invalid);await assert.rejects(flow.listThreads(),/unavailable/);
}
for(const state of ['running','pending']){
 reset('ok');busy=state;
 await assert.rejects(flow.bindThread('page','shared'),/busy/);
 assert.equal(calls.filter(c=>c.kind==='rest'&&c.path!=='/state').length,0);
 assert.equal(calls.filter(c=>c.kind==='rpc').length,1);
 assert.equal(calls.find(c=>c.kind==='rpc').method,'session.resume');
}
flow.dispose();
console.log('PASS deterministic SDK: live/stored merge, native IDs, equal titles, live precedence, errors, epoch/profile/connection fences, busy bind refusal');
'''
        root=Path(__file__).resolve().parents[1]
        test_path=Path(os.environ['TMPDIR'])/'thread-picker-adversaries.mjs'
        test_path.write_text(script)
        node=node_command()
        result=subprocess.run([str(node),str(test_path)],cwd=root,text=True,capture_output=True,timeout=15)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_selected_owner_scope_stop_and_stale_follow_ons(self):
        import subprocess
        script=r'''
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
let epoch=1, selected={connectionId:'chosen-source',profile:'chosen-profile'};
let state={scope_id:'scope-chosen',revision:1,items:[{id:'page',title:'Fixture',thread_id:null}],
 comments:[{id:'legacy-reference',item_id:'page',resolved:false,target_item_ids:['selected-target']}]};
let runNumber=0, calls=[], switchOnState=false, expectedTargets=[];
const nativeSnapshot=id=>({session_id:id,stored_session_id:id,running:false,pending:[],info:{desktop_protocol:'hermes-gateway-v1'}});
globalThis.fixtureSdk={gatewayActivationEpoch:()=>epoch,host:{
 activeConnectionId:()=>selected.connectionId,
 state:{profile:{get:()=>selected.profile},focusedSessionOwner:{get:()=>({connectionId:'background',profile:'foreign'})}},
 profileRoutes:async()=>[{connectionId:'chosen-source',profile:'chosen-profile',targetProfile:'native-profile'},{connectionId:'background',profile:'foreign',targetProfile:'other-profile'}],
 requestProfile:async(route,method,params)=>{
  calls.push({kind:'rpc',route,method,params});
  assert.equal(route.connectionId,'chosen-source');assert.equal(params.profile,'native-profile');
  if(method==='session.list')return {sessions:[{id:'native-one',title:'Existing'}]};
  if(method==='session.create'){assert.equal(params.source,'gui');return nativeSnapshot('native-one');}
  if(method==='session.resume'){assert.equal(params.source,undefined);return nativeSnapshot(params.session_id);}
  if(method==='prompt.submit'){assert.equal(params.submission_id,`run-${runNumber}`);return {admission_id:'admission',status:'queued'};}
  if(method==='prompt.cancel')return {status:'terminal'};
 },
 openSession:async(id,options)=>{calls.push({kind:'open',id,options});}
}};
const source=(await readFile('frontend/workflow.js','utf8')).replace("import { host, gatewayActivationEpoch } from '@hermes/plugin-sdk';","const {host,gatewayActivationEpoch}=globalThis.fixtureSdk;");
const {createWorkflowAdapter}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const ctx={rest:async(path,opts)=>{
 calls.push({kind:'rest',path,opts});
 if(path==='/state'){if(switchOnState){epoch++;selected={connectionId:'foreign',profile:'foreign'};}return state;}
 assert.equal(opts.body.expected_scope,'scope-chosen');
 if(path==='/workflow/bind'){state.items[0].thread_id=opts.body.thread_id;return state.items[0];}
 if(path==='/workflow/prepare'){assert.deepEqual(opts.body.explicit_item_ids,expectedTargets);state.items[0].thread_id=opts.body.session_id;return {run:{id:`run-${++runNumber}`},submission_id:`run-${runNumber}`,prompt:'native fixture prompt'};}
 if(path==='/workflow/submitted')return {run:{id:opts.body.run_id}};
 if(path==='/workflow/recover')return {run:{id:opts.body.run_id,status:'error'},native_terminal:'UNKNOWN'};
 if(path==='/workflow/stop')return {run:{id:opts.body.run_id},control:{session_id:'native-one',admission_id:'admission'}};
 if(path==='/workflow/status')return {run:{id:opts.body.run_id,status:'running'}};
},onDispose:()=>{}};
const flow=createWorkflowAdapter(ctx);
assert.equal((await flow.listThreads())[0].id,'native-one');
assert.equal(calls[0].kind,'rpc'); // focused background owner is irrelevant
expectedTargets=['selected-target'];
const beforeUnreviewed=calls.filter(c=>c.kind==='rpc').length;
await assert.rejects(flow.addressComments('page',['unreviewed-target']),/cannot be approved/);
assert.equal(calls.filter(c=>c.kind==='rpc').length,beforeUnreviewed,'Unreviewed target refused before native effects');
let first=await flow.addressComments('page',['selected-target']);
expectedTargets=[];
await flow.addressComments('page');
assert.equal(calls.filter(c=>c.method==='session.create').length,1);
assert.equal(calls.filter(c=>c.method==='session.resume').length,1);
const initialCreate=calls.find(c=>c.method==='session.create');
state.items[0].thread_id=null;
await flow.addressComments('page');
const restoredCreate=calls.filter(c=>c.method==='session.create').at(-1);
assert.notEqual(initialCreate.params.request_id,restoredCreate.params.request_id);
assert.notEqual(initialCreate.params.title,restoredCreate.params.title);
await flow.bindThread('page','native-selected');
assert.equal(state.items[0].thread_id,'native-selected');
await flow.openThread('native-selected');
assert.equal(calls.find(c=>c.kind==='open').options.intent,'tab');
calls=[];
await flow.stop(first);
assert.ok(calls.findIndex(c=>c.path==='/workflow/stop')<calls.findIndex(c=>c.method==='prompt.cancel'));
await flow.status(first);
assert.equal((await flow.recover(first)).status,'error');
flow.dispose();await assert.rejects(flow.listThreads(),/changed/);
calls=[];switchOnState=true;
const stale=createWorkflowAdapter(ctx);
await assert.rejects(stale.addressComments('page'),/changed/);
assert.equal(calls.filter(c=>c.kind==='rpc').length,0);
console.log('PASS actual adapter with deterministic SDK: selected source, scope, reuse/selection, Stop ordering, stale follow-on rejection');
'''
        root=Path(__file__).resolve().parents[1]
        test_path=Path(os.environ['TMPDIR'])/'adapter-behaviour.mjs'
        test_path.write_text(script)
        node=node_command()
        result=subprocess.run([str(node) if node.exists() else 'node',str(test_path)],cwd=root,text=True,capture_output=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)


class AdapterCanonicalSourceTests(unittest.IsolatedAsyncioTestCase):
    """Execute adapter-generated fields against real native canonical handlers.

    The SDK facade is a routing-only stdio bridge: params and native replies are
    forwarded unchanged. It never substitutes snapshots or checks source values
    itself. Workspace prepare is a deliberate stop barrier, so no prompt/run or
    provider response/inference occurs. This is not renderer/auth acceptance.
    """
    async def test_adapter_create_resume_preserves_native_creation_policy(self):
        import asyncio
        import hashlib
        import sys
        from gateway.config import GatewayConfig
        from gateway.run import GatewayRunner
        from gateway.session_authority import initialize_session_authority
        from gateway.session_controls import AuthorityConnection
        from gateway.runtime_ownership import process_ownership
        from gateway.run_runtime import _retire_profile_authority
        from gateway.owner_identity import host_owner_subject
        from hermes_constants import set_hermes_home_override, reset_hermes_home_override
        from hermes_cli.profiles import _get_profiles_root
        from hermes_state_local import POLICY_PREFIX
        root=Path(__file__).resolve().parents[1]
        profiles=_get_profiles_root(); profiles.mkdir(parents=True,exist_ok=True)
        temp=tempfile.TemporaryDirectory(prefix='workspace-adapter-',dir=profiles)
        home=Path(temp.name).resolve(); token=set_hermes_home_override(home)
        (home/'config.yaml').write_text('model: {default: synthetic-source-no-inference, provider: custom, base_url: "http://127.0.0.1:9/v1", context_length: 64000}\nmemory: {memory_enabled: false}\n')
        runner=None; connection=None; child=None; calls=[]; summary=None; transitions=[]; receipt=None
        process_ownership.reserve([home])
        def policy_source(authority,sid):
            with authority.db._read_ctx() as conn:
                raw=conn.execute('SELECT value FROM state_meta WHERE key=?',(POLICY_PREFIX+sid,)).fetchone()
            return json.loads(raw[0])['policy']['source']
        try:
            runner=GatewayRunner(GatewayConfig(multiplex_profiles=False))
            authority=await initialize_session_authority(runner,profile_id=str(home),instance_id='adapter-source-contract')
            class Transport:
                desktop_local=True
                def write(self,frame): return True
            connection=AuthorityConnection(authority,Transport(),{'user_id':host_owner_subject(),'provider':'local',
                'profile_id':str(home),'instance_id':authority.instance_id,'native_bootstrap':True})
            # An existing native CLI thread proves resume does not rebind its policy to GUI.
            cli=await connection.dispatch({'id':'fixture-cli','method':'session.create','params':{
                'source':'cli','request_id':'existing-cli-source-contract','cwd':str(home),'toolsets':[]}})
            self.assertIn('result',cli,repr(cli))
            cli_id=cli['result']['stored_session_id']; self.assertEqual(policy_source(authority,cli_id),'cli')
            async def create_control(request_id, *, hidden=False, closed=False):
                reply=await connection.dispatch({'id':request_id,'method':'session.create','params':{
                    'source':'gui','request_id':request_id,'title':request_id,'cwd':str(home),'toolsets':[],'hidden':hidden}})
                self.assertIn('result',reply,repr(reply))
                value=reply['result']
                if closed:
                    detached=await connection.dispatch({'id':request_id+'-close','method':'session.detach','params':{
                        'session_id':value['stored_session_id'],'subscription_id':value['subscription_id'],'end_reason':'tui_close'}})
                    self.assertTrue(detached.get('result',{}).get('detached'),repr(detached))
                return value['stored_session_id']
            stored_id=await create_control('stored-picker-control',closed=True)
            hidden_ids=[await create_control('hidden-live-picker-control',hidden=True),
                        await create_control('hidden-stored-picker-control',hidden=True,closed=True)]
            script=r'''
import {readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
const reader=createInterface({input:process.stdin});let next=0,pending=new Map();
reader.on('line',line=>{const reply=JSON.parse(line),wait=pending.get(reply.id);pending.delete(reply.id);
 if(reply.error)wait.reject(new Error(JSON.stringify(reply.error)));else wait.resolve(reply.result);});
function rpc(route,method,params){return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});
 process.stdout.write(JSON.stringify({kind:'rpc',id,route,method,params})+'\n');});}
let guiId=null;const nativeCreates=[];const nativeResumes=[];
const route={connectionId:'synthetic-local',profile:process.env.WORKSPACE_ADAPTER_PROFILE,targetProfile:process.env.WORKSPACE_ADAPTER_PROFILE,mode:'local'};
globalThis.fixtureSdk={gatewayActivationEpoch:()=>1,host:{activeConnectionId:()=>route.connectionId,
 state:{profile:{get:()=>route.profile}},profileRoutes:async()=>[route],
 requestProfile:async(r,method,params)=>{const answer=await rpc(r,method,params);
  if(method==='session.create'){nativeCreates.push(answer);guiId??=answer.stored_session_id;}
  if(method==='session.resume')nativeResumes.push(answer);return answer;}}};
const source=(await readFile('frontend/workflow.js','utf8')).replace("import { host, gatewayActivationEpoch } from '@hermes/plugin-sdk';","const {host,gatewayActivationEpoch}=globalThis.fixtureSdk;");
const {createWorkflowAdapter}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const state={scope_id:'synthetic-workspace-scope',items:[{id:'page',title:'Actual adapter source contract',thread_id:null}]};
let blockedPrepares=0;
const flow=createWorkflowAdapter({rest:async(path,options)=>{
 if(path==='/state')return state;
 if(path==='/workflow/prepare'){blockedPrepares++;throw new Error('STOP_BEFORE_WORKSPACE_PREPARE');}
 if(path==='/workflow/bind'){state.items[0].thread_id=options.body.thread_id;return state.items[0];}
 throw new Error('Forbidden REST operation: '+path);
}});
try{
 await assert.rejects(flow.addressComments('page'),/STOP_BEFORE_WORKSPACE_PREPARE/);
 await assert.rejects(flow.addressComments('page'),/STOP_BEFORE_WORKSPACE_PREPARE/);
 assert.equal(nativeCreates.length,2);assert.equal(nativeCreates[0].stored_session_id,nativeCreates[1].stored_session_id);
 const listed=await flow.listThreads();
 const ids=listed.map(t=>t.stored_session_id??t.session_id??t.id);
 assert.ok(ids.includes(guiId),'Actual adapter listThreads omits native live idle GUI thread '+guiId);
 assert.ok(ids.includes(process.env.WORKSPACE_ADAPTER_CLI_ID),'Actual adapter omits native live CLI thread');
 assert.ok(ids.includes(process.env.WORKSPACE_PICKER_STORED_ID),'Actual adapter omits closed native stored thread');
 assert.equal(ids.length,new Set(ids).size,'One option per native ID across the two real feeds');
 assert.equal(ids.length,3);
 for(const hidden of JSON.parse(process.env.WORKSPACE_PICKER_HIDDEN_IDS))assert.ok(!ids.includes(hidden));
 assert.equal(listed.find(t=>(t.stored_session_id??t.session_id??t.id)===guiId).resolved_id,undefined,
  'The native live snapshot must take precedence over its later stored duplicate');
 await flow.bindThread('page',guiId);
 await assert.rejects(flow.addressComments('page'),/STOP_BEFORE_WORKSPACE_PREPARE/);
 await flow.bindThread('page',process.env.WORKSPACE_ADAPTER_CLI_ID);
 await assert.rejects(flow.addressComments('page'),/STOP_BEFORE_WORKSPACE_PREPARE/);
 assert.equal(nativeResumes.length,4);assert.equal(blockedPrepares,4);
 process.stdout.write(JSON.stringify({kind:'summary',ok:true,gui_id:guiId,cli_id:process.env.WORKSPACE_ADAPTER_CLI_ID,
  create_ids:nativeCreates.map(x=>x.stored_session_id),resume_ids:nativeResumes.map(x=>x.stored_session_id),picker_ids:ids})+'\n');
}catch(error){process.stdout.write(JSON.stringify({kind:'summary',ok:false,error:String(error)})+'\n');process.exitCode=1;}
finally{flow.dispose();reader.close();process.stdin.pause();}
'''
            env={**os.environ,'WORKSPACE_ADAPTER_PROFILE':home.name,'WORKSPACE_ADAPTER_CLI_ID':cli_id,
                'WORKSPACE_PICKER_STORED_ID':stored_id,'WORKSPACE_PICKER_HIDDEN_IDS':json.dumps(hidden_ids)}
            node=node_command()
            child=await asyncio.create_subprocess_exec(str(node),'--input-type=module','-e',script,cwd=root,env=env,
                stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
            # Four Address attempts also read optional inert profile titles.
            for _ in range(28):
                line=await asyncio.wait_for(child.stdout.readline(),12)
                if not line: break
                packet=json.loads(line)
                if packet['kind']=='summary': summary=packet; break
                self.assertEqual(packet['kind'],'rpc')
                self.assertIn(packet['method'],{'session.create','session.resume','session.list','profiles.list'},'Only session reads/creation and optional inert profile reads are permitted; no prompt/provider operation')
                # Preserve the exact adapter-generated wire fields. The native
                # dispatcher owns profile selection and its closed source contract.
                reply=await asyncio.wait_for(connection.dispatch({'id':packet['id'],'method':packet['method'],'params':packet['params']}),10)
                calls.append({'request':packet,'reply':reply})
                if packet['method']=='session.list' and packet['params']['scope']=='live' and not transitions:
                    # Real lifecycle race: the live snapshot was already captured.
                    # Close that GUI viewer before the adapter queries stored, so
                    # native feeds genuinely return the same ID in both snapshots.
                    gui=next(c['reply']['result']['stored_session_id'] for c in calls if c['request']['method']=='session.create')
                    self.assertTrue(any(row['session_id']==gui for row in reply['result']['sessions']))
                    detached=await connection.dispatch({'id':'between-feeds-close','method':'session.detach','params':{
                        'session_id':gui,'subscription_id':connection.subscriptions[gui],'end_reason':'tui_close'}})
                    self.assertTrue(detached.get('result',{}).get('detached'),repr(detached))
                    transitions.append({'between_native_feeds':'GUI closed after live snapshot, before stored snapshot',
                        'session_id':gui,'reply':detached})
                child.stdin.write((json.dumps(reply)+'\n').encode()); await child.stdin.drain()
            child.stdin.close(); await child.stdin.wait_closed()
            code=await asyncio.wait_for(child.wait(),5)
            stderr=(await child.stderr.read()).decode()
            receipt={'scope':'actual adapter -> unchanged-params SDK routing bridge -> real canonical handlers; no renderer/auth/provider acceptance',
                'adapter':str(root/'frontend/workflow.js'),'adapter_sha256':hashlib.sha256((root/'frontend/workflow.js').read_bytes()).hexdigest(),
                'native_calls':calls,'summary':summary,'node_exit':code,'stderr':stderr,'pid':os.getpid(),'node_pid':child.pid,
                'picker_controls':{'stored_id':stored_id,'hidden_ids':hidden_ids},'native_feed_transitions':transitions,
                'native_modules':{n:{'path':sys.modules[n].__file__,'sha256':hashlib.sha256(Path(sys.modules[n].__file__).read_bytes()).hexdigest()}
                    for n in ('gateway.session_controls','gateway.session_policy','gateway.session_authority')},'home':str(home)}
            with authority.db._read_ctx() as conn:
                receipt['native_admissions']=conn.execute('SELECT COUNT(*) FROM session_admissions').fetchone()[0]
                receipt['native_turn_leases']=conn.execute('SELECT COUNT(*) FROM session_turn_leases').fetchone()[0]
            if summary and summary.get('ok'):
                receipt['native_gui_policy_source']=policy_source(authority,summary['gui_id'])
                receipt['native_cli_policy_source']=policy_source(authority,cli_id)
            if os.environ.get('WORKSPACE_ADAPTER_RECEIPT'):
                Path(os.environ['WORKSPACE_ADAPTER_RECEIPT']).write_text(json.dumps(receipt,indent=2)+'\n')
            self.assertEqual(code,0,repr(summary)+stderr)
            self.assertTrue(summary and summary['ok'])
            self.assertEqual(receipt['native_gui_policy_source'],'gui')
            self.assertEqual(receipt['native_cli_policy_source'],'cli')
            for call in calls:
                if call['request']['method']=='session.resume':
                    self.assertNotIn('source',call['request']['params'])
            self.assertEqual(receipt['native_admissions'],0)
            self.assertEqual(receipt['native_turn_leases'],0)
        finally:
            if child is not None and child.returncode is None:
                child.kill(); await child.wait()
            if connection is not None: await connection.close()
            if runner is not None:
                await _retire_profile_authority(authority,timeout=5)
                await runner.stop()
            process_ownership.release(home)
            reset_hermes_home_override(token)
            temp.cleanup()
            from gateway.session_cron import owner_for_home
            self.assertIsNone(owner_for_home(home))
            self.assertFalse(process_ownership.owns(home))
            if receipt is not None and os.environ.get('WORKSPACE_ADAPTER_RECEIPT'):
                receipt['cleanup']={'node_joined':child.returncode is not None,'connection_closed':True,
                    'authority_retired':True,'runner_stopped':True,'owner_unbound':owner_for_home(home) is None,
                    'reservation_released':not process_ownership.owns(home),'synthetic_home_removed':not home.exists()}
                Path(os.environ['WORKSPACE_ADAPTER_RECEIPT']).write_text(json.dumps(receipt,indent=2)+'\n')
