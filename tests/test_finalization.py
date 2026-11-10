"""Untrusted proposal DATA tests. Synthetic native records are not inference proof."""
import json
from pathlib import Path
import tempfile
import unittest
from workspace_plugin.finalization import ProposalJournal, parse_proposal, validate_proposal
from workspace_plugin.store import Store


class FinalizationDataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]/'.local/workflow/tmp')
        self.home=Path(self.temp.name)
        self.store=Store(self.home)
        self.page=self.store.execute('create_item',{'kind':'page','title':'Current','content':'Before'})
        self.other=self.store.execute('create_item',{'kind':'page','title':'Other'})
        self.comments=[self.store.execute('add_comment',{'item_id':self.page['id'],'text':text}) for text in ('Unresolved','Answered but unresolved')]
        self.store.execute('reply_comment',{'id':self.comments[1]['id'],'text':'Previous user reply'})
        self.run=self.store.begin_run(self.page['id'],'synthetic-session')
        self.proposal={'edits':[{'item_id':self.page['id'],'patch':{'content':'After'}}],
                       'replies':[{'comment_id':c['id'],'text':'Proposed outcome'} for c in self.comments]}
        self.journal=ProposalJournal(self.home)
    def tearDown(self):self.temp.cleanup()
    def payload(self,proposal=None):
        text=json.dumps(proposal or self.proposal)
        return {'session_id':'synthetic-session','turn_id':'synthetic-local-turn','user_message':'synthetic exact prompt',
                'assistant_response':text,'conversation_history':[
                    {'role':'user','content':'synthetic exact prompt','_row_id':11,'_db_persisted':True},
                    {'role':'assistant','content':text,'_row_id':12,'_db_persisted':True}]}
    def test_parse_and_capture_all_unresolved_including_answered_without_effects(self):
        before=self.store.snapshot()
        proposal=parse_proposal(json.dumps(self.proposal))
        validate_proposal(proposal,self.run)
        staged=self.journal.stage(**self.payload())
        self.assertFalse(staged['commit_authority'])
        self.assertEqual(self.store.snapshot(),before)
        self.assertEqual(self.journal.get(staged['proposal_id'])['proposal'],self.proposal)
    def test_model_auth_fields_duplicate_keys_nan_and_prose_refuse(self):
        for text in ('{"edits":[],"replies":[],"run_id":"copied"}', '{"edits":[],"edits":[],"replies":[]}',
                     '{"edits":[],"replies":[],"x":NaN}', '```json\n{}\n```'):
            with self.subTest(text=text),self.assertRaises(ValueError):parse_proposal(text)
    def test_missing_duplicate_and_outside_comment_outcomes_refuse(self):
        for replies in ([],[self.proposal['replies'][0]]*2,[{'comment_id':'outside','text':'Injected'}]):
            with self.assertRaises(ValueError):validate_proposal({'edits':[],'replies':replies},self.run)
    def test_outside_item_and_resolution_cannot_be_proposals(self):
        for edit in ({'item_id':self.other['id'],'patch':{'title':'Outside'}},
                     {'item_id':self.page['id'],'patch':{'resolved':True}}):
            with self.assertRaises(ValueError):validate_proposal({'edits':[edit],'replies':self.proposal['replies']},self.run)
    def test_identical_retry_is_idempotent_but_collision_never_overwrites(self):
        first=self.journal.stage(**self.payload())
        self.assertEqual(self.journal.stage(**self.payload()),first)
        changed={**self.proposal,'edits':[]}
        with self.assertRaises(ValueError):self.journal.stage(**self.payload(changed))
        self.assertEqual(self.journal.get(first['proposal_id'])['proposal'],self.proposal)
    def test_same_text_different_native_rows_never_first_binds(self):
        first=self.journal.stage(**self.payload())
        second=self.payload();second['turn_id']='synthetic-successor';second['conversation_history'][0]['_row_id']=21;second['conversation_history'][1]['_row_id']=22
        later=self.journal.stage(**second)
        self.assertNotEqual(first['proposal_id'],later['proposal_id'])
        self.assertFalse(later['commit_authority'])
    def test_missing_uncommitted_or_nonfinal_native_rows_refuse(self):
        for change in ('missing','uncommitted','tool-tail','no-user'):
            payload=self.payload()
            if change=='missing':payload['conversation_history'][0].pop('_row_id')
            if change=='uncommitted':payload['conversation_history'][1]['_db_persisted']=False
            if change=='tool-tail':payload['conversation_history'][1]['tool_calls']=[{'id':'x'}]
            if change=='no-user':payload['conversation_history']=payload['conversation_history'][1:]
            with self.subTest(change=change),self.assertRaises(ValueError):self.journal.stage(**payload)
    def test_patch_values_are_typed_data_not_arbitrary_objects(self):
        for patch in ({'content': {'command':'not text'}}, {'title': []}, {'properties': 'not an object'}, {'columns': {}}):
            value={'edits':[{'item_id':self.page['id'],'patch':patch}],'replies':[]}
            with self.subTest(patch=patch),self.assertRaises(ValueError):parse_proposal(json.dumps(value))
    def test_staging_has_no_consume_or_effect_entrypoint(self):
        self.assertFalse(hasattr(self.journal,'commit'))
        self.assertFalse(hasattr(self.journal,'consume'))

class FinalRunRawInputBoundary(unittest.TestCase):
    """Raw post-hook input is bounded DATA before any authority lookup.

    The lookup sentinel is a guard, not a synthetic native admission. Valid DATA
    must still reach that independent authority boundary; these are not provider
    or native callback-delivery acceptance tests.
    """
    def capture(self, response=None, stage='post'):
        from unittest.mock import patch
        from workspace_plugin.final_run import capture
        payload = {} if response is None else {'assistant_response': response}
        with patch('workspace_plugin.final_run.NativeOwner',
                   side_effect=RuntimeError('independent native authority required')) as owner:
            try:
                return capture(stage, payload)
            finally:
                self.owner_calls = owner.call_count

    def test_oversized_raw_response_refuses_before_authority_or_decode(self):
        from workspace_plugin.store import MAX_STATE
        response = ' ' * MAX_STATE + '{"edits":[],"replies":[]}'
        with self.assertRaisesRegex(ValueError, 'bounded nonempty proposal text'):
            self.capture(response)
        self.assertEqual(self.owner_calls, 0)

    def test_raw_utf8_budget_is_checked_before_authority(self):
        from unittest.mock import patch
        with patch('workspace_plugin.finalization.MAX_STATE', 32):
            with self.assertRaisesRegex(ValueError, 'exceeds Workspace storage bound'):
                self.capture('"' + '\u00e9' * 20 + '"')
        self.assertEqual(self.owner_calls, 0)

    def test_duplicate_malformed_and_nonfinite_post_data_refuse_early(self):
        values = ('{"edits":[],"edits":[],"replies":[]}', 'not JSON',
                  '{"edits":[],"replies":[{"comment_id":"c","text":NaN}]}')
        for value in values:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.capture(value)
            self.assertEqual(self.owner_calls, 0)

    def test_valid_post_data_still_requires_independent_native_authority(self):
        with self.assertRaisesRegex(RuntimeError, 'independent native authority required'):
            self.capture('{"edits":[],"replies":[]}')
        self.assertEqual(self.owner_calls, 1)

    def test_pre_hook_does_not_require_a_final_response(self):
        with self.assertRaisesRegex(RuntimeError, 'independent native authority required'):
            self.capture(stage='pre')
        self.assertEqual(self.owner_calls, 1)


if __name__=='__main__':unittest.main()
