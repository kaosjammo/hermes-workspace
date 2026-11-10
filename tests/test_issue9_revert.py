"""Issue 9: real Store transactions/reopen, synthetic admitted application runs.

All writable fixtures require an external issue-owned scratch directory. These
direct Store runs do not establish native completion/provider acceptance.
"""
import copy
import json
import os
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from workspace_plugin.store import Store, StoreError
from workspace_plugin.shared_workspaces import SharedWorkspaces, profile_key


class RevertResponses(unittest.TestCase):
    def setUp(self):
        root = Path(os.environ['ISSUE9_EVIDENCE'])/'fixtures'
        root.mkdir(parents=True,exist_ok=True)
        self.temp = TemporaryDirectory(dir=root)
        self.home = Path(self.temp.name)
        self.store = Store(self.home)
        self.original = '<p>North river.</p><p>South garden.</p>'
        self.page = self.store.execute('create_item',{'kind':'page','title':'Synthetic section cleanup','content':self.original})
        self.a,self.b = [self.store.execute('add_comment',{'item_id':self.page['id'],'text':text,
            'anchor':{'quote':quote,'prefix':'','suffix':''}}) for text,quote in [('Revise north','North river.'),('Revise south','South garden.')]]
        self.store.execute('reply_comment',{'id':self.a['id'],'text':'Human feedback stays.'})

    def tearDown(self):
        self.temp.cleanup()

    def run_begin(self):
        return self.store.begin_run(self.page['id'],'synthetic-same-native-thread')

    def apply(self,run,content=None,label='outcome'):
        edits=[] if content is None else [{'item_id':self.page['id'],'patch':{'content':content}}]
        replies=[{'comment_id':cid,'text':label} for cid in run['comment_ids']]
        return self.store.apply_run(run['id'],edits,replies)

    def comment(self,c=None):
        return next(x for x in self.store.snapshot()['comments'] if x['id']==(c or self.a)['id'])

    def preview(self,c=None):
        change=self.comment(c)['section_change']
        return self.store.execute('preview_section_revert',{k:change[k] for k in ('version_id','generation_id','change_id')})

    def revert(self,p=None,confirmed=True):
        p=p or self.preview()
        return self.store.execute('revert_section',{**{k:p[k] for k in ('version_id','generation_id','change_id','content_hash','manual_revision','dataset_epoch')},'confirmed':confirmed})

    def content(self):
        return next(x['content'] for x in self.store.snapshot()['items'] if x['id']==self.page['id'])

    def test_two_comments_exact_cleanup_identity_audit_and_reopen(self):
        run=self.run_begin();self.apply(run,'<p>North stream.</p><p>South orchard.</p>')
        self.store.finish_run(run['id'],'completed')
        before=self.store.backup_snapshot();north=self.comment();south=self.comment(self.b)
        removed=north['replies'][-1];human=north['replies'][0]
        result=self.revert();self.store=Store(self.home)
        self.assertEqual(self.content(),'<p>North river.</p><p>South orchard.</p>')
        self.assertEqual(self.comment()['replies'],[human]);self.assertEqual(self.comment(self.b)['replies'],south['replies'])
        for key in ('id','item_id','text','anchor','resolved','created_at','author_identity'):
            self.assertEqual(self.comment()[key],north[key])
        self.assertFalse(self.comment()['resolved'])
        raw=self.store.backup_snapshot();checkpoint=next(v for v in raw['versions'] if v['id']==result['recovery_version_id'])
        self.assertEqual(checkpoint['_removed_responses'],[{'comment_id':self.a['id'],'reply':removed}])
        self.assertEqual(checkpoint['section_revert_receipt']['removed_reply_ids'],[removed['id']])
        self.assertEqual(checkpoint['snapshot']['content'],before['items'][0]['content'])
        self.assertEqual(raw['runs'],before['runs'])
        self.revert(self.preview(self.b));self.assertEqual(self.content(),self.original)

    def test_same_run_cumulative_changes_remove_each_actual_operation_only(self):
        run=self.run_begin()
        self.apply(run,'<p>North stream.</p><p>South garden.</p>','first')
        first=self.comment()['replies'][-1];south_unrelated=self.comment(self.b)['replies'][-1]
        self.apply(run,'<p>North creek.</p><p>South orchard.</p>','second')
        second=self.comment()['replies'][-1]
        self.store.finish_run(run['id'],'completed')
        self.revert();self.store=Store(self.home)
        self.assertEqual(self.content(),'<p>North river.</p><p>South orchard.</p>')
        self.assertEqual([r['author'] for r in self.comment()['replies']],['user'])
        self.assertEqual(self.comment(self.b)['replies'][0],south_unrelated)
        self.assertEqual(self.comment(self.b)['replies'][-1]['text'],'second')
        raw=self.store.backup_snapshot();receipt=raw['versions'][-1]['section_revert_receipt']
        self.assertEqual(receipt['removed_reply_ids'],[first['id'],second['id']])

    def test_same_run_other_section_operation_does_not_bind_unchanged_outcome(self):
        run=self.run_begin();self.apply(run,'<p>North stream.</p><p>South garden.</p>','north operation')
        self.apply(run,'<p>North stream.</p><p>South orchard.</p>','south operation')
        self.store.finish_run(run['id'],'completed')
        unrelated=self.comment()['replies'][-1]
        self.revert();self.assertEqual(self.comment()['replies'][-1],unrelated)
        self.assertEqual(self.content(),'<p>North river.</p><p>South orchard.</p>')

    def test_later_run_revert_retains_earlier_effective_outcome_and_human_rename(self):
        first=self.run_begin();self.apply(first,'<p>North stream.</p><p>South garden.</p>','earlier')
        self.store.finish_run(first['id'],'completed');earlier=self.comment()['replies'][-1]
        second=self.run_begin();self.assertEqual(set(second['comment_ids']),{self.a['id'],self.b['id']})
        self.apply(second,'<p>North creek.</p><p>South orchard.</p>','later');self.store.finish_run(second['id'],'completed')
        self.store.execute('set_username',{'name':'Renamed human','expected_revision':self.store.snapshot()['revision']})
        human=self.comment()['replies'][0]
        self.revert();self.store=Store(self.home)
        self.assertEqual(self.content(),'<p>North stream.</p><p>South orchard.</p>')
        self.assertEqual(self.comment()['replies'],[human,earlier])

    def test_reply_only_apply_retry_and_revert_retry_have_no_extra_effects(self):
        run=self.run_begin();self.apply(run,None,'unrelated reply only');unrelated=self.comment()['replies'][-1]
        self.apply(run,'<p>North stream.</p><p>South garden.</p>','actual change')
        before=self.store.backup_snapshot();self.apply(run,'<p>North stream.</p><p>South garden.</p>','actual change')
        self.assertEqual(before,self.store.backup_snapshot())
        self.store.finish_run(run['id'],'completed');p=self.preview();self.revert(p)
        before=self.store.backup_snapshot()
        with self.assertRaisesRegex(StoreError,'already reverted'):self.revert(p)
        self.assertEqual(before,self.store.backup_snapshot());self.assertEqual(self.comment()['replies'][-1],unrelated)

    def test_manual_already_restored_and_edit_without_exact_outcome_fail_closed(self):
        run=self.run_begin();self.apply(run,'<p>North stream.</p><p>South garden.</p>');self.store.finish_run(run['id'],'completed')
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':self.original}})
        before=self.store.backup_snapshot()
        self.assertIn('no eligible change',self.comment()['section_change']['reason'])
        with self.assertRaisesRegex(StoreError,'no eligible change'):self.preview()
        self.assertEqual(before,self.store.backup_snapshot())
        run=self.run_begin()
        self.store.apply_run(run['id'],[{'item_id':self.page['id'],'patch':{'content':'<p>North creek.</p><p>South garden.</p>'}}],[])
        self.apply(run,None,'later separate explanation')
        self.store.finish_run(run['id'],'completed')
        self.assertEqual(self.comment()['section_change']['status'],'unavailable')
        self.assertIn('no outcome',self.comment()['section_change']['reason'])
        before=self.store.backup_snapshot()
        with self.assertRaisesRegex(StoreError,'no outcome'):self.revert(self.preview())
        self.assertEqual(before,self.store.backup_snapshot())

    def test_manual_confirmation_stale_epoch_revision_lock_and_precommit_fault(self):
        run=self.run_begin();self.apply(run,'<p>North stream.</p><p>South orchard.</p>');self.store.finish_run(run['id'],'completed')
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':'<p>North manual stream.</p><p>South orchard.</p><p>Keep outside.</p>'}})
        p=self.preview();before=self.store.backup_snapshot()
        self.assertTrue(p['requires_confirmation'])
        with self.assertRaisesRegex(StoreError,'Confirm'):self.revert(p,False)
        self.assertEqual(before,self.store.backup_snapshot())
        for key,value in [('dataset_epoch','foreign'),('content_hash','f'*64),('manual_revision',-1)]:
            with self.assertRaises(StoreError):self.revert({**p,key:value})
            self.assertEqual(before,self.store.backup_snapshot())
        original=self.store._save
        def fail(conn,state,*args):
            original(conn,state,*args)
            self.assertEqual(state['comments'][0]['replies'][0]['author'],'user')
            self.assertEqual(len(state['comments'][0]['replies']),1)
            raise sqlite3.OperationalError('injected after actual SQLite writes before commit')
        with patch.object(self.store,'_save',fail),self.assertRaisesRegex(StoreError,'injected'):self.revert(p)
        self.assertEqual(before,Store(self.home).backup_snapshot())
        lock=self.run_begin();locked=self.store.backup_snapshot()
        with self.assertRaises(StoreError):self.revert(p)
        self.assertEqual(locked,self.store.backup_snapshot());self.store.finish_run(lock['id'],'cancelled')
        self.revert(p);self.assertIn('<p>Keep outside.</p>',self.content());self.assertIn('North river.',self.content())

    def test_backup_restore_preserves_archive_but_never_mints_application_authority(self):
        run=self.run_begin();self.apply(run,'<p>North stream.</p><p>South orchard.</p>');self.store.finish_run(run['id'],'completed')
        backup=self.store.backup_snapshot();old=self.preview()
        self.store.restore_snapshot(copy.deepcopy(backup))
        self.assertEqual(self.store.snapshot()['runs'],[])
        self.assertEqual(self.comment()['section_change']['status'],'unavailable')
        self.assertIn('imported',self.comment()['section_change']['reason'])
        before=self.store.backup_snapshot()
        with self.assertRaisesRegex(StoreError,'replaced'):self.revert(old)
        with self.assertRaisesRegex(StoreError,'trusted'):self.revert(self.preview())
        self.assertEqual(before,self.store.backup_snapshot())
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':'<p>Entirely detached.</p>'}})
        before=self.store.backup_snapshot()
        with self.assertRaises(StoreError):self.preview()
        self.assertEqual(before,self.store.backup_snapshot())
        original=backup['versions'][0]['_section_provenance'][0]
        recovered=before['versions'][0]['_section_provenance'][0]
        self.assertEqual(original['response_links'],recovered['response_links'])
        self.assertEqual(backup['comments'],before['comments'])

    def test_malformed_provenance_and_client_injection_refused_without_mutation(self):
        run=self.run_begin();self.apply(run,'<p>North stream.</p><p>South garden.</p>');self.store.finish_run(run['id'],'completed')
        before=self.store.backup_snapshot()
        for mutate in [lambda g:g.update(response_origin='browser'),lambda g:g['response_links'][0].update(reply_ids=[self.comment()['replies'][0]['id']]),
                       lambda g:g['response_links'][0].update(operation_id='f'*64),lambda g:g['response_links'][0].update(comment_id=self.b['id'])]:
            bad=copy.deepcopy(before);mutate(bad['versions'][0]['_section_provenance'][0])
            with self.assertRaises(StoreError):self.store.restore_snapshot(bad)
            self.assertEqual(before,self.store.backup_snapshot())
        with self.assertRaises(StoreError):self.store.apply_run(run['id'],[],[{'comment_id':self.a['id'],'text':'forged','reply_ids':['x']}])
        with self.assertRaises(StoreError):self.store.execute('reply_comment',{'id':self.a['id'],'text':'forged','operation_id':'f'*64})
        self.assertEqual(before,self.store.backup_snapshot())

    def test_canonical_backup_after_cleanup_retains_full_removed_response_archive(self):
        from workspace_plugin.interchange import backup,read_backup
        run=self.run_begin();self.apply(run,'<p>North stream.</p><p>South orchard.</p>');self.store.finish_run(run['id'],'completed')
        removed=copy.deepcopy(self.comment()['replies'][-1]);self.revert()
        raw=self.store.backup_snapshot();blob=backup(raw);canonical=read_backup(blob)
        target=Store(self.home/'recovered');target.restore_snapshot(canonical)
        restored=target.backup_snapshot()
        self.assertEqual(restored['runs'],[])
        self.assertEqual(restored['versions'][-1]['_removed_responses'],[{'comment_id':self.a['id'],'reply':removed}])
        self.assertEqual(restored['versions'][-1]['section_revert_receipt'],raw['versions'][-1]['section_revert_receipt'])
        self.assertEqual(restored['comments'],raw['comments'])
        self.assertNotIn(removed['id'],[r['id']for c in target.snapshot()['comments']for r in c['replies']])

    def test_historical_missing_or_ambiguous_provenance_and_detached_anchor(self):
        run=self.run_begin();self.apply(run,'<p>North stream.</p><p>South garden.</p>');self.store.finish_run(run['id'],'completed')
        def legacy(state):
            for g in state['versions'][0]['_section_provenance']:
                for key in ['response_origin','response_links','response_limitations']:g.pop(key)
        self.store._transaction(legacy)
        self.assertEqual(self.comment()['section_change']['status'],'unavailable')
        before=self.store.backup_snapshot()
        with self.assertRaisesRegex(StoreError,'trusted'):self.revert(self.preview())
        self.assertEqual(before,self.store.backup_snapshot())

    def test_production_http_admission_scope_revision_fault_and_reopen(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from hermes_cli.plugin_host_http_auth import with_hosted_admission
        from dashboard.plugin_api import create_router, _module
        run=self.run_begin();self.apply(run,'<p>North stream.</p><p>South orchard.</p>');self.store.finish_run(run['id'],'completed')
        app=FastAPI();app.include_router(create_router(lambda:self.home),prefix='/api')
        with TestClient(with_hosted_admission(app,True)) as client,TestClient(with_hosted_admission(app,False)) as denied:
            before=client.get('/api/state').json();p=self.preview()
            payload={**{k:p[k] for k in ('version_id','generation_id','change_id','content_hash','manual_revision','dataset_epoch')},'confirmed':True,'expected_revision':before['revision']}
            body={'op':'revert_section','payload':payload,'expected_scope':before['scope_id']}
            self.assertEqual(denied.post('/api/command',json=body).status_code,401)
            for change in [{'expected_scope':'foreign'},{'payload':{**payload,'expected_revision':-1}},{'payload':{**payload,'reply_ids':['forged']}}]:
                self.assertGreaterEqual(client.post('/api/command',json={**body,**change}).status_code,400)
                self.assertEqual(client.get('/api/state').json(),before)
            api_store=_module('store').Store
            original=api_store._save
            def fail(instance,conn,state,*args):
                original(instance,conn,state,*args)
                raise sqlite3.OperationalError('HTTP precommit fault')
            with patch.object(api_store,'_save',fail):
                self.assertGreaterEqual(client.post('/api/command',json=body).status_code,400)
            self.assertEqual(client.get('/api/state').json(),before)
            response=client.post('/api/command',json=body)
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(len(response.json()['result']['removed_reply_ids']),1)
            self.assertEqual(Store(self.home).snapshot()['comments'][0]['replies'][0]['author'],'user')

    def test_shared_readonly_nonmember_and_stale_membership_preserve_exact_data(self):
        service=SharedWorkspaces(self.home/'synthetic-shared')
        owner,reader,outsider=[profile_key(self.home/name) for name in ('owner','reader','outsider')]
        project=service.create(owner,'Synthetic shared',[{'profile_id':reader,'role':'read_only'}])
        pid=project['id'];shared=service._store(pid)
        def command(op,payload):
            view=service.snapshot(owner,pid)
            return service.execute(owner,pid,op,{**payload,'expected_revision':view['state']['revision']},membership_revision=view['workspace']['membership_revision'],expected_scope=view['state']['scope_id'])['result']
        page=command('create_item',{'kind':'page','title':'Shared','content':'<p>North river.</p>'})
        c=command('add_comment',{'item_id':page['id'],'text':'Shared north','anchor':{'quote':'North river.','prefix':'','suffix':''}})
        run=shared.begin_run(page['id'],'synthetic-shared-run')
        shared.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':'<p>North stream.</p>'}}],[{'comment_id':c['id'],'text':'Shared outcome'}]);shared.finish_run(run['id'],'completed')
        change=shared.snapshot()['comments'][0]['section_change']
        p=shared.execute('preview_section_revert',{k:change[k]for k in ('version_id','generation_id','change_id')})
        before=shared.backup_snapshot();payload={**{k:p[k] for k in ('version_id','generation_id','change_id','content_hash','manual_revision','dataset_epoch')},'confirmed':True,'expected_revision':before['revision']}
        for actor,revision,status in [(reader,1,403),(outsider,1,403),(owner,0,409)]:
            with self.assertRaises(StoreError)as error:service.execute(actor,pid,'revert_section',payload,membership_revision=revision,expected_scope=shared.scope_id)
            self.assertEqual(error.exception.status,status);self.assertEqual(shared.backup_snapshot(),before)
        command('revert_section',{k:v for k,v in payload.items()if k!='expected_revision'})
        self.assertEqual(service._store(pid).snapshot()['comments'][0]['replies'],[])

    def test_real_workflow_claim_completion_stop_and_all_unresolved_outcomes(self):
        # Reuse the real native admission fixture, never a bypass of its guards.
        from test_workflow import WorkflowTests
        from hermes_state_runtime import claim_session_input,settle_session_input
        fixture=WorkflowTests('test_all_unresolved_persistent_binding_scope_and_restore')
        fixture.setUp()
        try:
            anchored=fixture.store.execute('add_comment',{'item_id':fixture.page['id'],'text':'Anchored separate outcome','anchor':{'quote':'Before','prefix':'','suffix':''}})
            prepared=fixture.prepare();row=fixture.admit(prepared,claim=False)
            replies=[{'comment_id':cid,'text':'Own admitted synthetic outcome'}for cid in prepared['run']['comment_ids']]
            edits=[{'item_id':fixture.page['id'],'patch':{'content':'<p>After</p>'}}]
            before=fixture.store.backup_snapshot()
            with self.assertRaises(ValueError):fixture.apply(prepared,row,edits=edits,replies=replies)
            self.assertEqual(before,fixture.store.backup_snapshot())
            row=claim_session_input(fixture.db,epoch=fixture.epoch,session_id='native-one')
            fixture.apply(prepared,row,edits=edits,replies=replies)
            settle_session_input(fixture.db,epoch=fixture.epoch,admission_id=row['admission_id'],generation=row['generation'],outcome='completed')
            self.assertEqual(fixture.flow.status(prepared['run']['id'])['run']['status'],'completed')
            self.assertIn(fixture.answered['id'],prepared['run']['comment_ids']);self.assertNotIn(fixture.resolved['id'],prepared['run']['comment_ids'])
            saved=fixture.store.snapshot();c=next(c for c in saved['comments']if c['id']==anchored['id']);ref=c['section_change']
            p=fixture.store.execute('preview_section_revert',{k:ref[k]for k in ('version_id','generation_id','change_id')})
            fixture.store.execute('revert_section',{**{k:p[k]for k in ('version_id','generation_id','change_id','content_hash','manual_revision','dataset_epoch')},'confirmed':True})
            current=Store(fixture.home).snapshot()
            self.assertEqual(next(c for c in current['comments']if c['id']==anchored['id'])['replies'],[])
            self.assertEqual([c for c in current['comments']if c['id']!=anchored['id']],[c for c in saved['comments']if c['id']!=anchored['id']])
            again=fixture.prepare();row=fixture.admit(again);fixture.flow.stop(again['run']['id']);before=fixture.store.backup_snapshot()
            with self.assertRaises(ValueError):fixture.apply(again,row,edits=edits,replies=replies)
            self.assertEqual(before,fixture.store.backup_snapshot())
        finally:fixture.tearDown()


if __name__=='__main__':unittest.main()
