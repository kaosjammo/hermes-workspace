"""Ordinary targeted patch DATA/Store tests. All runs/homes are synthetic."""
import copy
import json
import os
import tempfile
import unittest
from pathlib import Path

from workspace_plugin.store import Store, StoreError, MAX_CONTENT, _content
from workspace_plugin.targeted_edits import content_revision, resolve_content_edits, validate_content_edits
from workspace_plugin.finalization import parse_proposal, validate_proposal


class TargetedEdits(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.store = Store(Path(self.tmp.name))
        self.before = '<p>Keep <strong>young trees shaded</strong> through summer.</p><p>Outside <em>north bed</em> stays intact.</p>'
        self.page = self.store.execute('create_item', {'kind':'page','title':'Synthetic','content':self.before})
        self.comment = self.store.execute('add_comment', {'item_id':self.page['id'],'text':'Improve shelter wording.',
            'anchor':{'quote':'young trees shaded','prefix':'Keep ','suffix':' through summer.'}})

    def tearDown(self):
        self.tmp.cleanup()

    def saved(self):
        return next(i for i in self.store.snapshot()['items'] if i['id']==self.page['id'])

    def spec(self, replacements=None, item=None):
        return {**content_revision(item or self.saved()), 'replacements':replacements or [{'before':'trees shaded','after':'trees sheltered'}]}

    def start_run(self):
        return self.store.begin_run(self.page['id'],'synthetic-targeted-thread')

    def apply(self, run, spec, **extra):
        return self.store.apply_run(run['id'],[{'item_id':self.page['id'],'patch':{'content_edits':spec,**extra}}],
            [{'comment_id':self.comment['id'],'text':'Synthetic scoped outcome.'}])

    def test_exact_target_keeps_outside_bytes_replies_and_idempotent_receipt(self):
        run=self.start_run();spec=self.spec();result=self.apply(run,spec)
        self.assertEqual(self.saved()['content'],self.before.replace('trees shaded','trees sheltered'))
        snapshot=self.store.backup_snapshot();again=self.apply(run,spec)
        self.assertEqual(self.store.backup_snapshot(),snapshot)
        self.assertEqual(len(again['operation_receipts']),1)
        self.assertFalse(self.store.snapshot()['comments'][0]['resolved'])
        self.assertEqual(result['operation_receipts'],again['operation_receipts'])

    def test_saved_restore_and_section_revert_keep_later_outside_manual_edit(self):
        run=self.start_run();self.apply(run,self.spec());self.store.finish_run(run['id'],'completed')
        change=self.store.snapshot()['comments'][0]['section_change'];self.assertEqual(change['status'],'available')
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':self.saved()['content'].replace('stays intact','keeps a later manual note')}})
        ids={key:change[key] for key in ('version_id','generation_id','change_id')}
        preview=self.store.execute('preview_section_revert',ids);self.assertTrue(preview['requires_confirmation'])
        payload={k:preview[k] for k in ('version_id','generation_id','change_id','content_hash','manual_revision','dataset_epoch')}
        with self.assertRaises(StoreError):self.store.execute('revert_section',{**payload,'confirmed':False})
        self.store.execute('revert_section',{**payload,'confirmed':True})
        self.assertEqual(self.saved()['content'],self.before.replace('stays intact','keeps a later manual note'))
        self.store.execute('restore_version',{'id':run['version_ids'][0]})
        self.assertEqual(self.saved()['content'],self.before)

    def test_stale_hash_timestamp_and_manual_revision_fail_without_effects(self):
        run=self.start_run();before=self.store.backup_snapshot()
        for key,value in [('expected_sha256','0'*64),('expected_updated_at','2000-01-01T00:00:00+00:00'),('expected_manual_revision',9)]:
            with self.subTest(key=key):
                spec=self.spec();spec[key]=value
                with self.assertRaises(StoreError):self.apply(run,spec)
                self.assertEqual(self.store.backup_snapshot(),before)

    def test_missing_ambiguous_and_overlapping_preimages_fail_atomically(self):
        run=self.start_run();before=self.store.backup_snapshot()
        for replacements in [[{'before':'missing passage','after':'x'}],
            [{'before':'<','after':'x'}],
            [{'before':'trees shaded','after':'x'},{'before':'young trees','after':'y'}]]:
            with self.subTest(replacements=replacements):
                with self.assertRaises(StoreError):self.apply(run,self.spec(replacements))
                self.assertEqual(self.store.backup_snapshot(),before)
        item={'content':'aaaa','updated_at':'revision','_manual_revision':0}
        with self.assertRaises(ValueError):resolve_content_edits(item,self.spec([{'before':'aaa','after':'x'}],item),_content,MAX_CONTENT)

    def test_multiple_disjoint_original_ranges_and_deletion_preserve_rich_content(self):
        run=self.start_run();self.apply(run,self.spec([{'before':'trees shaded','after':'trees sheltered'},
            {'before':'Outside ','after':''}]))
        self.assertEqual(self.saved()['content'],self.before.replace('trees shaded','trees sheltered').replace('Outside ',''))

    def test_multi_item_failure_rolls_back_earlier_edit_reply_and_receipt(self):
        other=self.store.execute('create_item',{'kind':'page','title':'Other','content':'<p>Other preserved.</p>'})
        self.store.execute('add_comment',{'item_id':self.page['id'],'text':'Related target approved in legacy reference.','target_item_ids':[other['id']]})
        run=self.store.begin_run(self.page['id'],'synthetic-targeted-thread',[other['id']]);before=self.store.backup_snapshot()
        bad=self.spec();bad['expected_sha256']='0'*64
        with self.assertRaises(StoreError):self.store.apply_run(run['id'],[
            {'item_id':other['id'],'patch':{'title':'Must not commit'}},
            {'item_id':self.page['id'],'patch':{'content_edits':bad}}],[{'comment_id':self.comment['id'],'text':'Must not commit'}])
        self.assertEqual(self.store.backup_snapshot(),before)

    def test_canonical_safe_result_and_format_mutual_exclusion(self):
        run=self.start_run();before=self.store.backup_snapshot()
        for replacements in [[{'before':'trees shaded','after':'<script>bad()</script>'}],
            [{'before':'trees shaded','after':'sheltered & safe'}]]:
            with self.assertRaises(ValueError):self.apply(run,self.spec(replacements))
            self.assertEqual(self.store.backup_snapshot(),before)
        with self.assertRaises(ValueError):self.apply(run,self.spec(),content='Must not become a fallback')
        self.assertEqual(self.store.backup_snapshot(),before)

    def test_duplicate_item_patches_and_outside_scope_are_not_an_alternate_grant(self):
        run=self.start_run();before=self.store.backup_snapshot();patch={'item_id':self.page['id'],'patch':{'content_edits':self.spec()}}
        with self.assertRaises(ValueError):self.store.apply_run(run['id'],[patch,copy.deepcopy(patch)],[])
        outside=copy.deepcopy(patch);outside['item_id']='outside-allowed-scope'
        with self.assertRaises(StoreError):self.store.apply_run(run['id'],[outside],[])
        self.assertEqual(self.store.backup_snapshot(),before)

    def test_stopped_run_and_active_manual_lock_stay_authoritative(self):
        run=self.start_run();spec=self.spec()
        with self.assertRaises(StoreError):self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':'manual'}})
        self.store.finish_run(run['id'],'cancelled');before=self.store.backup_snapshot()
        with self.assertRaises(StoreError):self.apply(run,spec)
        self.assertEqual(self.store.backup_snapshot(),before)

    def test_final_proposal_accepts_targeted_data_but_not_malformed_or_identity_fields(self):
        run=self.start_run();proposal={'edits':[{'item_id':self.page['id'],'patch':{'content_edits':self.spec()}}],
            'replies':[{'comment_id':self.comment['id'],'text':'Synthetic outcome'}]}
        self.assertEqual(validate_proposal(parse_proposal(json.dumps(proposal)),run),proposal)
        for change in [lambda p:p['edits'][0]['patch']['content_edits'].update(expected_manual_revision=True),
            lambda p:p['edits'][0]['patch']['content_edits'].update(replacements=[]),
            lambda p:p['edits'][0]['patch'].update(content='mixed full content'),
            lambda p:p.update(principal_id='invented')]:
            bad=copy.deepcopy(proposal);change(bad)
            with self.assertRaises(ValueError):parse_proposal(json.dumps(bad))


if __name__=='__main__':unittest.main()
