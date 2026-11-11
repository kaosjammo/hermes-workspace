"""Actual Workflow/native admission/Store, synthetic queued turns (no provider)."""
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from hermes_constants import set_hermes_home_override, reset_hermes_home_override
from hermes_state import SessionDB
from hermes_state_runtime import begin_runtime_epoch, admit_session_input, claim_session_input
from workspace_plugin.store import Store
from workspace_plugin.native import NativeSessions
from workspace_plugin.workflow import Workflow


class ExecutingIdentityTests(unittest.TestCase):
    def test_queued_author_capture_survives_later_metadata_and_stop_keeps_fences(self):
        root=Path(os.environ['HWS_QUALIFICATION_HOME'])/'fixtures'
        with TemporaryDirectory(dir=root) as temp:
            base=Path(temp);home=base/'profiles'/'alpha';home.mkdir(parents=True)
            (home/'profile.yaml').write_text(json.dumps({'ui_meta':{'hermes-bots':{'title':'Recorded Aster'}}}))
            store=Store(home);db=SessionDB(home/'state.db')
            try:
                db.create_session('native',source='local')
                epoch=begin_runtime_epoch(db,instance_id='synthetic-identity-runtime')
                flow=Workflow(home,store=store,native=NativeSessions(home,db=db))
                page=store.execute('create_item',{'kind':'page','title':'Garden'})
                comment=store.execute('add_comment',{'item_id':page['id'],'text':'Review the garden'})
                with patch.dict(os.environ,{'HERMES_HOME':str(base),'HERMES_PROFILE_NAME':'wrong-launch'}):
                    token=set_hermes_home_override(home)
                    try: prepared=flow.prepare(page['id'],'native')
                    finally: reset_hermes_home_override(token)
                row=admit_session_input(db,epoch=epoch,principal_id='synthetic-owner',session_id='native',
                    request_id=prepared['submission_id'],payload={'text':prepared['prompt']})
                (home/'profile.yaml').write_text(json.dumps({'ui_meta':{'hermes-bots':{'title':'Later selection'}}}))
                with self.assertRaises(ValueError):
                    flow.apply(prepared['run']['id'],session_id='native',task_id='synthetic-task',admission_id=row['admission_id'],
                        replies=[{'comment_id':comment['id'],'text':'Not claimed yet'}])
                row=claim_session_input(db,epoch=epoch,session_id='native')
                flow.apply(prepared['run']['id'],session_id='native',task_id='synthetic-task',admission_id=row['admission_id'],
                    replies=[{'comment_id':comment['id'],'text':'Actual admitted synthetic outcome'}])
                reply=store.snapshot()['comments'][0]['replies'][0]
                self.assertEqual(reply['author_identity']['name'],'Recorded Aster')
                self.assertEqual(reply['author_identity']['profile'],'alpha')
                flow.stop(prepared['run']['id'])
                before=store.snapshot()
                with self.assertRaises(ValueError):
                    flow.apply(prepared['run']['id'],session_id='native',task_id='synthetic-task',admission_id=row['admission_id'],
                        replies=[{'comment_id':comment['id'],'text':'Late reply'}])
                self.assertEqual(store.snapshot(),before)
            finally: db.close()


if __name__=='__main__': unittest.main()
