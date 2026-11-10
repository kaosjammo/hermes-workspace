"""Issue 10 acceptance against production Store; synthetic homes only."""
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import copy
import json
import subprocess
import sys
from unittest.mock import patch

from workspace_plugin.store import Store, StoreError
from workspace_plugin.identity import executor, human_id
from workspace_plugin.shared_workspaces import SharedWorkspaces, profile_key


class IdentityTests(unittest.TestCase):
    def setUp(self):
        root = Path(os.environ['HWS_QUALIFICATION_HOME']) / 'fixtures'
        root.mkdir(parents=True, exist_ok=True)
        self.temp = TemporaryDirectory(dir=root)
        self.home = Path(self.temp.name)
        self.store = Store(self.home)

    def tearDown(self):
        self.temp.cleanup()

    def page_comment(self):
        page = self.store.execute('create_item', {'kind':'page','title':'Garden','content':'<p>North path.</p>'})
        comment = self.store.execute('add_comment', {'item_id':page['id'],'text':'Keep the north path.','anchor':{'quote':'North path.','prefix':'','suffix':''}})
        return page, comment

    def test_username_save_reset_restart_and_existing_discussions(self):
        page = self.store.execute('create_item', {'kind':'page','title':'Synthetic garden'})
        comment = self.store.execute('add_comment', {'item_id':page['id'],'text':'Keep this feedback.'})
        self.store.execute('reply_comment', {'id':comment['id'],'text':'Keep this reply.'})
        before = self.store.snapshot(include_identity=True)
        self.store.execute('set_username', {'name':'庭 🌿', 'expected_revision':before['revision']})
        state = Store(self.home).snapshot(include_identity=True)
        self.assertEqual(state['identity']['human']['name'], '庭 🌿')
        self.assertEqual(state['comments'][0]['author_identity']['name'], '庭 🌿')
        self.assertEqual(state['comments'][0]['replies'][0]['author_identity']['name'], '庭 🌿')
        self.assertEqual(state['comments'][0]['id'], comment['id'])
        self.assertEqual(state['comments'][0]['text'], comment['text'])
        self.store.execute('set_username', {'name':'', 'expected_revision':state['revision']})
        self.assertEqual(Store(self.home).snapshot(include_identity=True)['identity']['human']['name'], 'user')

    def test_actual_process_restart_and_later_rename_keep_ids_text_and_history(self):
        page, comment = self.page_comment()
        self.store.execute('reply_comment', {'id':comment['id'],'text':'Human response'})
        run = self.store.begin_run(page['id'],'synthetic-thread')
        self.store.apply_run(run['id'],[],[{'comment_id':comment['id'],'text':'Legacy generic outcome'}])
        self.store.finish_run(run['id'],'completed')
        before = self.store.backup_snapshot()
        self.store.execute('set_username', {'name':'First name','expected_revision':before['revision']})
        child = subprocess.run([sys.executable,'-c',
            'from pathlib import Path;from workspace_plugin.store import Store;import sys,json;print(json.dumps(Store(Path(sys.argv[1])).snapshot(include_identity=True)))',str(self.home)],
            capture_output=True,text=True,check=True)
        restarted = json.loads(child.stdout)
        self.assertEqual(restarted['identity']['human']['name'],'First name')
        self.store.execute('set_username', {'name':'Renamed 庭','expected_revision':restarted['revision']})
        after = self.store.backup_snapshot()
        old, new = before['comments'][0], after['comments'][0]
        for key in ('id','item_id','text','anchor','resolved','created_at','target_item_ids'):
            self.assertEqual(old[key],new[key])
        self.assertEqual([(r['id'],r['author'],r['text']) for r in old['replies']],[(r['id'],r['author'],r['text']) for r in new['replies']])
        self.assertEqual(before['items'],after['items'])
        self.assertEqual(before['versions'],after['versions'])
        self.assertEqual(before['runs'],after['runs'])
        self.assertEqual(new['replies'][1]['author_identity'],None)

    def test_validation_stale_revision_scope_and_actor_payloads_fail_without_mutation(self):
        page, comment = self.page_comment()
        before = self.store.snapshot()
        for payload in ({'name':[]},{'name':'x'*81},{'name':'line\nbreak'},{'name':'hidden\u202ename'},
                        {'name':'ok','actor':'forged'},{'name':'ok','expected_revision':-1},
                        {'name':'ok','expected_scope':'foreign'}):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                self.store.execute('set_username',{'expected_revision':before['revision'],**payload})
            self.assertEqual(self.store.snapshot(),before)
        for op,payload in [('add_comment',{'item_id':page['id'],'text':'forged','author_identity':{'id':'fake'}}),
                           ('reply_comment',{'id':comment['id'],'text':'forged','author':'agent'})]:
            with self.assertRaises(ValueError): self.store.execute(op,payload)
        self.assertEqual(self.store.snapshot(),before)

    def test_private_legacy_is_known_but_imported_unknown_legacy_is_never_claimed(self):
        _, comment = self.page_comment()
        def legacy(state):
            state['comments'][0].pop('author_identity')
            self.store._reply(state['comments'][0],'Old human reply','user')
            state['comments'][0]['replies'][0].pop('author_identity')
        self.store._transaction(legacy)
        self.store.execute('set_username',{'name':'Known owner','expected_revision':self.store.snapshot()['revision']})
        self.assertEqual(self.store.snapshot()['comments'][0]['author_identity']['id'],human_id(self.home))
        archive = self.store.backup_snapshot()
        archive['comments'][0].pop('author_identity')
        archive['comments'][0]['replies'][0].pop('author_identity')
        target = Store(self.home/'receiving')
        target.restore_snapshot(archive)
        target.execute('set_username',{'name':'Different owner','expected_revision':target.snapshot()['revision']})
        self.assertIsNone(target.snapshot()['comments'][0]['author_identity'])
        self.assertIsNone(target.snapshot()['comments'][0]['replies'][0]['author_identity'])

    def test_two_known_shared_humans_and_unknown_legacy_rename_independently(self):
        service = SharedWorkspaces(self.home/'shared')
        alice,bob,reader = [profile_key(self.home/n) for n in ('alice','bob','reader')]
        project = service.create(alice,'Shared garden',[{'profile_id':bob},{'profile_id':reader,'role':'read_only'}])
        ident = project['id']; scope = service.snapshot(alice,ident)['state']['scope_id']
        def command(actor,op,payload):
            state=service.snapshot(actor,ident)['state']
            return service.execute(actor,ident,op,{**payload,'expected_revision':state['revision']},membership_revision=1,expected_scope=scope)
        page=command(alice,'create_item',{'kind':'page','title':'Shared'})['result']
        ac=command(alice,'add_comment',{'item_id':page['id'],'text':'Alice feedback'})['result']
        bc=command(bob,'add_comment',{'item_id':page['id'],'text':'Bob feedback'})['result']
        command(bob,'reply_comment',{'id':ac['id'],'text':'Bob reply on Alice thread'})
        shared=service._store(ident)
        def legacy(state):
            old=copy.deepcopy(state['comments'][0]);old['id']='legacy-unknown';old['replies']=[];old.pop('author_identity');state['comments'].append(old)
        shared._transaction(legacy)
        command(alice,'set_username',{'name':'Alice Ω'})
        command(bob,'set_username',{'name':'Bob 東京'})
        command(alice,'set_username',{'name':'Alice renamed'})
        rows=SharedWorkspaces(self.home/'shared').snapshot(bob,ident)['state']['comments']
        self.assertEqual(rows[0]['author_identity']['name'],'Alice renamed')
        self.assertEqual(rows[0]['replies'][0]['author_identity']['name'],'Bob 東京')
        self.assertEqual(rows[1]['author_identity']['id'],bob)
        self.assertNotIn('author_identity',rows[2])
        before=shared.backup_snapshot()
        for actor in (reader,profile_key(self.home/'unlisted')):
            with self.assertRaises(StoreError): command(actor,'set_username',{'name':'forged'})
        with self.assertRaises(StoreError):
            service.execute(alice,ident,'set_username',{'name':'forged','expected_revision':before['revision']},membership_revision=2,expected_scope=scope)
        self.assertEqual(shared.backup_snapshot(),before)

    def test_agent_capture_uses_actual_public_home_metadata_and_persists_author_time(self):
        from hermes_constants import set_hermes_home_override, reset_hermes_home_override
        base=self.home/'host'; profile=base/'profiles'/'alpha'; profile.mkdir(parents=True)
        (profile/'profile.yaml').write_text(json.dumps({'display_name':'Display alpha','ui_meta':{'hermes-bots':{'title':'Aster Ω'}}}))
        with patch.dict(os.environ,{'HERMES_HOME':str(base),'HERMES_PROFILE_NAME':'wrong-launch-profile'}):
            token=set_hermes_home_override(profile)
            try: captured=executor(profile)
            finally: reset_hermes_home_override(token)
        self.assertEqual(captured['profile'],'alpha')
        self.assertEqual(captured['name'],'Aster Ω')
        page,comment=self.page_comment()
        run=self.store.begin_run(page['id'],'native',executor_identity=captured)
        (profile/'profile.yaml').write_text(json.dumps({'display_name':'Later selected model is irrelevant'}))
        self.store.apply_run(run['id'],[],[{'comment_id':comment['id'],'text':'Captured alpha outcome'}])
        self.store.finish_run(run['id'],'completed')
        later={**captured,'name':'Birch 東京','id':'b'*64,'profile':'beta','source_id':'c'*64}
        run2=self.store.begin_run(page['id'],'native',executor_identity=later)
        self.store.apply_run(run2['id'],[],[{'comment_id':comment['id'],'text':'Captured beta outcome'}])
        rows=Store(self.home).snapshot()['comments'][0]['replies']
        self.assertEqual(rows[0]['author_identity'],captured)
        self.assertEqual(rows[1]['author_identity'],later)
        before=self.store.snapshot()
        with self.assertRaises(StoreError):
            self.store.apply_run(run2['id'],[],[{'comment_id':comment['id'],'text':'Spoof','author_identity':captured}])
        self.assertEqual(self.store.snapshot(),before)

    def test_backup_preserves_inert_names_ids_and_detaches_asset_authority(self):
        from workspace_plugin.interchange import backup, read_backup
        page,comment=self.page_comment()
        self.store.execute('set_username',{'name':'Original owner','expected_revision':self.store.snapshot()['revision']})
        agent={'kind':'agent','id':'a'*64,'name':'Aster','profile':'alpha','source_id':human_id(self.home),'avatar_eligible':True}
        run=self.store.begin_run(page['id'],'native',executor_identity=agent)
        self.store.apply_run(run['id'],[],[{'comment_id':comment['id'],'text':'Outcome'}])
        self.store.finish_run(run['id'],'completed')
        before=self.store.snapshot()
        target=Store(self.home/'restored')
        target.restore_snapshot(read_backup(backup(self.store.backup_snapshot())))
        after=target.snapshot()
        self.assertEqual(after['items'][0]['content'],before['items'][0]['content'])
        self.assertEqual(after['comments'][0]['author_identity'],before['comments'][0]['author_identity'])
        self.assertEqual(after['comments'][0]['replies'][0]['id'],before['comments'][0]['replies'][0]['id'])
        self.assertFalse(after['comments'][0]['replies'][0]['author_identity']['avatar_eligible'])
        self.assertEqual(target.snapshot(include_identity=True)['identity']['human']['name'],'user')
        self.assertEqual(after['runs'],[])


if __name__ == '__main__':
    unittest.main()
