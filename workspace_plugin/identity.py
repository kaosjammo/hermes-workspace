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
    return value if _valid_agent_name(value) else f'{profile} (display name unavailable)'


def executor(home: Path):
    """Capture ONLY the admitted executing home's host-internal structured metadata.

    Host-internal helpers retain catalogue rule 9 coupling; this is not a
    qualified public server metadata contract. The task-profile helper is
    checked against this exact home; launch
    pins/ambient active selection cannot relabel a differently scoped executor.
    No roster, free-form persona, model, credentials or image files are read.
    Images use the supported SDK avatar route, separately fenced by this source.
    """
    try:
        from hermes_cli.profiles import current_profile_name, profile_matches_home, read_profile_meta
        profile = current_profile_name()
        if not profile or not profile_matches_home(profile, home):
            return None
        meta = read_profile_meta(home)
        name = agent_display(meta.get('bot_title') or meta.get('display_name') or profile, profile)
        source = human_id(home)
        return {'kind':'agent', 'id':hashlib.sha256((source + ':' + profile).encode()).hexdigest(),
                'name':name, 'profile':profile, 'source_id':source, 'avatar_eligible':True}
    except (ImportError, OSError, ValueError, TypeError):
        return None


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
