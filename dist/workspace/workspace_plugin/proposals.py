"""Bounded untrusted edit/outcome DATA validation; no native row authority."""
import json

from .store import MAX_COMMENTS, MAX_STATE, MAX_TEXT, MAX_CONTENT
from .targeted_edits import validate_content_edits

EDIT_FIELDS = {'title', 'content', 'content_edits', 'properties', 'columns'}


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate proposal field')
        result[key] = value
    return result


def _text(value, limit=256):
    if not isinstance(value, str) or not value or len(value) > limit or '\x00' in value:
        raise ValueError('Expected bounded nonempty proposal text')
    return value


def _canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def parse_proposal(text):
    """Parse finite DATA only; there are deliberately no model-owned identity fields."""
    _text(text, MAX_STATE)
    if len(text.encode('utf-8')) > MAX_STATE:
        raise ValueError('Final proposal exceeds Workspace storage bound')
    def nonfinite(_value):
        raise ValueError('Non-finite proposal number')
    try:
        value = json.loads(text, object_pairs_hook=_object, parse_constant=nonfinite)
        if not isinstance(value, dict) or set(value) != {'edits', 'replies'}:
            raise ValueError('Final proposal accepts only edits and replies')
        edits, replies = value['edits'], value['replies']
        if not isinstance(edits, list) or len(edits) > 100 or not isinstance(replies, list) or len(replies) > MAX_COMMENTS:
            raise ValueError('Final proposal arrays exceed Workspace bounds')
        for edit in edits:
            if not isinstance(edit, dict) or set(edit) != {'item_id', 'patch'}:
                raise ValueError('Each proposed edit requires item_id and patch')
            _text(edit['item_id'])
            if not isinstance(edit['patch'], dict) or not set(edit['patch']) <= EDIT_FIELDS:
                raise ValueError('Proposal cannot change ownership, binding, deletion or resolution')
            for name, data in edit['patch'].items():
                expected = {'title': str, 'content': str, 'content_edits': dict, 'properties': dict, 'columns': list}[name]
                if not isinstance(data, expected):
                    raise ValueError('Proposed patch values must match their typed fields')
                if name == 'content_edits':
                    if 'content' in edit['patch']:
                        raise ValueError('Choose targeted edits or full content, never both')
                    validate_content_edits(data, MAX_CONTENT)
        seen = set()
        for reply in replies:
            if not isinstance(reply, dict) or set(reply) != {'comment_id', 'text'}:
                raise ValueError('Each proposed outcome requires comment_id and text')
            _text(reply['comment_id']); _text(reply['text'], MAX_TEXT)
            if reply['comment_id'] in seen:
                raise ValueError('Duplicate proposed comment outcome')
            seen.add(reply['comment_id'])
        _canonical(value)  # Reject overflow to infinity, even when its JSON token was finite.
        return value
    except (RecursionError, OverflowError, UnicodeError) as exc:
        raise ValueError('Final proposal must be bounded finite JSON') from exc


def validate_proposal(proposal, run):
    """Validate DATA against captured server scope; this never grants write authority."""
    proposal = parse_proposal(_canonical(proposal))
    if {reply['comment_id'] for reply in proposal['replies']} != set(run['comment_ids']):
        raise ValueError('An outcome is required for every captured unresolved comment')
    if any(edit['item_id'] not in run['allowed_item_ids'] for edit in proposal['edits']):
        raise ValueError('Proposed edit is outside captured user-approved scope')
    return proposal

