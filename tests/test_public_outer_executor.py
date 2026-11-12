"""Synthetic provider-free qualification of the real reference host loader/executor.

This is NOT minimum-release, native Desktop or provider acceptance. The source
checkout reports version unknown; no version, permissions or isolation override.
"""
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import unittest
from hermes_constants import set_hermes_home_override, reset_hermes_home_override
from test_public_runs import PublicRunsFixture


class PublicOuterExecutorTests(PublicRunsFixture, unittest.TestCase):
    plugin_isolation = 'in_process'
    def setUp(self):
        super().setUp()
        self.home_token = set_hermes_home_override(self.home)
        self.addCleanup(reset_hermes_home_override, self.home_token)
        (self.home/'plugins').mkdir()
        (self.home/'plugins'/'workspace').symlink_to(Path(__file__).resolve().parents[1], target_is_directory=True)
        (self.home/'config.yaml').write_text('plugins:\n  enabled: [workspace]\n  isolation: '+self.plugin_isolation+'\n')
        from hermes_cli.plugins import get_plugin_manager
        self.manager = get_plugin_manager()
        self.manager.discover_and_load()
        loaded = next(p for p in self.manager.list_plugins() if p['name']=='workspace')
        self.assertTrue(loaded['enabled'], loaded)
        self.assertFalse(loaded.get('error'), loaded)
        from run_agent import AIAgent
        # Synthetic provider bootstrap only: no hook, registry, permission,
        # guardrail or tool dispatcher is replaced. No provider request occurs.
        with patch('agent.process_bootstrap.OpenAI'):
            self.agent = AIAgent(api_key='synthetic-not-a-credential', base_url='https://provider.invalid/v1',
                enabled_toolsets=['workspace'], quiet_mode=True, skip_context_files=True,
                skip_memory=True, platform='desktop', session_id='thread-a')
        self.agent.save_trajectories = False

    def tearDown(self):
        # Host test-isolation helper drains queued file writes before deleting
        # the synthetic home. It changes no production logger or configuration.
        self.manager.unload()
        from hermes_logging import _reset_queued_handlers
        _reset_queued_handlers()
        super().tearDown()

    def turn(self):
        self.prepare()
        self.origin['task_id'] = 'session-scoped-task'
        self.agent._current_turn_id = self.origin['turn_id']
        from hermes_cli.plugins import invoke_hook
        invoke_hook('pre_llm_call', **self.origin, user_message=self.prompt)

    def dispatch(self, *, call_id='outer-one', args=None):
        from agent.tool_executor import _execute_tool_calls_sequential
        operation = args or {'run_id':self.run['id'], 'edits':self.proposal()['edits'], 'replies':self.proposal()['replies']}
        tool = SimpleNamespace(id=call_id, type='function', function=SimpleNamespace(name='workspace_apply', arguments=json.dumps(operation)))
        messages = []
        _execute_tool_calls_sequential(self.agent, SimpleNamespace(tool_calls=[tool]), messages, 'session-scoped-task')
        self.assertEqual(len(messages), 1, messages)
        return messages[0]['content']

    def test_real_loader_outer_hook_modification_registry_handler_and_terminal_hook_save(self):
        self.turn()
        result = self.dispatch()
        self.assertNotIn('error', json.loads(result), result)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p>')
        from hermes_cli.plugins import invoke_hook
        invoke_hook('post_llm_call', **self.origin, user_message=self.prompt, assistant_response='Saved all outcomes.')
        invoke_hook('on_session_end', **self.origin, completed=True, interrupted=False, failed=False,
                    turn_exit_reason='text_response(finish_reason=stop)')
        self.assertEqual(self.flow.status(self.run['id'])['run']['status'], 'completed')

    def test_same_task_different_turn_is_blocked_by_normal_outer_executor(self):
        self.turn(); self.agent._current_turn_id = 'stale-turn'
        before = self.store.backup_snapshot()
        result = self.dispatch()
        self.assertIn('error', json.loads(result), result)
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_stop_revocation_refuses_normal_outer_tool_without_weakening_host_scope(self):
        self.turn(); self.flow.stop(self.run['id']); before = self.store.backup_snapshot()
        result = self.dispatch()
        self.assertIn('error', json.loads(result), result)
        self.assertEqual(self.store.backup_snapshot(), before)

    def compress_current_turn(self):
        self.db.publish_compression_child(parent_session_id='thread-a', child_session_id='outer-compressed', source='local',
            messages=[{'role':'user','content':'Synthetic compressed context'}], require_compression_lease=False)
        self.agent.session_id = 'outer-compressed'
        self.assertEqual(self.flow.native.require_session(self.agent.session_id), 'thread-a')

    def finish_compressed_turn(self):
        from hermes_cli.plugins import invoke_hook
        origin = {**self.origin, 'session_id':self.agent.session_id}
        # These are explicit public boundary calls, not natural delivery proof.
        invoke_hook('post_llm_call', **origin, user_message=self.prompt, assistant_response='Saved outcomes.')
        invoke_hook('on_session_end', **origin, completed=True, interrupted=False, failed=False,
            turn_exit_reason='text_response(finish_reason=stop)')
        self.assertEqual(self.flow.status(self.run['id'])['run']['status'], 'completed')

    def test_registered_outer_tool_accepts_compression_before_first_direct_call_and_restore(self):
        self.turn(); self.compress_current_turn()
        result = self.dispatch()
        self.assertNotIn('error', json.loads(result), result)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p>')
        self.assertEqual(len(self.store.snapshot()['runs'][0]['operation_receipts']), 1)
        self.finish_compressed_turn()
        self.store.execute('restore_version', {'id':self.run['version_ids'][0]})
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')

    def test_registered_outer_tool_accepts_compression_between_two_direct_calls(self):
        self.turn(); first = self.dispatch()
        self.assertNotIn('error', json.loads(first), first)
        self.compress_current_turn()
        args = {'run_id':self.run['id'], 'edits':[{'item_id':self.page['id'], 'patch':{'content':'<p>Second accepted edit.</p>'}}],
                'replies':self.proposal()['replies']}
        second = self.dispatch(call_id='outer-two', args=args)
        self.assertNotIn('error', json.loads(second), second)
        state = self.store.snapshot()
        self.assertEqual(state['items'][0]['content'], '<p>Second accepted edit.</p>')
        self.assertEqual(len(state['runs'][0]['operation_receipts']), 2)
        self.finish_compressed_turn()

    def test_normal_conversation_lifecycle_binds_saves_and_finalizes_without_manual_hook_delivery(self):
        self.prepare()
        args = {'run_id':self.run['id'], 'edits':self.proposal()['edits'], 'replies':self.proposal()['replies']}
        # Follow the host's advertised deferred-tool contract. Calling the
        # underlying name directly is correctly rejected by normal tool scope.
        call = SimpleNamespace(id='normal-outer-call', type='function',
            function=SimpleNamespace(name='tool_call', arguments=json.dumps(
                {'calls':[{'name':'workspace_apply','arguments':args}]})))
        def response(text, reason, calls=None):
            return SimpleNamespace(choices=[SimpleNamespace(finish_reason=reason,
                message=SimpleNamespace(content=text, tool_calls=calls))], model=self.agent.model, usage=None)
        self.agent.client = MagicMock()
        self.agent.client.chat.completions.create.side_effect = [
            response('', 'tool_calls', [call]), response('Saved concise per-comment outcomes.', 'stop')]
        self.agent._cached_system_prompt = 'Synthetic Workspace qualification.'
        self.agent._use_prompt_caching = False
        self.agent.compression_enabled = False
        result = self.agent.run_conversation(self.prompt, task_id='session-scoped-task')
        # Retain the real naturally delivered result/context when this boundary
        # fails; all content is this test's synthetic profile and document.
        import os
        import uuid
        with self.store.atomic() as conn:
            context = json.loads(conn.execute('SELECT body FROM run_context WHERE run_id=?', (self.run['id'],)).fetchone()[0])
        observation = Path(os.environ['HWS_QUALIFICATION_HOME'])/('natural-turn-'+uuid.uuid4().hex+'.json')
        observation.write_text(
            json.dumps({'result':result,'context':context},indent=2,default=str)+'\n')
        print('NATURAL_TURN_OBSERVATION', observation)
        self.assertEqual(self.agent.client.chat.completions.create.call_count, 2, result)
        advertised = self.agent.client.chat.completions.create.call_args_list[0].kwargs['tools']
        self.assertIn('tool_call', {tool['function']['name'] for tool in advertised})
        self.assertEqual(result['turn_exit_reason'], 'text_response(finish_reason=stop)', result)
        tool_messages = [m for m in result['messages'] if m.get('role') == 'tool']
        self.assertEqual(len(tool_messages), 1, result)
        self.assertNotIn('error', json.loads(tool_messages[0]['content']), tool_messages)
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p>')
        self.assertEqual(self.flow.status(self.run['id'])['run']['status'], 'completed')
        self.assertTrue(all(not c['resolved'] for c in self.store.snapshot()['comments'] if c['id'] in self.run['comment_ids']))
        self.store.execute('restore_version', {'id':self.run['version_ids'][0]})
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>Before.</p>')
        again = self.flow.prepare(self.page['id'], 'thread-a', principal_id='synthetic-profile-owner')
        self.assertEqual(again['run']['session_id'], self.run['session_id'])
        self.assertEqual(again['run']['comment_ids'], self.run['comment_ids'])
        repeat = SimpleNamespace(id='normal-repeat-call', type='function', function=SimpleNamespace(name='tool_call',
            arguments=json.dumps({'calls':[{'name':'workspace_apply','arguments':{**args,'run_id':again['run']['id']}}]})))
        self.agent.client.chat.completions.create.side_effect = [response('', 'tool_calls', [repeat]), response('Second run outcomes saved.', 'stop')]
        second = self.agent.run_conversation(again['prompt'], task_id='session-scoped-task')
        self.assertEqual(second['turn_exit_reason'], 'text_response(finish_reason=stop)', second)
        self.assertEqual(self.flow.status(again['run']['id'])['run']['status'], 'completed')
        self.assertEqual(self.store.snapshot()['items'][0]['content'], '<p>After.</p>')

    def natural_terminal_case(self, *, reason='stop', interrupt=False, provider_failure=False):
        self.prepare()
        args = {'run_id':self.run['id'], 'edits':self.proposal()['edits'], 'replies':self.proposal()['replies']}
        call = SimpleNamespace(id='normal-terminal-call',type='function',function=SimpleNamespace(name='tool_call',
            arguments=json.dumps({'calls':[{'name':'workspace_apply','arguments':args}]})))
        def response(text, finish, calls=None):
            return SimpleNamespace(choices=[SimpleNamespace(finish_reason=finish,
                message=SimpleNamespace(content=text,tool_calls=calls))],model=self.agent.model,usage=None)
        # Length is a native continuation request, not an immediate terminal.
        # Supply the full bounded continuation sequence; do not accidentally
        # test exhaustion of the provider fixture's iterator instead.
        responses = iter([response('', 'tool_calls', [call])] +
                         [response('Terminal response data.', reason) for _ in range(8)])
        request_count = 0
        def create(**kwargs):
            nonlocal request_count
            request_count += 1
            if interrupt: self.agent.interrupt()
            if provider_failure and request_count > 1:
                raise RuntimeError('Synthetic provider failure after accepted work')
            return next(responses)
        self.agent.client = MagicMock()
        self.agent.client.chat.completions.create.side_effect = create
        self.agent._cached_system_prompt = 'Synthetic terminal qualification.'
        self.agent._use_prompt_caching = False
        self.agent.compression_enabled = False
        return self.agent.run_conversation(self.prompt,task_id='session-scoped-task')

    def test_natural_interrupt_before_tool_effect_finalizes_cancelled_without_manual_hooks(self):
        result = self.natural_terminal_case(interrupt=True)
        self.assertTrue(result['interrupted'], result)
        self.assertEqual(self.flow.status(self.run['id'])['run']['status'],'cancelled')
        self.assertEqual(self.store.snapshot()['items'][0]['content'],'<p>Before.</p>')
        self.assertTrue(self.store.snapshot()['versions'])

    def test_natural_partial_exit_without_terminal_hook_requires_explicit_recovery(self):
        result = self.natural_terminal_case(reason='length')
        self.assertFalse(result['completed'], result)
        self.assertTrue(result['partial'], result)
        self.assertIn('error', result)
        # Released 0.23 truncation returns a partial result before the ordinary
        # finalizer/on_session_end. No plugin may infer success from that gap.
        state = self.flow.status(self.run['id'])
        self.assertEqual(state['run']['status'],'running')
        self.assertEqual(state['native_terminal'],'UNKNOWN')
        self.assertEqual(self.store.snapshot()['items'][0]['content'],'<p>After.</p>')
        recovered = self.flow.recover(self.run['id'])
        self.assertEqual(recovered['run']['status'],'error')
        self.assertEqual(recovered['native_terminal'],'UNKNOWN')
        self.store.execute('restore_version', {'id':self.run['version_ids'][0]})
        self.assertEqual(self.store.snapshot()['items'][0]['content'],'<p>Before.</p>')

    def test_natural_provider_failure_preserves_partial_work_and_honest_recovery(self):
        result = self.natural_terminal_case(provider_failure=True)
        self.assertFalse(result['completed'], result)
        self.assertTrue(result['failed'], result)
        self.assertIn('Synthetic provider failure after accepted work',result['error'])
        state = self.flow.status(self.run['id'])
        self.assertEqual(state['run']['status'],'running')
        self.assertEqual(state['native_terminal'],'UNKNOWN')
        self.assertEqual(self.store.snapshot()['items'][0]['content'],'<p>After.</p>')
        recovered = self.flow.recover(self.run['id'])
        self.assertEqual(recovered['run']['status'],'error')
        self.assertEqual(recovered['native_terminal'],'UNKNOWN')
        self.store.execute('restore_version', {'id':self.run['version_ids'][0]})
        self.assertEqual(self.store.snapshot()['items'][0]['content'],'<p>Before.</p>')
