"""Turn-specific public hook tickets, including shared native task IDs."""
import json
import unittest
from test_public_runs import PublicRunsFixture


class PublicCallTests(PublicRunsFixture, unittest.TestCase):
    def args(self):
        return {'run_id': self.run['id'], 'edits': self.proposal()['edits'], 'replies': self.proposal()['replies']}

    def ticket(self, args=None, **identity):
        return self.flow.pre_tool(tool_name='workspace_apply', args=args or self.args(),
            tool_call_id='call-one', **{**self.origin, **identity})['args']

    def apply(self, args):
        return self.flow.apply_call(args, session_id=self.origin['session_id'], task_id=self.origin['task_id'])

    def test_direct_handler_refuses_without_ticket_and_public_pre_hook_enables_one_atomic_save(self):
        self.bind(); before = self.store.snapshot()
        with self.assertRaises(ValueError): self.apply(self.args())
        self.assertEqual(self.store.snapshot(), before)
        arguments = self.ticket()
        self.assertNotEqual(arguments.get('_workspace_call'), None)
        self.apply(arguments)
        state = self.store.snapshot()
        self.assertEqual(state['items'][0]['content'], '<p>After.</p>')
        self.assertEqual(len(state['runs'][0]['operation_receipts']), 1)
        self.assertEqual(state['runs'][0]['status'], 'running', 'one saved operation is not whole-run success')
        self.flow.post(**self.origin, user_message=self.prompt, assistant_response='Saved concise outcomes.')
        self.assertEqual(self.end()['run']['status'], 'completed')

    def test_same_task_stale_turn_and_model_ticket_are_not_authority(self):
        self.bind()
        with self.assertRaises(ValueError): self.ticket(turn_id='old-turn-with-same-task')
        forged = {**self.args(), '_workspace_call': 'model-forged-ticket'}
        with self.assertRaises(ValueError): self.apply(forged)
        modified = self.ticket(forged)
        self.assertNotEqual(modified['_workspace_call'], forged['_workspace_call'])
        self.apply(modified)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p>')

    def test_duplicate_exact_ticket_reads_receipt_and_changed_payload_cannot_replay(self):
        self.bind(); args = self.ticket(); self.apply(args)
        before = self.store.backup_snapshot(); self.apply(args)
        self.assertEqual(self.store.backup_snapshot(), before)
        with self.assertRaises(ValueError): self.apply({**args, 'edits': []})
        self.assertEqual(self.store.backup_snapshot(), before)
        self.flow.stop(self.run['id'])
        stopped = self.store.backup_snapshot(); self.apply(args)
        self.assertEqual(self.store.backup_snapshot(), stopped, 'an authorised receipt read cannot resurrect effects')

    def test_stop_before_unused_ticket_prevents_save_and_partial_accepted_work_remains_recoverable(self):
        self.bind(); args = self.ticket(); self.flow.stop(self.run['id'])
        with self.assertRaises(ValueError): self.apply(args)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_ticket_consumption_and_effects_rollback_together_on_journal_failure(self):
        from unittest.mock import patch
        self.bind(); args = self.ticket(); before = self.store.backup_snapshot()
        with patch.object(self.flow, '_save', side_effect=ValueError('Synthetic call journal fault')):
            with self.assertRaises(ValueError): self.apply(args)
        self.assertEqual(self.store.backup_snapshot(), before)
        self.apply(args)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p>')

    def test_stop_before_native_turn_starts_locally_finishes_and_unlocks_without_a_terminal_callback(self):
        self.prepare()
        stopped = self.flow.stop(self.run['id'])
        self.assertEqual(stopped['run']['status'], 'cancelled')
        self.assertEqual(stopped['native_terminal'], 'UNKNOWN', 'local Stop is not provider confirmation')
        self.store.execute('update_item', {'id':self.page['id'], 'patch':{'title':'Locally stopped'}})
        self.assertTrue(self.store.snapshot()['versions'])
        with self.assertRaises(ValueError): self.flow.pre(**self.origin, user_message=self.prompt)

    def test_submission_acknowledgement_after_stop_returns_exact_cancel_address_without_regrant(self):
        self.prepare(); self.flow.stop(self.run['id'])
        submitted = self.flow.record_submission(self.run['id'], 'late-exact-admission')
        self.assertEqual(submitted['run']['status'], 'cancelled')
        self.assertEqual(submitted['control'], {'session_id':'thread-a', 'admission_id':'late-exact-admission'})
        before = self.store.backup_snapshot()
        with self.assertRaises(ValueError): self.flow.apply_call(self.args(), session_id='thread-a', task_id=self.origin['task_id'])
        self.assertEqual(self.store.backup_snapshot(), before)
