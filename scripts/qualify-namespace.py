"""Run a declared local qualification command with the real user home hidden.

Bubblewrap supplies a supported mount namespace instead of overriding HOME.
Only task-owned synthetic home/runtime/cache/temp and the declared receipt
directory are writable. No credentials, live profiles or provider are mounted.
"""
import argparse
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--browser', action='store_true')
parser.add_argument('--dom', action='store_true')
parser.add_argument('--backend', action='store_true')
parser.add_argument('command', nargs=argparse.REMAINDER)
args = parser.parse_args()
output = Path(args.output).resolve()
output.relative_to(ROOT / '.local/ui-overhaul-evidence')
if not output.is_dir() or not args.command:
    parser.error('Existing task evidence directory and exact command required')
fixture = ROOT / '.local/renderer'
home = fixture / 'home'
temporary = Path('/tmp/hws-ui-01')
command = args.command[1:] if args.command[0] == '--' else args.command
allowed = {str(ROOT/'.local/native-venv/bin/python'), str(ROOT/'.local/native-tests-venv/bin/python'), str(ROOT/'.local/toolchain/node-v26.0.0-linux-x64/bin/node')}
if command[0] not in allowed:
    parser.error('Only the pinned task Python or Node executables are accepted')
argv = ['/usr/sbin/bwrap','--die-with-parent','--unshare-all','--share-net',
        '--ro-bind','/usr','/usr','--ro-bind','/etc','/etc',
        '--symlink','usr/bin','/bin','--symlink','usr/lib','/lib','--symlink','usr/lib','/lib64',
        '--proc','/proc','--dev','/dev','--dir','/home/mike',
        '--bind',str(home),'/home/mike','--ro-bind',str(ROOT),str(ROOT)]
for writable in (home,fixture/'runtime',fixture/'cache',fixture/'tmp',fixture/'launch.json',output):
    argv += ['--bind',str(writable),str(writable)]
if args.dom:
    argv += ['--bind',str(ROOT/'.local/frontend'),str(ROOT/'.local/frontend')]
if args.backend:
    for name in ('store/tmp','workflow/tmp','api-native','api','conversion/fixtures','conversion/tmp','conversion/r1','section-store-tests','section-api-tests'):
        writable = ROOT/'.local'/name
        argv += ['--bind',str(writable),str(writable)]
if args.browser:
    for readonly in (Path('/home/mike/.cache/ms-playwright/chromium-1234'),Path('/home/mike/.cache/codex-runtimes/codex-primary-runtime/dependencies/node')):
        argv += ['--ro-bind',str(readonly),str(readonly)]
argv += ['--bind',str(temporary),'/tmp','--chdir',str(ROOT),'--clearenv']
environment = {'PATH':'/usr/bin:/bin','LANG':'C.UTF-8',
    'HWS_QUALIFICATION_HOME':str(home),'HERMES_HOME':str(home/'.hermes'),
    'HERMES_RUNTIME_DIR':str(fixture/'runtime'),'XDG_CACHE_HOME':str(fixture/'cache'),
    'TMPDIR':'/tmp','PYTHONDONTWRITEBYTECODE':'1',
    'PYTHONPATH':':'.join(str(ROOT/p) for p in ('.local/host','.local/native-venv/lib/python3.14/site-packages','.local/qualification-venv/lib/python3.14/site-packages',''))}
for key,value in environment.items():
    argv += ['--setenv',key,value]
os.execv(argv[0],argv+command)
