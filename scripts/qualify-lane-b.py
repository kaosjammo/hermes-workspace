"""Lane B only: prepare one exact unshared/private-home/read-only qualification.

No installs, live host state or generated desktop/plugin.js writes. --prepare
writes only ignored evidence. --run executes the recorded bwrap argv; request a
separate exact native approval for each run. A denial is terminal for that run.
"""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import os
import shlex
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = Path('/home/mike/projects/hermes-workspace/.local/worktrees/ui-overhaul/.local')
TOOL = PUBLIC / 'toolchain'
HOST = PUBLIC / 'host/.build/webapp-workspace'
NODE = TOOL / 'node-v26.0.0-linux-x64/bin/node'
parser = argparse.ArgumentParser()
parser.add_argument('--prepare')
parser.add_argument('--run')
parser.add_argument('--inside')
args = parser.parse_args()

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

name = args.prepare or args.run or args.inside
if not name or not name.replace('-', '').isalnum():
    raise SystemExit('Choose a unique alphanumeric-hyphen evidence name.')
out = ROOT / '.local/lane-b' / name
if args.prepare:
    out.mkdir(parents=True, exist_ok=False)
    for folder in ['home', 'tmp']:
        (out / folder).mkdir()
    tracked = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines()
    extra = ['frontend/thread-picker.jsx', 'frontend/comment-styles.mjs', 'tests/ui/lane-b.test.mjs', 'tests/ui/lane-b-entry.jsx', 'scripts/qualify-lane-b.py']
    inputs = {n: sha(ROOT / n) for n in sorted(set(tracked + extra)) if (ROOT / n).is_file()}
    write(out / 'CANDIDATE.json', inputs)
    sdk = f'''export * from {json.dumps(str(ROOT / 'tests/ui/sdk-fixture.jsx'))};
import {{createElement as h}} from 'react';
export const Tip = ({{label,children}}) => h('span',{{'data-tip':label}},children);
'''
    (out / 'sdk.jsx').write_text(sdk)
    build = f'''import {{createRequire}} from 'node:module';
const require=createRequire({json.dumps(str(TOOL / 'package.json'))});
const {{build}}=require('esbuild');
await build({{entryPoints:[{json.dumps(str(ROOT / 'tests/ui/lane-b-entry.jsx'))}],bundle:true,platform:'node',format:'esm',jsx:'automatic',outfile:{json.dumps(str(out / 'runtime.mjs'))},banner:{{js:"import {{createRequire as laneBRequire}} from 'node:module'; const require=laneBRequire(import.meta.url);"}},alias:{{'@hermes/plugin-sdk':{json.dumps(str(out / 'sdk.jsx'))}}},plugins:[{{name:'normal-node-react',setup(b){{b.onResolve({{filter:/^(react|react-dom)(\\/.*)?$/}},a=>({{path:require.resolve(a.path),external:true}}));}}}}],define:{{'process.env.NODE_ENV':'"development"'}}}});
'''
    (out / 'build.mjs').write_text(build)
    argv = ['/usr/sbin/bwrap', '--die-with-parent', '--unshare-all',
            '--ro-bind', '/usr', '/usr', '--ro-bind', '/etc', '/etc',
            '--symlink', 'usr/bin', '/bin', '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib', '/lib64',
            '--proc', '/proc', '--dev', '/dev', '--dir', '/home/mike',
            '--bind', str(out / 'home'), '/home/mike',
            '--ro-bind', str(ROOT), str(ROOT), '--ro-bind', str(TOOL), str(TOOL),
            '--bind', str(out), str(out), '--bind', str(out / 'tmp'), '/tmp',
            '--chdir', str(ROOT), '--clearenv', '--setenv', 'PATH', '/usr/bin:/bin',
            '--setenv', 'LANG', 'C.UTF-8', '--setenv', 'PYTHONDONTWRITEBYTECODE', '1',
            '--setenv', 'LANE_B_TOOLCHAIN', str(TOOL), '--setenv', 'LANE_B_RUNTIME', str(out / 'runtime.mjs'),
            '/usr/bin/python3', str(ROOT / 'scripts/qualify-lane-b.py'), '--inside', name]
    write(out / 'INVOCATION.json', {'scope': 'Synthetic DOM integration; NOT native SDK/host/browser/backend acceptance.',
                                  'argv': argv, 'command': shlex.join(argv), 'source_sha256': inputs,
                                  'toolchain_package_sha256': sha(TOOL / 'package.json')})
    print(shlex.join(['/usr/bin/python3', str(ROOT / 'scripts/qualify-lane-b.py'), '--run', name]))
elif args.run:
    invocation = json.loads((out / 'INVOCATION.json').read_text())
    if invocation['source_sha256'] != {n: sha(ROOT / n) for n in invocation['source_sha256']}:
        raise SystemExit('Prepared source identity changed; create a fresh operation.')
    result = subprocess.run(invocation['argv'], cwd=ROOT, env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'})
    write(out / 'NATIVE-GATE.json', {'argv': invocation['argv'], 'exit': result.returncode})
    sys.exit(result.returncode)
else:
    if not Path('/home/mike').samefile(out / 'home'):
        raise SystemExit('Synthetic private home binding required.')
    candidate = json.loads((out / 'CANDIDATE.json').read_text())
    result = {'started': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'DOM fixture only', 'steps': []}
    for label, argv in [('build', [str(NODE), str(out / 'build.mjs')]),
                        ('dom', [str(NODE), '--test', str(ROOT / 'tests/ui/lane-b.test.mjs')])]:
        try:
            with (out / f'{label}.log').open('w') as log:
                proc = subprocess.run(argv, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=45)
            code = proc.returncode
        except subprocess.TimeoutExpired:
            code = 124
        result['steps'].append({'label': label, 'argv': argv, 'exit': code})
        print(f'{label}: exit {code}', flush=True)
        if code:
            break
    result['unchanged_inputs'] = candidate == {n: sha(ROOT / n) for n in candidate}
    result['status'] = 'PASS_LOCAL_SYNTHETIC_DOM' if result['unchanged_inputs'] and len(result['steps']) == 2 and all(s['exit'] == 0 for s in result['steps']) else 'FAIL'
    result['finished'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    write(out / 'RESULT.json', result)
    print(result['status'])
    sys.exit(0 if result['status'] == 'PASS_LOCAL_SYNTHETIC_DOM' else 1)
