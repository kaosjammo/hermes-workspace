"""Admitted display metadata never supplies executor identity or tool authority."""
import json
import unittest
from hermes_constants import set_hermes_home_override, reset_hermes_home_override
from test_public_runs import PublicRunsFixture
from workspace_plugin import public_plugin
from workspace_plugin.identity import executor, human_id


class PublicIdentityTests(PublicRunsFixture, unittest.TestCase):
    def prepare_title(self, title):
        prepared = self.flow.prepare(self.page['id'], 'thread-a',
            principal_id=human_id(self.home), display_title=title)
        self.run, self.prompt = prepared['run'], prepared['prompt']
        self.origin = dict(session_id='thread-a', task_id='same-session-task', turn_id='turn-'+self.run['id'])
        self.flow.pre(**self.origin, user_message=self.prompt)
        return prepared

    def save_public_reply(self):
        args = {'run_id': self.run['id'], 'edits': [], 'replies': self.proposal()['replies']}
        token = set_hermes_home_override(self.home)
        try:
            modified = public_plugin.pre_tool_hook(tool_name='workspace_apply', args=args,
                tool_call_id='public-call', **self.origin)
            self.assertEqual(modified['action'], 'modify')
            result = json.loads(public_plugin.apply_tool(modified['args'], session_id='thread-a', task_id='same-session-task'))
            self.assertNotIn('error', result, result)
        finally:
            reset_hermes_home_override(token)
        return self.store.snapshot()['comments'][0]['replies'][-1]

    def test_friendly_title_is_captured_and_later_ambient_profile_cannot_relabel_reply(self):
        self.prepare_title('Aster Ω 👩\u200d🔬')
        token = set_hermes_home_override(self.home.parent / 'ambient-other')
        try:
            # Public dispatch resolves the admitted home independently of this ambient selection.
            reply = self.save_public_reply()
        finally:
            reset_hermes_home_override(token)
        self.assertEqual(reply['author'], 'agent')
        self.assertEqual(reply['author_identity']['name'], 'Aster Ω 👩\u200d🔬')
        expected = executor(self.home, 'Aster Ω 👩\u200d🔬')
        self.assertEqual(reply['author_identity'], expected)
        self.assertEqual(expected['source_id'], human_id(self.home))
        self.assertEqual(expected['profile'], 'alpha')

    def test_missing_invalid_or_invisible_title_uses_exact_canonical_profile(self):
        for value in [None, '', ' ', [], {'kind': 'human'}, 'x'*4097, 'bad\nname', 'bad\u202ename']:
            with self.subTest(value=str(value)[:30]):
                self.assertEqual(executor(self.home, value)['name'], 'alpha')

    def test_label_is_literal_and_cannot_change_identity_origin_scope_or_permissions(self):
        label = '<img src=x onerror=alert(1)> human admin beta'
        self.prepare_title(label)
        before = self.store.snapshot()
        reply = self.save_public_reply()
        canonical = executor(self.home)
        actual = reply['author_identity']
        self.assertEqual(actual['name'], label)
        self.assertEqual({k:v for k,v in actual.items() if k!='name'}, {k:v for k,v in canonical.items() if k!='name'})
        self.assertEqual(reply['author'], 'agent')
        after = self.store.snapshot()
        self.assertEqual(before['scope_id'], after['scope_id'])
        self.assertEqual(before['items'], after['items'])
        self.assertFalse(after['comments'][0]['resolved'])
        with self.assertRaises(TypeError):
            self.flow.prepare(self.other['id'], 'thread-b', principal_id='actor', author_identity={'kind':'human'})
