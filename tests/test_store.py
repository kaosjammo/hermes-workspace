import base64
import concurrent.futures
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from workspace_plugin.store import Store, StoreError

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / '.local' / 'store' / 'tmp'
FIXTURES.mkdir(parents=True, exist_ok=True)


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=FIXTURES)
        self.home = Path(self.temp.name)
        self.store = Store(self.home)

    def tearDown(self):
        self.temp.cleanup()

    def op(self, op, **payload):
        return self.store.execute(op, payload)

    def page(self, title='Page', **kwargs):
        return self.op('create_item', kind='page', title=title, **kwargs)

    def database(self, title='Tasks', columns=None):
        db = self.op('create_item', kind='database', title=title)
        if columns is not None:
            self.op('set_columns', id=db['id'], columns=columns)
        return db

    def record(self, db, **props):
        return self.op('create_item', kind='record', title='Record', database_id=db['id'], properties=props)

    def item(self, ident):
        return next(x for x in self.store.snapshot()['items'] if x['id'] == ident)

    def test_explicit_profile_durable_arrays_and_permissions(self):
        page = self.page(content='<p>durable</p>')
        self.assertEqual(Store(self.home).snapshot()['items'][0]['id'], page['id'])
        self.assertEqual(Store(self.home / 'other').snapshot()['items'], [])
        for key in ('items', 'comments', 'versions', 'attachments', 'runs', 'recents', 'templates'):
            self.assertIsInstance(self.store.snapshot()[key], list)
        self.assertEqual(self.store.db_path.stat().st_mode & 0o777, 0o600)
        json.dumps(self.store.snapshot(), allow_nan=False)
        with self.assertRaises((TypeError, StoreError)):
            Store(None)

    def test_hierarchy_and_cycles(self):
        folder = self.op('create_item', kind='folder', title='Folder')
        child = self.op('create_item', kind='folder', title='Child', parent_id=folder['id'])
        page = self.page(parent_id=child['id'])
        with self.assertRaises(StoreError):
            self.op('update_item', id=folder['id'], patch={'parent_id': child['id']})
        with self.assertRaises(StoreError):
            self.page(parent_id=page['id'])
        with self.assertRaises(StoreError):
            self.op('create_item', kind='record', title='orphan')
        self.assertEqual(self.item(page['id'])['parent_id'], child['id'])

    def test_typed_values_and_formulas(self):
        db = self.database(columns=[{'id':'n','name':'Number','type':'number'}, {'id':'c','name':'Done','type':'checkbox'}, {'id':'d','name':'Date','type':'date'}, {'id':'s','name':'Status','type':'select','options':['Todo','Done']}, {'id':'f','name':'Double','type':'formula','formula':'n * 2'}])
        row = self.record(db, n=3, c=True, d='2026-11-06', s='Todo')
        self.assertEqual(row['properties']['f'], 6)
        for props in ({'n':True}, {'n':float('nan')}, {'c':'yes'}, {'d':'2026-02-30'}, {'s':'Other'}, {'missing':1}, {'f':9}):
            with self.subTest(props=props), self.assertRaises(StoreError):
                self.op('update_item', id=row['id'], patch={'properties':props})
        self.op('update_item', id=row['id'], patch={'properties':{'n':4,'c':False,'d':None,'s':'Done'}})
        self.assertEqual(self.item(row['id'])['properties']['f'], 8)

    def test_formula_cycles_invalid_schema_and_atomic_schema_edit(self):
        db = self.database(columns=[{'id':'n','name':'N','type':'number'}])
        row = self.record(db, n=3)
        rev = self.store.snapshot()['revision']
        for columns in ([{'id':'n','name':'N','type':'text'}], [{'id':'a','name':'A','type':'formula','formula':'b'}, {'id':'b','name':'B','type':'formula','formula':'a'}], [{'id':'n','name':'N','type':'formula','formula':'__import__("os")'}]):
            with self.assertRaises(StoreError):
                self.op('set_columns', id=db['id'], columns=columns)
        self.assertEqual(self.store.snapshot()['revision'], rev)
        self.assertEqual(self.item(row['id'])['properties']['n'], 3)

    def test_search_recents_and_sanitization(self):
        page = self.page('NeedleTitle', content='<p>NeedleBody</p><script>alert(1)</script><a href="javascript:alert(1)" onclick="bad()">safe</a>')
        self.assertNotIn('<script', page['content'])
        self.assertNotIn('javascript:', page['content'])
        self.assertNotIn('onclick', page['content'])
        db = self.database(columns=[{'id':'t','name':'Text','type':'text'}])
        row = self.record(db, t='NeedleValue')
        for term, ident in [('NeedleTitle',page['id']), ('NeedleBody',page['id']), ('NeedleValue',row['id'])]:
            self.assertIn(ident, [x['id'] for x in self.op('search', query=term)])
        self.op('open_item', id=page['id'])
        self.op('open_item', id=page['id'])
        self.assertEqual(len(self.store.snapshot()['recents']), 1)
        self.op('trash', id=page['id'])
        self.assertEqual(self.op('search', query='NeedleTitle'), [])
        self.assertEqual(self.store.snapshot()['recents'], [])

    def test_comments_replies_resolution_and_anchor(self):
        page = self.page(content='<p>hello world hello</p>')
        comment = self.op('add_comment', item_id=page['id'], text='edit', anchor={'quote':'hello','prefix':'','suffix':''})
        self.assertEqual(comment['anchor_status'], 'detached')
        unique = self.op('add_comment', item_id=page['id'], text='edit', anchor={'quote':'world','prefix':'hello ','suffix':' hello'})
        self.assertEqual(unique['anchor_status'], 'attached')
        self.op('reply_comment', id=comment['id'], text='answered')
        self.op('resolve_comment', id=unique['id'], resolved=True)
        run = self.store.begin_run(page['id'], 'native-session')
        self.assertEqual(run['comment_ids'], [comment['id']])
        self.store.apply_run(run['id'], [], [{'comment_id':comment['id'],'text':'agent answer'}])
        self.store.finish_run(run['id'], 'completed')
        current = self.store.snapshot()['comments'][0]
        self.assertFalse(current['resolved'])
        self.assertEqual(current['replies'][-1]['author'], 'agent')
        self.op('resolve_comment', id=unique['id'], resolved=False)
        run = self.store.begin_run(page['id'], 'native-session')
        self.assertEqual(set(run['comment_ids']), {comment['id'],unique['id']})
        self.store.finish_run(run['id'], 'cancelled')
        self.op('update_item', id=page['id'], patch={'content':'<p>gone</p>'})
        self.assertTrue(all(x['anchor_status']=='detached' for x in self.store.snapshot()['comments']))

    def test_trash_restore_purge_and_nested_groups(self):
        folder = self.op('create_item', kind='folder', title='Folder')
        inner = self.op('create_item', kind='folder', title='Inner', parent_id=folder['id'])
        page = self.page(parent_id=inner['id'])
        old = self.page('Already deleted', parent_id=folder['id'])
        self.op('trash', id=old['id'])
        self.op('trash', id=folder['id'])
        self.assertTrue(self.item(page['id'])['deleted_at'])
        with self.assertRaises(StoreError):
            self.op('restore', id=page['id'])
        self.op('restore', id=folder['id'])
        self.assertIsNone(self.item(page['id'])['deleted_at'])
        self.assertTrue(self.item(old['id'])['deleted_at'])
        with self.assertRaises(StoreError):
            self.op('purge', id=folder['id'])
        self.op('trash', id=folder['id'])
        self.op('purge', id=folder['id'])
        self.assertEqual(self.store.snapshot()['items'], [])

    def test_relations_integrity_trash_and_purge(self):
        other = self.database('Other')
        target = self.record(other)
        db = self.database(columns=[{'id':'r','name':'Related','type':'relation','target_database_id':other['id']}])
        row = self.record(db, r=[target['id']])
        with self.assertRaises(StoreError):
            self.op('update_item', id=row['id'], patch={'properties':{'r':[db['id']]}})
        self.op('trash', id=target['id'])
        self.assertEqual(self.item(row['id'])['properties']['r'], [target['id']])
        with self.assertRaises(StoreError):
            self.record(db, r=[target['id']])
        self.op('purge', id=target['id'])
        self.assertEqual(self.item(row['id'])['properties']['r'], [])
        self.op('trash', id=other['id'])
        self.op('purge', id=other['id'])
        self.assertEqual(self.item(db['id'])['columns'], [])

    def test_templates_and_attachment_bytes(self):
        page = self.page(content='<h1>Template</h1>')
        attachment = self.op('add_attachment', item_id=page['id'], name='original.docx', media_type='application/octet-stream', data_base64=base64.b64encode(b'original').decode())
        self.assertEqual(attachment['item_id'], page['id'])
        template = self.op('save_template', item_id=page['id'], name='Reusable')
        cloned = self.op('apply_template', template_id=template['id'], title='Copy')
        self.assertEqual(cloned['content'], page['content'])
        self.assertIsNone(cloned['thread_id'])
        db = self.database(columns=[{'id':'n','name':'N','type':'number'}])
        row = self.record(db, n=2)
        template = self.op('save_template', item_id=row['id'], name='Row')
        self.assertEqual(self.op('apply_template', template_id=template['id'], title='New', database_id=db['id'])['properties']['n'], 2)
        with self.assertRaises(StoreError):
            self.op('add_attachment', item_id=page['id'], name='../bad', media_type='text/plain', data_base64='not base64')

    def test_optimistic_concurrent_writes(self):
        revision = self.store.snapshot()['revision']
        def write(i):
            try:
                Store(self.home).execute('create_item', {'kind':'page','title':str(i),'expected_revision':revision})
                return 'ok'
            except StoreError as exc:
                return exc.status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(write, range(4)))
        self.assertEqual(results.count('ok'), 1)
        self.assertEqual(results.count(409), 3)
        self.assertEqual(len(self.store.snapshot()['items']), 1)

    def test_scoped_run_versions_locks_and_restore(self):
        folder = self.op('create_item', kind='folder', title='Folder')
        page = self.page('Current', content='<p>before</p>', parent_id=folder['id'])
        other = self.page('Requested')
        unrelated = self.page('Unrelated')
        comment = self.op('add_comment', item_id=page['id'], text='Please update Requested too', target_item_ids=[other['id']])
        with self.assertRaises(StoreError):
            self.store.begin_run(page['id'], 'native', [unrelated['id']])
        run = self.store.begin_run(page['id'], 'native', [other['id']])
        self.assertEqual(set(run['allowed_item_ids']), {page['id'],other['id']})
        self.assertEqual(len(run['version_ids']), 2)
        for op, payload in [('update_item',{'id':page['id'],'patch':{'title':'bad'}}), ('trash',{'id':folder['id']}), ('reply_comment',{'id':comment['id'],'text':'during'}), ('bind_thread',{'item_id':page['id'],'thread_id':'different'})]:
            with self.subTest(op=op), self.assertRaises(StoreError):
                self.op(op, **payload)
        self.op('update_item', id=unrelated['id'], patch={'title':'Usable'})
        before = self.store.snapshot()
        with self.assertRaises(StoreError):
            self.store.apply_run(run['id'], [{'item_id':page['id'],'patch':{'content':'changed'}}, {'item_id':unrelated['id'],'patch':{'content':'bad'}}], [])
        self.assertEqual(self.store.snapshot(), before)
        self.store.apply_run(run['id'], [{'item_id':page['id'],'patch':{'content':'<p>after</p>'}}], [{'comment_id':comment['id'],'text':'done'}])
        self.store.finish_run(run['id'], 'cancelled')
        self.assertEqual(self.item(page['id'])['content'], '<p>after</p>')
        with self.assertRaises(StoreError):
            self.store.apply_run(run['id'], [], [])
        version = next(v for v in self.store.snapshot()['versions'] if v['item_id']==page['id'])
        self.op('restore_version', id=version['id'])
        self.assertEqual(self.item(page['id'])['content'], '<p>before</p>')

    def test_run_lock_atomic_conflicts_schema_and_restart(self):
        db = self.database(columns=[{'id':'n','name':'N','type':'number'}])
        row = self.record(db, n=1)
        self.op('add_comment', item_id=row['id'], text='Change')
        run = self.store.begin_run(row['id'], 'native')
        with self.assertRaises(StoreError):
            self.op('set_columns', id=db['id'], columns=[])
        with self.assertRaises(StoreError):
            self.store.begin_run(db['id'], 'other')
        self.assertEqual(Store(self.home).snapshot()['runs'][0]['status'], 'running')
        self.store.finish_run(run['id'], 'error', 'provider failed')
        script = 'from pathlib import Path; from workspace_plugin.store import Store; s=Store(Path(__import__("sys").argv[1])); s.begin_run(__import__("sys").argv[2], "native")'
        result = subprocess.run([sys.executable, '-c', script, str(self.home), row['id']], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        restarted = Store(self.home)
        self.assertEqual(restarted.snapshot()['runs'][-1]['status'], 'running')
        restarted.recover_runs()
        recovered = restarted.snapshot()['runs'][-1]
        self.assertEqual(recovered['status'], 'error')
        self.assertIn('interrupted', recovered['error'].lower())
        self.op('update_item', id=row['id'], patch={'properties':{'n':2}})

    def test_imports_and_backup_atomic_detachment(self):
        page = self.store.import_document({'title':'Import','content':'<p>editable</p>','original':{'name':'source.docx','media_type':'application/octet-stream','data_base64':base64.b64encode(b'source').decode()}})
        db = self.store.import_table({'title':'CSV','columns':[{'id':'t','name':'T','type':'text'}], 'rows':[{'t':'value'}]})
        self.assertEqual(len([x for x in self.store.snapshot()['items'] if x['database_id']==db['id']]), 1)
        self.op('bind_thread', item_id=page['id'], thread_id='old-native')
        self.op('add_comment', item_id=page['id'], text='change')
        run = self.store.begin_run(page['id'], 'old-native')
        snapshot = self.store.snapshot()
        with self.assertRaises(StoreError):
            self.store.restore_snapshot(snapshot)
        self.store.apply_run(run['id'], [], [{'comment_id':run['comment_ids'][0],'text':'saved outcome'}])
        self.store.finish_run(run['id'], 'completed')
        snapshot = self.store.snapshot()
        other = Store(self.home / 'restored')
        other.restore_snapshot(snapshot)
        restored = other.snapshot()
        self.assertEqual({x['id'] for x in restored['items']}, {x['id'] for x in snapshot['items']})
        self.assertTrue(all(x['thread_id'] is None for x in restored['items']))
        self.assertEqual(restored['runs'], [])
        self.assertEqual(restored['attachments'], snapshot['attachments'])
        bad = json.loads(json.dumps(snapshot))
        bad['comments'][0]['item_id'] = 'missing'
        before = other.snapshot()
        with self.assertRaises(StoreError):
            other.restore_snapshot(bad)
        self.assertEqual(other.snapshot(), before)
        before = self.store.snapshot()
        with self.assertRaises(StoreError):
            self.store.import_table({'title':'Bad','columns':[{'id':'n','name':'N','type':'number'}], 'rows':[{'n':'invalid'}]})
        self.assertEqual(self.store.snapshot(), before)

    def test_strict_payloads_and_sqlite_foreign_keys(self):
        for op,payload in [('create_item',{'kind':'page','title':'x','thread_id':'injected'}), ('resolve_comment',{'id':'missing','resolved':'true'}), ('update_item',{'id':'missing','patch':{'kind':'folder'}})]:
            with self.subTest(op=op), self.assertRaises(StoreError):
                self.store.execute(op,payload)
        connection = sqlite3.connect(self.store.db_path)
        self.assertEqual(connection.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        self.assertEqual(connection.execute('PRAGMA foreign_key_check').fetchall(), [])
        connection.close()

    def test_scope_id_stable_isolated_and_not_restored(self):
        self.assertEqual(self.store.scope_id, Store(self.home).snapshot()['scope_id'])
        other = Store(self.home / 'scope-two')
        self.assertNotEqual(self.store.scope_id, other.scope_id)
        with self.assertRaises(StoreError) as caught:
            self.store.check_scope(None)
        self.assertEqual(caught.exception.status_code, 409)
        with self.assertRaises(StoreError):
            self.op('create_item', kind='page', title='wrong', expected_scope=other.scope_id)
        self.op('create_item', kind='page', title='right', expected_scope=self.store.scope_id)
        original_scope = other.scope_id
        other.restore_snapshot(self.store.snapshot())
        self.assertEqual(other.scope_id, original_scope)

    def test_schema_run_restore_and_inert_history_after_backup(self):
        db = self.database(columns=[{'id':'n','name':'N','type':'number'}])
        row = self.record(db, n=9)
        self.op('add_comment', item_id=db['id'], text='Remove N and change record')
        run = self.store.begin_run(db['id'], 'native')
        self.assertIn(row['id'], run['allowed_item_ids'])
        record_version = next(v for v in self.store.snapshot()['versions'] if v['item_id']==row['id'])
        self.assertEqual(record_version['database_columns'], [{'id':'n','name':'N','type':'number'}])
        self.store.apply_run(run['id'], [{'item_id':db['id'],'patch':{'columns':[],'title':'Changed'}}], [{'comment_id':run['comment_ids'][0],'text':'removed'}])
        self.store.finish_run(run['id'], 'completed')
        snapshot = self.store.snapshot()
        self.assertEqual(next(v for v in snapshot['versions'] if v['item_id']==row['id'])['snapshot']['properties'], {'n':9})
        restored = Store(self.home / 'history')
        restored.restore_snapshot(snapshot)
        db_version = next(v for v in restored.snapshot()['versions'] if v['item_id']==db['id'])
        row_version = next(v for v in restored.snapshot()['versions'] if v['item_id']==row['id'])
        restored.execute('restore_version', {'id':row_version['id']})
        result = restored.snapshot()
        self.assertEqual(next(i for i in result['items'] if i['id']==row['id'])['properties'], {'n':9})
        self.assertEqual(next(i for i in result['items'] if i['id']==db['id'])['title'], 'Tasks')
        self.assertEqual(result['runs'], [])

    def test_transaction_authorization_runs_after_sqlite_wait(self):
        import threading
        import time
        page = self.page()
        self.op('add_comment', item_id=page['id'], text='Edit')
        run = self.store.begin_run(page['id'], 'native')
        blocker = sqlite3.connect(self.store.db_path)
        blocker.execute('BEGIN IMMEDIATE')
        queued, authorized = threading.Event(), threading.Event()
        revoked = threading.Event()
        def authorize():
            authorized.set()
            if revoked.is_set():
                raise StoreError('Native epoch revoked', 403)
        def apply():
            queued.set()
            return self.store.apply_run(run['id'], [{'item_id':page['id'],'patch':{'content':'bad'}}], [], authorize=authorize)
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(apply)
            self.assertTrue(queued.wait(1))
            time.sleep(.05)
            self.assertFalse(authorized.is_set())
            revoked.set()
            blocker.rollback()
            blocker.close()
            with self.assertRaises(StoreError):
                future.result(timeout=3)
        self.assertTrue(authorized.is_set())
        self.assertEqual(self.item(page['id'])['content'], '')
        self.store.finish_run(run['id'], 'cancelled')

    def test_schema_history_does_not_block_later_schema_mutations(self):
        db = self.database(columns=[{'id':'n','name':'N','type':'number'}])
        row = self.record(db, n=3)
        self.op('add_comment', item_id=row['id'], text='Edit')
        run = self.store.begin_run(row['id'], 'native')
        self.store.finish_run(run['id'], 'cancelled')
        self.op('set_columns', id=db['id'], columns=[])
        snapshot = self.store.snapshot()
        self.assertEqual(snapshot['versions'][0]['snapshot']['properties'], {'n':3})
        self.assertEqual(snapshot['versions'][0]['database_columns'][0]['id'],'n')

    def test_other_page_and_new_sibling_usable_during_run(self):
        folder = self.op('create_item', kind='folder', title='Folder')
        page = self.page(parent_id=folder['id'])
        self.op('add_comment', item_id=page['id'], text='Edit')
        run = self.store.begin_run(page['id'], 'native')
        sibling = self.page('Sibling', parent_id=folder['id'])
        self.op('update_item', id=sibling['id'], patch={'content':'usable'})
        self.store.finish_run(run['id'], 'cancelled')

    def test_full_restore_rejects_malformed_graph_without_mutation(self):
        page = self.page()
        baseline = self.store.snapshot()
        corruptions = [lambda s:s['items'][0].update(kind=[]),lambda s:s['items'][0].update(properties={'x':1}),lambda s:s['items'][0].update(updated_at='yesterday'),lambda s:s['items'][0].update(parent_id=page['id']),lambda s:s['items'].append(dict(s['items'][0])),lambda s:s.update(recents=['missing']),lambda s:s['items'][0].update(content='<img src="attachment:missing">')]
        for corrupt in corruptions:
            changed = json.loads(json.dumps(baseline))
            corrupt(changed)
            with self.subTest(changed=changed), self.assertRaises(StoreError):
                self.store.restore_snapshot(changed)
            self.assertEqual(self.store.snapshot(),baseline)

    def test_purge_preserves_unrelated_historical_values(self):
        db = self.database(columns=[{'id':'n','name':'N','type':'number'}])
        row = self.record(db,n=7)
        self.op('add_comment', item_id=row['id'], text='edit')
        run = self.store.begin_run(row['id'],'native')
        self.store.finish_run(run['id'],'cancelled')
        self.op('set_columns', id=db['id'], columns=[])
        unused = self.page('Unused')
        self.op('trash',id=unused['id'])
        self.op('purge',id=unused['id'])
        self.assertEqual(self.store.snapshot()['versions'][0]['snapshot']['properties'],{'n':7})

    def test_template_copies_images_and_survives_source_purge(self):
        page = self.page('Image source')
        image = self.op('add_attachment',item_id=page['id'],name='tiny.png',media_type='image/png',data_base64=base64.b64encode(b'png-fixture').decode())
        self.op('update_item',id=page['id'],patch={'content':f'<p>picture</p><img src="attachment:{image["id"]}">'})
        template = self.op('save_template',item_id=page['id'],name='Images')
        cloned = self.op('apply_template',template_id=template['id'],title='Copy')
        clones = [x for x in self.store.snapshot()['attachments'] if x['item_id']==cloned['id']]
        self.assertEqual(len(clones),1)
        self.assertIn(clones[0]['id'],cloned['content'])
        self.op('trash',id=page['id'])
        self.op('purge',id=page['id'])
        again = self.op('apply_template',template_id=template['id'],title='After purge')
        self.assertIn('attachment:',again['content'])

    def test_shared_attachment_reference_survives_owner_purge(self):
        source = self.page('Source')
        blob = self.op('add_attachment',item_id=source['id'],name='image.png',media_type='image/png',data_base64='eA==')
        other = self.page('Other',content=f'<img src="attachment:{blob["id"]}">')
        self.op('trash',id=source['id'])
        self.op('purge',id=source['id'])
        state=self.store.snapshot()
        self.assertNotIn(source['id'],[x['id'] for x in state['items']])
        remaining=[x for x in state['attachments'] if x['item_id']==other['id']]
        self.assertEqual(len(remaining),1)
        self.assertIn(remaining[0]['id'],self.item(other['id'])['content'])

    def test_no_implicit_scope_from_content_replies_or_ambiguous_names(self):
        page=self.page('Current',content='<p>edit Secret</p>')
        secret=self.page('Secret')
        duplicate=self.page('Duplicate')
        self.page('Duplicate')
        comment=self.op('add_comment',item_id=page['id'],text='Update Duplicate')
        self.op('reply_comment',id=comment['id'],text='Update Secret')
        run=self.store.begin_run(page['id'],'native')
        self.assertEqual(run['allowed_item_ids'],[page['id']])
        with self.assertRaises(StoreError):
            self.store.apply_run(run['id'],[{'item_id':secret['id'],'patch':{'content':'bad'}}],[])
        self.store.finish_run(run['id'],'cancelled')

    def test_relational_purge_is_blocked_by_affected_run(self):
        target_db=self.database('Target')
        target=self.record(target_db)
        related_db=self.database(columns=[{'id':'r','name':'R','type':'relation','target_database_id':target_db['id']}])
        row=self.record(related_db,r=[target['id']])
        self.op('trash',id=target['id'])
        self.op('add_comment',item_id=row['id'],text='Edit this row')
        run=self.store.begin_run(row['id'],'native')
        before=self.store.snapshot()
        with self.assertRaises(StoreError):
            self.op('purge',id=target['id'])
        self.assertEqual(self.store.snapshot(),before)
        self.store.finish_run(run['id'],'cancelled')
        self.op('purge',id=target['id'])
        self.assertEqual(self.item(row['id'])['properties']['r'],[])

    def test_formula_errors_are_explicit_and_authoritative(self):
        db=self.database(columns=[{'id':'n','name':'N','type':'number'},{'id':'f','name':'F','type':'formula','formula':'10 / n'}])
        row=self.record(db,n=0)
        self.assertIsNone(row['properties']['f'])
        self.assertIn('f',row['formula_errors'])
        snapshot=self.store.snapshot()
        next(x for x in snapshot['items'] if x['id']==row['id'])['properties']['f']='forged'
        self.store.restore_snapshot(snapshot)
        self.assertIsNone(self.item(row['id'])['properties']['f'])

    def test_store_rejects_symlink_database_and_directories(self):
        outside=self.home/'target'
        outside.write_text('untouched')
        bad=self.home/'symlink-profile'/'plugin-data'/'workspace'
        bad.mkdir(parents=True)
        (bad/'workspace.sqlite3').symlink_to(outside)
        with self.assertRaises(StoreError):
            Store(self.home/'symlink-profile')
        self.assertEqual(outside.read_text(),'untouched')

    def test_stop_waiting_writer_cannot_apply_after_revocation(self):
        import threading
        page=self.page()
        self.op('add_comment',item_id=page['id'],text='Edit')
        run=self.store.begin_run(page['id'],'native')
        entered=threading.Event()
        release=threading.Event()
        def authorize():
            entered.set()
            release.wait(2)
        def write():
            return self.store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':'accepted partial'}}],[],authorize=authorize)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            writer=executor.submit(write)
            self.assertTrue(entered.wait(1))
            stop=executor.submit(self.store.finish_run,run['id'],'cancelled')
            release.set()
            writer.result(timeout=3)
            stop.result(timeout=3)
        with self.assertRaises(StoreError):
            self.store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':'late'}}],[])
        self.assertEqual(self.item(page['id'])['content'],'accepted partial')

    def test_real_archive_roundtrip_preserves_history_templates_and_image_bytes(self):
        from workspace_plugin.interchange import backup, read_backup
        folder=self.op('create_item',kind='folder',title='Archive folder')
        page=self.page('Archive page',parent_id=folder['id'])
        image=self.op('add_attachment',item_id=page['id'],name='fixture.png',media_type='image/png',data_base64='c3ludGhldGlj')
        self.op('update_item',id=page['id'],patch={'content':f'<p>before</p><img src="attachment:{image["id"]}">'})
        template=self.op('save_template',item_id=page['id'],name='Image template')
        self.op('bind_thread',item_id=page['id'],thread_id='synthetic-native-archive')
        comment=self.op('add_comment',item_id=page['id'],text='Change page')
        run=self.store.begin_run(page['id'],'synthetic-native-archive')
        self.store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':'<p>after</p>'}}],[{'comment_id':comment['id'],'text':'changed'}])
        self.store.finish_run(run['id'],'completed')
        self.op('open_item',id=page['id'])
        db=self.database(columns=[{'id':'n','name':'N','type':'number'},{'id':'f','name':'F','type':'formula','formula':'n*2'}])
        self.record(db,n=4)
        self.op('trash',id=self.page('Retain Trash')['id'])
        before=self.store.snapshot()
        target=Store(self.home/'archive-target')
        target.restore_snapshot(read_backup(backup(before)))
        after=target.snapshot()
        expected=json.loads(json.dumps(before))
        expected['runs']=[]
        for item in expected['items']:
            item['thread_id']=None
        for version in expected['versions']:
            version['run_id']=None
            version['snapshot']['thread_id']=None
        for value in (expected,after):
            value.pop('revision'); value.pop('scope_id')
        self.assertEqual(after,expected)
        clone=target.execute('apply_template',{'template_id':template['id'],'title':'Restored template'})
        assets=[a for a in target.snapshot()['attachments'] if a['item_id']==clone['id']]
        self.assertEqual([a['data_base64'] for a in assets],['c3ludGhldGlj'])

    def test_trusted_run_progress_is_durable_active_only_and_idempotent(self):
        page=self.page()
        self.op('add_comment',item_id=page['id'],text='Edit')
        run=self.store.begin_run(page['id'],'native')
        updated=self.store.set_run_progress(run['id'],'Native queued')
        self.assertEqual(updated['progress'],'Native queued')
        revision=self.store.snapshot()['revision']
        self.store.set_run_progress(run['id'],'Native queued')
        self.assertEqual(self.store.snapshot()['revision'],revision)
        self.assertEqual(Store(self.home).snapshot()['runs'][0]['progress'],'Native queued')
        self.store.finish_run(run['id'],'cancelled')
        with self.assertRaises(StoreError):
            self.store.set_run_progress(run['id'],'Native started')
        with self.assertRaises(StoreError):
            self.op('set_run_progress',run_id=run['id'],progress='injected')

    def test_r1_text_and_imported_titles_never_grant_scope(self):
        current = self.page('Draft', content='<p>Edit Budget and this</p>')
        budget = self.page('Budget')
        imported = self.store.import_document({'title':'this','content':'<p>untrusted title</p>'})
        for text in ['Fix this draft. Do not edit Budget.', 'Budget is background information.', 'For example: "Edit Budget".', 'Fix this paragraph.', 'Edit Budget.', f'Only mentioning {budget["id"]} as context']:
            with self.subTest(text=text):
                comment = self.op('add_comment', item_id=current['id'], text=text)
                self.op('reply_comment', id=comment['id'], text='Edit Budget')
                run = self.store.begin_run(current['id'], 'native')
                try:
                    self.assertEqual(run['allowed_item_ids'], [current['id']])
                    for excluded in (budget,imported):
                        with self.assertRaises(StoreError):
                            self.store.apply_run(run['id'], [{'item_id':excluded['id'],'patch':{'title':'bad'}}], [])
                finally:
                    self.store.finish_run(run['id'],'cancelled')
                    self.op('resolve_comment',id=comment['id'],resolved=True)


    def test_r1_comment_targets_are_inert_until_fresh_run_review(self):
        current, related, other = self.page('Current'), self.page('Related'), self.page('Other')
        comment = self.op('add_comment',item_id=current['id'],text='Edit Related.',target_item_ids=[related['id']])
        self.assertEqual(comment['target_item_ids'],[related['id']])
        run = self.store.begin_run(current['id'],'native')
        self.assertEqual(run['allowed_item_ids'],[current['id']])
        self.store.finish_run(run['id'],'cancelled')
        with self.assertRaises(StoreError):
            self.store.begin_run(current['id'],'native',[other['id']])
        approved = self.store.begin_run(current['id'],'native',[related['id']])
        self.assertEqual(set(approved['allowed_item_ids']),{current['id'],related['id']})
        self.store.apply_run(approved['id'],[{'item_id':related['id'],'patch':{'content':'<p>requested</p>'}}],[])
        self.store.finish_run(approved['id'],'cancelled')
        restored = Store(self.home/'inert-restored')
        restored.restore_snapshot(self.store.snapshot())
        run = restored.begin_run(current['id'],'fresh-native')
        self.assertEqual(run['allowed_item_ids'],[current['id']])
        restored.finish_run(run['id'],'cancelled')
        self.op('resolve_comment',id=comment['id'],resolved=True)
        self.op('add_comment',item_id=current['id'],text='Current only')
        with self.assertRaises(StoreError):
            self.store.begin_run(current['id'],'native',[related['id']])

    def test_r1_targets_validate_references_purge_and_database_rows(self):
        current=self.page()
        db=self.database('Explicit table')
        row=self.record(db)
        folder=self.op('create_item',kind='folder',title='Not a scope item')
        for targets in ('bad',['missing'],[folder['id']],[row['id'],row['id']]):
            with self.subTest(targets=targets),self.assertRaises(StoreError):
                self.op('add_comment',item_id=current['id'],text='Request',target_item_ids=targets)
        comment=self.op('add_comment',item_id=current['id'],text='Update Explicit table',target_item_ids=[db['id']])
        run=self.store.begin_run(current['id'],'native',[db['id']])
        self.assertEqual(set(run['allowed_item_ids']),{current['id'],db['id'],row['id']})
        self.store.finish_run(run['id'],'cancelled')
        self.op('trash',id=db['id']); self.op('purge',id=db['id'])
        self.assertEqual(next(c for c in self.store.snapshot()['comments'] if c['id']==comment['id'])['target_item_ids'],[])

    def test_r1_restore_schema_preserves_later_row_data_visibly(self):
        old=[{'id':'common','name':'Common','type':'text'},{'id':'old','name':'Old','type':'text'},{'id':'amount','name':'Amount','type':'number'}]
        new=[{'id':'common','name':'Common','type':'text'},{'id':'new','name':'New','type':'text'},{'id':'amount','name':'Amount','type':'text'}]
        db=self.database(columns=old)
        initial=self.record(db,common='original',old='before',amount=5)
        self.op('add_comment',item_id=db['id'],text='Replace schema')
        run=self.store.begin_run(db['id'],'native')
        self.store.apply_run(run['id'],[{'item_id':initial['id'],'patch':{'properties':{'common':'original','old':'before'}}},{'item_id':db['id'],'patch':{'columns':new}}],[])
        self.store.finish_run(run['id'],'cancelled')
        later=self.op('create_item',kind='record',title='Later row',database_id=db['id'],content='<p>Later document remains</p>',properties={'common':'keep typed','new':'<script>inert & retained</script>','amount':'twelve'})
        version=next(v for v in self.store.snapshot()['versions'] if v['item_id']==db['id'])
        self.op('restore_version',id=version['id'])
        self.assertEqual(self.item(db['id'])['columns'],old)
        self.assertEqual(self.item(initial['id'])['properties'],{'common':'original','old':'before','amount':5})
        after=self.item(later['id'])
        self.assertEqual(after['title'],'Later row')
        self.assertEqual(after['properties'],{'common':'keep typed'})
        self.assertTrue(after['content'].startswith('<p>Later document remains</p>'))
        from html import unescape
        visible=unescape(after['content'])
        self.assertIn('Recovered properties',visible)
        self.assertIn('twelve',visible)
        self.assertIn('<script>inert & retained</script>',visible)
        self.assertNotIn('<script>',after['content'])
        self.assertIn('"id": "new"',visible)
        self.assertEqual(next(i for i in Store(self.home).snapshot()['items'] if i['id']==later['id']),after)
        # A repeated restore must not duplicate retained data.
        self.op('restore_version',id=version['id'])
        self.assertEqual(self.item(later['id'])['content'],after['content'])
        from workspace_plugin.interchange import backup,read_backup
        destination=Store(self.home/'schema-recovery-backup')
        destination.restore_snapshot(read_backup(backup(self.store.snapshot())))
        self.assertEqual(next(i for i in destination.snapshot()['items'] if i['id']==later['id'])['content'],after['content'])

    def test_r1_run_receipt_and_effects_atomic_and_replay_preserves_newer_edits(self):
        import hashlib
        current=self.page()
        comment=self.op('add_comment',item_id=current['id'],text='Edit')
        run=self.store.begin_run(current['id'],'native')
        edits=[{'item_id':current['id'],'patch':{'content':'<p>first</p>'}}]
        replies=[{'comment_id':comment['id'],'text':'Outcome é'}]
        digest=hashlib.sha256(json.dumps([edits,replies],sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf-8')).hexdigest()
        calls=[]
        def authorize(): calls.append('native checked')
        result=self.store.apply_run(run['id'],edits,replies,authorize=authorize,operation_id=digest,operation_digest=digest)
        self.assertEqual(result['operation_receipts'],[{'operation_id':digest,'operation_digest':digest,'comment_ids':[comment['id']]}])
        self.store.apply_run(run['id'],[{'item_id':current['id'],'patch':{'content':'<p>newer</p>'}}],[])
        baseline=self.store.snapshot()
        result=self.store.apply_run(run['id'],edits,replies,authorize=authorize,operation_id=digest,operation_digest=digest)
        self.assertEqual(self.store.snapshot(),baseline)
        self.assertEqual(calls,['native checked','native checked'])
        self.assertEqual(self.item(current['id'])['content'],'<p>newer</p>')
        self.assertEqual(len(self.store.snapshot()['comments'][0]['replies']),1)
        for operation_id,operation_digest in [(digest,'0'*64),('0'*64,digest)]:
            with self.assertRaises(StoreError):
                self.store.apply_run(run['id'],edits,replies,operation_id=operation_id,operation_digest=operation_digest)
            self.assertEqual(self.store.snapshot(),baseline)
        def denied(): raise StoreError('Native admission revoked',403)
        with self.assertRaises(StoreError):
            self.store.apply_run(run['id'],edits,replies,authorize=denied,operation_id=digest,operation_digest=digest)
        self.assertEqual(self.store.snapshot(),baseline)
        self.store.finish_run(run['id'],'cancelled')
        with self.assertRaises(StoreError):
            self.store.apply_run(run['id'],edits,replies,operation_id=digest,operation_digest=digest)

    def test_r1_receipt_rolls_back_with_invalid_edit_and_concurrent_retries(self):
        import hashlib
        current=self.page()
        comment=self.op('add_comment',item_id=current['id'],text='Edit')
        run=self.store.begin_run(current['id'],'native')
        def identity(edits,replies):
            value=hashlib.sha256(json.dumps([edits,replies],sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()).hexdigest()
            return dict(operation_id=value,operation_digest=value)
        edits=[{'item_id':current['id'],'patch':{'content':'<p>accepted once</p>'}}]
        replies=[{'comment_id':comment['id'],'text':'one reply'}]
        bad=edits+[{'item_id':'missing','patch':{'content':'forbidden'}}]
        before=self.store.snapshot()
        with self.assertRaises(StoreError):
            self.store.apply_run(run['id'],bad,replies,**identity(bad,replies))
        self.assertEqual(self.store.snapshot(),before)
        revision=before['revision']
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            results=list(executor.map(lambda _:self.store.apply_run(run['id'],edits,replies,**identity(edits,replies)),range(3)))
        state=self.store.snapshot()
        self.assertEqual(state['revision'],revision+1)
        self.assertEqual(len(state['comments'][0]['replies']),1)
        self.assertEqual(len(state['runs'][0]['operation_receipts']),1)

    def test_r1_full_backup_of_previously_admitted_large_dataset(self):
        from workspace_plugin.interchange import backup,read_backup
        page=self.page('Backuppable accepted data')
        encoded=base64.b64encode(b'x'*(6*1024*1024)).decode()
        for name in ('first.bin','second.bin'):
            self.op('add_attachment',item_id=page['id'],name=name,media_type='application/octet-stream',data_base64=encoded)
        raw=self.store.backup_snapshot() if hasattr(self.store,'backup_snapshot') else self.store.snapshot()
        restored=read_backup(backup(raw))
        destination=Store(self.home/'large-backup')
        destination.restore_snapshot(restored)
        self.assertEqual(destination.snapshot()['attachments'],self.store.snapshot()['attachments'])

    def test_r1_pure_raw_backup_validation_has_no_profile_or_native_lookup(self):
        import workspace_plugin.store as storage
        from unittest.mock import patch
        page=self.page('Raw state')
        self.op('add_comment',item_id=page['id'],text='Comment')
        raw=self.store.backup_snapshot()
        baseline=json.loads(json.dumps(raw))
        with patch.object(Store,'__init__',side_effect=AssertionError('No profile constructor')),patch.object(Store,'_connect',side_effect=AssertionError('No database')),patch.object(Path,'open',side_effect=AssertionError('No filesystem')):
            validated=storage.validate_backup_snapshot(raw)
        self.assertEqual(validated,baseline)
        self.assertEqual(raw,baseline)
        corrupt=json.loads(json.dumps(raw)); corrupt['comments'][0]['item_id']='missing'
        with self.assertRaises(StoreError): storage.validate_backup_snapshot(corrupt)

    def test_r1_replay_still_authorizes_after_waiting_for_sqlite(self):
        import threading
        import time
        current=self.page()
        self.op('add_comment',item_id=current['id'],text='Edit')
        run=self.store.begin_run(current['id'],'native')
        edits=[{'item_id':current['id'],'patch':{'content':'already saved'}}]
        self.store.apply_run(run['id'],edits,[])
        baseline=self.store.snapshot()
        blocker=sqlite3.connect(self.store.db_path)
        blocker.execute('BEGIN IMMEDIATE')
        queued,checked,revoked=threading.Event(),threading.Event(),threading.Event()
        def authorize():
            checked.set()
            if revoked.is_set(): raise StoreError('Native admission revoked while queued',403)
        def retry():
            queued.set()
            return self.store.apply_run(run['id'],edits,[],authorize=authorize)
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            result=executor.submit(retry)
            self.assertTrue(queued.wait(1)); time.sleep(.05)
            self.assertFalse(checked.is_set())
            revoked.set(); blocker.rollback(); blocker.close()
            with self.assertRaises(StoreError): result.result(timeout=3)
        self.assertTrue(checked.is_set())
        self.assertEqual(self.store.snapshot(),baseline)

    def test_r1_original_apply_signature_does_not_replay_old_effects(self):
        current=self.page()
        comment=self.op('add_comment',item_id=current['id'],text='Edit')
        run=self.store.begin_run(current['id'],'native')
        edits=[{'item_id':current['id'],'patch':{'content':'<p>first accepted</p>'}}]
        replies=[{'comment_id':comment['id'],'text':'one accepted outcome'}]
        self.store.apply_run(run['id'],edits,replies)
        self.store.apply_run(run['id'],[{'item_id':current['id'],'patch':{'content':'<p>newer accepted</p>'}}],[])
        baseline=self.store.snapshot()
        self.store.apply_run(run['id'],edits,replies)
        self.assertEqual(self.store.snapshot(),baseline)
        self.assertEqual(self.item(current['id'])['content'],'<p>newer accepted</p>')
        self.assertEqual(len(self.store.snapshot()['comments'][0]['replies']),1)

    def test_r1_raw_backup_retains_persisted_fields_and_rejects_active_html(self):
        from workspace_plugin.store import validate_backup_snapshot
        db=self.database(columns=[{'id':'n','name':'N','type':'number'},{'id':'f','name':'F','type':'formula','formula':'n*2'}])
        row=self.record(db,n=3)
        page=self.page(content='<p><input type="checkbox" checked></p>')
        comment=self.op('add_comment',item_id=page['id'],text='Edit',anchor={'quote':'missing','prefix':'','suffix':''},target_item_ids=[row['id']])
        self.op('trash',id=page['id'])
        raw=self.store.backup_snapshot()
        self.assertEqual(next(i for i in raw['items'] if i['id']==row['id'])['properties'],{'n':3})
        self.assertNotIn('anchor_status',raw['comments'][0])
        self.assertIn('_trash_root',next(i for i in raw['items'] if i['id']==page['id']))
        self.assertEqual(validate_backup_snapshot(raw),raw)
        for malicious in ['<p onclick="bad()">unsafe</p>','<script>bad()</script>','<img src="https://remote.invalid/image.png">']:
            corrupt=json.loads(json.dumps(raw))
            next(i for i in corrupt['items'] if i['id']==page['id'])['content']=malicious
            with self.subTest(malicious=malicious),self.assertRaises(StoreError):
                validate_backup_snapshot(corrupt)

    def test_r1_raw_restore_budget_excludes_destination_scope_provenance(self):
        from unittest.mock import patch
        import workspace_plugin.store as storage
        self.page('Exact raw budget')
        raw=self.store.backup_snapshot()
        persisted={key:value for key,value in raw.items() if key!='scope_id'}
        budget=len(json.dumps(persisted,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode())
        target=Store(self.home/'scope-budget')
        scope=target.scope_id
        with patch.object(storage,'MAX_STATE',budget):
            storage.validate_backup_snapshot(raw)
            target.restore_snapshot(raw)
        self.assertEqual(target.snapshot()['items'],self.store.snapshot()['items'])
        self.assertEqual(target.scope_id,scope)


class LightweightReadTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=FIXTURES)
        self.addCleanup(self.temp.cleanup)
        self.store=Store(Path(self.temp.name))
        def seed(state):
            return [self.store._create(state,{'kind':'page','title':f'Page {index:03}',
                    'content':'<p>body-match '+('synthetic '*40)+'</p>'}) for index in range(205)]
        self.pages=self.store._transaction(seed)

    def test_search_complete_total_paging_light_summaries_and_stale_cursor(self):
        before=self.store.snapshot()
        first=self.store.execute('search_page',{'query':'body-match','limit':200})
        self.assertEqual(first['total'],205)
        self.assertEqual(len(first['items']),200)
        self.assertTrue(first['has_more'])
        self.assertEqual(first['next_offset'],200)
        self.assertNotIn('content',first['items'][0])
        self.assertIn('body-match',first['items'][0]['excerpt'])
        with self.assertRaises(StoreError):
            self.store.execute('search_page',{'query':'body-match','offset':200})
        last=self.store.execute('search_page',{'query':'body-match','offset':200,'expected_revision':first['revision']})
        self.assertEqual(len(last['items']),5)
        self.assertEqual(last['items'][0]['id'],self.pages[200]['id'])
        self.assertFalse(last['has_more'])
        self.assertEqual(len(self.store.execute('search',{'query':'body-match'})),200,'Legacy array contract stays unchanged')
        self.assertEqual(self.store.snapshot(),before)
        self.store.execute('update_item',{'id':self.pages[0]['id'],'patch':{'title':'Changed'}})
        with self.assertRaises(StoreError):
            self.store.execute('search_page',{'query':'body-match','offset':200,'expected_revision':first['revision']})
        for fields in ({'offset':False},{'offset':-1},{'limit':0},{'limit':201}):
            with self.assertRaises(StoreError):
                self.store.execute('search_page',{'query':'body-match',**fields})

    def test_catalog_omits_content_history_blobs_without_materializing_full_graph(self):
        from unittest.mock import patch
        before=self.store.snapshot()
        with patch.object(self.store,'_load',side_effect=AssertionError('Catalog must not load the whole graph')):
            catalog=self.store.catalog(expected_scope=self.store.scope_id,expected_revision=before['revision'])
        self.assertEqual(len(catalog['items']),205)
        self.assertNotIn('body-match',json.dumps(catalog))
        self.assertNotIn('attachments',catalog)
        self.assertNotIn('versions',catalog)
        self.assertLess(len(json.dumps(catalog)),len(json.dumps(before))/2)
        self.assertEqual(self.store.snapshot(),before)
        with self.assertRaises(StoreError):
            self.store.catalog(expected_scope='foreign-scope')

    def test_lazy_detail_history_fences_comments_and_database_value_search(self):
        page=self.pages[-1]
        comment=self.store.execute('add_comment',{'item_id':page['id'],'text':'Synthetic comment'})
        run=self.store.begin_run(page['id'],'synthetic-thread')
        self.store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':'<p>Updated body-match</p>'}}],[{'comment_id':comment['id'],'text':'Synthetic outcome'}])
        self.store.finish_run(run['id'],'completed')
        revision=self.store.snapshot()['revision']
        detail=self.store.document(page['id'],expected_scope=self.store.scope_id,expected_revision=revision)
        self.assertNotIn('versions',detail)
        self.assertEqual(detail['comments'][0]['id'],comment['id'])
        history=self.store.document(page['id'],history=True,expected_scope=self.store.scope_id,expected_revision=revision)
        self.assertEqual(history['versions'][0]['snapshot']['content'],page['content'])
        self.store.execute('delete_comment',{'id':comment['id']})
        self.assertEqual(self.store.document(page['id'])['comments'],[])
        with self.assertRaises(StoreError):
            self.store.document(page['id'],history=True,expected_revision=revision)
        db=self.store.execute('create_item',{'kind':'database','title':'Database'})
        self.store.execute('set_columns',{'id':db['id'],'columns':[{'id':'text','name':'Text','type':'text'}]})
        record=self.store.execute('create_item',{'kind':'record','title':'Row','database_id':db['id'],'properties':{'text':'unique-property-term'}})
        result=self.store.execute('search_page',{'query':'unique-property-term'})
        self.assertEqual([r['id'] for r in result['items']],[record['id']])
        self.assertEqual(self.store.document(record['id'])['database']['columns'][0]['id'],'text')
        rows=self.store.document(db['id'])['record_rows']
        self.assertEqual(rows[0]['properties']['text'],'unique-property-term')
        self.assertNotIn('content',rows[0])


class UserRunReviewStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=FIXTURES)
        self.addCleanup(self.temp.cleanup)
        self.store=Store(Path(self.temp.name))
        self.page=self.store.execute('create_item',{'kind':'page','title':'Current'})
        self.related=self.store.execute('create_item',{'kind':'page','title':'Chosen only for this run'})
        self.comment=self.store.execute('add_comment',{'item_id':self.page['id'],'text':'No saved target references'})

    def test_review_is_read_only_exact_and_legacy_unreviewed_guard_remains(self):
        before=self.store.backup_snapshot()
        reviewed=self.store.review_run_scope(self.page['id'],[self.related['id']],expected_revision=before['revision'])
        self.assertEqual(self.store.backup_snapshot(),before)
        self.assertEqual(reviewed['selected_item_ids'],[self.related['id']])
        with self.assertRaises(StoreError):
            self.store.begin_run(self.page['id'],'synthetic-thread',[self.related['id']])
        with self.assertRaises(StoreError):
            self.store.begin_run(self.page['id'],'synthetic-thread',[self.related['id']],scope_review=reviewed)
        run=self.store.begin_run(self.page['id'],'synthetic-thread',[self.related['id']],scope_review=lambda:reviewed)
        self.assertEqual(set(run['allowed_item_ids']),{self.page['id'],self.related['id']})
        self.assertEqual(self.store.snapshot()['comments'][0]['target_item_ids'],[])

    def test_changed_comment_item_revision_and_selection_refuse_without_run(self):
        reviewed=self.store.review_run_scope(self.page['id'],[self.related['id']],expected_revision=self.store.snapshot()['revision'])
        with self.assertRaises(StoreError):
            self.store.begin_run(self.page['id'],'synthetic-thread',[],scope_review=lambda:reviewed)
        self.store.execute('reply_comment',{'id':self.comment['id'],'text':'Changed after review'})
        before=self.store.backup_snapshot()
        with self.assertRaises(StoreError):
            self.store.begin_run(self.page['id'],'synthetic-thread',[self.related['id']],scope_review=lambda:reviewed)
        self.assertEqual(self.store.backup_snapshot(),before)
        self.assertEqual(before['runs'],[])

    def test_folder_unavailable_locked_and_stale_review_inputs_refuse(self):
        folder=self.store.execute('create_item',{'kind':'folder','title':'Not a document'})
        for selected in ([folder['id']],['missing'],[self.related['id'],self.related['id']]):
            with self.subTest(selected=selected),self.assertRaises(StoreError):
                self.store.review_run_scope(self.page['id'],selected,expected_revision=self.store.snapshot()['revision'])
        self.store.execute('trash',{'id':self.related['id']})
        with self.assertRaises(StoreError):
            self.store.review_run_scope(self.page['id'],[self.related['id']],expected_revision=self.store.snapshot()['revision'])
        for bad in (None,False,-1):
            with self.assertRaises(StoreError):
                self.store.review_run_scope(self.page['id'],[],expected_revision=bad)


class NormalWeightSemanticTests(unittest.TestCase):
    """C/D shared marker contract; backend/export evidence, not native UI proof."""
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=FIXTURES)
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.store = Store(self.home)

    def test_exact_reset_token_save_reopen_backup_and_unsafe_css_drop(self):
        from workspace_plugin.store import _content
        from workspace_plugin.interchange import sanitize_html, backup, restore_into_store
        canonical = '<h2>Heading <span data-workspace-weight="normal">Reset words</span> End</h2>'
        variants = [canonical, '<h2>Heading <span style="font-weight: normal;">Reset words</span> End</h2>',
                    '<h2>Heading <span style=" FONT-WEIGHT : 400 ">Reset words</span> End</h2>']
        for source in variants:
            with self.subTest(source=source):
                self.assertEqual(_content(source), canonical)
                self.assertEqual(sanitize_html(source), canonical)
        duplicate = '<span data-workspace-weight="normal" style="font-weight:400">Text</span>'
        self.assertEqual(_content(duplicate).count('data-workspace-weight='), 1)
        for source in ['<span style="font-weight:400;color:red">Text</span>',
                       '<span style="font-weight:normal;background:url(https://unsafe.invalid/x)">Text</span>',
                       '<span style="font-weight:expression(1)">Text</span>',
                       '<span data-workspace-weight="bold">Text</span>',
                       '<h2 data-workspace-weight="normal">Text</h2>']:
            with self.subTest(unsafe=source):
                for cleaner in (_content, sanitize_html):
                    cleaned = cleaner(source)
                    self.assertNotIn('style=', cleaned)
                    self.assertNotIn('data-workspace-weight=', cleaned)
                    self.assertNotIn('unsafe.invalid', cleaned)
        page = self.store.execute('create_item', {'kind':'page','title':'Reset fidelity','content':variants[1]})
        self.assertEqual(page['content'],canonical)
        self.assertEqual(Store(self.home).snapshot()['items'][0]['content'],canonical)
        target = Store(self.home/'restore')
        restore_into_store(target,backup(self.store.backup_snapshot()))
        self.assertEqual(target.snapshot()['items'][0]['content'],canonical)

    def test_docx_heading_inheritance_explicit_off_and_nested_bold_import_roundtrip(self):
        import io, zipfile
        import xml.etree.ElementTree as ET
        from workspace_plugin import interchange as api
        content = '<h2>Heading <span data-workspace-weight="normal">Reset <em>italic</em> <strong>Rebold</strong> <u>underlined</u> <a href="https://example.invalid/">linked</a></span> End</h2>'
        item = {'title':'Semantic reset','content':content}
        data = api.export_document(item,'docx')
        ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        w = '{'+ns['w']+'}'
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            body = ET.fromstring(archive.read('word/document.xml'))
            styles = ET.fromstring(archive.read('word/styles.xml'))
        self.assertEqual(body.find('.//w:pPr/w:pStyle',ns).attrib[w+'val'],'Heading2')
        self.assertIsNotNone(styles.find('.//w:style[@w:styleId="Heading2"]/w:rPr/w:b',ns))
        runs = {''.join(r.itertext()):r for r in body.findall('.//w:r',ns)}
        for text in ('Reset ','italic','underlined','linked'):
            self.assertEqual(runs[text].find('w:rPr/w:b',ns).attrib[w+'val'],'0')
            self.assertEqual(runs[text].find('w:rPr/w:bCs',ns).attrib[w+'val'],'0')
        self.assertIsNotNone(runs['italic'].find('w:rPr/w:i',ns))
        self.assertIsNotNone(runs['underlined'].find('w:rPr/w:u',ns))
        self.assertIsNotNone(runs['Rebold'].find('w:rPr/w:b',ns))
        self.assertNotEqual(runs['Rebold'].find('w:rPr/w:b',ns).attrib.get(w+'val'),'0')
        imported = api.import_file('reset.docx',data)['content']
        self.assertIn('<h2>',imported)
        self.assertIn('data-workspace-weight="normal"',imported)
        self.assertIn('<strong>Rebold</strong>',imported)
        self.assertIn('https://example.invalid/',imported)
        second = api.import_file('reset-again.docx',api.export_document({'title':'Again','content':imported},'docx'))['content']
        self.assertEqual(second,imported)

    def test_pdf_reset_font_runs_preserve_heading_and_ancestor_italics(self):
        import io
        from pypdf import PdfReader
        from workspace_plugin.interchange import export_document
        content = '<h2>Heading <span data-workspace-weight="normal">Reset</span> End</h2><p><em><strong>Outer <span data-workspace-weight="normal">Italic reset</span> tail</strong></em></p>'
        pdf = export_document({'title':'PDF reset','content':content},'pdf')
        runs=[]
        reader=PdfReader(io.BytesIO(pdf))
        reader.pages[0].extract_text(visitor_text=lambda text,cm,tm,font,size:runs.append((text.strip(),str((font or {}).get('/BaseFont','')))))
        normal = [font for text,font in runs if text=='Reset']
        italic = [font for text,font in runs if text=='Italic reset']
        heading = [font for text,font in runs if text=='Heading']
        self.assertTrue(normal,runs)
        self.assertTrue(all('Bold' not in font and 'Oblique' not in font for font in normal),runs)
        self.assertTrue(italic,runs)
        self.assertTrue(all('Oblique' in font and 'Bold' not in font for font in italic),runs)
        self.assertTrue(heading,runs)
        self.assertTrue(all('Bold' in font for font in heading),runs)

    def test_marker_keeps_anchor_text_section_hash_and_recovery(self):
        from workspace_plugin.store import _plain
        import hashlib
        before = '<h2>Heading <span data-workspace-weight="normal">Reset words</span> End</h2>'
        after = before.replace('Reset words','Changed words')
        page = self.store.execute('create_item',{'kind':'page','title':'Section reset','content':before})
        comment = self.store.execute('add_comment',{'item_id':page['id'],'text':'Change reset words',
            'anchor':{'quote':'Reset words','prefix':'Heading ','suffix':' End'}})
        run = self.store.begin_run(page['id'],'synthetic-thread')
        self.store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':after}}],[{'comment_id':comment['id'],'text':'Synthetic outcome'}])
        self.store.finish_run(run['id'],'completed')
        state = self.store.snapshot()
        self.assertEqual(state['items'][0]['content'],after)
        self.assertEqual(_plain(before),'Heading Reset words End')
        change = state['comments'][0]['section_change']
        preview = self.store.execute('preview_section_revert',{k:change[k] for k in ('version_id','generation_id','change_id')})
        self.assertEqual(preview['content_hash'],hashlib.sha256(after.encode()).hexdigest())
        self.store.execute('revert_section',{k:preview[k] for k in ('version_id','generation_id','change_id','content_hash','manual_revision','dataset_epoch')}|{'confirmed':False})
        self.assertEqual(self.store.snapshot()['items'][0]['content'],before)
