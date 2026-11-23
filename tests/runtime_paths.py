"""Generated test state stays in the caller's isolated runtime namespace."""
import os
from pathlib import Path
import shutil
import tempfile


def fixture_root(name):
    root = Path(os.environ.get('HWS_QUALIFICATION_HOME', tempfile.gettempdir())) / name
    root.mkdir(parents=True, exist_ok=True)
    return root


def node_command():
    command = os.environ.get('HWS_NODE') or shutil.which('node')
    if not command or not Path(command).is_file():
        raise RuntimeError('A provisioned Node26 interpreter is required')
    return Path(command)
