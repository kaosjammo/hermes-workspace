"""Issue-owned synthetic admission + production API/Store. No provider/live data."""
from host_auth import host_auth
import asyncio
import json
import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from hermes_cli.plugin_host_http_auth import with_hosted_admission
from workspace_plugin.store import Store
from dashboard.plugin_api import create_router

out=Path(os.environ['HWS_QUALIFICATION_HOME'])
home=out/'browser-host';home.mkdir(exist_ok=True)
store=Store(home)
original='<h2>Garden field notes</h2><p>North river.</p><p>South garden.</p>'+''.join(f'<p>Observation {i}: keep these surrounding notes.</p>'for i in range(30))
config={}
if not store.snapshot()['items']:
    for name in ['Actions','Delete','Manual','Pending','Cumulative','Later','Detached','Legacy','Touch','Stale','Authors']:
        page=store.execute('create_item',{'kind':'page','title':name+' garden','content':original})
        a,b=[store.execute('add_comment',{'item_id':page['id'],'text':label+' feedback '+name,'anchor':{'quote':quote,'prefix':'','suffix':''}})
            for label,quote in [('North','North river.'),('South','South garden.')]]
        store.execute('reply_comment',{'id':a['id'],'text':'Keep the morning detail.'})
        run=store.begin_run(page['id'],'synthetic-native-'+name)
        store.apply_run(run['id'],[],[{'comment_id':cid,'text':'Unrelated earlier AI outcome.'}for cid in run['comment_ids']])
        after=original.replace('North river.','North stream.').replace('South garden.','South orchard.')
        store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':after}}],[{'comment_id':cid,'text':'Actual first operation '+cid}for cid in run['comment_ids']])
        if name=='Cumulative':
            after=after.replace('North stream.','North creek.')
            store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':after}}],[{'comment_id':cid,'text':'Actual cumulative operation '+cid}for cid in run['comment_ids']])
        store.finish_run(run['id'],'completed')
        if name=='Later':
            second=store.begin_run(page['id'],'synthetic-native-'+name)
            after=after.replace('North stream.','North creek.')
            store.apply_run(second['id'],[{'item_id':page['id'],'patch':{'content':after}}],[{'comment_id':cid,'text':'Later operation '+cid}for cid in second['comment_ids']]);store.finish_run(second['id'],'completed')
        if name in ['Manual','Delete','Stale']:
            store.execute('update_item',{'id':page['id'],'patch':{'content':after.replace('North stream.','North manually edited stream.')+'<p>Keep my outside manual edit.</p>'}})
        if name=='Detached':store.execute('update_item',{'id':page['id'],'patch':{'content':'<p>Replaced whole passage manually.</p>'}})
        if name=='Authors':
            def author_fixture(state):
                comment=next(c for c in state['comments']if c['id']==a['id'])
                comment['replies'][0]['author_identity']={'kind':'human','id':'f'*64,'name':('庭 🌿 '*18).strip()}
            store._transaction(author_fixture)
        if name=='Legacy':
            def legacy(state):
                for version in state['versions']:
                    if version['item_id']==page['id']:
                        for generation in version.get('_section_provenance',[]):
                            for key in ['response_origin','response_links','response_limitations','response_version']:generation.pop(key,None)
            store._transaction(legacy)

app=FastAPI();mode='normal'
@app.middleware('http')
async def transport(request:Request,call_next):
    global mode
    if request.url.path=='/api/command':
        body=await request.json()
        with (out/'logs/browser-api.jsonl').open('a')as log:log.write(json.dumps(body)+'\n')
        if body.get('op')=='revert_section':
            if mode=='fail':mode='normal';return JSONResponse({'detail':'Synthetic revert transport failure; data unchanged.'},503)
            if mode=='slow':await asyncio.sleep(.7)
    return await call_next(request)
app.include_router(create_router(lambda:home,authorize=host_auth),prefix='/api')
@app.post('/fixture/mode/{value}')
def set_mode(value:str):
    global mode
    mode=value;return {'mode':mode}
@app.get('/fixture/raw')
def raw():return store.backup_snapshot()
@app.get('/fixture/avatar/{profile}')
def avatar(profile:str):return {'found':False}
app.mount('/',StaticFiles(directory=out/'build/browser',html=True),name='static')
application=with_hosted_admission(app,True)
if __name__=='__main__':
    import uvicorn
    (out/'runtime/server.pid').write_text(str(os.getpid()))
    uvicorn.run(application,host='0.0.0.0',port=int(os.environ.get('ISSUE9_PORT','19579')),log_level='warning')
