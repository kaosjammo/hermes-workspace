"""Synthetic admitted HTTP fixture; production router, Store and SQLite.

No Hermes execution/auth/native state. All owner data is under the explicitly isolated qualification root.
One process per call avoids sharing process-global profile state with other lanes.
"""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from dashboard.plugin_api import create_router

owner = Path(os.environ['UI_TEST_OWNER']).resolve()
if not owner.is_relative_to(Path(os.environ['HWS_QUALIFICATION_HOME']).resolve()):
    raise RuntimeError('Fixture owner must be UI-lane local synthetic state')
app = FastAPI()
app.include_router(create_router(lambda: owner, authorize=lambda: None))
request = json.loads(sys.stdin.readline())
with TestClient(app) as client:
    response = client.request(request.get('method', 'GET'), request['path'], json=request.get('body'))
    print(json.dumps({'status': response.status_code, 'body': response.json()}))
