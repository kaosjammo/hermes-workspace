"""Synthetic admission/selected profile; production Workspace router and Store.

Only generated task-owned profile metadata/images. Fixture instrumentation for
failures and captured historic authors is explicit; no real user/provider state.
"""
import base64
import contextvars
import json
import os
from pathlib import Path
import time
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from hermes_cli.plugin_host_http_auth import with_hosted_admission
from hermes_constants import set_hermes_home_override, reset_hermes_home_override
from workspace_plugin.identity import executor
from workspace_plugin.store import Store
from dashboard.plugin_api import create_router

out=Path(os.environ['HWS_QUALIFICATION_HOME'])
base=out/'browser-host';base.mkdir(exist_ok=True)
os.environ['HERMES_HOME']=str(base)
selected=contextvars.ContextVar('fixture-profile',default='alpha')
for name,title,color in [('alpha','Aster Ω',(123,72,55)),('beta','Birch 東京',(45,103,146))]:
    home=base/'profiles'/name;home.mkdir(parents=True,exist_ok=True)
    meta=home/'profile.yaml'
    if not meta.exists():meta.write_text(json.dumps({'display_name':title,'ui_meta':{'hermes-bots':{'title':title}}}))
    assets=home/'assets';assets.mkdir(exist_ok=True)
    from PIL import Image, ImageDraw
    pic=Image.new('RGB',(32,32),color);ImageDraw.Draw(pic).ellipse((8,7,24,23),fill=(235,225,205));pic.save(assets/'avatar.png')
    store=Store(home)
    if store.snapshot()['items']:continue
    folder=store.execute('create_item',{'kind':'folder','title':'Field work'})
    nested=store.execute('create_item',{'kind':'folder','title':'Seasonal notes','parent_id':folder['id']})
    store.execute('create_item',{'kind':'page','title':'Sibling notes','parent_id':nested['id']})
    page=store.execute('create_item',{'kind':'page','title':'River garden notes','parent_id':folder['id'],'content':'<h2>Review the river garden</h2><p>North path stays shaded through the morning.</p><p>South path needs careful drainage.</p>'+''.join(f'<p>Field observation {i}: preserve the surrounding notes.</p>' for i in range(8))})
    c=store.execute('add_comment',{'item_id':page['id'],'text':'Clarify the north route.','anchor':{'quote':'North path','prefix':'','suffix':''}})
    store.execute('reply_comment',{'id':c['id'],'text':'Keep the morning shade detail.'})
    token=set_hermes_home_override(home)
    try: author=executor(home)
    finally:reset_hermes_home_override(token)
    run=store.begin_run(page['id'],'synthetic-recorded-native',executor_identity=author)
    store.apply_run(run['id'],[],[{'comment_id':c['id'],'text':'Recorded executor response; feedback remains unresolved.'}]);store.finish_run(run['id'],'completed')
    other=store.execute('add_comment',{'item_id':page['id'],'text':'Preserve another participant’s feedback.'})
    def instrument(state):
        entry=next(x for x in state['comments'] if x['id']==other['id'])
        entry['author_identity']={'kind':'human','id':'f'*64,'name':'Other participant'}
        store._reply(next(x for x in state['comments'] if x['id']==c['id']),'Legacy response with unknown attribution.','agent')
    store._transaction(instrument)
    store.execute('add_comment',{'item_id':page['id'],'text':'Check southern drainage.','anchor':{'quote':'South path','prefix':'','suffix':''}})
    db=store.execute('create_item',{'kind':'database','title':'Garden observations'})
    store.execute('set_columns',{'id':db['id'],'columns':[{'id':'note','name':'Observation','type':'text'}]})
    store.execute('create_item',{'kind':'record','database_id':db['id'],'title':'North bank','properties':{'note':'Keep this record'}})

app=FastAPI();image_mode='normal';failed=False
@app.middleware('http')
async def synthetic_scope(request,call_next):
    global failed
    profile=request.headers.get('x-fixture-profile','alpha')
    if profile not in ('alpha','beta'):return JSONResponse({'detail':'Unknown synthetic profile'},400)
    token=selected.set(profile);home_token=set_hermes_home_override(base/'profiles'/profile)
    try:
        if request.url.path=='/api/command':
            body=await request.json()
            with (out/'logs/browser-api.jsonl').open('a') as log:log.write(json.dumps(body)+'\n')
            name=body.get('payload',{}).get('name')
            if name=='Fail once' and not failed:
                failed=True;return JSONResponse({'detail':'Synthetic save unavailable; retry your retained username.'},503)
            if name=='Slow save':
                import asyncio
                await asyncio.sleep(.7)
        return await call_next(request)
    finally:reset_hermes_home_override(home_token);selected.reset(token)

app.include_router(create_router(lambda:base/'profiles'/selected.get()),prefix='/api')
@app.post('/fixture/image-mode/{mode}')
def mode(mode:str):
    global image_mode
    image_mode=mode;return {'mode':mode}
@app.get('/fixture/avatar/{profile}')
def avatar(profile:str):
    if profile not in ('alpha','beta'):return JSONResponse({'detail':'Unknown fixture'},404)
    # Actual registered public handler, with explicit synthetic server envelopes.
    from tui_gateway import methods_profiles as handlers
    handlers.Path=Path;handlers.json=json
    handlers._ok=lambda rid,value:{'result':value}
    handlers._err=lambda rid,code,message:{'error':{'code':code,'message':message}}
    handler=dict(handlers._registry._pending)['profiles.get_asset']
    result=handler(1,{'name':profile,'asset':'avatar'})['result']
    if image_mode=='missing':return {'found':False}
    if image_mode=='oversize':return {**result,'size':262145}
    if image_mode=='unsafe':return {**result,'mime':'image/svg+xml','data':'data:image/svg+xml;base64,PHN2Zy8+'}
    if image_mode=='broken':
        data=base64.b64decode(result['data'].split(',')[1])[:24]
        return {**result,'size':len(data),'data':'data:image/png;base64,'+base64.b64encode(data).decode()}
    return result

app.mount('/',StaticFiles(directory=out/'build/browser',html=True),name='static')
application=with_hosted_admission(app,True)
if __name__=='__main__':
    import uvicorn
    (out/'runtime/server.pid').write_text(str(os.getpid()))
    uvicorn.run(application,host='0.0.0.0',port=19570,log_level='warning')
