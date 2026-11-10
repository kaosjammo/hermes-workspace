// Lane-owned additions use the existing native theme, type and control sizes.
export const commentStyles = `
.ws-comment-surfaces { display: contents; }
.ws-author { display:inline-flex; align-items:center; gap:6px; min-width:0; max-width:100%; vertical-align:middle; }
.ws-author-avatar { display:inline-flex; flex:0 0 20px; width:20px; height:20px; align-items:center; justify-content:center; border-radius:50%; overflow:hidden; background:var(--ui-bg-elevated); color:var(--ui-text-secondary); font-size:11px; font-weight:600; }
.ws-author-avatar img { width:20px; height:20px; object-fit:cover; }
.ws-author-name { min-width:0; overflow-wrap:anywhere; white-space:normal; text-align:left; color:var(--ui-text-primary); font-size:12px; line-height:1.4; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
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
