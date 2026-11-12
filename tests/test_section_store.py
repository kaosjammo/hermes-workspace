"""Production Store UI02 paths with explicitly simulated agent writes."""
import copy
from runtime_paths import fixture_root, node_command
from pathlib import Path
import tempfile
import unittest

from workspace_plugin.store import Store, StoreError, _plain


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = fixture_root('section-store-tests')
FIXTURES.mkdir(parents=True,exist_ok=True)


def anchor(content, quote):
    text = _plain(content); position = text.index(quote)
    return {'quote':quote,'prefix':text[max(0,position-32):position],
            'suffix':text[position+len(quote):position+len(quote)+32]}


class SectionStore(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=FIXTURES)
        self.home = Path(self.temp.name)
        self.store = Store(self.home)
        self.before = '<p>Keep <strong>young trees shaded</strong> through summer. Water the <em>north bed slowly</em> each morning.</p>'
        self.after = self.before.replace('trees shaded','trees sheltered').replace('bed slowly','bed deeply')
        self.page = self.store.execute('create_item',{'kind':'page','title':'Synthetic section proof','content':self.before})
        self.a = self.store.execute('add_comment',{'item_id':self.page['id'],'text':'Change A','anchor':anchor(self.before,'young trees shaded')})
        self.b = self.store.execute('add_comment',{'item_id':self.page['id'],'text':'Change B','anchor':anchor(self.before,'north bed slowly')})

    def tearDown(self):
        self.temp.cleanup()

    def agent(self, content=None):
        run = self.store.begin_run(self.page['id'],'synthetic-section-thread')
        edits = [] if content is None else [{'item_id':self.page['id'],'patch':{'content':content}}]
        self.store.apply_run(run['id'],edits,[{'comment_id':cid,'text':'Simulated agent outcome'} for cid in run['comment_ids']])
        self.store.finish_run(run['id'],'completed')
        return run

    def change(self, comment=None):
        cid = (comment or self.a)['id']
        return next(c for c in self.store.snapshot()['comments'] if c['id']==cid)['section_change']

    def preview(self, change):
        return self.store.execute('preview_section_revert',{k:change[k] for k in ('version_id','generation_id','change_id')})

    def revert(self, preview, confirmed=False):
        return self.store.execute('revert_section',{**{k:preview[k] for k in ('version_id','generation_id','change_id','content_hash','manual_revision','dataset_epoch')},'confirmed':confirmed})

    def saved(self):
        return next(i for i in self.store.snapshot()['items'] if i['id']==self.page['id'])

    def test_two_highlights_rich_structure_only_a_and_checkpoint(self):
        self.agent(self.after)
        before = self.store.snapshot()
        preview = self.preview(self.change())
        self.assertFalse(preview['requires_confirmation'])
        self.assertEqual(self.store.snapshot()['revision'],before['revision'],'Preview must perform zero writes')
        result = self.revert(preview)
        self.assertEqual(self.saved()['content'],self.after.replace('trees sheltered','trees shaded'))
        self.assertEqual(self.saved()['title'],self.page['title'])
        after = self.store.snapshot()
        for category in ('attachments','runs'):
            self.assertEqual(before[category],after[category])
        original_a = next(c for c in before['comments'] if c['id']==self.a['id'])
        expected_removed = original_a['replies']
        self.assertEqual(len(expected_removed),1)
        self.assertEqual(expected_removed[0]['author'],'agent')
        self.assertEqual(result['removed_reply_ids'],[r['id'] for r in expected_removed])
        self.assertEqual([c['id'] for c in after['comments']],[c['id'] for c in before['comments']])
        for old,new in zip(before['comments'],after['comments']):
            # Only the addressed outcome is removed; every stored human field and
            # the other section's complete reply objects remain unchanged.
            self.assertEqual({k:v for k,v in old.items() if k not in ('section_change','anchor_status','replies')},
                             {k:v for k,v in new.items() if k not in ('section_change','anchor_status','replies')})
            self.assertEqual(new['replies'],[] if old['id']==self.a['id'] else old['replies'])
        checkpoint = next(v for v in after['versions'] if v['id']==result['recovery_version_id'])
        self.assertEqual(checkpoint['snapshot']['content'],self.after)
        self.assertEqual(checkpoint['section_revert_receipt']['removed_reply_ids'],result['removed_reply_ids'])
        raw_checkpoint = next(v for v in self.store.backup_snapshot()['versions'] if v['id']==checkpoint['id'])
        self.assertEqual(raw_checkpoint['_removed_responses'],[{'comment_id':self.a['id'],'reply':r} for r in expected_removed])
        self.assertEqual(Store(self.home).snapshot()['comments'],after['comments'])
        self.assertEqual(self.change()['status'],'reverted')
        self.assertEqual(self.change(self.b)['status'],'available')
        with self.assertRaises(StoreError):
            self.revert(preview)
        self.revert(self.preview(self.change(self.b)))
        self.assertEqual(self.saved()['content'],self.before)

    def test_manual_inside_and_outside_require_exact_confirmation(self):
        self.agent(self.after)
        current = self.after.replace('young trees','new saplings').replace('each morning.','only on Monday.')
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':current,'title':'Keep manual title'}})
        preview = self.preview(self.change())
        self.assertTrue(preview['requires_confirmation'])
        before = self.store.backup_snapshot()
        with self.assertRaisesRegex(StoreError,'Confirm'):
            self.revert(preview)
        self.assertEqual(self.store.backup_snapshot(),before)
        self.revert(preview,True)
        self.assertEqual(self.saved()['content'],self.after.replace('trees sheltered','trees shaded').replace('each morning.','only on Monday.'))
        self.assertEqual(self.saved()['title'],'Keep manual title')

    def test_outside_only_edit_requires_confirmation_and_stale_consent_refuses(self):
        self.agent(self.after)
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':self.after.replace('each morning.','each afternoon.')}})
        preview = self.preview(self.change())
        self.assertTrue(preview['requires_confirmation'])
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'title':'Changed while confirmation open'}})
        before = self.store.backup_snapshot()
        with self.assertRaisesRegex(StoreError,'after section review'):
            self.revert(preview,True)
        self.assertEqual(before,self.store.backup_snapshot())

    def test_manual_edit_with_no_net_content_difference_still_requires_confirmation(self):
        self.agent(self.after)
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':self.after}})
        self.assertTrue(self.preview(self.change())['requires_confirmation'])

    def test_reply_only_no_action_locked_and_later_generation_refuse(self):
        self.agent()
        self.assertNotIn('section_change',self.store.snapshot()['comments'][0])
        self.agent(self.after)
        old = self.preview(self.change())
        run = self.store.begin_run(self.page['id'],'synthetic-section-thread')
        with self.assertRaises(StoreError):
            self.revert(old)
        self.store.apply_run(run['id'],[{'item_id':self.page['id'],'patch':{'content':self.after.replace('trees sheltered','trees protected')}}],[{'comment_id':c['id'],'text':'Later simulated outcome'} for c in (self.a,self.b)])
        self.store.finish_run(run['id'],'completed')
        with self.assertRaisesRegex(StoreError,'superseded'):
            self.revert(old)

    def test_reload_backup_provenance_and_deleted_target_refusal(self):
        self.agent(self.after)
        change = self.change()
        self.store = Store(self.home)
        self.assertEqual(self.change()['change_id'],change['change_id'])
        backup = self.store.backup_snapshot()
        previous_preview = self.preview(change)
        self.store.restore_snapshot(copy.deepcopy(backup))
        with self.assertRaisesRegex(StoreError,'replaced after section review'):
            self.revert(previous_preview)
        self.assertEqual(self.change()['change_id'],change['change_id'])
        preview = self.preview(self.change())
        self.assertEqual(self.store.snapshot()['runs'],[],'Restoring provenance never restores native authority')
        self.store.execute('trash',{'id':self.page['id']})
        with self.assertRaises(StoreError):
            self.revert(preview)

    def test_overlap_fails_closed_but_other_highlight_remains_independent(self):
        overlapping = self.store.execute('add_comment',{'item_id':self.page['id'],'text':'Overlapping request',
            'anchor':anchor(self.before,'trees shaded')})
        self.agent(self.after)
        self.assertEqual(self.change()['status'],'unavailable')
        self.assertEqual(self.change(overlapping)['status'],'unavailable')
        unchanged = self.store.backup_snapshot()
        with self.assertRaises(StoreError):
            self.preview(self.change())
        self.assertEqual(unchanged,self.store.backup_snapshot())
        self.revert(self.preview(self.change(self.b)))
        self.assertEqual(self.saved()['content'],self.after.replace('bed deeply','bed slowly'))

    def test_detached_manual_target_and_full_restore_refuse_old_change(self):
        self.agent(self.after)
        change = self.change()
        old_preview = self.preview(change)
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'content':'<p>Entirely replaced manually.</p>'}})
        unchanged = self.store.backup_snapshot()
        with self.assertRaises(StoreError):
            self.preview(change)
        self.assertEqual(unchanged,self.store.backup_snapshot())
        self.store.execute('restore_version',{'id':change['version_id']})
        with self.assertRaisesRegex(StoreError,'superseded'):
            self.revert(old_preview,True)

    def test_explicit_stale_revision_refuses_without_checkpoint_or_write(self):
        self.agent(self.after)
        preview = self.preview(self.change())
        revision = self.store.snapshot()['revision']
        self.store.execute('create_item',{'kind':'page','title':'Another user action'})
        unchanged = self.store.backup_snapshot()
        payload = {k:preview[k] for k in ('version_id','generation_id','change_id','content_hash','manual_revision','dataset_epoch')}
        with self.assertRaisesRegex(StoreError,'revision changed'):
            self.store.execute('revert_section',dict(payload,confirmed=True,expected_revision=revision))
        self.assertEqual(unchanged,self.store.backup_snapshot())


    def test_formatting_only_preview_is_distinct_and_keeps_outside_manual_edit(self):
        self.agent(self.before.replace('<strong>','').replace('</strong>',''))
        self.store.execute('update_item',{'id':self.page['id'],'patch':{'title':'Manual title after formatting'}})
        before = self.store.backup_snapshot()
        preview = self.preview(self.change())
        self.assertEqual(before,self.store.backup_snapshot(),'A rich preview is still read-only')
        self.assertTrue(preview['requires_confirmation'])
        self.assertEqual(preview['before_text'],preview['current_text'])
        self.assertIn('<strong>',preview['before_html'])
        self.assertNotIn('<strong>',preview['current_html'])
        with self.assertRaisesRegex(StoreError,'Confirm'):
            self.revert(preview)
        self.assertEqual(before,self.store.backup_snapshot())
        self.revert(preview,True)
        self.assertEqual(self.saved()['content'],self.before)
        self.assertEqual(self.saved()['title'],'Manual title after formatting')
        self.assertEqual(self.change()['status'],'reverted')
        self.store = Store(self.home)
        self.assertEqual(self.change()['status'],'reverted')
        with self.assertRaisesRegex(StoreError,'already reverted'):
            self.revert(preview,True)

    def test_manual_attachment_or_record_schema_change_requires_confirmation(self):
        self.agent(self.after)
        self.store.execute('add_attachment',{'item_id':self.page['id'],'name':'retained-note.txt','media_type':'text/plain','data_base64':'bm90ZQ=='})
        self.assertTrue(self.preview(self.change())['requires_confirmation'])
        database = self.store.execute('create_item',{'kind':'database','title':'Record section schema'})
        record = self.store.execute('create_item',{'kind':'record','database_id':database['id'],'title':'Record section','content':'<p>Original passage.</p>'})
        comment = self.store.execute('add_comment',{'item_id':record['id'],'text':'Revise this passage','anchor':anchor(record['content'],'Original passage')})
        run = self.store.begin_run(record['id'],'synthetic-schema-section-thread')
        self.store.apply_run(run['id'],[{'item_id':record['id'],'patch':{'content':'<p>Agent passage.</p>'}}],[{'comment_id':comment['id'],'text':'Simulated agent edit'}])
        self.store.finish_run(run['id'],'completed')
        change = next(c for c in self.store.snapshot()['comments'] if c['id']==comment['id'])['section_change']
        self.assertFalse(self.preview(change)['requires_confirmation'])
        self.store.execute('set_columns',{'id':database['id'],'columns':[]})
        self.assertTrue(self.preview(change)['requires_confirmation'])


if __name__=='__main__':
    unittest.main()
