"""Produce an installable unified plugin and deterministic local review archive."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile


def package(root: Path, output: Path):
    names = ['plugin.yaml', '__init__.py', 'dashboard/manifest.json',
             'dashboard/plugin_api.py', 'desktop/plugin.js', 'requirements.txt',
             'requirements.lock']
    names += [str(p.relative_to(root)) for p in sorted((root / 'workspace_plugin').glob('*.py'))]
    names += [name for name in ['README.md', 'THIRD-PARTY-NOTICES.md'] if (root / name).is_file()]
    output.mkdir(parents=True, exist_ok=True)
    destination = output / 'workspace'
    if destination.exists():
        raise ValueError('Choose a fresh output directory; an existing package is never overwritten.')
    inventory = []
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode='w') as tar:
        for name in names:
            source = root / name
            if source.is_symlink() or not source.is_file():
                raise ValueError('Missing or linked package input: ' + name)
            data = source.read_bytes()
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            target.chmod(0o644)
            inventory.append({'path': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
            member = tarfile.TarInfo('workspace/' + name)
            member.size = len(data)
            member.mode = 0o644
            member.mtime = 0
            tar.addfile(member, io.BytesIO(data))
    archive_path = output / 'workspace.tar.gz'
    with archive_path.open('wb') as stream, gzip.GzipFile(fileobj=stream, mode='wb', filename='', mtime=0) as zipped:
        zipped.write(archive.getvalue())
    result = {'package': str(destination.resolve()), 'archive': str(archive_path.resolve()),
              'archive_sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(), 'files': inventory}
    (output / 'inventory.json').write_text(json.dumps(result, indent=2) + '\n')
    # Qualification imports must not silently add bytecode to this sealed tree.
    # Runtime data belongs outside the installation, so the staged copy needs no
    # write permission. The archive retains ordinary installable source modes.
    for path in destination.rglob('*'):
        if path.is_file():
            path.chmod(0o444)
    for path in sorted(destination.rglob('*'), reverse=True):
        if path.is_dir():
            path.chmod(0o555)
    destination.chmod(0o555)
    print(json.dumps({key: value for key, value in result.items() if key != 'files'}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('.local/dist'))
    args = parser.parse_args()
    package(Path(__file__).resolve().parents[1], args.output.resolve())
