"""Production router/Store with synthetic host admission and homes, no provider."""
from host_auth import host_auth
from runtime_paths import fixture_root
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from hermes_cli.plugin_host_http_auth import with_hosted_admission
from dashboard.plugin_api import create_router


class IdentityApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp=TemporaryDirectory(dir=fixture_root('fixtures'))
        self.home=Path(self.tmp.name)/'owner-a'
        app=FastAPI();app.include_router(create_router(lambda:self.home,authorize=host_auth))
        self.client=TestClient(with_hosted_admission(app,True))
        self.denied=TestClient(with_hosted_admission(app,False))

    def tearDown(self):
        self.client.close();self.denied.close();self.tmp.cleanup()

    def state(self):
        return self.client.get('/state').json()

    def command(self,op,payload,state=None,client=None):
        state=state or self.state()
        return (client or self.client).post('/command',json={'op':op,'expected_scope':state['scope_id'],
            'payload':{**payload,'expected_revision':state['revision']}})

    def test_authenticated_username_persists_and_profile_scope_does_not_cross(self):
        initial=self.state()
        self.assertEqual(initial['identity']['human']['name'],'user')
        saved=self.command('set_username',{'name':'庭 Ω'})
        self.assertEqual(saved.status_code,200,saved.text)
        self.assertEqual(saved.json()['identity']['human']['name'],'庭 Ω')
        self.assertEqual(self.state()['identity']['human']['id'],initial['identity']['human']['id'])
        self.home=Path(self.tmp.name)/'owner-b'
        self.assertEqual(self.state()['identity']['human']['name'],'user')
        stale=self.command('set_username',{'name':'Wrong owner'},state=saved.json()['state'])
        self.assertEqual(stale.status_code,409,stale.text)
        self.assertEqual(self.state()['identity']['human']['name'],'user')
        self.home=Path(self.tmp.name)/'owner-a'
        self.assertEqual(self.state()['identity']['human']['name'],'庭 Ω')

    def test_unadmitted_spoofed_or_stale_payloads_make_no_identity_change(self):
        before=self.state()
        self.assertEqual(self.command('set_username',{'name':'Denied'},client=self.denied).status_code,401)
        for field in ('author_identity','actor','principal_id','profile_home'):
            response=self.command('set_username',{'name':'Forged',field:'forged'})
            self.assertEqual(response.status_code,400,response.text)
        saved=self.command('set_username',{'name':'Accepted'})
        self.assertEqual(saved.status_code,200)
        self.assertEqual(self.command('set_username',{'name':'Stale'},state=before).status_code,409)
        self.assertEqual(self.state()['identity']['human']['name'],'Accepted')
        self.assertEqual(self.client.get('/workspaces').status_code,503,'Existing production shared composition gate stays closed')


if __name__=='__main__': unittest.main()
