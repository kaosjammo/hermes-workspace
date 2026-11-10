"""Repair-only synthetic preparations; real Store, router and SQLite reopen."""
import runpy
import os
from pathlib import Path

fixture=runpy.run_path('tests/ui/issue-9-server.py')
app,store,out=fixture['app'],fixture['store'],fixture['out']
Store,create_router=fixture['Store'],fixture['create_router']
app.router.routes.pop()  # Restore static mount after the additional API routes.

def prepare(target,name,first='North stream.',last=None,missing=False,overlap=False):
    original=fixture['original']
    page=target.execute('create_item',{'kind':'page','title':name+' garden','content':original})
    a,b=[target.execute('add_comment',{'item_id':page['id'],'text':label+' feedback '+name,'anchor':{'quote':quote,'prefix':'','suffix':''}})
         for label,quote in [('North','North river.'),('South','South garden.')]]
    target.execute('reply_comment',{'id':a['id'],'text':'Human response retained.'})
    if overlap:target.execute('add_comment',{'item_id':page['id'],'text':'Overlapping feedback','anchor':{'quote':'North','prefix':'','suffix':''}})
    run=target.begin_run(page['id'],'synthetic-repair-'+name)
    target.apply_run(run['id'],[],[{'comment_id':cid,'text':'Unrelated reply-only outcome.'}for cid in run['comment_ids']])
    def apply(value,label):
        target.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':original.replace('North river.',value).replace('South garden.','South orchard.')}}],
                         [] if missing else [{'comment_id':cid,'text':label}for cid in run['comment_ids']])
    apply(first,'First exact operation outcome.')
    if last:apply(last,'Second exact operation outcome.')
    if missing:target.apply_run(run['id'],[],[{'comment_id':cid,'text':'Later outcome cannot bind previous edit.'}for cid in run['comment_ids']])
    target.finish_run(run['id'],'completed')
    return page

if not any(i['title']=='Prefix garden'for i in store.snapshot()['items']):
    for name,first,last in [('Prefix','Wide North river.','Broad North river.'),('Suffix','North river. Wide','North river. Broad'),
                            ('RichPrefix','<strong>Wide</strong> North river.','<strong>Broad</strong> North river.'),
                            ('RichSuffix','North river. <em>Wide</em>','North river. <em>Broad</em>')]:prepare(store,name,first,last)
    prepare(store,'Missing',missing=True)
    prepare(store,'Uncertain',overlap=True)
    page=prepare(store,'Superseded')
    def supersede(state):next(i for i in state['items']if i['id']==page['id']).pop('_section_generation',None)
    store._transaction(supersede)

import_home=out/'imported-browser-host'
imported=Store(import_home)
if not imported.snapshot()['items']:
    prepare(imported,'Imported');imported.restore_snapshot(imported.backup_snapshot())
app.include_router(create_router(lambda:import_home),prefix='/imported-api')
@app.get('/fixture/reopen')
def reopen():return Store(fixture['home']).backup_snapshot()
@app.get('/fixture/imported-raw')
def imported_raw():return Store(import_home).backup_snapshot()
app.mount('/',fixture['StaticFiles'](directory=out/'build/browser',html=True),name='repair-static')
if __name__=='__main__':
    import uvicorn
    (out/'runtime/server.pid').write_text(str(os.getpid()))
    uvicorn.run(fixture['application'],host='0.0.0.0',port=int(os.environ.get('ISSUE9_PORT','19579')),log_level='warning')
