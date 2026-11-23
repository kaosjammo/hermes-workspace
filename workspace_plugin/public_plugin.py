"""Hermes public registration/handler boundary; no client-supplied native identity."""
import json
from pathlib import Path
from .public_runs import PublicRuns
from .tool_contract import TOOL_SCHEMA


def _flow():
    from hermes_constants import get_hermes_home
    return PublicRuns(Path(get_hermes_home()).resolve())


def apply_tool(args, *, session_id=None, task_id=None, **_):
    try:
        return json.dumps({'result': _flow().apply_call(args, session_id=session_id, task_id=task_id)}, allow_nan=False)
    except (ValueError, TypeError, KeyError, OverflowError, RecursionError) as exc:
        return json.dumps({'error': str(exc)})


def pre_hook(**payload):
    try:
        _flow().pre(**payload)
    except (ValueError, TypeError, KeyError):
        # Native hooks are fail-open. No binding means the independent handler
        # and terminal paths cannot authorise a save.
        return None


def pre_tool_hook(tool_name=None, **payload):
    if tool_name != 'workspace_apply':
        return None
    try:
        return _flow().pre_tool(tool_name=tool_name, **payload)
    except (ValueError, TypeError, KeyError, OverflowError, RecursionError) as exc:
        return {'action': 'block', 'message': str(exc)}


def post_hook(**payload):
    try:
        return _flow().post(**payload)
    except (ValueError, TypeError, KeyError):
        return {'observed': False, 'commit_authority': False}


def end_hook(**payload):
    try:
        return _flow().end(**payload)
    except (ValueError, TypeError, KeyError):
        # Reduced exit callbacks and missing identity/outcomes stay UNKNOWN.
        # Explicit Recover revokes/unlocks without inventing native success.
        return {'completed': False, 'native_terminal': 'UNKNOWN'}


def register(ctx):
    ctx.register_tool(name='workspace_apply', toolset='workspace', schema=TOOL_SCHEMA,
        handler=apply_tool, description='Scoped Workspace edits and comment outcomes', emoji='🗂️')
    ctx.register_hook('pre_llm_call', pre_hook)
    ctx.register_hook('pre_tool_call', pre_tool_hook)
    ctx.register_hook('post_llm_call', post_hook)
    ctx.register_hook('on_session_end', end_hook)
