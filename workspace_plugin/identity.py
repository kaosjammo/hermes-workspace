"""Inert author metadata. No identity here is an admission or permission grant."""
import hashlib
from pathlib import Path
import re
import unicodedata


def human_id(home: Path) -> str:
    return hashlib.sha256(str(home.resolve()).encode()).hexdigest()


def username(value):
    if not isinstance(value, str):
        raise ValueError('Username must be text.')
    value = value.strip()
    if len(value) > 80 or any(unicodedata.category(c) in {'Cc', 'Cs', 'Cf'} for c in value):
        raise ValueError('Use at most 80 characters without control or invisible formatting characters.')
    return value or 'user'


MAX_AGENT_NAME = 4096


def _valid_agent_name(value):
    # Native titles have a different input contract from human usernames. Keep
    # joined emoji/international names, but never persist controls, surrogates or
    # directional overrides. Every label remains inert, literal display text.
    return (isinstance(value, str) and 0 < len(value) <= MAX_AGENT_NAME
            and value == value.strip()
            and not any(unicodedata.category(c) in {'Cc', 'Cs'}
                        or unicodedata.category(c) == 'Cf' and c not in {'\u200c', '\u200d'}
                        for c in value))


def agent_display(value, profile):
    """Bound native display data without throwing away a known executor."""
    value = value.strip() if isinstance(value, str) else ''
    return value if _valid_agent_name(value) else profile


def executor(home: Path, display_title=None):
    """Server identity plus inert title captured from the admitted Desktop route.

    A title never selects the home, canonical profile, source, role or rights.
    No profile metadata file or ambient selected profile is consulted.
    """
    from hermes_constants import profile_name_for_home
    profile = profile_name_for_home(home)
    if not profile:
        raise ValueError('Canonical executor profile is unavailable.')
    source = human_id(home)
    result = {'kind':'agent', 'id':hashlib.sha256((source + ':' + profile).encode()).hexdigest(),
              'name':agent_display(display_title, profile), 'profile':profile,
              'source_id':source, 'avatar_eligible':True}
    validate(result, 'agent')
    return result


def validate(value, kind=None):
    if value is None:
        return
    if not isinstance(value, dict) or value.get('kind') not in {'human', 'agent'}:
        raise ValueError('Invalid author identity.')
    role = value['kind']
    if kind is not None and role != kind:
        raise ValueError('Author identity does not match the entry role.')
    fields = {'kind','id','name'} | ({'profile','source_id','avatar_eligible'} if role == 'agent' else set())
    if set(value) != fields or not isinstance(value['id'], str) or re.fullmatch('[0-9a-f]{64}', value['id']) is None:
        raise ValueError('Invalid immutable author identity.')
    if (role == 'human' and username(value['name']) != value['name']
            or role == 'agent' and not _valid_agent_name(value['name'])):
        raise ValueError('Invalid author display name.')
    if role == 'agent':
        if not isinstance(value['profile'], str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,79}', value['profile']):
            raise ValueError('Invalid recorded executor profile.')
        if not isinstance(value['source_id'], str) or re.fullmatch('[0-9a-f]{64}', value['source_id']) is None or type(value['avatar_eligible']) is not bool:
            raise ValueError('Invalid recorded executor source.')
