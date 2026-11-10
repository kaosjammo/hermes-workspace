import io,os,zipfile,unittest,json
from pathlib import Path
import xml.etree.ElementTree as ET
from workspace_plugin import interchange as api
class Review24CodeWhitespace(unittest.TestCase):
 def test_docx_preformatted_lines_and_indentation(self):
  out=Path(os.environ['HWS_SMOKE_OUTPUT']);(out/'exports').mkdir(exist_ok=True)
  code='def observe(value):\n    result = value + 1\n\treturn result'
  content='<p>Before rich <strong>bold</strong>.</p><pre><code>'+code+'</code></pre><ol start="3"><li>Third</li><li>Fourth</li></ol><blockquote>Quote retained.</blockquote><p>After.</p>'
  blob=api.export_document({'title':'Code whitespace review','content':content},'docx');(out/'exports/code-original.docx').write_bytes(blob)
  with zipfile.ZipFile(io.BytesIO(blob)) as z:root=ET.fromstring(z.read('word/document.xml'));(out/'exports/document.xml').write_bytes(z.read('word/document.xml'))
  ns={'w':api._W};paragraph=next(p for p in root.findall('.//w:p',ns) if 'def observe' in ''.join(p.itertext()))
  self.assertEqual(len(paragraph.findall('.//w:br',ns)),2,'Word must contain real line breaks')
  self.assertGreaterEqual(len(paragraph.findall('.//w:tab',ns)),1,'Code tabs need explicit Word tab semantics')
  text=''.join(n.text or '' if n.tag=='{'+api._W+'}t' else '\n' if n.tag=='{'+api._W+'}br' else '\t' if n.tag=='{'+api._W+'}tab' else '' for n in paragraph.iter());self.assertEqual(text,code)
  restored=api.import_file('code-original.docx',blob)['content'];(out/'exports/code-reimport.html').write_text(restored);pre=next(n for n in api._tree(restored).children if isinstance(n,api._Node) and n.tag=='pre');self.assertEqual(api._plain(pre),code);self.assertIn('<strong>bold</strong>',restored);self.assertIn('<ol start="3">',restored);self.assertIn('<blockquote>',restored)
  (out/'exports/code-reimport.docx').write_bytes(api.export_document({'title':'Code reimport review','content':restored},'docx'))
