"""Same maintained outer/natural cases through a real isolated PluginHost.

Only this fixture's synthetic profile selects the advertised host carrier. No
live config, parent policy, provider or permission setting is modified.
"""
import json
import os
import test_public_outer_executor as outer


class PublicIsolatedHostTests(outer.PublicOuterExecutorTests):
    plugin_isolation = 'host'

    def setUp(self):
        super().setUp()
        # Prove actual child transport, not an admission host_ready classification.
        host=self.manager._plugin_host_instance
        self.assertIsNotNone(host._proc)
        self.assertIsNone(host._proc.poll())
        self.assertNotEqual(host._proc.pid,os.getpid())
        self.assertTrue(host.info, 'Actual PluginHost handshake was received')

    def test_actual_host_handler_independently_refuses_missing_forged_and_revoked_ticket(self):
        from tools.registry import registry
        from hermes_cli.plugins import _dispatch_pre_tool_call_hooks
        self.turn()
        handler=registry.get_entry('workspace_apply').handler
        args={'run_id':self.run['id'],'edits':self.proposal()['edits'],'replies':self.proposal()['replies']}
        before=self.store.backup_snapshot()
        for value in [args,{**args,'_workspace_call':'forged'}]:
            result=json.loads(handler(value,session_id='thread-a',task_id='session-scoped-task'))
            self.assertIn('error',result,result)
            self.assertEqual(self.store.backup_snapshot(),before)
        blocked,modified=_dispatch_pre_tool_call_hooks('workspace_apply',args,**self.origin,tool_call_id='host-unused')
        self.assertIsNone(blocked);self.assertIsNotNone(modified)
        self.flow.stop(self.run['id']);stopped=self.store.backup_snapshot()
        self.assertIn('error',json.loads(handler(modified,session_id='thread-a',task_id='session-scoped-task')))
        self.assertEqual(self.store.backup_snapshot(),stopped)
