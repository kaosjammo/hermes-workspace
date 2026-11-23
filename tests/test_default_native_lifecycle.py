"""Public default-native outcomes; synthetic profile/session state, no provider.

This replaces private owner/row-journal mechanisms. Real outer executor/loader is
in test_public_outer_executor; HTTP/IPC and a full native turn need separate proof.
"""
import unittest
from unittest.mock import patch
from test_public_runs import PublicRunsFixture
from workspace_plugin.public_runs import PublicRuns, PublicSessions


class DefaultNativeDataLifecycle(PublicRunsFixture, unittest.TestCase):
    def operation(self):
        return {'run_id':self.run['id'], **self.proposal()}

    def ticket(self, call='call-one'):
        return self.flow.pre_tool(tool_name='workspace_apply', args=self.operation(), tool_call_id=call, **self.origin)['args']

    def apply(self, args):
        return self.flow.apply_call(args, session_id='thread-a', task_id=self.origin['task_id'])

    def test_positive_terminal_data_all_unresolved_restore_and_idempotence(self):
        self.bind(); self.post(); self.assertEqual(self.end()['run']['status'], 'completed')
        before = self.store.backup_snapshot(); self.end()
        self.assertEqual(self.store.backup_snapshot(), before)
        self.assertTrue(all(c['replies'] for c in before['comments'] if c['id'] in self.run['comment_ids']))
        version = next(v for v in before['versions'] if v['run_id']==self.run['id'])
        self.store.execute('restore_version', {'id':version['id']})
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_foreign_principal_and_scope_change_refuse_without_effect(self):
        self.bind(); before = self.store.backup_snapshot()
        with self.assertRaises(ValueError): self.flow.consume(self.run['id'], principal_id='foreign')
        from workspace_plugin.store import Store
        with self.assertRaises(ValueError): PublicRuns(self.home, store=Store(self.home/'other'), native=PublicSessions(self.home))
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_policy_veto_completed_true_is_not_success(self):
        self.bind(); self.post()
        result = self.flow.end(**self.origin, completed=True, interrupted=False, failed=False,
            turn_exit_reason='blocked_by_plugin_pre_llm_call')
        self.assertEqual(result['run']['status'], 'error')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_interrupted_even_with_completed_true_never_applies_staged_data(self):
        self.bind(); self.post()
        result = self.flow.end(**self.origin, completed=True, interrupted=True, failed=False, turn_exit_reason='text_response(finish_reason=stop)')
        self.assertEqual(result['run']['status'], 'cancelled')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_missing_hook_has_explicit_honest_recovery(self):
        self.prepare(); result = self.flow.recover(self.run['id'])
        self.assertEqual(result['native_terminal'], 'UNKNOWN')
        self.assertEqual(result['run']['status'], 'error')
        self.store.execute('update_item', {'id':self.page['id'], 'patch':{'title':'Recovered'}})

    def test_same_session_task_successor_cannot_reuse_old_turn_ticket(self):
        self.bind(); args = self.ticket()
        with self.assertRaises(ValueError): self.flow.pre(**{**self.origin, 'turn_id':'successor'}, user_message='Later user turn')
        with self.assertRaises(ValueError): self.apply(args)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_missing_comment_outcome_is_denied(self):
        self.bind()
        with self.assertRaises(ValueError): self.post(self.proposal(replies=[]))
        self.assertEqual(self.end()['run']['status'], 'error')

    def test_model_proposal_cannot_widen_user_selected_scope(self):
        self.bind(); before = self.store.backup_snapshot()
        with self.assertRaises(ValueError): self.post(self.proposal(edits=[{'item_id':self.other['id'], 'patch':{'title':'Injected'}}]))
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_related_scope_requires_fresh_explicit_selection(self):
        self.store.execute('add_comment', {'item_id':self.page['id'], 'text':'Related', 'target_item_ids':[self.other['id']]})
        self.prepare()
        self.assertNotIn(self.other['id'], self.run['allowed_item_ids'])

    def test_authenticated_single_use_review_new_related_item_and_exact_scope(self):
        revision = self.store.snapshot()['revision']
        review = self.flow.review_scope(self.page['id'], [self.other['id']], expected_revision=revision, principal_id='actor')
        prepared = self.flow.prepare(self.page['id'], 'thread-a', [self.other['id']], principal_id='actor', review_id=review['review_id'])
        self.assertIn(self.other['id'], prepared['run']['allowed_item_ids'])
        self.flow.recover(prepared['run']['id'])
        with self.assertRaises(ValueError): self.flow.prepare(self.page['id'], 'thread-a', [self.other['id']], principal_id='actor', review_id=review['review_id'])

    def test_review_stale_expired_spoofed_principal_and_ids_never_lock(self):
        revision = self.store.snapshot()['revision']
        review = self.flow.review_scope(self.page['id'], [], expected_revision=revision, principal_id='actor')
        for actor, ident in [('foreign',review['review_id']), ('actor','guessed')]:
            with self.assertRaises(ValueError): self.flow.prepare(self.page['id'],'thread-a', principal_id=actor, review_id=ident)
        with patch('workspace_plugin.run_journal.time.time', return_value=10**12):
            with self.assertRaises(ValueError): self.flow.prepare(self.page['id'],'thread-a', principal_id='actor', review_id=review['review_id'])
        self.assertEqual(self.store.snapshot()['runs'], [])
        self.store.execute('update_item', {'id':self.page['id'], 'patch':{'title':'Still editable'}})
        with self.assertRaises(ValueError): self.flow.prepare(self.page['id'],'thread-a', principal_id='actor', review_id=review['review_id'])

    def test_stop_revokes_before_effect_and_unqualified_tool_cannot_bypass(self):
        self.bind(); args = self.ticket(); self.flow.stop(self.run['id'])
        before = self.store.backup_snapshot()
        for value in (args, self.operation()):
            with self.assertRaises(ValueError): self.apply(value)
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_post_store_pre_journal_failure_rolls_back_and_retry_is_atomic(self):
        self.bind(); args = self.ticket(); before = self.store.backup_snapshot()
        with patch.object(self.flow, '_save', side_effect=ValueError('Journal fault')):
            with self.assertRaises(ValueError): self.apply(args)
        self.assertEqual(self.store.backup_snapshot(), before)
        self.apply(args)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p>')

    def test_failed_journal_then_recovery_cannot_overwrite_intervening_edit(self):
        self.bind(); args = self.ticket()
        with patch.object(self.flow, '_save', side_effect=ValueError('Journal fault')):
            with self.assertRaises(ValueError): self.apply(args)
        self.flow.recover(self.run['id'])
        self.store.execute('update_item', {'id':self.page['id'], 'patch':{'content':'<p>Human recovery edit.</p>'}})
        before = self.store.backup_snapshot()
        with self.assertRaises(ValueError): self.apply(args)
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_native_failure_keeps_accepted_partial_work_and_restore(self):
        self.bind(); self.apply(self.ticket())
        result = self.flow.end(**self.origin, completed=False, interrupted=False, failed=True, turn_exit_reason='error')
        self.assertEqual(result['run']['status'], 'error')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p>')
        self.assertTrue(self.store.snapshot()['versions'])

    def test_terminal_target_conflict_unlocks_and_does_not_retry(self):
        self.bind(); self.post(self.proposal(edits=[{'item_id':self.page['id'], 'patch':{'properties':{'unknown':'x'}}}]))
        self.assertEqual(self.end()['run']['status'], 'error')
        self.store.execute('update_item', {'id':self.page['id'], 'patch':{'title':'Unlocked'}})
        before = self.store.backup_snapshot(); self.end()
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_submission_address_is_durable_and_never_grants_tool_authority(self):
        self.prepare(); self.flow.record_submission(self.run['id'], 'exact-admission')
        restarted = PublicRuns(self.home)
        self.assertEqual(restarted.stop(self.run['id'])['control'], {'session_id':'thread-a','admission_id':'exact-admission'})
        with self.assertRaises(ValueError): restarted.record_submission(self.run['id'], 'conflicting')
        with self.assertRaises(ValueError): self.apply(self.operation())

    def test_targeted_final_data_preserves_unrelated_paragraph(self):
        self.store.execute('update_item', {'id':self.page['id'], 'patch':{'content':'<p>Before.</p><p>Keep.</p>'}})
        self.bind()
        item = self.store.snapshot(include_content_revisions=True)['items'][0]
        revision = item['content_revision']
        proposal = self.proposal(edits=[{'item_id':self.page['id'], 'patch':{'content_edits':{**revision, 'replacements':[{'before':'Before.', 'after':'After.'}]}}}])
        self.post(proposal); self.assertEqual(self.end()['run']['status'], 'completed')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p><p>Keep.</p>')

    def test_prompt_after_manual_edit_captures_current_revision_and_full_context(self):
        self.store.execute('update_item', {'id':self.page['id'], 'patch':{'content':'<p>Current manually saved context.</p>'}})
        self.prepare()
        self.assertIn('Current manually saved context.', self.prompt)
        self.assertIn('content_revision', self.prompt)
        self.assertIn(self.comments[1]['id'], self.prompt)

    def test_resolution_binding_identity_and_extra_fields_are_not_model_mutations(self):
        self.bind(); before = self.store.backup_snapshot()
        for key in ('resolved','thread_id','author_identity','executor'):
            with self.subTest(key=key), self.assertRaises(ValueError): self.post(self.proposal(edits=[{'item_id':self.page['id'], 'patch':{key:True}}]))
        self.assertEqual(self.store.backup_snapshot(), before)
