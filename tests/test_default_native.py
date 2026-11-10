"""Candidate default-native contract tests. Synthetic homes/records only; no inference."""
import os
from pathlib import Path
import tempfile
import unittest

from workspace_plugin.store import Store
from workspace_plugin.workflow import Workflow


class DefaultNativeContract(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.home = Path(self.tmp.name)
        self.store = Store(self.home)
        self.page = self.store.execute('create_item', {'kind': 'page', 'title': 'Synthetic'})
        self.store.execute('add_comment', {'item_id': self.page['id'], 'text': 'Fixture comment'})
        self.flow = Workflow(self.home, store=self.store)

    def tearDown(self):
        self.tmp.cleanup()

    def test_authenticated_prepare_without_native_owner_refuses_before_lock(self):
        with self.assertRaises(ValueError):
            self.flow.prepare(self.page['id'], 'missing-native-session', principal_id='uid:1000')
        self.assertEqual(self.store.snapshot()['runs'], [])

    def test_consume_without_native_owner_never_commits_or_grants(self):
        with self.assertRaises(ValueError):
            self.flow.consume('unknown-run', principal_id='uid:1000')
        self.assertEqual(self.store.snapshot()['runs'], [])


if __name__ == '__main__':
    unittest.main()
