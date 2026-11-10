"""Real command router/Store, synthetic user admission and simulated agent writes."""
from pathlib import Path
import tempfile
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from dashboard.plugin_api import create_router
from workspace_plugin.store import Store


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / '.local' / 'section-api-tests'
FIXTURES.mkdir(parents=True,exist_ok=True)


class SectionApi(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=FIXTURES)
        self.home = Path(self.temp.name)
        self.store = Store(self.home)
        self.page = self.store.execute('create_item',{'kind':'page','title':'Synthetic HTTP sections','content':'<p>Original passage. Outside content.</p>'})
        self.comment = self.store.execute('add_comment',{'item_id':self.page['id'],'text':'Change this passage','anchor':{'quote':'Original passage','prefix':'','suffix':'. Outside content.'}})
        run = self.store.begin_run(self.page['id'],'synthetic-api-section-thread')
        self.store.apply_run(run['id'],[{'item_id':self.page['id'],'patch':{'content':'<p>Agent passage. Outside content.</p>'}}],[{'comment_id':self.comment['id'],'text':'Simulated agent edit'}])
        self.store.finish_run(run['id'],'completed')
        app = FastAPI()
        app.include_router(create_router(lambda:self.home,authorize=lambda:None),prefix='/api/plugins/workspace')
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.temp.cleanup()

    def state(self):
        response = self.client.get('/api/plugins/workspace/state')
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def command(self, op, payload, scope=None):
        state = self.state()
        return self.client.post('/api/plugins/workspace/command',json={'op':op,'expected_scope':scope or state['scope_id'],
            'payload':dict(payload,expected_revision=state['revision'])})

    def preview(self):
        change = self.state()['comments'][0]['section_change']
        response = self.command('preview_section_revert',{k:change[k] for k in ('version_id','generation_id','change_id')})
        self.assertEqual(response.status_code,200,response.text)
        return response.json()['result']

    def apply(self, preview, confirmed=False, **extra):
        payload = {k:preview[k] for k in ('version_id','generation_id','change_id','content_hash','manual_revision','dataset_epoch')}
        return self.command('revert_section',dict(payload,confirmed=confirmed,**extra))

    def test_preview_no_write_confirmation_stale_review_and_replay(self):
        self.command('update_item',{'id':self.page['id'],'patch':{'title':'Manual title'}})
        before = self.state();preview = self.preview()
        self.assertTrue(preview['requires_confirmation']);self.assertEqual(before,self.state())
        self.assertEqual(preview['before_html'],preview['before_text'])
        self.assertEqual(preview['current_html'],preview['current_text'])
        self.assertEqual(self.apply(preview,True,before_html='<strong>Injected replacement</strong>').status_code,400)
        self.assertEqual(before,self.state(),'Rich read fields never authorise caller-supplied replacement content')
        self.assertEqual(self.apply(preview).status_code,409)
        self.assertEqual(before,self.state())
        self.command('update_item',{'id':self.page['id'],'patch':{'content':'<p>Agent passage. Keep outside edit.</p>'}})
        latest = self.state();self.assertEqual(self.apply(preview,True).status_code,409);self.assertEqual(latest,self.state())
        preview = self.preview();response = self.apply(preview,True)
        self.assertEqual(response.status_code,200,response.text)
        item = self.state()['items'][0]
        self.assertEqual(item['content'],'<p>Original passage. Keep outside edit.</p>');self.assertEqual(item['title'],'Manual title')
        self.assertEqual(self.apply(preview,True).status_code,409)

    def test_scope_lock_and_caller_supplied_content_refuse(self):
        preview = self.preview();before = self.state()
        self.assertEqual(self.apply(preview,True,before='<p>Injected whole page</p>').status_code,400)
        self.assertEqual(before,self.state())
        ids = {k:preview[k] for k in ('version_id','generation_id','change_id')}
        self.assertEqual(self.command('preview_section_revert',ids,scope='f'*32).status_code,409)
        self.store.begin_run(self.page['id'],'synthetic-api-section-thread')
        locked = self.state()
        self.assertEqual(self.command('preview_section_revert',ids).status_code,409)
        self.assertEqual(locked,self.state())
