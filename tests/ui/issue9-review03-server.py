"""F012 fixture additions; existing31-case data and production transport retained."""
import runpy,os,json
fixture=runpy.run_path('tests/ui/issue9-review02-server.py')
app,store,out=fixture['app'],fixture['store'],fixture['out'];app.router.routes.pop()
config_path=out/'review03-config.json'
if not config_path.exists():
    cases=runpy.run_path('tests/test_issue9_review03.py')['production_cases'](out/'F012-browser-stores',shared_store=store)
    config_path.write_text(json.dumps([{k:c[k]for k in ['name','item_id','comment_id','cleanup_attempt','source_anchor','expected_content']}for c in cases],indent=2)+'\n')
@app.get('/fixture/review03-config')
def config():return json.loads(config_path.read_text())
base=fixture['base'];app.mount('/',base['StaticFiles'](directory=out/'build/browser',html=True),name='review03-static')
if __name__=='__main__':
    import uvicorn
    (out/'runtime/server.pid').write_text(str(os.getpid()))
    uvicorn.run(base['application'],host='0.0.0.0',port=int(os.environ.get('ISSUE9_PORT','19579')),log_level='warning')
