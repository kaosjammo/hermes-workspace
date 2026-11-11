"""Explicit fixture test: ISSUE4_OUT/ISSUE4_DATA; run this file after issue-4-browser.test.mjs.

Production Store creation fences and typed-data preservation, using task-owned synthetic state.
"""
import json
import os
from pathlib import Path
import unittest
import uuid
from workspace_plugin.store import Store, StoreError


class Issue4Creation(unittest.TestCase):
    def setUp(self):
        self.out = Path(os.environ['ISSUE4_OUT'])
        self.home = self.out/'scratch'/('store-'+uuid.uuid4().hex)
        self.store = Store(self.home)
        self.db = self.store.execute('create_item', {'kind': 'database', 'title': 'Synthetic typed records'})
        self.columns = [{'id': 'text', 'name': 'Text', 'type': 'text'}, {'id': 'n', 'name': 'Count', 'type': 'number'},
                        {'id': 'flag', 'name': 'Verified', 'type': 'checkbox'}, {'id': 'date', 'name': 'Date', 'type': 'date'},
                        {'id': 'status', 'name': 'Status', 'type': 'select', 'options': ['Planned', 'Done']},
                        {'id': 'double', 'name': 'Double', 'type': 'formula', 'formula': 'col("Count") * 2'}]
        self.store.execute('set_columns', {'id': self.db['id'], 'columns': self.columns})
        self.record = self.store.execute('create_item', {'kind': 'record', 'title': 'Original typed record', 'database_id': self.db['id'],
            'content': '<p>Keep this record document.</p>', 'properties': {'text': '入力', 'n': 7, 'flag': True, 'date': '2026-11-11', 'status': 'Planned'}})

    def write(self, op, payload):
        state = self.store.snapshot()
        return self.store.execute(op, {**payload, 'expected_scope': state['scope_id'], 'expected_revision': state['revision']})

    def test_appended_property_and_group_creation_keep_existing_typed_values(self):
        before = self.store.snapshot()
        self.write('set_columns', {'id': self.db['id'], 'columns': self.columns+[{'id': 'new', 'name': 'New property', 'type': 'text'}]})
        for value in ['Done', None]:
            row = self.write('create_item', {'kind': 'record', 'database_id': self.db['id'], 'title': 'Group '+str(value), 'properties': {'status': value}})
            self.assertEqual(row['properties']['status'], value)
        reopened = Store(self.home).snapshot()
        old = next(i for i in before['items'] if i['id']==self.record['id'])
        saved = next(i for i in reopened['items'] if i['id']==self.record['id'])
        for key in ['id', 'database_id', 'title', 'content', 'properties']:
            self.assertEqual(saved[key], old[key], key)
        self.assertEqual(saved['properties']['double'], 14)

    def test_invalid_duplicate_schema_stale_revision_and_scope_leave_data_intact(self):
        before = self.store.backup_snapshot()
        with self.assertRaises(StoreError):
            self.write('set_columns', {'id': self.db['id'], 'columns': self.columns+[{'id': 'new', 'name': 'Count', 'type': 'text'}]})
        state=self.store.snapshot()
        for fences in [{'expected_scope': 'unrelated-synthetic-scope'}, {'expected_revision': state['revision']-1}]:
            with self.assertRaises(StoreError):
                self.store.execute('create_item', {'kind': 'record', 'database_id': self.db['id'], 'title': 'Denied record', **fences})
        self.assertEqual(self.store.backup_snapshot(),before)

    def test_actual_store_run_lock_denies_record_and_schema_creation(self):
        self.store.execute('add_comment', {'item_id': self.db['id'], 'text': 'Synthetic active-lock fixture'})
        self.store.begin_run(self.db['id'], 'synthetic-issue4-lock')
        before=self.store.backup_snapshot()
        with self.assertRaises(StoreError):self.write('create_item', {'kind': 'record', 'database_id': self.db['id'], 'title': 'Locked record'})
        with self.assertRaises(StoreError):self.write('set_columns', {'id': self.db['id'], 'columns': self.columns+[{'id':'new','name':'New property','type':'text'}]})
        self.assertEqual(self.store.backup_snapshot(),before)

    def test_rendered_browser_writes_preserve_all_original_typed_records(self):
        run=os.environ.get('ISSUE4_DATA','browser-3')
        before=json.loads((self.out/f'before-{run}.json').read_text())
        after=json.loads((self.out/f'after-{run}.json').read_text())
        current={i['id']:i for i in after['items']}
        records=[i for i in before['items'] if i['kind']=='record']
        self.assertEqual(len(records),70)
        for item in records:
            for key in ['id','database_id','title','content','properties']:
                self.assertEqual(current[item['id']][key],item[key],(item['id'],key))
        new=[i for i in after['items'] if i['id'] not in {old['id'] for old in before['items']}]
        self.assertEqual(len(new),7)
        self.assertEqual(sum(i['title']=='Delayed record' for i in new),1)
        for group,value in [('Done','Done'),('Unassigned',None)]:
            self.assertEqual(next(i for i in new if i['title']=='Board '+group+' record')['properties']['status'],value)


if __name__=='__main__':unittest.main()
