"""Untrusted final data over the public originating-turn/terminal contract.

Private persisted-row IDs and ProposalJournal inspection are retired mechanisms;
these cases retain data bounds, no-early-effects, collision and scope assertions.
"""
import json
import unittest
from unittest.mock import patch
from test_public_runs import PublicRunsFixture
from workspace_plugin.finalization import parse_proposal, validate_proposal


class FinalizationDataTests(PublicRunsFixture, unittest.TestCase):
    def setUp(self):
        super().setUp(); self.bind()

    def test_parse_and_capture_all_unresolved_including_answered_without_effects(self):
        before = self.store.backup_snapshot()
        value = parse_proposal(json.dumps(self.proposal()))
        validate_proposal(value, self.run)
        self.assertFalse(self.post(value)['commit_authority'])
        self.assertEqual(self.store.backup_snapshot(), before)
        self.assertEqual(self.end()['run']['status'], 'completed')

    def test_model_auth_fields_duplicate_keys_nan_and_prose_are_not_proposals(self):
        for text in ('{"edits":[],"replies":[],"run_id":"copied"}',
                     '{"edits":[],"edits":[],"replies":[]}',
                     '{"edits":[],"replies":[],"x":NaN}', '```json\n{}\n```'):
            with self.subTest(text=text), self.assertRaises(ValueError): parse_proposal(text)

    def test_missing_duplicate_and_outside_comment_outcomes_refuse(self):
        for replies in ([], [self.proposal()['replies'][0]]*2, [{'comment_id':'outside','text':'Injected'}]):
            with self.assertRaises(ValueError): validate_proposal({'edits':[], 'replies':replies}, self.run)

    def test_outside_item_and_resolution_cannot_be_proposals(self):
        for edit in ({'item_id':self.other['id'],'patch':{'title':'Outside'}},
                     {'item_id':self.page['id'],'patch':{'resolved':True}}):
            with self.assertRaises(ValueError): validate_proposal({'edits':[edit], 'replies':self.proposal()['replies']}, self.run)

    def test_identical_retry_is_idempotent_but_collision_never_overwrites(self):
        self.post(); self.post()
        with self.assertRaises(ValueError): self.post(self.proposal(edits=[]))
        self.end(); before = self.store.backup_snapshot(); self.end()
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_same_text_different_native_turn_never_first_binds(self):
        before = self.store.backup_snapshot()
        with self.assertRaises(ValueError): self.post(turn_id='foreign-turn')
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_client_row_and_persistence_flags_cannot_replace_public_binding(self):
        before = self.store.backup_snapshot()
        with self.assertRaises(ValueError):
            self.flow.post(session_id='thread-a', task_id='foreign', turn_id='foreign',
                user_message=self.prompt, assistant_response=json.dumps(self.proposal()),
                conversation_history=[{'_row_id':1,'_db_persisted':True,'role':'assistant'}], completed=True)
        self.assertEqual(self.store.backup_snapshot(), before)

    def test_patch_values_are_typed_data_not_arbitrary_objects(self):
        for patch_value in ({'content':{'command':'not text'}}, {'title':[]}, {'properties':'not object'}, {'columns':{}}):
            with self.assertRaises(ValueError):
                parse_proposal(json.dumps({'edits':[{'item_id':self.page['id'],'patch':patch_value}], 'replies':[]}))

    def test_data_or_consume_without_positive_native_terminal_has_no_effect(self):
        self.post(); before = self.store.backup_snapshot()
        result = self.flow.consume(self.run['id'], principal_id='synthetic-profile-owner')
        self.assertEqual(result['run']['status'], 'running')
        self.assertEqual(self.store.backup_snapshot(), before)


class FinalRunRawInputBoundary(PublicRunsFixture, unittest.TestCase):
    def capture(self, response):
        with patch.object(self.flow.native, 'require_session', side_effect=RuntimeError('independent public binding required')) as lookup:
            try:
                return self.flow.post(session_id='thread-a', task_id='task', turn_id='turn',
                    user_message='not prepared', assistant_response=response)
            finally:
                self.lookup_calls = lookup.call_count

    def test_oversized_raw_response_refuses_before_authority_or_decode(self):
        with self.assertRaises(ValueError): self.capture('x' * (8*1024*1024+1))
        self.assertEqual(self.lookup_calls, 0)

    def test_raw_utf8_budget_is_checked_before_authority(self):
        with patch('workspace_plugin.proposals.MAX_STATE', 32):
            with self.assertRaises(ValueError): self.capture('{"edits":[],"replies":[],"x":"'+'é'*20+'"}')
        self.assertEqual(self.lookup_calls, 0)

    def test_duplicate_malformed_and_nonfinite_json_refuse_early(self):
        for value in ('{"edits":[],"edits":[],"replies":[]}', '{broken', '{"edits":[],"replies":[{"comment_id":"c","text":NaN}]}'):
            with self.subTest(value=value), self.assertRaises(ValueError): self.capture(value)
            self.assertEqual(self.lookup_calls, 0)

    def test_valid_data_still_requires_independent_public_binding(self):
        with self.assertRaisesRegex(RuntimeError, 'independent public binding required'):
            self.capture('{"edits":[],"replies":[]}')
        self.assertEqual(self.lookup_calls, 1)

    def test_pre_hook_binds_without_a_final_response_but_does_not_save(self):
        self.prepare(); before = self.store.backup_snapshot()
        self.flow.pre(**self.origin, user_message=self.prompt)
        self.assertEqual(self.store.backup_snapshot(), before)
