import os,unittest
from pathlib import Path
from workspace_plugin.store import Store,_plain
from workspace_plugin.sections import locate_anchor, capture_sections, plan_revert, addressed_anchor, SectionUnavailable
from workspace_plugin.store import _content
def anchor(html,quote):
 text=_plain(html);at=text.index(quote);return {'quote':quote,'prefix':text[max(0,at-32):at],'suffix':text[at+len(quote):at+len(quote)+32]}
class CommentIdentity(unittest.TestCase):
 def test_uncertain_overlap_repeated_and_disjoint_ranges_never_union(self):
  before='<p>Scarlet hue. Unchanged middle. Violet hue.</p>';after=before.replace('Scarlet','Azure').replace('Violet','Ochre')
  whole=anchor(before,_plain(before));change=capture_sections(before,after,{'a':whole},_plain)['a'];plan=plan_revert(change,after,after,_plain,_content)
  with self.assertRaises(SectionUnavailable):addressed_anchor(change,plan,after,_plain)
  overlapping=capture_sections(before,after,{'a':whole,'b':anchor(before,'Scarlet hue.')},_plain)
  self.assertTrue(all(v['status']=='unavailable' for v in overlapping.values()))
  repeated=capture_sections('<p>same same</p>','<p>new new</p>',{'a':{'quote':'same','prefix':'','suffix':''}},_plain)
  self.assertEqual(repeated['a']['status'],'unavailable')
 def test_separate_format_changes_have_no_guessed_union(self):
  before='<p>Alpha unchanged middle Beta.</p>';after='<p><strong>Alpha</strong> unchanged middle <strong>Beta</strong>.</p>'
  change=capture_sections(before,after,{'a':anchor(before,_plain(before))},_plain)['a'];plan=plan_revert(change,after,after,_plain,_content)
  with self.assertRaises(SectionUnavailable):addressed_anchor(change,plan,after,_plain)
 def test_single_format_and_later_outside_edit_keep_small_range(self):
  before='<p>Context Alpha tail.</p>';after='<p>Context <strong>Alpha</strong> tail.</p>';change=capture_sections(before,after,{'a':anchor(before,_plain(before))},_plain)['a'];current=after+'<p>Later outside manual text.</p>';plan=plan_revert(change,after,current,_plain,_content)
  self.assertEqual(addressed_anchor(change,plan,current,_plain)['quote'],'Alpha')
 def test_two_link_target_changes_never_paint_the_unchanged_middle(self):
  before='<p><a href="https://example.com/one">Alpha</a> unchanged middle <a href="https://example.com/two">Beta</a>.</p>';after=before.replace('/one','/new-one').replace('/two','/new-two')
  change=capture_sections(before,after,{'a':anchor(before,_plain(before))},_plain)['a'];plan=plan_revert(change,after,after,_plain,_content)
  with self.assertRaises(SectionUnavailable):addressed_anchor(change,plan,after,_plain)
 def test_broad_selection_highlights_only_actual_change_and_preserves_revert(self):
  home=Path(os.environ['HWS_SMOKE_OUTPUT'])/'broad';home.mkdir();s=Store(home);before='<p>'+('Unchanged context. '*20)+'The hue is scarlet.'+(' More unchanged context.'*20)+'</p>';page=s.execute('create_item',{'kind':'page','title':'Synthetic broad selection','content':before});c=s.execute('add_comment',{'item_id':page['id'],'text':'Change just the hue','anchor':anchor(before,_plain(before))});run=s.begin_run(page['id'],'synthetic-comments');after=before.replace('scarlet','azure');s.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':after}}],[{'comment_id':c['id'],'text':'Simulated independent hue outcome'}]);s.finish_run(run['id'],'completed');saved=s.snapshot();v=next(x for x in saved['comments'] if x['id']==c['id']);self.assertEqual(v['id'],c['id']);self.assertEqual(v['text'],c['text']);self.assertEqual(v['anchor'],c['anchor']);self.assertFalse(v['resolved']);self.assertEqual(v['section_change']['anchor']['quote'],'azure');self.assertLess(len(v['section_change']['anchor']['quote']),20);p=s.execute('preview_section_revert',{k:v['section_change'][k] for k in ['version_id','generation_id','change_id']});self.assertIn('scarlet',p['before_html']);self.assertIn('azure',p['current_html'])
 def test_two_comments_keep_ids_text_replies_and_separate_changed_ranges(self):
  for distant in [False,True]:
   with self.subTest(distant=distant):
    home=Path(os.environ['HWS_SMOKE_OUTPUT'])/('separate'+str(distant));home.mkdir();s=Store(home);a='First hue is scarlet with its own context.';b='Second hue is violet with different context.';before='<p>'+a+(' </p><p>'+('Unrelated middle. '*40)+'</p><p>' if distant else ' ')+b+'</p>';page=s.execute('create_item',{'kind':'page','title':'Two independent comments','content':before});comments=[s.execute('add_comment',{'item_id':page['id'],'text':text,'anchor':anchor(before,quote)}) for text,quote in [('First feedback',a),('Second feedback',b)]];s.execute('reply_comment',{'id':comments[0]['id'],'text':'Earlier user reply'});resolved=s.execute('add_comment',{'item_id':page['id'],'text':'Excluded resolved'});s.execute('resolve_comment',{'id':resolved['id'],'resolved':True});run=s.begin_run(page['id'],'synthetic-comments');self.assertEqual(set(run['comment_ids']),{x['id'] for x in comments});after=before.replace('scarlet','azure').replace('violet','ochre');s.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':after}}],[{'comment_id':x['id'],'text':'Separate simulated outcome '+str(i)} for i,x in enumerate(comments)]);s.finish_run(run['id'],'completed');snap=s.snapshot();views=[next(x for x in snap['comments'] if x['id']==c['id']) for c in comments];self.assertEqual([x['text'] for x in views],['First feedback','Second feedback']);self.assertEqual([x['section_change']['anchor']['quote'] for x in views],['azure','ochre']);self.assertEqual([x['replies'][-1]['text'] for x in views],['Separate simulated outcome 0','Separate simulated outcome 1']);self.assertEqual(views[0]['replies'][0]['text'],'Earlier user reply');self.assertTrue(all(not x['resolved'] for x in views));self.assertEqual(next(x for x in snap['comments'] if x['id']==resolved['id'])['replies'],[]);self.assertEqual(next(x for x in snap['items'] if x['id']==page['id'])['content'],after);self.assertEqual(len({x['section_change']['change_id'] for x in views}),2)
