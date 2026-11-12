"""Bounded, local Workspace interchange (API v1).

Public pure entrypoints:
  import_file(name, data) -> page {kind,title,content,original,warnings} or
      database {kind,title,columns,rows,warnings}; rows are property dictionaries.
  export_document(item, format) -> bytes; format: md/markdown, docx, pdf.
  export_csv(database, records, spreadsheet_safe=True) -> UTF-8 bytes.
  backup(snapshot) -> ZIP bytes; read_backup(bytes) -> validated snapshot.

Store adapters call only the owner's atomic import_document/import_table and
restore_snapshot helpers. No filesystem paths, profile selection, session lookup,
SQL, network access or native runs are accepted from imported data. Restore is
replacement, never implicit merging. IDs and all local references are retained;
scope_id, native thread IDs, runs and version run/session references are detached.
The Store assigns its own profile scope and revision at commit.

MD/CSV are explicitly lossy interchange, never complete backups. DOCX maps semantic
headings, paragraphs, basic marks, lists, tables and links. PDF imports text only,
rejecting image-only/mixed image-only pages; OCR is not provided. PDF exports a
new readable layout. Drawings, exact pagination, tracked changes, floating objects
and Word/PDF layout are not reconstructed; originals are retained byte-for-byte.
For image exports, the caller supplies item["attachments"] containing only its
own attachments. PNG/JPEG bytes are embedded; GIF/WebP use a PNG of the first
frame. Inline PNG/JPEG data URLs are also accepted. Remote images are never
fetched. PDF embeds bundled Vera for Latin and uses a standard CJK CID font
(requiring reader support); complex shaping/RTL fidelity is not promised.
Markdown implements bounded common block/inline forms, not full CommonMark.
DOCX import flattens list grouping/nesting and omits drawings/headers/footnotes;
its original remains the authoritative source for omitted content. Only UTF-8
DOCX XML is supported. Complete backup accepts the full Store canonical raw
64,000,000-byte budget, with separate ZIP envelope/transport headroom. The
Store-owned schema validator governs backup graph limits; converter tree limits
do not restrict persisted backups. Native #workspace/<id> links remain stable
fragment URIs in Markdown: readable identifiers outside Workspace, and native
links when reopened in Workspace. Missing targets remain inert unavailable links.

Limits are deliberate public boundaries, not an OS sandbox. PDF parsing/layout
runs in a bounded child process (20s wall, 15s CPU, 512MiB address space on POSIX).
DOCX/backup members are read into memory with actual-byte and ratio limits, no
extractall; macros, embeddings, DTD/entities and unsafe relationships are refused.
"""
from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import html
from html.parser import HTMLParser
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import struct
import subprocess
import sys
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET
import zipfile

MAX_INPUT = 8 * 1024 * 1024
MAX_ARCHIVE = 32 * 1024 * 1024
MAX_EXPANDED = 32 * 1024 * 1024
MAX_MEMBER = 16 * 1024 * 1024
MAX_MEMBERS = 512
MAX_RATIO = 200
MAX_OBJECTS = 10000
MAX_NODES = 100000
MAX_DEPTH = 32
MAX_PDF_PAGES = 100
# Full backups protect all Store-admitted canonical data, independently of the
# smaller untrusted document/converter limits above. All sizes are bytes.
MAX_BACKUP_SNAPSHOT = 64_000_000
MAX_BACKUP_MEMBER = MAX_BACKUP_SNAPSHOT + 4096  # JSON envelope headroom
MAX_BACKUP_ARCHIVE = MAX_BACKUP_MEMBER + 65536  # ZIP headers/comment headroom
MAX_BACKUP_REQUEST = 4 * ((MAX_BACKUP_ARCHIVE + 2) // 3) + 4096  # base64 + request metadata
LOSSY = 'Markdown/CSV exports are lossy interchange, not complete Workspace backups.'
LAYOUT = 'Semantic conversion only; exact original layout, drawings and pagination are not preserved. Original retained.'


class InterchangeError(ValueError):
    """Malformed, unsupported or over-limit interchange data; no mutation occurred."""


class ConversionUnavailable(InterchangeError):
    """The isolated converter runtime lacks an explicitly required dependency."""


def _check_bytes(data, limit=MAX_INPUT):
    if not isinstance(data, bytes) or not data or len(data) > limit:
        raise InterchangeError(f'Expected nonempty bytes within {limit} bytes')
    return data


def _text(data):
    _check_bytes(data)
    try:
        value=data.decode('utf-8-sig')
    except UnicodeError as exc:
        raise InterchangeError('Input must be UTF-8 text') from exc
    if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]',value):
        raise InterchangeError('Unsupported control character in text')
    return value


def _name(name):
    if not isinstance(name,str) or not name or len(name)>240 or name in {'.','..'} or re.search(r'[/\\:\x00-\x1f\x7f]',name):
        raise InterchangeError('Use a simple display filename, never a path')
    return name


def _url(value, image=False):
    value=html.unescape(value).strip()
    if re.search(r'[\x00-\x20\x7f]',value): return None
    if image:
        if re.fullmatch(r'attachment:[A-Za-z0-9_-]+',value): return value
        match=re.fullmatch(r'data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)',value)
        if match:
            try:
                raw=base64.b64decode(match[2],validate=True)
            except binascii.Error: return None
            if len(raw)<=MAX_INPUT and ((match[1]=='png' and raw.startswith(b'\x89PNG\r\n\x1a\n')) or (match[1]=='jpeg' and raw.startswith(b'\xff\xd8\xff'))):
                return value
        return None
    try: parts=urlsplit(value)
    except ValueError: return None
    if parts.scheme in {'http','https'} and parts.netloc: return value
    if parts.scheme=='mailto' and parts.path: return value
    if re.fullmatch(r'attachment:[A-Za-z0-9_-]+',value): return value
    # Canonical native editor link; Markdown keeps this stable fragment verbatim.
    # It is an inert reference, including when the target was subsequently purged.
    if re.fullmatch(r'#workspace/[A-Za-z0-9_-]+',value): return value
    if re.fullmatch(r'(?:workspace:|#)[A-Za-z0-9_-]+',value): return value
    return None


class _Node:
    def __init__(self, tag='', attrs=None, children=None):
        self.tag=tag; self.attrs=attrs or {}; self.children=children or []


_TAGS=set('p div span h1 h2 h3 h4 h5 h6 strong b em i u s strike del ul ol li input a img br hr pre code blockquote mark sub sup label table thead tbody tfoot tr td th'.split())
_VOID={'input','img','br','hr'}
_DROP={'script','style','iframe','object','embed','svg','math','template','noscript','head'}


class _HTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root=_Node(); self.stack=[self.root]; self.dropped=[]; self.count=0
    def handle_starttag(self,tag,attrs):
        self.count+=1
        if self.count>MAX_NODES or len(self.stack)>MAX_DEPTH: raise InterchangeError('HTML complexity limit exceeded')
        if self.dropped:
            if tag in _DROP: self.dropped.append(tag)
            return
        if tag in _DROP:
            self.dropped.append(tag); return
        if tag not in _TAGS: return
        attrs=dict(attrs); safe={}
        if tag=='a':
            value=_url(attrs.get('href',''))
            if value: safe['href']=value
        elif tag=='img':
            value=_url(attrs.get('src',''),image=True)
            if not value: return
            safe={'src':value,'alt':attrs.get('alt','')[:1000]}
        elif tag=='input':
            if attrs.get('type')!='checkbox': return
            safe={'type':'checkbox','disabled':''}
            if 'checked' in attrs: safe['checked']=''
        elif tag=='ol' and re.fullmatch(r'[0-9]{1,6}',attrs.get('start','')):
            safe['start']=attrs['start']
        elif tag in {'td','th'}:
            for attr in ['colspan','rowspan']:
                if re.fullmatch(r'[1-9][0-9]?',attrs.get(attr,'')): safe[attr]=attrs[attr]
        elif tag=='span' and (attrs.get('data-workspace-weight')=='normal' or
                re.fullmatch(r'\s*font-weight\s*:\s*(?:normal|400)\s*;?\s*',attrs.get('style') or '',re.I)):
            safe['data-workspace-weight']='normal'
        for attr,values in [('data-type',{'taskList','taskItem'}),('data-checked',{'true','false'})]:
            if attrs.get(attr) in values: safe[attr]=attrs[attr]
        if 'title' in attrs: safe['title']=attrs['title'][:1000]
        node=_Node(tag,safe); self.stack[-1].children.append(node)
        if tag not in _VOID: self.stack.append(node)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in _VOID: self.handle_endtag(tag)
    def handle_endtag(self,tag):
        if self.dropped:
            if self.dropped[-1]==tag: self.dropped.pop()
            return
        for pos in range(len(self.stack)-1,0,-1):
            if self.stack[pos].tag==tag:
                del self.stack[pos:]; break
    def handle_data(self,value):
        if not self.dropped:
            self.count+=1
            if self.count>MAX_NODES: raise InterchangeError('HTML complexity limit exceeded')
            # Drop unsupported controls, including XML-invalid nulls.
            value=re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]','',value)
            self.stack[-1].children.append(value)


def _tree(content):
    if not isinstance(content,str) or len(content.encode('utf-8'))>MAX_INPUT:
        raise InterchangeError('HTML must be a bounded string')
    parser=_HTML()
    try: parser.feed(content); parser.close()
    except (ValueError,RecursionError) as exc: raise InterchangeError('Invalid HTML') from exc
    return parser.root


def _serialize(node):
    if isinstance(node,str): return html.escape(node,quote=False)
    body=''.join(_serialize(c) for c in node.children)
    if not node.tag: return body
    attrs=''.join(' '+k+'="'+html.escape(v,quote=True)+'"' for k,v in node.attrs.items())
    return '<'+node.tag+attrs+'>'+('' if node.tag in _VOID else body+'</'+node.tag+'>')


def sanitize_html(content):
    """Allowlisted semantic HTML; scripts, CSS, handlers and unsafe URLs removed."""
    return _serialize(_tree(content))


def _plain(node):
    if isinstance(node,str): return node
    if node.tag=='br': return '\n'
    if node.tag=='img': return '[Image: '+node.attrs.get('alt','')+']'
    if node.tag=='input': return '[x] ' if 'checked' in node.attrs else '[ ] '
    return ''.join(_plain(c) for c in node.children)


def _inline_md(value):
    # Parse inline syntax after escaping all raw HTML; no executable HTML pass-through.
    pattern=re.compile(r'(`[^`\n]+`|!\[[^\]\n]*\]\([^\s)]+\)|\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~\n]+~~)')
    out=[]; last=0
    for match in pattern.finditer(value):
        out.append(html.escape(value[last:match.start()])); token=match[0]
        if token.startswith('`'): out.append('<code>'+html.escape(token[1:-1])+'</code>')
        elif token.startswith(('![','[')):
            m=re.fullmatch(r'(!?)\[([^\]]*)\]\(([^)]+)\)',token)
            url=_url(m[3],image=bool(m[1]))
            if m[1]: out.append('<img src="'+html.escape(url,quote=True)+'" alt="'+html.escape(m[2],quote=True)+'">' if url else html.escape(m[2]))
            else: out.append('<a href="'+html.escape(url,quote=True)+'">'+html.escape(m[2])+'</a>' if url else html.escape(m[2]))
        else:
            size=2 if token.startswith(('**','__','~~')) else 1
            tag='s' if token.startswith('~~') else ('strong' if size==2 else 'em')
            out.append('<'+tag+'>'+html.escape(token[size:-size])+'</'+tag+'>')
        last=match.end()
    out.append(html.escape(value[last:])); return ''.join(out)


def _markdown(value):
    lines=value.splitlines(); out=[]; pos=0
    while pos<len(lines):
        line=lines[pos]
        if not line.strip(): pos+=1; continue
        if re.match(r'^\s*(```|~~~)',line):
            fence=line.lstrip()[:3]; block=[]; pos+=1
            while pos<len(lines) and not lines[pos].lstrip().startswith(fence): block.append(lines[pos]); pos+=1
            out.append('<pre><code>'+html.escape('\n'.join(block))+'</code></pre>'); pos+=1; continue
        h=re.match(r'^(#{1,6})\s+(.+?)\s*#*$',line)
        if h: out.append(f'<h{len(h[1])}>'+_inline_md(h[2])+f'</h{len(h[1])}>'); pos+=1; continue
        if line.lstrip().startswith('>'):
            block=[]
            while pos<len(lines) and lines[pos].lstrip().startswith('>'):
                block.append(re.sub(r'^\s*> ?', '',lines[pos])); pos+=1
            out.append('<blockquote>'+_markdown('\n'.join(block))+'</blockquote>'); continue
        if pos+1<len(lines) and '|' in line and re.fullmatch(r'\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*',lines[pos+1]):
            cells=lambda x:[c.strip() for c in x.strip().strip('|').split('|')]
            heads=cells(line); out.append('<table><tr>'+''.join('<th>'+_inline_md(c)+'</th>' for c in heads)+'</tr>'); pos+=2
            while pos<len(lines) and '|' in lines[pos] and lines[pos].strip():
                row=cells(lines[pos])
                if len(row)!=len(heads): raise InterchangeError('Markdown table row width mismatch')
                out.append('<tr>'+''.join('<td>'+_inline_md(c)+'</td>' for c in row)+'</tr>'); pos+=1
            out.append('</table>'); continue
        m=re.match(r'^(\s*)([-+*]|\d+[.)])\s+(.*)',line)
        if m:
            # Indentation forms nested semantic lists; each source marker remains data.
            stack=[]
            while pos<len(lines):
                m=re.match(r'^(\s*)([-+*]|\d+[.)])\s+(.*)',lines[pos])
                if not m: break
                indent=len(m[1].expandtabs(4)); tag='ol' if m[2][0].isdigit() else 'ul'
                while stack and (indent<stack[-1][0] or (indent==stack[-1][0] and tag!=stack[-1][1])):
                    out.append('</li></'+stack.pop()[1]+'>')
                if stack and indent==stack[-1][0]: out.append('</li>')
                else:
                    if len(stack)>=MAX_DEPTH: raise InterchangeError('Markdown nesting limit exceeded')
                    out.append('<'+tag+(' start="'+re.match(r'\d+',m[2])[0]+'"' if tag=='ol' else '')+'>'); stack.append((indent,tag))
                body=m[3]; task=re.match(r'^\[([ xX])\]\s*(.*)',body)
                out.append('<li>')
                if task:
                    out.append('<input type="checkbox" disabled'+(' checked' if task[1].lower()=='x' else '')+'>'); body=task[2]
                out.append(_inline_md(body)); pos+=1
            while stack: out.append('</li></'+stack.pop()[1]+'>')
            continue
        block=[line]; pos+=1
        while pos<len(lines) and lines[pos].strip() and not re.match(r'^(#{1,6}\s|\s*[-+*]\s|\s*\d+[.)]\s|>|```|~~~)',lines[pos]):
            block.append(lines[pos]); pos+=1
        out.append('<p>'+'<br>'.join(_inline_md(v) for v in block)+'</p>')
    return sanitize_html(''.join(out))


def _md(node,depth=0):
    if isinstance(node,str): return re.sub(r'([\\`*_[\]<>])',r'\\\1',node)
    tag=node.tag
    body=''.join(_md(c,depth+1) for c in node.children)
    if tag in {'h1','h2','h3','h4','h5','h6'}: return '\n'+'#'*int(tag[1])+' '+body.strip()+'\n\n'
    if tag in {'strong','b'}: return '**'+body+'**'
    if tag in {'em','i'}: return '*'+body+'*'
    if tag in {'s','strike','del'}: return '~~'+body+'~~'
    if tag=='pre':
        code=_plain(node); fence='`'*max(3,max((len(m[0])+1 for m in re.finditer(r'`+',code)),default=3))
        return '\n'+fence+'\n'+code+'\n'+fence+'\n\n'
    if tag=='code': return '`'+_plain(node).replace('`','\\`')+'`'
    if tag=='a': return '['+body+']('+node.attrs.get('href','')+')' if node.attrs.get('href') else body
    if tag=='img': return '!['+node.attrs.get('alt','')+']('+node.attrs['src']+')'
    if tag=='input': return '[x] ' if 'checked' in node.attrs else '[ ] '
    if tag=='p' and node.children and isinstance(node.children[0],_Node) and node.children[0].tag=='input':
        return '\n- '+body.strip()+'\n\n'
    if tag in {'ul','ol'}:
        result=[]
        start=int(node.attrs.get('start','1'))
        for i,child in enumerate(c for c in node.children if isinstance(c,_Node) and c.tag=='li'):
            value=_md(child).strip(); lines=value.splitlines() or ['']
            result.append((f'{start+i}. ' if tag=='ol' else '- ')+lines[0]+''.join('\n  '+line for line in lines[1:]))
        return '\n'+'\n'.join(result)+'\n\n'
    if tag=='blockquote': return '\n'+'\n'.join('> '+v for v in body.strip().splitlines())+'\n\n'
    if tag=='table':
        rows=[]
        def visit(n):
            if isinstance(n,_Node):
                if n.tag=='tr': rows.append([_md(c).strip().replace('|','\\|').replace('\n','<br>') for c in n.children if isinstance(c,_Node) and c.tag in {'td','th'}])
                else:
                    for c in n.children: visit(c)
        visit(node)
        if not rows: return ''
        width=max(map(len,rows)); rows=[r+['']*(width-len(r)) for r in rows]
        rows.insert(1,['---']*width)
        return '\n'+'\n'.join('| '+' | '.join(r)+' |' for r in rows)+'\n\n'
    if tag in {'p','div'}: return body+'\n\n'
    if tag=='br': return '\n'
    if tag=='hr': return '\n---\n\n'
    return body


MAX_CSV_COLUMNS = 256
MAX_CSV_CELL_BYTES = 128 * 1024


def _csv_preflight(value):
    """Bound a record before csv.reader allocates its field list.

    This quote-aware lexical pass counts source bytes for each cell (including
    quotes/escapes), columns and logical records. Quoted CR/LF and doubled quotes
    stay inside the cell. It allocates no rows and stops at the first excess;
    csv.reader remains the authority for syntax and actual decoded values.
    """
    quoted=False; start=0; columns=1; records=0; pos=0; length=len(value)
    while pos<length:
        char=value[pos]
        if pos-start>MAX_CSV_CELL_BYTES:
            raise InterchangeError('CSV cell exceeds 128 KiB source-byte limit')
        if quoted:
            if char=='"':
                if pos+1<length and value[pos+1]=='"': pos+=2; continue
                quoted=False
        elif char=='"' and pos==start:
            quoted=True
        elif char==',' or char in '\r\n':
            if len(value[start:pos].encode('utf-8'))>MAX_CSV_CELL_BYTES:
                raise InterchangeError('CSV cell exceeds 128 KiB source-byte limit')
            if char==',':
                columns+=1
                if columns>MAX_CSV_COLUMNS: raise InterchangeError('CSV column limit exceeded')
            else:
                records+=1; columns=1
                if records>MAX_OBJECTS+1: raise InterchangeError('CSV row limit exceeded')
                if char=='\r' and pos+1<length and value[pos+1]=='\n': pos+=1
            start=pos+1
        pos+=1
    if len(value[start:].encode('utf-8'))>MAX_CSV_CELL_BYTES:
        raise InterchangeError('CSV cell exceeds 128 KiB source-byte limit')
    if start<length and records>=MAX_OBJECTS+1: raise InterchangeError('CSV row limit exceeded')


def _csv_import(data,title):
    value=_text(data)
    _csv_preflight(value)
    # csv.field_size_limit is process-global; don't mutate it in concurrent callers.
    try:
        reader=csv.reader(io.StringIO(value,newline=''),strict=True)
        headers=next(reader,None)
        if not headers or len(headers)>MAX_CSV_COLUMNS:
            raise InterchangeError('CSV requires a header and bounded columns')
        if any(not h.strip() or len(h)>1000 for h in headers) or len(set(headers))!=len(headers):
            raise InterchangeError('CSV headers must be nonempty and unique')
        columns=[{'id':f'column_{i+1}','name':name,'type':'text'} for i,name in enumerate(headers)]
        rows=[]
        for index,row in enumerate(reader):
            if index>=MAX_OBJECTS: raise InterchangeError('CSV row limit exceeded')
            if len(row)!=len(headers): raise InterchangeError('CSV row width mismatch')
            rows.append(dict(zip((c['id'] for c in columns),row)))
    except (csv.Error,OverflowError) as exc: raise InterchangeError('Malformed CSV or field too large') from exc
    return {'kind':'database','title':title,'columns':columns,'rows':rows,'warnings':[LOSSY,'CSV imports all values as text; spreadsheet-safe export prefixes formula-like text with an apostrophe.']}


def export_csv(database,records,spreadsheet_safe=True):
    """Export selected schema/value text. Defaults to spreadsheet-safe formula escaping."""
    columns=database.get('columns',[])
    if not isinstance(columns,list) or not columns or len(columns)>256 or len(records)>MAX_OBJECTS:
        raise InterchangeError('CSV requires bounded columns and records')
    stream=io.StringIO(newline=''); writer=csv.writer(stream,lineterminator='\r\n')
    def safe(value,numeric=False):
        if value is None: return ''
        if isinstance(value,(dict,list)): value=json.dumps(value,ensure_ascii=False,allow_nan=False)
        value=str(value)
        if spreadsheet_safe and not numeric and (re.match(r'^\s*[=+@-]',value) or value.startswith(('\t','\r','\n'))): return "'"+value
        return value
    try:
        writer.writerow([safe(c['name']) for c in columns])
        for record in records:
            props=record['properties']
            writer.writerow([safe(props.get(c['id']),c.get('type') in {'number','formula'} and isinstance(props.get(c['id']),(int,float)) and not isinstance(props.get(c['id']),bool)) for c in columns])
        result=stream.getvalue().encode('utf-8')
    except (KeyError,TypeError,ValueError) as exc: raise InterchangeError('Invalid table/records for CSV export') from exc
    if len(result)>MAX_INPUT: raise InterchangeError('CSV export exceeds size limit')
    return result


def _archive_directory_preflight(data, member_limit):
    """Count actual central headers before ZipFile allocates any ZipInfo objects.

    Read only fixed-size EOCD/ZIP64 records and each 46-byte central header; skip
    filename/extra/comment bytes by validated lengths without decoding/copying
    them. The tail search is at most 65,557 bytes. Declared entry counts are only
    cross-checks after scanning real records. ZIP64 records and optional prepended
    data use the same central-directory end boundary as the stdlib reader.
    All checks happen against the immutable already-byte-capped input.
    """
    def invalid():
        raise InterchangeError('Malformed or unsupported ZIP central directory')

    length=len(data)
    if length<22: invalid()
    # Match the stdlib's no-comment shortcut and last-signature tail search.
    end=length-22
    if data[end:end+4]!=b'PK\x05\x06' or data[-2:]!=b'\x00\x00':
        end=data.rfind(b'PK\x05\x06',max(0,length-65535-22))
    if end<0 or end+22>length: invalid()
    _,disk,cd_disk,disk_count,count,cd_size,cd_offset,comment_size=struct.unpack_from('<4s4H2IH',data,end)
    if end+22+comment_size!=length or disk or cd_disk: invalid()
    directory_end=end
    locator=end-20
    zip64=locator>=0 and data[locator:locator+4]==b'PK\x06\x07'
    if zip64:
        _,record_disk,relative_offset,disks=struct.unpack_from('<4sIQI',data,locator)
        if record_disk or disks!=1: invalid()
        # A prepended stub shifts the physical record; stdlib permits a fixed
        # ZIP64 record immediately before its locator as the fallback position.
        record=relative_offset
        if record>locator-56 or data[record:record+4]!=b'PK\x06\x06':
            record=locator-56
        if record<0 or record+56>locator or data[record:record+4]!=b'PK\x06\x06': invalid()
        (_,record_size,_created,_needed,record_disk,record_cd_disk,
         disk_count,count,cd_size,cd_offset)=struct.unpack_from('<4sQ2H2I4Q',data,record)
        if (record_size<44 or record+12+record_size!=locator or
                record_disk or record_cd_disk or cd_offset+cd_size!=relative_offset):
            invalid()
        directory_end=record
    elif count==65535 or disk_count==65535 or cd_size==0xffffffff or cd_offset==0xffffffff:
        invalid()  # Required ZIP64 end record is absent.
    start=directory_end-cd_size
    if start<0 or cd_offset>start or disk_count!=count: invalid()
    position=start; actual=0
    while position<directory_end:
        if position+46>directory_end or data[position:position+4]!=b'PK\x01\x02': invalid()
        filename_size,extra_size,entry_comment_size=struct.unpack_from('<3H',data,position+28)
        next_position=position+46+filename_size+extra_size+entry_comment_size
        if next_position>directory_end: invalid()
        actual+=1
        if actual>member_limit:
            raise InterchangeError('Archive member count limit exceeded before metadata allocation')
        position=next_position
    if position!=directory_end or not actual or actual!=count: invalid()


def _archive(data, *, full_backup=False):
    archive_limit=MAX_BACKUP_ARCHIVE if full_backup else MAX_ARCHIVE
    member_limit=MAX_BACKUP_MEMBER if full_backup else MAX_MEMBER
    expanded_limit=MAX_BACKUP_MEMBER if full_backup else MAX_EXPANDED
    member_count=1 if full_backup else MAX_MEMBERS
    _check_bytes(data,archive_limit)
    _archive_directory_preflight(data,member_count)
    try:
        z=zipfile.ZipFile(io.BytesIO(data)); infos=z.infolist()
        if not infos or len(infos)>member_count: raise InterchangeError('Archive member count limit exceeded')
        seen=set(); total=0; result={}
        for info in infos:
            name=info.filename; path=PurePosixPath(name)
            mode=info.external_attr>>16
            if (not name or info.orig_filename!=name or '\\' in name or '\x00' in name or ':' in name or path.is_absolute() or any(p in {'.','..',''} for p in name.rstrip('/').split('/')) or name.casefold() in seen or info.flag_bits&1 or stat.S_IFMT(mode) not in {0,stat.S_IFREG,stat.S_IFDIR}):
                raise InterchangeError('Unsafe, encrypted or duplicate archive member')
            seen.add(name.casefold())
            if info.file_size>member_limit or info.file_size>max(1,info.compress_size)*MAX_RATIO:
                raise InterchangeError('Archive size/compression ratio limit exceeded')
            total+=info.file_size
            if total>expanded_limit: raise InterchangeError('Expanded archive size limit exceeded')
            with z.open(info) as member: content=member.read(member_limit+1)
            if len(content)!=info.file_size or len(content)>member_limit: raise InterchangeError('Archive member size mismatch')
            if not info.is_dir(): result[name]=content
        z.close(); return result
    except (zipfile.BadZipFile,zipfile.LargeZipFile,RuntimeError,NotImplementedError,EOFError,OSError,UnicodeError,struct.error) as exc:
        raise InterchangeError('Malformed or unsupported ZIP archive') from exc


_W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
_R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
_REL='http://schemas.openxmlformats.org/package/2006/relationships'
_ETNS={'w':_W,'r':_R}
ET.register_namespace('w',_W); ET.register_namespace('r',_R)

def _xml(data):
    if b'\x00' in data: raise InterchangeError('Only UTF-8 DOCX XML is supported')
    if len(data)>MAX_MEMBER or re.search(br'<!\s*(?:DOCTYPE|ENTITY)',data,re.I): raise InterchangeError('XML DTD/entities or oversized XML refused')
    try:
        root=ET.fromstring(data)
        stack=[(root,0)]; count=0
        while stack:
            node,depth=stack.pop(); count+=1
            if depth>MAX_DEPTH or count>MAX_NODES: raise InterchangeError('XML complexity limit exceeded')
            stack.extend((c,depth+1) for c in node)
        return root
    except (ET.ParseError,RecursionError) as exc: raise InterchangeError('Malformed DOCX XML') from exc


def _docx_import(data):
    files=_archive(data)
    if not {'[Content_Types].xml','word/document.xml','_rels/.rels'}<=files.keys(): raise InterchangeError('DOCX required package parts missing')
    for name,raw in files.items():
        if re.search(r'(vbaProject|activeX|embeddings/)',name,re.I): raise InterchangeError('Active/embedded DOCX content refused')
        if name.endswith(('.xml','.rels')): _xml(raw)
    ctypes=_xml(files['[Content_Types].xml'])
    if any('macroEnabled' in e.attrib.get('ContentType','') for e in ctypes): raise InterchangeError('Macro-enabled DOCX refused')
    document_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
    if not any(e.attrib.get('PartName')=='/word/document.xml' and e.attrib.get('ContentType')==document_type for e in ctypes):
        raise InterchangeError('DOCX main document content type invalid')
    rels={}
    for name,raw in files.items():
        if not name.endswith('.rels'): continue
        for rel in _xml(raw):
            typ=rel.attrib.get('Type',''); target=rel.attrib.get('Target','')
            if rel.attrib.get('TargetMode')=='External':
                if typ.endswith('/hyperlink') and _url(target):
                    if name=='word/_rels/document.xml.rels': rels[rel.attrib['Id']]=target
                else: raise InterchangeError('Unsafe external DOCX relationship')
            else:
                base=PurePosixPath(name).parent.parent if name!='_rels/.rels' else PurePosixPath('.')
                # OOXML relationships may use .. only while staying within archive root.
                parts=[]
                for part in (base/PurePosixPath(target)).parts:
                    if part=='..':
                        if not parts: raise InterchangeError('DOCX relationship escapes package')
                        parts.pop()
                    elif part not in {'.',''}: parts.append(part)
                normalized='/'.join(parts)
                if '\\' in target or ':' in target or target.startswith('/') or normalized not in files:
                    raise InterchangeError('DOCX relationship target missing or unsafe')
    number_formats={}; number_starts={}; number_restarts={}
    def number_value(node,default=1):
        value=node.attrib.get('{'+_W+'}val','') if node is not None else ''
        return int(value) if re.fullmatch(r'[0-9]{1,6}',value) else default
    if 'word/numbering.xml' in files:
        numbering=_xml(files['word/numbering.xml'])
        abstract={n.attrib.get('{'+_W+'}abstractNumId'):n for n in numbering.findall('w:abstractNum',_ETNS)}
        for num in numbering.findall('w:num',_ETNS):
            num_id=num.attrib.get('{'+_W+'}numId'); abstract_id=num.find('w:abstractNumId',_ETNS)
            definition=abstract.get(abstract_id.attrib.get('{'+_W+'}val')) if abstract_id is not None else None
            levels={n.attrib.get('{'+_W+'}ilvl','0'):n for n in definition.findall('w:lvl',_ETNS)} if definition is not None else {}
            overrides={n.attrib.get('{'+_W+'}ilvl','0'):n for n in num.findall('w:lvlOverride',_ETNS)}
            for ilvl in levels.keys()|overrides.keys():
                override=overrides.get(ilvl); level=override.find('w:lvl',_ETNS) if override is not None else None
                if level is None: level=levels.get(ilvl)
                if level is None: continue
                key=(num_id,ilvl); fmt=level.find('w:numFmt',_ETNS)
                number_formats[key]=fmt.attrib.get('{'+_W+'}val') if fmt is not None else 'bullet'
                initial=number_value(level.find('w:start',_ETNS))
                number_starts[key]=number_value(override.find('w:startOverride',_ETNS),initial) if override is not None else initial
                number_restarts[key]=number_value(level.find('w:lvlRestart',_ETNS),int(ilvl) if ilvl.isdigit() else 0)
    root=_xml(files['word/document.xml']); body=root.find('w:body',_ETNS)
    if root.tag!='{'+_W+'}document' or body is None: raise InterchangeError('DOCX document body missing')
    def inline(node,preformatted=False):
        tag=node.tag.rsplit('}',1)[-1]
        if tag=='t': return html.escape(node.text or '')
        if tag in {'br','cr'}: return '\n' if preformatted else '<br>'
        if tag=='tab': return '\t' if preformatted else '    '
        if tag in {'instrText','del','delText','drawing','pict','object'}: return ''
        if tag=='rPr': return ''
        text=''.join(inline(c,preformatted) for c in node)
        if tag=='r':
            for key,mark in [('b','strong'),('i','em'),('u','u'),('strike','s')]:
                p=node.find('w:rPr/w:'+key,_ETNS)
                if p is not None:
                    off=p.attrib.get('{'+_W+'}val','true').lower() in {'0','false','off','none'}
                    if key=='b' and off:
                        text='<span data-workspace-weight="normal">'+text+'</span>'
                    elif not off:
                        text='<'+mark+'>'+text+'</'+mark+'>'
        if tag=='hyperlink' and node.attrib.get('{'+_R+'}id') in rels:
            text='<a href="'+html.escape(rels[node.attrib['{'+_R+'}id']],quote=True)+'">'+text+'</a>'
        return text
    def paragraph(node):
        style=node.find('w:pPr/w:pStyle',_ETNS); tag='p'
        if style is not None:
            val=style.attrib.get('{'+_W+'}val','')
            m=re.fullmatch(r'Heading([1-6])',val,re.I)
            if m: tag='h'+m[1]
            elif val=='Quote': tag='blockquote'
            elif val=='Code': tag='pre'
        text=''.join(inline(c,tag=='pre') for c in node if c.tag!='{'+_W+'}pPr')
        return '<'+tag+'>'+text+'</'+tag+'>'
    counters={}
    def list_info(node):
        num=node.find('w:pPr/w:numPr/w:numId',_ETNS)
        if num is None or num.attrib.get('{'+_W+'}val')=='0': return None
        num_id=num.attrib.get('{'+_W+'}val'); level=node.find('w:pPr/w:numPr/w:ilvl',_ETNS)
        depth=number_value(level,0)
        if depth>8: raise InterchangeError('DOCX list nesting limit exceeded')
        key=(num_id,str(depth)); ordered=number_formats.get(key) not in {None,'bullet','none'}
        value=counters.get(key,number_starts.get(key,1)-1)+1; counters[key]=value
        # A parent item restarts its dependent deeper levels unless lvlRestart=0.
        for child_key in list(counters):
            if child_key[0]==num_id and int(child_key[1])>depth:
                trigger=number_restarts.get(child_key,int(child_key[1]))
                if trigger and depth<trigger: counters.pop(child_key)
        return num_id,depth,'ol' if ordered else 'ul',value
    def flow(nodes):
        output=[]; stack=[]
        for node in nodes:
            info=list_info(node) if node.tag=='{'+_W+'}p' else None
            if info is None:
                stack.clear(); output.append(block(node)); continue
            num_id,depth,tag,value=info
            while stack and (stack[-1]['depth']>depth or (stack[-1]['depth']==depth and stack[-1]['num_id']!=num_id)):
                stack.pop()
            if not stack or stack[-1]['depth']<depth:
                listing=_Node(tag,{'start':str(value)} if tag=='ol' and value!=1 else {},[])
                if stack and stack[-1]['last'] is not None: stack[-1]['last'].children.append(listing)
                else: output.append(listing)
                stack.append({'depth':depth,'num_id':num_id,'node':listing,'last':None})
            text=''.join(inline(c) for c in node if c.tag!='{'+_W+'}pPr')
            item=_Node('li',children=_tree(text).children); stack[-1]['node'].children.append(item); stack[-1]['last']=item
        return ''.join(_serialize(n) if isinstance(n,_Node) else n for n in output)
    def block(node):
        if node.tag=='{'+_W+'}p': return paragraph(node)
        if node.tag=='{'+_W+'}tbl':
            return '<table>'+''.join('<tr>'+''.join('<td>'+flow(cell)+'</td>' for cell in row.findall('w:tc',_ETNS))+'</tr>' for row in node.findall('w:tr',_ETNS))+'</table>'
        return ''
    content=sanitize_html(flow(body))
    if not _plain(_tree(content)).strip(): raise InterchangeError('DOCX contains no supported editable text')
    return content


def _image_bytes(source):
    """Decode only bounded raster images; never follow URLs or filenames."""
    from PIL import Image
    try:
        raw=base64.b64decode(source.split(',',1)[1],validate=True)
        if len(raw)>MAX_INPUT: raise InterchangeError('Image byte limit exceeded')
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in {'PNG','JPEG','GIF','WEBP'} or image.width*image.height>20000000:
                raise InterchangeError('Only bounded PNG/JPEG rasters can be exported')
            width,height=image.size; fmt=image.format
            if fmt in {'GIF','WEBP'}:
                output=io.BytesIO(); image.seek(0); image.convert('RGBA').save(output,format='PNG'); raw=output.getvalue(); fmt='PNG'
            else: image.verify()
        return raw,width,height,'png' if fmt=='PNG' else 'jpeg'
    except (ValueError,IndexError,OSError,SyntaxError,Image.DecompressionBombError) as exc:
        raise InterchangeError('Malformed or oversized raster image; replace the attachment with a valid PNG/JPEG/GIF/WebP image') from exc


def _prepare_export(item):
    tree=_tree(item.get('content',''))
    attachments={}
    supplied=item.get('attachments',[])
    if not isinstance(supplied,list) or len(supplied)>MAX_OBJECTS: raise InterchangeError('Invalid export attachments')
    for attachment in supplied:
        if isinstance(attachment,dict) and attachment.get('item_id')==item.get('id') and isinstance(attachment.get('id'),str):
            attachments[attachment['id']]=attachment
    def resolve(node):
        if isinstance(node,str): return
        if node.tag=='img' and node.attrs.get('src','').startswith('attachment:'):
            aid=node.attrs['src'].split(':',1)[1]; att=attachments.get(aid)
            if not att or att.get('media_type') not in {'image/png','image/jpeg','image/gif','image/webp'}:
                raise InterchangeError('Export needs the owning item PNG/JPEG attachment bytes')
            source='data:'+att['media_type']+';base64,'+att.get('data_base64','')
            raw,_,_,fmt=_image_bytes(source); node.attrs['src']='data:image/'+fmt+';base64,'+base64.b64encode(raw).decode('ascii')
        for child in node.children: resolve(child)
    resolve(tree)
    return _serialize(tree)


def _docx_export(item):
    root=ET.Element('{'+_W+'}document'); body=ET.SubElement(root,'{'+_W+'}body')
    relationships=ET.Element('Relationships',xmlns=_REL)
    images=[]; list_numbers=[]
    def el(parent,tag,attrs=None,text=None):
        node=ET.SubElement(parent,'{'+_W+'}'+tag,{'{'+_W+'}'+k:str(v) for k,v in (attrs or {}).items()})
        if text is not None: node.text=text
        return node
    def run(parent,text,marks=(),preformatted=False):
        r=el(parent,'r')
        if marks:
            props=el(r,'rPr')
            for mark in marks:
                if mark=='normalWeight':
                    el(props,'b',{'val':'0'}); el(props,'bCs',{'val':'0'})
                else:
                    el(props,mark,{'val':'single'} if mark=='u' else {})
        for token in (re.split(r'(\r\n|\r|\n|\t)',text) if preformatted else [text]):
            if preformatted and token in {'\r\n','\r','\n'}: el(r,'br')
            elif preformatted and token=='\t': el(r,'tab')
            else:
                t=el(r,'t',text=token); t.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
    def inline(parent,node,marks=(),preformatted=False):
        if isinstance(node,str): run(parent,node,marks,preformatted); return
        additions={'strong':'b','b':'b','em':'i','i':'i','u':'u','s':'strike','strike':'strike','del':'strike'}
        if node.tag in {'strong','b'}:
            marks=tuple(mark for mark in marks if mark not in {'b','normalWeight'})+('b',)
        elif node.tag in additions:
            marks=marks+(additions[node.tag],)
        if node.tag=='span' and node.attrs.get('data-workspace-weight')=='normal':
            marks=tuple(mark for mark in marks if mark not in {'b','normalWeight'})+('normalWeight',)
        if node.tag=='br': el(el(parent,'r'),'br'); return
        if node.tag=='input': run(parent,'[x] ' if 'checked' in node.attrs else '[ ] ',marks); return
        if node.tag=='img':
            source=node.attrs.get('src','')
            if not source.startswith('data:image/'):
                run(parent,'[Image: '+node.attrs.get('alt','image')+']',marks); return
            raw,width,height,fmt=_image_bytes(source)
            index=len(images)+1; path=f'word/media/image{index}.{fmt}'; images.append((path,raw))
            rid='image'+str(index)
            ET.SubElement(relationships,'Relationship',Id=rid,Type=_R+'/image',Target=f'media/image{index}.{fmt}')
            wp='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
            a='http://schemas.openxmlformats.org/drawingml/2006/main'
            pic='http://schemas.openxmlformats.org/drawingml/2006/picture'
            drawing=el(el(parent,'r'),'drawing')
            frame=ET.SubElement(drawing,'{'+wp+'}inline')
            factor=min(1,600/width,850/height); cx=int(width*factor*9525); cy=int(height*factor*9525)
            ET.SubElement(frame,'{'+wp+'}extent',cx=str(cx),cy=str(cy))
            ET.SubElement(frame,'{'+wp+'}docPr',id=str(index),name=f'Image {index}',descr=node.attrs.get('alt',''))
            graphic=ET.SubElement(frame,'{'+a+'}graphic'); gd=ET.SubElement(graphic,'{'+a+'}graphicData',uri=pic)
            picture=ET.SubElement(gd,'{'+pic+'}pic'); nv=ET.SubElement(picture,'{'+pic+'}nvPicPr')
            ET.SubElement(nv,'{'+pic+'}cNvPr',id=str(index),name=f'image{index}.{fmt}'); ET.SubElement(nv,'{'+pic+'}cNvPicPr')
            fill=ET.SubElement(picture,'{'+pic+'}blipFill'); ET.SubElement(fill,'{'+a+'}blip',{'{'+_R+'}embed':rid})
            ET.SubElement(ET.SubElement(fill,'{'+a+'}stretch'),'{'+a+'}fillRect')
            shape=ET.SubElement(picture,'{'+pic+'}spPr'); transform=ET.SubElement(shape,'{'+a+'}xfrm')
            ET.SubElement(transform,'{'+a+'}off',x='0',y='0'); ET.SubElement(transform,'{'+a+'}ext',cx=str(cx),cy=str(cy))
            ET.SubElement(ET.SubElement(shape,'{'+a+'}prstGeom',prst='rect'),'{'+a+'}avLst')
            return
        if node.tag=='a' and node.attrs.get('href'):
            rid='rId'+str(len(relationships)+10)
            ET.SubElement(relationships,'Relationship',Id=rid,Type=_R+'/hyperlink',Target=node.attrs['href'],TargetMode='External')
            parent=el(parent,'hyperlink'); parent.set('{'+_R+'}id',rid)
        for child in node.children: inline(parent,child,marks,preformatted)
    def paragraph(parent,node,style=None,num=None,level=0):
        p=el(parent,'p')
        if style or num:
            props=el(p,'pPr')
            if style: el(props,'pStyle',{'val':style})
            if num:
                np=el(props,'numPr'); el(np,'ilvl',{'val':min(level,8)}); el(np,'numId',{'val':num})
        # Standalone images carry their own inline content, rather than children.
        for child in ([node] if node.tag=='img' else node.children):
            if isinstance(child,_Node) and child.tag in {'ul','ol'}: continue
            inline(p,child,preformatted=node.tag=='pre')
        return p
    def block(parent,node,level=0):
        if isinstance(node,str):
            if node.strip(): paragraph(parent,_Node('p',children=[node]))
            return
        if node.tag=='table':
            table=el(parent,'tbl'); props=el(table,'tblPr'); el(props,'tblW',{'w':0,'type':'auto'})
            borders=el(props,'tblBorders')
            for side in ['top','left','bottom','right','insideH','insideV']: el(borders,side,{'val':'single','sz':4,'color':'D9D9D9'})
            rows=[]
            def rows_in(n):
                if isinstance(n,_Node):
                    if n.tag=='tr': rows.append(n)
                    else:
                        for c in n.children: rows_in(c)
            rows_in(node)
            for row in rows:
                tr=el(table,'tr')
                for cell in row.children:
                    if not isinstance(cell,_Node) or cell.tag not in {'td','th'}: continue
                    tc=el(tr,'tc'); flow(tc,cell.children,level)
                    if not tc.findall('w:p',{'w':_W}): el(tc,'p')
            return
        if node.tag in {'ul','ol'}:
            num_id=len(list_numbers)+3
            list_numbers.append((num_id,2 if node.tag=='ol' else 1,min(level,8),int(node.attrs.get('start','1'))))
            for child in node.children:
                if isinstance(child,_Node) and child.tag=='li':
                    paragraph(parent,child,num=num_id,level=level)
                    for nested in child.children:
                        if isinstance(nested,_Node) and nested.tag in {'ul','ol'}: block(parent,nested,level+1)
            return
        if node.tag in {'div','thead','tbody','tfoot'}:
            flow(parent,node.children,level)
            return
        styles={'blockquote':'Quote','pre':'Code'}
        style='Heading'+node.tag[1] if re.fullmatch(r'h[1-6]',node.tag) else styles.get(node.tag)
        paragraph(parent,node,style)
    def flow(parent,children,level=0):
        # Browser contenteditable emits DIV paragraphs whose direct children
        # can be inline marks/links. Keep each inline run together and pass
        # its own node to inline(), rather than stripping the outer mark or
        # turning every text/mark sibling into a separate Word paragraph.
        inline_tags={'strong','b','em','i','u','s','strike','del','span','a','input','br','img','code','mark','sub','sup','label'}
        pending=[]
        def flush():
            if pending and any(isinstance(n,_Node) or n.strip() for n in pending):
                paragraph(parent,_Node('p',children=list(pending)))
            pending.clear()
        for child in children:
            if isinstance(child,str) or child.tag in inline_tags:
                pending.append(child)
            else:
                flush(); block(parent,child,level)
        flush()
    tree=_tree(item.get('content',''))
    flow(body,tree.children)
    sect=el(body,'sectPr'); el(sect,'pgSz',{'w':11906,'h':16838}); el(sect,'pgMar',{'top':1134,'right':1134,'bottom':1134,'left':1134})
    styles=ET.Element('{'+_W+'}styles')
    default=el(styles,'docDefaults'); props=el(el(default,'rPrDefault'),'rPr'); el(props,'rFonts',{'ascii':'Liberation Sans','hAnsi':'Liberation Sans','eastAsia':'Noto Sans CJK SC'}); el(props,'sz',{'val':22})
    paragraph_defaults=el(el(default,'pPrDefault'),'pPr'); el(paragraph_defaults,'spacing',{'after':120,'line':276,'lineRule':'auto'})
    for i in range(1,7):
        st=el(styles,'style',{'type':'paragraph','styleId':'Heading'+str(i)}); el(st,'name',{'val':'heading '+str(i)}); el(st,'basedOn',{'val':'Normal'})
        pp=el(st,'pPr'); el(pp,'keepNext'); el(pp,'keepLines'); el(pp,'spacing',{'before':240,'after':120,'line':276,'lineRule':'auto'})
        rp=el(st,'rPr'); el(rp,'b'); el(rp,'sz',{'val':max(24,40-i*3)}); el(rp,'color',{'val':'000000'})
    for name in ['Normal','Quote','Code']:
        st=el(styles,'style',{'type':'paragraph','styleId':name}); el(st,'name',{'val':name})
        if name=='Normal': st.set('{'+_W+'}default','1')
        else:
            el(st,'basedOn',{'val':'Normal'})
            pp=el(st,'pPr'); el(pp,'spacing',{'before':80,'after':120,'line':240 if name=='Code' else 276,'lineRule':'auto'})
        if name=='Code': el(el(st,'rPr'),'rFonts',{'ascii':'Liberation Mono','hAnsi':'Liberation Mono'})
    numbering=ET.Element('{'+_W+'}numbering')
    for num,fmt in [(1,'bullet'),(2,'decimal')]:
        abstract=el(numbering,'abstractNum',{'abstractNumId':num})
        for level in range(9):
            lvl=el(abstract,'lvl',{'ilvl':level}); el(lvl,'start',{'val':1}); el(lvl,'numFmt',{'val':fmt}); el(lvl,'lvlText',{'val':'•' if num==1 else '%'+str(level+1)+'.'}); el(el(lvl,'pPr'),'ind',{'left':720*(level+1),'hanging':360})
        el(el(numbering,'num',{'numId':num}),'abstractNumId',{'val':num})
    for num_id,abstract_id,level,start in list_numbers:
        node=el(numbering,'num',{'numId':num_id}); el(node,'abstractNumId',{'val':abstract_id})
        override=el(node,'lvlOverride',{'ilvl':level}); el(override,'startOverride',{'val':start})
    for rid,path in [('rId1','styles.xml'),('rId2','numbering.xml')]:
        ET.SubElement(relationships,'Relationship',Id=rid,Type=_R+('/styles' if path=='styles.xml' else '/numbering'),Target=path)
    contenttypes=ET.Element('Types',xmlns='http://schemas.openxmlformats.org/package/2006/content-types')
    ET.SubElement(contenttypes,'Default',Extension='rels',ContentType='application/vnd.openxmlformats-package.relationships+xml')
    ET.SubElement(contenttypes,'Default',Extension='xml',ContentType='application/xml')
    for path,typ in [('document','document.main'),('styles','styles'),('numbering','numbering')]:
        ET.SubElement(contenttypes,'Override',PartName='/word/'+path+'.xml',ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.'+typ+'+xml')
    for fmt,media in [('png','image/png'),('jpeg','image/jpeg')]:
        ET.SubElement(contenttypes,'Default',Extension=fmt,ContentType=media)
    package_rels=ET.Element('Relationships',xmlns=_REL)
    ET.SubElement(package_rels,'Relationship',Id='rId1',Type=_R+'/officeDocument',Target='word/document.xml')
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
        for path,node in [('[Content_Types].xml',contenttypes),('_rels/.rels',package_rels),('word/document.xml',root),('word/styles.xml',styles),('word/numbering.xml',numbering),('word/_rels/document.xml.rels',relationships)]:
            z.writestr(path,ET.tostring(node,encoding='utf-8',xml_declaration=True))
        for path,raw in images: z.writestr(path,raw)
    return output.getvalue()


def _pdf_in_worker(operation,payload):
    # Explicit process bounds contain decompression/layout before the parent commits data.
    code='from workspace_plugin.interchange import _pdf_child; _pdf_child()'
    root = str(Path(__file__).resolve().parent.parent)
    # Conversion imports this exact package, not caller-supplied Python paths.
    # Preserve platform/temp/font-home behaviour without forwarding provider,
    # Hermes, proxy or arbitrary Python execution configuration to the worker.
    env = {'PATH': os.defpath, 'PYTHONPATH': root, 'PYTHONDONTWRITEBYTECODE': '1',
           'LANG': 'C.UTF-8'}
    for key in ('HOME', 'USERPROFILE', 'SYSTEMROOT', 'WINDIR', 'TMPDIR', 'TMP', 'TEMP'):
        if key in os.environ:
            env[key] = os.environ[key]
    try:
        result=subprocess.run([sys.executable,'-c',code,operation],input=payload,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20,check=False,cwd=root,env=env)
    except subprocess.TimeoutExpired as exc: raise InterchangeError('PDF conversion exceeded 20 second limit') from exc
    if result.returncode:
        message=result.stderr.decode('utf-8',errors='replace')[-1000:]
        if result.returncode==3: raise ConversionUnavailable(message)
        raise InterchangeError(message or 'PDF conversion failed or exceeded resource limits')
    if len(result.stdout)>MAX_EXPANDED: raise InterchangeError('PDF result exceeds size limit')
    return result.stdout


def _pdf_child():
    try:
        if sys.platform!='win32':
            import resource
            resource.setrlimit(resource.RLIMIT_AS,(512*1024*1024,512*1024*1024))
            resource.setrlimit(resource.RLIMIT_CPU,(15,15))
        payload=sys.stdin.buffer.read(MAX_INPUT+1)
        _check_bytes(payload)
        if sys.argv[-1]=='import': result=_pdf_import(payload).encode('utf-8')
        else: result=_pdf_export(json.loads(payload))
        sys.stdout.buffer.write(result)
    except ImportError:
        sys.stderr.write('PDF conversion requires pypdf and reportlab in the configured isolated runtime.'); sys.exit(3)
    except Exception as exc:
        # Do not emit input bytes, private text, paths or exception dumps.
        sys.stderr.write(str(exc) if isinstance(exc,InterchangeError) else 'Malformed PDF or unsupported conversion content'); sys.exit(2)


def _pdf_import(data):
    from pypdf import PdfReader
    if not data.startswith(b'%PDF-'): raise InterchangeError('Invalid PDF signature')
    reader=PdfReader(io.BytesIO(data),strict=True)
    if reader.is_encrypted: raise InterchangeError('Encrypted PDF is unsupported')
    if not 0<len(reader.pages)<=MAX_PDF_PAGES: raise InterchangeError('PDF page limit exceeded')
    blocks=[]; total=0
    for number,page in enumerate(reader.pages,1):
        text=page.extract_text() or ''
        # Prevent silent successful partial import of image-only/mixed scanned pages.
        if not text.strip():
            resources=page.get('/Resources',{})
            if hasattr(resources,'get_object'): resources=resources.get_object()
            xobjects=resources.get('/XObject',{})
            if hasattr(xobjects,'get_object'): xobjects=xobjects.get_object()
            if xobjects or not blocks: raise InterchangeError(f'PDF page {number} has no usable text; scans/OCR are unsupported')
            continue
        text=re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]','',text)
        if not text.strip(): raise InterchangeError('PDF has no usable text; OCR is unsupported')
        total+=len(text.encode('utf-8'))
        if total>MAX_INPUT: raise InterchangeError('Extracted PDF text exceeds size limit')
        blocks.append('<h2>Source page '+str(number)+'</h2>'+''.join('<p>'+html.escape(line)+'</p>' for line in text.splitlines() if line.strip()))
    if not blocks: raise InterchangeError('PDF has no text; OCR is unsupported')
    return sanitize_html(''.join(blocks))


def _pdf_export(item):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,Image
    import reportlab
    from pathlib import Path
    font_dir=Path(reportlab.__file__).parent/'fonts'
    for name,file in [('WorkspaceLatin','Vera.ttf'),('WorkspaceBold','VeraBd.ttf'),('WorkspaceItalic','VeraIt.ttf'),('WorkspaceBoldItalic','VeraBI.ttf')]:
        pdfmetrics.registerFont(TTFont(name,str(font_dir/file)))
    pdfmetrics.registerFontFamily('WorkspaceLatin',normal='WorkspaceLatin',bold='WorkspaceBold',italic='WorkspaceItalic',boldItalic='WorkspaceBoldItalic')
    pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
    normal=ParagraphStyle('normal',fontName='WorkspaceLatin',fontSize=10,leading=15,spaceAfter=7,alignment=TA_LEFT,wordWrap='CJK',splitLongWords=True)
    heading=ParagraphStyle('heading',parent=normal,fontName='WorkspaceBold',fontSize=17,leading=22,spaceBefore=10,spaceAfter=9,keepWithNext=True)
    quote=ParagraphStyle('quote',parent=normal,fontName='WorkspaceItalic',leftIndent=14,rightIndent=8,textColor=colors.HexColor('#475569'),spaceBefore=5,spaceAfter=10)
    code=ParagraphStyle('code',parent=normal,fontName='Courier',leading=14,leftIndent=8,rightIndent=8,backColor=colors.HexColor('#F4F4F5'),borderPadding=6,spaceBefore=6,spaceAfter=10)
    def escaped(text):
        # CJK text uses the PDF standard CID font; Latin embeds the package font.
        parts=re.split(r'([\u2e80-\u9fff\uf900-\ufaff]+)',text)
        return ''.join('<font name="STSong-Light">'+html.escape(p)+'</font>' if re.fullmatch(r'[\u2e80-\u9fff\uf900-\ufaff]+',p or '') else html.escape(p) for p in parts)
    def raster(n,max_width=483):
        from PIL import Image as PILImage
        data=base64.b64decode(n.attrs['src'].split(',',1)[1],validate=True)
        with PILImage.open(io.BytesIO(data)) as picture:
            if picture.width*picture.height>20000000: raise InterchangeError('Image pixel limit exceeded')
            w,h=picture.size
        factor=min(1,max_width/w,600/h)
        return data,w*factor,h*factor
    def inline(n,inherited_italic=False):
        if isinstance(n,str): return escaped(n)
        text=''.join(inline(c,inherited_italic or n.tag in {'em','i'}) for c in n.children)
        if n.tag=='span' and n.attrs.get('data-workspace-weight')=='normal':
            # A font face reset overrides the inherited heading/bold face while
            # retaining ancestor italics. Nested semantic b/i remain supported.
            return '<font name="'+('WorkspaceItalic' if inherited_italic else 'WorkspaceLatin')+'">'+text+'</font>'
        if n.tag in {'strong','b'}: return '<b>'+text+'</b>'
        if n.tag in {'em','i'}: return '<i>'+text+'</i>'
        if n.tag=='u': return '<u>'+text+'</u>'
        if n.tag in {'s','strike','del'}: return '<strike>'+text+'</strike>'
        if n.tag=='a' and n.attrs.get('href','').startswith(('https://','http://')): return '<link href="'+html.escape(n.attrs['href'],quote=True)+'" color="#204060">'+text+'</link>'
        if n.tag=='br': return '<br/>'
        if n.tag=='input': return '[x] ' if 'checked' in n.attrs else '[ ] '
        if n.tag=='img': return escaped('[Image: '+n.attrs.get('alt','image')+']')
        return text
    def flow(children,target,level=0,max_width=483,style=None,prefix=''):
        # Preserve adjacent inline siblings as one run, flushing only at semantic
        # blocks or real validated rasters. Lists and cells share this layout.
        style=normal if style is None else style
        pending=[]
        def flush():
            nonlocal prefix
            value=''.join(inline(c) for c in pending)
            if value.strip() or prefix:
                target.append(Paragraph(prefix+value,style)); prefix=''
            pending.clear()
        blocks={'p','div','table','ul','ol','pre','blockquote','thead','tbody','tfoot','h1','h2','h3','h4','h5','h6'}
        for child in children:
            if isinstance(child,_Node) and (child.tag in blocks or child.tag=='img'):
                flush(); block(child,level,target,max_width)
            else: pending.append(child)
        flush()
    def cell_contents(node,max_width):
        # Reuse document block layout inside cells: preserve paragraphs, list
        # markers and nesting, inline formatting and validated raster flowables.
        contents=[]
        flow(node.children,contents,max_width=max_width)
        return contents or [Paragraph('',normal)]
    story=[]
    def block(n,level=0,target=None,max_width=483):
        if target is None: target=story
        if isinstance(n,str):
            if n.strip(): target.append(Paragraph(escaped(n),normal))
            return
        if n.tag=='table':
            rows=[]
            def collect(t):
                if isinstance(t,_Node):
                    if t.tag=='tr': rows.append([c for c in t.children if isinstance(c,_Node) and c.tag in {'td','th'}])
                    else:
                        for c in t.children: collect(c)
            collect(n)
            if not rows: return
            width=max(map(len,rows))
            if width>20 or len(rows)>1000: raise InterchangeError('PDF table size limit exceeded')
            rows=[[cell_contents(c,483/width-14) for c in r]+[Paragraph('',normal)]*(width-len(r)) for r in rows]
            table=Table(rows,colWidths=[(483/width)]*width,repeatRows=1,hAlign='LEFT')
            table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.HexColor('#D9D9D9')),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E7EDF3')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
            target.extend([table,Spacer(1,10)]); return
        if n.tag in {'ul','ol'}:
            start=int(n.attrs.get('start','1'))
            for i,child in enumerate(c for c in n.children if isinstance(c,_Node) and c.tag=='li'):
                style=ParagraphStyle('list',parent=normal,leftIndent=(level+1)*14)
                flow(child.children,target,level+1,max_width,style,(str(start+i)+'. ' if n.tag=='ol' else '- '))
            return
        if n.tag=='img' and n.attrs.get('src','').startswith('data:image/'):
            data,w,h=raster(n,max_width)
            target.append(Image(io.BytesIO(data),width=w,height=h)); return
        if n.tag in {'div','thead','tbody','tfoot'}:
            flow(n.children,target,level,max_width)
            return
        if n.tag in {'p','div'} and any(isinstance(c,_Node) and c.tag=='img' for c in n.children):
            pending=[]
            for child in n.children:
                if isinstance(child,_Node) and child.tag=='img':
                    if pending: target.append(Paragraph(''.join(inline(c) for c in pending),normal)); pending=[]
                    block(child,level,target,max_width)
                else: pending.append(child)
            if pending: target.append(Paragraph(''.join(inline(c) for c in pending),normal))
            return
        value=inline(n)
        if n.tag=='pre': value=value.replace('\n','<br/>').replace(' ','&#160;')
        if value: target.append(Paragraph(value,heading if re.fullmatch(r'h[1-6]',n.tag) else code if n.tag=='pre' else quote if n.tag=='blockquote' else normal))
    for node in _tree(item.get('content','')).children: block(node)
    if not story: story=[Paragraph('(Empty document)',normal)]
    output=io.BytesIO()
    doc=SimpleDocTemplate(output,pagesize=(595,842),leftMargin=56,rightMargin=56,topMargin=48,bottomMargin=48,title=str(item.get('title','Workspace document'))[:500],author='Workspace')
    doc.build(story)
    if len(output.getvalue())>MAX_INPUT: raise InterchangeError('PDF export size limit exceeded')
    return output.getvalue()


def import_file(name,data):
    """Convert a user-selected byte payload. Original attachment accompanies every page."""
    _name(name); _check_bytes(data)
    ext=name.rsplit('.',1)[-1].lower() if '.' in name else ''
    title=name.rsplit('.',1)[0] or 'Imported document'
    warnings=[]
    if ext in {'md','markdown'}:
        content=_markdown(_text(data)); media='text/markdown'; warnings=[LOSSY]
    elif ext=='csv': return _csv_import(data,title)
    elif ext=='docx':
        content=_docx_import(data); media='application/vnd.openxmlformats-officedocument.wordprocessingml.document'; warnings=[LAYOUT]
    elif ext=='pdf':
        content=_pdf_in_worker('import',data).decode('utf-8'); media='application/pdf'; warnings=[LAYOUT,'PDF imports extracted text in source page order; columns, images and formatting may be lost. OCR is unsupported.']
    else: raise InterchangeError('Supported imports: Markdown, CSV, DOCX and text-based PDF; legacy DOC and OCR are unsupported')
    return {'kind':'page','title':title,'content':content,'original':{'name':name,'media_type':media,'data_base64':base64.b64encode(data).decode('ascii')},'warnings':warnings}


def export_document(item,format):
    """Export sanitised document content; this does not constitute a full backup."""
    if not isinstance(item,dict): raise InterchangeError('Expected a document object')
    content=_prepare_export(item); item={**item,'content':content}
    if format in {'md','markdown'}: return _md(_tree(content)).strip().encode('utf-8')+b'\n'
    if format=='docx': return _docx_export(item)
    if format=='pdf': return _pdf_in_worker('export',json.dumps({'title':item.get('title','Workspace document'),'content':content},ensure_ascii=False).encode('utf-8'))
    raise InterchangeError('Supported exports: Markdown, DOCX and PDF')


def _json_bytes(value):
    try: return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf-8')
    except (TypeError,ValueError,RecursionError) as exc: raise InterchangeError('Expected finite JSON snapshot data') from exc


def _json_load(data):
    def pairs(values):
        result={}
        for key,value in values:
            if key in result: raise InterchangeError('Duplicate JSON field')
            result[key]=value
        return result
    try:
        return json.loads(data,object_pairs_hook=pairs,parse_constant=lambda value: (_ for _ in ()).throw(InterchangeError('Nonfinite JSON value')))
    except (UnicodeError,ValueError,RecursionError) as exc: raise InterchangeError('Malformed JSON snapshot') from exc


def _fields(value,allowed,required=()):
    if not isinstance(value,dict) or set(value)-set(allowed) or set(required)-set(value):
        raise InterchangeError('Invalid snapshot schema fields')


def validate_snapshot(snapshot, *, detach=False):
    """Pure canonical Store-schema validation; no second divergent admission policy.

    The Store-owned helper retains all persisted data, including inert comment
    target IDs and private Trash/history fields, while stripping derived display
    projections. It does not construct a Store or consult filesystem/native state.
    """
    from .store import validate_backup_snapshot
    try:
        state=validate_backup_snapshot(snapshot)
        state.pop('scope_id',None)
        if any(run['status'] not in {'completed','cancelled','error'} for run in state['runs']):
            raise InterchangeError('Stop active or unknown runs before backup/restore')
        if len(_json_bytes(state))>MAX_BACKUP_SNAPSHOT:
            raise InterchangeError('Snapshot exceeds Store canonical backup byte limit')
        if detach:
            for item in state['items']:
                item['thread_id']=None
                item.pop('executor',None)
                item.pop('thread_owner',None)
            state['runs']=[]
            for version in state['versions']:
                version['run_id']=None
                version['snapshot']['thread_id']=None
                version['snapshot'].pop('executor',None)
                version['snapshot'].pop('thread_owner',None)
        return state
    except InterchangeError:
        raise
    except (TypeError,KeyError,IndexError,AttributeError,ValueError,RecursionError,OverflowError) as exc:
        raise InterchangeError(str(exc) if isinstance(exc,ValueError) else 'Malformed Workspace snapshot schema') from exc


def backup(snapshot):
    """Complete v1 Workspace ZIP, with canonical data and original attachment bytes.

    Archive is deliberately ZIP_STORED: repetitive legitimate documents cannot
    trip its own compression-ratio defence on restore. SHA-256 detects accidental
    corruption, never asserts authenticity. Active runs must be stopped first.
    """
    state=validate_snapshot(snapshot)
    envelope={'format':'workspace-backup','version':1,'sha256':hashlib.sha256(_json_bytes(state)).hexdigest(),'snapshot':state}
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_STORED) as z: z.writestr('snapshot.json',_json_bytes(envelope))
    return output.getvalue()


def read_backup(data):
    """Fully validate then detach native identities; no Store or filesystem mutation."""
    files=_archive(data,full_backup=True)
    if set(files)!={'snapshot.json'}: raise InterchangeError('Expected complete Workspace backup, not Markdown/CSV or arbitrary ZIP')
    envelope=_json_load(files['snapshot.json'])
    _fields(envelope,{'format','version','sha256','snapshot'},{'format','version','sha256','snapshot'})
    if envelope['format']!='workspace-backup' or type(envelope['version']) is not int or envelope['version']!=1: raise InterchangeError('Unsupported Workspace backup version')
    if not isinstance(envelope['sha256'],str) or hashlib.sha256(_json_bytes(envelope['snapshot'])).hexdigest()!=envelope['sha256']: raise InterchangeError('Backup data digest mismatch')
    return validate_snapshot(envelope['snapshot'],detach=True)


def import_into_store(store,name,data,parent_id=None,expected_revision=None):
    """Convert first; commit page+original or table+records in one Store transaction."""
    parsed=import_file(name,data)
    if parsed['kind']=='database':
        result=store.import_table({k:parsed[k] for k in ['title','columns','rows']},parent_id=parent_id,expected_revision=expected_revision)
    else:
        result=store.import_document({k:parsed[k] for k in ['title','content','original']},parent_id=parent_id,expected_revision=expected_revision)
    return {'item':result,'warnings':parsed['warnings']}


def restore_into_store(store,data,expected_revision=None):
    """Validate every member/reference before the owner's atomic replacement helper."""
    return store.restore_snapshot(read_backup(data),expected_revision=expected_revision)
