import { useEffect, useId, useRef, useState } from 'react';
import { SearchField, GlyphSpinner } from '@hermes/plugin-sdk';
import { h, Action, Codicon, errorMessage } from './ui.jsx';

/** This component owns typing state so a keystroke never re-renders/retires the
 * document or flushes its drafts. Only explicit result activation navigates. */
export function WorkspaceSearch({ client, scope, revision, destination, onOpen, contexts }) {
  const [query, setQuery] = useState(''), [result, setResult] = useState(null);
  const [composing, setComposing] = useState(false), [retry, setRetry] = useState(0);
  const [page, setPage] = useState({ offset: 0, revision: null });
  const generation = useRef(0), input = useRef(null), list = useRef(null);
  const statusId = useId();
  const text = query.trim();
  const change = value => {
    generation.current++;
    client.cancelSearch();
    setQuery(value); setResult(null); setPage({ offset: 0, revision: null });
  };
  useEffect(() => {
    generation.current++; client.cancelSearch();
    setQuery(''); setResult(null); setPage({offset:0,revision:null});
  }, [client, scope, destination]);
  useEffect(() => {
    const node = input.current;
    if (!node) return;
    // Public SearchField exposes inputRef, but does not forward composition
    // handlers. Subscribe only to its own input and remove both on unmount.
    const start = () => { generation.current++; client.cancelSearch(); setComposing(true); setResult(null); };
    const end = () => setComposing(false);
    node.addEventListener('compositionstart', start); node.addEventListener('compositionend', end);
    node.setAttribute('aria-describedby', statusId);
    return () => { node.removeEventListener('compositionstart', start); node.removeEventListener('compositionend', end); };
  }, [client, statusId]);
  useEffect(() => {
    const version = ++generation.current;
    let active = true;
    if (!text || composing || text.length > 500) return;
    const timer = setTimeout(() => {
      setResult({ phase: 'pending', query: text, items: [] });
      client.search(text, page).then(found => {
        if (!active || version !== generation.current || !client.current()) return;
        const items = Array.isArray(found) ? found : (found?.items ?? found?.results);
        if (!Array.isArray(items)) throw new Error('Workspace returned invalid search results.');
        setResult({ phase: 'success', query: text, items,
          total: found.total, offset: found.offset, limit: found.limit,
          revision: found.revision, nextOffset: found.next_offset, hasMore: found.has_more });
      }).catch(error => {
        if (active && version === generation.current && client.current())
          setResult({ phase: 'error', query: text, items: [], error: errorMessage(error) });
      });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [client, scope, revision, query, text, composing, retry, page]);
  useEffect(() => () => { generation.current++; client.cancelSearch(); }, [client, scope]);
  const current = result?.query === text ? result : null;
  const pending = Boolean(text && !composing && text.length <= 500 && (!current || current.phase === 'pending'));
  const message = text.length > 500 ? 'Use 500 characters or fewer.' : composing ? '' :
    pending ? 'Searching Workspace…' : current?.phase === 'error' ? 'Search did not finish.' :
      current?.phase === 'success' ? current.items.length ?
        `Results ${current.offset + 1}–${current.offset + current.items.length} of ${current.total}.` : 'No matches' : '';
  const turnPage = (offset, revision) => {
    generation.current++; client.cancelSearch(); setResult(null);
    setPage({ offset, revision });
    input.current?.focus();
  };
  return h('div', { className: 'ws-workspace-search', role: 'search', 'aria-label': 'Workspace search' },
    h(SearchField, {
      'aria-label': 'Search Workspace', placeholder: 'Search Workspace…',
      containerClassName: 'w-full opacity-100', inputClassName: 'ws-search-input', inputRef: input,
      value: query, onChange: change, onClear: () => change(''), loading: pending,
      trailingAction: pending && query ? h(Action, {variant:'ghost',size:'icon-xs','aria-label':'Clear search',onClick:()=>change('')},h(Codicon,{name:'close',size:'0.875rem'})) : undefined,
      onKeyDown: event => {
        if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape' && query) { event.preventDefault(); change(''); }
        if (event.key === 'ArrowDown' && current?.phase === 'success') {
          const first = list.current?.querySelector('button');
          if (first) { event.preventDefault(); first.focus(); }
        }
      },
    }),
    h('p', { id: statusId, className: 'ws-search-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, message),
    current && h('section', { className: 'ws-search-results', 'aria-label': 'Workspace search results', 'aria-busy': pending },
      current.phase === 'pending' && h(GlyphSpinner, {ariaLabel:'Searching Workspace'}),
      current.phase === 'error' && h('div', null,
        h('p', {role:'alert'}, current.error),
        h(Action, {onClick:()=>{ setPage({offset:0,revision:null}); setRetry(v=>v+1); }}, 'Retry search')),
      h('ul', {ref:list}, current.items.map(row => h('li', {key:row.id??row.item_id},
        h(Action, {variant:'ghost',onClick:()=>onOpen(row.id??row.item_id),
          'aria-label':row.title??row.name??'Open result',
          'aria-describedby':`${statusId}-${row.id??row.item_id}-description`},
          h('span', {className:'ws-search-result-text'}, h('span',null,row.title??row.name??'Open result'),
            h('span',{id:`${statusId}-${row.id??row.item_id}-description`},
              contexts?.get(row.id??row.item_id) && h('small',null,contexts.get(row.id??row.item_id).description),
              (row.excerpt || row.snippet) && h('small',null,row.excerpt || row.snippet))))))),
      current.phase === 'success' && h('div', {className:'ws-actions','aria-label':'Search results pages'},
        current.offset > 0 && h(Action, {onClick:()=>turnPage(Math.max(0,current.offset-current.limit),current.revision)}, 'Previous results'),
        current.hasMore && h(Action, {onClick:()=>turnPage(current.nextOffset,current.revision)}, 'Next results'))));
}
