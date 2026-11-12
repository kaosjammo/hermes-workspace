"""Accepted review findings, real Store/shared service and internal host metadata.

Synthetic task-only homes and admitted member IDs. No provider/live activation.
"""
import copy
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from hermes_constants import set_hermes_home_override, reset_hermes_home_override
from workspace_plugin.identity import executor, human_id, validate, username
from workspace_plugin.store import Store, StoreError
from workspace_plugin.shared_workspaces import SharedWorkspaces, profile_key


class Review01Tests(unittest.TestCase):
    def setUp(self):
        root=Path(os.environ['HWS_QUALIFICATION_HOME'])/'fixtures'
        root.mkdir(parents=True,exist_ok=True)
        self.tmp=TemporaryDirectory(dir=root);self.root=Path(self.tmp.name)

    def tearDown(self): self.tmp.cleanup()

    def test_F002_shared_member_preference_present_after_save_reopen_unchanged_save(self):
        service=SharedWorkspaces(self.root/'shared')
        alice,bob,reader,outsider=[profile_key(self.root/n)for n in ('alice','bob','reader','outsider')]
        project=service.create(alice,'Garden',[{'profile_id':bob},{'profile_id':reader,'role':'read_only'}]);ident=project['id']
        def command(actor,op,payload,view=None):
            view=view or service.snapshot(actor,ident)
            return service.execute(actor,ident,op,{**payload,'expected_revision':view['state']['revision']},membership_revision=view['workspace']['membership_revision'],expected_scope=view['state']['scope_id'])
        page=command(alice,'create_item',{'kind':'page','title':'Garden'})['result']
        ac=command(alice,'add_comment',{'item_id':page['id'],'text':'Alice feedback'})['result']
        bc=command(bob,'add_comment',{'item_id':page['id'],'text':'Bob feedback'})['result']
        command(bob,'reply_comment',{'id':ac['id'],'text':'Bob reply'})
        command(alice,'set_username',{'name':'Alice Ω'})
        response=command(bob,'set_username',{'name':'Bob 東京'})
        self.assertEqual(response['state'].get('identity',{}).get('human',{}).get('name'),'Bob 東京','F002 mutation response must contain admitted member preference')
        service=SharedWorkspaces(self.root/'shared')
        view=service.snapshot(bob,ident)
        self.assertEqual(view['state']['identity']['human'],{'kind':'human','id':bob,'name':'Bob 東京'})
        self.assertNotIn(alice,json.dumps(view['state']['identity']))
        self.assertNotIn('Alice Ω',json.dumps(view['state']['identity']))
        before=copy.deepcopy(view['state']['comments'])
        command(bob,'set_username',{'name':view['state']['identity']['human']['name']})
        after=service.snapshot(bob,ident)['state']
        self.assertEqual(after['comments'],before)
        self.assertEqual(after['comments'][0]['author_identity']['name'],'Alice Ω')
        self.assertEqual(after['comments'][0]['replies'][0]['author_identity']['name'],'Bob 東京')
        self.assertEqual(after['comments'][1]['id'],bc['id'])
        raw=service._store(ident).backup_snapshot()
        for actor in (reader,outsider):
            with self.assertRaises(StoreError):command(actor,'set_username',{'name':'Denied'},view=view)
        with self.assertRaises(StoreError):command(bob,'set_username',{'name':'Stale'},view=view)
        self.assertEqual(service._store(ident).backup_snapshot(),raw)
        with self.assertRaises(StoreError):service.snapshot(outsider,ident)
        self.assertEqual(service.snapshot(reader,ident)['state']['identity']['human']['id'],reader)

    def test_F003_native_long_and_joined_names_keep_known_executor_and_avatar(self):
        base=self.root/'host';home=base/'profiles'/'alpha';home.mkdir(parents=True)
        names=['Engineer 👩‍💻','Native '+('東京🌿 '*70).strip()]
        captured=[]
        for name in names:
            with patch.dict(os.environ,{'HERMES_HOME':str(base),'HERMES_PROFILE_NAME':'wrong-launch'}):
                token=set_hermes_home_override(home)
                try:identity=executor(home, name)
                finally:reset_hermes_home_override(token)
            self.assertIsNotNone(identity,'F003 known executor must not disappear for valid native display text')
            self.assertEqual(identity['name'],name);validate(identity,'agent')
            self.assertEqual(identity['profile'],'alpha');self.assertEqual(identity['source_id'],human_id(home));self.assertTrue(identity['avatar_eligible'])
            captured.append(identity)
        self.assertEqual(captured[0]['id'],captured[1]['id'])
        store=Store(home);page=store.execute('create_item',{'kind':'page','title':'Garden'});comment=store.execute('add_comment',{'item_id':page['id'],'text':'Review'})
        run=store.begin_run(page['id'],'native',executor_identity=captured[0])
        store.apply_run(run['id'],[],[{'comment_id':comment['id'],'text':'First recorded response'}]);store.finish_run(run['id'],'completed')
        later={**captured[1],'profile':'beta','source_id':'b'*64,'id':'c'*64}
        run=store.begin_run(page['id'],'native',executor_identity=later)
        store.apply_run(run['id'],[],[{'comment_id':comment['id'],'text':'Later response'}]);store.finish_run(run['id'],'completed')
        reopened=Store(home).snapshot()['comments'][0]['replies']
        self.assertEqual(reopened[0]['author_identity'],captured[0]);self.assertEqual(reopened[1]['author_identity'],later)
        from workspace_plugin.interchange import backup,read_backup
        target=Store(self.root/'restored');target.restore_snapshot(read_backup(backup(store.backup_snapshot())))
        rows=target.snapshot()['comments'][0]['replies']
        self.assertEqual(rows[0]['author_identity']['name'],names[0]);self.assertEqual(rows[1]['author_identity']['name'],names[1])
        self.assertFalse(rows[0]['author_identity']['avatar_eligible'])

    def test_agent_unsafe_or_extreme_display_keeps_canonical_attribution_human_policy_unchanged(self):
        base=self.root/'host';home=base/'profiles'/'alpha';home.mkdir(parents=True)
        for name in ('x'*10000,'Directional\u202ename','\x00'):
            with patch.dict(os.environ,{'HERMES_HOME':str(base)}):
                token=set_hermes_home_override(home)
                try:identity=executor(home, name)
                finally:reset_hermes_home_override(token)
            self.assertIsNotNone(identity);validate(identity,'agent')
            self.assertEqual(identity['profile'],'alpha');self.assertTrue(identity['avatar_eligible']);self.assertLess(len(identity['name']),100)
        for name in ('Engineer 👩‍💻','x'*81):
            with self.assertRaises(ValueError):username(name)
        for name in ('x'*10000,'Directional\u202ename','bad\x00name'):
            with self.assertRaises(ValueError):validate({**identity,'name':name},'agent')


if __name__=='__main__':unittest.main()
