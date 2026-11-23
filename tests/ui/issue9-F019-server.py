"""Fresh F019 synthetic presentation data; production Store/API paths.

The source-bound F018 fixture supplies real overlap, legacy, typed data and an
idle synthetic Store run. Its lifecycle refusal prevents any native worker.
"""
import json
import os
import runpy
from fastapi.routing import APIRoute

fixture = runpy.run_path('tests/ui/issue9-F018-server.py')
app, store, out = fixture['app'], fixture['store'], fixture['out']
config_path = out / 'F019-config.json'
if not config_path.exists():
    page = store.execute('create_item', {'kind': 'page', 'title': 'F019 long whole-page feedback',
        'content': '<h2>Reading space field notes</h2><p>North river. South garden.</p>'})
    comments = []
    for label in ['North', 'South']:
        comment = store.execute('add_comment', {'item_id': page['id'], 'anchor': None,
            'text': label + ' feedback keeps its independent number, identity and reply count readable while the complete unavailable explanation wraps below the native controls.'})
        store.execute('reply_comment', {'id': comment['id'], 'text': 'Keep this original human observation and the full surrounding detail. ' * 3})
        comments.append(comment)
    # Synthetic display data only; no profile/identity lookup or authority claim.
    def long_author(state):
        for comment in state['comments']:
            if comment['item_id'] == page['id']:
                comment['author_identity']['name'] = 'Garden writer with a deliberately long author name 庭'
                comment['replies'][0]['author_identity']['name'] = 'Garden writer with a deliberately long author name 庭'
    store._transaction(long_author)
    config_path.write_text(json.dumps({'item': page, 'comments': comments}, indent=2))

@app.get('/fixture/F019')
def config():
    return json.loads(config_path.read_text())

app.router.routes.sort(key=lambda route: 0 if isinstance(route, APIRoute) else 1)

if __name__ == '__main__':
    import uvicorn
    (out/'runtime/server.pid').write_text(str(os.getpid()))
    uvicorn.run(fixture['fixture']['fixture']['application'], host='0.0.0.0', port=int(os.environ.get('ISSUE9_PORT', '19579')), log_level='warning')
