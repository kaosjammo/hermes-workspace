"""Finite editor-lane checks with argv, exits and source-bound receipts.

Uses declared pinned development dependencies read-only. Does not install,
package, edit another lane, run a native provider, or claim native acceptance.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--node', required=True)
parser.add_argument('--python', required=True)
parser.add_argument('--backend-source', type=Path)
args = parser.parse_args()
OUT = ROOT / '.local/lane-c/evidence' / ('qualification-' + str(time.time_ns()))
OUT.mkdir(parents=True, exist_ok=True)
print('Evidence directory:', OUT, flush=True)
receipt = {'scope': 'Local source/DOM/interchange only; browser receipt separate; native UNRUN',
           'commands': [], 'source_sha256': {}, 'started': time.time()}
env = {key: value for key, value in os.environ.items() if key in {
    'PATH', 'LANG', 'TMPDIR', 'HWS_QUALIFICATION_HOME'}}
env['PYTHONDONTWRITEBYTECODE'] = '1'
if args.backend_source:
    backend = args.backend_source.resolve(strict=True)
    env['PYTHONPATH'] = str(backend)
    receipt['backend_source'] = str(backend)
    receipt['backend_sha256'] = {name: hashlib.sha256((backend / 'workspace_plugin' / name).read_bytes()).hexdigest()
                                 for name in ['store.py', 'interchange.py']}


def run(name, argv):
    result = subprocess.run(argv, cwd=ROOT, env=env, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60)
    (OUT / (name + '.log')).write_text(result.stdout)
    receipt['commands'].append({'name': name, 'argv': argv, 'cwd': str(ROOT),
                                'exit': result.returncode, 'log': name + '.log'})
    (OUT / 'RESULT.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(name, 'exit', result.returncode, flush=True)
    return result.returncode == 0


ok = run('node-version', [args.node, '--version'])
ok &= run('build-runtime', [args.node, 'tests/ui/build-runtime.mjs'])
ok &= run('build-native-runtime', [args.node, 'tests/ui/build-native-runtime.mjs'])
for suite in ['lane-c', 'repair1-native', 'repair2-editor', 'repair3-editor',
              'ui-overhaul-anchors', 'ui-overhaul-recovery', 'repair3-restore-ui', 'rendered']:
    ok &= run(suite, [args.node, '--test', '--test-isolation=none', '--test-reporter=tap',
                      '--test-force-exit', f'tests/ui/{suite}.test.mjs'])
if args.backend_source:
    # Load this lane's tests, with backend imports/subprocesses bound to the
    # immutable foreign-lane snapshot. Bytecode is disabled; no foreign writes.
    script = "import importlib.util,sys,unittest;sys.path.insert(0,sys.argv[1]);s=importlib.util.spec_from_file_location('lane_c_interchange',sys.argv[2]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(m));raise SystemExit(not r.wasSuccessful())"
    ok &= run('interchange', [args.python, '-c', script, str(backend), str(ROOT / 'tests/test_interchange.py')])
else:
    ok &= run('interchange', [args.python, '-m', 'unittest', 'tests.test_interchange', '-v'])
for relative in ['frontend/rich-editor.jsx', 'frontend/editor-styles.mjs',
                 'frontend/editor-commands.mjs', 'frontend/editor.mjs',
                 'frontend/comment-highlights.jsx', 'tests/ui/lane-c.test.mjs',
                 'tests/ui/lane-c-entry.jsx', 'tests/test_interchange.py', 'scripts/qualify-lane-c.py']:
    receipt['source_sha256'][relative] = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
receipt.update(status='PASS' if ok else 'FAIL', finished=time.time(),
               engine_note='package.json requires Node >=26; selected runtime is recorded, not silently promoted')
(OUT / 'RESULT.json').write_text(json.dumps(receipt, indent=2) + '\n')
raise SystemExit(0 if ok else 1)
