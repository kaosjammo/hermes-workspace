"""Issue #3: production Store/router, synthetic homes and admission only."""
import base64
import copy
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import tempfile
import unittest

from workspace_plugin.store import Store, StoreError


class NavigationOrderTests(unittest.TestCase):
    def setUp(self):
        root = Path(os.environ['HWS_QUALIFICATION_HOME']) / 'issue3-store'
        root.mkdir(parents=True, exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=root)
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        self.store = Store(self.home / 'alice')
        self.a = self.create('folder', '同じ <Folder>')
        self.child = self.create('folder', 'Deep', parent_id=self.a['id'])
        self.deep = self.create('page', '同じ <Page>', parent_id=self.child['id'], content='<p>Keep me.</p>')
        self.b = self.create('page', '同じ <Page>', content='<p>Original content.</p>')
        self.db = self.create('database', '同じ <Page>')
        self.record = self.create('record', 'Record', database_id=self.db['id'], content='<p>Record notes</p>')
        self.other = self.create('page', 'Other', parent_id=self.a['id'])
        self.deepdb = self.create('database', '同じ <Page>', parent_id=self.child['id'])
        self.deepfolder = self.create('folder', '同じ <Page>', parent_id=self.child['id'])
        self.c = self.create('page', '同じ <Page>')
        self.store.execute('add_comment', {'item_id': self.b['id'], 'text': 'Keep feedback'})
        self.store.execute('add_attachment', {'item_id': self.b['id'], 'name': 'keep.txt', 'media_type': 'text/plain', 'data_base64': base64.b64encode(b'Keep bytes').decode()})
        self.store.execute('open_item', {'id': self.b['id']})
        self.store.execute('save_template', {'item_id': self.b['id'], 'name': 'Keep template'})

    def create(self, kind, title, **kw):
        return self.store.execute('create_item', dict(kind=kind, title=title, **kw))

    def reorder(self, item, target, position='before', **kw):
        return self.store.execute('reorder_item', dict(id=item['id'], target_id=target['id'], position=position,
            expected_revision=self.store.snapshot()['revision'], **kw))

    def ids(self, parent=None, store=None):
        return [i['id'] for i in (store or self.store).snapshot()['items']
                if i['parent_id'] == parent and i['kind'] != 'record' and i['deleted_at'] is None]

    def test_root_and_deep_mixed_order_reopens_with_exact_payload_preservation(self):
        for moving, target, parent in [(self.db, self.a, None), (self.deepfolder, self.deep, self.child['id'])]:
            before = self.store.backup_snapshot()
            old = self.ids(parent)
            expected = [i for i in old if i != moving['id']]
            expected.insert(expected.index(target['id']), moving['id'])
            self.reorder(moving, target)
            reopened = Store(self.home / 'alice')
            self.assertEqual(self.ids(parent, reopened), expected)
            after = reopened.backup_snapshot()
            self.assertEqual({i['id']: i for i in before['items']}, {i['id']: i for i in after['items']})
            self.assertEqual([i for i in before['items'] if i['id'] not in old], [i for i in after['items'] if i['id'] not in old])
            for key in before.keys() - {'items', 'revision'}:
                self.assertEqual(before[key], after[key], key)
            self.assertEqual(after['revision'], before['revision'] + 1)
            self.assertEqual([i['id'] for i in reopened.catalog()['items']], [i['id'] for i in after['items']])

    def test_reject_bad_shapes_and_foreign_missing_trashed_records_nonsiblings_without_save(self):
        trashed = self.create('page', 'Trash')
        self.store.execute('trash', {'id': trashed['id']})
        foreign = Store(self.home / 'foreign').execute('create_item', {'kind': 'page', 'title': 'Foreign'})
        valid = dict(id=self.b['id'], target_id=self.a['id'], position='before')
        bad = [None, [], {}, {**valid, 'position': 'inside'}, {**valid, 'position': []},
               {**valid, 'id': self.record['id']}, {**valid, 'target_id': self.record['id']},
               {**valid, 'id': foreign['id']}, {**valid, 'target_id': 'missing'},
               {**valid, 'target_id': trashed['id']}, {**valid, 'id': trashed['id']},
               {**valid, 'target_id': self.other['id']}, {**valid, 'parent_id': self.a['id']},
               {**valid, 'id': False}, {**valid, 'target_id': {}},
               {**valid, 'expected_revision': False}, {**valid, 'expected_revision': None},
               {**valid, 'expected_revision': -1}, {**valid, 'expected_scope': 'foreign-scope'}]
        before = self.store.backup_snapshot()
        for payload in bad:
            with self.subTest(payload=payload), self.assertRaises(StoreError):
                self.store.execute('reorder_item', payload)
            self.assertEqual(self.store.backup_snapshot(), before)

    def test_stale_concurrent_operations_have_one_atomic_winner(self):
        revision = self.store.snapshot()['revision']
        def move(item):
            try:
                Store(self.home / 'alice').execute('reorder_item', dict(id=item['id'], target_id=self.a['id'], position='before', expected_revision=revision))
                return 'saved'
            except StoreError as exc:
                self.assertEqual(exc.status_code, 409)
                return 'stale'
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(move, [self.b, self.db]))
        self.assertCountEqual(results, ['saved', 'stale'])
        self.assertEqual(self.store.snapshot()['revision'], revision + 1)

    def test_run_locks_cover_ancestors_descendants_and_shifted_siblings(self):
        self.store.execute('add_comment', {'item_id': self.deep['id'], 'text': 'Synthetic active lock'})
        run = self.store.begin_run(self.deep['id'], 'synthetic-thread')
        before = self.store.backup_snapshot()
        for moving, target in [(self.a, self.db), (self.deep, self.deepdb), (self.db, self.a)]:
            with self.assertRaisesRegex(StoreError, 'active run'):
                self.reorder(moving, target)
            self.assertEqual(self.store.backup_snapshot(), before)
        self.store.finish_run(run['id'], 'cancelled')
        self.reorder(self.a, self.db, 'after')

    def test_creation_move_trash_restore_and_backup_keep_saved_order(self):
        self.reorder(self.db, self.a)
        extra = self.create('page', 'New last')
        self.assertEqual(self.ids(), [self.db['id'], self.a['id'], self.b['id'], self.c['id'], extra['id']])
        self.store.execute('update_item', {'id': self.b['id'], 'patch': {'parent_id': self.child['id']}})
        self.assertEqual(self.ids(self.child['id']), [self.deep['id'], self.b['id'], self.deepdb['id'], self.deepfolder['id']])
        self.store.execute('trash', {'id': self.a['id']})
        self.assertEqual(self.ids(), [self.db['id'], self.c['id'], extra['id']])
        self.store.execute('restore', {'id': self.a['id']})
        self.assertEqual(self.ids(), [self.db['id'], self.a['id'], self.c['id'], extra['id']])
        backup = self.store.backup_snapshot()
        restored = Store(self.home / 'restored')
        restored.restore_snapshot(backup)
        self.assertEqual(self.ids(store=restored), self.ids())
        self.assertEqual(self.ids(self.child['id'], restored), self.ids(self.child['id']))
        self.assertEqual([i['id'] for i in restored.snapshot()['items'] if i['kind'] == 'record'], [self.record['id']])

    def test_production_router_scope_revision_admission_and_reopen(self):
        from fastapi import FastAPI, HTTPException
        from fastapi.testclient import TestClient
        from dashboard.plugin_api import create_router
        selected = [self.home / 'alice']
        admitted = [True]
        def authorize():
            if not admitted[0]:
                raise HTTPException(403, 'Synthetic admission denied')
        app = FastAPI()
        app.include_router(create_router(lambda: selected[0], authorize=authorize))
        with TestClient(app) as client:
            state = client.get('/state').json()
            body = dict(op='reorder_item', expected_scope=state['scope_id'], payload=dict(id=self.db['id'], target_id=self.a['id'], position='before', expected_revision=state['revision']))
            response = client.post('/command', json=body)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['state'], Store(selected[0]).snapshot())
            self.assertEqual(self.ids()[0], self.db['id'])
            before = self.store.backup_snapshot()
            self.assertEqual(client.post('/command', json=body).status_code, 409)
            selected[0] = self.home / 'other-owner'
            self.assertEqual(client.post('/command', json=body).status_code, 409)
            selected[0] = self.home / 'alice'
            admitted[0] = False
            self.assertEqual(client.post('/command', json=body).status_code, 403)
            self.assertEqual(self.store.backup_snapshot(), before)

    def test_shared_service_and_router_keep_editor_and_membership_revision_checks(self):
        from workspace_plugin.shared_workspaces import SharedWorkspaces, profile_key
        from dashboard.plugin_api import create_router
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        service = SharedWorkspaces(self.home / 'shared')
        alice, bob = [profile_key(self.home / x) for x in ['alice', 'bob']]
        project = service.create(alice, 'Shared order', [{'profile_id': bob}])
        pid = project['id']
        def op(name, payload, actor=alice):
            view = service.snapshot(alice, pid)
            return service.execute(actor, pid, name, dict(payload, expected_revision=view['state']['revision']),
                expected_scope=view['state']['scope_id'], membership_revision=view['workspace']['membership_revision'])
        a = op('create_item', dict(kind='folder', title='Shared A'))['result']
        b = op('create_item', dict(kind='page', title='Shared B'))['result']
        view = service.snapshot(alice, pid)
        app = FastAPI()
        app.include_router(create_router(lambda: self.home / 'alice', authorize=lambda: None, shared_root=self.home / 'shared'))
        body = dict(op='reorder_item', expected_scope=view['state']['scope_id'], membership_revision=view['workspace']['membership_revision'], payload=dict(id=b['id'], target_id=a['id'], position='before', expected_revision=view['state']['revision']))
        with TestClient(app) as client:
            response = client.post('/workspaces/' + pid + '/command', json=body)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual([i['id'] for i in response.json()['state']['items']], [b['id'], a['id']])
            self.assertEqual(client.post('/workspaces/' + pid + '/command', json=body).status_code, 409)
        service.set_member(alice, pid, bob, role='read_only', membership_revision=1)
        before = service.snapshot(alice, pid)
        with self.assertRaises(StoreError) as error:
            op('reorder_item', dict(id=a['id'], target_id=b['id'], position='before'), bob)
        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(service.snapshot(alice, pid), before)


if __name__ == '__main__':
    unittest.main()
