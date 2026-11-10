"""Verify the exact staged and archived member sets against the package receipt."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile


def verify(output: Path):
    receipt = json.loads((output / 'inventory.json').read_text())
    root = output / 'workspace'
    expected = {row['path']: row for row in receipt['files']}
    actual = {str(path.relative_to(root)) for path in root.rglob('*') if path.is_file()}
    if actual != set(expected):
        raise ValueError(f'Package members differ: extras={sorted(actual-set(expected))}; missing={sorted(set(expected)-actual)}')
    for name, row in expected.items():
        path = root / name
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Package member is linked or changed: ' + name)
    archive = output / 'workspace.tar.gz'
    if hashlib.sha256(archive.read_bytes()).hexdigest() != receipt['archive_sha256']:
        raise ValueError('Package archive changed.')
    with tarfile.open(archive) as tar:
        members = tar.getmembers()
        if len(members) != len(expected) or {m.name for m in members} != {'workspace/' + name for name in expected}:
            raise ValueError('Archive member set differs.')
        for member in members:
            if not member.isfile() or member.issym() or member.islnk():
                raise ValueError('Archive member is not a regular file.')
            data = tar.extractfile(member).read()
            if hashlib.sha256(data).hexdigest() != expected[member.name.removeprefix('workspace/')]['sha256']:
                raise ValueError('Archive member changed: ' + member.name)
    print(json.dumps({'files': len(expected), 'archive_sha256': receipt['archive_sha256'], 'exact_members': True}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    verify(parser.parse_args().output.resolve())
