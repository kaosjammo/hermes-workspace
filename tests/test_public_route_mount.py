"""Host-authenticated mounting, not a second private token check inside Workspace."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import FastAPI, Request
import httpx
from dashboard.plugin_api import create_router


class PublicRouteMountTests(unittest.IsolatedAsyncioTestCase):
    async def test_outer_host_gate_rejects_before_profile_resolution_and_plugin_uses_no_private_auth(self):
        with tempfile.TemporaryDirectory() as home:
            calls = []
            def owner():
                calls.append('profile')
                return Path(home)
            app = FastAPI()
            @app.middleware('http')
            async def host_gate(request: Request, call_next):
                if request.headers.get('X-Synthetic-Host-Ticket') != 'admitted':
                    from fastapi.responses import JSONResponse
                    return JSONResponse({'detail': 'Host denied'}, status_code=401)
                return await call_next(request)
            router = create_router(owner)
            self.assertEqual(router.dependencies, [])
            app.include_router(router, prefix='/api/plugins/workspace')
            with patch('hermes_cli.web_deps.late', side_effect=AssertionError('private auth called')):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://workspace.test') as client:
                    denied = await client.get('/api/plugins/workspace/state')
                    self.assertEqual(denied.status_code, 401)
                    self.assertEqual(calls, [])
                    allowed = await client.get('/api/plugins/workspace/state', headers={'X-Synthetic-Host-Ticket': 'admitted'})
                    self.assertEqual(allowed.status_code, 200, allowed.text)
                    self.assertEqual(allowed.json()['items'], [])
                    self.assertEqual(calls, ['profile'])


class PublicRouteConstructionTests(unittest.TestCase):
    def test_production_router_has_no_private_token_dependency(self):
        import dashboard.plugin_api as api
        import inspect
        self.assertEqual(api.create_router().dependencies, [])
        self.assertNotIn('_require_token', inspect.getsource(api))
        self.assertNotIn('web_deps', inspect.getsource(api))

    def test_explicit_test_host_gate_is_preserved_on_every_route(self):
        def synthetic_host_gate():
            raise AssertionError('Only construction is under test')
        router = create_router(authorize=synthetic_host_gate)
        self.assertEqual(len(router.dependencies), 1)
        self.assertIs(router.dependencies[0].dependency, synthetic_host_gate)
        for route in router.routes:
            self.assertTrue(any(dep.call is synthetic_host_gate for dep in route.dependant.dependencies), route.path)
