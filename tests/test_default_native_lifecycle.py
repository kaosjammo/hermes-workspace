"""Real native owners/Store with SYNTHETIC TERMINAL DATA fixtures, not inference.

The fixture writes supported canonical ledger/transcript records and private
server journal bindings as DATA. It does not manufacture a provider response,
viewer ContextVar, PluginManager delivery or inference acceptance. Actual hook
delivery is qualified separately with a legitimate native pre-LLM policy veto.
"""
import asyncio
import faulthandler
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from contextlib import closing

from gateway.config import GatewayConfig
from gateway.run import GatewayRunner
from gateway.session_authority import initialize_session_authority
from gateway.session_contract import SessionActor
from gateway.session_local import create_local_session
from gateway.owner_identity import host_owner_subject
from gateway.run_runtime import _retire_profile_authority
from gateway.runtime_ownership import process_ownership
from hermes_state import SessionDB
from hermes_state_runtime import admit_session_input, claim_session_input, settle_session_input
from workspace_plugin.finalization import ProposalJournal
from workspace_plugin.native import NativeSessions
from workspace_plugin.workflow import Workflow


class DefaultNativeDataLifecycle(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        faulthandler.dump_traceback_later(15, repeat=False)
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.home = Path(self.tmp.name).resolve()
        process_ownership.reserve([self.home])
        self.db = SessionDB(self.home / 'state.db')
        self.runner = GatewayRunner(GatewayConfig(multiplex_profiles=False))
        self.authority = await initialize_session_authority(self.runner,
            profile_id=str(self.home), instance_id='synthetic-terminal-data-owner', db=self.db)
        self.principal = host_owner_subject()
        actor = SessionActor(self.principal, str(self.home),
            frozenset({'session:create','session:read','session:submit','session:control'}), 'synthetic-framework-data')
        self.ref = create_local_session(self.authority, actor, {'request_id': 'fixture-session',
            'source': 'gui', 'cwd': str(self.home), 'model': 'synthetic-data-no-provider', 'toolsets': []})
        self.flow = Workflow(self.home, native=NativeSessions(self.home, db=self.db))
        self.store = self.flow.store
        self.page = self.store.execute('create_item', {'kind': 'page', 'title': 'Fixture', 'content': 'Before'})
        self.comment = self.store.execute('add_comment', {'item_id': self.page['id'], 'text': 'First unresolved'})
        self.answered = self.store.execute('add_comment', {'item_id': self.page['id'], 'text': 'Answered unresolved'})
        self.store.execute('reply_comment', {'id': self.answered['id'], 'text': 'Earlier reply'})

    async def asyncTearDown(self):
        await _retire_profile_authority(self.authority, timeout=3)
        await self.runner.stop()
        self.db.close()
        process_ownership.release(self.home)
        self.tmp.cleanup()
        faulthandler.cancel_dump_traceback_later()

    async def prepared(self, **kwargs):
        return await asyncio.to_thread(self.flow.prepare, self.page['id'], self.ref.session_id,
            principal_id=self.principal, **kwargs)

    def terminal_data(self, prepared, *, reason='text_response(finish_reason=stop)', outcome='completed', stage=True, missing_outcome=False, outside_item=None, patch=None):
        """Supported native record DATA setup, explicitly not a real provider completion."""
        proposal = {'edits': [{'item_id': self.page['id'], 'patch': patch if patch is not None else {'content': 'Saved fixture edit'}}],
            'replies': [{'comment_id': cid, 'text': 'Synthetic final outcome DATA'} for cid in prepared['run']['comment_ids']]}
        if missing_outcome:
            proposal['replies'].pop()
        if outside_item:
            proposal['edits'].append({'item_id': outside_item, 'patch': {'content': 'Outside proposal must refuse'}})
        text = json.dumps(proposal)
        row = admit_session_input(self.db, epoch=self.authority.epoch, principal_id=self.principal,
            session_id=self.ref.session_id, request_id=prepared['run']['id'], payload={'text': prepared['prompt']})
        row = claim_session_input(self.db, epoch=self.authority.epoch, session_id=self.ref.session_id)
        self.db.append_message(self.ref.session_id, 'user', prepared['prompt'])
        self.db.append_message(self.ref.session_id, 'assistant', text)
        with self.db._read_ctx() as conn:
            ids = [r[0] for r in conn.execute('SELECT id FROM messages WHERE session_id=? ORDER BY id', (self.ref.session_id,))][-2:]
        with self.flow._locked() as conn:
            context = self.flow._context(conn, prepared['run']['id'])
            grant = context['finalization']
            grant['binding'] = {'turn_id': 'SYNTHETIC-LOCAL-ORIGIN-DATA', 'session_id': self.ref.session_id,
                'admission_id': row['admission_id'], 'generation': row['generation']}
            if stage:
                value = ProposalJournal(self.home).stage(session_id=self.ref.session_id,
                    turn_id='SYNTHETIC-LOCAL-ORIGIN-DATA', user_message=prepared['prompt'], assistant_response=text,
                    conversation_history=[{'role': 'user', 'content': prepared['prompt'], '_row_id': ids[0], '_db_persisted': True},
                        {'role': 'assistant', 'content': text, '_row_id': ids[1], '_db_persisted': True}])
                grant['proposal_id'] = value['proposal_id']
                grant['post_revision'] = self.db.get_session(self.ref.session_id)['runtime_revision']
                grant['post_history'] = self.flow.native.history_fingerprint(self.ref.session_id)
            self.flow._save(conn, prepared['run']['id'], context)
        result = {'session_id': self.ref.session_id, 'final_response': text, 'completed': True,
            'api_calls': 1, 'turn_exit_reason': reason, 'interrupted': outcome == 'interrupted', 'failed': False,
            'persisted_turn': {'complete': True, 'user_row_id': ids[0], 'user_row_ids': [ids[0]],
                'final_assistant_row_id': ids[1], 'row_ids': ids}}
        settle_session_input(self.db, epoch=self.authority.epoch, admission_id=row['admission_id'],
            generation=row['generation'], outcome=outcome, result={'result': result})
        return proposal

    async def consume(self, prepared, **kwargs):
        return await asyncio.to_thread(self.flow.consume, prepared['run']['id'],
            principal_id=kwargs.get('principal_id', self.principal))

    def content(self):
        return next(x for x in self.store.snapshot()['items'] if x['id'] == self.page['id'])['content']

    async def test_targeted_final_proposal_data_keeps_owner_consume_receipt_and_restore(self):
        from workspace_plugin.targeted_edits import content_revision
        prepared=await self.prepared()
        item=next(i for i in self.store.snapshot()['items'] if i['id']==self.page['id'])
        self.terminal_data(prepared,patch={'content_edits':{**content_revision(item),
            'replacements':[{'before':'Before','after':'Saved targeted fixture edit'}]}})
        result=await self.consume(prepared)
        self.assertEqual(result['run']['status'],'completed')
        self.assertEqual(self.content(),'Saved targeted fixture edit')
        before=self.store.backup_snapshot();await self.consume(prepared);self.assertEqual(self.store.backup_snapshot(),before)
        self.assertFalse(any(c['resolved'] for c in self.store.snapshot()['comments']))
        self.store.execute('restore_version',{'id':prepared['run']['version_ids'][0]})
        self.assertEqual(self.content(),'Before')

    async def test_real_owner_store_positive_data_receipt_all_unresolved_and_restore(self):
        prepared = await self.prepared()
        self.assertEqual(set(prepared['run']['comment_ids']), {self.comment['id'], self.answered['id']})
        self.terminal_data(prepared)
        result = await self.consume(prepared)
        self.assertEqual(result['run']['status'], 'completed')
        self.assertEqual(self.content(), 'Saved fixture edit')
        again = await self.consume(prepared)
        self.assertEqual(len(again['run']['operation_receipts']), 1)
        for comment in self.store.snapshot()['comments']:
            self.assertFalse(comment['resolved'])
            self.assertEqual(len([r for r in comment['replies'] if r['author'] == 'agent']), 1)
        self.store.execute('restore_version', {'id': prepared['run']['version_ids'][0]})
        self.assertEqual(self.content(), 'Before')

    async def test_foreign_principal_and_scope_change_refuse(self):
        prepared = await self.prepared(); self.terminal_data(prepared)
        with self.assertRaises(ValueError):
            await self.consume(prepared, principal_id='uid:foreign-data')
        with closing(sqlite3.connect(self.store.db_path)) as conn, conn:
            conn.execute("UPDATE metadata SET value='changed-fixture-scope' WHERE key='scope_id'")
        with self.assertRaises(ValueError):
            await self.consume(prepared)
        self.assertEqual(self.content(), 'Before')

    async def test_policy_veto_completed_true_and_interrupted_data_never_commit(self):
        prepared = await self.prepared()
        self.terminal_data(prepared, reason='blocked_by_plugin_pre_llm_call')
        with self.assertRaises(ValueError): await self.consume(prepared)
        self.assertEqual(self.content(), 'Before')
        self.flow.recover(prepared['run']['id'])

    async def test_missing_hook_has_explicit_honest_recovery(self):
        prepared = await self.prepared(); self.terminal_data(prepared, stage=False)
        with self.assertRaises(ValueError): await self.consume(prepared)
        recovered = self.flow.recover(prepared['run']['id'])
        self.assertEqual(recovered['native_terminal'], 'UNKNOWN')
        self.store.execute('update_item', {'id': self.page['id'], 'patch': {'title': 'Unlocked'}})
        self.assertEqual(self.content(), 'Before')

    async def test_native_history_change_compaction_or_new_generation_refuses(self):
        prepared = await self.prepared(); self.terminal_data(prepared)
        self.db.append_message(self.ref.session_id, 'user', 'Later synthetic native user row')
        with self.assertRaises(ValueError): await self.consume(prepared)
        self.assertEqual(self.content(), 'Before')

    async def test_interrupted_canonical_data_completed_flag_never_commits(self):
        prepared = await self.prepared(); self.terminal_data(prepared, outcome='interrupted')
        with self.assertRaises(ValueError): await self.consume(prepared)
        self.assertEqual(self.content(), 'Before')

    async def test_actual_native_epoch_change_refuses(self):
        prepared = await self.prepared(); self.terminal_data(prepared)
        from hermes_state_runtime import begin_runtime_epoch
        begin_runtime_epoch(self.db, instance_id='synthetic-data-successor-epoch')
        with self.assertRaises(ValueError): await self.consume(prepared)
        self.assertEqual(self.content(), 'Before')

    async def test_missing_comment_outcome_is_denied(self):
        prepared = await self.prepared(); self.terminal_data(prepared, missing_outcome=True)
        with self.assertRaises(ValueError): await self.consume(prepared)
        self.assertEqual(self.content(), 'Before')

    async def test_model_proposal_cannot_widen_user_selected_scope(self):
        other = self.store.execute('create_item', {'kind': 'page', 'title': 'Outside', 'content': 'Outside before'})
        prepared = await self.prepared(); self.terminal_data(prepared, outside_item=other['id'])
        with self.assertRaises(ValueError): await self.consume(prepared)
        self.assertEqual(self.content(), 'Before')
        self.assertEqual(next(i for i in self.store.snapshot()['items'] if i['id'] == other['id'])['content'], 'Outside before')

    async def test_real_authenticated_candidate_http_to_owner_store_data(self):
        """Real production guard/API/owner/Store; only terminal completion is synthetic DATA."""
        import importlib.util
        import sys
        from fastapi import FastAPI
        import httpx
        from hermes_cli import web_server
        api_path = Path(__file__).resolve().parents[1] / 'dashboard/plugin_api.py'
        spec = importlib.util.spec_from_file_location('candidate_default_native_api', api_path)
        api = importlib.util.module_from_spec(spec); sys.modules[spec.name] = api
        spec.loader.exec_module(api)
        self.assertEqual(Path(api.__file__).resolve(), api_path)
        app = FastAPI(); app.include_router(api.create_router(owner_home=lambda: self.home))
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url='http://fixture') as client:
            body = {'item_id': self.page['id'], 'session_id': self.ref.session_id, 'expected_scope': self.store.scope_id}
            denied = await client.post('/workflow/prepare', json=body)
            self.assertEqual(denied.status_code, 401)
            headers = {web_server._SESSION_HEADER_NAME: web_server._SESSION_TOKEN}
            prepared_reply = await client.post('/workflow/prepare', headers=headers, json=body)
            self.assertEqual(prepared_reply.status_code, 200, prepared_reply.text)
            prepared = prepared_reply.json()
            self.terminal_data(prepared)
            consume_body = {'run_id': prepared['run']['id'], 'expected_scope': self.store.scope_id}
            denied = await client.post('/workflow/consume', headers=headers, json={**consume_body, 'principal_id': self.principal})
            self.assertEqual(denied.status_code, 400)
            consumed = await client.post('/workflow/consume', headers=headers, json=consume_body)
            self.assertEqual(consumed.status_code, 200, consumed.text)
            self.assertEqual(consumed.json()['run']['status'], 'completed')
            self.assertEqual(self.content(), 'Saved fixture edit')

    async def test_related_scope_requires_fresh_explicit_selection(self):
        other = self.store.execute('create_item', {'kind': 'page', 'title': 'Outside'})
        with self.assertRaises(ValueError):
            await self.prepared(explicit_item_ids=[other['id']])
        self.assertEqual(self.store.snapshot()['runs'], [])

    async def test_authenticated_single_use_review_new_related_item_and_exact_scope(self):
        other=self.store.execute('create_item',{'kind':'page','title':'Explicit reviewed item'})
        before=self.store.snapshot()
        reviewed=self.flow.review_scope(self.page['id'],[other['id']],expected_revision=before['revision'],principal_id=self.principal)
        self.assertEqual(self.store.snapshot(),before)
        prepared=await self.prepared(explicit_item_ids=[other['id']],review_id=reviewed['review_id'])
        self.assertIn('related items explicitly selected and approved by the user',prepared['prompt'])
        self.assertEqual(set(prepared['run']['allowed_item_ids']),{self.page['id'],other['id']})
        self.assertEqual(self.store.snapshot()['comments'][0]['target_item_ids'],[])
        with self.assertRaises(ValueError):
            await self.prepared(explicit_item_ids=[other['id']],review_id=reviewed['review_id'])
        self.flow.recover(prepared['run']['id'])

    async def test_review_stale_expired_spoofed_principal_and_ids_never_lock(self):
        from unittest.mock import patch
        import workspace_plugin.workflow as workflow_module
        other=self.store.execute('create_item',{'kind':'page','title':'Explicit related'})
        revision=self.store.snapshot()['revision']
        reviewed=self.flow.review_scope(self.page['id'],[other['id']],expected_revision=revision,principal_id=self.principal)
        with self.assertRaises(ValueError):
            await self.prepared(explicit_item_ids=[],review_id=reviewed['review_id'])
        self.assertEqual(self.store.snapshot()['runs'],[])
        self.assertIsNone(self.store.snapshot()['items'][0]['thread_id'])
        with patch.object(workflow_module.time,'time',return_value=reviewed['expires_at']+1):
            with self.assertRaisesRegex(ValueError,'expired'):
                await self.prepared(explicit_item_ids=[other['id']],review_id=reviewed['review_id'])
        self.store.execute('reply_comment',{'id':self.comment['id'],'text':'Changed after review'})
        before=self.store.snapshot()
        with self.assertRaises(ValueError):
            await self.prepared(explicit_item_ids=[other['id']],review_id=reviewed['review_id'])
        self.assertEqual(self.store.snapshot(),before)
        with self.assertRaises(ValueError):
            self.flow.prepare(self.page['id'],self.ref.session_id,[other['id']],review_id=reviewed['review_id'])
        with self.assertRaises(ValueError):
            self.flow.review_scope(self.page['id'],[],expected_revision=before['revision'],principal_id=None)

    async def test_stop_revokes_before_effect_and_tool_cannot_bypass_final_mode(self):
        prepared = await self.prepared(); self.terminal_data(prepared)
        self.flow.stop(prepared['run']['id'])
        self.assertEqual((await self.consume(prepared))['run']['status'], 'cancelled')
        with self.assertRaises(ValueError):
            self.flow.apply(prepared['run']['id'], session_id=self.ref.session_id,
                task_id=self.ref.session_id, admission_id='model-owned', edits=[], replies=[])
        self.assertEqual(self.content(), 'Before')

    async def test_real_post_store_pre_journal_failure_retry_is_atomic(self):
        prepared = await self.prepared(); self.terminal_data(prepared)
        with closing(sqlite3.connect(self.flow.journal_path)) as conn, conn:
            conn.execute("CREATE TRIGGER fixture_fail BEFORE INSERT ON run_context BEGIN SELECT RAISE(ABORT,'fixture journal failure'); END")
        with self.assertRaises(sqlite3.Error): await self.consume(prepared)
        self.assertEqual(self.content(), 'Saved fixture edit')
        with closing(sqlite3.connect(self.flow.journal_path)) as conn, conn:
            conn.execute('DROP TRIGGER fixture_fail')
        result = await self.consume(prepared)
        self.assertEqual(result['run']['status'], 'completed')
        self.assertEqual(len(result['run']['operation_receipts']), 1)
        for c in self.store.snapshot()['comments']:
            self.assertEqual(len([r for r in c['replies'] if r['author'] == 'agent']), 1)

    async def test_failed_journal_retry_cannot_overwrite_intervening_edit(self):
        prepared = await self.prepared(); self.terminal_data(prepared)
        with closing(sqlite3.connect(self.flow.journal_path)) as conn, conn:
            conn.execute("CREATE TRIGGER fixture_fail BEFORE INSERT ON run_context BEGIN SELECT RAISE(ABORT,'fixture journal failure'); END")
        with self.assertRaises(sqlite3.Error): await self.consume(prepared)
        self.store.finish_run(prepared['run']['id'], 'error', 'Fixture explicit recovery after committed receipt')
        self.store.execute('update_item', {'id': self.page['id'], 'patch': {'content': 'Intervening user edit'}})
        with closing(sqlite3.connect(self.flow.journal_path)) as conn, conn:
            conn.execute('DROP TRIGGER fixture_fail')
        self.assertEqual((await self.consume(prepared))['run']['status'], 'error')
        self.assertEqual(self.content(), 'Intervening user edit')
        for c in self.store.snapshot()['comments']:
            self.assertEqual(len([r for r in c['replies'] if r['author'] == 'agent']), 1)

    async def test_actual_retirement_after_store_writer_wait_refuses(self):
        prepared = await self.prepared(); self.terminal_data(prepared)
        blocker = sqlite3.connect(self.store.db_path); blocker.execute('BEGIN IMMEDIATE')
        task = asyncio.create_task(self.consume(prepared))
        await asyncio.sleep(.1)
        retiring = asyncio.create_task(_retire_profile_authority(self.authority, timeout=3))
        await asyncio.sleep(.1)
        self.assertTrue(self.authority.retiring)
        blocker.rollback(); blocker.close()
        with self.assertRaises(Exception): await asyncio.wait_for(task, 4)
        self.assertTrue(await retiring)
        self.assertEqual(self.content(), 'Before')


if __name__ == '__main__': unittest.main()
