"""Synthetic ordinary CRUD; section/run history must outlive a discussion."""
import copy
import tempfile
import unittest
from pathlib import Path

from workspace_plugin.store import Store, StoreError


class CommentDeletionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        self.store = Store(self.home)

    def create(self, kind='page', **fields):
        return self.store.execute('create_item', dict(kind=kind, title='Synthetic', **fields))

    def test_unresolved_resolved_anchored_and_whole_scope_durable(self):
        page = self.create(content='<p>Original words.</p>')
        database = self.create('database')
        record = self.create('record', database_id=database['id'])
        for item, anchored in [(page, True), (page, False), (database, False), (record, False)]:
            for resolved in (False, True):
                with self.subTest(kind=item['kind'], anchored=anchored, resolved=resolved):
                    comment = self.store.execute('add_comment', dict(item_id=item['id'], text='Remove this feedback',
                        anchor={'quote': 'Original words.', 'prefix': '', 'suffix': ''} if anchored else None))
                    self.store.execute('reply_comment', {'id': comment['id'], 'text': 'Remove this reply'})
                    if resolved:
                        self.store.execute('resolve_comment', {'id': comment['id'], 'resolved': True})
                    before = self.store.snapshot()
                    result = self.store.execute('delete_comment', {'id': comment['id']})
                    self.assertEqual(result, {'id': comment['id'], 'item_id': item['id'], 'deleted': True})
                    reopened = Store(self.home).snapshot()
                    self.assertNotIn(comment['id'], [c['id'] for c in reopened['comments']])
                    self.assertEqual(reopened['items'], before['items'])
                    for op, payload in [('reply_comment', {'text': 'Late reply'}),
                                        ('resolve_comment', {'resolved': False}), ('delete_comment', {})]:
                        with self.assertRaises(StoreError):
                            self.store.execute(op, dict(id=comment['id'], **payload))
                    self.assertEqual(Store(self.home).snapshot(), reopened)

    def test_preserves_provenance_revert_history_and_other_discussion(self):
        page = self.create(content='<p>Original words.</p>')
        first = self.store.execute('add_comment', {'item_id': page['id'], 'text': 'Change words',
            'anchor': {'quote': 'Original words.', 'prefix': '', 'suffix': ''}})
        second = self.store.execute('add_comment', {'item_id': page['id'], 'text': 'Keep this discussion'})
        run = self.store.begin_run(page['id'], 'synthetic-thread')
        before_locked = self.store.backup_snapshot()
        with self.assertRaisesRegex(StoreError, 'active run'):
            self.store.execute('delete_comment', {'id': first['id']})
        self.assertEqual(self.store.backup_snapshot(), before_locked)
        self.store.apply_run(run['id'], [{'item_id': page['id'], 'patch': {'content': '<p>Changed words.</p>'}}],
            [{'comment_id': cid, 'text': 'Synthetic outcome'} for cid in run['comment_ids']])
        self.store.finish_run(run['id'], 'completed')
        change = next(c for c in self.store.snapshot()['comments'] if c['id'] == first['id'])['section_change']
        before = copy.deepcopy(self.store.backup_snapshot())
        self.store.execute('delete_comment', {'id': first['id']})
        after = self.store.backup_snapshot()
        for key in ('versions', 'runs', 'items', 'attachments'):
            self.assertEqual(after[key], before[key])
        self.assertEqual(self.store.snapshot()['comments'][0]['id'], second['id'])
        self.assertNotIn('Change words', str(after['comments']))
        self.assertNotIn('Synthetic outcome', str(next(c for c in after['comments'] if c['id'] == first['id'])))
        preview = self.store.execute('preview_section_revert', {k: change[k] for k in ('version_id', 'generation_id', 'change_id')})
        self.store.execute('revert_section', {k: preview[k] for k in
            ('version_id', 'generation_id', 'change_id', 'content_hash', 'manual_revision', 'dataset_epoch')} | {'confirmed': False})
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Original words.</p>')
        self.assertNotIn(first['id'], [c['id'] for c in self.store.snapshot()['comments']])
        with self.assertRaises(StoreError):
            self.store.apply_run(run['id'], [], [{'comment_id': first['id'], 'text': 'Late native reply'}])

    def test_revision_conflict_and_backup_tombstone_survive_restore(self):
        page = self.create()
        comment = self.store.execute('add_comment', {'item_id': page['id'], 'text': 'Deleted'})
        before = self.store.snapshot()
        with self.assertRaises(StoreError):
            self.store.execute('delete_comment', {'id': comment['id'], 'expected_revision': before['revision'] - 1})
        self.assertEqual(self.store.snapshot(), before)
        self.store.execute('delete_comment', {'id': comment['id']})
        backup = self.store.backup_snapshot()
        destination = Store(self.home / 'restore')
        destination.restore_snapshot(backup)
        self.assertEqual(destination.snapshot()['comments'], [])
        with self.assertRaises(StoreError):
            destination.execute('reply_comment', {'id': comment['id'], 'text': 'No resurrection'})


if __name__ == '__main__':
    unittest.main()
