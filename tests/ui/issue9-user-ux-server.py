"""New task-only long-text data. All source API/Store paths remain production."""
import json, os, runpy
fixture = runpy.run_path('tests/ui/issue-9-server.py')
app, store, out = fixture['app'], fixture['store'], fixture['out']
config_path = out/'user-ux-config.json'
if not config_path.exists():
    def long_text(state):
        page = next(p for p in state['items'] if p['title'] == 'Actions garden')
        comments = [c for c in state['comments'] if c['item_id'] == page['id']]
        for c in comments:
            c['author_identity']['name'] = 'Garden writer with a deliberately long author name 庭'
        comments[1]['text'] += ' — independently numbered feedback with an extended title that must wrap inside its own header.'
        comments[0]['replies'][0]['text'] += ' Keep the river observations readable when this reply wraps across several lines. '*4
        comments[0]['replies'][1]['text'] += ' Earlier outcome retained independently. '*4
    store._transaction(long_text)
    # An intentional user body is data, distinct from representative seed copy.
    discussion = next(c for c in store.snapshot()['comments'] if c['text'] == 'South feedback Delete')
    store.execute('reply_comment', {'id':discussion['id'], 'text':'Human reply: I intentionally wrote this literal prefix.'})
    database = store.execute('create_item', {'kind':'database', 'title':'Untouched typed preservation data'})
    store.execute('set_columns', {'id':database['id'], 'columns':[
        {'id':'n','name':'Number','type':'number'}, {'id':'c','name':'Done','type':'checkbox'},
        {'id':'d','name':'Date','type':'date'}, {'id':'s','name':'Status','type':'select','options':['Todo','Done']},
        {'id':'f','name':'Double','type':'formula','formula':'n * 2'}]})
    store.execute('create_item', {'kind':'record','title':'Preserved typed record','database_id':database['id'],
        'properties':{'n':7,'c':True,'d':'2026-11-11','s':'Todo'}})
    config_path.write_text(json.dumps({'item_id':next(p['id'] for p in store.snapshot()['items'] if p['title']=='Actions garden')},indent=2))
@app.get('/fixture/user-ux')
def user_ux(): return json.loads(config_path.read_text())
if __name__ == '__main__':
    import uvicorn
    (out/'runtime/server.pid').write_text(str(os.getpid()))
    uvicorn.run(fixture['application'], host='0.0.0.0', port=int(os.environ.get('ISSUE9_PORT','19579')), log_level='warning')
