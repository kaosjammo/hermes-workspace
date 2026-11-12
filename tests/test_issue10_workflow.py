"""Production public Workflow, immutable author capture and local Stop fencing."""
import unittest
from test_public_runs import PublicRunsFixture
from workspace_plugin.identity import human_id


class ExecutingIdentityTests(PublicRunsFixture, unittest.TestCase):
    def test_queued_author_capture_survives_later_metadata_and_stop_keeps_fences(self):
        prepared = self.flow.prepare(self.page['id'], 'thread-a',
            principal_id=human_id(self.home), display_title='Recorded Aster')
        run = prepared['run']; origin = dict(session_id='thread-a', task_id='session-task', turn_id='native-turn')
        args = {'run_id':run['id'], 'edits':[], 'replies':[{'comment_id':c['id'], 'text':'Actual admitted synthetic outcome'} for c in self.comments]}
        before = self.store.backup_snapshot()
        with self.assertRaises(ValueError):
            self.flow.apply_call(args, session_id='thread-a', task_id='session-task')
        self.assertEqual(self.store.backup_snapshot(), before)
        self.flow.pre(**origin, user_message=prepared['prompt'])
        modified = self.flow.pre_tool(tool_name='workspace_apply', args=args, tool_call_id='call-one', **origin)['args']
        self.flow.apply_call(modified, session_id='thread-a', task_id='session-task')
        reply = self.store.snapshot()['comments'][0]['replies'][0]
        self.assertEqual(reply['author_identity']['name'], 'Recorded Aster')
        self.assertEqual(reply['author_identity']['profile'], 'alpha')
        self.assertEqual(reply['author'], 'agent')
        pending = self.flow.pre_tool(tool_name='workspace_apply', args=args, tool_call_id='call-two', **origin)['args']
        self.flow.stop(run['id']); before = self.store.backup_snapshot()
        with self.assertRaises(ValueError):
            self.flow.apply_call(pending, session_id='thread-a', task_id='session-task')
        self.assertEqual(self.store.backup_snapshot(), before)
        self.assertEqual(self.store.snapshot()['comments'][0]['replies'][0], reply)
