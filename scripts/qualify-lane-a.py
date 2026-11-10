"""One isolated, source-read-only Lane A qualification operation.

No installation or network sharing. The outer invocation needs its own native
approval. Public pinned dependencies are mounted read-only; only --output is
writable. This fixture never runs a provider or a native gateway.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = Path('/home/mike/projects/hermes-workspace/.local/worktrees/ui-overhaul/.local')
PLAYWRIGHT = Path('/home/mike/.cache/codex-runtimes/codex-primary-runtime/dependencies/node')
CHROMIUM = Path('/home/mike/.cache/ms-playwright/chromium-1234')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=['baseline', 'changed', 'regression', 'keyboard', 'workflows', 'editor', 'resources', 'resources-diagnose', 'resources-workspace', 'wide', 'database', 'database-context', 'council-smoke', 'review23', 'review24', 'review25', 'review26', 'review27','comment-fixes'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--inside', action='store_true')
    args = parser.parse_args()
    out = args.output.resolve()
    if not out.is_relative_to(ROOT / '.local/lane-a'):
        raise SystemExit('Output must be a new lane-owned .local/lane-a directory')
    if args.inside:
        if not Path.home().samefile(out / 'home') or os.environ.get('LANE_A_ISOLATED') != '1':
            raise SystemExit('Requires the declared private home and namespace')
        node = PUBLIC / 'toolchain/node-v26.0.0-linux-x64/bin/node'
        if args.phase == 'regression':
            command = [str(node), '--test', 'tests/ui/client.test.mjs',
                       'tests/ui/repair3-restore.test.mjs', 'tests/ui/repair2-file-limits.test.mjs']
            with (out / 'regression.log').open('w') as log:
                result = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=120)
            (out / 'RESULT.json').write_text(json.dumps({'argv': command, 'exit': result.returncode}) + '\n')
        else:
            command = [str(node), 'tests/ui/lane-a.test.mjs', args.phase, str(out), str(PUBLIC)]
            result = subprocess.run(command, cwd=ROOT, timeout=480)
        raise SystemExit(result.returncode)
    if out.exists():
        raise SystemExit('Fresh output required; previous failures are immutable')
    required = [PUBLIC / part for part in ['toolchain', 'host', 'native-venv', 'qualification-venv']]
    required += [PLAYWRIGHT, CHROMIUM]
    for path in required:
        if not path.exists():
            raise SystemExit(f'Missing read-only provisioning: {path}')
    for name in ['home', 'tmp', 'cache', 'runtime']:
        (out / name).mkdir(parents=True, exist_ok=True)
    if args.phase == 'baseline':
        # Freeze only public frontend source from the acknowledged checkpoint;
        # no ignored runtime/private/history material is copied.
        commit = 'cba527e538e36af4d952560eb746083f6607ee53'
        names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', commit, 'frontend'], cwd=ROOT, text=True).splitlines()
        for name in names:
            target = out / 'baseline-source' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(subprocess.check_output(['git', 'show', f'{commit}:{name}'], cwd=ROOT))
    argv = ['/usr/sbin/bwrap', '--die-with-parent', '--unshare-all',
            '--ro-bind', '/usr', '/usr', '--ro-bind', '/etc', '/etc',
            '--symlink', 'usr/bin', '/bin', '--symlink', 'usr/lib', '/lib',
            '--symlink', 'usr/lib', '/lib64', '--proc', '/proc', '--dev', '/dev',
            '--dir', '/home/mike', '--bind', str(out / 'home'), '/home/mike',
            '--ro-bind', str(ROOT), str(ROOT), '--bind', str(out), str(out),
            '--bind', str(out / 'tmp'), '/tmp']
    for path in required:
        argv += ['--ro-bind', str(path), str(path)]
    env = {
        'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'LANE_A_ISOLATED': '1',
        'HERMES_HOME': str(out / 'home/.hermes'),
        'HERMES_RUNTIME_DIR': str(out / 'runtime'), 'XDG_CACHE_HOME': str(out / 'cache'),
        'TMPDIR': '/tmp', 'PYTHONDONTWRITEBYTECODE': '1',
        'PYTHONPATH': ':'.join(map(str, [ROOT, PUBLIC / 'host',
            PUBLIC / 'native-venv/lib/python3.14/site-packages',
            PUBLIC / 'qualification-venv/lib/python3.14/site-packages'])),
    }
    argv += ['--chdir', str(ROOT), '--clearenv']
    for key, value in env.items():
        argv += ['--setenv', key, value]
    argv += ['/usr/bin/python3', str(Path(__file__).resolve()), '--inside',
             '--phase', args.phase, '--output', str(out)]
    invocation = {'argv': argv, 'phase': args.phase,
                  'source': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                             for directory in ['frontend', 'tests/ui', 'scripts']
                             for p in sorted((ROOT / directory).glob('*')) if p.is_file()},
                  'limits': 'Browser-hosted SDK with synthetic owner fixture, not native acceptance'}
    (out / 'INVOCATION.json').write_text(json.dumps(invocation, indent=2) + '\n')
    result = subprocess.run(argv, env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'}, timeout=540)
    after = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in invocation['source']}
    unchanged = after == invocation['source']
    (out / 'EXIT.json').write_text(json.dumps({'exit': result.returncode, 'source_unchanged': unchanged}) + '\n')
    if not unchanged:
        raise SystemExit('Source changed during qualification')
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
