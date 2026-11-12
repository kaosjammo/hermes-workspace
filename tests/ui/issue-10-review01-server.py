"""Review01: explicit shared composition + production API/Store; synthetic admission.

Reuse only the originating fixture code. All state/assets live in this run's
qualification packet, never the original contribution's immutable evidence.
"""
from host_auth import host_auth
import json
import os
from pathlib import Path
import runpy
from hermes_constants import set_hermes_home_override, reset_hermes_home_override
from dashboard.plugin_api import create_router
from workspace_plugin.identity import executor
from workspace_plugin.shared_workspaces import SharedWorkspaces, profile_key
from workspace_plugin.store import Store

fixture=runpy.run_path(str(Path(__file__).with_name('issue-10-server.py')))
app,out,base,selected=[fixture[key]for key in ('app','out','base','selected')]
static=app.routes.pop()
assert static.path==''
service=SharedWorkspaces(out/'shared-store')
actors={name:profile_key(base/'profiles'/name)for name in ('alpha','beta','reader')}
projects=service.list(actors['alpha'])
project=projects[0] if projects else service.create(actors['alpha'],'Shared field notes',[
    {'profile_id':actors['beta']},{'profile_id':actors['reader'],'role':'read_only'}])
project_id=project['id']
def command(profile,op,payload):
    view=service.snapshot(actors[profile],project_id)
    return service.execute(actors[profile],project_id,op,{**payload,'expected_revision':view['state']['revision']},membership_revision=view['workspace']['membership_revision'],expected_scope=view['state']['scope_id'])

if not service.snapshot(actors['alpha'],project_id)['state']['items']:
    page=command('alpha','create_item',{'kind':'page','title':'Shared garden notes','content':'<p>North shared path stays shaded.</p>'+''.join(f'<p>Shared observation {i}: keep all surrounding notes.</p>'for i in range(16))})['result']
    comment=command('alpha','add_comment',{'item_id':page['id'],'text':'Alice shared feedback','anchor':{'quote':'North shared path','prefix':'','suffix':''}})['result']
    command('beta','reply_comment',{'id':comment['id'],'text':'Bob keeps this reply and its immutable identity.'})
    command('beta','add_comment',{'item_id':page['id'],'text':'Bob shared feedback'})
    command('alpha','set_username',{'name':'Alice Ω'})
    command('beta','set_username',{'name':'Bob 東京'})

# Add an actual internally captured long native title to private fixture data.
# Existing short/legacy responses remain untouched and visible alongside it.
long_name='Engineer 👩‍💻 — '+('River garden 東京 🌿 '*24).strip()
home=base/'profiles'/'alpha'
(home/'profile.yaml').write_text(json.dumps({'ui_meta':{'hermes-bots':{'title':long_name}}},ensure_ascii=False))
store=Store(home);page=next(x for x in store.snapshot()['items']if x['title']=='River garden notes')
comment=store.snapshot()['comments'][0]
for active in store.snapshot()['runs']:
    if active['status']=='running':
        store.apply_run(active['id'],[],[{'comment_id':cid,'text':'Recovered synthetic fixture outcome'}for cid in active['comment_ids']if cid!=comment['id']]);store.finish_run(active['id'],'completed')
if not any(r['text']=='Long native recorded response'for r in comment['replies']):
    token=set_hermes_home_override(home)
    try:author=executor(home)
    finally:reset_hermes_home_override(token)
    run=store.begin_run(page['id'],'synthetic-recorded-native',executor_identity=author)
    store.apply_run(run['id'],[],[{'comment_id':cid,'text':'Long native recorded response' if cid==comment['id'] else 'Independent captured outcome'}for cid in run['comment_ids']]);store.finish_run(run['id'],'completed')

app.include_router(create_router(lambda:base/'profiles'/selected.get(),authorize=host_auth,shared_root=out/'shared-store'),prefix='/shared-api')
@app.get('/fixture/review01')
def config():return {'project_id':project_id,'long_agent_name':long_name}
app.routes.append(static)
if __name__=='__main__':
    import uvicorn
    (out/'runtime/server.pid').write_text(str(os.getpid()))
    uvicorn.run(fixture['application'],host='0.0.0.0',port=19570,log_level='warning')
