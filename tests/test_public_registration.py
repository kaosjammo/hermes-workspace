"""Production plugin registration and independent tool-handler refusal."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest


class PublicRegistration(unittest.TestCase):
    def test_production_entry_registers_the_public_turn_tool_and_terminal_boundaries(self):
        root = Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location('workspace_registration_candidate', root/'__init__.py', submodule_search_locations=[str(root)])
        plugin = importlib.util.module_from_spec(spec); sys.modules[spec.name] = plugin
        spec.loader.exec_module(plugin)
        hooks = {}; handlers = {}
        class Context:
            def register_hook(self, name, callback): hooks[name] = callback
            def register_tool(self, **kw): handlers[kw['name']] = kw['handler']
        plugin.register(Context())
        self.assertEqual(set(hooks), {'pre_llm_call','pre_tool_call','post_llm_call','on_session_end'})
        result = json.loads(handlers['workspace_apply']({'run_id':'copied','edits':[],'replies':[]}, session_id='synthetic',task_id='same-native-task'))
        self.assertIn('error', result, 'a direct handler call without a hook ticket must fail independently')
