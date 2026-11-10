"""Behavioural workflow tests; all homes and native DBs are synthetic task state."""
import json
import os
from pathlib import Path
import tempfile
import unittest

from workspace_plugin.workflow import Workflow
from workspace_plugin.native import NativeSessions


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / '.local/workflow/tmp')
        self.home = Path(self.temp.name).resolve()
        from workspace_plugin.store import Store
        from hermes_state import SessionDB
        from hermes_state_runtime import begin_runtime_epoch
        self.store = Store(self.home)
        self.db = SessionDB(self.home / 'state.db')
        self.db.create_session('native-one', source='local')
        self.db.create_session('native-two', source='local')
        self.epoch = begin_runtime_epoch(self.db, instance_id='synthetic-runtime')
        self.native = NativeSessions(self.home, db=self.db)
        self.flow = Workflow(self.home, store=self.store, native=self.native)
        self.page = self.store.execute('create_item', {'kind':'page','title':'Current','content':'<p>Before</p>'})
        self.related = self.store.execute('create_item', {'kind':'page','title':'Related','content':'<p>Related before</p>'})
        self.other = self.store.execute('create_item', {'kind':'page','title':'Unrelated'})
        self.comment = self.store.execute('add_comment', {'item_id':self.page['id'],'text':'Edit Current and Related.','target_item_ids':[self.related['id']]})
        self.answered = self.store.execute('add_comment', {'item_id':self.page['id'],'text':'Also fix this.'})
        self.store.execute('reply_comment', {'id':self.answered['id'],'text':'Earlier response'})
        self.resolved = self.store.execute('add_comment', {'item_id':self.page['id'],'text':'Do not process'})
        self.store.execute('resolve_comment', {'id':self.resolved['id'],'resolved':True})

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def prepare(self, explicit_item_ids=None):
        return self.flow.prepare(self.page['id'], 'native-one', explicit_item_ids)

    def admit(self, prepared, claim=True, text=None, request_id=None):
        from hermes_state_runtime import admit_session_input, claim_session_input
        row = admit_session_input(self.db, epoch=self.epoch, principal_id='synthetic-user', session_id='native-one',
            request_id=request_id or prepared['submission_id'], payload={'text':text or prepared['prompt']})
        if claim:
            row = claim_session_input(self.db, epoch=self.epoch, session_id='native-one')
        return row

    def apply(self, prepared, row, **kwargs):
        return self.flow.apply(prepared['run']['id'], session_id='native-one', task_id='synthetic-native-task',
            admission_id=row['admission_id'], **kwargs)

    def test_all_unresolved_persistent_binding_scope_and_restore(self):
        prepared = self.prepare([self.related['id']])
        run = prepared['run']
        self.assertEqual(set(run['comment_ids']), {self.comment['id'], self.answered['id']})
        self.assertIn(self.related['id'], run['allowed_item_ids'])
        self.assertNotIn(self.other['id'], run['allowed_item_ids'])
        row = self.admit(prepared)
        self.apply(prepared,row,edits=[{'item_id':self.page['id'],'patch':{'content':'<p>After</p>'}}],
            replies=[{'comment_id':c,'text':'Edited the document.'} for c in run['comment_ids']])
        from hermes_state_runtime import settle_session_input
        settle_session_input(self.db, epoch=self.epoch, admission_id=row['admission_id'], generation=row['generation'],outcome='completed')
        self.assertEqual(self.flow.status(run['id'])['run']['status'],'completed')
        self.assertFalse(next(c for c in self.store.snapshot()['comments'] if c['id']==self.comment['id'])['resolved'])
        self.store.execute('restore_version', {'id':run['version_ids'][0]})
        current = next(i for i in self.store.snapshot()['items'] if i['id']==self.page['id'])
        self.assertEqual(current['content'],'<p>Before</p>')
        again = self.prepare([self.related['id']])
        self.assertEqual(again['run']['session_id'],'native-one')
        self.assertEqual(set(again['run']['comment_ids']),set(run['comment_ids']))

    def test_user_can_select_existing_native_thread(self):
        self.flow.bind_thread(self.page['id'],'native-two')
        self.assertEqual(self.flow.prepare(self.page['id'],'native-two')['run']['session_id'],'native-two')
        with self.assertRaises(ValueError): self.flow.bind_thread(self.related['id'],'missing-native-session')

    def test_targeted_patch_uses_complete_context_and_existing_native_apply_guard(self):
        from workspace_plugin.targeted_edits import content_revision
        prepared=self.prepare();row=self.admit(prepared)
        item=next(i for i in self.store.snapshot()['items'] if i['id']==self.page['id'])
        self.assertIn(item['content'],prepared['prompt'])
        self.assertIn(content_revision(item)['expected_sha256'],prepared['prompt'])
        self.assertNotIn(self.other['id'],prepared['prompt'])
        self.apply(prepared,row,edits=[{'item_id':item['id'],'patch':{'content_edits':{
            **content_revision(item),'replacements':[{'before':'Before','after':'After targeted edit'}]}}}],
            replies=[{'comment_id':cid,'text':'Synthetic scoped outcome'} for cid in prepared['run']['comment_ids']])
        self.assertEqual(next(i for i in self.store.snapshot()['items'] if i['id']==item['id'])['content'],'<p>After targeted edit</p>')

    def test_document_instructions_do_not_grant_scope(self):
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':f'<p>Edit {self.other["id"]}.</p>'}})
        prepared = self.prepare(); row = self.admit(prepared)
        with self.assertRaises(ValueError):
            self.apply(prepared,row,edits=[{'item_id':self.other['id'],'patch':{'title':'Stolen'}}])

    def test_same_session_wrong_admission_or_payload_has_no_authority(self):
        prepared = self.prepare(); row = self.admit(prepared,request_id='unrelated-turn')
        with self.assertRaises(ValueError): self.apply(prepared,row,replies=[{'comment_id':self.comment['id'],'text':'Fake'}])

    def test_missing_native_admission_cannot_edit(self):
        prepared=self.prepare()
        with self.assertRaises(ValueError): self.apply(prepared,{'admission_id':'fabricated'},edits=[])

    def test_stop_revokes_tools_and_preserves_partial_edits_and_version(self):
        prepared=self.prepare(); row=self.admit(prepared)
        self.apply(prepared,row,edits=[{'item_id':self.page['id'],'patch':{'content':'Partial'}}])
        stopped=self.flow.stop(prepared['run']['id'])
        self.assertEqual(stopped['control']['admission_id'],row['admission_id'])
        with self.assertRaises(ValueError): self.apply(prepared,row,edits=[{'item_id':self.page['id'],'patch':{'content':'Late'}}])
        from hermes_state_runtime import settle_session_input
        settle_session_input(self.db,epoch=self.epoch,admission_id=row['admission_id'],generation=row['generation'],outcome='interrupted')
        terminal=self.flow.status(prepared['run']['id'])['run']
        self.assertEqual(terminal['status'],'cancelled')
        self.assertTrue(terminal['version_ids'])
        self.assertEqual(next(i for i in self.store.snapshot()['items'] if i['id']==self.page['id'])['content'],'Partial')

    def test_completed_chat_without_per_comment_outcomes_is_error(self):
        prepared=self.prepare(); row=self.admit(prepared)
        from hermes_state_runtime import settle_session_input
        settle_session_input(self.db,epoch=self.epoch,admission_id=row['admission_id'],generation=row['generation'],outcome='completed')
        result=self.flow.status(prepared['run']['id'])['run']
        self.assertEqual(result['status'],'error')
        self.assertIn('outcome',result['error'].lower())
        comments=self.store.snapshot()['comments']
        self.assertTrue(all(next(c for c in comments if c['id']==cid)['replies'] for cid in result['comment_ids']))

    def test_restart_recovery_is_explicit_and_fences_late_tools(self):
        prepared=self.prepare(); row=self.admit(prepared)
        another=Workflow(self.home,store=self.store,native=self.native)
        self.assertEqual(another.status(prepared['run']['id'])['run']['status'],'running')
        self.assertEqual(another.recover(),[])
        self.assertEqual(another.recover(prepared['run']['id'])['native_terminal'],'UNKNOWN')
        self.assertEqual(another.status(prepared['run']['id'])['run']['status'],'error')
        with self.assertRaises(ValueError): self.apply(prepared,row,edits=[])

    def test_profile_and_session_switch_fail_closed(self):
        prepared=self.prepare(); row=self.admit(prepared)
        with self.assertRaises(ValueError): self.flow.apply(prepared['run']['id'],session_id='native-two',task_id='task',admission_id=row['admission_id'])
        from workspace_plugin.store import Store
        second=self.home/'second-profile'
        with self.assertRaises(ValueError): Workflow(second,store=Store(second),native=self.native)

    def test_locked_current_other_page_usable_and_duplicate_run_denied(self):
        prepared=self.prepare()
        with self.assertRaises(ValueError): self.prepare()
        with self.assertRaises(ValueError): self.store.execute('update_item',{'id':self.page['id'],'patch':{'title':'Locked'}})
        self.store.execute('update_item',{'id':self.other['id'],'patch':{'title':'Usable'}})
        with self.assertRaises(ValueError): self.flow.bind_thread(self.page['id'],'native-two')

    def test_resolution_and_thread_patch_cannot_be_model_mutations(self):
        prepared=self.prepare(); row=self.admit(prepared)
        with self.assertRaises(ValueError): self.apply(prepared,row,edits=[{'item_id':self.page['id'],'patch':{'thread_id':'native-two'}}])
        with self.assertRaises(ValueError): self.apply(prepared,row,replies=[{'comment_id':self.resolved['id'],'text':'Out of run'}])



    def test_actual_disk_loader_and_registry_tool_recheck_native_call(self):
        from hermes_cli.plugins import PluginManager
        from hermes_cli.plugins_manifest import PluginManifest
        from tools.registry import registry
        from hermes_constants import set_hermes_home_override, reset_hermes_home_override
        from gateway.session_ingress import viewer_turn
        from gateway.session_display import submission_turn_scope
        from gateway.session_events import SessionEvents
        from types import SimpleNamespace
        manager=PluginManager(scope_key=str(self.home))
        manifest=PluginManifest(name='workspace',source='user',path=str(Path(__file__).resolve().parents[1]),provides_tools=['workspace_apply'])
        manager._load_plugin(manifest)
        self.assertIsNone(manager._plugins['workspace'].error)
        prepared=self.prepare(); row=self.admit(prepared)
        stream=SessionEvents()
        stream.execution={'admission_id':row['admission_id'],'execution_generation':row['generation']}
        token=set_hermes_home_override(self.home)
        viewer_token=viewer_turn.set(SimpleNamespace(event_stream=stream))
        args={'run_id':prepared['run']['id'],'edits':[{'item_id':self.page['id'],'patch':{'content':'Registry saved'}}],
              'replies':[{'comment_id':self.comment['id'],'text':'Saved a direct edit.'}]}
        try:
            with submission_turn_scope(row['admission_id'],prepared['run']['id']):
                result=json.loads(registry.dispatch('workspace_apply',args,scope=str(self.home),session_id='native-one',task_id='native-one'))
                self.assertIn('result',result)
                repeated=json.loads(registry.dispatch('workspace_apply',args,scope=str(self.home),session_id='native-one',task_id='native-one'))
                self.assertIn('result',repeated)
            # Same session/task without per-admission execution context is refused.
            denied=json.loads(registry.dispatch('workspace_apply',args,scope=str(self.home),session_id='native-one',task_id='native-one'))
            self.assertIn('error',denied)
            comment=next(c for c in self.store.snapshot()['comments'] if c['id']==self.comment['id'])
            self.assertEqual(len(comment['replies']),1)
            self.assertFalse(comment['resolved'])
        finally:
            viewer_turn.reset(viewer_token)
            reset_hermes_home_override(token)
            manager.unload()


    def test_native_epoch_change_while_waiting_store_writer_is_rechecked(self):
        import concurrent.futures
        import sqlite3
        import threading
        from unittest.mock import patch
        from hermes_state_runtime import begin_runtime_epoch
        prepared=self.prepare(); row=self.admit(prepared)
        first_check=threading.Event()
        original=self.native.validate_call
        def validated(**kwargs):
            result=original(**kwargs)
            first_check.set()
            return result
        writer=sqlite3.connect(self.store.db_path,isolation_level=None)
        writer.execute('BEGIN IMMEDIATE')
        try:
            with patch.object(self.native,'validate_call',side_effect=validated),concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future=pool.submit(self.apply,prepared,row,edits=[{'item_id':self.page['id'],'patch':{'content':'Must not land'}}])
                try:
                    self.assertTrue(first_check.wait(5))
                    begin_runtime_epoch(self.db,instance_id='replacement-runtime')
                finally:
                    writer.rollback()
                with self.assertRaises(ValueError): future.result(timeout=10)
            self.assertEqual(next(i for i in self.store.snapshot()['items'] if i['id']==self.page['id'])['content'],'<p>Before</p>')
        finally:
            writer.close()

    def test_stop_revocation_commits_even_if_native_receipt_is_unavailable(self):
        from unittest.mock import patch
        prepared=self.prepare(); row=self.admit(prepared)
        with patch.object(self.native,'receipt',side_effect=ValueError('Native state temporarily unavailable')):
            with self.assertRaises(ValueError): self.flow.stop(prepared['run']['id'])
        with self.assertRaises(ValueError): self.apply(prepared,row,edits=[])


    def test_actual_isolated_plugin_host_fails_closed_without_admission_context(self):
        from hermes_cli.plugins import PluginManager
        from hermes_cli.plugins_manifest import PluginManifest
        from tools.registry import registry
        from hermes_constants import set_hermes_home_override, reset_hermes_home_override
        (self.home/'config.yaml').write_text('plugins: {enabled: [workspace], isolation: host}\n')
        prepared=self.prepare(); self.admit(prepared)
        manager=PluginManager(scope_key=str(self.home))
        manifest=PluginManifest(name='workspace',source='user',path=str(Path(__file__).resolve().parents[1]),provides_tools=['workspace_apply'])
        token=set_hermes_home_override(self.home)
        try:
            manager._load_plugin(manifest)
            self.assertIsNone(manager._plugins['workspace'].error)
            entry=registry.get_entry('workspace_apply',scope=str(self.home))
            self.assertTrue(hasattr(entry.handler,'__hermes_plugin_host_ref__'))
            result=json.loads(registry.dispatch('workspace_apply',{'run_id':prepared['run']['id'],'edits':[{'item_id':self.page['id'],'patch':{'content':'Must not land'}}]},
                scope=str(self.home),session_id='native-one',task_id='native-one'))
            self.assertIn('native viewer',result['error'])
            self.assertEqual(next(i for i in self.store.snapshot()['items'] if i['id']==self.page['id'])['content'],'<p>Before</p>')
        finally:
            manager.unload()
            manager._plugin_host().shutdown()
            reset_hermes_home_override(token)


    def test_unconfirmed_submit_and_unreadable_native_can_be_recovered_explicitly(self):
        from unittest.mock import patch
        prepared=self.prepare()
        stopped=self.flow.stop(prepared['run']['id'])
        self.assertEqual(stopped['native_terminal'],'UNKNOWN')
        self.assertEqual(stopped['run']['status'],'running')
        with self.assertRaises(ValueError): self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':'Still locked'}})
        with patch.object(self.native,'receipt',side_effect=ValueError('Native state unavailable')):
            recovered=self.flow.recover(prepared['run']['id'])
        self.assertEqual(recovered['native_terminal'],'UNKNOWN')
        self.assertEqual(recovered['run']['status'],'error')
        self.assertIn('UNKNOWN',recovered['run']['error'])
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':'Usable again'}})
        repeated=self.flow.recover(prepared['run']['id'])
        self.assertEqual(repeated['run']['status'],'error')


    def test_related_scope_requires_user_selected_structured_comment_targets(self):
        default=self.prepare()
        self.assertEqual(default['run']['allowed_item_ids'],[self.page['id']])
        self.store.finish_run(default['run']['id'],'cancelled')
        selected=self.prepare([self.related['id']])
        self.assertEqual(set(selected['run']['allowed_item_ids']),{self.page['id'],self.related['id']})
        self.assertIn('structured comment targets explicitly selected by the user',selected['prompt'])
        self.store.finish_run(selected['run']['id'],'cancelled')
        with self.assertRaises(ValueError): self.prepare([self.other['id']])

    def test_model_cannot_supply_the_user_run_selection(self):
        from workspace_plugin.workflow import apply_tool
        prepared=self.prepare()
        result=json.loads(apply_tool({'run_id':prepared['run']['id'],'edits':[],
            'explicit_item_ids':[self.other['id']]},session_id='native-one',task_id='native-one'))
        self.assertIn('only run_id, edits and replies',result['error'])


    def _journal_failure_retry(self, intervening):
        import sqlite3
        from gateway.session_ingress import viewer_turn
        from gateway.session_display import submission_turn_scope
        from gateway.session_events import SessionEvents
        from hermes_constants import set_hermes_home_override, reset_hermes_home_override
        from types import SimpleNamespace
        from workspace_plugin.workflow import apply_tool
        prepared=self.prepare(); row=self.admit(prepared)
        stream=SessionEvents()
        stream.execution={'admission_id':row['admission_id'],'execution_generation':row['generation']}
        h=set_hermes_home_override(self.home)
        v=viewer_turn.set(SimpleNamespace(event_stream=stream))
        args={'run_id':prepared['run']['id'],'edits':[{'item_id':self.page['id'],'patch':{'content':'<p>Operation A</p>'}}],
              'replies':[{'comment_id':self.comment['id'],'text':'Changed it.'}]}
        def tool(payload):
            return json.loads(apply_tool(payload,session_id='native-one',task_id='native-one'))
        try:
            with submission_turn_scope(row['admission_id'],prepared['run']['id']):
                with sqlite3.connect(self.flow.journal_path) as conn:
                    conn.execute("CREATE TRIGGER repair1_fail BEFORE INSERT ON run_context BEGIN SELECT RAISE(ABORT,'synthetic journal failure'); END")
                with self.assertRaises(sqlite3.IntegrityError): tool(args)
                first=self.store.snapshot()
                first_comment=next(c for c in first['comments'] if c['id']==self.comment['id'])
                self.assertEqual(len(first_comment['replies']),1)
                self.assertEqual(next(i for i in first['items'] if i['id']==self.page['id'])['content'],'<p>Operation A</p>')
                with sqlite3.connect(self.flow.journal_path) as conn:
                    conn.execute('DROP TRIGGER repair1_fail')
                if intervening:
                    self.assertIn('result',tool({'run_id':prepared['run']['id'],
                        'edits':[{'item_id':self.page['id'],'patch':{'content':'<p>Newer operation B</p>'}}],'replies':[]}))
                before=self.store.snapshot()
                self.assertIn('result',tool(args))
                after=self.store.snapshot()
                self.assertEqual(after,before,'Identical retry must not mutate Store state or repeat replies')
                self.assertEqual(next(c for c in after['comments'] if c['id']==self.comment['id'])['replies'],first_comment['replies'])
                self.assertEqual(next(i for i in after['items'] if i['id']==self.page['id'])['content'],
                    '<p>Newer operation B</p>' if intervening else '<p>Operation A</p>')
                with sqlite3.connect(self.flow.journal_path) as conn:
                    context=json.loads(conn.execute('SELECT body FROM run_context WHERE run_id=?',(prepared['run']['id'],)).fetchone()[0])
                self.assertIn(self.comment['id'],context['outcomes'],'Journal reconstructs committed outcome after failure')
                self.flow.stop(prepared['run']['id'])
                stopped=self.store.snapshot()
                self.assertIn('error',tool(args),'Committed operation receipt must not bypass Stop revocation')
                self.assertEqual(self.store.snapshot(),stopped)
        finally:
            viewer_turn.reset(v)
            reset_hermes_home_override(h)

    def test_production_tool_replay_after_post_store_journal_failure(self):
        self._journal_failure_retry(False)

    def test_production_tool_replay_preserves_intervening_edit(self):
        self._journal_failure_retry(True)


    def test_workflow_journal_cache_cannot_suppress_an_uncommitted_operation(self):
        import hashlib
        import sqlite3
        prepared=self.prepare(); row=self.admit(prepared)
        edits=[{'item_id':self.page['id'],'patch':{'content':'<p>Store owns replay identity</p>'}}]
        replies=[{'comment_id':self.comment['id'],'text':'Changed it.'}]
        digest=hashlib.sha256(json.dumps([edits,replies],sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf-8')).hexdigest()
        with sqlite3.connect(self.flow.journal_path) as conn:
            context=json.loads(conn.execute('SELECT body FROM run_context WHERE run_id=?',(prepared['run']['id'],)).fetchone()[0])
            context['operations']=[digest]
            context['outcomes']=[self.comment['id']]
            conn.execute('UPDATE run_context SET body=? WHERE run_id=?',(json.dumps(context),prepared['run']['id']))
        result=self.apply(prepared,row,edits=edits,replies=replies)
        self.assertEqual(result['operation_receipts'],[{'operation_id':digest,'operation_digest':digest,'comment_ids':[self.comment['id']]}])
        state=self.store.snapshot()
        self.assertEqual(next(i for i in state['items'] if i['id']==self.page['id'])['content'],'<p>Store owns replay identity</p>')
        self.assertEqual(len(next(c for c in state['comments'] if c['id']==self.comment['id'])['replies']),1)



class NativeIdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / '.local/workflow/tmp')
        self.home = Path(self.temp.name)
        from hermes_state import SessionDB
        from hermes_state_runtime import begin_runtime_epoch
        self.db = SessionDB(self.home/'state.db')
        self.db.create_session('native-one',source='local')
        self.native = NativeSessions(self.home,db=self.db)
        self.epoch = begin_runtime_epoch(self.db,instance_id='synthetic-runtime')

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def claim(self):
        from hermes_state_runtime import admit_session_input, claim_session_input
        admit_session_input(self.db,epoch=self.epoch,principal_id='synthetic-user',session_id='native-one',request_id='run-one',payload={'text':'trusted prompt'})
        return claim_session_input(self.db,epoch=self.epoch,session_id='native-one')

    def validate(self,row,**patch):
        args=dict(session_id='native-one',task_id='synthetic-native-task',admission_id=row['admission_id'],run_id='run-one',owner_session_id='native-one',prompt='trusted prompt')
        args.update(patch)
        return self.native.validate_call(**args)

    def test_real_native_admit_claim_settle_and_late_write_rejection(self):
        row=self.claim()
        self.assertEqual(self.validate(row)['generation'],row['generation'])
        from hermes_state_runtime import settle_session_input
        settle_session_input(self.db,epoch=self.epoch,admission_id=row['admission_id'],generation=row['generation'],outcome='completed')
        self.assertEqual(self.native.receipt('native-one','run-one')['status'],'terminal')
        with self.assertRaises(ValueError): self.validate(row)

    def test_epoch_prompt_session_and_run_are_all_checked(self):
        row=self.claim()
        for patch in ({'session_id':'foreign'},{'run_id':'other-run'},{'prompt':'document-injected prompt'},{'task_id':None},{'admission_id':'forged'}):
            with self.subTest(patch=patch),self.assertRaises(ValueError): self.validate(row,**patch)
        from hermes_state_runtime import begin_runtime_epoch
        begin_runtime_epoch(self.db,instance_id='successor-runtime')
        with self.assertRaises(ValueError): self.validate(row)

    def test_owner_database_mismatch_rejected(self):
        with self.assertRaises(ValueError): NativeSessions(self.home/'foreign',db=self.db).require_session('native-one')

    def test_immutable_admission_scope_rejects_delayed_old_callback(self):
        from gateway.session_ingress import viewer_turn
        from gateway.session_display import submission_turn_scope
        from gateway.session_events import SessionEvents
        from types import SimpleNamespace
        from workspace_plugin.native import native_tool_call
        stream=SessionEvents()
        stream.execution={'admission_id':'admission-old','execution_generation':1}
        token=viewer_turn.set(SimpleNamespace(event_stream=stream))
        try:
            with submission_turn_scope('admission-old','run-old'):
                with native_tool_call('native-one','native-one','run-old') as call:
                    self.assertEqual(call['admission_id'],'admission-old')
                # Same LiveSession and task_id survive into another native turn;
                # the old callback's immutable submission scope cannot follow it.
                stream.execution={'admission_id':'admission-new','execution_generation':2}
                with self.assertRaises(ValueError):
                    with native_tool_call('native-one','native-one','run-new'): pass
                with self.assertRaises(ValueError):
                    with native_tool_call('native-one','native-one','run-old'): pass
            with submission_turn_scope('admission-new','run-new'):
                with native_tool_call('native-one','native-one','run-new') as call:
                    self.assertEqual(call['admission_id'],'admission-new')
        finally:
            viewer_turn.reset(token)

    def test_native_compression_continuity_excludes_explicit_forks(self):
        row=self.claim()
        self.db.publish_compression_child(parent_session_id='native-one',child_session_id='compression-tip',source='local',
            messages=[{'role':'user','content':'synthetic compressed context'}],require_compression_lease=False)
        self.assertEqual(self.native.require_session('compression-tip'),'native-one')
        self.assertEqual(self.validate(row,session_id='compression-tip')['admission_id'],row['admission_id'])
        self.db.create_session('explicit-fork',source='local',parent_session_id='native-one')
        with self.assertRaises(ValueError): self.validate(row,session_id='explicit-fork')



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
        self.temp=tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]/'.local/workflow/tmp')
        self.home=Path(self.temp.name)
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
        prepared=flow.prepare(page['id'],sid)
        receipt=await self.call('prompt.submit',session_id=resumed['session_id'],text=prepared['prompt'],submission_id=prepared['submission_id'])
        self.assertEqual(receipt['status'],'queued')
        self.assertEqual(flow.status(prepared['run']['id'])['control']['admission_id'],receipt['admission_id'])
        stopped=flow.stop(prepared['run']['id'])
        cancelled=await self.call('prompt.cancel',session_id=stopped['control']['session_id'],admission_id=stopped['control']['admission_id'])
        self.assertEqual(cancelled['status'],'terminal')
        self.assertEqual(flow.status(prepared['run']['id'])['run']['status'],'cancelled')
        second=await self.call('session.create',source='gui',request_id='user-selected-existing')
        flow.bind_thread(page['id'],second['stored_session_id'])
        self.assertEqual(flow.prepare(page['id'],second['stored_session_id'])['run']['session_id'],second['stored_session_id'])


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
        node=root/'.local/toolchain/node-v26.0.0-linux-x64/bin/node'
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
        node=root/'.local/toolchain/node-v26.0.0-linux-x64/bin/node'
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
            node=root/'.local/toolchain/node-v26.0.0-linux-x64/bin/node'
            child=await asyncio.create_subprocess_exec(str(node),'--input-type=module','-e',script,cwd=root,env=env,
                stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
            for _ in range(24):
                line=await asyncio.wait_for(child.stdout.readline(),12)
                if not line: break
                packet=json.loads(line)
                if packet['kind']=='summary': summary=packet; break
                self.assertEqual(packet['kind'],'rpc')
                self.assertIn(packet['method'],{'session.create','session.resume','session.list'},'No prompt/provider operation is permitted')
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
