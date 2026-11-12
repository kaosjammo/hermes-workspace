"""F012 production no-effect geometry, persistence and refusal regressions."""
from host_auth import host_auth
import copy
import hashlib
import json
import os
from pathlib import Path
import unittest
from workspace_plugin.store import Store, StoreError, _plain
from workspace_plugin.sections import locate_anchor, SectionUnavailable


def production_cases(home, *, shared_store=None):
    """Synthetic inputs only; all projection/geometry comes from real Store."""
    cases=[]
    for label,original,anchor,needle in [
        ('plain','<p>North river.</p><p>South garden.</p>',{'quote':'North river.','prefix':'','suffix':''},'North river.'),
        ('rich','<p><strong>North river.</strong></p><p>South garden.</p>',{'quote':'North river.','prefix':'','suffix':''},'North river.'),
        ('mixed','<p>North river.</p><p>South garden.</p>',{'quote':'North river.','prefix':'','suffix':''},'North river.'),
        ('disambiguated','<p>West North river.</p><p>East North river.</p><p>South garden.</p>',{'quote':'North river.','prefix':'East ','suffix':''},'East North river.')]:
        target=Path(home)/label;store=shared_store or Store(target)
        page=store.execute('create_item',{'kind':'page','title':('NoEffect '+label)if shared_store else label,'content':original})
        a=store.execute('add_comment',{'item_id':page['id'],'text':'North feedback '+label,'anchor':anchor})
        b=store.execute('add_comment',{'item_id':page['id'],'text':'South feedback '+label,'anchor':{'quote':'South garden.','prefix':'','suffix':''}})
        store.execute('reply_comment',{'id':a['id'],'text':'Keep human feedback.'});before=store.backup_snapshot()
        run=store.begin_run(page['id'],'synthetic-review03-'+label)
        store.apply_run(run['id'],[],[{'comment_id':a['id'],'text':'Unrelated reply-only outcome.'}])
        def operation(content,text):store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':content}}],[{'comment_id':cid,'text':text}for cid in run['comment_ids']])
        operation(original.replace(needle,needle.replace('river','stream')),'Actual first operation outcome.')
        first=next(c for c in store.snapshot()['comments']if c['id']==a['id'])['section_change']
        final=original.replace('South garden.','South orchard.')if label=='mixed'else original
        operation(final,'Actual second operation outcome.');store.finish_run(run['id'],'completed')
        raw=Store(store.profile_home).backup_snapshot();state=Store(store.profile_home).snapshot()
        cases.append({'name':label,'home':str(store.profile_home),'item_id':page['id'],'comment_id':a['id'],'before':before,'after':raw,'public':state,'view':next(c for c in state['comments']if c['id']==a['id']),
                      'plain':_plain(final),'expected_content':final,'cleanup_attempt':{**{k:first[k]for k in ['version_id','generation_id','change_id']},
                      'dataset_epoch':'synthetic-no-eligible-review','content_hash':hashlib.sha256(final.encode()).hexdigest(),'manual_revision':0},'source_anchor':anchor})
    return cases


class Review03(unittest.TestCase):
    def setUp(self):
        self.out=Path(os.environ['ISSUE9_EVIDENCE']);self.home=self.out/'F012-stores'/self._testMethodName;self.cases=production_cases(self.home)
        (self.out/'F012-cases.json').write_text(json.dumps(self.cases,indent=2)+'\n')

    def test_F012_plain_rich_mixed_and_disambiguated_roundtrips(self):
        for case in self.cases:
            with self.subTest(case=case['name']):
                change=case['view']['section_change'];self.assertEqual(change['highlight_status'],'available')
                self.assertEqual(change['status'],'unavailable');self.assertEqual(change['anchor']['quote'],'North river.')
                locate_anchor(case['plain'],change['anchor'])
                self.assertEqual(case['after']['items'][0]['content'],case['expected_content'])
                self.assertEqual(case['after']['comments'][0]['anchor'],case['source_anchor'])
                self.assertEqual(case['after']['comments'][0]['replies'][0],case['before']['comments'][0]['replies'][0])
                self.assertEqual(len(case['after']['comments'][0]['replies']),4)
                self.assertEqual({k:v for k,v in case['after']['comments'][0].items()if k!='replies'},
                                 {k:v for k,v in case['before']['comments'][0].items()if k!='replies'})

    def test_F012_actual_api409_repeated_cleanup_preserves_full_graph(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from hermes_cli.plugin_host_http_auth import with_hosted_admission
        from dashboard.plugin_api import create_router
        for case in self.cases:
            with self.subTest(case=case['name']):
                home=Path(case['home']);app=FastAPI();app.include_router(create_router(lambda:home,authorize=host_auth),prefix='/api')
                with TestClient(with_hosted_admission(app,True))as client:
                    public=client.get('/api/state').json();c=next(c for c in public['comments']if c['id']==case['comment_id'])
                    self.assertEqual(c['section_change']['highlight_status'],'available')
                    p=case['cleanup_attempt'];before=Store(home).backup_snapshot()
                    payload={**{k:p[k]for k in ['version_id','generation_id','change_id','dataset_epoch','content_hash','manual_revision']},'confirmed':True,'expected_revision':public['revision']}
                    for _ in range(2):
                        r=client.post('/api/command',json={'op':'revert_section','expected_scope':public['scope_id'],'payload':payload});self.assertEqual(r.status_code,409,r.text);self.assertIn('superseded',r.text)
                        self.assertEqual(client.get('/api/state').json(),public);self.assertEqual(Store(home).backup_snapshot(),before)

    def test_F012_later_outside_edits_runs_and_user_resolution(self):
        case=self.cases[0];store=Store(Path(case['home']));before=store.backup_snapshot()
        content=case['expected_content']+'<p>Keep outside manual draft.</p>'
        store.execute('update_item',{'id':case['item_id'],'patch':{'content':content}})
        self.assertEqual(store.snapshot()['comments'][0]['section_change']['anchor']['quote'],'North river.')
        run=store.begin_run(case['item_id'],'synthetic-review03-plain')
        store.apply_run(run['id'],[{'item_id':case['item_id'],'patch':{'content':content.replace('South garden.','South orchard.')}}],[{'comment_id':cid,'text':'Later unrelated operation.'}for cid in run['comment_ids']]);store.finish_run(run['id'],'completed')
        c=store.snapshot()['comments'][0];self.assertEqual(c['section_change']['highlight_status'],'available');self.assertEqual(c['section_change']['anchor']['quote'],'North river.');self.assertEqual(c['replies'][:4],before['comments'][0]['replies'])
        store.execute('resolve_comment',{'id':case['comment_id'],'resolved':True});c=Store(Path(case['home'])).snapshot()['comments'][0]
        self.assertTrue(c['resolved']);self.assertEqual(c['anchor'],case['source_anchor']);self.assertEqual(c['section_change']['highlight_status'],'available')
        (self.out/'F012-later-run.json').write_text(json.dumps({'before':before,'reopened':store.backup_snapshot(),'view':c},indent=2)+'\n')

    def test_F012_missing_ambiguous_no_proof_and_restore_stay_conservative(self):
        for index,mode in enumerate(['missing-anchor','no-mapping-proof','broken-ancestry','ambiguous','missing-current','cross-boundary','full-restore']):
            case=self.cases[index%len(self.cases)];state=copy.deepcopy(case['after']);item=next(i for i in state['items']if i['id']==case['item_id']);comment=next(c for c in state['comments']if c['id']==case['comment_id']);generation=state['versions'][0]['_section_provenance'][-1]
            if mode=='missing-anchor':generation['anchors'].pop(comment['id'])
            if mode=='no-mapping-proof':generation.pop('mapping_version')
            if mode=='broken-ancestry':state['versions'][0]['snapshot']['_section_generation']='missing-history'
            if mode=='ambiguous':
                content='<p>North river.</p><p>North river.</p><p>South garden.</p>';item['content']=content;state['versions'][0]['snapshot']['content']=content;generation['post_content']=content;generation['anchors'][comment['id']]={'quote':'North river.','prefix':'','suffix':''}
            if mode=='missing-current':item['content']='<p>Completely missing passage.</p>'
            if mode=='cross-boundary':item['content']='<p>Inserted at boundary. North river.</p><p>South garden.</p>'
            if mode=='full-restore':item['_section_generation']=None
            with self.subTest(mode=mode),self.assertRaises(SectionUnavailable):Store(Path(case['home']))._section_geometry(state,comment,item)
        # Actual full Restore is still a hard boundary, even at exact original bytes.
        case=self.cases[0];store=Store(Path(case['home']));store.execute('restore_version',{'id':case['after']['versions'][0]['id']})
        c=store.snapshot()['comments'][0];self.assertEqual(c['section_change']['highlight_status'],'unavailable');self.assertNotIn('anchor',c['section_change'])

    def test_F012_other_section_revert_import_and_separate_run_positive(self):
        case=self.cases[2];store=Store(Path(case['home']));north=copy.deepcopy(store.snapshot()['comments'][0]);south=store.snapshot()['comments'][1]['section_change']
        p=store.execute('preview_section_revert',{k:south[k]for k in ['version_id','generation_id','change_id']})
        result=store.execute('revert_section',{**{k:p[k]for k in ['version_id','generation_id','change_id','dataset_epoch','content_hash','manual_revision']},'confirmed':True})
        self.assertEqual(store.snapshot()['comments'][0]['replies'],north['replies']);self.assertEqual(store.snapshot()['comments'][0]['section_change']['anchor']['quote'],'North river.');self.assertEqual(len(result['removed_reply_ids']),1)
        source=self.cases[0];target=Store(self.home/'imported');target.restore_snapshot(source['after']);c=target.snapshot()['comments'][0]
        self.assertEqual(c['section_change']['highlight_status'],'available');self.assertEqual(c['section_change']['status'],'unavailable');self.assertEqual(c['replies'],source['after']['comments'][0]['replies'])
        # Two independent runs still identify the later addressed word exactly.
        store=Store(self.home/'separate');page=store.execute('create_item',{'kind':'page','title':'Separate','content':'<p>North river.</p>'});store.execute('add_comment',{'item_id':page['id'],'text':'North','anchor':{'quote':'North river.','prefix':'','suffix':''}})
        for value in ['stream','river']:
            run=store.begin_run(page['id'],'synthetic-separate-roundtrip');store.apply_run(run['id'],[{'item_id':page['id'],'patch':{'content':'<p>North '+value+'.</p>'}}],[{'comment_id':cid,'text':'Actual operation '+value}for cid in run['comment_ids']]);store.finish_run(run['id'],'completed')
        c=store.snapshot()['comments'][0];self.assertEqual(c['section_change']['highlight_status'],'available');self.assertEqual(c['section_change']['anchor']['quote'],'river');self.assertEqual(c['section_change']['status'],'available')


if __name__=='__main__':unittest.main()
