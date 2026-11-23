// Lane-owned additions use the existing native theme, type and control sizes.
export const commentStyles = `
.ws-comment-totals { flex:0 0 auto; display:flex; align-items:center; flex-wrap:wrap; gap:6px 16px; min-width:0; color:var(--ui-text-secondary); }
.ws-comment-totals .ws-comments-heading { flex:0 0 auto; white-space:nowrap; display:flex; align-items:center; gap:6px; margin:0; min-height:28px; }
.ws-comment-totals h2 { margin:0; font:inherit; font-size:12px; font-weight:500; color:inherit; }
.ws-root .ws-resolved-comment-total { display:inline-flex; align-items:center; gap:6px; color:var(--ui-text-secondary); font-size:12px; }
.ws-root .ws-resolved-comment-total[aria-pressed=true] { background:color-mix(in srgb,var(--ui-accent) 35%,transparent); border-color:var(--ui-accent); color:var(--ui-text-primary); }
.ws-root .ws-page-controls .ws-resolved-comment-total[aria-pressed=true] { background:color-mix(in srgb,var(--ui-accent) 35%,transparent); border-color:var(--ui-accent); color:var(--ui-text-primary); }
/* One header owns its entire hover surface; native controls keep their roles. */
.ws-comment-heading { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:8px; min-width:0; padding:10px; border-radius:inherit; }
.ws-bubble .ws-comment-heading:hover, .ws-bubble .ws-comment-heading:focus-within { background:var(--ui-bg-hover); }
.ws-root .ws-comment-heading > .ws-bubble-summary { width:100%; min-width:0; padding:0; border:0; border-radius:var(--radius-sm,4px); background:transparent; box-shadow:none; }
.ws-root .ws-comment-heading > .ws-bubble-summary:hover { background:transparent; }
.ws-comment-action-area { display:contents; }
.ws-comment-actions { display:flex; align-items:center; gap:4px; }
.ws-comment-resolve-wrap { position:relative; display:inline-flex; }
.ws-comment-resolve-wrap > .ws-comment-resolve-tick { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; pointer-events:none; }
.ws-comment-resolve:disabled + .ws-comment-resolve-tick { opacity:.5; }
.ws-root .ws-comment-actions .ws-comment-control, .ws-comment-revert-target { box-sizing:border-box; flex:0 0 28px; width:28px; min-width:28px; height:28px; min-height:28px; margin:0; padding:0; border-radius:var(--radius-sm,4px); }
.ws-root .ws-comment-actions .ws-comment-control { display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--ui-stroke-secondary); box-shadow:none; }
.ws-root .ws-comment-actions .ws-comment-control:not([data-state=checked]) { background:var(--ui-bg-editor); color:var(--ui-text-secondary); }
.ws-root .ws-comment-actions .ws-comment-control[data-state=checked] { border-color:var(--ui-accent); }
.ws-root .ws-comment-actions .ws-comment-control:not(:disabled):not([data-state=checked]):hover { background:var(--ui-bg-hover); color:var(--ui-text-primary); }
.ws-root .ws-comment-actions .ws-comment-control:disabled { cursor:not-allowed; opacity:.5; }
.ws-root .ws-comment-actions .ws-comment-control:focus-visible, .ws-comment-revert-target:focus-visible, .ws-root .ws-bubble-summary:focus-visible { outline:2px solid var(--ui-accent); outline-offset:2px; box-shadow:none; }
.ws-comment-revert-target { display:inline-flex; }
/* Accessible status only; never clip the actual controls or their focus ring. */
.ws-comment-action-state { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
/* Availability is persistent context, not an overlay triggered by other actions.
   Reserve a complete row below both the summary and painted control focus. */
.ws-comment-action-reason { display:block; grid-column:1 / -1; min-width:0; padding:4px 0 0; color:var(--ui-text-secondary); font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
.ws-comment-touch-labels { display:none; color:var(--ui-text-secondary); font-size:10px; text-align:right; }
@media (pointer:coarse) {
 /* Reuse the author's reading basis. Wrap the controls rather than squeeze
    identity/number/count; explanations never size the top-right control row. */
 .ws-comment-heading { display:flex; flex-wrap:wrap; }
 .ws-root .ws-comment-heading > .ws-bubble-summary { flex:1 1 100px; width:auto; }
 .ws-comment-actions { flex:0 0 auto; margin-left:auto; }
 .ws-root .ws-comment-actions .ws-comment-control, .ws-comment-revert-target { flex-basis:40px; min-width:40px; width:40px; min-height:40px; height:40px; }
 .ws-comment-touch-labels, .ws-comment-action-reason { display:block; flex:1 1 100%; min-width:0; }
}
.ws-bubble { cursor:pointer; }
.ws-comment-body { cursor:auto; }
.ws-comment-body p, .ws-bubble-preview { -webkit-user-select:text; user-select:text; }
.ws-comment-body[hidden] { display:none; }
.ws-comment .ws-reply { box-sizing:border-box; width:fit-content; max-width:calc(100% - 12px); margin:8px 0; padding:8px 10px; border:1px solid var(--ui-stroke-tertiary); border-radius:var(--radius-md,6px); background:var(--ui-bg-elevated); overflow-wrap:anywhere; }
.ws-comment .ws-reply[data-origin=human] { margin-left:auto; }
.ws-comment .ws-reply[data-origin=unknown] { width:auto; max-width:100%; background:transparent; }
.ws-comment .ws-reply p { margin:6px 0 0; text-align:left; }
.ws-reply-compose > summary { width:fit-content; min-height:28px; display:list-item; cursor:pointer; }
.ws-reply-compose > summary:focus-visible { outline:2px solid var(--ui-accent); outline-offset:2px; }
.ws-comment-surfaces { display: contents; }
.ws-author { display:inline-flex; align-items:center; gap:6px; min-width:0; max-width:100%; vertical-align:middle; }
.ws-author-avatar { display:inline-flex; flex:0 0 20px; width:20px; height:20px; align-items:center; justify-content:center; border-radius:50%; overflow:hidden; background:var(--ui-bg-elevated); color:var(--ui-text-secondary); font-size:11px; font-weight:600; }
.ws-author-avatar img { width:20px; height:20px; object-fit:cover; }
.ws-author-name { min-width:0; overflow-wrap:anywhere; white-space:normal; text-align:left; color:var(--ui-text-primary); font-size:12px; line-height:1.4; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
.ws-author-disclosure { height:auto; max-width:100%; padding:2px; margin:-2px; justify-content:flex-start; text-align:left; white-space:normal; }
.ws-author-disclosure .ws-author-name { text-decoration:underline dotted; text-underline-offset:3px; }
.ws-author-details { max-width:min(24rem,calc(100vw - 32px)); max-height:min(24rem,60vh); overflow:auto; }
.ws-author-full-name { margin:0 0 8px; white-space:pre-wrap; overflow-wrap:anywhere; color:var(--ui-text-primary); }
.ws-bubble-author { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 8px; width:100%; min-width:0; }
.ws-bubble-author .ws-author { flex:1 1 100px; }
.ws-bubble-author .ws-bubble-context { flex:0 1 auto; }
.ws-username-dialog { width:min(24rem,calc(100% - 24px)); }
.ws-username-dialog input { width:100%; min-width:0; }
.ws-anchor-recovery summary { cursor:pointer; color:var(--ui-text-secondary); }
.ws-anchor-recovery blockquote { margin:8px 0 0; max-height:8rem; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; }
.ws-anchor-recovery summary:focus-visible { outline:2px solid var(--ui-accent); outline-offset:2px; }
.ws-comment .ws-anchor:has(.ws-comment-passage) { border:0; padding:0; margin:4px 0; }
.ws-comment-passage { min-height:28px; }
.ws-comment-compose-heading { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; }
.ws-comment-compose-heading label { flex:1 1 100px; }
.ws-comment-compose-heading button { flex:0 0 auto; color:var(--ui-text-secondary); }
.ws-comment-composer .ws-field textarea { min-height:4rem; max-height:min(12rem,30vh); }
.ws-comment-composer .ws-field textarea::placeholder { color:var(--ui-text-secondary); opacity:1; }
.ws-comment-composer .ws-anchor { max-height:6rem; overflow:auto; }
.ws-comment-composer .ws-anchor p { margin-block:4px; }
.ws-dialog.ws-thread-picker { width:min(36rem,calc(100% - 24px)); max-width:calc(100% - 24px); max-height:calc(100% - 24px); gap:0; }
.ws-thread-picker-body { display:flex; flex-direction:column; gap:8px; min-width:0; overflow:hidden; overscroll-behavior:contain; }
.ws-thread-picker-body > * { flex-shrink:0; }
.ws-thread-picker .ws-thread-search { width:100%; min-width:0; }
.ws-thread-picker .ws-thread-search input { flex:1; min-width:0; width:100%; }
.ws-thread-picker-body > .ws-thread-results { flex:1 1 auto; min-height:0; overflow:auto; max-height:45vh; display:flex; flex-direction:column; gap:4px; }
.ws-thread-result { width:100%; height:auto; text-align:left; white-space:normal; justify-content:flex-start; display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding:6px; }
.ws-thread-result span { overflow-wrap:anywhere; }
.ws-thread-result small { color:var(--ui-text-secondary); overflow-wrap:anywhere; }
.ws-thread-notice { margin:0; color:var(--ui-text-secondary); }
.ws-scope-review-body { display:flex; flex-direction:column; min-height:0; overflow:hidden; gap:10px; }
.ws-scope-review-body > :not(.ws-related-scope) { flex-shrink:0; }
.ws-scope-current { margin:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--ui-text-secondary); }
.ws-related-scope { min-height:0; overflow:auto; overscroll-behavior:contain; }
.ws-related-scope[open] { flex:1 1 auto; }
.ws-related-scope .ws-comment { padding:8px; margin-block:6px; }
`;
