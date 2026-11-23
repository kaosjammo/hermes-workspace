// Navigation and search use public SDK controls and existing Hermes tokens.
// Grid placement is explicit: status nodes cannot become accidental columns.
export const workspaceNavigationStyles = `
.ws-body > .ws-nav { grid-column: 1; grid-row: 1; }
.ws-body > .ws-nav-resize { grid-column: 2; grid-row: 1; }
.ws-body > .ws-work { grid-column: 3; grid-row: 1; }
.ws-nav-content { min-width: 0; }
.ws-tree-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-block: 0 6px; }
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
.ws-order-help, .ws-order-status { font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.ws-order-help { margin: 4px 0 8px; color: var(--ui-text-secondary); }
.ws-order-status { margin: 0; }
.ws-order-status:not(:empty) { margin-block: 6px; }
.ws-folder-navigation[data-reordering="true"] .ws-order-status { height: 4.5em; overflow: auto; margin-block: 6px; }
.ws-order-status[role="alert"] { color: var(--ui-text-primary); border-inline-start: 2px solid var(--ui-accent); padding-inline-start: 6px; }
.ws-folder-navigation[data-reordering="true"] .ws-order-row { display: flex; align-items: center; flex-wrap: wrap; position: relative; }
.ws-folder-navigation[data-reordering="true"] .ws-order-row > [data-slot="button"] { flex: 1; width: auto; min-width: 72px; }
.ws-order-controls { display: inline-flex; gap: 0; flex: 0 0 auto; margin-inline-start: auto; }
.ws-order-controls > [data-slot="button"] { padding: 4px; width: 28px; min-width: 28px; height: 32px; }
.ws-order-controls .ws-order-handle { cursor: grab; }
.ws-order-controls .ws-order-handle:active { cursor: grabbing; }
.ws-order-controls > [data-slot="button"]:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: -2px; }
.ws-order-row[data-order-position] { background: var(--ui-bg-quaternary); }
.ws-order-row[data-order-position]::after {
  content: ""; position: absolute; inset-inline: 0; height: 2px; background: var(--ui-accent); pointer-events: none;
}
.ws-order-row[data-order-position="before"]::after { top: 0; }
.ws-order-row[data-order-position="after"]::after { bottom: 0; }
@container hermes-workspace (max-width: 600px) {
  .ws-nav { flex: 0 0 auto; max-height: min(240px, 40vh); }
  .ws-nav[data-expanded="true"] { flex-shrink: 1; }
}
`;
