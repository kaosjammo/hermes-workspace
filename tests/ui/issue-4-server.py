"""Loopback-only synthetic adapter for production Store; never a native/provider gate."""
import json
import os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import time
from workspace_plugin.store import Store

out = Path(os.environ['ISSUE4_OUT'])
data_run = os.environ.get('ISSUE4_DATA', 'initial')
assert Path(os.environ['HERMES_HOME']).is_relative_to(out)
store = Store(Path(os.environ['HERMES_HOME']))
if not store.snapshot()['items']:
    related = store.execute('create_item', {'kind': 'database', 'title': 'Related sites'})
    site = store.execute('create_item', {'kind': 'record', 'database_id': related['id'], 'title': 'North bank'})
    columns = [{'id': 'note', 'name': 'Observation', 'type': 'text'}, {'id': 'count', 'name': 'Count', 'type': 'number'},
               {'id': 'status', 'name': 'Status', 'type': 'select', 'options': ['Planned', 'Done']},
               {'id': 'checked', 'name': 'Verified', 'type': 'checkbox'}, {'id': 'date', 'name': 'Date', 'type': 'date'},
               {'id': 'site', 'name': 'Site', 'type': 'relation', 'target_database_id': related['id']},
               {'id': 'double', 'name': 'Double count', 'type': 'formula', 'formula': 'col("Count") * 2'}]
    for name, count in [('Field observations', 3), ('Empty observations', 0), ('Long observations', 65), ('Locked observations', 1)]:
        db = store.execute('create_item', {'kind': 'database', 'title': name})
        store.execute('set_columns', {'id': db['id'], 'columns': columns})
        for i in range(count):
            store.execute('create_item', {'kind': 'record', 'database_id': db['id'], 'title': f'Observation {i+1:02d}',
                'content': '<p>Retain this synthetic record document.</p>', 'properties': {'note': 'Synthetic field note', 'count': i+2, 'status': 'Planned' if i%2==0 else 'Done', 'checked': True, 'date': '2026-11-11', 'site': [site['id']]}})
    (out/f'before-{data_run}.json').write_text(json.dumps(store.backup_snapshot(),indent=2))

failures = set()
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(out/'build'),**kwargs)
    def response(self,code,data):
        raw=json.dumps(data).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path=='/state': return self.response(200,store.snapshot())
        return super().do_GET()
    def do_POST(self):
        if self.path!='/command': return self.response(404,{'error':'Unknown fixture route'})
        body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        with (out/f'logs/commands-{data_run}.jsonl').open('a') as log: log.write(json.dumps(body)+'\n')
        name=body['payload'].get('title') or (body['payload'].get('columns') or [{}])[-1].get('name', '')
        if name.startswith('Delayed'): time.sleep(0.6)
        if name.startswith('Fail once') and name not in failures:
            failures.add(name);return self.response(503,{'error':'Synthetic save unavailable; draft retained.'})
        try:
            result=store.execute(body['op'],{**body['payload'],'expected_revision':body['revision'],'expected_scope':body['scope']})
            (out/f'after-{data_run}.json').write_text(json.dumps(store.backup_snapshot(),indent=2))
            return self.response(200,result)
        except Exception as error:return self.response(getattr(error,'status_code',400),{'error':str(error)})

print('Issue-4 synthetic Store fixture on loopback port '+os.environ.get('ISSUE4_PORT','19564'),flush=True)
ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('ISSUE4_PORT','19564'))),Handler).serve_forever()
