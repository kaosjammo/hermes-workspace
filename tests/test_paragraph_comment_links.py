"""Shared paragraph highlights keep independent discussion identities and history."""
import tempfile
import unittest
from pathlib import Path

from workspace_plugin.store import Store, StoreError


class ParagraphCommentLinks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        self.store = Store(self.home)

    def tearDown(self):
        self.tmp.cleanup()

    def rewrite(self, before, after, quotes):
        page = self.store.execute('create_item', {'kind': 'page', 'title': 'Synthetic shared passage', 'content': before})
        comments = [self.store.execute('add_comment', {'item_id': page['id'], 'text': f'Feedback {n}',
            'anchor': {'quote': quote, 'prefix': '', 'suffix': ''}}) for n, quote in enumerate(quotes)]
        run = self.store.begin_run(page['id'], 'synthetic-shared-paragraph')
        self.store.apply_run(run['id'], [{'item_id': page['id'], 'patch': {'content': after}}],
                             [{'comment_id': c['id'], 'text': f'Response for {c["id"]}'} for c in comments])
        self.store.finish_run(run['id'], 'completed')
        return page, comments

    def test_two_paragraphs_merged_share_one_replacement_without_merging_discussions(self):
        after = '<p>A combined replacement for both.</p><p>Outside.</p>'
        page, comments = self.rewrite('<p>Alpha old.</p><p>Beta old.</p><p>Outside.</p>', after, ['Alpha old.', 'Beta old.'])
        before = self.store.backup_snapshot()
        views = Store(self.home).snapshot()['comments']
        for old, view in zip(comments, views):
            self.assertEqual(view['id'], old['id'])
            self.assertEqual(view['anchor'], old['anchor'])
            self.assertEqual(view['section_change']['highlight_status'], 'available')
            self.assertEqual(view['section_change']['anchor']['quote'], 'A combined replacement for both.')
            self.assertEqual(view['section_change']['status'], 'unavailable', 'Shared display cannot enable independent revert')
            self.assertEqual([r['text'] for r in view['replies']], [f'Response for {old["id"]}'])
            with self.assertRaises(StoreError):
                self.store.execute('preview_section_revert', {k: view['section_change'][k] for k in ('version_id', 'generation_id', 'change_id')})
        self.assertEqual(self.store.backup_snapshot(), before)
        self.store.execute('resolve_comment', {'id': comments[0]['id'], 'resolved': True})
        views = Store(self.home).snapshot()['comments']
        self.assertTrue(views[0]['resolved'])
        self.assertFalse(views[1]['resolved'])
        self.store.execute('delete_comment', {'id': comments[0]['id']})
        remaining = Store(self.home).snapshot()['comments']
        self.assertEqual([c['id'] for c in remaining], [comments[1]['id']])
        self.assertEqual(remaining[0]['replies'], views[1]['replies'])
        self.assertEqual(remaining[0]['section_change']['anchor']['quote'], 'A combined replacement for both.')
        self.assertEqual(Store(self.home).snapshot()['items'][0]['content'], after)

    def test_overlapping_original_selections_share_the_replacement(self):
        self.rewrite('<p>Old red words and blue ending.</p><p>Outside.</p>',
                     '<p>Warm new words and a clearer ending.</p><p>Outside.</p>',
                     ['Old red words and blue ending.', 'red words and blue'])
        views = Store(self.home).snapshot()['comments']
        self.assertTrue(all(c['section_change']['highlight_status'] == 'available' for c in views))
        self.assertEqual(views[0]['section_change']['anchor'], views[1]['section_change']['anchor'])

    def test_separate_paragraphs_keep_separate_passages(self):
        self.rewrite('<p>Alpha old.</p><p>Beta old.</p><p>Outside.</p>',
                     '<p>Alpha warm.</p><p>Beta clear.</p><p>Outside.</p>', ['Alpha old.', 'Beta old.'])
        changes = [c['section_change'] for c in Store(self.home).snapshot()['comments']]
        self.assertTrue(all(c['highlight_status'] == 'available' for c in changes))
        self.assertNotEqual(changes[0]['anchor'], changes[1]['anchor'])

    def test_removed_paragraph_does_not_attach_to_its_neighbour(self):
        self.rewrite('<p>Alpha old.</p><p>Beta old.</p><p>Outside.</p>',
                     '<p>Beta old.</p><p>Outside.</p>', ['Alpha old.', 'Beta old.'])
        removed = Store(self.home).snapshot()['comments'][0]['section_change']
        self.assertEqual(removed['highlight_status'], 'unavailable')
        self.assertNotIn('anchor', removed)


if __name__ == '__main__':
    unittest.main()
