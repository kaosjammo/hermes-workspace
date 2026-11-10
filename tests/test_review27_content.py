import io,os,base64,unittest
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
from workspace_plugin import interchange as api
class FinalContent(unittest.TestCase):
 def pdf(self,html,name):
  raw=api.export_document({'title':name,'content':html},'pdf');(Path(os.environ['HWS_SMOKE_OUTPUT'])/(name+'.pdf')).write_bytes(raw);return PdfReader(io.BytesIO(raw))
 def test_mixed_inline_cell_and_div_remain_one_line(self):
  for n,html in [('direct','<table><tr><td>Before <strong>bold</strong> after</td><td>Adjacent</td></tr></table>'),('div','<table><tr><td><div>Before <strong>bold</strong> after</div></td><td>Adjacent</td></tr></table>')]:
   with self.subTest(n=n):
    text=self.pdf(html,n).pages[0].extract_text();self.assertIn('Before bold after',text);self.assertIn('Adjacent',text)
 def test_list_raster_is_preserved(self):
  pic=Image.new('RGBA',(2,1));pic.putdata([(20,60,100,255),(220,40,80,255)]);raw=io.BytesIO();pic.save(raw,format='PNG');src='data:image/png;base64,'+base64.b64encode(raw.getvalue()).decode();reader=self.pdf('<ol start="3"><li>Before<img src="'+src+'" alt="Sample"/>After</li></ol>','list-image');images=[i for p in reader.pages for i in p.images];self.assertEqual(len(images),1);self.assertEqual(images[0].image.convert('RGBA').tobytes(),pic.tobytes());text='\n'.join(p.extract_text() for p in reader.pages);self.assertIn('3. Before',text);self.assertNotIn('[Image:',text);self.assertLess(text.index('Before'),text.index('After'))
 def test_paragraph_checkbox_markdown_roundtrip(self):
  html='<p><input type="checkbox" disabled checked>Done</p><p><input type="checkbox" disabled>Next</p>';md=api.export_document({'title':'Checklist','content':html},'md');(Path(os.environ['HWS_SMOKE_OUTPUT'])/'checklist.md').write_bytes(md);back=api.import_file('checklist.md',md)['content'];self.assertEqual(back.count('type="checkbox"'),2);self.assertEqual(back.count(' checked'),1);self.assertIn('Done',back);self.assertIn('Next',back)
 def test_retained26_paragraph_list_image_docx_characterisation(self):
  from test_review26_pdf import FinalPDF
  result=unittest.TestResult();FinalPDF('test_pdf_cell_blocks_lists_inline_images_and_docx').run(result);self.assertTrue(result.wasSuccessful(),str(result.failures)+str(result.errors))
