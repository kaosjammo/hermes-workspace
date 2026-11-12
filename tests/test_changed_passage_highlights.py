"""Changed-passage links use saved edit provenance, with synthetic documents."""
import tempfile
import unittest
from pathlib import Path

from workspace_plugin.store import Store, _plain


class ChangedPassageHighlights(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        self.store = Store(self.home)
        self.before = '<p>Scarlet hue. Unchanged middle. Violet hue.</p><p>Outside stays.</p>'
        self.after = self.before.replace('Scarlet', 'Azure').replace('Violet', 'Ochre')
        self.page = self.store.execute('create_item', {'kind': 'page', 'title': 'Synthetic rewrite', 'content': self.before})
        self.comment = self.store.execute('add_comment', {'item_id': self.page['id'], 'text': 'Revise both colours.',
            'anchor': {'quote': 'Scarlet hue. Unchanged middle. Violet hue.', 'prefix': '', 'suffix': 'Outside stays.'}})

    def tearDown(self):
        self.tmp.cleanup()

    def apply(self, content=None, replies=True, status='completed'):
        run = self.store.begin_run(self.page['id'], 'synthetic-highlight-thread')
        self.store.apply_run(run['id'], [{'item_id': self.page['id'], 'patch': {'content': content or self.after}}],
            [{'comment_id': self.comment['id'], 'text': 'Updated both colours.'}] if replies else [])
        self.store.finish_run(run['id'], status)
        return run

    def view(self):
        return Store(self.home).snapshot()['comments'][0]

    def assert_ranges(self, view):
        change = view['section_change']
        self.assertEqual(change['highlight_status'], 'available', change)
        self.assertEqual([a['quote'] for a in change['anchors']], ['Azure', 'Ochre'])
        self.assertEqual(change['anchor'], change['anchors'][0])
        self.assertEqual(view['id'], self.comment['id'])
        self.assertEqual(view['anchor'], self.comment['anchor'])
        return change

    def test_rewrite_keeps_each_changed_range_linked_after_reopen_and_resolution(self):
        self.apply()
        view = self.view()
        change = self.assert_ranges(view)
        self.assertEqual(change['status'], 'available')
        self.assertFalse(view['resolved'])
        self.assertEqual(len(view['replies']), 1)
        self.store.execute('resolve_comment', {'id': self.comment['id'], 'resolved': True})
        self.assertTrue(self.view()['resolved'])
        self.assert_ranges(self.view())
        self.store.execute('resolve_comment', {'id': self.comment['id'], 'resolved': False})
        self.assert_ranges(self.view())

    def test_partial_run_and_missing_response_keep_geometry_without_cleanup_permission(self):
        self.apply(replies=False, status='cancelled')
        change = self.assert_ranges(self.view())
        self.assertEqual(change['status'], 'unavailable')

    def test_later_outside_edits_keep_ranges_and_revert_restores_only_its_section(self):
        self.apply()
        self.store.execute('update_item', {'id': self.page['id'], 'patch': {
            'content': self.after.replace('Outside stays.', 'Outside has a later manual note.')}})
        change = self.assert_ranges(self.view())
        preview = self.store.execute('preview_section_revert', {k: change[k] for k in ('version_id', 'generation_id', 'change_id')})
        self.store.execute('revert_section', {**{k: preview[k] for k in
            ('version_id', 'generation_id', 'change_id', 'content_hash', 'manual_revision', 'dataset_epoch')}, 'confirmed': True})
        saved = Store(self.home).snapshot()
        self.assertEqual(saved['items'][0]['content'], self.before.replace('Outside stays.', 'Outside has a later manual note.'))
        self.assertEqual(saved['comments'][0]['replies'], [])

    def test_replaced_or_restored_history_never_falls_back_to_the_old_selection(self):
        run = self.apply()
        self.store.execute('restore_version', {'id': run['version_ids'][0]})
        change = self.view()['section_change']
        self.assertEqual(change['highlight_status'], 'unavailable')
        self.assertNotIn('anchor', change)
        self.assertNotIn('anchors', change)


if __name__ == '__main__':
    unittest.main()
