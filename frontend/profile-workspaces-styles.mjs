export const profileWorkspacesStyles = `
.ws-profile-workspaces { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; min-width:0; color:var(--ui-text-primary); }
.ws-profile-workspaces > [data-slot="select-trigger"] { flex:1 1 14rem; min-width:0; max-width:26rem; }
.ws-profile-workspaces p { flex-basis:100%; margin:.25rem 0; color:var(--ui-text-secondary); overflow-wrap:anywhere; }
.ws-profile-form { display:grid; gap:.75rem; min-width:0; }
.ws-profile-form label { display:grid; gap:.375rem; }
.ws-profile-form p { margin:0; color:var(--ui-text-secondary); overflow-wrap:anywhere; }
.ws-profile-members { list-style:none; margin:0; padding:0; display:grid; gap:.5rem; }
.ws-profile-members li { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; }
.ws-profile-members li > span { flex:1 1 12rem; overflow-wrap:anywhere; }
.ws-profile-error { color:var(--ui-text-primary); border-inline-start:2px solid var(--ui-accent); padding-inline-start:.75rem; overflow-wrap:anywhere; }
.ws-profile-dialog { max-width:min(32rem,calc(100vw - 2rem)); max-height:calc(100dvh - 2rem); overflow:auto; }
@media(max-width:480px) { .ws-profile-workspaces > button { flex:1 1 auto; } }
`;
