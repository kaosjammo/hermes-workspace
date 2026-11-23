"""External exact-member packaging; never writes the tracked distribution."""
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import tarfile

root=Path.cwd()
out=Path(os.environ['ISSUE9_EVIDENCE'])
build=Path(os.environ['ISSUE9_BUILD'])
stage=out/'stage';stage.mkdir()
names=['plugin.yaml','__init__.py','dashboard/manifest.json','dashboard/plugin_api.py',
       'desktop/plugin.js','requirements.txt','requirements.lock','README.md','THIRD-PARTY-NOTICES.md']
names += [str(p.relative_to(root))for p in sorted((root/'workspace_plugin').glob('*.py'))]
inputs={}
for name in names:
    source=build/'build/production-plugin.js' if name=='desktop/plugin.js' else root/name
    data=source.read_bytes();target=stage/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    inputs[name]=hashlib.sha256(data).hexdigest()
runpy.run_path(str(root/'scripts/package.py'))['package'](stage,out/'dist')
inventory=json.loads((out/'dist/inventory.json').read_text())
assert {f['path']:f['sha256']for f in inventory['files']}==inputs
with tarfile.open(out/'dist/workspace.tar.gz')as archive:
    members=archive.getmembers()
    assert len(members)==len(names) and {m.name for m in members}=={'workspace/'+n for n in names}
    for member in members:
        assert member.isfile() and not member.issym() and not member.islnk()
        name=member.name.removeprefix('workspace/')
        assert hashlib.sha256(archive.extractfile(member).read()).hexdigest()==inputs[name]
        assert hashlib.sha256((out/'dist/workspace'/name).read_bytes()).hexdigest()==inputs[name]
receipt={'members':len(names),'inputs':inputs,'archive_sha256':inventory['archive_sha256'],
         'scope':'Production-shaped external package with exact source and rebuilt external distribution; no installation/catalogue/provider acceptance'}
(out/'package-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'members':len(names),'archive_sha256':inventory['archive_sha256'],'status':'PASS_EXACT_PACKAGE'}))
