"""UI02 mapping invariants; Store/API/confirmation tests follow integration."""
import unittest
from workspace_plugin.sections import capture_sections, plan_revert, SectionUnavailable
from workspace_plugin.store import _plain, _content


def anchor(document, quote):
    text = _plain(document)
    start = text.index(quote)
    return {'quote': quote, 'prefix': text[max(0, start-32):start], 'suffix': text[start+len(quote):start+len(quote)+32]}


class SectionMapping(unittest.TestCase):
    def test_two_changes_in_one_paragraph_restore_only_a(self):
        before = '<p>Keep <strong>young trees shaded</strong> through summer. Water the <em>north bed slowly</em> each morning.</p>'
        after = '<p>Keep <strong>young trees sheltered</strong> through summer. Water the <em>north bed deeply</em> each morning.</p>'
        changes = capture_sections(before, after, {'a': anchor(before, 'young trees shaded'), 'b': anchor(before, 'north bed slowly')}, _plain)
        self.assertEqual({key: value['status'] for key, value in changes.items()}, {'a': 'available', 'b': 'available'})
        reverted = plan_revert(changes['a'], after, after, _plain, _content)['content']
        self.assertEqual(reverted, '<p>Keep <strong>young trees shaded</strong> through summer. Water the <em>north bed deeply</em> each morning.</p>')

    def test_manual_inside_and_outside_stay_within_exact_section(self):
        before = '<p>Before context. Shade young trees until noon. Outside context.</p>'
        after = before.replace('until noon', 'until evening')
        change = capture_sections(before, after, {'a': anchor(before, 'Shade young trees until noon')}, _plain)['a']
        current = after.replace('young trees', 'new saplings').replace('Outside context.', 'Keep my outside edit.')
        result = plan_revert(change, after, current, _plain, _content)
        self.assertEqual(result['content'], before.replace('Outside context.', 'Keep my outside edit.'))

    def test_inline_formatting_is_preserved(self):
        before = '<p>Context: shade the trees. End context.</p>'
        after = '<p>Context: <strong>shade the trees</strong>. End context.</p>'
        change = capture_sections(before, after, {'a': anchor(before, 'shade the trees')}, _plain)['a']
        self.assertEqual(change['status'], 'available')
        self.assertEqual(plan_revert(change, after, after, _plain, _content)['content'], before)

    def test_unchanged_reply_and_ambiguous_overlap_fail_closed(self):
        before = '<p>Young trees need shade. Later.</p>'
        value = anchor(before, 'Young trees need shade')
        self.assertEqual(capture_sections(before, before, {'a': value}, _plain), {})
        after = before.replace('need shade', 'need shelter')
        overlap = capture_sections(before, after, {'a': value, 'b': anchor(before, 'trees need shade')}, _plain)
        self.assertTrue(all(c['status'] == 'unavailable' for c in overlap.values()))
        ambiguous = capture_sections('<p>same same</p>', '<p>other other</p>', {'a': {'quote': 'same', 'prefix': '', 'suffix': ''}}, _plain)
        self.assertEqual(ambiguous['a']['status'], 'unavailable')

    def test_later_cross_boundary_edit_never_broadens_revert(self):
        before = '<p>Prefix. Original words. Suffix.</p>'
        after = before.replace('Original words', 'Changed words')
        change = capture_sections(before, after, {'a': anchor(before, 'Original words')}, _plain)['a']
        with self.assertRaises(SectionUnavailable):
            plan_revert(change, after, '<p>Replaced everything.</p>', _plain, _content)


if __name__ == '__main__':
    unittest.main()
