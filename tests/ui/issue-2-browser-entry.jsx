import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { Workspace } from '../../frontend/workspace.jsx';
import { nousTheme, DEFAULT_TYPOGRAPHY } from '@/themes/presets';

const folder = (id, title, parent_id = null) => ({ id, title, parent_id, kind: 'folder', deleted_at: null });
const state = {
  scope_id: 'synthetic-issue-2', revision: 1,
  items: [folder('root', 'Field journals'), folder('nested', 'River garden', 'root'),
    folder('deep', 'Seasonal observations', 'nested'), folder('other', 'Reference notes'),
    { ...folder('reading', 'Summer journal', 'deep'), kind: 'page', properties: {}, columns: [],
      content: '<h2>Summer river garden</h2>' + Array.from({ length: 60 }, (_, i) => `<p>Observation ${i + 1}. Keep this synthetic reading passage and its surrounding context unchanged while organising folders.</p>`).join('') },
    { ...folder('second', 'Planting guide', 'other'), kind: 'page', properties: {}, columns: [], content: '<p>Planting instructions remain independent.</p>' }],
  comments: [], runs: [], versions: [], attachments: [], recents: [], templates: []
};
const calls = [];
let reads = 0;
const ctx = { onDispose: () => {}, rest: async (path, options) => {
  if (path === '/state') { reads++; return structuredClone(state); }
  if (path === '/command' && options.body.op === 'open_item') {
    calls.push(structuredClone(options.body));
    state.recents = [options.body.payload.id];
    return { result: {}, state: structuredClone(state) };
  }
  throw Error('Issue-2 render fixture refuses mutation: ' + path);
} };
window.issue2 = { snapshot: () => structuredClone({ state, calls, reads }) };
const theme = new URLSearchParams(location.search).get('theme') ?? 'light';
document.documentElement.classList.toggle('dark', theme === 'dark');
// The host ThemeProvider normally publishes these palette seeds. Reuse its
// pinned built-in palette without loading live host stores or preferences.
const colors = theme === 'dark' ? nousTheme.darkColors : nousTheme.colors;
const seeds = {
  '--theme-foreground': colors.foreground, '--theme-primary': colors.primary,
  '--theme-secondary': colors.secondary, '--theme-accent-soft': colors.accent,
  '--theme-midground': colors.midground ?? colors.ring, '--theme-warm': colors.primary,
  '--theme-background-seed': colors.background,
  '--theme-sidebar-seed': colors.sidebarBackground ?? colors.background,
  '--theme-card-seed': colors.card, '--theme-elevated-seed': colors.popover,
  '--theme-bubble-seed': colors.userBubble ?? colors.popover,
  '--dt-ring': colors.ring, '--dt-input': colors.input, '--dt-border': colors.border,
  '--dt-font-sans': DEFAULT_TYPOGRAPHY.fontSans,
};
for (const [key, value] of Object.entries(seeds)) document.documentElement.style.setProperty(key, value);
createRoot(document.getElementById('app')).render(h(Workspace, { ctx }));
