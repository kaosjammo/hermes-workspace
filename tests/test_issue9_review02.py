"""F009/F010 real production Store and SQLite regressions; external state only."""
from host_auth import host_auth
import copy
import json
import unittest
import test_issue9_review01 as fixtures
from workspace_plugin.store import Store, StoreError


class Review02(unittest.TestCase):
    setUp=fixtures.Review01.setUp
    tearDown=fixtures.Review01.tearDown
    comment=fixtures.Review01.comment
    apply=fixtures.Review01.apply
    complete=fixtures.Review01.complete
    preview=fixtures.Review01.preview
    revert=fixtures.Review01.revert

    def attached_stream(self):
        change=self.comment()['section_change']
        self.assertEqual(change['highlight_status'],'available')
        self.assertEqual(change['anchor']['quote'],'stream')
        return change

    def test_F009_unrelated_later_run_keeps_earlier_effective_passage(self):
        self.complete();first=self.comment();old=self.preview();before=self.store.backup_snapshot()
        self.complete('<p>North stream.</p><p>South orchard.</p>')
        change=self.attached_stream();self.assertEqual(change['status'],'unavailable')
        state=self.store.backup_snapshot()
        with self.assertRaises(StoreError):self.revert(old)
        self.assertEqual(Store(self.home).backup_snapshot(),state)
        self.assertEqual(state['comments'][0],before['comments'][0]|{'replies':self.comment()['replies']})
        self.assertEqual(self.comment()['replies'][:len(first['replies'])],first['replies'])
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':'<p>North stream.</p><p>South orchard.</p><p>Manual outside.</p>'}})
        self.attached_stream()
        self.complete('<p>North stream.</p><p>South grove.</p><p>Manual outside.</p>');self.attached_stream()
        (self.out/'F009-unrelated.json').write_text(json.dumps({'before':before,'after':Store(self.home).backup_snapshot(),'view':self.comment()},indent=2)+'\n')

    def test_F009_latest_revert_returns_to_earlier_effective_passage(self):
        self.complete();first=self.comment();self.complete('<p>North creek.</p><p>South garden.</p>')
        before=self.store.backup_snapshot();result=self.revert();change=self.attached_stream()
        self.assertEqual(change['status'],'reverted');self.assertEqual(self.comment()['replies'],first['replies'])
        after=Store(self.home).backup_snapshot()
        with self.assertRaises(StoreError):self.revert()
        self.assertEqual(Store(self.home).backup_snapshot(),after)
        (self.out/'F009-latest-revert.json').write_text(json.dumps({'before':before,'after':after,'result':result,'view':self.comment()},indent=2)+'\n')
        self.complete('<p>North stream.</p><p>South orchard.</p>');self.attached_stream()

    def test_F010_later_deletion_cannot_erase_prior_archive(self):
        self.complete();self.revert();self.store.execute('delete_comment',{'id':self.a['id']})
        original=self.store.backup_snapshot()
        for mode in ['discussion_deleted',None]:
            bad=copy.deepcopy(original);checkpoint=bad['versions'][-1]
            checkpoint['_removed_responses']=[];checkpoint['section_revert_receipt']['removed_reply_ids']=[]
            if mode is None:checkpoint['section_revert_receipt'].pop('cleanup_mode',None)
            else:checkpoint['section_revert_receipt']['cleanup_mode']=mode
            for imported in [False,True]:
                with self.subTest(mode=mode,imported=imported):
                    state=copy.deepcopy(bad);state['_locks']={}
                    with self.assertRaises(StoreError):self.store._validate_state(state,imported=imported)
            with self.subTest(mode=mode,operation='restore'):
                before=self.store.backup_snapshot()
                with self.assertRaises(StoreError):self.store.restore_snapshot(bad)
                self.assertEqual(Store(self.home).backup_snapshot(),before)

    def test_F009_full_restore_and_uncertainty_remain_detached(self):
        self.complete();second=self.complete('<p>North creek.</p><p>South garden.</p>');old=self.preview()
        self.store.execute('restore_version',{'id':second['version_ids'][0]})
        change=self.comment()['section_change'];self.assertEqual(change['highlight_status'],'unavailable');self.assertNotIn('anchor',change)
        before=self.store.backup_snapshot()
        with self.assertRaises(StoreError):self.revert(old)
        self.assertEqual(Store(self.home).backup_snapshot(),before)
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':'<p>Entirely replaced passage.</p>'}})
        change=self.comment()['section_change'];self.assertEqual(change['highlight_status'],'unavailable');self.assertNotIn('anchor',change)

    def bad_restore(self,bad):
        before=self.store.backup_snapshot()
        for imported in [False,True]:
            data=copy.deepcopy(bad);data['_locks']={}
            with self.assertRaises(StoreError):self.store._validate_state(data,imported=imported)
        for _ in range(2):
            with self.assertRaises(StoreError):self.store.restore_snapshot(bad)
            self.assertEqual(Store(self.home).backup_snapshot(),before)

    def test_F010_predeleted_legacy_and_timezone_chronology(self):
        self.complete();preview=self.preview();before=self.store.backup_snapshot()
        self.store.execute('delete_comment',{'id':self.a['id']});deleted=self.store.backup_snapshot();self.revert(preview)
        valid=self.store.backup_snapshot()
        for mode in ['discussion_deleted',None]:
            positive=copy.deepcopy(valid)
            if mode is None:positive['versions'][-1]['section_revert_receipt'].pop('cleanup_mode')
            target=Store(self.home/('valid-'+str(mode)));target.restore_snapshot(positive)
            self.assertEqual(Store(target.profile_home).backup_snapshot()['versions'][-1]['_removed_responses'],[])
        # Different ISO offsets are compared as instants, never as text.
        utc=copy.deepcopy(valid);utc['comments'][0]['created_at']='2026-01-01T08:00:00Z'
        utc['comments'][0]['_deleted_at']='2026-01-01T20:00:00+11:00'  #09:00UTC
        utc['versions'][-1]['created_at']='2026-01-01T10:00:00Z'
        utc['versions'][0]['_section_provenance'][-1]['changes'][0]['reverted_at']='2026-01-01T10:00:01+00:00'
        target=Store(self.home/'offset-valid');target.restore_snapshot(utc)
        cases=[]
        for mode in ['discussion_deleted',None]:
            for deletion in ['2026-01-01T09:30:00-11:00','2026-01-01T10:00:00+00:00','2026-01-01T07:00:00Z','2026-01-01T09:00:00','not-a-time','0001-01-01T00:00:00+14:00',None]:
                bad=copy.deepcopy(utc)
                if mode is None:bad['versions'][-1]['section_revert_receipt'].pop('cleanup_mode')
                if deletion is None:bad['comments'][0].pop('_deleted_at')
                else:bad['comments'][0]['_deleted_at']=deletion
                with self.subTest(mode=mode,deletion=deletion):self.bad_restore(bad)
                cases.append({'mode':mode,'deletion':deletion,'result':'REFUSED_NO_MUTATION_BOTH_VALIDATION_MODES_RETRY_REOPEN'})
        bad=copy.deepcopy(utc);bad['versions'][-1]['created_at']='2026-01-01T10:00:02Z';self.bad_restore(bad)
        (self.out/'F010-predeleted-chronology.json').write_text(json.dumps({'before':before,'deletedBeforeCleanup':deleted,'after':valid,'offsetPositive':utc,'refusals':cases},indent=2)+'\n')

    def test_F010_later_deletion_preserves_full_archive_and_http_refusal_retry(self):
        import base64,hashlib,io,zipfile
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from hermes_cli.plugin_host_http_auth import with_hosted_admission
        from dashboard.plugin_api import create_router
        from workspace_plugin.interchange import _json_bytes
        self.complete();before=self.store.backup_snapshot();result=self.revert();cleaned=self.store.backup_snapshot()
        self.store.execute('delete_comment',{'id':self.a['id']});deleted=self.store.backup_snapshot()
        for mode in ['responses_archived',None]:
            valid=copy.deepcopy(deleted)
            if mode is None:valid['versions'][-1]['section_revert_receipt'].pop('cleanup_mode')
            target=Store(self.home/('archive-'+str(mode)));target.restore_snapshot(valid)
            self.assertEqual(target.backup_snapshot()['versions'][-1]['_removed_responses'],cleaned['versions'][-1]['_removed_responses'])
        app=FastAPI();app.include_router(create_router(lambda:self.home,authorize=host_auth),prefix='/api')
        with TestClient(with_hosted_admission(app,True))as client:
            state=client.get('/api/state').json()
            for index,mode in enumerate(['discussion_deleted',None]):
                bad=copy.deepcopy(deleted);v=bad['versions'][-1];v['_removed_responses']=[];v['section_revert_receipt']['removed_reply_ids']=[]
                if mode is None:v['section_revert_receipt'].pop('cleanup_mode')
                else:v['section_revert_receipt']['cleanup_mode']=mode
                envelope={'format':'workspace-backup','version':1,'snapshot':bad,'sha256':hashlib.sha256(_json_bytes(bad)).hexdigest()};data=io.BytesIO()
                with zipfile.ZipFile(data,'w',zipfile.ZIP_STORED)as archive:archive.writestr('snapshot.json',_json_bytes(envelope))
                restore_id=str(index)*32
                payload={'data_base64':base64.b64encode(data.getvalue()).decode(),'expected_scope':state['scope_id'],'expected_revision':state['revision'],'restore_id':restore_id,'include_state':False}
                for _ in range(2):
                    response=client.post('/api/restore-backup',json=payload);self.assertEqual(response.status_code,400,response.text)
                    self.assertEqual(client.get('/api/state').json(),state);self.assertEqual(Store(self.home).backup_snapshot(),deleted)
                self.assertEqual(client.get('/api/restore-status/'+restore_id,params={'expected_scope':state['scope_id']}).json()['status'],'refused')
        (self.out/'F010-later-chronology.json').write_text(json.dumps({'before':before,'cleaned':cleaned,'deletedAfterCleanup':deleted,'reopened':Store(self.home).backup_snapshot(),'result':result},indent=2)+'\n')


if __name__=='__main__':unittest.main()
