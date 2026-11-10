"""Focused accepted Round21 list/typography checks; not an owning-suite campaign."""
import io,os,zipfile,json,unittest
from pathlib import Path
import xml.etree.ElementTree as ET
from workspace_plugin import interchange as api
OUT=Path(os.environ['HWS_SMOKE_OUTPUT'])/'exports'
OUT.mkdir(exist_ok=True)

class Review22InterchangeSmoke(unittest.TestCase):
    def test_contiguous_nested_lists_and_explicit_starts_roundtrip(self):
        content='<p>Before list.</p><ol start="3"><li>Third note</li><li>Fourth note<ul><li>Inner one</li><li>Inner two<ol start="7"><li>Seventh nested</li></ol></li></ul></li><li>Fifth note</li></ol><p>Separate prose.</p><ol><li>Restart one</li><li>Restart two</li></ol><blockquote>Quoted field note.</blockquote><pre><code>def observe(value):\n    return value + 1</code></pre>'
        blob=api.export_document({'title':'List structure smoke','content':content},'docx');(OUT/'list-original.docx').write_bytes(blob)
        restored=api.import_file('list-original.docx',blob)['content'];(OUT/'list-reimport.html').write_text(restored)
        (OUT/'list-reimport.docx').write_bytes(api.export_document({'title':'List reimport smoke','content':restored},'docx'))
        tree=api._tree(restored);lists=[n for n in tree.children if isinstance(n,api._Node) and n.tag=='ol']
        self.assertEqual(len(lists),2,'Contiguous items share a list; separate lists retain a restart')
        self.assertEqual(lists[0].attrs.get('start'),'3')
        outer=[n for n in lists[0].children if isinstance(n,api._Node) and n.tag=='li'];self.assertEqual(len(outer),3)
        nested=next(n for n in outer[1].children if isinstance(n,api._Node) and n.tag=='ul');self.assertEqual(len(nested.children),2)
        deeper=next(n for n in nested.children[1].children if isinstance(n,api._Node) and n.tag=='ol');self.assertEqual(deeper.attrs.get('start'),'7')
        self.assertEqual(len(lists[1].children),2);self.assertEqual(lists[1].attrs.get('start','1'),'1')
        self.assertIn('Third note',api._plain(outer[0]));self.assertIn('Fifth note',api._plain(outer[2]));self.assertIn('<blockquote>',restored);self.assertIn('<pre>',restored)

    def test_numbering_identity_continuation_restart_and_override(self):
        w=api._W;ns='{'+w+'}';doc=ET.Element(ns+'document');body=ET.SubElement(doc,ns+'body')
        def paragraph(text,num=None,level=0):
            p=ET.SubElement(body,ns+'p')
            if num is not None:
                props=ET.SubElement(p,ns+'pPr');np=ET.SubElement(props,ns+'numPr');ET.SubElement(np,ns+'numId',{ns+'val':str(num)});ET.SubElement(np,ns+'ilvl',{ns+'val':str(level)})
            ET.SubElement(ET.SubElement(p,ns+'r'),ns+'t').text=text
        for text,num,level in [('Three',10,0),('Four',10,0),('Inner A',10,1),('Inner B',10,1),('Five',10,0),('Prose break',None,0),('Six continued',10,0),('One restarted',11,0),('Seven override',12,0),('Cell tail',None,0)]:paragraph(text,num,level)
        numbering=ET.Element(ns+'numbering');abstract=ET.SubElement(numbering,ns+'abstractNum',{ns+'abstractNumId':'1'})
        for level,fmt,start in [(0,'decimal',3),(1,'bullet',1)]:
            lvl=ET.SubElement(abstract,ns+'lvl',{ns+'ilvl':str(level)});ET.SubElement(lvl,ns+'numFmt',{ns+'val':fmt});ET.SubElement(lvl,ns+'start',{ns+'val':str(start)})
        for num,start in [(10,None),(11,1),(12,7)]:
            node=ET.SubElement(numbering,ns+'num',{ns+'numId':str(num)});ET.SubElement(node,ns+'abstractNumId',{ns+'val':'1'})
            if start is not None:ET.SubElement(ET.SubElement(node,ns+'lvlOverride',{ns+'ilvl':'0'}),ns+'startOverride',{ns+'val':str(start)})
        seed=api.export_document({'title':'Numbering identity smoke','content':'<p>Carrier</p>'},'docx');stream=io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(seed)) as old,zipfile.ZipFile(stream,'w',zipfile.ZIP_DEFLATED) as new:
            for name in old.namelist():new.writestr(name,ET.tostring(doc,encoding='utf-8') if name=='word/document.xml' else ET.tostring(numbering,encoding='utf-8') if name=='word/numbering.xml' else old.read(name))
        raw=stream.getvalue();(OUT/'numbering-input.docx').write_bytes(raw);restored=api.import_file('numbering-input.docx',raw)['content'];(OUT/'numbering-reimport.html').write_text(restored)
        (OUT/'numbering-reimport.docx').write_bytes(api.export_document({'title':'Numbering continuation smoke','content':restored},'docx'))
        lists=[n for n in api._tree(restored).children if isinstance(n,api._Node) and n.tag=='ol']
        self.assertEqual([n.attrs.get('start','1') for n in lists],['3','6','1','7'])
        self.assertEqual(len(lists[0].children),3);self.assertEqual([api._plain(n).strip() for n in lists[1].children],['Six continued'])
        self.assertIn('<ul>',api._serialize(lists[0]));self.assertIn('Prose break',restored);self.assertIn('Cell tail',restored)

    def test_pdf_code_quote_are_distinct_without_losing_text(self):
        from pypdf import PdfReader
        blob=api.export_document({'title':'Code and quote smoke','content':'<h2>Field observations</h2><p>Body marker remains ordinary.</p><blockquote>Quote marker remains distinct.</blockquote><pre><code>def observe(value):\n    return value + 1</code></pre><p>After marker remains ordinary.</p>'},'pdf');(OUT/'code-quote.pdf').write_bytes(blob)
        segments=[]
        def visit(text,cm,tm,font,size):
            if text.strip():segments.append({'text':text,'font':str(font.get('/BaseFont')) if font else None,'size':size,'x':cm[4]+tm[4]})
        reader=PdfReader(io.BytesIO(blob));text=''.join(page.extract_text(visitor_text=visit) for page in reader.pages);(OUT/'pdf-segments.json').write_text(json.dumps(segments,indent=2))
        body=next(x for x in segments if 'Body marker' in x['text']);quote=next(x for x in segments if 'Quote marker' in x['text']);code=next(x for x in segments if 'def observe' in x['text'])
        self.assertNotEqual(code['font'],body['font'],'Code needs an actual monospace font, not body typography');self.assertNotEqual(quote['font'],body['font'],'Quote needs a distinct native paragraph style');self.assertGreater(quote['x'],body['x'])
        self.assertIn('return value + 1',text);self.assertIn('After marker remains ordinary.',text)
