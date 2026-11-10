"""Production router behaviour; all homes are generated synthetic fixtures."""
from pathlib import Path
from tempfile import TemporaryDirectory
import base64
import hashlib
import io
import zipfile
import xml.etree.ElementTree as ET
import threading
import unittest
from unittest.mock import patch

import httpx

from fastapi import FastAPI
from fastapi.testclient import TestClient

from dashboard.plugin_api import create_router


class NativeRouteBoundaryTests(unittest.TestCase):
    """Actual hosted HTTP guard/Store; downstream recorder isolates route identity.

    Outer admission is synthetic, using the real core IPC admission wrapper.
    This tests the server bridge, not native effects/provider acceptance.
    """
    def setUp(self):
        import dashboard.plugin_api as api
        from hermes_cli.plugin_host_http_auth import with_hosted_admission
        self.api = api
        fixture_root = Path(__file__).resolve().parents[1] / '.local/api-native'
        fixture_root.mkdir(parents=True, exist_ok=True)
        self.temp = TemporaryDirectory(dir=fixture_root)
        self.selected_home = Path(self.temp.name) / 'owner-a'
        self.calls = []
        calls = self.calls

        class Recorder:
            def __init__(self, home, store):
                self.home = Path(home)

            def prepare(self, item_id, session_id, explicit_item_ids, *, principal_id=None):
                calls.append(('prepare', self.home, principal_id, item_id, session_id, explicit_item_ids))
                return {'run': {'id': 'recorded'}, 'prompt': 'fixture', 'submission_id': 'recorded'}

            def consume(self, run_id, *, principal_id=None):
                calls.append(('consume', self.home, principal_id, run_id))
                return {'run': {'id': run_id}, 'native_terminal': 'UNKNOWN'}

            def review_scope(self, item_id, selected_item_ids, *, expected_revision, principal_id):
                calls.append(('review-scope', self.home, principal_id, item_id, selected_item_ids, expected_revision))
                return {'review_id': 'synthetic-recorded-review'}

        self.workflow_patch = patch.object(api._module('workflow'), 'Workflow', Recorder)
        self.workflow_patch.start()
        app = FastAPI()
        app.include_router(create_router(lambda: self.selected_home), prefix='/api/plugins/workspace')
        self.admitted = TestClient(with_hosted_admission(app, True))
        self.unadmitted = TestClient(with_hosted_admission(app, False))

    def tearDown(self):
        self.admitted.close()
        self.unadmitted.close()
        self.workflow_patch.stop()
        self.temp.cleanup()

    def test_native_prepare_consume_inject_only_authenticated_owner_and_captured_home(self):
        from gateway.owner_identity import host_owner_subject
        state = self.admitted.get('/api/plugins/workspace/state').json()
        scope = state['scope_id']
        prepared = self.admitted.post('/api/plugins/workspace/workflow/prepare', json={
            'item_id': 'page-fixture', 'session_id': 'native-fixture',
            'explicit_item_ids': ['related-fixture'], 'expected_scope': scope})
        self.assertEqual(prepared.status_code, 200, prepared.text)
        self.assertEqual(self.calls[-1], ('prepare', self.selected_home, host_owner_subject(),
                         'page-fixture', 'native-fixture', ['related-fixture']))
        consumed = self.admitted.post('/api/plugins/workspace/workflow/consume', json={
            'run_id': 'recorded', 'expected_scope': scope})
        self.assertEqual(consumed.status_code, 200, consumed.text)
        self.assertEqual(self.calls[-1], ('consume', self.selected_home, host_owner_subject(), 'recorded'))
        self.assertEqual(self.admitted.get('/api/plugins/workspace/state').json(), state)
        self.selected_home = Path(self.temp.name) / 'owner-b'
        before = len(self.calls)
        refused = self.admitted.post('/api/plugins/workspace/workflow/consume', json={
            'run_id': 'recorded', 'expected_scope': scope})
        self.assertEqual(refused.status_code, 409, refused.text)
        self.assertEqual(len(self.calls), before)
        self.assertEqual(self.admitted.get('/api/plugins/workspace/state').json()['items'], [])

    def test_native_identity_fields_and_unadmitted_header_spoofs_never_reach_workflow(self):
        scope = self.admitted.get('/api/plugins/workspace/state').json()['scope_id']
        for action, body in [
            ('prepare', {'item_id': 'page', 'session_id': 'session'}),
            ('consume', {'run_id': 'run'}),
        ]:
            for field in ['principal_id', 'actor', 'native_epoch', 'profile_home']:
                with self.subTest(action=action, field=field):
                    response = self.admitted.post('/api/plugins/workspace/workflow/' + action,
                        json={**body, 'expected_scope': scope, field: 'forged'})
                    self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(self.calls, [])

        denied = self.unadmitted.post('/api/plugins/workspace/workflow/consume',
            json={'run_id': 'run', 'expected_scope': scope, 'principal_id': 'uid:0'},
            headers={'X-Hermes-Workspace-Principal': 'uid:0'})
        self.assertEqual(denied.status_code, 401, denied.text)
        self.assertEqual(self.calls, [])

    def test_review_scope_principal_is_framework_owned_and_new_raw_grants_refuse(self):
        from gateway.owner_identity import host_owner_subject
        scope=self.admitted.get('/api/plugins/workspace/state').json()['scope_id']
        body={'item_id':'current','selected_item_ids':['related'],'expected_revision':0,'expected_scope':scope}
        response=self.admitted.post('/api/plugins/workspace/workflow/review-scope',json=body)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.calls[-1],('review-scope',self.selected_home,host_owner_subject(),'current',['related'],0))
        count=len(self.calls)
        for field in ('principal_id','profile_home','reviewed_item_ids'):
            rejected=self.admitted.post('/api/plugins/workspace/workflow/review-scope',json={**body,field:'forged'})
            self.assertEqual(rejected.status_code,400,rejected.text)
        denied=self.unadmitted.post('/api/plugins/workspace/workflow/review-scope',json=body)
        self.assertEqual(denied.status_code,401,denied.text)
        self.assertEqual(len(self.calls),count)


class ApiTests(unittest.TestCase):
    def setUp(self):
        fixture_root = Path(__file__).resolve().parents[1] / '.local/api'
        fixture_root.mkdir(parents=True, exist_ok=True)
        self.temp = TemporaryDirectory(dir=fixture_root)
        self.home = Path(self.temp.name) / 'owner-a'
        self.selected_home = self.home
        app = FastAPI()
        app.include_router(create_router(lambda: self.selected_home, authorize=lambda: None), prefix='/api/plugins/workspace')
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.temp.cleanup()

    def command(self, op, payload):
        return self.client.post('/api/plugins/workspace/command', json={
            'op': op, 'payload': payload, 'expected_scope': self.scope()})

    def scope(self):
        return self.client.get('/api/plugins/workspace/state').json()['scope_id']

    def test_durable_command_state_and_profile_reselection(self):
        response = self.command('create_item', {'kind': 'page', 'title': 'Synthetic only'})
        self.assertEqual(response.status_code, 200, response.text)
        item = response.json()['result']
        self.assertEqual(response.json()['state']['items'][0]['id'], item['id'])
        self.selected_home = Path(self.temp.name) / 'owner-b'
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json()['items'], [])
        self.selected_home = self.home
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json()['items'][0]['title'], 'Synthetic only')
        stale = self.scope()
        self.selected_home = Path(self.temp.name) / 'owner-b'
        rejected = self.client.post('/api/plugins/workspace/command', json={
            'op': 'create_item', 'payload': {'kind': 'page', 'title': 'Wrong owner'}, 'expected_scope': stale})
        self.assertEqual(rejected.status_code, 409)
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json()['items'], [])

    def test_stale_revision_and_bad_command_are_honest_errors(self):
        self.command('create_item', {'kind': 'page', 'title': 'First'})
        conflict = self.command('create_item', {'kind': 'page', 'title': 'Stale', 'expected_revision': 0})
        self.assertEqual(conflict.status_code, 409, conflict.text)
        self.assertEqual(self.command('begin_run', {}).status_code, 400)
        self.assertEqual(self.command('bind_thread', {'item_id': 'x', 'thread_id': 'forged'}).status_code, 400)
        invalid = self.client.post('/api/plugins/workspace/command', content=b'{', headers={'Content-Type': 'application/json'})
        self.assertEqual(invalid.status_code, 400)

    def test_lightweight_search_catalog_detail_history_and_legacy_contract(self):
        import dashboard.plugin_api as api
        store=api._module('store').Store(self.selected_home)
        def seed(state):
            return [store._create(state,{'kind':'page','title':f'API page {index:03}',
                'content':'<p>find-body '+('synthetic '*40)+'</p>'}) for index in range(205)]
        pages=store._transaction(seed)
        prefix='/api/plugins/workspace'
        snapshot=self.client.get(prefix+'/state').json()
        before=store.backup_snapshot()
        catalog=self.client.get(prefix+'/catalog').json()
        self.assertEqual(len(catalog['items']),205)
        self.assertNotIn('content',catalog['items'][0])
        query={'op':'search_page','payload':{'query':'find-body','limit':200},'include_state':False,'expected_scope':snapshot['scope_id']}
        response=self.client.post(prefix+'/command',json=query)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(set(response.json()),{'result'})
        page=response.json()['result']
        self.assertEqual(page['total'],205)
        last=self.client.post(prefix+'/command',json={**query,'payload':{'query':'find-body','offset':200,'expected_revision':page['revision']}})
        self.assertEqual(last.status_code,200,last.text)
        self.assertEqual(len(last.json()['result']['items']),5)
        legacy=self.command('search',{'query':'find-body'}).json()
        self.assertIsInstance(legacy['result'],list)
        self.assertIn('state',legacy)
        detail=self.client.get(prefix+'/document/'+pages[-1]['id'],params={'expected_scope':snapshot['scope_id'],'expected_revision':snapshot['revision']})
        self.assertEqual(detail.status_code,200,detail.text)
        self.assertNotIn('versions',detail.json())
        history=self.client.get(prefix+'/document/'+pages[-1]['id']+'/history',params={'expected_scope':snapshot['scope_id'],'expected_revision':snapshot['revision']})
        self.assertEqual(history.status_code,200,history.text)
        self.assertEqual(history.json()['versions'],[])
        self.assertEqual(store.backup_snapshot(),before)
        denied=self.client.post(prefix+'/command',json={'op':'create_item','payload':{'kind':'page','title':'Must not create'},'expected_scope':snapshot['scope_id'],'include_state':False})
        self.assertEqual(denied.status_code,400)
        self.assertEqual(store.backup_snapshot(),before)
        self.selected_home=Path(self.temp.name)/'other-read-owner'
        self.assertEqual(self.client.get(prefix+'/catalog',params={'expected_scope':snapshot['scope_id']}).status_code,409)
        self.assertEqual(self.client.get(prefix+'/document/'+pages[-1]['id'],params={'expected_scope':snapshot['scope_id']}).status_code,409)

    def test_delete_comment_contract_scope_revision_and_durable_absence(self):
        page = self.command('create_item', {'kind': 'page', 'title': 'Delete fixture'}).json()['result']
        for resolved in (False, True):
            comment = self.command('add_comment', {'item_id': page['id'], 'text': 'Remove feedback'}).json()['result']
            self.command('reply_comment', {'id': comment['id'], 'text': 'Remove reply'})
            if resolved:
                self.command('resolve_comment', {'id': comment['id'], 'resolved': True})
            before = self.client.get('/api/plugins/workspace/state').json()
            denied = self.client.post('/api/plugins/workspace/command', json={
                'op': 'delete_comment', 'payload': {'id': comment['id']}, 'expected_scope': 'stale'})
            self.assertEqual(denied.status_code, 409)
            self.assertEqual(self.client.get('/api/plugins/workspace/state').json(), before)
            deleted = self.command('delete_comment', {'id': comment['id'], 'expected_revision': before['revision']})
            self.assertEqual(deleted.status_code, 200, deleted.text)
            self.assertEqual(deleted.json()['result'], {'id': comment['id'], 'item_id': page['id'], 'deleted': True})
            self.assertEqual(deleted.json()['state']['comments'], [])
            self.assertEqual(self.command('reply_comment', {'id': comment['id'], 'text': 'Late'}).status_code, 404)
            self.assertEqual(self.client.get('/api/plugins/workspace/state').json()['comments'], [])

    def test_unconfigured_shared_root_fails_closed_without_private_relocation(self):
        self.command('create_item', {'kind': 'page', 'title': 'Must stay private'})
        before = self.client.get('/api/plugins/workspace/state').json()
        capabilities = self.client.get('/api/plugins/workspace/workspace-capabilities').json()
        self.assertFalse(capabilities['shared_storage_configured'])
        self.assertFalse(capabilities['native_shared_executor'])
        self.assertFalse(capabilities['local_profile_backend_default'])
        self.assertEqual(self.client.get('/api/plugins/workspace/workspaces').status_code, 503)
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json(), before)

    def test_configured_synthetic_shared_routes_membership_crud_move_and_actor_spoof(self):
        from workspace_plugin.shared_workspaces import profile_key
        app = FastAPI()
        app.include_router(create_router(lambda: self.selected_home, authorize=lambda: None,
            shared_root=Path(self.temp.name) / 'shared-root'), prefix='/api/plugins/workspace')
        with TestClient(app) as client:
            prefix = '/api/plugins/workspace'
            private = self.client.get(prefix + '/state').json()
            alice = profile_key(self.selected_home)
            bob_home = Path(self.temp.name) / 'owner-b'
            bob = profile_key(bob_home)
            created = client.post(prefix + '/workspaces', json={'name': 'Synthetic shared',
                'members': [{'profile_id': bob}], 'expected_scope': private['scope_id']})
            self.assertEqual(created.status_code, 200, created.text)
            pid = created.json()['id']
            route = prefix + '/workspaces/' + pid
            view = client.get(route + '/state').json()
            scope = view['state']['scope_id']
            def shared_command(op, payload, revision=None, **extra):
                state = client.get(route + '/state').json()['state']
                return client.post(route + '/command', json={'op': op, 'payload': dict(payload, expected_revision=state['revision'] if revision is None else revision),
                    'expected_scope': scope, 'membership_revision': 1, **extra})
            saved = shared_command('create_item', {'kind': 'page', 'title': 'Shared document'})
            self.assertEqual(saved.status_code, 200, saved.text)
            page = saved.json()['result']
            comment = shared_command('add_comment', {'item_id': page['id'], 'text': 'Delete this shared discussion'}).json()['result']
            self.assertEqual(shared_command('delete_comment', {'id': comment['id']}).status_code, 200)
            self.assertEqual(shared_command('create_item', {'kind': 'page', 'title': 'Spoof'}, actor=alice).status_code, 400)
            self.assertEqual(shared_command('update_item', {'id': page['id'], 'patch': {'title': 'Stale'}}, revision=0).status_code, 409)
            self.selected_home = bob_home
            self.assertEqual(client.get(route + '/state').json()['state']['items'][0]['title'], 'Shared document')
            self.assertEqual(client.get(prefix + '/state').json()['items'], [])
            self.selected_home = self.home
            changed = client.post(route + '/members', json={'profile_id': bob, 'role': 'read_only', 'membership_revision': 1, 'expected_scope': scope})
            self.assertEqual(changed.status_code, 200, changed.text)
            self.selected_home = bob_home
            denied = client.post(route + '/command', json={'op': 'create_item', 'payload': {'kind': 'page', 'title': 'Denied', 'expected_revision': 3},
                'expected_scope': scope, 'membership_revision': 2})
            self.assertEqual(denied.status_code, 403, denied.text)
            self.selected_home = Path(self.temp.name) / 'unlisted'
            self.assertEqual(client.get(route + '/state').status_code, 403)
            self.assertEqual(client.get(prefix + '/workspaces').json()['workspaces'], [])
            self.selected_home = self.home
            private_page = self.command('create_item', {'kind': 'page', 'title': 'Explicit move'}).json()['result']
            before = self.client.get(prefix + '/state').json()
            destination = client.get(route + '/state').json()['state']
            body = {'item_id': private_page['id'], 'confirmed': False, 'membership_revision': 2, 'expected_scope': scope,
                    'source_scope': before['scope_id'], 'source_revision': before['revision'], 'destination_revision': destination['revision']}
            self.assertEqual(client.post(route + '/move-private', json=body).status_code, 409)
            self.assertEqual(self.client.get(prefix + '/state').json(), before)
            moved = client.post(route + '/move-private', json={**body, 'confirmed': True})
            self.assertEqual(moved.status_code, 200, moved.text)
            self.assertEqual(self.client.get(prefix + '/state').json()['items'], [])
            self.assertIn(private_page['id'], [p['id'] for p in client.get(route + '/state').json()['state']['items']])

    def test_import_export_backup_and_invalid_restore_are_atomic(self):
        imported = self.client.post('/api/plugins/workspace/import', json={
            'name': 'synthetic.md', 'expected_scope': self.scope(),
            'data_base64': base64.b64encode(b'# Hello\n\nEditable body').decode()})
        self.assertEqual(imported.status_code, 200, imported.text)
        state = imported.json()['state']
        page = next(i for i in state['items'] if i['kind'] == 'page')
        exported = self.client.get(f"/api/plugins/workspace/export/{page['id']}?format=docx")
        self.assertEqual(exported.status_code, 200, exported.text)
        self.assertEqual(base64.b64decode(exported.json()['data_base64'])[:4], b'PK\x03\x04')
        archive = self.client.get('/api/plugins/workspace/backup')
        self.assertEqual(archive.status_code, 200, archive.text)
        bad = self.client.post('/api/plugins/workspace/restore-backup', json={
            'data_base64': 'not base64!', 'expected_scope': self.scope()})
        self.assertEqual(bad.status_code, 400, bad.text)
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json(), state)
        self.selected_home = Path(self.temp.name) / 'restore-owner'
        restored = self.client.post('/api/plugins/workspace/restore-backup', json={
            'data_base64': archive.json()['data_base64'], 'expected_scope': self.scope()})
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertEqual(len(restored.json()['state']['attachments']), 1)
        self.assertEqual(restored.json()['state']['items'][0]['id'], page['id'])

    def test_complete_backup_covers_admitted_attachment_capacity_over_old_limit(self):
        page = self.command('create_item', {'kind': 'page', 'title': 'Full backup boundary'}).json()['result']
        hashes = []
        for index in range(2):
            data = bytes([65 + index]) * (6 * 1024 * 1024)
            hashes.append(hashlib.sha256(data).hexdigest())
            saved = self.command('add_attachment', {
                'item_id': page['id'], 'name': f'synthetic-{index}.bin',
                'media_type': 'application/octet-stream',
                'data_base64': base64.b64encode(data).decode('ascii')})
            self.assertEqual(saved.status_code, 200, saved.text[:500])
        archive = self.client.get('/api/plugins/workspace/backup')
        self.assertEqual(archive.status_code, 200, archive.text[:500])
        self.selected_home = Path(self.temp.name) / 'large-backup-receiver'
        restored = self.client.post('/api/plugins/workspace/restore-backup', json={
            'expected_scope': self.scope(), 'data_base64': archive.json()['data_base64']})
        self.assertEqual(restored.status_code, 200, restored.text[:500])
        attachments = restored.json()['state']['attachments']
        self.assertEqual([hashlib.sha256(base64.b64decode(row['data_base64'])).hexdigest()
                          for row in attachments], hashes)

    def test_raster_exports_reject_bad_checksum_with_actionable_error_and_accept_valid_png(self):
        from PIL import Image

        malformed = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4XcAAAAASUVORK5CYII=')
        output = io.BytesIO()
        Image.new('RGB', (2, 2), (80, 120, 160)).save(output, format='PNG')
        fixtures = [('bad-checksum', malformed, 400), ('valid', output.getvalue(), 200)]
        # Observe the actual public error response, including unexpected 500s.
        with TestClient(self.client.app, raise_server_exceptions=False) as exports:
            for name, raster, expected_status in fixtures:
                page = self.command('create_item', {'kind': 'page', 'title': name}).json()['result']
                saved = self.command('add_attachment', {
                    'item_id': page['id'], 'name': name + '.png', 'media_type': 'image/png',
                    'data_base64': base64.b64encode(raster).decode('ascii')})
                self.assertEqual(saved.status_code, 200, saved.text)
                attachment = saved.json()['result']
                changed = self.command('update_item', {'id': page['id'], 'patch': {
                    'content': '<p>Raster export control</p><img src="attachment:' + attachment['id'] + '" alt="pixel">'}})
                self.assertEqual(changed.status_code, 200, changed.text)
                for format_name in ('md', 'docx', 'pdf'):
                    with self.subTest(image=name, format=format_name):
                        response = exports.get(f"/api/plugins/workspace/export/{page['id']}?format={format_name}")
                        self.assertEqual(response.status_code, expected_status, response.text)
                        if expected_status == 400:
                            self.assertIn('Malformed or oversized raster image', response.json()['detail'])
                        else:
                            data = base64.b64decode(response.json()['data_base64'])
                            self.assertTrue(data)
                            if format_name == 'docx':
                                self.assertTrue(data.startswith(b'PK\x03\x04'))
                            elif format_name == 'pdf':
                                self.assertTrue(data.startswith(b'%PDF-'))

    def test_docx_retains_standalone_paragraph_and_table_raster_images(self):
        from PIL import Image

        output = io.BytesIO()
        Image.new('RGBA', (4, 4), (20, 80, 180, 255)).save(output, format='PNG')
        raster = output.getvalue()
        for placement in ('standalone', 'paragraph', 'table'):
            with self.subTest(placement=placement):
                page = self.command('create_item', {'kind': 'page', 'title': placement}).json()['result']
                saved = self.command('add_attachment', {
                    'item_id': page['id'], 'name': 'valid.png', 'media_type': 'image/png',
                    'data_base64': base64.b64encode(raster).decode('ascii')})
                self.assertEqual(saved.status_code, 200, saved.text)
                image = '<img src="attachment:' + saved.json()['result']['id'] + '" alt="valid.png">'
                content = {'standalone': image, 'paragraph': '<p>' + image + '</p>',
                           'table': '<table><tr><td>' + image + '</td></tr></table>'}[placement]
                self.assertEqual(self.command('update_item', {
                    'id': page['id'], 'patch': {'content': content}}).status_code, 200)
                response = self.client.get(f"/api/plugins/workspace/export/{page['id']}?format=docx")
                self.assertEqual(response.status_code, 200, response.text)
                with zipfile.ZipFile(io.BytesIO(base64.b64decode(response.json()['data_base64']))) as document:
                    media = [name for name in document.namelist() if name.startswith('word/media/')]
                    self.assertEqual(len(media), 1, document.namelist())
                    embedded = document.read(media[0])
                    self.assertEqual(hashlib.sha256(embedded).digest(), hashlib.sha256(raster).digest())
                    body = ET.fromstring(document.read('word/document.xml'))
                    self.assertEqual(len(body.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing')), 1)
                    with Image.open(io.BytesIO(embedded)) as decoded:
                        self.assertEqual(decoded.convert('RGBA').tobytes(), bytes([20, 80, 180, 255]) * 16)

    def test_restore_compact_commit_receipt_and_scoped_status(self):
        page = self.command('create_item', {'kind': 'page', 'title': 'Receipt source'}).json()['result']
        archive = self.client.get('/api/plugins/workspace/backup').json()['data_base64']
        self.command('create_item', {'kind': 'page', 'title': 'Must be replaced'})
        scope = self.scope()
        request = {'data_base64': archive, 'expected_scope': scope,
                   'restore_id': 'a' * 32, 'include_state': False, 'expected_revision': self.client.get('/api/plugins/workspace/state').json()['revision']}
        response = self.client.post('/api/plugins/workspace/restore-backup', json=request)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn('state', response.json())
        self.assertEqual(response.json()['status'], 'committed')
        self.assertTrue(response.json()['result']['restored'])
        status = self.client.get('/api/plugins/workspace/restore-status/' + 'a' * 32,
                                 params={'expected_scope': scope})
        self.assertEqual(status.status_code, 200, status.text)
        self.assertEqual(status.json(), response.json())
        state = self.client.get('/api/plugins/workspace/state').json()
        self.assertEqual([item['id'] for item in state['items']], [page['id']])
        self.selected_home = Path(self.temp.name) / 'other-receipt-owner'
        self.assertEqual(self.client.get('/api/plugins/workspace/restore-status/' + 'a' * 32,
                         params={'expected_scope': scope}).status_code, 409)
        self.assertEqual(self.client.get('/api/plugins/workspace/restore-status/' + 'a' * 32,
                         params={'expected_scope': self.scope()}).status_code, 404)

    def test_restore_same_operation_never_replaces_newer_data_again(self):
        page = self.command('create_item', {'kind': 'page', 'title': 'Original'}).json()['result']
        archive = self.client.get('/api/plugins/workspace/backup').json()['data_base64']
        request = {'data_base64': archive, 'expected_scope': self.scope(),
                   'restore_id': 'b' * 32, 'include_state': False, 'expected_revision': self.client.get('/api/plugins/workspace/state').json()['revision']}
        self.assertEqual(self.client.post('/api/plugins/workspace/restore-backup', json=request).status_code, 200)
        self.command('update_item', {'id': page['id'], 'patch': {'title': 'Newer saved content'}})
        before = self.client.get('/api/plugins/workspace/state').json()
        response = self.client.post('/api/plugins/workspace/restore-backup', json=request)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json(), before)
        changed = {**request, 'data_base64': self.client.get('/api/plugins/workspace/backup').json()['data_base64']}
        self.assertEqual(self.client.post('/api/plugins/workspace/restore-backup', json=changed).status_code, 409)
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json(), before)

    def test_refused_restore_has_a_receipt_without_mutating_state(self):
        self.command('create_item', {'kind': 'page', 'title': 'Keep this'})
        before = self.client.get('/api/plugins/workspace/state').json()
        response = self.client.post('/api/plugins/workspace/restore-backup', json={
            'data_base64': base64.b64encode(b'not an archive').decode(),
            'expected_scope': self.scope(), 'restore_id': 'c' * 32, 'include_state': False, 'expected_revision': self.client.get('/api/plugins/workspace/state').json()['revision']})
        self.assertEqual(response.status_code, 400, response.text)
        status = self.client.get('/api/plugins/workspace/restore-status/' + 'c' * 32,
                                 params={'expected_scope': self.scope()})
        self.assertEqual(status.status_code, 200, status.text)
        self.assertEqual(status.json()['status'], 'refused')
        self.assertTrue(status.json()['detail'])
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json(), before)

    def test_lost_restore_response_can_be_read_back_without_another_replacement(self):
        page = self.command('create_item', {'kind': 'page', 'title': 'Delivered by readback'}).json()['result']
        archive = self.client.get('/api/plugins/workspace/backup').json()['data_base64']
        self.command('create_item', {'kind': 'page', 'title': 'Replaced marker'})
        scope = self.scope()
        posts = []

        def lose_response(response):
            if response.request.url.path.endswith('/restore-backup'):
                posts.append(response.request.method)
                raise httpx.ReadError('Synthetic response-delivery loss after the real endpoint committed')

        self.client.event_hooks['response'].append(lose_response)
        try:
            with self.assertRaises(httpx.ReadError):
                self.client.post('/api/plugins/workspace/restore-backup', json={
                    'data_base64': archive, 'expected_scope': scope,
                    'restore_id': 'd' * 32, 'include_state': False, 'expected_revision': self.client.get('/api/plugins/workspace/state').json()['revision']})
        finally:
            self.client.event_hooks['response'].remove(lose_response)
        result = self.client.get('/api/plugins/workspace/restore-status/' + 'd' * 32,
                                 params={'expected_scope': scope})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['status'], 'committed')
        state = self.client.get('/api/plugins/workspace/state').json()
        self.assertEqual([item['id'] for item in state['items']], [page['id']])
        self.assertEqual(posts, ['POST'])
        # A readback never changes revision or data.
        self.client.get('/api/plugins/workspace/restore-status/' + 'd' * 32,
                        params={'expected_scope': scope})
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json(), state)

    def test_running_restore_receipt_does_not_start_duplicate_worker(self):
        from dashboard import plugin_api

        self.command('create_item', {'kind': 'page', 'title': 'One replacement'})
        archive = self.client.get('/api/plugins/workspace/backup').json()['data_base64']
        scope = self.scope()
        body = {'data_base64': archive, 'expected_scope': scope,
                'restore_id': 'e' * 32, 'include_state': False, 'expected_revision': self.client.get('/api/plugins/workspace/state').json()['revision']}
        entered, release = threading.Event(), threading.Event()
        interchange = plugin_api._module('interchange')
        original = interchange.restore_into_store
        calls, responses, failures = [], [], []

        def hold_completion(*args, **kwargs):
            result = original(*args, **kwargs)  # Real validation and SQLite replacement.
            calls.append(result)
            entered.set()
            if not release.wait(5):
                raise RuntimeError('Fixture completion barrier timed out')
            return result

        def submit():
            try:
                responses.append(self.client.post('/api/plugins/workspace/restore-backup', json=body))
            except BaseException as exc:
                failures.append(exc)

        with patch.object(interchange, 'restore_into_store', side_effect=hold_completion):
            worker = threading.Thread(target=submit)
            worker.start()
            try:
                self.assertTrue(entered.wait(5))
                status = self.client.get('/api/plugins/workspace/restore-status/' + 'e' * 32,
                                         params={'expected_scope': scope})
                self.assertEqual(status.status_code, 200, status.text)
                self.assertEqual(status.json()['status'], 'running')
                duplicate = self.client.post('/api/plugins/workspace/restore-backup', json=body)
                self.assertEqual(duplicate.status_code, 202, duplicate.text)
                self.assertEqual(duplicate.json()['status'], 'running')
                self.assertEqual(len(calls), 1)
                committed = self.client.get('/api/plugins/workspace/state').json()
                stale_edit = self.command('update_item', {
                    'id': committed['items'][0]['id'], 'patch': {'title': 'Stale edit'},
                    'expected_revision': body['expected_revision']})
                self.assertEqual(stale_edit.status_code, 409, stale_edit.text)
                self.assertEqual(self.client.get('/api/plugins/workspace/state').json(), committed)
            finally:
                release.set()
                worker.join(5)
        self.assertFalse(worker.is_alive())
        self.assertFalse(failures, failures)
        self.assertEqual(responses[0].status_code, 200, responses[0].text)
        self.assertEqual(responses[0].json()['status'], 'committed')

    def test_compact_restore_requires_revision_and_preserves_an_edit_that_won_first(self):
        page = self.command('create_item', {'kind': 'page', 'title': 'Before'}).json()['result']
        archive = self.client.get('/api/plugins/workspace/backup').json()['data_base64']
        request = {'data_base64': archive, 'expected_scope': self.scope(),
                   'restore_id': 'f' * 32, 'include_state': False}
        invalid = self.client.post('/api/plugins/workspace/restore-backup', json=request)
        self.assertEqual(invalid.status_code, 400, invalid.text)
        self.assertIn('revision', invalid.json()['detail'])
        before = self.client.get('/api/plugins/workspace/state').json()
        request['expected_revision'] = before['revision']
        self.command('update_item', {'id': page['id'], 'patch': {'title': 'User edit won first'}})
        edited = self.client.get('/api/plugins/workspace/state').json()
        stale = self.client.post('/api/plugins/workspace/restore-backup', json=request)
        self.assertEqual(stale.status_code, 409, stale.text)
        self.assertEqual(self.client.get('/api/plugins/workspace/state').json(), edited)
        status = self.client.get('/api/plugins/workspace/restore-status/' + 'f' * 32,
                                 params={'expected_scope': self.scope()})
        self.assertEqual(status.status_code, 200, status.text)
        self.assertEqual(status.json()['status'], 'refused')


if __name__ == '__main__':
    unittest.main()
