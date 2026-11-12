"""Synthetic local service/HTTP data qualification; no native/provider execution."""
import base64
import copy
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from workspace_plugin.store import Store, StoreError
from workspace_plugin.shared_workspaces import SharedWorkspaces, profile_key, desktop_default_enabled


class SharedTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.private = Store(self.root / 'alice')
        self.bob_private = Store(self.root / 'bob')
        self.alice, self.bob, self.carol = [profile_key(self.root / name) for name in ('alice', 'bob', 'carol')]
        self.service = SharedWorkspaces(self.root / 'shared')
        self.project = self.service.create(self.alice, 'Synthetic project', [{'profile_id': self.bob}])
        self.pid = self.project['id']

    def snapshot(self, actor=None):
        return self.service.snapshot(actor or self.alice, self.pid)

    def assert_viewer_identity(self, state, actor):
        self.assertEqual(state['identity'], {
            'human': {'kind': 'human', 'id': actor, 'name': 'user'},
            'source_id': profile_key(self.service._store(self.pid).profile_home),
        })

    def command(self, op, payload, actor=None, view=None):
        view = view or self.snapshot(actor)
        return self.service.execute(actor or self.alice, self.pid, op,
            dict(payload, expected_revision=view['state']['revision']),
            membership_revision=view['workspace']['membership_revision'], expected_scope=view['state']['scope_id'])

    def page(self, store=None, title='Synthetic page', **fields):
        return (store or self.private).execute('create_item', dict(kind='page', title=title, **fields))

    def move(self, page, **overrides):
        view = self.snapshot()
        args = dict(confirmed=True, membership_revision=view['workspace']['membership_revision'],
            expected_scope=view['state']['scope_id'], source_scope=self.private.scope_id,
            source_revision=self.private.snapshot()['revision'], destination_revision=view['state']['revision'])
        args.update(overrides)
        return self.service.move_private(self.alice, self.pid, self.private, page['id'], **args)

    def test_explicit_members_private_in_place_and_reopen(self):
        secret = self.page(title='Private in place')
        private = self.private.backup_snapshot()
        self.assertEqual(self.snapshot()['state']['items'], [])
        self.assertEqual(self.service.list(self.carol), [])
        with self.assertRaises(StoreError) as raised:
            self.snapshot(self.carol)
        self.assertEqual(raised.exception.status_code, 403)
        saved = self.command('create_item', {'kind': 'page', 'title': 'Intentionally shared'})
        reopened = SharedWorkspaces(self.root / 'shared').snapshot(self.bob, self.pid)
        self.assert_viewer_identity(saved['state'], self.alice)
        self.assert_viewer_identity(reopened['state'], self.bob)
        # The complete stored graph is shared; only the admitted viewer's
        # identity projection differs between these two response envelopes.
        self.assertEqual({k: v for k, v in saved['state'].items() if k != 'identity'},
                         {k: v for k, v in reopened['state'].items() if k != 'identity'})
        self.assertEqual(self.snapshot()['state'], saved['state'])
        self.assertEqual(self.private.backup_snapshot(), private)
        self.assertNotIn(secret['id'], [p['id'] for p in reopened['state']['items']])
        self.assertEqual(self.bob_private.snapshot()['items'], [])
        self.assertEqual(next(m for m in self.project['members'] if m['profile_id'] == self.bob)['role'], 'editor')

    def test_read_only_and_nonmember_mutations_are_authoritatively_denied(self):
        page = self.command('create_item', {'kind': 'page', 'title': 'Shared'})['result']
        self.service.set_member(self.alice, self.pid, self.bob, role='read_only', membership_revision=1)
        before = self.snapshot()['state']
        bob_before = self.snapshot(self.bob)['state']
        stored_before = self.service._store(self.pid).backup_snapshot()
        for op, payload in [('update_item', {'id': page['id'], 'patch': {'title': 'Forbidden'}}),
                            ('add_comment', {'item_id': page['id'], 'text': 'Forbidden'}),
                            ('trash', {'id': page['id']}), ('create_item', {'kind': 'page', 'title': 'Forbidden'})]:
            for actor in (self.bob, self.carol):
                with self.subTest(op=op, actor=actor), self.assertRaises(StoreError) as error:
                    self.command(op, payload, actor, view=self.snapshot())
                self.assertEqual(error.exception.status_code, 403)
                self.assertEqual(self.snapshot()['state'], before)
                self.assertEqual(self.snapshot(self.bob)['state'], bob_before)
                self.assertEqual(self.service._store(self.pid).backup_snapshot(), stored_before)
        self.assert_viewer_identity(before, self.alice)
        self.assert_viewer_identity(bob_before, self.bob)
        self.assertEqual({k: v for k, v in bob_before.items() if k != 'identity'},
                         {k: v for k, v in before.items() if k != 'identity'})
        result = self.service.execute(self.bob, self.pid, 'search', {'query': 'Shared'},
            membership_revision=2, expected_scope=before['scope_id'])
        self.assertEqual(result['result'][0]['id'], page['id'])
        self.assert_viewer_identity(result['state'], self.bob)
        self.assertEqual(result['state'], bob_before)
        self.assertEqual(self.service._store(self.pid).backup_snapshot(), stored_before)

    def test_stale_revoked_readded_and_missing_membership_revision(self):
        old = self.snapshot(self.bob)
        self.service.set_member(self.alice, self.pid, self.bob, role=None, membership_revision=1)
        with self.assertRaises(StoreError):
            self.command('create_item', {'kind': 'page', 'title': 'Stale'}, self.bob, old)
        self.service.set_member(self.alice, self.pid, self.bob, membership_revision=2)
        with self.assertRaisesRegex(StoreError, 'membership changed'):
            self.command('create_item', {'kind': 'page', 'title': 'Readded stale'}, self.bob, old)
        for bad in (None, False, 0, '3'):
            with self.assertRaises(StoreError):
                self.service.execute(self.bob, self.pid, 'create_item', {'kind': 'page', 'title': 'No'},
                    membership_revision=bad, expected_scope=old['state']['scope_id'])
        self.assertEqual(self.snapshot()['state']['items'], [])

    def test_creator_membership_management_and_creator_retention(self):
        with self.assertRaises(StoreError):
            self.service.set_member(self.bob, self.pid, self.carol, membership_revision=1)
        for role in (None, 'read_only'):
            with self.assertRaises(StoreError):
                self.service.set_member(self.alice, self.pid, self.alice, role=role, membership_revision=1)
        self.assertEqual(self.snapshot()['workspace']['membership_revision'], 1)

    def test_save_conflict_and_existing_run_lock_no_silent_overwrite(self):
        page = self.command('create_item', {'kind': 'page', 'title': 'Shared'})['result']
        stale = self.snapshot(self.bob)
        self.command('update_item', {'id': page['id'], 'patch': {'content': 'Alice saved'}})
        with self.assertRaisesRegex(StoreError, 'revision changed'):
            self.command('update_item', {'id': page['id'], 'patch': {'content': 'Bob stale'}}, self.bob, stale)
        self.command('add_comment', {'item_id': page['id'], 'text': 'Synthetic native lock only'})
        data_store = self.service._store(self.pid)
        run = data_store.begin_run(page['id'], 'synthetic-thread-no-provider')
        before = self.snapshot()['state']
        with self.assertRaisesRegex(StoreError, 'active run'):
            self.command('update_item', {'id': page['id'], 'patch': {'content': 'Conflict'}}, self.bob)
        self.assertEqual(self.snapshot()['state'], before)
        data_store.finish_run(run['id'], 'error', 'Synthetic lock released; no native execution')

    def test_membership_is_rechecked_after_catalog_wait(self):
        view = self.snapshot(self.bob)
        with ThreadPoolExecutor(max_workers=1) as pool:
            with self.service._catalog() as conn:
                future = pool.submit(self.command, 'create_item', {'kind': 'page', 'title': 'Queued'}, self.bob, view)
                conn.execute('DELETE FROM members WHERE project_id=? AND profile_id=?', (self.pid, self.bob))
                conn.execute('UPDATE projects SET revision=revision+1 WHERE id=?', (self.pid,))
            with self.assertRaises(StoreError):
                future.result(timeout=5)
        self.assertEqual(self.snapshot()['state']['items'], [])

    def test_cancel_conflict_and_injected_second_save_leave_no_partial_exposure(self):
        page = self.page(content='<p>Private content</p>')
        before, dest = self.private.backup_snapshot(), self.snapshot()['state']
        for override in ({'confirmed': False}, {'source_revision': -1}, {'destination_revision': -1}):
            with self.assertRaises(StoreError):
                self.move(page, **override)
            self.assertEqual(self.private.backup_snapshot(), before)
            self.assertEqual(self.snapshot()['state'], dest)
        save = Store._save
        def failed(store, conn, state, schema='main'):
            if schema == 'moved':
                raise RuntimeError('Synthetic destination save failure after private save')
            return save(store, conn, state, schema)
        with patch.object(Store, '_save', failed), self.assertRaises(RuntimeError):
            self.move(page)
        self.assertEqual(self.private.backup_snapshot(), before)
        self.assertEqual(self.snapshot()['state'], dest)

    def test_explicit_move_preserves_data_threads_sections_and_history(self):
        page = self.page(content='<p>Original words.</p>')
        other = self.page(title='Unrelated remains private')
        c = self.private.execute('add_comment', {'item_id': page['id'], 'text': 'Change words',
            'anchor': {'quote': 'Original words.', 'prefix': '', 'suffix': ''}})
        self.private.execute('add_attachment', {'item_id': page['id'], 'name': 'synthetic.txt',
            'media_type': 'text/plain', 'data_base64': base64.b64encode(b'synthetic only').decode()})
        run = self.private.begin_run(page['id'], 'original-native-thread')
        self.private.apply_run(run['id'], [{'item_id': page['id'], 'patch': {'content': '<p>Changed words.</p>'}}],
            [{'comment_id': c['id'], 'text': 'Synthetic stored outcome'}])
        self.private.finish_run(run['id'], 'completed')
        before = self.private.backup_snapshot()
        self.move(page)
        moved = self.service._store(self.pid)
        after = moved.backup_snapshot()
        for category in ('comments', 'versions', 'runs', 'attachments'):
            self.assertEqual(after[category], before[category])
        item = after['items'][0]
        self.assertEqual(item['thread_id'], 'original-native-thread')
        self.assertEqual(item['thread_owner'], {'profile_id': self.alice, 'scope_id': self.private.scope_id})
        self.assertEqual([p['id'] for p in self.private.snapshot()['items']], [other['id']])
        change = self.snapshot()['state']['comments'][0]['section_change']
        preview = self.command('preview_section_revert', {k: change[k] for k in ('version_id', 'generation_id', 'change_id')})['result']
        self.command('revert_section', {k: preview[k] for k in ('version_id', 'generation_id', 'change_id', 'content_hash', 'manual_revision', 'dataset_epoch')} | {'confirmed': False})
        self.assertEqual(self.snapshot()['state']['items'][0]['content'], '<p>Original words.</p>')

    def test_move_refuses_cross_boundary_references_and_foreign_private_owner(self):
        page, other = self.page(), self.page(title='Private related')
        self.private.execute('add_comment', {'item_id': page['id'], 'text': 'Explicit related data', 'target_item_ids': [other['id']]})
        before = self.private.backup_snapshot()
        with self.assertRaises(StoreError):
            self.move(page)
        self.assertEqual(self.private.backup_snapshot(), before)
        self.assertEqual(self.snapshot()['state']['items'], [])
        with self.assertRaises(StoreError) as raised:
            self.service.move_private(self.bob, self.pid, self.private, page['id'], confirmed=True,
                membership_revision=1, expected_scope=self.snapshot()['state']['scope_id'], source_scope=self.private.scope_id,
                source_revision=before['revision'], destination_revision=0)
        self.assertEqual(raised.exception.status_code, 403)

    def test_complete_database_moves_with_rows_and_typed_recovery_schema(self):
        db = self.private.execute('create_item', {'kind': 'database', 'title': 'Database'})
        self.private.execute('set_columns', {'id': db['id'], 'columns': [{'id': 'count', 'name': 'Count', 'type': 'number'}]})
        row = self.private.execute('create_item', {'kind': 'record', 'title': 'Row', 'database_id': db['id'], 'properties': {'count': 3}})
        with self.assertRaises(StoreError):
            self.move(row)
        self.move(db)
        self.assertEqual(self.private.snapshot()['items'], [])
        self.assertEqual(next(p for p in self.snapshot()['state']['items'] if p['kind'] == 'record')['properties'], {'count': 3})

    def test_executor_requires_real_validator_exact_member_source_and_thread(self):
        page = self.command('create_item', {'kind': 'page', 'title': 'Executor'})['result']
        binding = {'profile_id': self.bob, 'thread_id': 'native-exact', 'source': {
            'kind': 'local', 'connection_id': 'local-source', 'profile': 'bob', 'target_profile': 'bob'}}
        view = self.snapshot()
        args = dict(membership_revision=1, expected_scope=view['state']['scope_id'], expected_revision=view['state']['revision'])
        with self.assertRaisesRegex(StoreError, 'unavailable'):
            self.service.bind_executor(self.alice, self.pid, page['id'], binding, **args)
        with self.assertRaises(StoreError):
            self.service.bind_executor(self.alice, self.pid, page['id'], binding, validate=lambda b: dict(b, thread_id='wrong'), **args)
        self.assertEqual(self.snapshot()['state'], view['state'])
        saved = self.service.bind_executor(self.alice, self.pid, page['id'], binding, validate=lambda b: b, **args)
        self.assertEqual(saved['executor'], binding)
        self.assertEqual(saved['thread_id'], binding['thread_id'])
        self.assertEqual(SharedWorkspaces(self.root / 'shared').snapshot(self.alice, self.pid)['state']['items'][0]['executor'], binding)
        self.assertEqual(self.private.snapshot()['items'], [])
        self.service.set_member(self.alice, self.pid, self.bob, role='read_only', membership_revision=1)
        with self.assertRaises(StoreError):
            self.service.bind_executor(self.alice, self.pid, page['id'], binding, validate=lambda b: b,
                membership_revision=2, expected_scope=view['state']['scope_id'], expected_revision=self.snapshot()['state']['revision'])

    def test_default_policy_preserves_opt_out_and_restrictions_without_config_writes(self):
        self.assertTrue(desktop_default_enabled())
        self.assertTrue(desktop_default_enabled(True))
        self.assertFalse(desktop_default_enabled(False))
        self.assertFalse(desktop_default_enabled(True, restricted=True))
        self.assertFalse(desktop_default_enabled(None, restricted=True))

    def test_private_executor_pair_persists_but_is_not_a_native_grant(self):
        from workspace_plugin.workflow import Workflow
        from workspace_plugin.native import NativeSessions
        page = self.page()
        binding = {'profile_id': self.alice, 'thread_id': 'native-exact', 'source': {
            'kind': 'local', 'connection_id': 'local-source', 'profile': 'alice', 'target_profile': 'alice'}}
        before = self.private.snapshot()
        for revision in (None, False, -1):
            with self.assertRaises(StoreError):
                self.private.remember_executor(page['id'], binding, expected_revision=revision, validate=lambda b: b)
        self.assertEqual(self.private.snapshot(), before)
        self.private.remember_executor(page['id'], binding, expected_revision=before['revision'], validate=lambda b: b)
        self.assertEqual(Store(self.private.profile_home).snapshot()['items'][0]['executor'], binding)
        flow = Workflow(self.private.profile_home, store=self.private, native=NativeSessions(self.private.profile_home))
        with self.assertRaisesRegex(ValueError, '^Saved cross-owner executor binding is not qualified$'):
            flow.prepare(page['id'], binding['thread_id'], principal_id='synthetic-owner')
        destination = Store(self.root / 'restore-private')
        destination.restore_snapshot(self.private.backup_snapshot())
        self.assertNotIn('executor', destination.snapshot()['items'][0])
        self.assertIsNone(destination.snapshot()['items'][0]['thread_id'])
        from workspace_plugin.interchange import backup, read_backup, restore_into_store
        archive = backup(self.private.backup_snapshot())
        detached = read_backup(archive)
        self.assertNotIn('executor', detached['items'][0])
        self.assertIsNone(detached['items'][0]['thread_id'])
        restore_into_store(destination, archive)
        self.assertNotIn('executor', destination.snapshot()['items'][0])


if __name__ == '__main__':
    unittest.main()
