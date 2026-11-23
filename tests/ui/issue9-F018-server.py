"""F018-only synthetic data; production Workspace router/Store/SQLite.

No worker is launched. Workflow transport is explicitly refused before any
native/profile lifecycle access; the running Store fixture remains genuine.
"""
import json
import os
import runpy
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from hermes_constants import set_hermes_home_override, reset_hermes_home_override
from workspace_plugin.store import Store

fixture = runpy.run_path('tests/ui/issue9-user-ux-server.py')
app, store, out = fixture['app'], fixture['store'], fixture['out']
home = fixture['fixture']['home']
config_path = out / 'F018-config.json'
if not config_path.exists():
    config = {}
    page = store.execute('create_item', {'kind': 'page', 'title': 'F018 active-run visibility',
        'content': '<h2>Visibility field notes</h2><p>North river. South garden.</p>' +
        ''.join(f'<p>Reading context {i}: keep the surrounding observations.</p>' for i in range(12))})
    config['active'] = {'item': page, 'comments': []}
    for label in ['North', 'South']:
        comment = store.execute('add_comment', {'item_id': page['id'], 'text': label + ' visibility feedback', 'anchor': None})
        store.execute('reply_comment', {'id': comment['id'], 'text': 'Saved human observation; retain exactly.'})
        config['active']['comments'].append(comment)
    page = store.execute('create_item', {'kind': 'page', 'title': 'F018 overlapping passages',
        'content': '<h2>Overlapping field notes</h2><p>North river path stays shaded.</p><p>Independent surrounding paragraph.</p>'})
    config['overlap'] = {'item': page, 'comments': []}
    for text, quote in [('First overlapping thread', 'North river path'), ('Second overlapping thread', 'river path stays shaded.')]:
        comment = store.execute('add_comment', {'item_id': page['id'], 'text': text,
            'anchor': {'quote': quote, 'prefix': '', 'suffix': ''}})
        store.execute('reply_comment', {'id': comment['id'], 'text': 'Independent human reply for ' + text})
        config['overlap']['comments'].append(comment)
    page = store.execute('create_item', {'kind': 'page', 'title': 'F018 uncertain passages',
        'content': '<h2>Uncertain field notes</h2><p>river path</p><p>river path</p><p>Unique meadow.</p>'})
    config['uncertain'] = {'item': page, 'comments': []}
    for text, quote in [('Missing passage thread', 'Missing bridge.'), ('Ambiguous passage thread', 'river path'), ('Exact independent thread', 'Unique meadow.')]:
        config['uncertain']['comments'].append(store.execute('add_comment', {'item_id': page['id'], 'text': text,
            'anchor': {'quote': quote, 'prefix': '', 'suffix': ''}}))
    config_path.write_text(json.dumps(config, indent=2))

@app.middleware('http')
async def isolated_context(request: Request, call_next):
    token = set_hermes_home_override(home)
    try:
        if request.url.path.startswith('/api/workflow/'):
            with (out/'logs/F018-refused-workflow.jsonl').open('a') as log:
                log.write(json.dumps({'method': request.method, 'path': request.url.path}) + '\n')
            return JSONResponse({'detail': 'Synthetic F018 lifecycle transport unavailable; no worker invoked.'}, 503)
        return await call_next(request)
    finally:
        reset_hermes_home_override(token)

@app.get('/fixture/F018')
def config():
    return json.loads(config_path.read_text())

@app.post('/fixture/F018/start')
def start():
    item = config()['active']['item']
    current = next((r for r in store.snapshot()['runs'] if r['item_id'] == item['id'] and r['status'] == 'running'), None)
    return current or store.begin_run(item['id'], 'synthetic-F018-held-run-no-worker')

@app.get('/fixture/F018/reopen')
def reopen():
    return Store(home).backup_snapshot()

# The imported fixture's static mount must remain after these task endpoints.
app.router.routes.sort(key=lambda route: 0 if isinstance(route, APIRoute) else 1)

if __name__ == '__main__':
    import uvicorn
    (out/'runtime/server.pid').write_text(str(os.getpid()))
    uvicorn.run(fixture['fixture']['application'], host='0.0.0.0', port=int(os.environ.get('ISSUE9_PORT', '19579')), log_level='warning')
