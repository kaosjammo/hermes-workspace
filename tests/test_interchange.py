"""Behavioural interchange checks through public production entrypoints."""
import base64
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
import zipfile

from workspace_plugin import interchange as api

FIXTURES = Path(__file__).resolve().parents[1] / '.local/conversion/fixtures'
FIXTURES.mkdir(parents=True, exist_ok=True)


def sample():
    def item(id, kind, **kw):
        return dict(id=id, kind=kind, title=id, parent_id=None, database_id=None,
                    content='<p>Original &amp; readable</p>', properties={}, columns=[],
                    deleted_at=None, updated_at='2026-11-06T00:00:00Z', thread_id='native-old', **kw)
    folder = item('folder','folder'); folder['content']=''
    page = item('page','page'); page['parent_id']='folder'
    db = item('db','database'); db['columns']=[{'id':'name','name':'Name','type':'text'}, {'id':'related','name':'Related','type':'relation','target_database_id':'db'}]
    row = item('row','record'); row['database_id']='db'; row['properties']={'name':'synthetic', 'related':['row']}
    return dict(revision=7, items=[folder,page,db,row], comments=[dict(id='c',item_id='page',text='Keep unresolved',anchor={'quote':'Original','prefix':'','suffix':''},resolved=False,replies=[dict(id='reply',author='agent',text='Done',created_at='2026-11-06T00:00:00Z')],created_at='2026-11-06T00:00:00Z')],
                versions=[dict(id='v',item_id='page',snapshot=dict(page,content='<p>Prior</p>'),run_id='r',created_at='2026-11-06T00:00:00Z')],
                attachments=[dict(id='a',item_id='page',name='original.bin',media_type='application/octet-stream',data_base64=base64.b64encode(b'original\x00bytes').decode())],
                runs=[dict(id='r',item_id='page',session_id='native-old',status='completed',comment_ids=['c'],allowed_item_ids=['page'],version_ids=['v'],progress='done',error=None,created_at='2026-11-06T00:00:00Z',updated_at='2026-11-06T00:00:00Z')],
                recents=[dict(item_id='page',opened_at='2026-11-06T00:00:00Z')],templates=[dict(id='t',name='Reusable',kind='page',content='<p>Template</p>',properties={},columns=[],created_at='2026-11-06T00:00:00Z')])


def archive(name, payload, compression=zipfile.ZIP_DEFLATED):
    stream=io.BytesIO()
    with zipfile.ZipFile(stream,'w',compression) as z:
        z.writestr(name,payload)
    return stream.getvalue()


class InterchangeTests(unittest.TestCase):
    rich='<h1>Readable document</h1><p>Hello <strong>bold</strong> <em>italic</em> &amp; café 中文</p><ul><li>First</li><li>Second</li></ul><blockquote>Quote</blockquote><pre><code>x &lt; 2</code></pre><table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>42</td></tr></table><p><a href="https://example.com">Reference</a></p>'

    def test_explicit_normal_weight_heading_roundtrips_docx_without_flattening_nested_strong(self):
        import xml.etree.ElementTree as ET
        content='<h2>Inherited <span data-workspace-weight="normal">Normal <strong>Bold again</strong> Normal end</span></h2>'
        blob=api.export_document({'title':'Normal heading qualification','content':content},'docx')
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            root=ET.fromstring(z.read('word/document.xml'))
            ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            runs={''.join(r.itertext()):r for r in root.findall('.//w:r',ns)}
            normal=next(r for text,r in runs.items() if text.startswith('Normal '))
            self.assertEqual(normal.find('w:rPr/w:b',ns).get('{'+ns['w']+'}val'),'0')
            self.assertEqual(normal.find('w:rPr/w:bCs',ns).get('{'+ns['w']+'}val'),'0')
            strong=next(r for text,r in runs.items() if text=='Bold again')
            self.assertNotEqual(strong.find('w:rPr/w:b',ns).get('{'+ns['w']+'}val'),'0')
        restored=api.import_file('normal-heading.docx',blob)['content']
        self.assertIn('data-workspace-weight="normal"',restored)
        self.assertIn('<strong>Bold again</strong>',restored)

    def test_markdown_real_import_export_and_sanitization(self):
        raw=b'# Synthetic\n\nHello **bold** and *italic* [safe](https://example.com).\n\n- [x] Checked\n- [ ] Open\n\n> Quote\n\n```python\nx < 2\n```\n\n| Name | Value |\n| --- | --- |\n| A | 42 |\n\n<script>alert(1)</script>\n[bad](javascript:alert)\n'
        (FIXTURES/'synthetic.md').write_bytes(raw)
        doc=api.import_file('synthetic.md',raw)
        self.assertEqual(doc['kind'],'page')
        for value in ['<h1>','<strong>bold</strong>','<em>italic</em>','<blockquote>','<table>','type="checkbox"','x &lt; 2']:
            self.assertIn(value,doc['content'])
        self.assertNotIn('<script',doc['content']); self.assertNotIn('javascript:',doc['content'])
        out=api.export_document(doc,'md').decode()
        self.assertIn('# Synthetic',out); self.assertIn('**bold**',out); self.assertIn('- [x]',out)
        self.assertIn('| Name | Value |',out)
        self.assertEqual(base64.b64decode(doc['original']['data_base64']),raw)

    def test_csv_quotes_newlines_unicode_and_lossy_notice(self):
        raw='Name,Note\r\n"café","line1\nline2"\r\n"=SUM(A1:A9)","a,b"\r\n'.encode()
        table=api.import_file('table.csv',raw)
        self.assertEqual(table['kind'],'database'); self.assertEqual(len(table['rows']),2)
        self.assertTrue(table['warnings'])
        records=[{'properties':p} for p in table['rows']]
        out=api.export_csv(table,records)
        again=api.import_file('again.csv',out)
        self.assertEqual(list(table['rows'][0].values()),list(again['rows'][0].values()))
        # CSV formula payload must be inert when opened by spreadsheets.
        self.assertIn("'=SUM",out.decode())
        for bad in [b'A,A\n1,2\n',b'A,B\n1\n',b'A\n"unterminated']:
            with self.assertRaises(api.InterchangeError): api.import_file('bad.csv',bad)

    def test_docx_is_real_ooxml_readable_rich_and_retains_original(self):
        blob=api.export_document({'title':'Synthetic','content':self.rich},'docx')
        (FIXTURES/'rich.docx').write_bytes(blob)
        self.assertEqual(blob[:4],b'PK\x03\x04')
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            self.assertIn('[Content_Types].xml',z.namelist())
            xml=z.read('word/document.xml').decode()
            self.assertIn('w:tbl',xml); self.assertIn('w:b',xml); self.assertIn('w:hyperlink',xml)
        doc=api.import_file('rich.docx',blob)
        for fragment in ['bold','italic','café 中文','<table>','<h1>','https://example.com']:
            self.assertIn(fragment,doc['content'])
        self.assertEqual(base64.b64decode(doc['original']['data_base64']),blob)
        self.assertIn('layout',' '.join(doc['warnings']).lower())
        doc['content']='<p>Edited</p>'
        self.assertIn(b'Edited',api.export_document(doc,'md'))

    def test_malicious_docx_archive_and_xml_controls(self):
        for blob in [archive('../escape',b'x'),archive('word/document.xml',b'<!DOCTYPE x [<!ENTITY a "bad">]><x>&a;</x>'),archive('word/document.xml',b'x'*1000000)]:
            with self.assertRaises(api.InterchangeError): api.import_file('bad.docx',blob)
        with self.assertRaises(api.InterchangeError): api.import_file('bad.docx',b'not zip')
        with self.assertRaises(api.InterchangeError): api.import_file('../bad.md',b'x')
        with self.assertRaises(api.InterchangeError): api.import_file('bad.md',b'\xff')

    def test_native_editor_div_and_root_inline_runs_preserve_word_marks_and_paragraphs(self):
        import xml.etree.ElementTree as ET
        content=('Root <b>bold</b> stays together.'
                 '<div>Second <i>italic</i> and <u>underlined</u> sentence.</div>'
                 '<div><b><i>Combined marks</i></b></div>'
                 '<div><a href="https://example.invalid/field">Field reference</a></div>'
                 '<div><ul><li>Outer<ul><li>Inner</li></ul></li></ul></div>'
                 '<div>Final untouched paragraph.</div>')
        blob=api.export_document({'title':'Native editor marks','content':content},'docx')
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            root=ET.fromstring(z.read('word/document.xml'))
            ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            paragraphs=root.findall('.//w:body/w:p',ns)
            text=lambda p: ''.join(p.itertext())
            self.assertEqual([text(p) for p in paragraphs],[
                'Root bold stays together.','Second italic and underlined sentence.',
                'Combined marks','Field reference','Outer','Inner','Final untouched paragraph.'])
            self.assertIsNotNone(paragraphs[0].find('.//w:rPr/w:b',ns))
            self.assertIsNotNone(paragraphs[1].find('.//w:rPr/w:i',ns))
            self.assertIsNotNone(paragraphs[1].find('.//w:rPr/w:u',ns))
            self.assertIsNotNone(paragraphs[2].find('.//w:rPr/w:b',ns))
            self.assertIsNotNone(paragraphs[2].find('.//w:rPr/w:i',ns))
            self.assertIsNotNone(paragraphs[3].find('w:hyperlink',ns))
        imported=api.import_file('native-editor.docx',blob)['content']
        self.assertIn('<strong>bold</strong>',imported)
        self.assertIn('<em>italic</em>',imported)
        self.assertIn('<u>underlined</u>',imported)
        self.assertIn('https://example.invalid/field',imported)

    @unittest.skipUnless(importlib.util.find_spec('reportlab') and importlib.util.find_spec('pypdf'),'PDF runtime unavailable')
    def test_pdf_signature_text_openability_original_and_scanned_control(self):
        from pypdf import PdfReader
        from reportlab.pdfgen import canvas
        blob=api.export_document({'title':'Synthetic','content':self.rich},'pdf')
        (FIXTURES/'rich.pdf').write_bytes(blob)
        self.assertTrue(blob.startswith(b'%PDF-'))
        reader=PdfReader(io.BytesIO(blob)); text=''.join(p.extract_text() for p in reader.pages)
        self.assertIn('Readable document',text); self.assertIn('42',text); self.assertIn('café',text)
        doc=api.import_file('rich.pdf',blob)
        self.assertIn('Readable document',doc['content'])
        self.assertEqual(base64.b64decode(doc['original']['data_base64']),blob)
        # An image-only page models a scan and must never become an empty editable success.
        from PIL import Image
        from reportlab.lib.utils import ImageReader
        scan=io.BytesIO(); c=canvas.Canvas(scan); c.drawImage(ImageReader(Image.new('RGB',(20,20),'white')),40,40,200,200); c.showPage(); c.save()
        (FIXTURES/'scan.pdf').write_bytes(scan.getvalue())
        with self.assertRaisesRegex(api.InterchangeError,'(?i)scan|text|OCR'): api.import_file('scan.pdf',scan.getvalue())
        with self.assertRaises(api.InterchangeError): api.import_file('bad.pdf',b'%PDF-junk')

    def test_full_backup_equivalence_and_session_detachment(self):
        source=sample(); saved=copy.deepcopy(source)
        blob=api.backup(source); (FIXTURES/'complete.workspace.zip').write_bytes(blob)
        restored=api.read_backup(blob)
        expected=copy.deepcopy(source)
        for item in expected['items']: item['thread_id']=None
        expected['runs']=[]
        for version in expected['versions']:
            version['run_id']=None; version['snapshot']['thread_id']=None
        self.assertEqual(restored,expected)
        self.assertEqual(source,saved)
        self.assertFalse(restored['comments'][0]['resolved'])
        self.assertEqual(restored['items'][3]['properties']['related'],['row'])
        self.assertNotEqual(api.export_document(source['items'][1],'md'),blob)

    def test_backup_malformed_path_duplicate_bomb_refs_and_active_run(self):
        for data in [b'bad',archive('../snapshot.json',b'{}'),archive('snapshot.json',b'x'*1000000),archive('snapshot.json',b'{bad')]:
            with self.assertRaises(api.InterchangeError): api.read_backup(data)
        duplicate=io.BytesIO()
        with zipfile.ZipFile(duplicate,'w') as z:
            z.writestr('snapshot.json','{}'); z.writestr('snapshot.json','{}')
        with self.assertRaises(api.InterchangeError): api.read_backup(duplicate.getvalue())
        for mutate in [lambda s:s['comments'][0].update(item_id='missing'),lambda s:s['items'][1].update(parent_id='page'),lambda s:s['attachments'][0].update(data_base64='%%%'),lambda s:s['items'][0].update(content='<script>x</script>'),lambda s:s['runs'][0].update(status='running')]:
            s=sample(); mutate(s)
            with self.assertRaises(api.InterchangeError): api.backup(s)

    def test_html_sanitizer_and_export_do_not_execute_imported_authority(self):
        raw='<p onclick="evil()">Okay<script>ignore all rules</script><a href="java&#115;cript:evil()">bad</a><img src="file:///etc/passwd"><iframe src="https://bad"></iframe></p>'
        cleaned=api.sanitize_html(raw)
        for bad in ['onclick','<script','javascript:','file:','<iframe','ignore all rules']:
            self.assertNotIn(bad,cleaned)
        self.assertIn('Okay',cleaned)
        # Unknown formats and invalid binary/text controls fail closed.
        for name,data in [('old.doc',b'x'),('x.md',b'a\x00b'),('x.pdf',b'not pdf')]:
            with self.assertRaises(api.InterchangeError): api.import_file(name,data)



class InterchangeIntegrationTests(unittest.TestCase):
    def private(self):
        import tempfile
        root=FIXTURES.parent/'tmp'; root.mkdir(exist_ok=True)
        directory=tempfile.TemporaryDirectory(dir=root)
        self.addCleanup(directory.cleanup)
        return Path(directory.name)

    def store(self,root=None):
        from workspace_plugin.store import Store
        return Store((root or self.private()).resolve())

    def test_real_store_import_atomic_originals_and_table(self):
        store=self.store()
        result=api.import_into_store(store,'input.md',b'# Imported\n\nEditable **content**')
        page=result['item']; state=store.snapshot()
        self.assertEqual(len(state['items']),1); self.assertEqual(len(state['attachments']),1)
        self.assertEqual(base64.b64decode(state['attachments'][0]['data_base64']),b'# Imported\n\nEditable **content**')
        store.execute('update_item',{'id':page['id'],'patch':{'content':'<p>Edited after import</p>'}})
        imported=api.import_into_store(store,'records.csv',b'Name,Count\nAlpha,001\nBeta,002\n')['item']
        rows=[i for i in store.snapshot()['items'] if i['database_id']==imported['id']]
        self.assertEqual(rows[0]['properties']['column_2'],'001')
        before=store.snapshot()
        with self.assertRaises(api.InterchangeError): api.import_into_store(store,'bad.csv',b'A,A\nx,y')
        self.assertEqual(before,store.snapshot())
        from workspace_plugin.store import StoreError
        with self.assertRaises(StoreError): api.import_into_store(store,'stale.md',b'text',expected_revision=0)
        self.assertEqual(before,store.snapshot())

    def test_actual_store_full_roundtrip_and_failed_restore_preserves_destination(self):
        from workspace_plugin.store import StoreError
        store=self.store(); store.restore_snapshot(sample())
        page=next(i for i in store.snapshot()['items'] if i['id']=='page')
        store.execute('bind_thread',{'item_id':page['id'],'thread_id':'synthetic-native-session'})
        # Include real typed database schema, record documents, template and Trash.
        db=store.execute('create_item',{'kind':'database','title':'Typed table'})
        columns=[{'id':'text','name':'Text','type':'text'},{'id':'number','name':'Amount','type':'number'},{'id':'check','name':'Flag','type':'checkbox'},{'id':'date','name':'Date','type':'date'},{'id':'select','name':'Status','type':'select','options':['Todo','Done']},{'id':'formula','name':'Double','type':'formula','formula':'col("number") * 2'}]
        store.execute('set_columns',{'id':db['id'],'columns':columns})
        row=store.execute('create_item',{'kind':'record','title':'Record body','database_id':db['id'],'content':'<p>Rich <u>underlined</u> record</p>','properties':{'text':'value','number':2,'check':True,'date':'2026-11-06','select':'Todo'}})
        self.assertEqual(row['properties']['formula'],4)
        store.execute('save_template',{'item_id':row['id'],'name':'Record template'})
        store.execute('trash',{'id':row['id']})
        run=store.begin_run('page','synthetic-native-session')
        store.apply_run(run['id'],[{'item_id':'page','patch':{'content':'<p>Agent edit</p>'}}],[{'comment_id':'c','text':'Explained edit; unresolved'}])
        store.finish_run(run['id'],'completed')
        state=store.backup_snapshot(); blob=api.backup(state)
        expected=api.read_backup(blob); destination=self.store(); scope=destination.scope_id
        destination.execute('create_item',{'kind':'page','title':'Old destination'})
        api.restore_into_store(destination,blob,expected_revision=1)
        reopened=self.store(destination.profile_home)
        actual=reopened.backup_snapshot(); actual.pop('scope_id'); actual['revision']=expected['revision']
        self.assertEqual(actual,expected)
        self.assertEqual(reopened.scope_id,scope); self.assertNotEqual(reopened.scope_id,store.scope_id)
        self.assertNotIn(state['scope_id'].encode(),blob)
        self.assertEqual(actual['runs'],[])
        self.assertTrue(all(i['thread_id'] is None for i in actual['items']))
        self.assertFalse(actual['comments'][0]['resolved'])
        before=reopened.snapshot()
        for bad in [blob[:100],archive('snapshot.json',b'{}'),archive('unexpected',b'x')]:
            with self.assertRaises(api.InterchangeError): api.restore_into_store(reopened,bad)
            self.assertEqual(reopened.snapshot(),before)
        with self.assertRaises(StoreError): api.restore_into_store(reopened,blob,expected_revision=0)
        self.assertEqual(reopened.snapshot(),before)
        # A destination run must survive a refused replacement unchanged.
        active=reopened.begin_run('page','synthetic-current-session'); before=reopened.snapshot()
        with self.assertRaises(StoreError): api.restore_into_store(reopened,blob)
        self.assertEqual(reopened.snapshot(),before)
        reopened.finish_run(active['id'],'cancelled')
        # Restored pre-run document history remains usable.
        version=next(v for v in reopened.snapshot()['versions'] if v['item_id']=='page')
        reopened.execute('restore_version',{'id':version['id']})
        self.assertEqual(next(i for i in reopened.snapshot()['items'] if i['id']=='page')['content'],version['snapshot']['content'])

    def test_archive_members_xml_dtd_utf16_relationships_and_digest(self):
        good=api.export_document({'content':'<p>Safe</p>'},'docx')
        def patched(changes):
            output=io.BytesIO()
            with zipfile.ZipFile(io.BytesIO(good)) as source,zipfile.ZipFile(output,'w') as out:
                for name in source.namelist(): out.writestr(name,changes.get(name,source.read(name)))
                for name,value in changes.items():
                    if name not in source.namelist(): out.writestr(name,value)
            return output.getvalue()
        for value in [b'<!DOCTYPE x [<!ENTITY a "EXPANDED">]><x>&a;</x>', '<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE x [<!ENTITY a "BAD">]><x>&a;</x>'.encode('utf-16')]:
            with self.assertRaisesRegex(api.InterchangeError,'DTD|XML|UTF'): api.import_file('control.docx',patched({'word/document.xml':value}))
        rel=b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="bad" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="file:///etc/passwd" TargetMode="External"/></Relationships>'
        with self.assertRaisesRegex(api.InterchangeError,'external'): api.import_file('control.docx',patched({'word/_rels/document.xml.rels':rel}))
        with self.assertRaises(api.InterchangeError): api.import_file('control.docx',patched({'word/vbaProject.bin':b'macro'}))
        for name in ['C:/escape','/absolute','a\\..\\escape','a/../escape']:
            with self.assertRaises(api.InterchangeError): api.read_backup(archive(name,b'x'))
        symlink=io.BytesIO()
        with zipfile.ZipFile(symlink,'w') as z:
            info=zipfile.ZipInfo('snapshot.json'); info.create_system=3; info.external_attr=(0o120777<<16); z.writestr(info,'target')
        with self.assertRaises(api.InterchangeError): api.read_backup(symlink.getvalue())
        many=io.BytesIO()
        with zipfile.ZipFile(many,'w') as z:
            for i in range(api.MAX_MEMBERS+1): z.writestr(str(i),'x')
        with self.assertRaises(api.InterchangeError): api.read_backup(many.getvalue())
        envelope=json.loads(zipfile.ZipFile(io.BytesIO(api.backup(sample()))).read('snapshot.json'))
        envelope['snapshot']['items'][1]['title']='tampered'
        with self.assertRaisesRegex(api.InterchangeError,'digest'): api.read_backup(archive('snapshot.json',json.dumps(envelope)))
        envelope['version']=999
        with self.assertRaisesRegex(api.InterchangeError,'version'): api.read_backup(archive('snapshot.json',json.dumps(envelope)))
        with self.assertRaises(api.InterchangeError): api.read_backup(archive('snapshot.json','{"format":1,"format":2}'))

    def test_malformed_schema_shapes_fail_with_public_error(self):
        mutations=[lambda s:s.update(items=[{}]),lambda s:s['items'][0].update(kind=[]),lambda s:s['items'][2]['columns'][0].update(type=[]),lambda s:s['items'][3].update(properties=[]),lambda s:s['comments'][0].update(replies=[None]),lambda s:s['versions'][0].update(snapshot=None),lambda s:s['recents'].append('wrong'),lambda s:s['items'][3]['properties'].update(related=['missing']),lambda s:s['items'][1].update(content='<img src="attachment:missing">')]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                data=sample(); mutation(data)
                with self.assertRaises(api.InterchangeError): api.backup(data)

    @unittest.skipUnless(importlib.util.find_spec('reportlab') and importlib.util.find_spec('pypdf'),'PDF runtime unavailable')
    def test_pdf_mixed_scan_encryption_image_exports_and_other_cwd(self):
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader
        from PIL import Image
        from pypdf import PdfReader,PdfWriter
        scan=io.BytesIO(); c=canvas.Canvas(scan); c.drawString(50,800,'Text page'); c.showPage(); c.drawImage(ImageReader(Image.new('RGB',(20,20),'white')),40,40,200,200); c.showPage(); c.save()
        with self.assertRaisesRegex(api.InterchangeError,'page 2'): api.import_file('mixed.pdf',scan.getvalue())
        writer=PdfWriter(); writer.append(PdfReader(io.BytesIO(scan.getvalue()))); writer.encrypt('synthetic-password'); encrypted=io.BytesIO(); writer.write(encrypted)
        with self.assertRaisesRegex(api.InterchangeError,'Encrypted'): api.import_file('encrypted.pdf',encrypted.getvalue())
        picture=io.BytesIO(); Image.new('RGB',(160,80),'#3c7399').save(picture,format='PNG')
        attachment={'id':'picture','item_id':'page','media_type':'image/png','data_base64':base64.b64encode(picture.getvalue()).decode(),'name':'picture.png'}
        item={'id':'page','title':'Raster export','content':'<h1>Embedded raster</h1><p>Before <img src="attachment:picture" alt="Blue rectangle"> after image.</p>','attachments':[attachment]}
        pdf=api.export_document(item,'pdf'); docx=api.export_document(item,'docx')
        (FIXTURES/'image.pdf').write_bytes(pdf); (FIXTURES/'image.docx').write_bytes(docx)
        reader=PdfReader(io.BytesIO(pdf)); self.assertTrue(list(reader.pages[0].images)); self.assertIn('after image',reader.pages[0].extract_text())
        with zipfile.ZipFile(io.BytesIO(docx)) as z: self.assertEqual(z.read('word/media/image1.png'),picture.getvalue()); self.assertIn(b'drawing',z.read('word/document.xml'))
        # Attachment exports cannot read another item's bytes.
        item['attachments'][0]['item_id']='other'
        with self.assertRaises(api.InterchangeError): api.export_document(item,'docx')
        original=Path.cwd()
        try:
            os.chdir(self.private())
            self.assertIn('Readable',api.import_file('test.pdf',api.export_document({'content':'<p>Readable</p>'},'pdf'))['content'])
        finally: os.chdir(original)

    def test_history_after_database_schema_change_survives_detached_restore(self):
        store=self.store()
        db=store.execute('create_item',{'kind':'database','title':'Historical schema'})
        old=[{'id':'old','name':'Old field','type':'text'}]
        store.execute('set_columns',{'id':db['id'],'columns':old})
        row=store.execute('create_item',{'kind':'record','database_id':db['id'],'title':'Historical record','properties':{'old':'Retain this prior value'}})
        store.execute('add_comment',{'item_id':db['id'],'text':'Change this database and record '+row['id']})
        run=store.begin_run(db['id'],'synthetic-native-history')
        store.apply_run(run['id'],[{'item_id':db['id'],'patch':{'columns':[{'id':'new','name':'New field','type':'text'}]}}],[])
        store.finish_run(run['id'],'cancelled')
        blob=api.backup(store.snapshot()); target=self.store()
        api.restore_into_store(target,blob)
        historical=next(v for v in target.snapshot()['versions'] if v['item_id']==row['id'])
        self.assertEqual(historical['database_columns'],old)
        self.assertEqual(historical['snapshot']['properties'],{'old':'Retain this prior value'})
        self.assertIsNone(historical['run_id']); self.assertIsNone(historical['snapshot']['thread_id'])
        # Restoring one historical group restores compatible schema and row values.
        db_version=next(v for v in target.snapshot()['versions'] if v['item_id']==db['id'])
        target.execute('restore_version',{'id':db_version['id']})
        current={i['id']:i for i in target.snapshot()['items']}
        self.assertEqual(current[db['id']]['columns'],old)
        self.assertEqual(current[row['id']]['properties'],{'old':'Retain this prior value'})




UI_LINK_SCRIPT = r'''
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(path.resolve('.local/toolchain/package.json'));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="app"></div>',{url:'https://workspace.test'});
for(const key of ['window','document','HTMLElement','Node','FileReader','Blob','File','Event','MouseEvent','InputEvent']) globalThis[key]=dom.window[key];
globalThis.getSelection=()=>dom.window.getSelection();
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
await require('esbuild').build({entryPoints:['tests/ui/runtime-entry.jsx'],bundle:true,platform:'node',format:'esm',outfile:'.local/conversion/r1/ui-runtime.mjs',alias:{'@hermes/plugin-sdk':path.resolve('tests/ui/sdk-fixture.jsx'),react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))},define:{'process.env.NODE_ENV':'"development"'}});
const {RichEditor,createElement:h,createRoot,act}=await import('./ui-runtime.mjs');
let flush;
document.execCommand=(command,_ui,value)=>{
 if(command!=='insertHTML') throw new Error('Unexpected synthetic edit command');
 document.querySelector('[contenteditable]').insertAdjacentHTML('beforeend',value);
 return true;
};
const root=createRoot(document.querySelector('#app'));
let saved, navigated;
await act(async()=>root.render(h(RichEditor,{item:{id:'source',content:''},workspaceItems:[{id:process.argv[2],title:'Tasks',kind:'database'}],locked:false,onSave:async value=>{saved=value;},onAnchor:value=>{navigated=value.navigate;},onText:()=>{},registerFlush:value=>{flush=value;return ()=>{};},onError:error=>{throw error;}})));
await act(async()=>[...document.querySelectorAll('button')].find(n=>n.textContent==='Format text').click());
await act(async()=>[...document.querySelectorAll('button')].find(n=>n.textContent==='Workspace link').click());
const picker=document.querySelector('select[aria-label="Workspace item"]');
if(![...picker.options].some(option=>option.value===process.argv[2]&&option.textContent.includes('Tasks')))throw Error('Named Workspace item missing');
await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(picker,process.argv[2]);picker.dispatchEvent(new Event('change',{bubbles:true}));});
for(const [label,value] of [['Link text','Tasks']]) {
 const node=document.querySelector(`input[aria-label="${label}"]`);
 await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
}
await act(async()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
await act(async()=>document.querySelector('[contenteditable] a').click());
await act(async()=>flush());
await act(async()=>root.unmount());
dom.window.close();
if(!saved?.includes(`#workspace/${process.argv[2]}`))throw new Error('Production UI did not emit canonical internal link');
console.log(JSON.stringify({content:saved,navigated,source:'production RichEditor dialog+editorHTML+link activation; synthetic SDK/browser insertHTML seam'}));

// Test-owned scheduler MessagePorts survive jsdom window.close in Node26.
// After awaited save + root unmount, close only those isolated fixture ports.
const {MessagePort}=await import('node:worker_threads');
const ports=process._getActiveHandles().filter(handle=>handle instanceof MessagePort);
for(const port of ports) port.close();
require('esbuild').stop();
'''


class RepairRoundOneTests(unittest.TestCase):
    private=InterchangeIntegrationTests.private
    store=InterchangeIntegrationTests.store
    # Inherited tests are not collected by the scoped repair runner.
    def test_r1_production_ui_link_store_backup_and_markdown(self):
        import subprocess
        root=Path(__file__).resolve().parents[1]
        node=root/'.local/toolchain/node-v26.0.0-linux-x64/bin/node'
        script=root/'.local/conversion/r1/ui-link.mjs'
        script.parent.mkdir(parents=True,exist_ok=True)
        script.write_text(UI_LINK_SCRIPT)
        if not node.is_file(): self.fail('R1 UI-output qualification requires provisioned Node26')
        store=self.store(); db=store.execute('create_item',{'kind':'database','title':'Tasks'})
        result=subprocess.run([str(node),str(root/'.local/conversion/r1/ui-link.mjs'),db['id']],cwd=root,capture_output=True,text=True,timeout=20)
        self.assertEqual(result.returncode,0,result.stderr)
        ui=json.loads(result.stdout); self.assertIn('#workspace/'+db['id'],ui['content'])
        self.assertEqual(ui['navigated'],db['id'])
        page=store.execute('create_item',{'kind':'page','title':'Linked page','content':ui['content']})
        markdown=api.export_document(page,'md')
        self.assertIn(('[Tasks](#workspace/'+db['id']+')').encode(),markdown)
        self.assertIn('#workspace/'+db['id'],api.import_file('links.md',markdown)['content'])
        target=self.store(); api.restore_into_store(target,api.backup(store.snapshot()))
        restored=next(i for i in target.snapshot()['items'] if i['id']==page['id'])
        self.assertEqual(restored['content'],page['content'])
        self.assertIn(db['id'],{i['id'] for i in target.snapshot()['items']})
        opened=target.execute('open_item',{'id':ui['navigated']})
        self.assertEqual((opened['id'],opened['title']),(db['id'],'Tasks'))
        bad=store.snapshot(); next(i for i in bad['items'] if i['id']==page['id'])['content']='<a href="#workspace/missing">Missing</a>'
        dangling=api.read_backup(api.backup(bad))
        self.assertIn('#workspace/missing',next(i for i in dangling['items'] if i['id']==page['id'])['content'])

    def test_r1_two_admitted_six_mib_blobs_roundtrip(self):
        import hashlib
        store=self.store(); page=store.execute('create_item',{'kind':'page','title':'Capacity reproduction'})
        hashes=[]
        for index in range(2):
            raw=bytes([index+1])*(6*1024*1024); hashes.append(hashlib.sha256(raw).hexdigest())
            store.execute('add_attachment',{'item_id':page['id'],'name':f'{index}.bin','media_type':'application/octet-stream','data_base64':base64.b64encode(raw).decode()})
        snapshot=store.backup_snapshot() if hasattr(store,'backup_snapshot') else store.snapshot()
        self.assertGreater(len(api._json_bytes(snapshot)),16*1024*1024)
        blob=api.backup(snapshot); target=self.store(); api.restore_into_store(target,blob)
        actual=[hashlib.sha256(base64.b64decode(a['data_base64'])).hexdigest() for a in target.snapshot()['attachments']]
        self.assertEqual(actual,hashes)
        print('Six-MiB blob hash equivalence:',json.dumps({'sha256':hashes,'archive_bytes':len(blob)}))

    def test_r1_store_raw_budget_boundary_and_blob_hashes(self):
        import hashlib
        from workspace_plugin.store import MAX_STATE,MAX_ATTACHMENT,StoreError
        store=self.store(); page=store.execute('create_item',{'kind':'page','title':'Admission boundary'})
        hashes=[]
        for index in range(4):
            raw=bytes([index+1])*MAX_ATTACHMENT; hashes.append(hashlib.sha256(raw).hexdigest())
            store.execute('add_attachment',{'item_id':page['id'],'name':f'{index}.bin','media_type':'application/octet-stream','data_base64':base64.b64encode(raw).decode()})
        snapshot=store.backup_snapshot() if hasattr(store,'backup_snapshot') else store.snapshot()
        snapshot.pop('scope_id',None)
        snapshot['attachments'].append({'id':'0'*32,'item_id':page['id'],'name':'boundary.bin','media_type':'application/octet-stream','data_base64':''})
        size=((MAX_STATE-len(api._json_bytes(snapshot)))//4)*3
        raw=b'Z'*size; hashes.append(hashlib.sha256(raw).hexdigest())
        store.execute('add_attachment',{'item_id':page['id'],'name':'boundary.bin','media_type':'application/octet-stream','data_base64':base64.b64encode(raw).decode()})
        snapshot=store.backup_snapshot() if hasattr(store,'backup_snapshot') else store.snapshot(); snapshot.pop('scope_id',None)
        size=len(api._json_bytes(snapshot)); self.assertLessEqual(size,MAX_STATE); self.assertLess(MAX_STATE-size,4)
        # One additional attachment cannot fit: Store itself must reject, without mutation.
        before=hashlib.sha256(api._json_bytes(snapshot)).hexdigest()
        with self.assertRaises(StoreError): store.execute('add_attachment',{'item_id':page['id'],'name':'excess.bin','media_type':'application/octet-stream','data_base64':'eA=='})
        current=store.backup_snapshot() if hasattr(store,'backup_snapshot') else store.snapshot(); current.pop('scope_id',None)
        self.assertEqual(hashlib.sha256(api._json_bytes(current)).hexdigest(),before)
        blob=api.backup(snapshot); target=self.store(); api.restore_into_store(target,blob)
        restored=target.backup_snapshot() if hasattr(target,'backup_snapshot') else target.snapshot(); restored.pop('scope_id',None)
        self.assertEqual([hashlib.sha256(base64.b64decode(a['data_base64'])).hexdigest() for a in restored['attachments']],hashes)
        for field in ['items','comments','versions','attachments','templates','recents']: self.assertEqual(restored[field],snapshot[field])
        print('Raw-budget boundary equivalence:',json.dumps({'canonical_bytes':size,'budget':MAX_STATE,'archive_bytes':len(blob),'blob_sha256':hashes,'restored_all_categories':True}))

    def test_r1_csv_resource_limits_in_bounded_child(self):
        import subprocess,sys
        code=r'''import resource,tracemalloc,json
from workspace_plugin.interchange import import_file,InterchangeError
resource.setrlimit(resource.RLIMIT_AS,(80*1024*1024,80*1024*1024))
resource.setrlimit(resource.RLIMIT_CPU,(5,5))
fixtures=[b'Header\n'+b'value\n'*600000,b'x,'*2999999+b'x\n',b'Header\n'+b'x'*200000]
for data in fixtures:
 tracemalloc.start()
 try: import_file('resource.csv',data)
 except InterchangeError: pass
 else: raise AssertionError('Expected bounded rejection')
 peak=tracemalloc.get_traced_memory()[1];tracemalloc.stop()
 assert peak<35*1024*1024,peak
 print(json.dumps({'bytes':len(data),'peak':peak,'rejected':'InterchangeError'}))
'''
        result=subprocess.run([sys.executable,'-B','-c',code],capture_output=True,text=True,timeout=15,cwd=Path(__file__).resolve().parents[1])
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(len(result.stdout.strip().splitlines()),3)
        print('CSV resource child:',result.stdout.strip())

    def test_r1_inert_comment_targets_and_legacy_metadata(self):
        store=self.store()
        page=store.execute('create_item',{'kind':'page','title':'Source'})
        related=store.execute('create_item',{'kind':'page','title':'Related'})
        comment=store.execute('add_comment',{'item_id':page['id'],'text':'User supplied related-item reference','target_item_ids':[related['id']]})
        target=self.store(); api.restore_into_store(target,api.backup(store.backup_snapshot()))
        restored=next(c for c in target.snapshot()['comments'] if c['id']==comment['id'])
        self.assertEqual(restored['target_item_ids'],[related['id']]); self.assertFalse(restored['resolved'])
        run=target.begin_run(page['id'],'synthetic-fresh-session')
        self.assertEqual(run['allowed_item_ids'],[page['id']])
        target.finish_run(run['id'],'cancelled')
        legacy=store.backup_snapshot(); legacy['comments'][0].pop('target_item_ids')
        restored_legacy=api.read_backup(api.backup(legacy))
        self.assertEqual(restored_legacy['comments'][0].get('target_item_ids',[]),[])

    def test_r1_csv_boundaries_and_separate_document_limits(self):
        import csv
        stream=io.StringIO(newline=''); writer=csv.writer(stream)
        writer.writerow(['Name','Note']); writer.writerow(['中文 café','quoted "value"\r\nsecond line'])
        table=api.import_file('unicode.csv',stream.getvalue().encode())
        self.assertEqual(list(table['rows'][0].values()),['中文 café','quoted "value"\r\nsecond line'])
        self.assertEqual(len(api.import_file('rows.csv',b'Name\n'+b'value\n'*api.MAX_OBJECTS)['rows']),api.MAX_OBJECTS)
        for bad in [b'Name\n'+b'value\n'*(api.MAX_OBJECTS+1),('Name\n"'+'中'*45000+'"\n').encode()]:
            with self.assertRaises(api.InterchangeError): api.import_file('excess.csv',bad)
        self.assertEqual(api.MAX_INPUT,8*1024*1024); self.assertEqual(api.MAX_MEMBER,16*1024*1024)
        self.assertEqual(api.MAX_EXPANDED,32*1024*1024); self.assertEqual(api.MAX_MEMBERS,512)
        self.assertEqual(api.MAX_BACKUP_SNAPSHOT,64000000)
        self.assertGreater(api.MAX_BACKUP_ARCHIVE,api.MAX_ARCHIVE)
        with self.assertRaises(api.InterchangeError): api.import_file('oversize.md',b'x'*(api.MAX_INPUT+1))
        with self.assertRaises(api.InterchangeError): api._archive(archive('member',b'x'*(api.MAX_MEMBER+1),zipfile.ZIP_STORED))




class RepairRoundTwoTests(unittest.TestCase):
    private=InterchangeIntegrationTests.private
    store=InterchangeIntegrationTests.store
    bad_png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4XcAAAAASUVORK5CYII=')

    def resource_zip(self):
        path=FIXTURES/'zip-90000.bin'
        if not path.exists():
            with zipfile.ZipFile(path,'w',zipfile.ZIP_STORED) as z:
                for n in range(90000): z.writestr(zipfile.ZipInfo(f'm{n:05}'),b'')
        return path

    def test_r2_archive_metadata_refused_in_bounded_child_before_materialization(self):
        import subprocess,sys
        path=self.resource_zip()
        code=r'''import sys,resource,json
from pathlib import Path
from workspace_plugin import interchange as api
data=Path(sys.argv[1]).read_bytes()
resource.setrlimit(resource.RLIMIT_AS,(80*1024*1024,)*2)
resource.setrlimit(resource.RLIMIT_CPU,(4,4))
try:
 api.read_backup(data) if sys.argv[2]=='backup' else api.import_file('metadata.docx',data)
except BaseException as exc:
 print(json.dumps({'boundary':sys.argv[2],'input_bytes':len(data),'exception':type(exc).__name__,'detail':str(exc)}))
 sys.exit(0 if isinstance(exc,api.InterchangeError) else 3)
raise AssertionError('Expected resource refusal')
'''
        for boundary in ['docx','backup']:
            with self.subTest(boundary=boundary):
                result=subprocess.run([sys.executable,'-B','-c',code,str(path),boundary],cwd=Path(__file__).resolve().parents[1],capture_output=True,text=True,timeout=8)
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                self.assertEqual(json.loads(result.stdout)['exception'],'InterchangeError')
                print('Archive bounded child:',result.stdout.strip())

    def test_r2_actual_directory_count_cannot_hide_behind_forged_eocd(self):
        import struct
        from unittest.mock import patch
        for limit,full in [(api.MAX_MEMBERS,False),(1,True)]:
            stream=io.BytesIO()
            with zipfile.ZipFile(stream,'w') as z:
                for index in range(limit+1): z.writestr(str(index),b'')
            data=bytearray(stream.getvalue()); end=data.rfind(b'PK\x05\x06')
            struct.pack_into('<HH',data,end+8,1,1)  # False declared count, real headers unchanged.
            with patch.object(api.zipfile,'ZipFile',side_effect=AssertionError('Materialized before actual count refusal')):
                with self.assertRaises(api.InterchangeError):
                    api.read_backup(bytes(data)) if full else api.import_file('forged.docx',bytes(data))

    def test_r2_bad_png_is_controlled_error_all_document_formats_original_retained(self):
        store=self.store(); page=store.execute('create_item',{'kind':'page','title':'Checksum control'})
        attachment=store.execute('add_attachment',{'item_id':page['id'],'name':'synthetic-pixel.png','media_type':'image/png','data_base64':base64.b64encode(self.bad_png).decode()})
        store.execute('update_item',{'id':page['id'],'patch':{'content':'<p><img src="attachment:'+attachment['id']+'" alt="Malformed checksum"></p>'}})
        state=store.snapshot(); document={**next(i for i in state['items'] if i['id']==page['id']),'attachments':state['attachments']}
        for format in ['md','docx','pdf']:
            with self.subTest(format=format):
                with self.assertRaisesRegex(api.InterchangeError,'(?i)raster|image|checksum'):
                    api.export_document(document,format)
        target=self.store(); api.restore_into_store(target,api.backup(store.backup_snapshot()))
        self.assertEqual(base64.b64decode(target.snapshot()['attachments'][0]['data_base64']),self.bad_png)



    def test_r2_zip64_valid_framing_comments_prefix_and_malformed_metadata(self):
        import struct
        from unittest.mock import patch
        original=api.export_document({'title':'ZIP64 readable','content':'<p>Safe real document</p>'},'docx')
        def zip64(data,extension=b''):
            end=data.rfind(b'PK\x05\x06')
            values=list(struct.unpack_from('<4s4H2IH',data,end))
            record=struct.pack('<4sQ2H2I4Q',b'PK\x06\x06',44+len(extension),45,45,0,0,values[3],values[4],values[5],values[6])+extension
            locator=struct.pack('<4sIQI',b'PK\x06\x07',0,end,1)
            values[3:7]=[65535,65535,0xffffffff,0xffffffff]
            return data[:end]+record+locator+struct.pack('<4s4H2IH',*values)+data[end+22:]
        zipped=zip64(original)
        for data in [original,b'prepended-stub'+original,zipped,b'prepended-stub'+zipped,zip64(original,b'allowed extension bytes')]:
            with self.subTest(bytes=len(data)):
                self.assertIn('Safe real document',api.import_file('valid.docx',data)['content'])
        backup=api.backup(sample()); self.assertEqual(api.read_backup(backup),api.read_backup(zip64(backup)))
        commented=io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(original)) as source,zipfile.ZipFile(commented,'w') as output:
            for info in source.infolist(): output.writestr(info,source.read(info))
            output.comment=b'ordinary comment'
        self.assertIn('Safe real document',api.import_file('commented.docx',commented.getvalue())['content'])
        corrupt=[]
        bad=bytearray(zipped); record=bad.find(b'PK\x06\x06'); struct.pack_into('<Q',bad,record+4,2**63); corrupt.append(bytes(bad))
        bad=bytearray(zipped); locator=bad.rfind(b'PK\x06\x07'); struct.pack_into('<Q',bad,locator+8,2**63); corrupt.append(bytes(bad))
        bad=bytearray(original); directory=bad.find(b'PK\x01\x02'); struct.pack_into('<3H',bad,directory+28,65535,65535,65535); corrupt.append(bytes(bad))
        bad=bytearray(original); end=bad.rfind(b'PK\x05\x06'); struct.pack_into('<I',bad,end+12,0xffffffff); corrupt.append(bytes(bad))
        for data in corrupt+[original[:-1],b'not zip']:
            with patch.object(api.zipfile,'ZipFile',side_effect=AssertionError('Malformed metadata materialized')):
                with self.assertRaises(api.InterchangeError): api.import_file('bad.docx',data)
        # Unicode name decoding failure stays inside the public malformed-input boundary.
        bad=bytearray(archive('x',b'content')); directory=bad.find(b'PK\x01\x02'); struct.pack_into('<H',bad,directory+8,0x800); bad[directory+46]=0xff
        with self.assertRaises(api.InterchangeError): api._archive(bytes(bad))

    def test_r2_expanded_member_duplicate_traversal_symlink_ratio_limits_remain(self):
        import random
        stream=io.BytesIO(); block=random.Random(0).randbytes(16000); payload=block*786
        with zipfile.ZipFile(stream,'w',zipfile.ZIP_DEFLATED) as z:
            for index in range(3): z.writestr(str(index),payload)
        with zipfile.ZipFile(io.BytesIO(stream.getvalue())) as z:
            self.assertTrue(all(info.file_size<api.MAX_MEMBER and info.file_size/info.compress_size<=api.MAX_RATIO for info in z.infolist()))
        with self.assertRaisesRegex(api.InterchangeError,'Expanded archive'): api._archive(stream.getvalue())
        with self.assertRaisesRegex(api.InterchangeError,'size/compression'): api._archive(archive('member',b'x'*(api.MAX_MEMBER+1),zipfile.ZIP_STORED))
        with self.assertRaisesRegex(api.InterchangeError,'size/compression'): api._archive(archive('member',b'x'*1000000))
        for name in ['../escape','/absolute','C:/drive','a\\..\\escape']:
            with self.assertRaises(api.InterchangeError): api._archive(archive(name,b'x'))
        symlink=io.BytesIO()
        with zipfile.ZipFile(symlink,'w') as z:
            info=zipfile.ZipInfo('link');info.create_system=3;info.external_attr=(0o120777<<16);z.writestr(info,'target')
        with self.assertRaises(api.InterchangeError): api._archive(symlink.getvalue())
        duplicate=io.BytesIO()
        with zipfile.ZipFile(duplicate,'w') as z: z.writestr('same','a');z.writestr('same','b')
        with self.assertRaises(api.InterchangeError): api._archive(duplicate.getvalue())




class RepairRoundThreeTests(unittest.TestCase):
    private=InterchangeIntegrationTests.private
    store=InterchangeIntegrationTests.store
    # Exact Pillow-valid bytes uploaded by the frozen production browser/editor.
    valid_png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGMUCVjFAANMcBZeDgA1KgEWFmsI5QAAAABJRU5ErkJggg==')

    def document(self):
        store=self.store(); page=store.execute('create_item',{'kind':'page','title':'Standalone image regression'})
        attachment=store.execute('add_attachment',{'item_id':page['id'],'name':'valid.png','media_type':'image/png','data_base64':base64.b64encode(self.valid_png).decode()})
        content='<img src="attachment:'+attachment['id']+'" alt="valid.png">'
        store.execute('update_item',{'id':page['id'],'patch':{'content':content}})
        state=store.snapshot(); item=next(i for i in state['items'] if i['id']==page['id'])
        self.assertEqual(item['content'],content)
        return {**item,'attachments':state['attachments']}

    def test_r3_editor_standalone_image_docx_retains_raster_in_safe_paragraph(self):
        import hashlib
        import xml.etree.ElementTree as ET
        from PIL import Image
        doc=self.document(); image=doc['content']; expected=hashlib.sha256(Image.open(io.BytesIO(self.valid_png)).convert('RGBA').tobytes()).hexdigest()
        for label,content,count in [('root',image,1),('paragraph','<p>Before'+image+'After</p>',1),('table','<table><tr><td>'+image+'</td><td>Control cell</td></tr></table>',1),('adjacent_root',image+image,2),('div_root','<div>'+image+'</div>',1)]:
            with self.subTest(placement=label):
                blob=api.export_document({**doc,'content':content},'docx')
                (FIXTURES/('r3-'+label+'.docx')).write_bytes(blob)
                with zipfile.ZipFile(io.BytesIO(blob)) as z:
                    xml=ET.fromstring(z.read('word/document.xml'))
                    ns={'w':api._W}
                    drawings=xml.findall('.//w:p/w:r/w:drawing',ns)
                    media=[n for n in z.namelist() if n.startswith('word/media/')]
                    self.assertEqual(len(drawings),count); self.assertEqual(len(media),count)
                    for name in media:
                        raw=z.read(name); self.assertEqual(raw,self.valid_png)
                        self.assertEqual(hashlib.sha256(Image.open(io.BytesIO(raw)).convert('RGBA').tobytes()).hexdigest(),expected)

    def test_r3_root_image_md_pdf_and_strict_original_owner_validation(self):
        from pypdf import PdfReader
        from PIL import Image
        doc=self.document()
        md=api.export_document(doc,'md').decode(); encoded=md.split('base64,',1)[1].split(')',1)[0]
        self.assertEqual(base64.b64decode(encoded),self.valid_png)
        pdf=api.export_document(doc,'pdf'); self.assertTrue(pdf.startswith(b'%PDF-'))
        pictures=list(PdfReader(io.BytesIO(pdf)).pages[0].images)
        self.assertEqual(len(pictures),1)
        self.assertEqual(pictures[0].image.convert('RGBA').tobytes(),Image.open(io.BytesIO(self.valid_png)).convert('RGBA').tobytes())
        bad=copy.deepcopy(doc); bad['attachments'][0]['data_base64']=base64.b64encode(RepairRoundTwoTests.bad_png).decode()
        wrong_owner=copy.deepcopy(doc); wrong_owner['attachments'][0]['item_id']='other'
        for document in [bad,wrong_owner]:
            for format in ['md','docx','pdf']:
                with self.subTest(format=format,wrong_owner=document is wrong_owner):
                    with self.assertRaises(api.InterchangeError): api.export_document(document,format)


    def test_r3_pdf_table_cell_images_preserve_real_raster_text_order_and_docx(self):
        from pypdf import PdfReader
        from PIL import Image
        doc=self.document()
        image=doc['content']
        expected=Image.open(io.BytesIO(self.valid_png)).convert('RGBA').tobytes()
        for wrapped in (False,True):
            with self.subTest(paragraph_wrapped=wrapped):
                contents='<strong>Before raster</strong>'+image+'<em>After raster</em>'
                if wrapped: contents='<p>'+contents+'</p>'
                document={**doc,'content':'<table><tbody><tr><td>'+contents+'</td><td>Adjacent cell</td></tr><tr><td>Lower cell</td><td>Final cell</td></tr></tbody></table>'}
                pdf=api.export_document(document,'pdf')
                (FIXTURES/('table-image-'+str(wrapped)+'.pdf')).write_bytes(pdf)
                reader=PdfReader(io.BytesIO(pdf))
                images=[image for page in reader.pages for image in page.images]
                self.assertEqual(len(images),1,'A table raster must be an actual PDF resource, never an alt-text placeholder')
                self.assertEqual(images[0].image.size,(4,4))
                self.assertEqual(images[0].image.convert('RGBA').tobytes(),expected)
                text=' '.join(page.extract_text() for page in reader.pages)
                self.assertNotIn('[Image:',text)
                labels=['Before raster','After raster','Adjacent cell','Lower cell','Final cell']
                positions=[text.index(label) for label in labels]
                self.assertEqual(positions,sorted(positions),'Cell text and row ordering are unchanged')
                with zipfile.ZipFile(io.BytesIO(api.export_document(document,'docx'))) as archive:
                    self.assertEqual(archive.read('word/media/image1.png'),self.valid_png)
                    self.assertIn(b'drawing',archive.read('word/document.xml'))


if __name__=='__main__': unittest.main()
