export const databaseGridStyles = `
.ws-database { position: relative; min-width: 0; font-size: 13px; container-name: workspace-database; container-type: inline-size; }
.ws-root .ws-work:has(.ws-database) { scroll-padding-top: 40px; }
.ws-database .ws-database-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; margin: 0 0 10px; padding-inline-end: 80px; }
.ws-database .ws-database-tools > .ws-choice { width: 112px; margin: 0; }
.ws-database .ws-db-filter { flex: 1 1 150px; max-width: 260px; opacity: 1; }
.ws-database .ws-db-filter input::placeholder { color: var(--ui-text-secondary); opacity: 1; }
.ws-db-count { color: var(--ui-text-secondary); font-size: 12px; font-weight: 400; white-space: nowrap; }
.ws-database .ws-table-wrap { margin: 0; border-inline: 0; border-top: 0; container-type: inline-size; container-name: workspace-db-grid; max-height: max(9rem, min(34rem, calc(var(--ws-pane-height, 640px) - 104px))); scroll-padding-top: 42px; }
.ws-database .ws-table { font-size: 13px; min-width: 480px; }
.ws-database .ws-table :is(th,td) { padding: 5px 10px; min-width: 150px; max-width: 260px; vertical-align: middle; }
.ws-database .ws-table thead th { position: sticky; top: 0; z-index: 2; padding-block: 8px; font-size: 12px; font-weight: 500; background: var(--ui-bg-editor); border-right: 0; box-shadow: 0 1px 0 var(--ui-stroke-secondary); }
.ws-database .ws-table :is(th,td):not(:last-child) { border-right: 1px solid var(--ui-stroke-tertiary); }
.ws-database .ws-table tbody th { background: transparent; color: var(--ui-text-primary); font-weight: 500; min-width: 210px; }
.ws-database .ws-table tbody tr:hover { background: var(--ui-bg-secondary); }
.ws-db-column-heading,.ws-db-column-name,.ws-db-record-name { display: flex; align-items: center; min-width: 0; gap: 8px; }
.ws-db-column-heading,.ws-db-record-name { justify-content: space-between; }
.ws-db-column-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-db-column-name > .codicon { color: var(--ui-text-secondary); flex-shrink: 0; }
.ws-db-record-name > button:first-child { flex: 1 1 0%; max-width: 100%; white-space: normal; min-width: 0; justify-content: start; height: auto; padding-inline: 0; font-size: 13px; text-align: left; overflow-wrap: anywhere; }
.ws-db-row-actions { flex: 0 0 auto; color: var(--ui-text-secondary); }
.ws-database .ws-table .ws-db-property-header,.ws-database .ws-table .ws-db-property-spacer { width: 128px; min-width: 128px; max-width: 128px; padding: 4px; }
.ws-db-add-property { color: var(--ui-text-primary); white-space: nowrap; font-size: 12px; font-weight: 500; gap: 6px; }
.ws-database .ws-property :is(input:not([type=checkbox]),.ws-choice-trigger) { min-height: 30px; height: 30px; border-color: transparent; background: transparent; box-shadow: none; font-size: 13px; padding-inline: 5px; }
.ws-database .ws-property :is(input:not([type=checkbox]),.ws-choice-trigger):hover { background: var(--ui-bg-tertiary); }
.ws-database .ws-property :is(input:not([type=checkbox]),.ws-choice-trigger):focus-visible { border-color: var(--ui-accent); }
.ws-db-text-cell { position: relative; min-width: 0; }
.ws-database .ws-db-text-cell > input { padding-inline-end: 28px; text-overflow: ellipsis; }
.ws-database .ws-db-text-cell > input:focus { text-overflow: clip; }
.ws-db-text-read { position: absolute; inset-inline-end: 1px; top: 50%; translate: 0 -50%; color: var(--ui-text-secondary); }
.ws-db-text-read-hint { font-size: 12px; }
.ws-db-full-text { display: block; max-inline-size: 28rem; white-space: normal; overflow-wrap: anywhere; }
.ws-database .ws-property-status { font-size: 12px; padding-block: 5px; }
.ws-database .ws-formula-value output { display: block; padding: 5px; color: var(--ui-text-primary); }
.ws-database .ws-table .ws-db-create-row > td { padding: 0; max-width: none; }
.ws-db-new-record { width: 100%; justify-content: flex-start; min-height: 36px; color: var(--ui-text-primary); font-weight: 500; }
.ws-table .ws-db-new-record { position: sticky; left: 0; width: 100cqw; }
.ws-db-record-draft { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; max-width: 100%; }
.ws-table .ws-db-record-draft { position: sticky; left: 0; width: 100cqw; box-sizing: border-box; }
.ws-db-draft-label { color: var(--ui-text-primary); font-size: 12px; font-weight: 500; }
.ws-db-record-draft > input { flex: 1 1 180px; width: auto; max-width: 420px; }
.ws-db-record-draft > p { flex-basis: 100%; margin: 0; font-size: 12px; }
.ws-db-form-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.ws-db-empty-row > td,.ws-db-empty { color: var(--ui-text-secondary); padding: 20px 10px !important; font-size: 13px; }
.ws-db-schema-help { margin-top: 12px; font-size: 12px; color: var(--ui-text-secondary); }
.ws-db-property-popover,.ws-db-sort-popover,.ws-db-relation-popover { width: 300px; max-width: min(22rem, var(--radix-popover-content-available-width, calc(100vw - 24px))); max-height: min(30rem, var(--radix-popover-content-available-height, 80vh)); overflow: auto; font-size: 13px; }
.ws-db-property-popover { display: flex; padding: 0; overflow: hidden; }
.ws-db-property-popover > form { display: flex; flex-direction: column; min-height: 0; width: 100%; max-height: inherit; }
.ws-db-property-popover h3 { flex-shrink: 0; margin: 0; padding: 10px 8px; font-size: 13px; font-weight: 600; }
.ws-db-property-fields { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 8px; }
.ws-db-property-popover :is(.ws-field,.ws-choice),.ws-db-sort-popover .ws-choice { margin: 0 0 12px; }
.ws-db-property-popover .ws-db-form-actions { flex-shrink: 0; padding: 8px; border-top: 1px solid var(--ui-stroke-tertiary); background: var(--ui-bg-card); }
.ws-db-property-popover p { margin: 8px 0; }
.ws-db-property-popover details { font-size: 12px; margin-bottom: 12px; }
.ws-db-relation-trigger { width: 100%; justify-content: flex-start; height: auto; min-height: 30px; white-space: normal; font-size: 13px; }
.ws-db-board-tools { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.ws-db-board-tools .ws-choice { flex: 1; margin: 0; }
.ws-db-board-tools > span { font-size: 12px; color: var(--ui-text-secondary); }
.ws-database .ws-board { margin-block: 0; gap: 14px; }
.ws-database .ws-board-group { border: 0; background: var(--ui-bg-card); padding: 10px; }
.ws-database .ws-board-group > h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 13px; font-weight: 500; }
.ws-database .ws-board-record { background: var(--ui-bg-editor); border: 1px solid var(--ui-stroke-tertiary); border-radius: 4px; padding: 10px; }
.ws-db-board-create { margin-top: 12px; border-top: 1px solid var(--ui-stroke-tertiary); }
.ws-db-sort-label { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-db-status { position: absolute; top: 0; right: 0; height: 28px; display: flex; align-items: center; gap: 8px; min-width: 0; }
.ws-db-record-context { display: none; align-items: center; gap: 5px; min-width: 0; color: var(--ui-text-secondary); font-size: 12px; }
.ws-db-record-context > button { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-db-record-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-database .ws-db-active-row { outline: 1px solid var(--ui-stroke-secondary); outline-offset: -1px; }
@container workspace-database (max-width: 499px) {
  .ws-database .ws-database-tools { padding-inline-end: 0; }
  .ws-db-status { position: sticky; top: 0; z-index: 3; width: 100%; height: 32px; background: var(--ui-bg-editor); }
  .ws-db-record-context { display: flex; flex: 1; }
}
@container workspace-db-grid (min-width: 500px) {
  .ws-database .ws-table :is(thead th:first-child,tbody th[scope=row]) { position: sticky; left: 0; z-index: 1; background: var(--ui-bg-editor); box-shadow: 1px 0 0 var(--ui-stroke-secondary); }
  .ws-database .ws-table thead th:first-child { z-index: 3; }
}
`;
