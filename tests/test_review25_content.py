import io,os,zipfile,unittest
from pathlib import Path
import xml.etree.ElementTree as ET
from workspace_plugin.store import Store,_content
from workspace_plugin import interchange as api
class PriorityContent(unittest.TestCase):
 def test_numbering_survives_store_import_create_update_reopen(self):
  home=Path(os.environ['HWS_SMOKE_OUTPUT'])/'store';home.mkdir();s=Store(home)
  html='<ol start="3"><li>Third</li><li>Fourth<ol start="7"><li>Nested seven</li></ol></li></ol><ol start="1"><li>Restart</li></ol>'
  blob=api.export_document({'title':'Numbered import','content':html},'docx');document=api.import_file('numbered.docx',blob);item=s.import_document({k:document[k] for k in ('title','content','original') if k in document})
  self.assertIn('<ol start="3">',item['content']);self.assertIn('<ol start="7">',item['content'])
  updated=s.execute('update_item',{'id':item['id'],'patch':{'content':item['content']+'<p>Ordinary edit</p>'}});self.assertIn('<ol start="3">',updated['content'])
  saved=next(i for i in Store(home).snapshot()['items'] if i['id']==item['id']);self.assertIn('<ol start="7">',saved['content'])
  backup=s.backup_snapshot();s.restore_snapshot(backup);self.assertIn('<ol start="3">',next(i for i in s.snapshot()['items'] if i['id']==item['id'])['content'])
  for bad in ['-1','1000000','3x']:self.assertNotIn('start=',_content('<ol start="'+bad+'"><li>Safe</li></ol>'))
 def test_docx_cell_block_flow_keeps_lists_and_order(self):
  content='<table><tr><td><p>Before</p><ol start="3"><li>Alpha</li><li>Beta<ul><li>Nested</li></ul></li></ol><p>Tail</p></td><td><p>Adjacent</p></td></tr></table>'
  blob=api.export_document({'title':'Cell flow','content':content},'docx');out=Path(os.environ['HWS_SMOKE_OUTPUT'])/'cell.docx';out.write_bytes(blob)
  with zipfile.ZipFile(io.BytesIO(blob)) as z:root=ET.fromstring(z.read('word/document.xml'));numbering=ET.fromstring(z.read('word/numbering.xml'))
  ns={'w':api._W};cells=root.findall('.//w:tc',ns);texts=[''.join(p.itertext()) for p in cells[0].findall('w:p',ns)]
  self.assertEqual(texts,['Before','Alpha','Beta','Nested','Tail']);self.assertEqual(''.join(cells[1].itertext()),'Adjacent');self.assertTrue(any(n.get('{'+api._W+'}val')=='3' for n in numbering.findall('.//w:startOverride',ns)))
