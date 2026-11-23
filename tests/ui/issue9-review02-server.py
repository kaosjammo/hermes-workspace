"""Review02 synthetic fixtures; real product Store, API and recovery graph."""
import runpy,os,json,copy,base64,hashlib,io,zipfile
fixture=runpy.run_path('tests/ui/issue9-review01-server.py')
app,store,out=fixture['app'],fixture['store'],fixture['out']
base=fixture['fixture'];app.router.routes.pop()
config_path=out/'review02-config.json'
if not config_path.exists():
    config={}
    for name in ['Unrelated','Effective','PostRevert','Restore','Uncertain2','Chronology']:
        original=base['original'];page=store.execute('create_item',{'kind':'page','title':name+' garden','content':original})
        a,b=[store.execute('add_comment',{'item_id':page['id'],'text':label+' feedback '+name,'anchor':{'quote':quote,'prefix':'','suffix':''}})for label,quote in [('North','North river.'),('South','South garden.')]]
        store.execute('reply_comment',{'id':a['id'],'text':'Human response retained.'})
        def apply(content,label):
            run=store.begin_run(page['id'],'synthetic-review02-'+name)
            store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':content}}],[{'comment_id':cid,'text':label}for cid in run['comment_ids']]);store.finish_run(run['id'],'completed');return run
        stream=original.replace('North river.','North stream.')
        first=apply(stream,'Earlier effective outcome.');change=next(c for c in store.snapshot()['comments']if c['id']==a['id'])['section_change']
        old=store.execute('preview_section_revert',{k:change[k]for k in ['version_id','generation_id','change_id']})
        if name in ['Unrelated','Uncertain2']:apply(stream.replace('South garden.','South orchard.'),'Unrelated South operation.')
        elif name!='Chronology':
            second=apply(stream.replace('North stream.','North creek.'),'Later North operation.')
            if name=='PostRevert':
                current=next(c for c in store.snapshot()['comments']if c['id']==a['id'])['section_change'];p=store.execute('preview_section_revert',{k:current[k]for k in ['version_id','generation_id','change_id']})
                store.execute('revert_section',{**{k:p[k]for k in ['version_id','generation_id','change_id','dataset_epoch','content_hash','manual_revision']},'confirmed':True})
                apply(stream.replace('South garden.','South orchard.'),'Unrelated run after latest revert.')
            if name=='Restore':store.execute('restore_version',{'id':second['version_ids'][0]})
        if name=='Uncertain2':store.execute('update_item',{'id':page['id'],'patch':{'content':'<p>Entirely replaced passage.</p>'}})
        config[name]={'item_id':page['id'],'comment_id':a['id'],'earlier_preview':old}
    config_path.write_text(json.dumps(config,indent=2)+'\n')
config=json.loads(config_path.read_text())
@app.get('/fixture/review02-config')
def manifest():
    state=store.snapshot()
    return {'cases':config,'items':[{'id':i['id'],'title':i['title'],'comments':[{'id':c['id'],'text':c['text']}for c in state['comments']if c['item_id']==i['id']]}for i in state['items']]}
@app.get('/fixture/chronology-invalid/{mode}')
def invalid(mode:str):
    from workspace_plugin.interchange import _json_bytes
    state=store.backup_snapshot();cid=config['Chronology']['comment_id'];bad=copy.deepcopy(state)
    change_ids={c['id']for v in bad['versions']for g in v.get('_section_provenance',[])for c in g['changes']if c['comment_id']==cid}
    checkpoint=next(v for v in bad['versions']if v.get('section_revert_of')in change_ids)
    checkpoint['_removed_responses']=[];checkpoint['section_revert_receipt']['removed_reply_ids']=[]
    if mode=='omitted':checkpoint['section_revert_receipt'].pop('cleanup_mode',None)
    else:checkpoint['section_revert_receipt']['cleanup_mode']='discussion_deleted'
    envelope={'format':'workspace-backup','version':1,'snapshot':bad,'sha256':hashlib.sha256(_json_bytes(bad)).hexdigest()};data=io.BytesIO()
    with zipfile.ZipFile(data,'w',zipfile.ZIP_STORED)as archive:archive.writestr('snapshot.json',_json_bytes(envelope))
    return {'data_base64':base64.b64encode(data.getvalue()).decode(),'synthetic':'Deliberately inconsistent complete backup graph with valid framing/digest.'}
app.mount('/',base['StaticFiles'](directory=out/'build/browser',html=True),name='review02-static')
if __name__=='__main__':
    import uvicorn
    (out/'runtime/server.pid').write_text(str(os.getpid()))
    uvicorn.run(base['application'],host='0.0.0.0',port=int(os.environ.get('ISSUE9_PORT','19579')),log_level='warning')
