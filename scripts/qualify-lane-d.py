#!/usr/bin/env python3
"""Lane D offline qualification: fresh output, private home, immutable inputs.

Run this exact launcher through the native approval boundary when required.
It never installs dependencies or retries a denied sandbox through another route.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--label', required=True)
    parser.add_argument('--host', type=Path, required=True)
    parser.add_argument('--venv', type=Path, required=True)
    parser.add_argument('--toolchain', type=Path)
    parser.add_argument('--frontend-probe', type=Path)
    parser.add_argument('--pytest', action='store_true')
    parser.add_argument('tests', nargs='*')
    args = parser.parse_args()
    if not args.label.replace('-', '').replace('_', '').isalnum():
        parser.error('label must be an ordinary filename')
    root = Path(__file__).resolve().parents[1]
    out = root / '.local/lane-d' / args.label
    out.mkdir(parents=True, exist_ok=False)
    for name in ('runtime', 'home', 'tmp'):
        (out / name).mkdir(mode=0o700)
    (out / 'runtime/workflow/tmp').mkdir(parents=True)
    def inventory():
        source = [p for d in ('workspace_plugin', 'dashboard', 'frontend', 'tests', 'scripts')
                  for p in (root / d).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
        source += [root / '__init__.py', root / 'plugin.yaml']
        return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(source)}
    before = inventory()
    argv = ['/usr/sbin/bwrap', '--unshare-all', '--die-with-parent', '--new-session',
            '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin',
            '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib', '/lib64',
            '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
            '--ro-bind', str(root), '/work', '--ro-bind', str(args.host.resolve()), '/host',
            '--ro-bind', str(args.venv.resolve()), '/venv',
            '--bind', str(out), '/out', '--bind', str(out / 'runtime'), '/work/.local',
            '--bind', str(out / 'home'), '/home/synthetic']
    if args.toolchain:
        argv += ['--ro-bind', str(args.toolchain.resolve()), '/work/.local/toolchain']
    argv += ['--chdir', '/work', '--clearenv',
            '--setenv', 'PATH', '/work/.local/toolchain/node-v26.0.0-linux-x64/bin:/venv/bin:/usr/bin', '--setenv', 'HOME', '/home/synthetic',
            '--setenv', 'HERMES_HOME', '/home/synthetic/hermes', '--setenv', 'TMPDIR', '/out/tmp',
            '--setenv', 'PYTHONPATH', '/work:/work/tests:/host',
            '--setenv', 'PYTHONDONTWRITEBYTECODE', '1', '--setenv', 'PYTHONUNBUFFERED', '1',
            '/venv/bin/python', '-c',
            'import faulthandler,unittest; faulthandler.dump_traceback_later(120,repeat=True); unittest.main(module=None)',
            '-v', *args.tests]
    if args.frontend_probe:
        if args.toolchain is None:
            parser.error('frontend probe needs the read-only pinned Node toolchain')
        # The probe itself is lane-owned ignored source, mounted read-only with
        # the checkout. Its generated files belong only to the fresh output.
        args.frontend_probe.resolve().relative_to(root)
        argv[argv.index('--chdir'):argv.index('--chdir')] = ['--ro-bind', str(args.frontend_probe.resolve()), '/probe.mjs']
        argv = argv[:argv.index('/venv/bin/python')]
        argv += ['/work/.local/toolchain/node-v26.0.0-linux-x64/bin/node', '/probe.mjs']
    elif not args.tests:
        parser.error('choose explicit unittest modules or a frontend probe')
    elif args.pytest:
        argv = argv[:argv.index('/venv/bin/python')] + ['/venv/bin/python', '-m', 'pytest', '-q', '--noconftest', *args.tests]
    receipt = {'started_at': datetime.now(timezone.utc).isoformat(), 'argv': argv,
               'source_before': before, 'host': str(args.host.resolve()), 'venv': str(args.venv.resolve())}
    (out / 'started.json').write_text(json.dumps(receipt, indent=2) + '\n')
    started = time.monotonic()
    with (out / 'output.log').open('x') as log:
        child = subprocess.Popen(argv, stdout=log, stderr=subprocess.STDOUT)
        try:
            code = child.wait(timeout=900)
        except (subprocess.TimeoutExpired, KeyboardInterrupt) as exc:
            receipt['interruption'] = type(exc).__name__
            child.terminate()
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
            code = 130 if isinstance(exc, KeyboardInterrupt) else 124
    receipt.update(exit=code, duration_seconds=time.monotonic()-started, source_after=inventory())
    receipt['source_unchanged'] = receipt['source_before'] == receipt['source_after']
    (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('\n'.join((out / 'output.log').read_text().splitlines()[-(60 if code else 12):]))
    print(json.dumps({'exit': code, 'receipt': str(out / 'receipt.json'),
                      'source_unchanged': receipt['source_unchanged']}))
    return code


if __name__ == '__main__':
    sys.exit(main())
