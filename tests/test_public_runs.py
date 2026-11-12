"""Public hook contract candidate. Synthetic profile, SessionDB and Store only."""
import json
import tempfile
import unittest
from pathlib import Path
from hermes_state import SessionDB
from workspace_plugin.store import Store, StoreError
from workspace_plugin.public_runs import PublicRuns, PublicSessions


class PublicRunsFixture:
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name) / 'profiles' / 'alpha'
        self.home.mkdir(parents=True)
        self.db = SessionDB(self.home / 'state.db')
        self.db.create_session('thread-a', source='local')
        self.db.create_session('thread-b', source='local')
        self.store = Store(self.home)
        self.flow = PublicRuns(self.home, store=self.store, native=PublicSessions(self.home, db=self.db))
        self.page = self.store.execute('create_item', {'kind': 'page', 'title': 'Synthetic', 'content': '<p>Before.</p>'})
        self.other = self.store.execute('create_item', {'kind': 'page', 'title': 'Other', 'content': '<p>Other.</p>'})
        self.comments = [self.store.execute('add_comment', {'item_id': self.page['id'], 'text': text}) for text in ['Change this.', 'Previously answered.']]
        self.store.execute('reply_comment', {'id': self.comments[1]['id'], 'text': 'Earlier human reply'})
        self.resolved = self.store.execute('add_comment', {'item_id': self.page['id'], 'text': 'Resolved'})
        self.store.execute('resolve_comment', {'id': self.resolved['id'], 'resolved': True})

    def tearDown(self):
        self.db.close(); self.tmp.cleanup()

    def prepare(self):
        prepared = self.flow.prepare(self.page['id'], 'thread-a', principal_id='synthetic-profile-owner')
        self.run = prepared['run']; self.prompt = prepared['prompt']
        self.origin = {'session_id': 'thread-a', 'task_id': 'task-'+self.run['id'], 'turn_id': 'turn-'+self.run['id']}
        return prepared

    def bind(self):
        self.prepare()
        return self.flow.pre(**self.origin, user_message=self.prompt)

    def proposal(self, **extra):
        return {'edits': [{'item_id': self.page['id'], 'patch': {'content': '<p>After.</p>'}}],
                'replies': [{'comment_id': c['id'], 'text': 'Outcome for '+c['id']} for c in self.comments], **extra}

    def post(self, proposal=None, **origin):
        return self.flow.post(**{**self.origin, **origin}, user_message=self.prompt,
                              assistant_response=json.dumps(proposal or self.proposal()))

    def end(self, **flags):
        return self.flow.end(**self.origin, completed=True, interrupted=False, failed=False,
                             turn_exit_reason='text_response(finish_reason=stop)', **flags)


class PublicRunsTests(PublicRunsFixture, unittest.TestCase):
    def test_positive_public_hooks_save_all_unresolved_only_after_positive_completion(self):
        self.bind()
        self.assertEqual(set(self.run['comment_ids']), {c['id'] for c in self.comments})
        self.assertIn('Before.', self.prompt); self.assertNotIn('Other.</p>', self.prompt)
        before = self.store.snapshot()
        self.post()
        self.assertEqual(self.store.snapshot()['items'], before['items'])
        self.assertEqual(self.store.snapshot()['comments'], before['comments'])
        result = self.end()
        self.assertEqual(result['run']['status'], 'completed', result)
        state = self.store.snapshot()
        self.assertEqual(next(i for i in state['items'] if i['id'] == self.page['id'])['content'], '<p>After.</p>')
        for c in state['comments']:
            if c['id'] in self.run['comment_ids']:
                self.assertFalse(c['resolved']); self.assertTrue(c['replies'][-1]['text'].startswith('Outcome'))
        self.assertEqual(next(i for i in state['items'] if i['id'] == self.other['id'])['content'], '<p>Other.</p>')

    def test_stop_before_end_revokes_staged_save_and_preserves_restore(self):
        self.bind(); self.post(); stopped = self.flow.stop(self.run['id'])
        self.assertNotEqual(stopped.get('native_terminal'), 'completed')
        self.assertEqual(self.end()['run']['status'], 'cancelled')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')
        self.assertTrue(self.store.snapshot()['versions'])

    def test_foreign_task_turn_session_prompt_and_unbound_post_refuse(self):
        self.prepare()
        with self.assertRaises(ValueError): self.post()
        self.flow.pre(**self.origin, user_message=self.prompt)
        for key in ['task_id', 'turn_id', 'session_id']:
            with self.subTest(key=key), self.assertRaises(ValueError): self.post(**{key: 'foreign'})
        with self.assertRaises(ValueError): self.flow.pre(**self.origin, user_message='Copied '+self.prompt)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_duplicate_post_end_are_idempotent_and_conflicting_post_refuses(self):
        self.bind(); self.post(); self.post()
        with self.assertRaises(ValueError): self.post(self.proposal(edits=[]))
        self.end(); before = self.store.backup_snapshot(); self.end()
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_post_alone_or_missing_completed_flag_never_claims_success(self):
        self.bind(); self.post()
        self.assertEqual(self.flow.status(self.run['id'])['run']['status'], 'running')
        with self.assertRaises(ValueError): self.flow.end(**self.origin, interrupted=False, failed=False)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_interrupted_failed_blocked_unknown_turns_do_not_save_successful_edits(self):
        self.bind(); self.post()
        self.flow.end(**self.origin, completed=False, interrupted=True, failed=False, turn_exit_reason='interrupted')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')
        self.assertEqual(self.flow.status(self.run['id'])['run']['status'], 'cancelled')

    def test_outside_scope_and_resolution_payload_refuse_atomically(self):
        self.bind()
        for proposal in [self.proposal(edits=[{'item_id': self.other['id'], 'patch': {'content': '<p>No.</p>'}}]),
                         self.proposal(edits=[{'item_id': self.page['id'], 'patch': {'resolved': True}}])]:
            with self.assertRaises(ValueError): self.post(proposal)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_missing_outcome_and_missing_proposal_terminal_are_errors_not_success(self):
        self.bind()
        with self.assertRaises(ValueError): self.post(self.proposal(replies=[]))
        self.assertEqual(self.end()['run']['status'], 'error')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_recovery_revokes_undelivered_final_data_and_unlocks_without_native_success(self):
        self.bind(); self.post(); self.flow.recover(self.run['id'])
        with self.assertRaises(ValueError): self.post()
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')
        self.store.execute('update_item', {'id': self.page['id'], 'patch': {'title': 'Recovered'}})

    def test_selected_thread_reuse_and_other_page_remains_editable_during_run(self):
        self.bind()
        self.store.execute('update_item', {'id': self.other['id'], 'patch': {'title': 'Still usable'}})
        with self.assertRaises(StoreError): self.store.execute('update_item', {'id': self.page['id'], 'patch': {'title': 'Locked'}})
        self.post(); self.end()
        p = self.flow.prepare(self.page['id'], 'thread-a', principal_id='synthetic-profile-owner')
        self.assertEqual(p['run']['session_id'], 'thread-a')
        self.assertEqual(len(p['run']['comment_ids']), 2)

    def test_new_native_turn_durably_revokes_old_binding_even_when_it_is_not_a_workspace_prompt(self):
        self.bind(); self.post()
        with self.assertRaises(ValueError):
            self.flow.pre(session_id='thread-a', task_id='successor-task', turn_id='successor-turn', user_message='A later unrelated user turn')
        with self.assertRaises(ValueError): self.post()
        self.assertEqual(self.end()['run']['status'], 'cancelled')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_explicit_review_is_one_use_and_related_scope_is_not_an_ambient_grant(self):
        revision = self.store.snapshot()['revision']
        review = self.flow.review_scope(self.page['id'], [self.other['id']], expected_revision=revision, principal_id='synthetic-profile-owner')
        prepared = self.flow.prepare(self.page['id'], 'thread-a', [self.other['id']], principal_id='synthetic-profile-owner', review_id=review['review_id'])
        self.assertIn(self.other['id'], prepared['run']['allowed_item_ids'])
        self.assertIn('Other.</p>', prepared['prompt'])
        self.flow.recover(prepared['run']['id'])
        with self.assertRaises(ValueError):
            self.flow.prepare(self.page['id'], 'thread-a', [self.other['id']], principal_id='synthetic-profile-owner', review_id=review['review_id'])
        with self.assertRaises(ValueError):
            self.flow.prepare(self.page['id'], 'thread-a', [self.other['id']], principal_id='synthetic-profile-owner')

    def test_successful_save_retains_pre_run_restore_and_independent_comment_history(self):
        self.bind(); self.post(); self.end()
        ids = [c['id'] for c in self.store.snapshot()['comments']]
        version = next(v for v in self.store.snapshot()['versions'] if v['run_id'] == self.run['id'])
        self.store.execute('restore_version', {'id': version['id']})
        state = self.store.snapshot()
        self.assertEqual(state['items'][0]['content'], '<p>Before.</p>')
        self.assertEqual([c['id'] for c in state['comments']], ids)
        self.assertTrue(all(not c['resolved'] for c in state['comments'] if c['id'] in self.run['comment_ids']))

    def test_failed_and_policy_vetoed_native_outcomes_never_apply_staged_success(self):
        for flags in [dict(completed=True, failed=True, interrupted=False, turn_exit_reason='provider_error'),
                      dict(completed=False, failed=False, interrupted=False, turn_exit_reason='blocked_by_plugin_pre_llm_call'),
                      dict(completed=True, failed=False, interrupted=False, turn_exit_reason='unqualified_exit')]:
            self.bind(); self.post()
            result = self.flow.end(**self.origin, **flags)
            self.assertEqual(result['run']['status'], 'error')
            self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_revocation_survives_progress_store_failure_before_native_cancel(self):
        from unittest.mock import patch
        self.bind(); self.post()
        with patch.object(self.store, 'set_run_progress', side_effect=ValueError('Synthetic progress failure')):
            with self.assertRaises(ValueError): self.flow.stop(self.run['id'])
        with self.assertRaises(ValueError): self.post()
        self.assertEqual(self.end()['run']['status'], 'cancelled')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_final_store_writer_wait_and_stop_have_one_serial_order(self):
        import sqlite3
        import threading
        from unittest.mock import patch
        self.bind(); self.post()
        entered = threading.Event(); release = threading.Event(); stopped = threading.Event(); results = []; errors = []
        original = self.store.apply_run
        def apply(*args, **kwargs):
            self.assertTrue(self.store._atomic.connection.in_transaction, 'journal and effects hold the actual Store writer')
            entered.set()
            if not release.wait(5): raise AssertionError('Store writer release timed out')
            return original(*args, **kwargs)
        def finish():
            try: results.append(self.end())
            except BaseException as exc: errors.append(exc)
        def stop():
            try: results.append(self.flow.stop(self.run['id']))
            except BaseException as exc: errors.append(exc)
            finally: stopped.set()
        with patch.object(self.store, 'apply_run', side_effect=apply):
            final = threading.Thread(target=finish); final.start()
            self.assertTrue(entered.wait(5), 'final save holds actual Store writer before effect')
            cancel = threading.Thread(target=stop); cancel.start()
            self.assertFalse(stopped.wait(.05), 'Stop cannot acknowledge through an accepted earlier save')
            release.set()
            final.join(5); cancel.join(5)
            self.assertFalse(final.is_alive()); self.assertFalse(cancel.is_alive())
        self.assertEqual(errors, [])
        self.assertEqual([r['run']['status'] for r in results], ['completed', 'completed'])
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p>')

    def test_journal_failure_rolls_back_effects_outcomes_and_run_receipt_together(self):
        from unittest.mock import patch
        self.bind(); self.post(); before = self.store.backup_snapshot()
        with patch.object(self.flow, '_save', side_effect=ValueError('Synthetic journal commit fault')):
            with self.assertRaises(ValueError): self.end()
        self.assertEqual(self.store.backup_snapshot(), before, 'run authority and effects must share the Store transaction')
        self.end()
        self.assertEqual(self.store.snapshot()['runs'][-1]['status'], 'completed')
