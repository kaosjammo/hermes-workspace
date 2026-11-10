#!/usr/bin/env python3
"""Test interpreter shim: preserve the canonical runner, put its scratch in .local.

run_tests.sh intentionally clears TMPDIR and its Python runner selects /var/tmp.
The build authority instead requires project-owned fixtures. This explicit test
variant changes only the runner's scratch-root function, never upstream source.
"""
import importlib.util
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / '.local/native-tests-venv/bin/python'
RUNNER = ROOT / '.local/host/scripts/run_tests_parallel.py'
args = sys.argv[1:]
if Path(sys.executable).absolute() != PYTHON:
    os.execv(PYTHON, [str(PYTHON), __file__, *args])
if args and Path(args[0]).resolve() == RUNNER:
    spec = importlib.util.spec_from_file_location('workspace_upstream_runner', RUNNER)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    scratch = ROOT / '.local/t'
    scratch.mkdir(mode=0o700, exist_ok=True)
    module._runner_scratch_root = lambda: str(scratch)
    sys.argv = [str(RUNNER), *args[1:]]
    raise SystemExit(module.main())
os.execv(PYTHON, [str(PYTHON), *args])
