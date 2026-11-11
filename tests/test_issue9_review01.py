"""F006-F008 regressions against real Store/SQLite; external synthetic state."""
import copy
import json
import os
from pathlib import Path
import tempfile
import unittest

from workspace_plugin.store import Store, StoreError


class Review01(unittest.TestCase):
    def setUp(self):
        self.out=Path(os.environ['ISSUE9_EVIDENCE']);(self.out/'fixtures').mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.out/'fixtures')
        self.home=Path(self.temp.name);self.store=Store(self.home)
        self.original='<p>North river.</p><p>South garden.</p>'
        self.page=self.store.execute('create_item',{'kind':'page','title':'Synthetic review repair','content':self.original})
        self.a,self.b=[self.store.execute('add_comment',{'item_id':self.page['id'],'text':text,'anchor':{'quote':quote,'prefix':'','suffix':''}})for text,quote in [('North feedback','North river.'),('South feedback','South garden.')]]
        self.store.execute('reply_comment',{'id':self.a['id'],'text':'Human feedback unchanged.'})

    def tearDown(self):self.temp.cleanup()

    def comment(self,c=None):return next(cmt for cmt in self.store.snapshot()['comments']if cmt['id']==(c or self.a)['id'])

    def apply(self,run,content,label):
        return self.store.apply_run(run['id'],[{'item_id':self.page['id'],'patch':{'content':content}}],[{'comment_id':cid,'text':label}for cid in run['comment_ids']])

    def preview(self):
        c=self.comment()['section_change']
        return self.store.execute('preview_section_revert',{k:c[k]for k in ['version_id','generation_id','change_id']})

    def revert(self,p=None):
        p=p or self.preview()
        return self.store.execute('revert_section',{**{k:p[k]for k in ['version_id','generation_id','change_id','dataset_epoch','content_hash','manual_revision']},'confirmed':True})

    def complete(self,content='<p>North stream.</p><p>South garden.</p>'):
        run=self.store.begin_run(self.page['id'],'synthetic-review-thread');self.apply(run,content,'Actual operation outcome');self.store.finish_run(run['id'],'completed');return run

    def test_F006_prefix_suffix_cumulative_region_keeps_exact_outcomes(self):
        cases=[('prefix','Wide North river.','Broad North river.'),('suffix','North river. Wide','North river. Broad'),
               ('rich-prefix','<strong>Wide</strong> North river.','<strong>Broad</strong> North river.'),
               ('rich-suffix','North river. <em>Wide</em>','North river. <em>Broad</em>')]
        for label,first,last in cases:
            with self.subTest(label=label):
                # Independent actual stores, not a replacement implementation.
                home=self.home/label;store=Store(home)
                page=store.execute('create_item',{'kind':'page','title':label,'content':self.original})
                a,b=[store.execute('add_comment',{'item_id':page['id'],'text':text,'anchor':{'quote':quote,'prefix':'','suffix':''}})for text,quote in [('north','North river.'),('south','South garden.')]]
                store.execute('reply_comment',{'id':a['id'],'text':'Keep human'})
                human=store.snapshot()['comments'][0]['replies'][0]
                run=store.begin_run(page['id'],'synthetic-region-thread')
                def op(value,text):return store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':'<p>'+value+'</p><p>South orchard.</p>'}}],[{'comment_id':cid,'text':text}for cid in run['comment_ids']])
                op(first,'First actual edit');one=store.snapshot()['comments'][0]['replies'][-1]
                store.apply_run(run['id'],[],[{'comment_id':a['id'],'text':'Unrelated reply-only outcome'}]);unrelated=store.snapshot()['comments'][0]['replies'][-1]
                op(last,'Second actual edit');two=store.snapshot()['comments'][0]['replies'][-1]
                store.finish_run(run['id'],'completed');before=store.backup_snapshot();c=store.snapshot()['comments'][0]['section_change']
                p=store.execute('preview_section_revert',{k:c[k]for k in ['version_id','generation_id','change_id']})
                (self.out/(label+'-preview.json')).write_text(json.dumps({'state':before,'preview':p},indent=2)+'\n')
                self.assertEqual(p['cleanup_status'],'verified')
                self.assertEqual(set(p['response_ids']),{one['id'],two['id']},'F006 complete cumulative operation outcomes')
                result=store.execute('revert_section',{**{k:p[k]for k in ['version_id','generation_id','change_id','dataset_epoch','content_hash','manual_revision']},'confirmed':True})
                after=Store(home).backup_snapshot()
                self.assertEqual(after['items'][0]['content'],'<p>North river.</p><p>South orchard.</p>')
                self.assertEqual(after['comments'][0]['replies'],[human,unrelated]);self.assertEqual(after['comments'][1],before['comments'][1])
                archive=next(v for v in after['versions']if v['id']==result['recovery_version_id'])
                self.assertEqual([entry['reply']for entry in archive['_removed_responses']],[one,two])
                (self.out/(label+'-comparison.json')).write_text(json.dumps({'before':before,'after':after,'result':result},indent=2)+'\n')
                south=store.snapshot()['comments'][1]['section_change']
                p=store.execute('preview_section_revert',{k:south[k]for k in ['version_id','generation_id','change_id']})
                self.assertEqual(p['response_ids'],[before['comments'][1]['replies'][0]['id']])
                store.execute('revert_section',{**{k:p[k]for k in ['version_id','generation_id','change_id','dataset_epoch','content_hash','manual_revision']},'confirmed':True})
                self.assertEqual(Store(home).snapshot()['comments'][1]['replies'],before['comments'][1]['replies'][1:])

    def test_F007_legacy_imported_missing_outcome_preserve_exact_mapping(self):
        for mode in ['legacy','imported','missing-outcome']:
            with self.subTest(mode=mode):
                if mode=='missing-outcome':
                    run=self.store.begin_run(self.page['id'],'synthetic-review-thread')
                    self.store.apply_run(run['id'],[{'item_id':self.page['id'],'patch':{'content':'<p>North stream.</p><p>South garden.</p>'}}],[])
                    self.store.apply_run(run['id'],[],[{'comment_id':cid,'text':'Later outcome'}for cid in run['comment_ids']]);self.store.finish_run(run['id'],'completed')
                else:self.complete()
                if mode=='legacy':
                    def legacy(state):
                        g=state['versions'][-1]['_section_provenance'][-1]
                        for key in ['response_origin','response_links','response_limitations','response_version']:g.pop(key,None)
                    self.store._transaction(legacy)
                if mode=='imported':self.store.restore_snapshot(self.store.backup_snapshot())
                change=self.comment()['section_change'];self.assertEqual(change['status'],'unavailable')
                self.assertEqual(change.get('highlight_status'),'available','F007 independent exact passage association')
                self.assertEqual(change['anchor']['quote'],'stream');before=self.store.backup_snapshot()
                with self.assertRaises(StoreError):self.revert()
                self.assertEqual(self.store.backup_snapshot(),before)
                # Reset only our fixture document for the next distinct mode.
                self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':self.original}})

    def test_F008_duplicate_empty_cleanup_checkpoint_is_rejected_in_all_modes(self):
        self.complete();self.revert();snapshot=self.store.backup_snapshot();bad=copy.deepcopy(snapshot)
        clone=copy.deepcopy(bad['versions'][-1]);clone['id']='b'*32;clone['section_revert_receipt']['removed_reply_ids']=[];clone['_removed_responses']=[];bad['versions'].append(clone)
        for imported in [False,True]:
            with self.subTest(imported=imported):
                state=copy.deepcopy(bad);state['_locks']={}
                with self.assertRaises(StoreError,msg='F008 duplicate cleanup must be refused'):self.store._validate_state(state,imported=imported)
        before=self.store.backup_snapshot()
        with self.assertRaises(StoreError):self.store.restore_snapshot(bad)
        self.assertEqual(Store(self.home).backup_snapshot(),before)

    def assert_bad_restore(self,bad):
        before=self.store.backup_snapshot()
        for imported in [False,True]:
            state=copy.deepcopy(bad);state['_locks']={}
            with self.assertRaises(StoreError):self.store._validate_state(state,imported=imported)
        with self.assertRaises(StoreError):self.store.restore_snapshot(bad)
        self.assertEqual(Store(self.home).backup_snapshot(),before)

    def test_F008_complete_archive_missing_checkpoint_and_receipt_consistency(self):
        self.complete();self.revert();snapshot=self.store.backup_snapshot()
        mutations=[lambda s:s['versions'].pop(),
                   lambda s:s['versions'][-1].pop('section_revert_receipt'),
                   lambda s:s['versions'][-1].pop('_removed_responses'),
                   lambda s:s['versions'][-1]['_removed_responses'].clear(),
                   lambda s:s['versions'][-1]['section_revert_receipt']['removed_reply_ids'].clear(),
                   lambda s:(s['versions'][-1]['_removed_responses'].clear(),s['versions'][-1]['section_revert_receipt']['removed_reply_ids'].clear()),
                   lambda s:s['versions'][-1]['section_revert_receipt'].update(cleanup_mode='discussion_deleted'),
                   lambda s:s['versions'][-1]['_removed_responses'][0]['reply'].update(author='user')]
        for index,mutate in enumerate(mutations):
            with self.subTest(index=index):
                bad=copy.deepcopy(snapshot);mutate(bad);self.assert_bad_restore(bad)
        # A later user deletion does not invalidate a complete original archive.
        self.store.execute('delete_comment',{'id':self.a['id']})
        deleted=self.store.backup_snapshot();target=Store(self.home/'imported-archive');target.restore_snapshot(deleted)
        expected=copy.deepcopy(deleted['versions'][-1]);expected['snapshot']['thread_id']=None
        self.assertEqual(Store(self.home/'imported-archive').backup_snapshot()['versions'][-1],expected)

    def test_F008_legitimate_deleted_discussion_and_historical_checkpoint(self):
        self.complete();p=self.preview();self.store.execute('delete_comment',{'id':self.a['id']});self.revert(p)
        saved=self.store.backup_snapshot();receipt=saved['versions'][-1]['section_revert_receipt']
        self.assertEqual(receipt['cleanup_mode'],'discussion_deleted');self.assertEqual(receipt['removed_reply_ids'],[])
        target=Store(self.home/'deleted-copy');target.restore_snapshot(saved)
        expected=copy.deepcopy(saved['versions'][-1]);expected['snapshot']['thread_id']=None
        self.assertEqual(Store(self.home/'deleted-copy').backup_snapshot()['versions'][-1],expected)
        # Preserve genuinely pre-cleanup history: it makes no response claim.
        old=copy.deepcopy(saved)
        for v in old['versions']:
            v.pop('section_revert_receipt',None);v.pop('_removed_responses',None)
            for g in v.get('_section_provenance',[]):
                for key in ['response_origin','response_version','response_links','response_limitations']:g.pop(key,None)
        target=Store(self.home/'historical-copy');target.restore_snapshot(old)
        expected=copy.deepcopy(old['versions'][-1]);expected['snapshot']['thread_id']=None
        self.assertEqual(Store(self.home/'historical-copy').backup_snapshot()['versions'][-1],expected)

    def test_F006_uncertain_cumulative_mapping_and_historical_binding_refuse(self):
        overlap=self.store.execute('add_comment',{'item_id':self.page['id'],'text':'Overlapping selection','anchor':{'quote':'North','prefix':'','suffix':''}})
        run=self.store.begin_run(self.page['id'],'synthetic-review-thread')
        self.apply(run,'<p>Wide North river.</p><p>South garden.</p>','First outcome')
        # Deliberately ambiguous overlapping selection in the original capture.
        # Production mapping must retain the explicit limitation, not guess.
        self.apply(run,'<p>Completely replaced passage.</p>','Replacement outcome')
        self.store.finish_run(run['id'],'completed')
        c=self.comment()['section_change'];before=self.store.backup_snapshot()
        self.assertEqual(c['status'],'unavailable');self.assertEqual(c['highlight_status'],'unavailable')
        with self.assertRaises(StoreError):self.revert()
        self.assertEqual(Store(self.home).backup_snapshot(),before)
        # Old persisted application links load as data but cannot assert v2 proof.
        self.store.execute('delete_comment',{'id':overlap['id']})
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':self.original}});self.complete()
        self.store._transaction(lambda s:s['versions'][-1]['_section_provenance'][-1].pop('response_version'))
        c=self.comment()['section_change'];self.assertEqual(c['highlight_status'],'available');self.assertEqual(c['status'],'unavailable')
        self.assertIn('historical',c['reason']);before=self.store.backup_snapshot()
        with self.assertRaises(StoreError):self.revert()
        self.assertEqual(Store(self.home).backup_snapshot(),before)

    def test_F007_detached_ambiguous_and_superseded_do_not_reuse_stale_quote(self):
        self.complete();self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':'<p>Entirely detached.</p>'}})
        c=self.comment()['section_change'];self.assertEqual(c['highlight_status'],'unavailable');self.assertNotIn('anchor',c)

        # Superseded generations never fall back even when the old quote exists.
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':self.original}})
        self.store._transaction(lambda s:s['items'][0].pop('_section_generation',None))
        c=self.comment()['section_change'];self.assertEqual(c['highlight_status'],'unavailable');self.assertNotIn('anchor',c)

    def test_F008_http_restore_refuses_invalid_receipt_and_retry_without_mutation(self):
        import base64
        import hashlib
        import io
        import zipfile
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from hermes_cli.plugin_host_http_auth import with_hosted_admission
        from dashboard.plugin_api import create_router
        from workspace_plugin.interchange import _json_bytes
        self.complete();self.revert();bad=self.store.backup_snapshot()
        clone=copy.deepcopy(bad['versions'][-1]);clone['id']='b'*32;clone['_removed_responses']=[];clone['section_revert_receipt']['removed_reply_ids']=[];bad['versions'].append(clone)
        # Correct framing/digest means refusal exercises graph validation.
        envelope={'format':'workspace-backup','version':1,'snapshot':bad,'sha256':hashlib.sha256(_json_bytes(bad)).hexdigest()}
        data=io.BytesIO()
        with zipfile.ZipFile(data,'w',zipfile.ZIP_STORED)as archive:archive.writestr('snapshot.json',_json_bytes(envelope))
        app=FastAPI();app.include_router(create_router(lambda:self.home),prefix='/api')
        with TestClient(with_hosted_admission(app,True))as client:
            before=client.get('/api/state').json();raw=self.store.backup_snapshot()
            payload={'data_base64':base64.b64encode(data.getvalue()).decode(),'expected_scope':before['scope_id'],'expected_revision':before['revision'],'restore_id':'a'*32,'include_state':False}
            for _ in range(2):
                response=client.post('/api/restore-backup',json=payload);self.assertEqual(response.status_code,400,response.text)
                self.assertIn('Duplicate section cleanup',response.text);self.assertEqual(client.get('/api/state').json(),before)
                self.assertEqual(Store(self.home).backup_snapshot(),raw)
            receipt=client.get('/api/restore-status/'+'a'*32,params={'expected_scope':before['scope_id']}).json()
            self.assertEqual(receipt['status'],'refused')


if __name__=='__main__':unittest.main()
