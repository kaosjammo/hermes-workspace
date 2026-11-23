"""Issue #8 context/identity persistence through the production Store.

Fixtures must use a task-owned external directory. No live/native/provider work.
"""
import os
import tempfile
import unittest
from pathlib import Path
from workspace_plugin.store import Store


class Issue8CommentPersistence(unittest.TestCase):
    def setUp(self):
        evidence = os.environ.get('ISSUE8_EVIDENCE') or os.environ.get('HWS_QUALIFICATION_HOME')
        if not evidence:
            self.fail('Set ISSUE8_EVIDENCE or HWS_QUALIFICATION_HOME to task-owned evidence')
        scratch = Path(evidence) / 'scratch' / 'store'
        scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.store = Store(self.home)

    def test_independent_ids_original_context_and_replies_survive_edits_resolve_reopen_delete_reload(self):
        page = self.store.execute('create_item', {'kind': 'page', 'title': 'Synthetic river notes',
                                                'content': '<p>North river path. South river path.</p>'})
        database = self.store.execute('create_item', {'kind': 'database', 'title': 'Synthetic observations'})
        comments = []
        for quote, prefix in [('North river path', ''), ('river path', 'North ')]:
            comments.append(self.store.execute('add_comment', {'item_id': page['id'], 'text': 'Independent feedback',
                                                              'anchor': {'quote': quote, 'prefix': prefix, 'suffix': ''}}))
        whole = self.store.execute('add_comment', {'item_id': database['id'], 'text': 'Database-wide feedback'})
        self.store.execute('reply_comment', {'id': comments[0]['id'], 'text': 'Keep this user context'})
        run = self.store.begin_run(page['id'], 'synthetic-issue8-thread')
        self.assertEqual(set(run['comment_ids']), {c['id'] for c in comments})
        self.store.apply_run(run['id'], [], [{'comment_id': c['id'], 'text': 'Simulated response, still unresolved'} for c in comments])
        self.store.finish_run(run['id'], 'completed')
        first = next(c for c in self.store.snapshot()['comments'] if c['id'] == comments[0]['id'])
        self.assertFalse(first['resolved'])
        self.assertEqual(len(first['replies']), 2)
        anchors = {c['id']: c['anchor'] for c in comments}
        self.store.execute('resolve_comment', {'id': comments[0]['id'], 'resolved': True})
        self.store.execute('resolve_comment', {'id': comments[0]['id'], 'resolved': False})
        self.store.execute('update_item', {'id': page['id'], 'patch': {'content': '<p>Passages changed; original context stays stored.</p>'}})
        saved = Store(self.home).snapshot()
        for cid, anchor in anchors.items():
            comment = next(c for c in saved['comments'] if c['id'] == cid)
            self.assertEqual(comment['anchor'], anchor)
            self.assertFalse(comment['resolved'])
        self.assertIsNone(next(c for c in saved['comments'] if c['id'] == whole['id'])['anchor'])
        self.store.execute('delete_comment', {'id': comments[1]['id']})
        reloaded = Store(self.home).snapshot()
        self.assertEqual({c['id'] for c in reloaded['comments']}, {comments[0]['id'], whole['id']})
        self.assertEqual(next(c for c in reloaded['comments'] if c['id'] == comments[0]['id'])['replies'], first['replies'])


if __name__ == '__main__':
    unittest.main()
