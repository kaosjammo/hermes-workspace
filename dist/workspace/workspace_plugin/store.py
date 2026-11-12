"""Profile-owned, transactional Workspace data API (v1).

Only the explicitly supplied profile_home owns this store; no environment, launch
profile or native identity is inferred. Each operation has its own SQLite
transaction; BEGIN IMMEDIATE fences optimistic writes, scope grants and run locks.
The process constructor NEVER recovers runs. Startup may call recover_runs() for
provably dead process owners; workflow must reconcile native admissions itself.

Interchange helpers are atomic: import_document(document, parent_id=None,
expected_revision=None), import_table(table, parent_id=None, expected_revision=None)
and restore_snapshot(snapshot, expected_revision=None). Restore preserves data IDs,
clears native threads/runs, and keeps the receiving database's random scope_id.
HTTP admission MUST call check_scope(expected_scope) for every mutation. Trusted
Python entrypoints need no ambient HTTP scope; execute also checks it if supplied.

Trash retains relation references until purge. Purge prunes references to purged
records and removes relation columns targeting a purged database (including their
row values), subject to all affected locks. Templates copy data, never identity,
comments, threads or native runs. Versions restore content, properties and schema,
not comment resolution. Computed formula properties are always server-derived.
"""
import base64
import copy
from contextlib import closing, contextmanager
from threading import local
from datetime import date, datetime, timezone
import html
import hashlib
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import stat
import uuid
from urllib.parse import urlsplit

from .formulas import FormulaError, dependencies, evaluate, validate
from .sections import SectionUnavailable, capture_sections, locate_anchor, plan_revert, addressed_anchors, map_anchor, paragraph_replacement_anchor


class StoreError(ValueError):
    def __init__(self, detail, status_code=400):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code
        self.status = status_code


CATEGORIES = ('items', 'comments', 'versions', 'attachments', 'runs', 'recents', 'templates')
KINDS = {'folder', 'page', 'database', 'record'}
TYPES = {'text', 'number', 'checkbox', 'date', 'select', 'relation', 'formula'}
MAX_ITEMS = 5000
MAX_CONTENT = 2_000_000
MAX_ATTACHMENT = 10_000_000
MAX_STATE = 64_000_000
MAX_COMMENTS = 10000
MAX_COLUMNS = 100
MAX_TEXT = 20000
MAX_DEPTH = 64
ACTIVE = {'running'}
TERMINAL = {'completed', 'cancelled', 'error'}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _id():
    return uuid.uuid4().hex


def _text(value, name, limit=MAX_TEXT, empty=False):
    if not isinstance(value, str) or len(value) > limit or '\x00' in value or (not empty and not value.strip()):
        raise StoreError(f'{name} must be bounded text (maximum {limit} characters)')
    return value


def _identifier(value, name='id'):
    return _text(value, name, 256)


def _keys(value, allowed, required=()):
    if not isinstance(value, dict) or set(value) - set(allowed) or set(required) - set(value):
        raise StoreError('Invalid fields; allowed: ' + ', '.join(sorted(allowed)))


def _json(value):
    try:
        return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
    except (TypeError, ValueError, RecursionError) as exc:
        raise StoreError('Expected finite JSON data') from exc


class _HTML(HTMLParser):
    TAGS = {'p','div','span','br','hr','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','del','mark','sub','sup','ul','ol','li','a','blockquote','pre','code','table','thead','tbody','tfoot','tr','td','th','img','input','label'}
    VOID = {'br','hr','img','input'}
    DROP = {'script','style','iframe','object','embed','svg','math','template'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.drop = 0
        self.rejected = False

    def handle_starttag(self, tag, attrs):
        if tag in self.DROP:
            self.rejected = True
            self.drop += 1
            return
        if self.drop or tag not in self.TAGS:
            self.rejected = True
            return
        clean = []
        for key, value in attrs:
            value = '' if value is None else value
            accepted = False
            if key in ('title','alt') and len(value)<=1000:
                accepted = True
            elif key in ('href','src') and ((tag=='a' and key=='href') or (tag=='img' and key=='src')):
                if not any(ord(c)<33 for c in value):
                    try:
                        scheme = urlsplit(value).scheme.lower()
                        accepted = (tag=='a' and (scheme in ('http','https','mailto') or value.startswith('#'))) or value.startswith('attachment:')
                    except ValueError:
                        pass
            elif tag=='ol' and key=='start' and re.fullmatch(r'[0-9]{1,6}',value):
                value=str(int(value)); accepted=True
            elif key in ('colspan','rowspan') and tag in ('td','th') and value.isdigit() and 1<=int(value)<=100:
                accepted = True
            elif tag=='input' and (key=='type' and value=='checkbox' or key in ('checked','disabled')):
                accepted = True
            elif key=='data-type' and value in ('taskList','taskItem') or key=='data-checked' and value in ('true','false'):
                accepted = True
            elif tag=='span' and key=='data-workspace-weight' and value=='normal':
                accepted = True
            elif tag=='span' and key=='style' and re.fullmatch(r'\s*font-weight\s*:\s*(?:normal|400)\s*;?\s*',value,re.I):
                # One native semantic reset, never a CSS passthrough. C's
                # frontend renders this exact token with font-weight:400.
                key,value = 'data-workspace-weight','normal'
                accepted = True
            if accepted:
                if key != 'data-workspace-weight' or not any(k==key for k,_ in clean):
                    clean.append((key,value))
            else:
                self.rejected = True
        if tag=='input':
            clean = [x for x in clean if x[0] not in ('type','disabled')] + [('type','checkbox'),('disabled','disabled')]
        self.parts.append('<'+tag+''.join(f' {k}="{html.escape(v,quote=True)}"' for k,v in clean)+'>')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in self.DROP:
            self.drop = max(0, self.drop - 1)
        elif not self.drop and tag in self.TAGS and tag not in self.VOID:
            self.parts.append('</' + tag + '>')

    def handle_data(self, data):
        if not self.drop:
            self.parts.append(html.escape(data, quote=False))


def _content(value):
    _text(value, 'content', MAX_CONTENT, empty=True)
    parser = _HTML()
    try:
        parser.feed(value)
        parser.close()
    except (ValueError, RecursionError) as exc:
        raise StoreError('Invalid HTML') from exc
    clean = ''.join(parser.parts)
    if len(clean) > MAX_CONTENT:
        raise StoreError('Sanitized content is too large')
    return clean


class _Plain(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, value):
        self.parts.append(value)


def _plain(value):
    parser = _Plain()
    parser.feed(value)
    return ''.join(parser.parts)


def _process_identity(pid=None):
    pid = os.getpid() if pid is None else pid
    try:
        # A PID alone can be reused. Linux boot/start ticks are payload-free.
        start = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
        boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
        return f'{boot}:{pid}:{start}'
    except (OSError, IndexError):
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return None
        except PermissionError:
            pass
        return f'pid:{pid}'


class Store:
    def __init__(self, profile_home: Path, *, shared=False):
        self._atomic = local()
        if not isinstance(profile_home, Path) or not profile_home.is_absolute():
            raise StoreError('An explicit absolute profile_home Path is required')
        self.profile_home = profile_home.resolve()
        self.shared = shared
        self.root = self.profile_home / 'plugin-data' / 'workspace'
        for directory in (self.profile_home / 'plugin-data', self.root):
            if directory.is_symlink():
                raise StoreError('Store directories must not be symlinks')
            directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.db_path = self.root / 'workspace.sqlite3'
        flags = os.O_CREAT | os.O_RDWR | getattr(os, 'O_NOFOLLOW', 0)
        try:
            fd = os.open(self.db_path, flags, 0o600)
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                raise StoreError('Store database must be an ordinary private file')
            os.fchmod(fd, 0o600)
        except OSError as exc:
            raise StoreError('Cannot open private store database') from exc
        finally:
            if 'fd' in locals():
                os.close(fd)
        with closing(self._connect()) as conn:
            conn.executescript('''
                CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                INSERT OR IGNORE INTO metadata VALUES('revision','0');
                CREATE TABLE IF NOT EXISTS items(
                    id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('folder','page','database','record')),
                    parent_id TEXT REFERENCES items(id) DEFERRABLE INITIALLY DEFERRED,
                    database_id TEXT REFERENCES items(id) DEFERRABLE INITIALLY DEFERRED,
                    data TEXT NOT NULL CHECK(json_valid(data)),
                    CHECK((kind='record' AND database_id IS NOT NULL AND parent_id IS NULL)
                       OR (kind!='record' AND database_id IS NULL)));
                CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) DEFERRABLE INITIALLY DEFERRED, data TEXT NOT NULL CHECK(json_valid(data)));
                CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) DEFERRABLE INITIALLY DEFERRED, data TEXT NOT NULL CHECK(json_valid(data)));
                CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) DEFERRABLE INITIALLY DEFERRED, data TEXT NOT NULL CHECK(json_valid(data)));
                CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) DEFERRABLE INITIALLY DEFERRED, data TEXT NOT NULL CHECK(json_valid(data)));
                CREATE TABLE IF NOT EXISTS recents(item_id TEXT PRIMARY KEY REFERENCES items(id) DEFERRABLE INITIALLY DEFERRED, data TEXT NOT NULL CHECK(json_valid(data)));
                CREATE TABLE IF NOT EXISTS templates(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
                CREATE TABLE IF NOT EXISTS locks(item_id TEXT PRIMARY KEY REFERENCES items(id) DEFERRABLE INITIALLY DEFERRED,
                    run_id TEXT NOT NULL REFERENCES runs(id) DEFERRABLE INITIALLY DEFERRED);
            ''')
            conn.execute("INSERT OR IGNORE INTO metadata VALUES('scope_id',?)", (_id(),))
            conn.execute("INSERT OR IGNORE INTO metadata VALUES('section_epoch',?)", (_id(),))
            conn.execute("INSERT OR IGNORE INTO metadata VALUES('schema_version','1')")
            conn.execute("INSERT OR IGNORE INTO metadata VALUES('identity_names','{}')")
            if conn.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()[0] != '1':
                raise StoreError('Unsupported Workspace schema version')
            self.scope_id = conn.execute("SELECT value FROM metadata WHERE key='scope_id'").fetchone()[0]

    def _connect(self):
        conn = sqlite3.connect(self.db_path, timeout=10, isolation_level=None)
        conn.execute('PRAGMA foreign_keys=ON')
        conn.execute('PRAGMA busy_timeout=10000')
        conn.execute('PRAGMA synchronous=FULL')
        return conn

    @contextmanager
    def atomic(self):
        """One plugin-owned writer for run authority, effects and receipts.

        Nested Store operations use savepoints and this thread's connection.
        Nothing here acquires or mutates native Hermes authority.
        """
        current = getattr(self._atomic, 'connection', None)
        if current is not None:
            yield current
            return
        conn = self._connect()
        try:
            conn.execute('BEGIN IMMEDIATE')
            if conn.execute("SELECT value FROM metadata WHERE key='scope_id'").fetchone()[0] != self.scope_id:
                raise StoreError('Workspace scope changed; reopen before writing', 409)
            self._atomic.connection = conn
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        finally:
            self._atomic.connection = None
            conn.close()

    def check_scope(self, expected_scope):
        if not isinstance(expected_scope, str) or expected_scope != self.scope_id:
            raise StoreError('Workspace profile scope changed; reload before writing', 409)

    @staticmethod
    def _schema(schema):
        if schema not in ('main', 'moved'):
            raise StoreError('Unsupported internal database namespace')
        return schema

    def _load(self, conn, schema='main'):
        schema = self._schema(schema)
        state = {key:[json.loads(row[0]) for row in conn.execute(f'SELECT data FROM {schema}.{key} ORDER BY rowid')] for key in CATEGORIES}
        state['revision'] = int(conn.execute(f"SELECT value FROM {schema}.metadata WHERE key='revision'").fetchone()[0])
        state['_identity_names'] = json.loads(conn.execute(f"SELECT value FROM {schema}.metadata WHERE key='identity_names'").fetchone()[0])
        state['_locks'] = dict(conn.execute(f'SELECT item_id,run_id FROM {schema}.locks'))
        state['_section_epoch'] = conn.execute(f"SELECT value FROM {schema}.metadata WHERE key='section_epoch'").fetchone()[0]
        return state

    def _save(self, conn, state, schema='main'):
        schema = self._schema(schema)
        if len(_json({k:v for k,v in state.items() if k not in {'_locks','_section_epoch','_identity_names'}}).encode()) > MAX_STATE:
            raise StoreError('Workspace storage limit exceeded')
        for table in ('locks','comments','versions','attachments','recents','runs','templates','items'):
            conn.execute(f'DELETE FROM {schema}.{table}')
        for item in state['items']:
            conn.execute(f'INSERT INTO {schema}.items VALUES(?,?,?,?,?)', (item['id'],item['kind'],item['parent_id'],item['database_id'],_json(item)))
        for table in ('comments','versions','attachments','runs'):
            conn.executemany(f'INSERT INTO {schema}.{table} VALUES(?,?,?)', [(x['id'],x['item_id'],_json(x)) for x in state[table]])
        conn.executemany(f'INSERT INTO {schema}.templates VALUES(?,?)', [(x['id'],_json(x)) for x in state['templates']])
        conn.executemany(f'INSERT INTO {schema}.recents VALUES(?,?)', [(x['item_id'],_json(x)) for x in state['recents']])
        conn.executemany(f'INSERT INTO {schema}.locks VALUES(?,?)', state['_locks'].items())
        conn.execute(f"UPDATE {schema}.metadata SET value=? WHERE key='revision'", (str(state['revision']),))
        conn.execute(f"UPDATE {schema}.metadata SET value=? WHERE key='identity_names'", (_json(state.get('_identity_names',{})),))
        if '_section_epoch' in state:
            conn.execute(f"UPDATE {schema}.metadata SET value=? WHERE key='section_epoch'", (state['_section_epoch'],))

    def _transaction(self, action, expected_revision=None, authorize=None, skip_unchanged=False):
        parent = getattr(self._atomic, 'connection', None)
        conn = parent if parent is not None else self._connect()
        savepoint = 'workspace_' + uuid.uuid4().hex if parent is not None else None
        def commit():
            conn.execute('RELEASE '+savepoint) if savepoint else conn.commit()
        def rollback():
            if savepoint:
                conn.execute('ROLLBACK TO '+savepoint)
                conn.execute('RELEASE '+savepoint)
            else:
                conn.rollback()
        try:
            conn.execute('SAVEPOINT '+savepoint) if savepoint else conn.execute('BEGIN IMMEDIATE')
            if authorize is not None:
                authorize()  # Trusted native check AFTER any SQLite lock wait.
            state = self._load(conn)
            if expected_revision is not None and (type(expected_revision) is not int or expected_revision != state['revision']):
                raise StoreError('Workspace revision changed; reload before writing', 409)
            before = _json(state) if skip_unchanged else None
            result = action(state)
            if skip_unchanged and _json(state)==before:
                commit()
                return self._public(copy.deepcopy(result),state)
            self._validate_state(state)
            state['revision'] += 1
            self._save(conn, state)
            commit()
            return self._public(copy.deepcopy(result), state)
        except sqlite3.Error as exc:
            rollback()
            raise StoreError('Workspace transaction failed: ' + str(exc), 409 if 'locked' in str(exc) else 400) from exc
        except (TypeError,KeyError,OverflowError,RecursionError) as exc:
            rollback()
            raise StoreError('Invalid Workspace data shape') from exc
        except BaseException:
            rollback()
            raise
        finally:
            if parent is None:
                conn.close()

    def snapshot(self, *, human_actor=None, include_identity=False, include_content_revisions=False):
        parent = getattr(self._atomic, 'connection', None)
        conn = parent if parent is not None else self._connect()
        try:
            if parent is None:
                conn.execute('BEGIN')
            state = self._load(conn)
            result = {key:self._public(copy.deepcopy([row for row in state[key]
                if key != 'comments' or not row.get('_deleted_at')]), state) for key in CATEGORIES}
            result.update(revision=state['revision'], scope_id=self.scope_id)
            if include_content_revisions:
                # Address needs exact persisted revisions before private fields
                # are stripped. Keep ordinary display/export schemas unchanged.
                from .targeted_edits import content_revision
                revisions = {item['id']: content_revision(item) for item in state['items']}
                for item in result['items']:
                    item['content_revision'] = revisions[item['id']]
            if include_identity:
                result['identity'] = self._identity_view(state,human_actor)
            if parent is None:
                conn.commit()
            return result
        finally:
            if parent is None:
                conn.close()

    def backup_snapshot(self):
        """Consistent persisted v1 data, without formula/error/anchor projections.

        Unlike display snapshot(), this cannot inflate the storage budget with
        derived values. Runs remain until the converter checks lifecycle state.
        The receiving Store never adopts scope_id or native execution authority.
        """
        parent = getattr(self._atomic, 'connection', None)
        conn = parent if parent is not None else self._connect()
        try:
            if parent is None:
                conn.execute('BEGIN')
            state = self._load(conn)
            state.pop('_locks')
            state.pop('_section_epoch',None)
            state.pop('_identity_names',None)
            # Materialise known private legacy ownership before export. Imports
            # must never infer ownership from the receiving profile.
            self._stamp_legacy(state)
            state['scope_id'] = self.scope_id
            if parent is None:
                conn.commit()
            return state
        finally:
            if parent is None:
                conn.close()

    def _read_fence(self, conn, expected_scope=None, expected_revision=None):
        scope = conn.execute("SELECT value FROM metadata WHERE key='scope_id'").fetchone()[0]
        revision = int(conn.execute("SELECT value FROM metadata WHERE key='revision'").fetchone()[0])
        if scope != self.scope_id or expected_scope is not None and scope != expected_scope:
            raise StoreError('Workspace scope changed; reopen before reading',409)
        if expected_revision is not None and (type(expected_revision) is not int or revision != expected_revision):
            raise StoreError('Workspace revision changed; reload before reading',409)
        return {'scope_id':scope,'revision':revision}

    def _read_view(self, action, *, expected_scope=None, expected_revision=None):
        conn = self._connect()
        try:
            conn.execute('BEGIN')
            fence = self._read_fence(conn,expected_scope,expected_revision)
            result = action(self._load(conn),fence)
            conn.commit()
            return result
        finally:
            conn.close()

    def catalog(self, *, expected_scope=None, expected_revision=None):
        """Navigation metadata only; no document/history/blob Python projection.

        This reduces response and Python materialization, not SQLite scan cost.
        No cache or persistent search index is introduced.
        """
        conn = self._connect()
        try:
            conn.execute('BEGIN')
            fence = self._read_fence(conn,expected_scope,expected_revision)
            fields = ['title','deleted_at','updated_at','thread_id','executor','thread_owner']
            sql = 'SELECT id,kind,parent_id,database_id,'+','.join("json_extract(data,'$."+key+"')" for key in fields)+' FROM items ORDER BY rowid'
            items = []
            for values in conn.execute(sql):
                row = dict(zip(['id','kind','parent_id','database_id',*fields],values))
                for key in ('executor','thread_owner'):
                    if row[key] is None:
                        row.pop(key)
                    else:
                        row[key] = json.loads(row[key])
                items.append(row)
            counts = {row[0]:{'total':row[1],'unresolved':row[2]} for row in conn.execute(
                "SELECT item_id,count(*),sum(json_extract(data,'$.resolved')=0) FROM comments WHERE json_extract(data,'$._deleted_at') IS NULL GROUP BY item_id")}
            runs = [self._public(json.loads(row[0]),{}) for row in conn.execute("SELECT data FROM runs WHERE json_extract(data,'$.status')='running' ORDER BY rowid")]
            recents = [json.loads(row[0]) for row in conn.execute('SELECT data FROM recents ORDER BY rowid')]
            templates = [{'id':row[0],'name':row[1],'kind':row[2]} for row in conn.execute("SELECT id,json_extract(data,'$.name'),json_extract(data,'$.kind') FROM templates ORDER BY rowid")]
            conn.commit()
            return {**fence,'items':items,'comment_counts':counts,'active_runs':runs,'recents':recents,'templates':templates}
        finally:
            conn.close()

    def document(self, item_id, *, history=False, expected_scope=None, expected_revision=None):
        """Scoped lazy response; current implementation still reads the Store graph
        internally for authoritative formulas/attachment/history references."""
        def view(state,fence):
            item = self._item(state,item_id,active=True)
            if item['kind']=='folder':
                raise StoreError('Choose a page, database or record',404)
            versions = [v for v in state['versions'] if v['item_id']==item_id]
            docs = [v['snapshot'] for v in versions] if history else [item]
            refs = set().union(*(self._attachment_refs(doc['content']) for doc in docs)) if docs else set()
            assets = [a for a in state['attachments'] if a['item_id']==item_id or a['id'] in refs]
            if history:
                return {**fence,'item_id':item_id,'versions':self._public(copy.deepcopy(versions),state),'attachments':copy.deepcopy(assets)}
            db = self._item(state,item['database_id']) if item['kind']=='record' else None
            row_fields = ('id','kind','title','parent_id','database_id','properties','updated_at','deleted_at','thread_id')
            rows = [self._public({key:copy.deepcopy(row[key]) for key in row_fields},state)
                    for row in state['items'] if row['kind']=='record' and row['database_id']==item_id and row['deleted_at'] is None] if item['kind']=='database' else []
            return {**fence,'item':self._public(copy.deepcopy(item),state),
                    'database':{key:copy.deepcopy(db[key]) for key in ('id','title','columns','deleted_at')} if db else None,
                    'comments':self._public(copy.deepcopy([c for c in state['comments'] if c['item_id']==item_id and not c.get('_deleted_at')]),state),
                    'attachments':copy.deepcopy(assets),
                    'record_rows':rows,
                    'runs':self._public(copy.deepcopy([r for r in state['runs'] if item_id in r['allowed_item_ids']]),state)}
        return self._read_view(view,expected_scope=expected_scope,expected_revision=expected_revision)

    def search_page(self, query, *, offset=0, limit=100, expected_revision=None):
        query = _text(query,'query',500,empty=True).casefold().strip()
        if type(offset) is not int or offset<0 or type(limit) is not int or not 1<=limit<=200:
            raise StoreError('Search offset must be nonnegative and limit must be between 1 and 200')
        if offset and expected_revision is None:
            raise StoreError('Capture the search revision before requesting another page',409)
        def view(state,fence):
            matches = []
            for item in state['items']:
                if not query or item['deleted_at'] is not None or item['kind']=='folder':
                    continue
                properties,_ = self._computed(state,item)
                text = item['title']+' '+_plain(item['content'])+' '+' '.join(value for value in properties.values() if isinstance(value,str))
                if query in text.casefold():
                    start = max(0,text.casefold().find(query)-60)
                    matches.append({**{key:item[key] for key in ('id','kind','title','parent_id','database_id','updated_at')},'excerpt':text[start:start+240]})
            total = len(matches)
            next_offset = offset+limit if offset+limit<total else None
            return {**fence,'items':matches[offset:offset+limit],'total':total,'offset':offset,'limit':limit,
                    'next_offset':next_offset,'has_more':next_offset is not None,'truncated':offset>0 or next_offset is not None}
        return self._read_view(view,expected_revision=expected_revision)

    def _item(self, state, ident, active=False):
        _identifier(ident)
        item = next((x for x in state['items'] if x['id'] == ident), None)
        if item is None:
            raise StoreError('Workspace item not found', 404)
        if active and item['deleted_at'] is not None:
            raise StoreError('Item is in Trash', 409)
        return item

    def _find(self, state, category, ident):
        _identifier(ident)
        result = next((x for x in state[category] if x['id'] == ident), None)
        if result is None:
            raise StoreError(category.rstrip('s') + ' not found', 404)
        return result

    def _descendants(self, state, ids):
        found = set(ids)
        for _ in range(MAX_DEPTH + 2):
            added = {x['id'] for x in state['items'] if x['parent_id'] in found or x['database_id'] in found} - found
            if not added:
                return found
            found.update(added)
        raise StoreError('Folder depth limit exceeded')

    def _unlocked(self, state, ids, token=None, descendants=True):
        affected = self._descendants(state, ids) if descendants else set(ids)
        for ident in tuple(affected):
            item = self._item(state, ident)
            parent = item['parent_id'] or item['database_id']
            for _ in range(MAX_DEPTH + 1):
                if parent is None:
                    break
                affected.add(parent)
                ancestor = self._item(state, parent)
                parent = ancestor['parent_id'] or ancestor['database_id']
        if any(owner != token for ident,owner in state['_locks'].items() if ident in affected):
            raise StoreError('Item is read-only during an active run', 409)

    def _parent(self, state, parent_id):
        if parent_id is not None:
            parent = self._item(state, parent_id, active=True)
            if parent['kind'] != 'folder':
                raise StoreError('Only folders may contain items')

    def _columns(self, state, columns):
        if not isinstance(columns, list) or len(columns) > MAX_COLUMNS:
            raise StoreError('columns must be an array of at most 100 columns')
        columns = copy.deepcopy(columns)
        ids, names = set(), set()
        for column in columns:
            _keys(column, {'id','name','type','options','target_database_id','formula'}, {'id','name','type'})
            ident = _identifier(column['id'], 'column id')
            name = _text(column['name'], 'column name', 200)
            if ident in ids or name.casefold() in names:
                raise StoreError('Column IDs and names must be unique')
            ids.add(ident)
            names.add(name.casefold())
            if column['type'] not in TYPES:
                raise StoreError('Unsupported property type')
            typ = column['type']
            if typ == 'select':
                options = column.get('options', [])
                if not isinstance(options, list) or len(options) > 100 or any(not isinstance(x,str) for x in options) or len(set(options)) != len(options):
                    raise StoreError('Select options must be a unique bounded array')
                for value in options:
                    _text(value, 'select option', 200)
                column['options'] = options
            elif 'options' in column:
                raise StoreError('Only select columns have options')
            if typ == 'relation':
                target = self._item(state, column.get('target_database_id'))
                if target['kind'] != 'database':
                    raise StoreError('Relation target must be a Workspace database')
            elif 'target_database_id' in column:
                raise StoreError('Only relations have a target database')
            if typ != 'formula' and 'formula' in column:
                raise StoreError('Only formula columns have expressions')
        by_ref = {}
        for column in columns:
            for ref in (column['id'],column['name']):
                if ref in by_ref and by_ref[ref] != column['id']:
                    raise StoreError('Column names/IDs must be unambiguous')
                by_ref[ref] = column['id']
        graph = {}
        try:
            for column in columns:
                if column['type'] == 'formula':
                    graph[column['id']] = {by_ref[x] for x in validate(column.get('formula'), by_ref)}
            visited = set()
            def visit(ident, path):
                if ident in path:
                    raise StoreError('Formula dependency cycle')
                if len(path) > 20:
                    raise StoreError('Formula dependency depth limit exceeded')
                if ident in visited:
                    return
                for ref in graph.get(ident, ()):
                    visit(ref, path | {ident})
                visited.add(ident)
            for ident in graph:
                visit(ident, set())
        except FormulaError as exc:
            raise StoreError(str(exc)) from exc
        return columns

    def _properties(self, state, item, properties, *, allow_formula=False, allow_deleted=True):
        if not isinstance(properties, dict):
            raise StoreError('properties must be an object')
        if item['kind'] != 'record':
            if properties:
                raise StoreError('Only records have properties')
            return {}
        columns = self._item(state, item['database_id'])['columns']
        by_id = {x['id']:x for x in columns}
        if properties.keys() - by_id.keys():
            raise StoreError('Unknown property column')
        result = {}
        for ident,value in properties.items():
            column = by_id[ident]
            typ = column['type']
            if typ == 'formula':
                if not allow_formula:
                    raise StoreError('Formula properties are computed and read-only')
                continue
            if value is None:
                result[ident] = None
                continue
            valid = False
            if typ == 'text':
                valid = isinstance(value,str) and len(value) <= MAX_TEXT and '\x00' not in value
            elif typ == 'number':
                valid = type(value) in (int,float) and math.isfinite(value) and abs(value) <= 1e15
            elif typ == 'checkbox':
                valid = type(value) is bool
            elif typ == 'date':
                try:
                    valid = isinstance(value,str) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', value)) and bool(date.fromisoformat(value))
                except ValueError:
                    valid = False
            elif typ == 'select':
                valid = isinstance(value,str) and value in column['options']
            elif typ == 'relation':
                valid = isinstance(value,list) and len(value) <= 1000 and all(isinstance(x,str) for x in value) and len(set(value)) == len(value)
                if valid:
                    for target_id in value:
                        target = self._item(state, target_id)
                        if target['kind'] != 'record' or target['database_id'] != column['target_database_id'] or (not allow_deleted and target['deleted_at'] is not None):
                            valid = False
                            break
            if not valid:
                raise StoreError('Invalid ' + typ + ' value for ' + column['name'])
            result[ident] = copy.deepcopy(value)
        return result

    def _computed(self, state, item):
        result = copy.deepcopy(item['properties'])
        errors = {}
        if item['kind'] != 'record':
            return result, errors
        columns = self._item(state, item['database_id'])['columns']
        by_id = {x['id']:x for x in columns}
        by_ref = {ref:c['id'] for c in columns for ref in (c['id'],c['name'])}
        def compute(ident):
            col = by_id[ident]
            if col['type'] != 'formula':
                return result.get(ident)
            if ident in result:
                return result[ident]
            try:
                refs = dependencies(col['formula'])
                values = {ref:compute(by_ref[ref]) for ref in refs}
                result[ident] = evaluate(col['formula'], values)
            except FormulaError as exc:
                result[ident] = None
                errors[ident] = str(exc)
            return result[ident]
        for column in columns:
            compute(column['id'])
        return result, errors

    def _human(self, state, actor=None):
        from .identity import human_id
        actor = actor if self.shared else human_id(self.profile_home)
        if actor is None:
            return None
        if not isinstance(actor,str) or re.fullmatch('[0-9a-f]{64}',actor) is None:
            raise StoreError('An implementation-owned human author is required',403)
        return {'kind':'human','id':actor,'name':state.get('_identity_names',{}).get(actor,'user')}

    def _identity_view(self, state, actor=None):
        from .identity import human_id
        return {'human':self._human(state,actor), 'source_id':human_id(self.profile_home)}

    def _stamp_legacy(self, state):
        if self.shared:
            return
        for comment in state['comments']:
            if 'author_identity' not in comment:
                comment['author_identity'] = self._human(state)
            for reply in comment['replies']:
                if reply['author']=='user' and 'author_identity' not in reply:
                    reply['author_identity'] = self._human(state)

    def _public(self, value, state):
        if isinstance(value, list):
            return [self._public(x,state) for x in value]
        if not isinstance(value,dict):
            return value
        if 'snapshot' in value and 'run_id' in value:
            # Historical content/properties are inert saved bytes, never recomputed
            # using today's schema. Only strip private deletion metadata.
            result = {k:copy.deepcopy(v) for k,v in value.items() if not k.startswith('_')}
            result['snapshot'] = {k:v for k,v in result['snapshot'].items() if not k.startswith('_')}
            return result
        result = {k:self._public(v,state) for k,v in value.items() if not k.startswith('_')}
        if value.get('kind') in KINDS and 'properties' in value and 'database_id' in value:
            result['properties'], errors = self._computed(state, value)
            if errors:
                result['formula_errors'] = errors
        if ('anchor' in value and 'replies' in value) or value.get('author')=='user':
            identity = value.get('author_identity') if 'author_identity' in value else self._human(state)
            if identity and identity.get('kind')=='human':
                result['author_identity'] = {**identity,'name':state.get('_identity_names',{}).get(identity['id'],identity['name'])}
        if 'anchor' in value and 'replies' in value:
            anchor = value['anchor']
            if anchor is None:
                result['anchor_status'] = 'whole'
            else:
                text = _plain(self._item(state,value['item_id'])['content'])
                needle = anchor['prefix'] + anchor['quote'] + anchor['suffix']
                # Overlapping matches count; an empty/ambiguous quote is detached.
                occurrences = sum(text.startswith(needle,i) for i in range(len(text))) if needle else 0
                result['anchor_status'] = 'attached' if occurrences == 1 else 'detached'
            section = self._section_view(state,value)
            if section is not None:
                result['section_change'] = section
        return result

    def _create(self, state, payload):
        _keys(payload, {'kind','title','parent_id','database_id','content','properties'}, {'kind','title'})
        kind = payload['kind']
        if kind not in KINDS:
            raise StoreError('Invalid item kind')
        if len(state['items']) >= MAX_ITEMS:
            raise StoreError('Workspace item limit exceeded')
        parent_id, database_id = payload.get('parent_id'), payload.get('database_id')
        self._parent(state,parent_id)
        if kind == 'record':
            db = self._item(state,database_id,active=True)
            if db['kind'] != 'database' or parent_id is not None:
                raise StoreError('Records belong to one database, not a folder')
            self._unlocked(state,[database_id],descendants=False)
        elif database_id is not None:
            raise StoreError('Only records belong to a database')
        if parent_id is not None:
            self._unlocked(state,[parent_id],descendants=False)
        item = {'id':_id(),'kind':kind,'title':_text(payload['title'],'title',500),'parent_id':parent_id,'database_id':database_id,'content':_content(payload.get('content','')),'properties':{},'columns':[],'deleted_at':None,'updated_at':_now(),'thread_id':None}
        if kind == 'folder' and item['content']:
            raise StoreError('Folders have no document content')
        item['properties'] = self._properties(state,item,payload.get('properties',{}),allow_deleted=False)
        state['items'].append(item)
        return item

    def _patch(self, state, item, patch, token=None):
        _keys(patch, {'title','content','parent_id','properties','columns'})
        self._unlocked(state,[item['id']],token)
        if 'title' in patch:
            item['title'] = _text(patch['title'],'title',500)
        if 'content' in patch:
            if item['kind'] == 'folder':
                raise StoreError('Folders have no document content')
            item['content'] = _content(patch['content'])
        if 'parent_id' in patch:
            if item['kind'] == 'record':
                raise StoreError('Record database ownership is immutable')
            self._parent(state,patch['parent_id'])
            if patch['parent_id'] is not None:
                self._unlocked(state,[patch['parent_id']],token,descendants=False)
            item['parent_id'] = patch['parent_id']
        if 'properties' in patch:
            # Replacement semantics are deliberate; autosave sends the row object.
            previous = item['properties']
            props = self._properties(state,item,patch['properties'],allow_deleted=True)
            for ident,value in props.items():
                col = next(c for c in self._item(state,item['database_id'])['columns'] if c['id']==ident) if item['kind']=='record' else None
                if col and col['type']=='relation' and value:
                    old = previous.get(ident) or []
                    if any(self._item(state,x)['deleted_at'] is not None and x not in old for x in value):
                        raise StoreError('Cannot add a relation to a trashed record')
            item['properties'] = props
        if 'columns' in patch:
            self._set_columns(state,item,patch['columns'],token)
        if token is None and item.get('_section_generation') and patch:
            item['_manual_revision'] = item.get('_manual_revision',0) + 1
        item['updated_at'] = _now()
        return item

    def _section_ref(self, state, version_id, generation_id, change_id):
        for ident in (version_id,generation_id,change_id):
            _identifier(ident)
        version = self._find(state,'versions',version_id)
        generation = next((g for g in version.get('_section_provenance',[]) if g['id']==generation_id),None)
        change = next((c for c in generation['changes'] if c['id']==change_id),None) if generation else None
        if change is None:
            raise StoreError('This saved section change is unavailable.',409)
        item = self._item(state,version['item_id'],active=True)
        self._unlocked(state,[item['id']])
        if item.get('_section_generation') != generation_id:
            raise StoreError('A later change superseded this section. Review the current saved version.',409)
        if change.get('reverted_at') is not None:
            raise StoreError('This section change was already reverted.',409)
        return version,generation,change,item

    def _section_plan(self, generation, change, item):
        try:
            plan = plan_revert(change,generation['post_content'],item['content'],_plain,_content)
            if plan['content'] == item['content']:
                raise StoreError('This section already matches its saved original; no eligible change remains to revert.',409)
            return plan
        except SectionUnavailable as exc:
            raise StoreError(str(exc),409) from exc

    def _section_responses(self, version, generation, change):
        """Only application-recorded outcomes can authorise response cleanup.

        An imported association is retained as recovery data, never upgraded to
        application provenance. Legacy author/text/time guesses are forbidden.
        """
        reason = generation.get('response_limitations',{}).get(change['comment_id'])
        if generation.get('response_origin') != 'application' or version['run_id'] != generation['run_id']:
            reason = 'This saved change has no trusted response association (historical or imported data).'
        elif generation.get('response_version') != 2:
            reason = 'These historical response associations predate complete cumulative-region verification; cleanup is unavailable.'
        links = [link for link in generation.get('response_links',[]) if link['comment_id']==change['comment_id']]
        if reason or not links:
            raise StoreError(reason or 'The saved change has no exact associated response; use saved history for recovery.',409)
        return links

    def _section_geometry(self, state, comment, item, *, addressed=True):
        """Follow effective run ancestry, independently of cleanup permission.

        A full Restore clears the current generation and is a hard boundary.
        Earlier cumulative generations in the SAME run are not ancestors: a
        section revert restores that run's pre-run version, not an intermediate
        operation. Uncertain effective changes never fall through to old text.
        """
        generations = {g['id']:(v,g) for v in state['versions'] if v['item_id']==item['id']
                       for g in v.get('_section_provenance',[])}
        ident, seen, reverted = item.get('_section_generation'), set(), False
        unchanged = None
        if not ident:
            raise SectionUnavailable('A full-page Restore or missing generation prevents exact passage recovery.')
        while ident:
            if ident in seen or ident not in generations:
                raise SectionUnavailable('The effective passage history is incomplete or ambiguous.')
            seen.add(ident)
            version,generation = generations[ident]
            change = next((c for c in generation['changes'] if c['comment_id']==comment['id']),None)
            if change:
                if not change.get('reverted_at'):
                    try:
                        plan = plan_revert(change,generation['post_content'],item['content'],_plain,_content)
                    except SectionUnavailable:
                        # Historical revert receipts must retain their exact
                        # original mapping. Recover display geometry separately:
                        # a popular-word diff can falsely swallow unchanged
                        # paragraphs after a complete passage replacement.
                        recovered = capture_sections(version['snapshot']['content'],generation['post_content'],
                            generation['anchors'],_plain,exact_boundaries=True,precise=True).get(comment['id'])
                        if not recovered or recovered['status'] != 'available':
                            if not addressed:
                                raise
                            anchors = [paragraph_replacement_anchor(version['snapshot']['content'],generation['post_content'],
                                item['content'],generation['anchors'],comment['id'],_plain,_content)]
                        else:
                            plan = plan_revert(recovered,generation['post_content'],item['content'],_plain,_content,precise=True)
                            anchors = [plan['anchor']]
                    else:
                        anchors = addressed_anchors(change,plan,item['content'],_plain) if addressed else [plan['anchor']]
                    return {'anchor':anchors[0], **({'anchors':anchors} if len(anchors)>1 else {}),
                            'highlight_generation_id':generation['id'],'highlight_change_id':change['id']}
                reverted = True
            elif unchanged is None and generation.get('mapping_version') == 2 and comment['id'] in generation['anchors']:
                # A cumulative roundtrip can omit this passage from changes.
                # Prove that omission from validated before/post/anchor facts,
                # then map the exact saved selection through both documents.
                # Keep walking: an earlier effective change has a narrower
                # addressed highlight, and broken ancestry must still refuse.
                before,post = version['snapshot']['content'],generation['post_content']
                captured = capture_sections(before,post,generation['anchors'],_plain,exact_boundaries=True)
                if comment['id'] not in captured:
                    anchor = map_anchor(before,post,generation['anchors'][comment['id']],_plain,_content)
                    unchanged = {'anchor':map_anchor(post,item['content'],anchor,_plain,_content),
                                 'highlight_generation_id':generation['id'],'highlight_basis':'no_effect'}
            ident = version['snapshot'].get('_section_generation')
        if unchanged is not None:
            return unchanged
        if reverted:
            # Only verified reverted ancestry can return to the precise original
            # human selection. Never use this as a full-Restore/stale fallback.
            locate_anchor(_plain(item['content']),comment['anchor'])
            return {'anchor':copy.deepcopy(comment['anchor'])}
        raise SectionUnavailable('No independently exact effective passage remains in this history.')

    def _section_view(self, state, comment):
        if not comment['anchor']:
            return None
        item = self._item(state,comment['item_id'])
        for version in reversed(state['versions']):
            if version['item_id'] != item['id']:
                continue
            for generation in reversed(version.get('_section_provenance',[])):
                change = next((c for c in generation['changes'] if c['comment_id']==comment['id']),None)
                if change is None:
                    continue
                result = {'version_id':version['id'],'generation_id':generation['id'],'change_id':change['id'],
                          'run_id':generation['run_id'],'status':'available','highlight_status':'unavailable',
                          'requires_confirmation':item.get('_manual_revision',0)>generation['manual_revision']}
                if item['deleted_at'] is not None:
                    return dict(result,status='unavailable',reason='Restore the page from Trash before reviewing this section.')
                if item.get('_section_generation') != generation['id']:
                    result.update(status='unavailable',reason='A later agent change or full-page Restore superseded this section.')
                elif change.get('reverted_at'):
                    result['status'] = 'reverted'
                else:
                    try:
                        self._section_plan(generation,change,item)
                        self._section_responses(version,generation,change)
                    except StoreError as exc:
                        result.update(status='unavailable',reason=str(exc))
                try:
                    result.update(self._section_geometry(state,comment,item),highlight_status='available')
                    if result['status'] == 'unavailable' and result.get('highlight_basis') == 'no_effect':
                        result['reason'] = 'These recorded operations leave this passage unchanged; no eligible section change remains to revert.'
                except SectionUnavailable as exc:
                    result['highlight_reason'] = str(exc)
                return result
        return None

    def _capture_section_changes(self, state, run, item, old_content, operation_id, outcomes):
        version = next(v for v in state['versions'] if v['id'] in run['version_ids'] and v['item_id']==item['id'])
        before = version['snapshot']['content']
        anchors, anchor_limitations = {}, set()
        for comment in state['comments']:
            if comment['id'] not in run['comment_ids'] or comment['item_id'] != item['id'] or not comment['anchor']:
                continue
            anchor = comment['anchor']
            try:
                locate_anchor(_plain(before),anchor)
            except SectionUnavailable:
                # The immediately preceding run may have changed only another
                # passage. Follow the same effective ancestry, retaining the
                # COMPLETE saved region for operation association, not merely
                # the narrower addressed-word highlight.
                try:
                    anchor = self._section_geometry(state,comment,version['snapshot'],addressed=False)['anchor']
                except SectionUnavailable:
                    anchor_limitations.add(comment['id'])
            anchors[comment['id']] = copy.deepcopy(anchor)
        if not anchors and not item.get('_section_generation'):
            return
        try:
            captured = capture_sections(before,item['content'],anchors,_plain,exact_boundaries=True)
        except SectionUnavailable as exc:
            captured = {ident:{'status':'unavailable','reason':str(exc)} for ident in anchors}
        generation = {'id':_id(),'run_id':run['id'],'post_content':item['content'],
                      'manual_revision':item.get('_manual_revision',0),'anchors':anchors,'changes':[],
                      'mapping_version':2,'response_origin':'application','response_version':2,'response_links':[], 'response_limitations':{}}
        generation['changes'] = [dict(value,id=_id(),comment_id=ident,reverted_at=None) for ident,value in captured.items()]
        previous = version.get('_section_provenance',[])[-1:]
        previous = previous[0] if previous else None
        # The saved regions are cumulative from this run's pre-run version.
        # Associate NEW outcomes only where THIS operation actually changed the
        # corresponding region. A reply-only outcome for another comment stays.
        delta_anchors, uncertain = {}, set(anchor_limitations)
        for cid,anchor in anchors.items():
            prior = next((c for c in previous['changes'] if c['comment_id']==cid),None) if previous else None
            try:
                if prior:
                    # The complete saved region includes inserted boundary
                    # text/markup. Mapping the original selection again would
                    # lose later edits to those inserted prefixes or suffixes.
                    delta_anchors[cid] = plan_revert(prior,previous['post_content'],old_content,_plain,_content)['anchor']
                else:
                    delta_anchors[cid] = map_anchor(before,old_content,anchor,_plain,_content)
            except SectionUnavailable:
                uncertain.add(cid)  # Never reuse a stale original anchor.
        try:
            delta = capture_sections(old_content,item['content'],delta_anchors,_plain,exact_boundaries=True)
        except SectionUnavailable:
            delta = {}
            uncertain.update(anchors)
        for change in generation['changes']:
            cid = change['comment_id']
            prior = next((c for c in previous['changes'] if c['comment_id']==cid),None) if previous else None
            if prior:
                generation['response_links'].extend(copy.deepcopy([link for link in previous.get('response_links',[]) if link['comment_id']==cid]))
                if cid in previous.get('response_limitations',{}):
                    generation['response_limitations'][cid] = previous['response_limitations'][cid]
                if previous.get('response_version') != 2:
                    uncertain.add(cid)
            if cid in uncertain:
                generation['response_limitations'][cid] = 'The complete cumulative changed region cannot be mapped safely; response cleanup is unavailable.'
                continue
            actual = delta.get(cid)
            if actual and actual['status']=='available':
                ids = [r['reply_id'] for r in outcomes if r['comment_id']==cid]
                if ids:
                    generation['response_links'].append({'operation_id':operation_id,'comment_id':cid,'reply_ids':ids})
                else:
                    generation['response_limitations'][cid] = 'A changed section has no outcome in its actual edit operation; response cleanup cannot be verified.'
            elif not prior or actual:
                generation['response_limitations'][cid] = 'The operation cannot be associated with this section safely; response cleanup is unavailable.'
        version.setdefault('_section_provenance',[]).append(generation)
        item['_section_generation'] = generation['id']
        return generation['id']

    def _preview_section(self, state, payload):
        version,generation,change,item = self._section_ref(state,payload['version_id'],payload['generation_id'],payload['change_id'])
        plan = self._section_plan(generation,change,item)
        try:
            links = self._section_responses(version,generation,change)
            cleanup = {'cleanup_status':'verified','response_ids':[rid for link in links for rid in link['reply_ids']]}
        except StoreError as exc:
            cleanup = {'cleanup_status':'unavailable','cleanup_reason':str(exc),'response_ids':[]}
        return {'version_id':version['id'],'generation_id':generation['id'],'change_id':change['id'],'item_id':item['id'],
                **cleanup,
                'dataset_epoch':state['_section_epoch'],
                'content_hash':hashlib.sha256(item['content'].encode()).hexdigest(),'manual_revision':item.get('_manual_revision',0),
                'requires_confirmation':item.get('_manual_revision',0)>generation['manual_revision'],
                'anchor':plan['anchor'],'before_text':_plain(change['before']),'current_text':_plain(plan['current']),
                'before_html':change['before'],'current_html':plan['current']}

    def _revert_section(self, state, payload):
        preview = self._preview_section(state,payload)
        if payload['dataset_epoch'] != preview['dataset_epoch']:
            raise StoreError('Workspace was replaced after section review. Close and review the current section again.',409)
        if payload['content_hash'] != preview['content_hash'] or type(payload['manual_revision']) is not int or payload['manual_revision'] != preview['manual_revision']:
            raise StoreError('This page was edited after section review. Close and review the section again.',409)
        if type(payload['confirmed']) is not bool:
            raise StoreError('Section confirmation must be explicit.')
        if preview['requires_confirmation'] and not payload['confirmed']:
            raise StoreError('Manual edits followed the agent change. Confirm this exact section before reverting.',409)
        version,generation,change,item = self._section_ref(state,payload['version_id'],payload['generation_id'],payload['change_id'])
        plan = self._section_plan(generation,change,item)
        links = self._section_responses(version,generation,change)
        response_ids = [rid for link in links for rid in link['reply_ids']]
        comment = self._find(state,'comments',change['comment_id'])
        removed = [copy.deepcopy(r) for r in comment['replies'] if r['id'] in response_ids]
        if not comment.get('_deleted_at') and {r['id'] for r in removed} != set(response_ids):
            raise StoreError('Associated responses changed; review saved history before reverting.',409)
        checkpoint = {'id':_id(),'item_id':item['id'],'run_id':None,'snapshot':copy.deepcopy(item),'created_at':_now(),'section_revert_of':change['id']}
        checkpoint['section_revert_receipt'] = {'generation_id':generation['id'],'run_id':generation['run_id'],
            'operation_ids':[link['operation_id'] for link in links], 'removed_reply_ids':[r['id'] for r in removed],
            'cleanup_mode':'discussion_deleted' if comment.get('_deleted_at') else 'responses_archived'}
        checkpoint['_removed_responses'] = [{'comment_id':comment['id'],'reply':r} for r in removed]
        if item['kind']=='record':
            checkpoint['database_columns'] = copy.deepcopy(self._item(state,item['database_id'])['columns'])
        state['versions'].append(checkpoint)
        item['content'] = plan['content']
        comment['replies'] = [r for r in comment['replies'] if r['id'] not in response_ids]
        item['updated_at'] = _now()
        change['reverted_at'] = _now()
        return {'item_id':item['id'],'change_id':change['id'],'reverted':True,'recovery_version_id':checkpoint['id'],
                'removed_reply_ids':[r['id'] for r in removed]}

    def _set_columns(self, state, item, columns, token=None):
        if item['kind'] != 'database':
            raise StoreError('Only databases have columns')
        self._unlocked(state,[item['id']],token)
        clean = self._columns(state,columns)
        for column in clean:
            if column['type']=='relation' and self._item(state,column['target_database_id'])['deleted_at'] is not None and column not in item['columns']:
                raise StoreError('Cannot add a relation to a trashed database')
        item['columns'] = clean
        live_ids = {c['id'] for c in clean if c['type']!='formula'}
        for row in state['items']:
            if row['database_id'] == item['id']:
                if token is None and row.get('_section_generation'):
                    row['_manual_revision'] = row.get('_manual_revision',0)+1
                row['properties'] = {k:v for k,v in row['properties'].items() if k in live_ids}
                self._properties(state,row,row['properties'])
                row['updated_at'] = _now()
        item['updated_at'] = _now()
        return item

    def _reorder_item(self, state, payload):
        """Permute active navigation sibling slots, without touching item data.

        _save/_load and catalog retain this order through SQLite rowid. Records,
        Trash and every other parent's slots keep their exact relative order.
        This user operation grants no model edit authority and never reparents.
        """
        item = self._item(state, payload['id'], active=True)
        target = self._item(state, payload['target_id'], active=True)
        if item['kind'] == 'record' or target['kind'] == 'record':
            raise StoreError('Database records cannot be reordered in navigation')
        if item['parent_id'] != target['parent_id']:
            raise StoreError('Reorder within the same folder; use Move to change folders', 409)
        if item['id'] == target['id']:
            raise StoreError('Choose a different sibling as the reorder target')
        if not isinstance(payload['position'], str) or payload['position'] not in ('before', 'after'):
            raise StoreError('Reorder position must be before or after')
        self._parent(state, item['parent_id'])
        siblings = [row for row in state['items'] if row['kind'] != 'record'
                    and row['deleted_at'] is None and row['parent_id'] == item['parent_id']]
        ordered = [row for row in siblings if row['id'] != item['id']]
        index = next(i for i, row in enumerate(ordered) if row['id'] == target['id'])
        ordered.insert(index + (payload['position'] == 'after'), item)
        changed = [old['id'] for old, new in zip(siblings, ordered) if old['id'] != new['id']]
        self._unlocked(state, set(changed) | {item['id'], target['id']})
        ids = {row['id'] for row in siblings}
        replacement = iter(ordered)
        state['items'] = [next(replacement) if row['id'] in ids else row for row in state['items']]
        return {'id': item['id'], 'parent_id': item['parent_id'], 'sibling_ids': [row['id'] for row in ordered]}

    def execute(self, op: str, payload: dict, *, human_actor=None):
        _text(op,'operation',80)
        if not isinstance(payload,dict):
            raise StoreError('payload must be an object')
        payload = copy.deepcopy(payload)
        revision = payload.pop('expected_revision',None)
        if 'expected_scope' in payload:
            self.check_scope(payload.pop('expected_scope'))
        fields = {
            'set_username':({'name'},{'name'}),
            'create_item':({'kind','title','parent_id','database_id','content','properties'},{'kind','title'}),
            'update_item':({'id','patch'},{'id','patch'}), 'open_item':({'id'},{'id'}),
            'reorder_item':({'id','target_id','position'},{'id','target_id','position'}),
            'trash':({'id'},{'id'}), 'restore':({'id'},{'id'}), 'purge':({'id'},{'id'}),
            'add_comment':({'item_id','text','anchor','target_item_ids'},{'item_id','text'}),
            'reply_comment':({'id','text'},{'id','text'}),
            'resolve_comment':({'id','resolved'},{'id','resolved'}),
            'delete_comment':({'id'},{'id'}),
            'set_columns':({'id','columns'},{'id','columns'}), 'search':({'query'},{'query'}),
            'search_page':({'query','offset','limit'},{'query'}),
            'save_template':({'item_id','name'},{'item_id','name'}),
            'apply_template':({'template_id','title','parent_id','database_id'},{'template_id','title'}),
            'add_attachment':({'item_id','name','media_type','data_base64'},{'item_id','name','media_type','data_base64'}),
            'bind_thread':({'item_id','thread_id'},{'item_id','thread_id'}),
            'restore_version':({'id'},{'id'}),
            'preview_section_revert':({'version_id','generation_id','change_id'},{'version_id','generation_id','change_id'}),
            'revert_section':({'version_id','generation_id','change_id','content_hash','manual_revision','confirmed','dataset_epoch'},
                              {'version_id','generation_id','change_id','content_hash','manual_revision','confirmed','dataset_epoch'})}
        if op not in fields:
            raise StoreError('Unknown Workspace operation')
        _keys(payload,*fields[op])
        if op == 'reorder_item':
            if type(revision) is not int or revision < 0:
                raise StoreError('Navigation reordering requires the captured Workspace revision', 409)
            return self._transaction(lambda state:self._reorder_item(state,payload),revision,skip_unchanged=True)
        if op == 'search_page':
            return self.search_page(payload['query'],offset=payload.get('offset',0),limit=payload.get('limit',100),expected_revision=revision)
        if op == 'preview_section_revert':
            return self._transaction(lambda state:self._preview_section(state,payload),revision,skip_unchanged=True)
        if op == 'revert_section':
            return self._transaction(lambda state:self._revert_section(state,payload),revision)
        if op == 'search':
            query = _text(payload['query'],'query',500,empty=True).casefold().strip()
            snapshot = self.snapshot()
            if revision is not None and (type(revision) is not int or snapshot['revision'] != revision):
                raise StoreError('Workspace revision changed; reload before searching',409)
            if not query:
                return []
            return [item for item in snapshot['items'] if item['deleted_at'] is None and item['kind'] != 'folder' and query in (item['title'] + ' ' + _plain(item['content']) + ' ' + ' '.join(v for v in item['properties'].values() if isinstance(v,str))).casefold()][:200]

        def action(state):
            if op == 'set_username':
                from .identity import username
                if type(revision) is not int:
                    raise StoreError('Username changes require the captured Workspace revision',409)
                actor = self._human(state,human_actor)
                if actor is None:
                    raise StoreError('An admitted human author is required',403)
                try:
                    name = username(payload['name'])
                except ValueError as exc:
                    raise StoreError(str(exc)) from exc
                self._stamp_legacy(state)
                state['_identity_names'][actor['id']] = name
                # Persist display snapshots too, so canonical backups retain
                # attribution without exporting local preference/authority data.
                for comment in state['comments']:
                    for entry in [comment,*comment['replies']]:
                        identity = entry.get('author_identity')
                        if identity and identity['kind']=='human' and identity['id']==actor['id']:
                            identity['name'] = name
                return {**actor,'name':name}
            if op == 'create_item':
                return self._create(state,payload)
            if op in ('update_item','open_item','trash','restore','purge','set_columns'):
                item = self._item(state,payload['id'],active=op in ('update_item','open_item','set_columns'))
                if op == 'open_item':
                    if item['kind']=='folder':
                        raise StoreError('Only Workspace documents enter recents')
                    state['recents'] = [x for x in state['recents'] if x['item_id'] != item['id']]
                    state['recents'].insert(0,{'item_id':item['id'],'opened_at':_now()})
                    state['recents'] = state['recents'][:100]
                    return item
                if op == 'update_item':
                    return self._patch(state,item,payload['patch'])
                if op == 'set_columns':
                    return self._set_columns(state,item,payload['columns'])
                self._unlocked(state,[item['id']])
                ids = self._descendants(state,[item['id']])
                if op == 'trash':
                    if item['deleted_at'] is not None:
                        raise StoreError('Item is already in Trash',409)
                    now = _now()
                    for child in state['items']:
                        if child['id'] in ids and child['deleted_at'] is None:
                            child.update(deleted_at=now,updated_at=now,_trash_root=item['id'])
                    state['recents'] = [x for x in state['recents'] if x['item_id'] not in ids]
                    return item
                if item['deleted_at'] is None:
                    raise StoreError('Item is not in Trash',409)
                if op == 'restore':
                    parent = item['parent_id'] or item['database_id']
                    if parent is not None and self._item(state,parent)['deleted_at'] is not None:
                        raise StoreError('Restore the parent folder/database first',409)
                    group = item.get('_trash_root',item['id'])
                    for child in state['items']:
                        if child['id'] in ids and child.get('_trash_root',child['id']) == group:
                            child.update(deleted_at=None,updated_at=_now())
                            child.pop('_trash_root',None)
                    return item
                return self._purge(state,ids)
            if op == 'add_comment':
                item = self._item(state,payload['item_id'],active=True)
                if item['kind']=='folder':
                    raise StoreError('Folders do not accept document comments')
                self._unlocked(state,[item['id']])
                if len(state['comments']) >= MAX_COMMENTS:
                    raise StoreError('Comment limit exceeded')
                anchor = self._anchor(payload.get('anchor'))
                if item['kind']=='database' and anchor is not None:
                    raise StoreError('Databases accept whole-database comments only')
                targets = self._targets(state,payload.get('target_item_ids',[]),active=True)
                comment = {'id':_id(),'item_id':item['id'],'text':_text(payload['text'],'comment'),'anchor':anchor,'resolved':False,'replies':[],'created_at':_now(),'target_item_ids':targets,'author_identity':self._human(state,human_actor)}
                if self.shared and comment['author_identity'] is None:
                    raise StoreError('An admitted human author is required',403)
                state['comments'].append(comment)
                return comment
            if op in ('reply_comment','resolve_comment','delete_comment'):
                comment = self._find(state,'comments',payload['id'])
                if comment.get('_deleted_at'):
                    raise StoreError('Comment was deleted; reload the discussion',404)
                self._item(state,comment['item_id'],active=True)
                self._unlocked(state,[comment['item_id']])
                if op == 'delete_comment':
                    # Keep stable provenance IDs/anchors for section recovery and
                    # historic run receipts. Feedback and replies are removed.
                    # This is never resolution or an implicit document revert.
                    comment.update(text='[Deleted comment]',replies=[],_deleted_at=_now())
                    return {'id':comment['id'],'item_id':comment['item_id'],'deleted':True}
                if op == 'reply_comment':
                    self._reply(comment,payload['text'],'user',self._human(state,human_actor))
                else:
                    if type(payload['resolved']) is not bool:
                        raise StoreError('resolved must be a boolean')
                    comment['resolved'] = payload['resolved']
                return comment
            if op == 'add_attachment':
                result = self._attachment(state,payload)
                item = self._item(state,payload['item_id'],active=True)
                if item.get('_section_generation'):
                    item['_manual_revision'] = item.get('_manual_revision',0)+1
                return result
            if op == 'bind_thread':
                item = self._item(state,payload['item_id'],active=True)
                self._unlocked(state,[item['id']])
                if item['kind']=='folder':
                    raise StoreError('Folders cannot bind a native thread')
                item['thread_id'] = _identifier(payload['thread_id'],'thread_id') if payload['thread_id'] is not None else None
                item['updated_at'] = _now()
                return item
            if op == 'save_template':
                item = self._item(state,payload['item_id'],active=True)
                self._unlocked(state,[item['id']])
                if item['kind'] not in ('page','record'):
                    raise StoreError('Templates are reusable pages or record documents')
                if len(state['templates']) >= 500:
                    raise StoreError('Template limit exceeded')
                template = {'id':_id(),'name':_text(payload['name'],'template name',500),'kind':item['kind'],'content':item['content'],'properties':copy.deepcopy(item['properties']),'columns':copy.deepcopy(self._item(state,item['database_id'])['columns']) if item['kind']=='record' else [],'created_at':_now()}
                refs = self._attachment_refs(item['content'])
                assets = [{k:copy.deepcopy(v) for k,v in a.items() if k!='item_id'} for a in state['attachments'] if a['item_id']==item['id'] or a['id'] in refs]
                if assets:
                    template['attachments'] = assets
                state['templates'].append(template)
                return template
            if op == 'apply_template':
                template = self._find(state,'templates',payload['template_id'])
                data = {k:v for k,v in payload.items() if k != 'template_id'}
                data.update(kind=template['kind'],content=template['content'],properties=copy.deepcopy(template['properties']))
                if template['kind']=='record':
                    db = self._item(state,data.get('database_id'),active=True)
                    if db['columns'] != template['columns']:
                        raise StoreError('Record template requires compatible database columns')
                item = self._create(state,data)
                for asset in template.get('attachments',[]):
                    new = self._attachment(state,dict({k:v for k,v in asset.items() if k!='id'},item_id=item['id']))
                    item['content'] = self._replace_attachment(item['content'],asset['id'],new['id'])
                return item
            version = self._find(state,'versions',payload['id'])
            item = self._item(state,version['item_id'],active=True)
            saved = version['snapshot']
            versions = [version]
            if item['kind']=='record' and self._item(state,item['database_id'])['columns'] != version['database_columns']:
                group = version.get('restore_group_id') or version['run_id']
                database_version = next((v for v in state['versions'] if group is not None and v['item_id']==item['database_id'] and (v.get('restore_group_id') or v['run_id'])==group),None)
                if database_version is None:
                    raise StoreError('Historical record schema differs; restore compatible database schema first',409)
                version = database_version
                item = self._item(state,version['item_id'],active=True)
                versions = [version]
            if item['kind']=='database':
                group = version.get('restore_group_id') or version['run_id']
                if group is not None:
                    versions += [v for v in state['versions'] if v['snapshot']['kind']=='record'
                                 and v['snapshot']['database_id']==item['id']
                                 and (v.get('restore_group_id') or v['run_id'])==group]
            self._unlocked(state,[v['item_id'] for v in versions])
            captured_ids = {v['item_id'] for v in versions}
            old_columns = copy.deepcopy(item['columns']) if item['kind']=='database' else []
            later_rows = [row for row in state['items'] if item['kind']=='database'
                          and row['database_id']==item['id'] and row['id'] not in captured_ids]
            for old in versions:
                target = self._item(state,old['item_id'],active=True)
                previous = old['snapshot']
                for key in ('title','content','properties','columns'):
                    target[key] = copy.deepcopy(previous[key])
                if target.get('_section_generation'):
                    target['_section_generation'] = None
                    target['_manual_revision'] = target.get('_manual_revision',0)+1
                target['updated_at'] = _now()
            by_id = {c['id']:c for c in old_columns}
            for row in later_rows:
                compatible, retained = {}, []
                for key,value in row['properties'].items():
                    try:
                        self._properties(state,row,{key:value})
                    except StoreError:
                        retained.append({'column':copy.deepcopy(by_id[key]),'value':copy.deepcopy(value)})
                    else:
                        compatible[key] = value
                if retained:
                    recovered = html.escape(json.dumps(retained,ensure_ascii=False,allow_nan=False,indent=2),quote=False)
                    row['content'] = _content(row['content']+'<blockquote><p>Recovered properties after schema Restore (retained from the later row)</p><pre><code>'+recovered+'</code></pre></blockquote>')
                row['properties'] = compatible
                row['updated_at'] = _now()
            return item
        return self._transaction(action,revision)

    def _targets(self, state, targets, active=False):
        if not isinstance(targets,list) or len(targets)>MAX_ITEMS or not all(isinstance(x,str) for x in targets) or len(set(targets))!=len(targets):
            raise StoreError('target_item_ids must be a unique bounded array of item IDs')
        for ident in targets:
            target = self._item(state,ident,active=active)
            if target['kind']=='folder':
                raise StoreError('Scope references require a page, database or record')
        return copy.deepcopy(targets)

    def _anchor(self, anchor):
        if anchor is None:
            return None
        _keys(anchor,{'quote','prefix','suffix'},{'quote','prefix','suffix'})
        return {key:_text(anchor[key], 'anchor '+key, 2000,empty=key!='quote') for key in ('quote','prefix','suffix')}

    def _reply(self, comment, text, author, identity=None):
        if comment.get('_deleted_at'):
            raise StoreError('Comment was deleted; replies cannot be restored',409)
        if len(comment['replies']) >= 1000:
            raise StoreError('Comment reply limit exceeded')
        if author=='user' and self.shared and identity is None:
            raise StoreError('An admitted human author is required',403)
        reply = {'id':_id(),'author':author,'text':_text(text,'reply'),'created_at':_now(),'author_identity':copy.deepcopy(identity)}
        comment['replies'].append(reply)
        return reply

    def _attachment(self, state, payload):
        item = self._item(state,payload['item_id'],active=True)
        self._unlocked(state,[item['id']])
        name = _text(payload['name'],'attachment name',255)
        if name in ('.','..') or '/' in name or '\\' in name or any(ord(c)<32 for c in name):
            raise StoreError('Attachment name must be a filename, not a path')
        media_type = _text(payload['media_type'],'media_type',200)
        if not re.fullmatch(r'[\w.+-]+/[\w.+-]+',media_type):
            raise StoreError('Invalid attachment media type')
        value = payload['data_base64']
        if not isinstance(value,str) or len(value) > (MAX_ATTACHMENT + 2)//3*4:
            raise StoreError('Attachment exceeds size limit')
        try:
            raw = base64.b64decode(value,validate=True)
        except (ValueError,TypeError) as exc:
            raise StoreError('Invalid attachment base64') from exc
        if len(raw) > MAX_ATTACHMENT:
            raise StoreError('Attachment exceeds size limit')
        attachment = {'id':_id(),'item_id':item['id'],'name':name,'media_type':media_type,'data_base64':base64.b64encode(raw).decode('ascii')}
        if len(state['attachments']) >= 1000:
            raise StoreError('Attachment count limit exceeded')
        state['attachments'].append(attachment)
        return attachment

    def _purge(self, state, ids):
        affected = set(ids)
        removed_columns = {}
        orphan_assets = [a for a in state['attachments'] if a['item_id'] in ids]
        for asset in orphan_assets:
            for item in state['items']:
                if item['id'] not in ids and (asset['id'] in self._attachment_refs(item['content']) or any(v['item_id']==item['id'] and asset['id'] in self._attachment_refs(v['snapshot']['content']) for v in state['versions'])):
                    affected.add(item['id'])
        for item in state['items']:
            if item['kind']=='database' and item['id'] not in ids:
                remove = {c['id'] for c in item['columns'] if c['type']=='relation' and c['target_database_id'] in ids}
                # Dependent formulas must go with the removed relation schema.
                changed = True
                while changed:
                    changed = False
                    refs = {ref for c in item['columns'] if c['id'] in remove for ref in (c['id'],c['name'])}
                    for column in item['columns']:
                        if column['type']=='formula' and column['id'] not in remove and dependencies(column['formula']) & refs:
                            remove.add(column['id'])
                            changed = True
                if remove:
                    removed_columns[item['id']] = remove
                    affected.add(item['id'])
            if item['kind']=='record' and item['id'] not in ids:
                db = self._item(state,item['database_id'])
                for col in db['columns']:
                    if col['type']=='relation' and set(item['properties'].get(col['id']) or []) & ids:
                        affected.add(item['id'])
        self._unlocked(state,affected)
        for asset in orphan_assets:
            for item in state['items']:
                if item['id'] in ids:
                    continue
                docs = [item] + [v['snapshot'] for v in state['versions'] if v['item_id']==item['id']]
                if any(asset['id'] in self._attachment_refs(d['content']) for d in docs):
                    new = dict(copy.deepcopy(asset),id=_id(),item_id=item['id'])
                    state['attachments'].append(new)
                    for document in docs:
                        document['content'] = self._replace_attachment(document['content'],asset['id'],new['id'])
                    item['updated_at'] = _now()
        for item in state['items']:
            if item['id'] in removed_columns:
                item['columns'] = [c for c in item['columns'] if c['id'] not in removed_columns[item['id']]]
                item['updated_at'] = _now()
            if item['kind']=='record' and item['id'] not in ids:
                removed = removed_columns.get(item['database_id'],set())
                item['properties'] = {k:v for k,v in item['properties'].items() if k not in removed}
                for col in self._item(state,item['database_id'])['columns']:
                    value = item['properties'].get(col['id'])
                    if col['type']=='relation' and value is not None:
                        item['properties'][col['id']] = [x for x in value if x not in ids]
        state['items'] = [x for x in state['items'] if x['id'] not in ids]
        for key in ('comments','versions','attachments','recents'):
            state[key] = [x for x in state[key] if x['item_id'] not in ids]
        for comment in state['comments']:
            if 'target_item_ids' in comment:
                comment['target_item_ids'] = [x for x in comment['target_item_ids'] if x not in ids]
        surviving_comments = {x['id'] for x in state['comments']}
        surviving_versions = {x['id'] for x in state['versions']}
        surviving_generations = {g['id'] for v in state['versions'] for g in v.get('_section_provenance',[])}
        state['runs'] = [x for x in state['runs'] if x['item_id'] not in ids]
        for run in state['runs']:
            run['allowed_item_ids'] = [x for x in run['allowed_item_ids'] if x not in ids]
            run['version_ids'] = [x for x in run['version_ids'] if x in surviving_versions]
            run['comment_ids'] = [x for x in run['comment_ids'] if x in surviving_comments]
            for receipt in run.get('operation_receipts',[]):
                receipt['comment_ids'] = [x for x in receipt['comment_ids'] if x in surviving_comments]
                if '_outcomes' in receipt:
                    receipt['_outcomes'] = [x for x in receipt['_outcomes'] if x['comment_id'] in surviving_comments]
                    receipt['_generation_ids'] = [x for x in receipt['_generation_ids'] if x in surviving_generations]
        # Only purge references to the deleted objects; unrelated history stays
        # byte-for-byte meaningful even when the live schema has since changed.
        def prune_columns(columns):
            remove = {c['id'] for c in columns if c['type']=='relation' and c['target_database_id'] in ids}
            while True:
                refs = {ref for c in columns if c['id'] in remove for ref in (c['id'],c['name'])}
                added = {c['id'] for c in columns if c['type']=='formula' and dependencies(c['formula']) & refs} - remove
                if not added:
                    break
                remove.update(added)
            return [c for c in columns if c['id'] not in remove]
        def prune_props(properties, columns):
            allowed = {c['id']:c for c in columns if c['type']!='formula'}
            return {k:([v for v in value if v not in ids] if allowed[k]['type']=='relation' and value is not None else value)
                    for k,value in properties.items() if k in allowed}
        for version in state['versions']:
            saved = version['snapshot']
            if saved['kind']=='record':
                version['database_columns'] = prune_columns(version['database_columns'])
                saved['properties'] = prune_props(saved['properties'],version['database_columns'])
            if saved['kind']=='database':
                saved['columns'] = prune_columns(saved['columns'])
        for template in state['templates']:
            template['columns'] = prune_columns(template['columns'])
            template['properties'] = prune_props(template['properties'],template['columns'])
        return {'purged_ids':sorted(ids)}

    def remember_executor(self, item_id, binding, *, expected_revision, validate=None):
        """Trusted composition seam, not an HTTP/model grant or native start.

        A deployment must supply the actual authenticated native validator. The
        saved selection is data; Workflow refuses to infer execution authority.
        """
        from .shared_workspaces import validate_executor
        binding = validate_executor(binding)
        if type(expected_revision) is not int or expected_revision < 0 or not callable(validate):
            raise StoreError('A captured revision and supported native executor validator are required',409)
        def authorize():
            if validate(copy.deepcopy(binding)) != binding:
                raise StoreError('Native executor source/thread no longer matches the captured selection',409)
        def action(state):
            item = self._item(state,item_id,active=True)
            if item['kind']=='folder':
                raise StoreError('Choose an editable document for the page executor')
            self._unlocked(state,[item_id])
            item.update(executor=copy.deepcopy(binding),thread_id=binding['thread_id'])
            return item
        return self._transaction(action,expected_revision,authorize=authorize)

    def _run_review(self, state, item_id, selected_ids):
        item = self._item(state,item_id,active=True)
        if item['kind']=='folder':
            raise StoreError('Runs require a document or database')
        if item.get('executor') or item.get('thread_owner'):
            raise StoreError('A qualified native source binding is required before reviewing this executor',409)
        selected = self._targets(state,selected_ids,active=True)
        comments = [c for c in state['comments'] if c['item_id']==item_id and not c['resolved'] and not c.get('_deleted_at')]
        if not comments:
            raise StoreError('No unresolved comments to address',409)
        self._unlocked(state,self._descendants(state,{item_id}|set(selected)))
        return {'scope_id':self.scope_id,'revision':state['revision'],'item_id':item_id,
                'selected_item_ids':sorted(selected),'comment_ids':[c['id'] for c in comments],
                'comment_signature':hashlib.sha256(_json(comments).encode()).hexdigest()}

    def review_run_scope(self, item_id, selected_ids, *, expected_revision):
        """Read-only review data for an authenticated ordinary user composition.

        This does not change comment references, bind a native thread, grant an
        agent anything or lock documents. Workflow owns the one-use review ID.
        """
        if type(expected_revision) is not int or expected_revision<0:
            raise StoreError('Capture the current Workspace revision before run review',409)
        return self._transaction(lambda state:self._run_review(state,item_id,selected_ids),
                                 expected_revision,skip_unchanged=True)

    def begin_run(self, item_id, session_id, explicit_item_ids=None, *, scope_review=None, executor_identity=None):
        if scope_review is not None and not callable(scope_review):
            raise StoreError('Run review must be an implementation-owned validator',403)
        from .identity import validate
        validate(executor_identity,'agent')
        executor_identity = copy.deepcopy(executor_identity)
        explicit_item_ids = [] if explicit_item_ids is None else explicit_item_ids
        if not isinstance(explicit_item_ids,list) or len(explicit_item_ids)>MAX_ITEMS or not all(isinstance(x,str) for x in explicit_item_ids):
            raise StoreError('explicit_item_ids must be an array of Workspace IDs')
        explicit_item_ids = list(explicit_item_ids)
        session_id = _identifier(session_id,'session_id')
        def action(state):
            item = self._item(state,item_id,active=True)
            if item['kind']=='folder':
                raise StoreError('Runs require a document or database')
            if item['thread_id'] is not None and item['thread_id'] != session_id:
                raise StoreError('Native session does not match the bound thread',409)
            comments = [c for c in state['comments'] if c['item_id']==item_id and not c['resolved'] and not c.get('_deleted_at')]
            if not comments:
                raise StoreError('No unresolved comments to address',409)
            referenced = {target for comment in comments for target in comment.get('target_item_ids',[])}
            selected = set(self._targets(state,explicit_item_ids,active=True))
            if scope_review is not None:
                # Callback checks the authenticated principal, expiry and one-use
                # journal state AFTER the Store writer wait. Store independently
                # binds that record to the complete current saved selection.
                reviewed = scope_review()
                if reviewed != self._run_review(state,item_id,explicit_item_ids):
                    raise StoreError('Run review is stale or differs from the exact selected items; review again',409)
            elif not selected <= referenced:
                raise StoreError('Run targets require fresh user approval of unresolved comment references',403)
            allowed = {item_id} | selected
            # A database grant includes its own row documents and properties.
            allowed = self._descendants(state,allowed)
            self._unlocked(state,allowed)
            now = _now()
            run = {'id':_id(),'item_id':item_id,'session_id':session_id,'status':'running','comment_ids':[c['id'] for c in comments], 'allowed_item_ids':[x['id'] for x in state['items'] if x['id'] in allowed], 'version_ids':[], 'progress':'Prepared; awaiting native admission','error':None,'created_at':now,'updated_at':now,'_owner_pid':os.getpid(),'_owner_identity':_process_identity()}
            run['_executor_identity'] = executor_identity
            for scoped_id in run['allowed_item_ids']:
                scoped = self._item(state,scoped_id)
                version = {'id':_id(),'item_id':scoped_id,'run_id':run['id'],'snapshot':copy.deepcopy(scoped),'created_at':now,'restore_group_id':run['id']}
                if scoped['kind']=='record':
                    version['database_columns'] = copy.deepcopy(self._item(state,scoped['database_id'])['columns'])
                state['versions'].append(version)
                run['version_ids'].append(version['id'])
                state['_locks'][scoped_id] = run['id']
            item['thread_id'] = session_id
            state['runs'].append(run)
            return run
        return self._transaction(action)

    def apply_run(self, run_id, edits, replies, authorize=None, operation_id=None, operation_digest=None):
        if authorize is not None and not callable(authorize):
            raise StoreError('authorize must be an implementation-provided callable')
        if not isinstance(edits,list) or not isinstance(replies,list) or len(edits)>100 or len(replies)>MAX_COMMENTS:
            raise StoreError('Run edits and replies must be bounded arrays')
        try:
            edits,replies = copy.deepcopy((edits,replies))
            digest = hashlib.sha256(json.dumps([edits,replies],sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf-8')).hexdigest()
        except (TypeError,ValueError,RecursionError) as exc:
            raise StoreError('Run operation must be finite JSON') from exc
        if (operation_id is None)!=(operation_digest is None):
            raise StoreError('operation_id and operation_digest must be supplied together')
        if operation_id is None:
            operation_id = operation_digest = digest
        if operation_id!=digest or operation_digest!=digest:
            raise StoreError('Run operation identity does not match its payload digest',409)
        def action(state):
            run = self._find(state,'runs',run_id)
            if run['status'] not in ACTIVE:
                raise StoreError('Run is no longer active',409)
            for ident in run['allowed_item_ids']:
                if state['_locks'].get(ident) != run_id:
                    raise StoreError('Run lock has been revoked',409)
            # Scope and shape are checked on retries too. A receipt never grants
            # access or revives a terminal/revoked run.
            for edit in edits:
                _keys(edit,{'item_id','patch'},{'item_id','patch'})
                if edit['item_id'] not in run['allowed_item_ids']:
                    raise StoreError('Item is outside the captured run scope',403)
                _keys(edit['patch'],{'content','content_edits','properties','columns','title'})
                if 'content_edits' in edit['patch']:
                    from .targeted_edits import validate_content_edits
                    if 'content' in edit['patch']:
                        raise StoreError('Choose targeted edits or full content, never both')
                    if sum(isinstance(other,dict) and other.get('item_id')==edit['item_id'] for other in edits)!=1:
                        raise StoreError('Combine each document targeted edit into one revision-bound patch')
                    validate_content_edits(edit['patch']['content_edits'],MAX_CONTENT)
            for reply in replies:
                _keys(reply,{'comment_id','text'},{'comment_id','text'})
                if reply['comment_id'] not in run['comment_ids']:
                    raise StoreError('Comment is outside the captured run scope',403)
                if self._find(state,'comments',reply['comment_id']).get('_deleted_at'):
                    raise StoreError('Comment was deleted; late run replies are refused',409)
            receipts = run.get('operation_receipts',[])
            previous = next((r for r in receipts if r['operation_id']==operation_id),None)
            if previous is not None:
                if previous['operation_digest']!=digest:
                    raise StoreError('Operation receipt conflict',409)
                return run
            if len(receipts)>=10000:
                raise StoreError('Run operation receipt limit exceeded')
            # Resolve every compact patch against its exact original revision
            # before mutating any item. Native authority, locks and operation
            # receipts above remain unchanged, including idempotent retries.
            resolved = copy.deepcopy(edits)
            for edit in resolved:
                spec = edit['patch'].pop('content_edits',None)
                if spec is not None:
                    from .targeted_edits import resolve_content_edits, TargetedEditConflict
                    try:
                        edit['patch']['content'] = resolve_content_edits(self._item(state,edit['item_id']),spec,_content,MAX_CONTENT)
                    except TargetedEditConflict as exc:
                        raise StoreError(str(exc),409) from exc
            before_content = {edit['item_id']:self._item(state,edit['item_id'])['content'] for edit in resolved if 'content' in edit['patch']}
            for edit in resolved:
                self._patch(state,self._item(state,edit['item_id'],active=True),edit['patch'],run_id)
            outcomes = []
            for reply in replies:
                saved_reply = self._reply(self._find(state,'comments',reply['comment_id']),reply['text'],'agent',run.get('_executor_identity'))
                outcomes.append({'comment_id':reply['comment_id'],'reply_id':saved_reply['id']})
            generation_ids = []
            for ident,old_content in before_content.items():
                changed = self._item(state,ident)
                if changed['content'] != old_content:
                    generation_id = self._capture_section_changes(state,run,changed,old_content,operation_id,outcomes)
                    if generation_id:
                        generation_ids.append(generation_id)
            run['progress'] = 'Saved Workspace edits and comment outcomes'
            run['updated_at'] = _now()
            run['operation_receipts'] = receipts + [{'operation_id':operation_id,'operation_digest':digest,'comment_ids':list(dict.fromkeys(r['comment_id'] for r in replies)),
                '_outcomes':outcomes,'_generation_ids':generation_ids}]
            return run
        return self._transaction(action,authorize=authorize,skip_unchanged=True)

    def set_run_progress(self, run_id, progress):
        """Persist trusted native lifecycle observations; no JSON command surface.

        An identical active-run observation is a true no-op (including revision).
        Callers must supply actual receipt/Stop state, never fabricated progress.
        """
        progress = _text(progress,'run progress',MAX_TEXT)
        def action(state):
            run = self._find(state,'runs',run_id)
            if run['status'] not in ACTIVE:
                raise StoreError('Cannot update progress of a terminal run',409)
            if run['progress'] != progress:
                run.update(progress=progress,updated_at=_now())
            return run
        return self._transaction(action,skip_unchanged=True)

    def finish_run(self, run_id, status, error=None):
        if status not in TERMINAL:
            raise StoreError('Invalid terminal run status')
        if error is not None:
            _text(error,'run error',MAX_TEXT)
        def action(state):
            run = self._find(state,'runs',run_id)
            if run['status'] not in ACTIVE:
                if run['status']==status:
                    return run
                raise StoreError('Run already has a terminal status',409)
            # Native completion alone does not establish processed comments.
            if status == 'completed':
                for ident in run['comment_ids']:
                    comment = self._find(state,'comments',ident)
                    if not any(r['author']=='agent' and r['created_at']>=run['created_at'] for r in comment['replies']):
                        raise StoreError('Cannot complete: a captured comment has no saved agent outcome',409)
            run.update(status=status,error=error,progress={'completed':'Completed with saved comment outcomes','cancelled':'Stopped; saved partial changes retained','error':'Failed; saved partial changes retained'}[status],updated_at=_now())
            state['_locks'] = {ident:owner for ident,owner in state['_locks'].items() if owner!=run_id}
            return run
        return self._transaction(action)

    def recover_runs(self):
        """Explicit startup-only recovery for provably dead/reused process owners.

        Does not guess native session/admission outcome. A still-live owner (even
        another Store instance) retains its locks. Workflow may additionally use
        finish_run(..., 'error', ...) after authoritative native reconciliation.
        """
        def action(state):
            recovered = []
            for run in state['runs']:
                if run['status'] not in ACTIVE:
                    continue
                pid = run.get('_owner_pid')
                if type(pid) is not int:
                    continue  # Unknown owner is not evidence of interruption.
                current = _process_identity(pid)
                previous = run.get('_owner_identity')
                if current is not None and (current==previous or current.startswith('pid:')):
                    continue
                run.update(status='error',error='Interrupted: Workspace owner process exited; native outcome unknown',progress='Interrupted; saved partial changes and pre-run version retained',updated_at=_now())
                state['_locks'] = {ident:owner for ident,owner in state['_locks'].items() if owner!=run['id']}
                recovered.append(run)
            return recovered
        return self._transaction(action)

    def import_document(self, document, parent_id=None, expected_revision=None):
        _keys(document,{'title','content','original'},{'title','content'})
        def action(state):
            item = self._create(state,{'kind':'page','title':document['title'],'content':document['content'],'parent_id':parent_id})
            if document.get('original') is not None:
                _keys(document['original'],{'name','media_type','data_base64'},{'name','media_type','data_base64'})
                self._attachment(state,dict(document['original'],item_id=item['id']))
            return item
        return self._transaction(action,expected_revision)

    def import_table(self, table, parent_id=None, expected_revision=None):
        _keys(table,{'title','columns','rows'},{'title','columns','rows'})
        if not isinstance(table['rows'],list) or len(table['rows'])>MAX_ITEMS-1:
            raise StoreError('Imported rows must be a bounded array')
        def action(state):
            db = self._create(state,{'kind':'database','title':table['title'],'parent_id':parent_id})
            self._set_columns(state,db,table['columns'])
            for index,row in enumerate(table['rows']):
                # CSV adapter supplies property objects, no implicit type guessing.
                self._create(state,{'kind':'record','title':f'Row {index+1}','database_id':db['id'],'properties':row})
            return db
        return self._transaction(action,expected_revision)

    def restore_snapshot(self, snapshot, expected_revision=None):
        if not isinstance(snapshot,dict) or set(snapshot)-set(CATEGORIES)-{'revision','scope_id','identity'} or set(CATEGORIES)-set(snapshot):
            raise StoreError('Backup must contain the complete v1 snapshot arrays')
        if len(_json({k:v for k,v in snapshot.items() if k!='scope_id'}).encode())>MAX_STATE:
            raise StoreError('Backup exceeds Workspace storage limit')
        if type(snapshot.get('revision')) is not int or snapshot['revision']<0:
            raise StoreError('Backup revision must be a nonnegative integer')
        restored = copy.deepcopy(snapshot)
        restored.pop('scope_id',None)
        restored.pop('identity',None)
        restored['revision'] = 0
        restored['_locks'] = {}
        if isinstance(restored.get('recents'),list):
            restored['recents'] = [{'item_id':x,'opened_at':_now()} if isinstance(x,str) else x for x in restored['recents']]
        # Validate supplied run structure before detaching it; arbitrary extra
        # fields are not an alternate import channel into trusted metadata.
        try:
            self._validate_state(restored, imported=True)
        except (TypeError,KeyError,OverflowError,RecursionError) as exc:
            raise StoreError('Invalid backup data shape') from exc
        restored['runs'] = []
        for comment in restored['comments']:
            for entry in [comment,*comment['replies']]:
                # Backup identities are inert attribution, never an asset grant
                # or evidence that an unknown legacy author is this owner.
                entry.setdefault('author_identity',None)
                if entry['author_identity'] and entry['author_identity']['kind']=='agent':
                    entry['author_identity']['avatar_eligible'] = False
        for item in restored['items']:
            item['thread_id'] = None
            item.pop('executor',None)
            item.pop('thread_owner',None)
            item.pop('_trash_root',None)
            if item['deleted_at'] is not None:
                # Preserve nested Trash restore grouping for exported snapshots.
                root = item
                seen = set()
                while (root['parent_id'] or root['database_id']) is not None:
                    parent = self._item(restored,root['parent_id'] or root['database_id'])
                    if parent['deleted_at'] != item['deleted_at'] or parent['id'] in seen:
                        break
                    seen.add(parent['id'])
                    root = parent
                item['_trash_root'] = root['id']
        for version in restored['versions']:
            version['run_id'] = None
            version['snapshot']['thread_id'] = None
            version['snapshot'].pop('executor',None)
            version['snapshot'].pop('thread_owner',None)
        def action(state):
            if state['_locks'] or any(run['status'] in ACTIVE for run in state['runs']):
                raise StoreError('Stop all active Workspace runs before restoring a backup',409)
            revision = state['revision']
            names = state.get('_identity_names',{})
            state.clear()
            state.update(copy.deepcopy(restored),revision=revision,_section_epoch=_id(),_identity_names=names)
            return {'restored':True,'item_count':len(state['items']),'scope_id':self.scope_id}
        return self._transaction(action,expected_revision)

    def _validate_state(self, state, imported=False):
        """Validate every reference before committing or replacing any data."""
        limits = {'items':MAX_ITEMS,'comments':MAX_COMMENTS,'versions':20000,'attachments':1000,'runs':10000,'recents':100,'templates':500}
        for category in CATEGORIES:
            values = state.get(category)
            if not isinstance(values,list) or len(values)>limits[category] or not all(isinstance(x,dict) for x in values):
                raise StoreError('Invalid or oversized '+category+' array')
            ids = []
            for value in values:
                ids.append(_identifier(value.get('item_id') if category=='recents' else value.get('id')))
            if len(set(ids)) != len(ids):
                raise StoreError('Duplicate IDs in '+category)
        items = {x['id']:x for x in state['items']}

        def timestamp(value, nullable=False):
            if nullable and value is None:
                return
            _text(value,'timestamp',80)
            try:
                parsed = datetime.fromisoformat(value)
                if parsed.tzinfo is None:
                    raise ValueError()
                return parsed.astimezone(timezone.utc)
            except (ValueError,OverflowError) as exc:
                raise StoreError('Timestamps must be ISO dates with timezone') from exc

        def item_shape(item, historical=False):
            required = {'id','kind','title','parent_id','database_id','content','properties','columns','deleted_at','updated_at','thread_id'}
            _keys(item,required | {'_trash_root','formula_errors','_manual_revision','_section_generation','executor','thread_owner'},required)
            if 'thread_owner' in item:
                _keys(item['thread_owner'],{'profile_id','scope_id'},{'profile_id','scope_id'})
                for value in item['thread_owner'].values():
                    _identifier(value,'thread owner')
            if 'executor' in item:
                from .shared_workspaces import validate_executor
                validate_executor(item['executor'])
                if item['executor']['thread_id'] != item['thread_id']:
                    raise StoreError('Executor and page native thread must match')
            if type(item.get('_manual_revision',0)) is not int or item.get('_manual_revision',0)<0:
                raise StoreError('Invalid manual-edit generation')
            if item.get('_section_generation') is not None:
                _identifier(item['_section_generation'],'section generation')
            _identifier(item['id'])
            if not isinstance(item['kind'],str) or item['kind'] not in KINDS:
                raise StoreError('Invalid item kind')
            _text(item['title'],'title',500)
            timestamp(item['updated_at'])
            timestamp(item['deleted_at'],True)
            if item['thread_id'] is not None:
                _identifier(item['thread_id'],'thread_id')
            for key in ('parent_id','database_id'):
                if item[key] is not None:
                    _identifier(item[key])
            if item['kind']=='record':
                db = items.get(item['database_id'])
                if db is None or db['kind']!='database' or item['parent_id'] is not None:
                    raise StoreError('Invalid record database ownership')
            elif item['database_id'] is not None:
                raise StoreError('Only records have database_id')
            if item['parent_id'] is not None and not historical:
                parent = items.get(item['parent_id'])
                if parent is None or parent['kind']!='folder':
                    raise StoreError('Invalid folder parent')
            item['content'] = _content(item['content'])
            if item['kind']=='folder' and item['content']:
                raise StoreError('Folder document content is unsupported')
            if item['kind']=='database':
                item['columns'] = self._columns(state,item['columns'])
            elif item['columns'] != []:
                raise StoreError('Only databases have columns')
            if not isinstance(item['properties'],dict):
                raise StoreError('properties must be an object')
            if item['kind']!='record' and item['properties']:
                raise StoreError('Only records have properties')
            item.pop('formula_errors',None)

        # Validate all shapes first; formula/record validation relies on schema.
        for item in state['items']:
            item_shape(item)
        for item in state['items']:
            path = {item['id']}
            parent = item['parent_id'] or item['database_id']
            for _ in range(MAX_DEPTH+1):
                if parent is None:
                    break
                if parent in path:
                    raise StoreError('A folder cannot be moved into itself or one of its subfolders. Choose another destination.')
                path.add(parent)
                ancestor = items[parent]
                if item['deleted_at'] is None and ancestor['deleted_at'] is not None:
                    raise StoreError('Active item cannot have a trashed ancestor')
                parent = ancestor['parent_id'] or ancestor['database_id']
            else:
                raise StoreError('Folder depth limit exceeded')
            item['properties'] = self._properties(state,item,item['properties'],allow_formula=imported)
            if item.get('_trash_root') is not None:
                root = items.get(item['_trash_root'])
                if root is None or root['deleted_at'] is None or item['deleted_at'] is None:
                    raise StoreError('Invalid Trash group')

        def validate_response(reply):
            from .identity import validate
            _keys(reply,{'id','author','text','created_at','author_identity'},{'id','author','text','created_at'})
            validate(reply.get('author_identity'),'agent' if reply.get('author')=='agent' else 'human')
            _identifier(reply['id'])
            if reply['author'] not in ('user','agent'):
                raise StoreError('Invalid reply author')
            _text(reply['text'],'reply')
            timestamp(reply['created_at'])

        for comment in state['comments']:
            required = {'id','item_id','text','anchor','resolved','replies','created_at'}
            _keys(comment,required|{'anchor_status','target_item_ids','section_change','_deleted_at','author_identity'},required)
            if '_deleted_at' in comment:
                timestamp(comment['_deleted_at'])
                if comment['text'] != '[Deleted comment]' or comment['replies'] != []:
                    raise StoreError('Deleted comment must contain only its provenance tombstone')
            from .identity import validate
            validate(comment.get('author_identity'),'human')
            self._targets(state,comment.get('target_item_ids',[]))
            item = self._item(state,comment['item_id'])
            if item['kind']=='folder':
                raise StoreError('Folders do not accept comments')
            _text(comment['text'],'comment')
            comment['anchor'] = self._anchor(comment['anchor'])
            if item['kind']=='database' and comment['anchor'] is not None:
                raise StoreError('Cell/database text anchors are unsupported')
            if type(comment['resolved']) is not bool:
                raise StoreError('resolved must be boolean')
            timestamp(comment['created_at'])
            replies = comment['replies']
            if not isinstance(replies,list) or len(replies)>1000:
                raise StoreError('Invalid replies array')
            reply_ids = set()
            for reply in replies:
                validate_response(reply)
                if reply['id'] in reply_ids:
                    raise StoreError('Duplicate reply ID')
                reply_ids.add(reply['id'])
            comment.pop('anchor_status',None)
            comment.pop('section_change',None)

        for attachment in state['attachments']:
            required = {'id','item_id','name','media_type','data_base64'}
            _keys(attachment,required,required)
            self._item(state,attachment['item_id'])
            # Reuse byte/filename validation without changing the actual IDs.
            scratch = {'items':state['items'],'attachments':[],'_locks':{}}
            # Backups may contain original attachments on trashed documents.
            item = self._item(state,attachment['item_id'])
            old_deleted = item['deleted_at']
            item['deleted_at'] = None
            try:
                self._attachment(scratch,{k:v for k,v in attachment.items() if k!='id'})
            finally:
                item['deleted_at'] = old_deleted

        comment_map = {x['id']:x for x in state['comments']}
        version_map = {x['id']:x for x in state['versions']}
        run_map = {x['id']:x for x in state['runs']}
        section_generations,section_change_ids = set(),{}
        generation_map, change_map, archived_responses = {}, {}, {}
        for version in state['versions']:
            required = {'id','item_id','run_id','snapshot','created_at'}
            _keys(version,required|{'database_columns','restore_group_id','_section_provenance','section_revert_of','section_revert_receipt','_removed_responses'},required)
            current = self._item(state,version['item_id'])
            saved = version['snapshot']
            if not isinstance(saved,dict) or saved.get('id')!=current['id'] or saved.get('kind')!=current['kind'] or saved.get('database_id')!=current['database_id']:
                raise StoreError('Version snapshot identity mismatch')
            item_shape(saved,historical=True)
            # database_columns is inert per-version schema, independent of all
            # live columns and all detached native run references.
            if saved['kind']=='record':
                if 'database_columns' not in version:
                    raise StoreError('Record history requires database_columns')
                old_columns = self._columns(state,version['database_columns'])
                version['database_columns'] = old_columns
                fake_id = _id()
                scratch = dict(state,items=state['items']+[{'id':fake_id,'kind':'database','columns':old_columns}])
                record = dict(saved,database_id=fake_id)
                saved['properties'] = self._properties(scratch,record,saved['properties'],allow_formula=imported)
            elif 'database_columns' in version:
                raise StoreError('Only record history has database_columns')
            if 'restore_group_id' in version:
                _identifier(version['restore_group_id'],'restore group id')
            if version['run_id'] is not None and version['run_id'] not in run_map:
                raise StoreError('Version references an absent run')
            timestamp(version['created_at'])
            generations = version.get('_section_provenance',[])
            if not isinstance(generations,list) or len(generations)>10000:
                raise StoreError('Invalid section provenance generations')
            for generation in generations:
                _keys(generation,{'id','run_id','post_content','manual_revision','anchors','changes','mapping_version','response_origin','response_version','response_links','response_limitations'},
                      {'id','run_id','post_content','manual_revision','anchors','changes'})
                ident = _identifier(generation['id'],'section generation')
                if ident in section_generations:
                    raise StoreError('Duplicate section generation')
                section_generations.add(ident)
                generation_map[ident] = (version,generation)
                _identifier(generation['run_id'],'section source run')
                if version['run_id'] is not None and generation['run_id'] != version['run_id']:
                    raise StoreError('Section source run differs from its pre-run version')
                if type(generation['manual_revision']) is not int or generation['manual_revision']<0:
                    raise StoreError('Invalid section manual-edit generation')
                if _content(generation['post_content']) != generation['post_content']:
                    raise StoreError('Section provenance contains noncanonical rich content')
                if 'mapping_version' in generation and (type(generation['mapping_version']) is not int or generation['mapping_version'] != 2):
                    raise StoreError('Invalid section mapping version')
                anchors = generation['anchors']
                if not isinstance(anchors,dict) or len(anchors)>MAX_COMMENTS:
                    raise StoreError('Invalid section anchor map')
                for cid,value in anchors.items():
                    _identifier(cid,'section comment')
                    if cid not in comment_map or comment_map[cid]['item_id'] != current['id'] or self._anchor(value) is None:
                        raise StoreError('Section comment does not belong to its version')
                    if version['run_id'] is not None and cid not in run_map[version['run_id']]['comment_ids']:
                        raise StoreError('Section comment is outside the captured run')
                try:
                    expected = capture_sections(saved['content'],generation['post_content'],anchors,_plain,
                                                exact_boundaries=generation.get('mapping_version') == 2)
                except SectionUnavailable as exc:
                    expected = {cid:{'status':'unavailable','reason':str(exc)} for cid in anchors}
                changes = generation['changes']
                if not isinstance(changes,list) or len(changes)!=len(expected):
                    raise StoreError('Section change provenance is incomplete')
                seen_comments = set()
                for change in changes:
                    if not isinstance(change,dict):
                        raise StoreError('Invalid section change')
                    if not {'id','comment_id','reverted_at'} <= set(change):
                        raise StoreError('Incomplete section change identity')
                    cid = change.get('comment_id')
                    if cid not in expected or cid in seen_comments:
                        raise StoreError('Invalid or duplicate section comment provenance')
                    seen_comments.add(cid)
                    data = {key:value for key,value in change.items() if key not in {'id','comment_id','reverted_at'}}
                    if data != expected[cid]:
                        raise StoreError('Section before/after provenance does not match the saved documents')
                    change_id = _identifier(change.get('id'),'section change')
                    if change_id in section_change_ids:
                        raise StoreError('Duplicate section change')
                    section_change_ids[change_id] = current['id']
                    change_map[change_id] = (generation,change)
                    timestamp(change.get('reverted_at'),True)
                if current.get('_section_generation')==ident and current.get('_manual_revision',0)<generation['manual_revision']:
                    raise StoreError('Section manual-edit generation moved backwards')
        cleanup_checkpoints = set()
        for version in state['versions']:
            if 'section_revert_of' in version and section_change_ids.get(version['section_revert_of']) != version['item_id']:
                raise StoreError('Section recovery checkpoint references an absent change')
            if 'section_revert_of' in version:
                change_id = version['section_revert_of']
                if change_id in cleanup_checkpoints:
                    raise StoreError('Duplicate section cleanup checkpoint for one reverted change')
                cleanup_checkpoints.add(change_id)
            if 'section_revert_receipt' not in version:
                if '_removed_responses' in version:
                    raise StoreError('Removed responses require a section recovery receipt')
                if 'section_revert_of' in version and 'response_links' in change_map[version['section_revert_of']][0]:
                    raise StoreError('Section response cleanup requires its complete recovery receipt')
                # Pre-cleanup historical checkpoints never claimed removal of
                # responses. Retain them without inventing an archive.
                continue
            receipt = version['section_revert_receipt']
            _keys(receipt,{'generation_id','run_id','operation_ids','removed_reply_ids','cleanup_mode'}, {'generation_id','run_id','operation_ids','removed_reply_ids'})
            generation,change = change_map.get(version.get('section_revert_of'),(None,None))
            if generation is None or not change['reverted_at'] or receipt['generation_id']!=generation['id'] or receipt['run_id']!=generation['run_id']:
                raise StoreError('Section cleanup receipt identity mismatch')
            links = [link for link in generation.get('response_links',[]) if link.get('comment_id')==change['comment_id']]
            if receipt['operation_ids'] != [link['operation_id'] for link in links]:
                raise StoreError('Section cleanup operation mismatch')
            removed = version.get('_removed_responses')
            if not isinstance(removed,list) or len(removed)>1000:
                raise StoreError('Invalid removed response archive')
            if receipt['removed_reply_ids'] != [entry.get('reply',{}).get('id') for entry in removed]:
                raise StoreError('Section cleanup archive mismatch')
            linked_ids = [rid for link in links for rid in link['reply_ids']]
            comment = comment_map[change['comment_id']]
            deleted_at = comment.get('_deleted_at')
            cleanup_at, reverted_at = timestamp(version['created_at']),timestamp(change['reverted_at'])
            if cleanup_at > reverted_at:
                raise StoreError('Section cleanup checkpoint chronology is inconsistent')
            deletion = timestamp(deleted_at) if deleted_at else None
            if deletion and deletion < timestamp(comment['created_at']):
                raise StoreError('Discussion deletion predates its creation')
            mode = receipt.get('cleanup_mode')
            if mode is not None and mode not in ('responses_archived','discussion_deleted'):
                raise StoreError('Invalid section cleanup mode')
            # Missing legacy mode is not evidence of deletion order. Empty
            # archives require strictly earlier deletion in UTC; equal/coarse
            # timestamps are ambiguous and cannot excuse lost response data.
            deleted_before = (deletion is not None and deletion < cleanup_at and
                              not removed and mode != 'responses_archived')
            if mode == 'discussion_deleted' and not deleted_before:
                raise StoreError('Deleted-discussion cleanup requires proven deletion before cleanup and no removed responses')
            if removed and deletion is not None and deletion <= reverted_at:
                raise StoreError('Archived responses conflict with the discussion deletion chronology')
            if (not deleted_before and set(receipt['removed_reply_ids']) != set(linked_ids)
                    or len(set(receipt['removed_reply_ids'])) != len(removed)):
                raise StoreError('Section cleanup response archive is incomplete or unrelated')
            for entry in removed:
                _keys(entry,{'comment_id','reply'},{'comment_id','reply'})
                if entry['comment_id']!=change['comment_id']:
                    raise StoreError('Section cleanup comment mismatch')
                validate_response(entry['reply'])
                if entry['reply']['author']!='agent':
                    raise StoreError('Section cleanup cannot remove human feedback')
                key = (entry['comment_id'],entry['reply']['id'])
                if key in archived_responses or any(r['id']==key[1] for r in comment_map[key[0]]['replies']):
                    raise StoreError('Duplicate archived or live response')
                archived_responses[key] = entry['reply']

        for change_id,(generation,change) in change_map.items():
            if change['reverted_at'] and 'response_links' in generation and change_id not in cleanup_checkpoints:
                raise StoreError('Reverted response cleanup is missing its recovery checkpoint')

        for run in state['runs']:
            required = {'id','item_id','session_id','status','comment_ids','allowed_item_ids','version_ids','progress','error','created_at','updated_at'}
            _keys(run,required|{'_owner_pid','_owner_identity','operation_receipts','_executor_identity'},required)
            from .identity import validate
            validate(run.get('_executor_identity'),'agent')
            self._item(state,run['item_id'])
            _identifier(run['session_id'],'session_id')
            if run['status'] not in ACTIVE|TERMINAL:
                raise StoreError('Invalid run status')
            _text(run['progress'],'run progress',20000,empty=True)
            if run['error'] is not None:
                _text(run['error'],'run error')
            timestamp(run['created_at'])
            timestamp(run['updated_at'])
            for key,mapping in (('comment_ids',comment_map),('allowed_item_ids',items),('version_ids',version_map)):
                values = run[key]
                if not isinstance(values,list) or not all(isinstance(x,str) for x in values) or len(set(values))!=len(values) or any(x not in mapping for x in values):
                    raise StoreError('Invalid run reference array '+key)
            if run['item_id'] not in run['allowed_item_ids']:
                raise StoreError('Run must include its current item')
            if any(comment_map[x]['item_id']!=run['item_id'] for x in run['comment_ids']):
                raise StoreError('Run comment belongs to another item')
            if any(version_map[x]['run_id']!=run['id'] or version_map[x]['item_id'] not in run['allowed_item_ids'] for x in run['version_ids']):
                raise StoreError('Run version scope mismatch')
            receipts = run.get('operation_receipts',[])
            if not isinstance(receipts,list) or len(receipts)>10000:
                raise StoreError('Invalid run operation receipts')
            seen_operations = set()
            for receipt in receipts:
                _keys(receipt,{'operation_id','operation_digest','comment_ids','_outcomes','_generation_ids'},{'operation_id','operation_digest','comment_ids'})
                operation_id = receipt['operation_id']
                if not isinstance(operation_id,str) or re.fullmatch(r'[a-f0-9]{64}',operation_id) is None or receipt['operation_digest']!=operation_id or operation_id in seen_operations:
                    raise StoreError('Invalid or duplicate operation receipt digest')
                seen_operations.add(operation_id)
                comment_ids = receipt['comment_ids']
                if not isinstance(comment_ids,list) or not all(isinstance(x,str) for x in comment_ids) or len(set(comment_ids))!=len(comment_ids) or not set(comment_ids)<=set(run['comment_ids']):
                    raise StoreError('Operation receipt comment scope mismatch')
                if ('_outcomes' in receipt)!=('_generation_ids' in receipt):
                    raise StoreError('Incomplete application response receipt')
                if '_outcomes' in receipt:
                    outcomes,gids = receipt['_outcomes'],receipt['_generation_ids']
                    if not isinstance(outcomes,list) or len(outcomes)>MAX_COMMENTS or not isinstance(gids,list) or len(gids)!=len(set(gids)):
                        raise StoreError('Invalid application response receipt')
                    if any(gid not in generation_map or generation_map[gid][1]['run_id']!=run['id'] for gid in gids):
                        raise StoreError('Response receipt generation mismatch')
                    seen = set()
                    for outcome in outcomes:
                        _keys(outcome,{'comment_id','reply_id'},{'comment_id','reply_id'})
                        cid,rid = outcome['comment_id'],_identifier(outcome['reply_id'])
                        if cid not in comment_ids or rid in seen:
                            raise StoreError('Response receipt outcome mismatch')
                        seen.add(rid)
                        response = next((r for r in comment_map[cid]['replies'] if r['id']==rid),archived_responses.get((cid,rid)))
                        if response is None and not comment_map[cid].get('_deleted_at') or response is not None and response['author']!='agent':
                            raise StoreError('Response receipt references an absent or human outcome')
            if not imported and run['status'] in ACTIVE and any(state['_locks'].get(x)!=run['id'] for x in run['allowed_item_ids']):
                raise StoreError('Active run is missing a durable lock')
        for version,generation in generation_map.values():
            fields = {'response_origin','response_links','response_limitations'} & set(generation)
            if 'response_version' in generation and (type(generation['response_version']) is not int or generation['response_version'] != 2 or len(fields) != 3):
                raise StoreError('Invalid cumulative response provenance version')
            if not fields:
                continue  # Historical data stays unchanged and cleanup unavailable.
            if len(fields)!=3 or generation['response_origin'] not in ('application','imported'):
                raise StoreError('Invalid section response provenance')
            links,limitations = generation['response_links'],generation['response_limitations']
            changes = {c['comment_id']:c for c in generation['changes']}
            if not isinstance(links,list) or len(links)>10000 or not isinstance(limitations,dict) or not set(limitations)<=set(changes):
                raise StoreError('Invalid section response associations')
            for reason in limitations.values():
                _text(reason,'response association limitation',2000)
            seen = set()
            for link in links:
                _keys(link,{'operation_id','comment_id','reply_ids'},{'operation_id','comment_id','reply_ids'})
                op,cid,ids = link['operation_id'],link['comment_id'],link['reply_ids']
                if not isinstance(op,str) or not re.fullmatch(r'[a-f0-9]{64}',op) or cid not in changes or not isinstance(ids,list) or not ids or len(ids)>1000:
                    raise StoreError('Invalid section response link')
                for rid in ids:
                    _identifier(rid)
                    if rid in seen:
                        raise StoreError('Duplicate section response link')
                    seen.add(rid)
                    response = next((r for r in comment_map[cid]['replies'] if r['id']==rid),archived_responses.get((cid,rid)))
                    if response is None and not comment_map[cid].get('_deleted_at') or response is not None and response['author']!='agent':
                        raise StoreError('Section response link is absent or human')
                if generation['response_origin']=='application' and version['run_id'] is not None and (not imported or generation['run_id'] in run_map):
                    run = run_map.get(generation['run_id'])
                    receipt = next((r for r in run.get('operation_receipts',[]) if r['operation_id']==op),None) if run else None
                    if receipt is None or not all({'comment_id':cid,'reply_id':rid} in receipt.get('_outcomes',[]) for rid in ids):
                        raise StoreError('Section response association lacks its actual operation outcome')
                    preceding = version.get('_section_provenance',[])[:version.get('_section_provenance',[]).index(generation)+1]
                    if not any(g['id'] in receipt.get('_generation_ids',[]) and any(c['comment_id']==cid and c['status']=='available' for c in g['changes']) for g in preceding):
                        raise StoreError('Section response association lacks its actual operation change')
        for item_id,run_id in state['_locks'].items():
            run = run_map.get(run_id)
            if item_id not in items or run is None or run['status'] not in ACTIVE or item_id not in run['allowed_item_ids']:
                raise StoreError('Invalid run lock reference')

        for recent in state['recents']:
            _keys(recent,{'item_id','opened_at'},{'item_id','opened_at'})
            item = self._item(state,recent['item_id'])
            if item['deleted_at'] is not None or item['kind']=='folder':
                raise StoreError('Recent must reference an active Workspace document')
            timestamp(recent['opened_at'])
        for template in state['templates']:
            required = {'id','name','kind','content','properties','columns','created_at'}
            _keys(template,required|{'attachments'},required)
            _text(template['name'],'template name',500)
            if template['kind'] not in ('page','record'):
                raise StoreError('Invalid template kind')
            template['content'] = _content(template['content'])
            timestamp(template['created_at'])
            template['columns'] = self._columns(state,template['columns'])
            if not isinstance(template['properties'],dict):
                raise StoreError('Invalid template properties')
            if template['kind']=='page' and (template['properties'] or template['columns']):
                raise StoreError('Page templates have no database properties')
            if template['kind']=='record':
                # A synthetic in-memory database validates copied schema/values.
                fake_id = _id()
                fake = {'id':fake_id,'kind':'database','columns':template['columns']}
                scratch = dict(state,items=state['items']+[fake])
                record = {'kind':'record','database_id':fake_id}
                template['properties'] = self._properties(scratch,record,template['properties'],allow_formula=imported)

        attachment_ids = {x['id'] for x in state['attachments']}
        documents = state['items'] + [x['snapshot'] for x in state['versions']]
        for document in documents:
            if self._attachment_refs(document['content']) - attachment_ids:
                raise StoreError('Dangling attachment reference')
        for template in state['templates']:
            assets = template.get('attachments',[])
            if not isinstance(assets,list) or len(assets)>1000:
                raise StoreError('Invalid template attachment copies')
            seen = set()
            for asset in assets:
                _keys(asset,{'id','name','media_type','data_base64'},{'id','name','media_type','data_base64'})
                ident = _identifier(asset['id'])
                if ident in seen:
                    raise StoreError('Duplicate template attachment ID')
                seen.add(ident)
                fake_id = _id()
                scratch = {'items':[{'id':fake_id,'deleted_at':None,'parent_id':None,'database_id':None}],'attachments':[],'_locks':{}}
                self._attachment(scratch,dict({k:v for k,v in asset.items() if k!='id'},item_id=fake_id))
            if self._attachment_refs(template['content']) - seen:
                raise StoreError('Dangling template attachment reference')

    @staticmethod
    def _attachment_refs(content):
        return {html.unescape(x) for x in re.findall(r'(?:src|href)="attachment:([^"<>]+)"',content)}

    @staticmethod
    def _replace_attachment(content, old, new):
        # Replace only complete sanitized URI attribute values, never prose.
        return content.replace('="attachment:'+html.escape(old,quote=True)+'"', '="attachment:'+html.escape(new,quote=True)+'"')


def validate_backup_snapshot(snapshot):
    """Pure v1 raw-data validation matching Store's admitted 64,000,000 bytes.

    Returns an independent raw-data copy. Uses the Store graph validator without
    constructing a Store, reading a path, querying SQLite or looking up native
    identity. All persisted categories/private Trash/history fields are retained.
    Derived public projections are removed; scope_id remains inert provenance.
    Lifecycle refusal/detachment and archive framing belong to interchange.
    """
    _keys(snapshot,set(CATEGORIES)|{'revision','scope_id','identity'},set(CATEGORIES)|{'revision'})
    if type(snapshot['revision']) is not int or snapshot['revision']<0:
        raise StoreError('Backup revision must be a nonnegative integer')
    if 'scope_id' in snapshot:
        _identifier(snapshot['scope_id'],'scope_id')
    if len(_json({k:v for k,v in snapshot.items() if k!='scope_id'}).encode('utf-8'))>MAX_STATE:
        raise StoreError('Backup exceeds Workspace storage limit')
    state = copy.deepcopy(snapshot)
    state.pop('identity',None)
    state['_locks'] = {}
    try:
        # No __init__: these graph methods depend only on their explicit state.
        validator = object.__new__(Store)
        validator._validate_state(state,imported=True)
        originals = snapshot['items']+snapshot['templates']+[v['snapshot'] for v in snapshot['versions']]
        documents = state['items']+state['templates']+[v['snapshot'] for v in state['versions']]
        for original,document in zip(originals,documents):
            parser = _HTML()
            parser.feed(original['content']); parser.close()
            if parser.rejected:
                raise StoreError('Backup contains unsafe or unsupported HTML')
            # Preserve already-admitted bytes, including harmless legacy duplicate
            # checkbox attributes, rather than reserializing historical documents.
            document['content'] = original['content']
    except StoreError:
        raise
    except (TypeError,KeyError,ValueError,OverflowError,RecursionError) as exc:
        raise StoreError('Invalid backup data shape') from exc
    state.pop('_locks')
    return state
