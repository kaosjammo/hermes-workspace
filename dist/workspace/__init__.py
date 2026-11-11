"""Workspace unified Hermes plugin entrypoint (agent half).

Hermes loads this file as a synthetic package; relative imports preserve the
standalone layout under both the disk loader and unified plugin host.
"""
from .workspace_plugin.workflow import TOOL_SCHEMA, apply_tool
from .workspace_plugin.final_run import pre_hook, post_hook


def register(ctx):
    ctx.register_tool(name='workspace_apply', toolset='workspace', schema=TOOL_SCHEMA,
        handler=apply_tool, description='Scoped Workspace edits and comment outcomes', emoji='🗂️')
    ctx.register_hook('pre_llm_call', pre_hook)
    ctx.register_hook('post_llm_call', post_hook)
