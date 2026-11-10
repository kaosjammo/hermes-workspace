"""Synthetic canonical-record DATA tests; actual gateway checkpoint is separate."""
import json
from pathlib import Path
import tempfile
import unittest
from workspace_plugin.native import NativeSessions
from workspace_plugin.finalization import ProposalJournal
from hermes_state import SessionDB
from hermes_state_runtime import begin_runtime_epoch,admit_session_input,claim_session_input,settle_session_input

class NativeObservationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]/'.local/workflow/tmp')
        self.home=Path(self.tmp.name);self.db=SessionDB(self.home/'state.db')
        self.db.create_session('fixture-session',source='local')
        self.epoch=begin_runtime_epoch(self.db,instance_id='fixture-owner')
        self.native=NativeSessions(self.home,db=self.db)
        self.journal=ProposalJournal(self.home)
        self.prompt='Fixture exact prompt; not authority'
        self.proposal={'edits':[],'replies':[]};self.text=json.dumps(self.proposal)
        self.row=admit_session_input(self.db,epoch=self.epoch,principal_id='fixture-principal',session_id='fixture-session',request_id='fixture-run',payload={'text':self.prompt})
        self.row=claim_session_input(self.db,epoch=self.epoch,session_id='fixture-session')
        self.result={'session_id':'fixture-session','persisted_turn':{'complete':True,'user_row_id':1,'user_row_ids':[1],'final_assistant_row_id':2,'row_ids':[1,2]},'messages':[],'final_response':self.text,'turn_exit_reason':'fixture-data-only'}
    def tearDown(self):self.db.close();self.tmp.cleanup()
    def settle(self):settle_session_input(self.db,epoch=self.epoch,admission_id=self.row['admission_id'],generation=self.row['generation'],outcome='completed',result={'result':self.result})
    def args(self):return dict(session_id='fixture-session',request_id='fixture-run',principal_id='fixture-principal',prompt=self.prompt,expected_epoch=self.epoch)
    def stage(self,turn='fixture-turn'):
        return self.journal.stage(session_id='fixture-session',turn_id=turn,user_message=self.prompt,assistant_response=self.text,conversation_history=[{'role':'user','content':self.prompt,'_row_id':1,'_db_persisted':True},{'role':'assistant','content':self.text,'_row_id':2,'_db_persisted':True}])
    def test_exact_row_join_is_observation_without_commit_authority(self):
        self.settle();self.stage()
        joined=self.journal.inspect_join(self.native,**self.args())
        self.assertFalse(joined['commit_authority']);self.assertFalse(joined['native_record']['live_owner_verified'])
    def test_copy_nonce_foreign_principal_prompt_session_and_epoch_refuse(self):
        self.settle()
        for key,value in (('principal_id','foreign'),('request_id','copied-other'),('session_id','wrong'),('prompt','copied prose'),('expected_epoch',2)):
            with self.subTest(key=key),self.assertRaises(ValueError):self.native.terminal_snapshot(**{**self.args(),key:value})
    def test_started_or_missing_terminal_result_has_no_row_join(self):
        with self.assertRaises(ValueError):self.native.terminal_snapshot(**self.args())
        settle_session_input(self.db,epoch=self.epoch,admission_id=self.row['admission_id'],generation=self.row['generation'],outcome='completed')
        with self.assertRaises(ValueError):self.native.terminal_snapshot(**self.args())
    def test_two_local_turns_claiming_same_rows_refuse_instead_of_first_bind(self):
        self.settle();self.stage();self.stage('different-local-turn')
        with self.assertRaises(ValueError):self.journal.inspect_join(self.native,**self.args())
    def test_compaction_or_incomplete_native_continuity_refuses(self):
        self.result['persisted_turn']['complete']=False;self.settle();self.stage()
        with self.assertRaises(ValueError):self.journal.inspect_join(self.native,**self.args())
    def test_owner_replacement_invalidates_observation(self):
        self.settle();begin_runtime_epoch(self.db,instance_id='fixture-replacement')
        with self.assertRaises(ValueError):self.native.terminal_snapshot(**self.args())

if __name__=='__main__':unittest.main()
