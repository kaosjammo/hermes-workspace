"""Public native session observations are not plugin write authority.

Private row-join/owner-epoch mechanisms were replaced by originating public turn
binding, one-use call tickets and the Store's durable revocation ordering point.
"""
import unittest
from test_public_runs import PublicRunsFixture
from workspace_plugin.native import NativeSessions


class NativeObservationTests(PublicRunsFixture, unittest.TestCase):
    def test_public_session_observation_without_binding_never_grants_commit_authority(self):
        self.prepare(); before = self.store.backup_snapshot()
        self.assertEqual(self.flow.native.require_session('thread-a'), 'thread-a')
        with self.assertRaises(ValueError): self.post()
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_copied_prompt_foreign_task_session_and_turn_refuse(self):
        self.bind(); before = self.store.backup_snapshot()
        for key in ('session_id', 'task_id', 'turn_id'):
            with self.subTest(key=key), self.assertRaises(ValueError): self.post(**{key:'foreign'})
        with self.assertRaises(ValueError): self.flow.pre(**self.origin, user_message='Copied '+self.prompt)
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_started_or_missing_terminal_result_never_finalizes_proposed_effects(self):
        self.bind(); self.post(); before = self.store.backup_snapshot()
        with self.assertRaises(ValueError): self.flow.end(**self.origin, completed=True)
        self.assertEqual(self.store.backup_snapshot(), before)
        self.assertEqual(self.flow.status(self.run['id'])['run']['status'], 'running')

    def test_two_native_turns_cannot_claim_the_same_plugin_run(self):
        self.bind(); before = self.store.snapshot()['items']
        with self.assertRaises(ValueError):
            self.flow.pre(**{**self.origin,'turn_id':'successor'}, user_message=self.prompt)
        with self.assertRaises(ValueError): self.post()
        self.assertEqual(self.store.snapshot()['items'], before)

    def test_public_compression_lineage_preserves_thread_but_explicit_forks_are_not_authority(self):
        self.bind()
        self.db.publish_compression_child(parent_session_id='thread-a', child_session_id='compressed', source='local',
            messages=[{'role':'user','content':'Synthetic compressed context'}], require_compression_lease=False)
        self.assertEqual(self.flow.native.require_session('compressed'), 'thread-a')
        self.post(session_id='compressed')
        self.db.create_session('fork', source='local', parent_session_id='thread-a')
        self.assertEqual(self.flow.native.require_session('fork'), 'fork')
        with self.assertRaises(ValueError): self.post(session_id='fork')
        self.assertEqual(self.end()['run']['status'], 'completed')

    def test_wrong_profile_database_and_replaced_scope_refuse(self):
        from workspace_plugin.store import Store
        with self.assertRaises(ValueError): NativeSessions(self.home/'foreign', db=self.db).require_session('thread-a')
        self.bind(); self.post()
        state = self.store.backup_snapshot()
        # Public backup restore rotates scope and detaches native authority.
        with self.assertRaises(ValueError): self.store.restore_snapshot(state)
        self.flow.recover(self.run['id'])
        self.store.restore_snapshot(state)
        with self.assertRaises(ValueError): self.end()
        self.assertFalse(self.store.snapshot()['runs'])
