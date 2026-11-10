// Navigation and search use public SDK controls and existing Hermes tokens.
// Grid placement is explicit: status nodes cannot become accidental columns.
export const workspaceNavigationStyles = `
.ws-body > .ws-nav { grid-column: 1; grid-row: 1; }
.ws-body > .ws-nav-resize { grid-column: 2; grid-row: 1; }
.ws-body > .ws-work { grid-column: 3; grid-row: 1; }
.ws-nav-content { min-width: 0; }
.ws-tree-actions { display: flex; flex-wrap: wrap; gap: 2px 4px; margin-block: 0 6px; }
.ws-tree-actions > [data-slot="button"] { min-height: 2rem; height: auto; padding: 4px 8px; }
.ws-workspace-search { min-width: 0; }
.ws-search-results { margin-block: 8px 16px; }
.ws-search-results > p { margin: 8px 0; }
.ws-nav .ws-search-results li > [data-slot="button"] {
  white-space: normal; align-items: start; height: auto;
}
.ws-search-result-text { min-width: 0; display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; }
.ws-search-result-text > span { white-space: normal; }
.ws-search-result-text small { color: var(--ui-text-secondary); font: inherit; white-space: normal; }
.ws-nav ul ul { min-width: 0; }
.ws-nav li { min-width: 0; }
@container hermes-workspace (max-width: 600px) {
  .ws-nav { flex: 0 0 auto; max-height: min(240px, 40vh); }
  .ws-nav[data-expanded="true"] { flex-shrink: 1; }
}
`;
