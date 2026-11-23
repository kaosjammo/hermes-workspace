"""Bounded exact-preimage content edits; DATA only, no storage or authority.

Store resolves these under the existing admitted run transaction. Every range
refers to the same original document; ambiguous/overlapping/stale edits fail.
There is no fallback to a full-content overwrite.
"""
import hashlib
import re


class TargetedEditConflict(ValueError):
    pass


def content_revision(item):
    return {'expected_sha256': hashlib.sha256(item['content'].encode('utf-8')).hexdigest(),
            'expected_updated_at': item['updated_at'],
            'expected_manual_revision': item.get('_manual_revision', 0)}


def validate_content_edits(spec, max_content):
    fields = {'expected_sha256', 'expected_updated_at', 'expected_manual_revision', 'replacements'}
    if not isinstance(spec, dict) or set(spec) != fields:
        raise ValueError('Targeted content edits require exact content revision and replacements')
    if not isinstance(spec['expected_sha256'], str) or not re.fullmatch(r'[a-f0-9]{64}', spec['expected_sha256']):
        raise ValueError('Targeted content SHA256 must be an exact lowercase digest')
    revision = spec['expected_updated_at']
    if not isinstance(revision, str) or not revision or len(revision) > 80 or '\x00' in revision:
        raise ValueError('Targeted content updated_at must match the captured document revision')
    if type(spec['expected_manual_revision']) is not int or spec['expected_manual_revision'] < 0:
        raise ValueError('Targeted manual revision must be a nonnegative integer')
    replacements = spec['replacements']
    if not isinstance(replacements, list) or not 1 <= len(replacements) <= 100:
        raise ValueError('Targeted replacements must contain 1 to 100 exact ranges')
    total = 0
    for row in replacements:
        if not isinstance(row, dict) or set(row) != {'before', 'after'}:
            raise ValueError('Each targeted replacement requires before and after HTML')
        for name in ('before', 'after'):
            value = row[name]
            if not isinstance(value, str) or '\x00' in value or len(value) > max_content:
                raise ValueError('Targeted HTML must be bounded text without NUL')
            total += len(value)
        if not row['before']:
            raise ValueError('Targeted preimage must not be empty; include exact surrounding context')
    if total > 2 * max_content:
        raise ValueError('Targeted replacement data exceeds the document bound')


def resolve_content_edits(item, spec, sanitize, max_content):
    validate_content_edits(spec, max_content)
    current = content_revision(item)
    expected = {key: spec[key] for key in current}
    if expected != current:
        raise TargetedEditConflict('Targeted document revision changed; reread and review the intended changes')
    document = item['content']
    ranges = []
    for row in spec['replacements']:
        start = document.find(row['before'])
        if start < 0 or document.find(row['before'], start + 1) >= 0:
            raise TargetedEditConflict('Targeted preimage is missing or ambiguous; no content was changed')
        ranges.append((start, start + len(row['before']), row['after']))
    ranges.sort(key=lambda r: r[0])
    if any(right[0] < left[1] for left, right in zip(ranges, ranges[1:])):
        raise TargetedEditConflict('Targeted edits overlap; consolidate their exact original range before applying')
    parts, cursor = [], 0
    for start, end, replacement in ranges:
        parts.extend((document[cursor:start], replacement))
        cursor = end
    parts.append(document[cursor:])
    candidate = ''.join(parts)
    if len(candidate) > max_content:
        raise ValueError('Targeted result exceeds the document bound')
    if sanitize(candidate) != candidate:
        raise ValueError('Targeted HTML is not canonical supported content; no outside bytes may be normalized')
    return candidate
