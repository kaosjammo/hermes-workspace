"""Actual upstream native HTTP/profile/plugin-host bridges with synthetic state.

Run with the pinned host's normal pytest fixtures and an isolated output root.
The daemon carries a real TicketStore and synthetic runner;
no real gateway owner, private profile or provider is used.
"""
from pathlib import Path
import shutil

from hermes_cli.plugin_host import PluginHost
from tests.hermes_cli import test_plugin_api_consent_gate as consent
from tests.hermes_cli import test_plugin_secondary_profile_host as secondary

daemon = consent.daemon
ROOT = Path(__file__).resolve().parents[2]


def install(home):
    package = home / 'plugins/workspace'
    package.mkdir(parents=True)
    for name in ('dashboard', 'workspace_plugin', 'desktop'):
        shutil.copytree(ROOT / name, package / name, ignore=shutil.ignore_patterns('__pycache__'))
    for name in ('__init__.py', 'plugin.yaml'):
        shutil.copy2(ROOT / name, package / name)
    consent._plugins(home, enabled=['workspace'])


def create(client, headers, title):
    base = '/api/plugins/workspace'
    fresh = headers if callable(headers) else lambda: headers
    response = client.get(base + '/state', headers=fresh())
    assert response.status_code == 200, response.text
    state = response.json()
    saved = client.post(base + '/command', headers=fresh(), json={
        'op': 'create_item', 'expected_scope': state['scope_id'],
        'payload': {'kind': 'page', 'title': title, 'expected_revision': state['revision']}})
    assert saved.status_code == 200, saved.text
    return saved.json()


def test_actual_native_profile_bridge_and_hosted_storage_isolation(daemon, monkeypatch):
    monkeypatch.setattr(PluginHost, 'asgi_request', secondary._REAL_ASGI_REQUEST)
    install(daemon.launch)
    install(daemon.beta)
    try:
        a = create(daemon.client, daemon.owner, 'launch synthetic')
        b = create(daemon.client, daemon.beta_ticket, 'beta synthetic')
        assert a['state']['scope_id'] != b['state']['scope_id']
        assert [row['title'] for row in a['state']['items']] == ['launch synthetic']
        assert [row['title'] for row in b['state']['items']] == ['beta synthetic']
        stale = daemon.client.post('/api/plugins/workspace/command', headers=daemon.beta_ticket(), json={
            'op': 'create_item', 'expected_scope': a['state']['scope_id'],
            'payload': {'kind': 'page', 'title': 'must not cross'}})
        assert stale.status_code == 409
        unauthorized = daemon.client.post('/api/plugins/workspace/command', params={'profile': 'beta'},
            headers={'X-Hosted-Http-Authenticated': 'true'}, json={
                'op': 'create_item', 'expected_scope': b['state']['scope_id'],
                'payload': {'kind': 'page', 'title': 'forged'}})
        assert unauthorized.status_code == 401
        after = daemon.client.get('/api/plugins/workspace/state', headers=daemon.beta_ticket()).json()
        # /state adds server identity; command.state is the Store snapshot.
        # Compare every persisted field, and independently require the real
        # authenticated route's human identity instead of dropping authority.
        assert after['identity']['human']['kind'] == 'human'
        assert after['identity']['source_id'] == after['identity']['human']['id']
        assert {key: value for key, value in after.items() if key != 'identity'} == b['state']
    finally:
        secondary._shutdown_hosts()
