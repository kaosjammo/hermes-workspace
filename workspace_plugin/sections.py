"""Bounded rich-section mapping for Workspace's saved agent changes.

This module has no storage/native authority. Store supplies admitted HTML and its
existing plain-text/sanitization helpers, and owns revisions, generations and
confirmation. Mapping uncertainty is an unavailable state, never a wider patch.
"""
from difflib import SequenceMatcher
import html
import re


class SectionUnavailable(ValueError):
    pass


_TOKEN = re.compile(r'<[^>]*>|&(?:#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);|\w+|\s+|[^\w\s]', re.UNICODE)
# A separate analysis bound never authorises larger stored documents or writes.
# Larger/complex comparisons remain readable but cannot offer a guessed revert.
MAX_ANALYSIS_TOKENS = 16000


def locate_anchor(text, anchor):
    if not anchor or not anchor.get('quote'):
        raise SectionUnavailable('The highlighted section is detached.')
    prefix, quote, suffix = (anchor.get(k, '') for k in ('prefix', 'quote', 'suffix'))
    needle = prefix + quote + suffix
    positions = []
    pos = text.find(needle)
    while pos >= 0:
        positions.append(pos + len(prefix))
        if len(positions) > 1:
            break
        pos = text.find(needle, pos + 1)
    if len(positions) != 1:
        raise SectionUnavailable('The highlighted section is missing or ambiguous.')
    return positions[0], positions[0] + len(quote)


def _tokens(document, plain):
    result, offset = [], 0
    for match in _TOKEN.finditer(document):
        raw = match.group()
        text = '' if raw.startswith('<') else html.unescape(raw)
        result.append((raw, match.start(), match.end(), offset, offset + len(text)))
        offset += len(text)
        if len(result) > MAX_ANALYSIS_TOKENS:
            raise SectionUnavailable('This document is too complex for a safely isolated section revert.')
    if ''.join('' if t[0].startswith('<') else html.unescape(t[0]) for t in result) != plain(document):
        raise SectionUnavailable('The rich section cannot be mapped without changing its structure.')
    return result


def _diff(before, after, plain):
    left, right = _tokens(before, plain), _tokens(after, plain)
    def point(tokens, index, length, text_length):
        return (tokens[index][1], tokens[index][3]) if index < len(tokens) else (length, text_length)
    old_length, new_length = len(plain(before)), len(plain(after))
    result = []
    for kind, i, end_i, j, end_j in SequenceMatcher(None, [t[0] for t in left], [t[0] for t in right], autojunk=True).get_opcodes():
        start, text_start = point(left, i, len(before), old_length)
        end, text_end = point(left, end_i, len(before), old_length)
        new_start, _ = point(right, j, len(after), new_length)
        new_end, _ = point(right, end_j, len(after), new_length)
        old, new = before[start:end], after[new_start:new_end]
        if kind != 'equal' and '<' not in old + new and '&' not in old + new and len(old) + len(new) <= 4096:
            for subkind, a, b, c, d in SequenceMatcher(None, old, new, autojunk=False).get_opcodes():
                result.append((subkind, start+a, start+b, new_start+c, new_start+d, text_start+a, text_start+b))
        else:
            result.append((kind, start, end, new_start, new_end, text_start, text_end))
    return left, result


def _raw_position(tokens, offset, end=False):
    text = [token for token in tokens if token[4] > token[3]]
    ordered = reversed(text) if end else text
    for raw, start, finish, a, b in ordered:
        if a <= offset <= b:
            if offset == a:
                return start
            if offset == b:
                return finish
            if '&' in raw:
                raise SectionUnavailable('The selection splits an encoded character.')
            return start + offset - a
    raise SectionUnavailable('The highlighted section has no safely mapped text.')


def _mapped_position(operations, position, end=False):
    candidates = []
    for kind, a, b, c, d, _, _ in operations:
        if a < position < b:
            if kind != 'equal':
                raise SectionUnavailable('A change crosses the highlighted section boundary.')
            candidates.append(c + position - a)
        if position == a:
            candidates.append(c)
        if position == b:
            candidates.append(d)
    if not candidates:
        raise SectionUnavailable('The section boundary can no longer be identified.')
    return max(candidates) if end else min(candidates)


def _anchor(document, start, end, plain):
    text, prefix, quote = plain(document), plain(document[:start]), plain(document[start:end])
    if not quote:
        raise SectionUnavailable('The changed highlighted section was removed.')
    position = len(prefix)
    value = {'quote': quote, 'prefix': text[max(0, position-32):position], 'suffix': text[position+len(quote):position+len(quote)+32]}
    if locate_anchor(text, value) != (position, position + len(quote)):
        raise SectionUnavailable('The changed section is ambiguous.')
    return value


def capture_sections(before, after, anchors, plain):
    """Return per-comment actual-change regions or explicit unavailable reasons.

    Unchanged anchors are omitted. Overlap and changes crossing a selection are
    refused rather than grouping unrelated changes into one section.
    """
    if before == after:
        return {}
    tokens, operations = _diff(before, after, plain)
    text, selections, output = plain(before), {}, {}
    for ident, anchor in anchors.items():
        try:
            selections[ident] = locate_anchor(text, anchor)
        except SectionUnavailable as error:
            output[ident] = {'status': 'unavailable', 'reason': str(error)}
    for ident, (start, end) in selections.items():
        changes = [op for op in operations if op[0] != 'equal' and
                   (op[5] < end and op[6] > start or op[5] == op[6] and start <= op[5] <= end)]
        if not changes:
            continue
        try:
            if any(max(start, other_start) < min(end, other_end)
                   for other_id, (other_start, other_end) in selections.items() if other_id != ident):
                raise SectionUnavailable('Overlapping highlighted sections cannot be reverted independently.')
            if any(op[5] < start or op[6] > end for op in changes):
                raise SectionUnavailable('The agent change crosses this highlighted section; review the saved version.')
            raw_start = min(_raw_position(tokens, start), *(op[1] for op in changes))
            raw_end = max(_raw_position(tokens, end, True), *(op[2] for op in changes))
            post_start = _mapped_position(operations, raw_start)
            post_end = _mapped_position(operations, raw_end, True)
            old, new = before[raw_start:raw_end], after[post_start:post_end]
            if old == new:
                continue
            output[ident] = {'status': 'available', 'before_start': raw_start, 'before_end': raw_end,
                             'after_start': post_start, 'after_end': post_end,
                             'before': old, 'after': new,
                             'anchor': _anchor(after, post_start, post_end, plain)}
        except SectionUnavailable as error:
            output[ident] = {'status': 'unavailable', 'reason': str(error)}
    return output



def addressed_anchor(change, plan, current_document, plain):
    """Paint actual changed words, independently of the saved revert boundary.

    Stored section provenance remains unchanged. Disjoint changed passages or
    unmappable later edits have no guessed union highlight.
    """
    before, after = change['before'], change['after']
    _, operations = _diff(before, after, plain)
    changed = [op for op in operations if op[0] != 'equal']
    if not changed:
        raise SectionUnavailable('No addressed text range is available.')
    text = plain(after)
    if plain(before) == text:
        # Count alone is insufficient: two unrelated URL edits are two opening
        # tags, not the opening/closing boundaries of one formatted passage.
        def wrapper_pair(left, right):
            opening = re.fullmatch(r'<([a-z][a-z0-9]*)\b[^>]*>', left)
            return bool(opening and re.fullmatch(r'</' + opening[1] + r'\s*>', right))

        if len(changed) != 2:
            raise SectionUnavailable('Separate formatting changes have no single exact highlight.')
        first, last = changed
        old = (before[first[1]:first[2]], before[last[1]:last[2]])
        new = (after[first[3]:first[4]], after[last[3]:last[4]])
        if not (wrapper_pair(*old) or old == ('', '')) or not (wrapper_pair(*new) or new == ('', '')):
            raise SectionUnavailable('Markup changes do not identify one formatted passage.')
        spans = [(len(plain(after[:min(op[3] for op in changed)])),
                  len(plain(after[:max(op[4] for op in changed)])))]
    else:
        spans = []
        for op in changed:
            a, b = len(plain(after[:op[3]])), len(plain(after[:op[4]]))
            if a == b:
                continue
            while a > 0 and text[a-1].isalnum() and a < len(text) and text[a].isalnum():
                a -= 1
            while b < len(text) and b > 0 and text[b-1].isalnum() and text[b].isalnum():
                b += 1
            if spans and not text[spans[-1][1]:a].strip():
                spans[-1] = (spans[-1][0], max(b,spans[-1][1]))
            elif spans and a <= spans[-1][1]:
                spans[-1] = (spans[-1][0], max(b,spans[-1][1]))
            else:
                spans.append((a,b))
    if len(spans) != 1 or spans[0][0] == spans[0][1]:
        raise SectionUnavailable('This feedback changed separate or removed passages; an exact highlight is unavailable.')
    tokens = _tokens(after,plain)
    a, b = _raw_position(tokens,spans[0][0]), _raw_position(tokens,spans[0][1],True)
    _, later = _diff(after,plan['current'],plain)
    start = plan['current_start'] + _mapped_position(later,a)
    end = plan['current_start'] + _mapped_position(later,b,True)
    return _anchor(current_document,start,end,plain)


def map_anchor(document, current_document, anchor, plain, sanitize):
    """Map the exact selection through edits without stale prefix guessing."""
    start,end = locate_anchor(plain(document),anchor)
    tokens = _tokens(document,plain)
    a,b = _raw_position(tokens,start),_raw_position(tokens,end,True)
    region = document[a:b]
    change = {'status':'available','before':region,'after':region,'after_start':a,'after_end':b}
    return plan_revert(change,document,current_document,plain,sanitize)['anchor']


def plan_revert(change, post_document, current_document, plain, sanitize):
    """Map the same section through later edits; retain every outside byte."""
    if change.get('status') != 'available':
        raise SectionUnavailable(change.get('reason', 'This section is unavailable.'))
    start, end = change['after_start'], change['after_end']
    if post_document[start:end] != change['after']:
        raise SectionUnavailable('Saved section provenance no longer matches its agent version.')
    _, operations = _diff(post_document, current_document, plain)
    for kind, a, b, _, _, _, _ in operations:
        if kind == 'equal':
            continue
        if a < start < b or a < end < b or a == b and a in (start, end):
            raise SectionUnavailable('A later edit changed the section boundary; review the saved version.')
    current_start = _mapped_position(operations, start)
    current_end = _mapped_position(operations, end, True)
    candidate = current_document[:current_start] + change['before'] + current_document[current_end:]
    if sanitize(candidate) != candidate:
        raise SectionUnavailable('The rich structure cannot be restored without affecting outside content.')
    return {'content': candidate, 'current_start': current_start, 'current_end': current_end,
            'current': current_document[current_start:current_end],
            'anchor': _anchor(current_document, current_start, current_end, plain)}
