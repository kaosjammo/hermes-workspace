"""Real upstream browser renderer/loader with only synthetic task-owned state.

This is a renderer qualification fixture, not Electron or live gateway acceptance.
It uses upstream HTTP authentication and plugin mounts. No native provider is run.
"""
import argparse
import json
import os
from pathlib import Path
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=9187)
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / '.local/renderer'
HOME = FIXTURE / 'home'
# A supported mount namespace may present the synthetic home at the account's
# normal home path. Verify inode identity rather than changing the HOME variable.
if not Path.home().samefile(HOME) or Path(os.environ['HERMES_HOME']).resolve() != HOME / '.hermes':
    raise SystemExit('Renderer qualification requires the explicit synthetic home.')
if any(key in os.environ for key in ('OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY')):
    raise SystemExit('Renderer qualification refuses provider credentials.')

from hermes_cli import web_server
from hermes_cli.web_routers import webapp
import uvicorn

app = web_server.app
app.state.ui_surface = 'webapp'
app.state.web_dist = ROOT / '.local/host/apps/desktop/dist-webapp'
app.state.bound_host = '127.0.0.1'
app.state.auth_required = False
app.state.initial_profile = 'default'
ticket = webapp.mint_printed_launch_ticket(app.state)
path = FIXTURE / 'launch.json'
path.write_text(json.dumps({'url': f'http://127.0.0.1:{args.port}/webapp/launch#ticket={ticket}'}))
path.chmod(0o600)
print(f'Synthetic renderer fixture ready on 127.0.0.1:{args.port}; native gateway and inference not started.', flush=True)
# Do not run the standalone serve lifespan: it would start an unrelated chat
# backend. The plugin remains able to display supported-native-lifecycle errors.
uvicorn.run(app, host='127.0.0.1', port=args.port, lifespan='off', access_log=False)
