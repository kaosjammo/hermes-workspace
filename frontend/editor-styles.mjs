/** Editor-only composition over public Hermes controls and theme tokens. */
export const editorStyles = `
:is(.ws-editor, .ws-section-fragment) span[data-workspace-weight="normal"] { font-weight: 400; }
.ws-rich-editor .ws-editor-heading { margin: 0 0 10px; justify-content: flex-start; }
.ws-rich-editor .ws-format-toggle {
  border: 1px solid var(--ui-stroke-secondary);
  border-radius: var(--radius-sm, 4px);
  min-height: 32px;
  padding: 5px 10px;
  gap: 8px;
  color: var(--ui-text-primary);
}
.ws-rich-editor .ws-format-toggle[aria-expanded=true] { border-color: var(--ui-accent); }
.ws-rich-editor .ws-format-toolbar {
  display: block;
  padding: 6px;
  background: var(--ui-bg-editor, var(--ui-bg-primary));
  border: 1px solid var(--ui-stroke-secondary);
  border-radius: var(--radius-md, 6px);
  margin-bottom: 16px;
  min-width: 0;
}
.ws-rich-editor .ws-format-toolbar > fieldset { display: block; border: 0; padding: 0; margin: 0; min-width: 0; }
.ws-rich-editor .ws-format-row { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 0; }
.ws-rich-editor .ws-format-group { display: flex; align-items: center; gap: 2px; padding-inline: 5px; }
.ws-rich-editor .ws-format-group + .ws-format-group { border-left: 1px solid var(--ui-stroke-tertiary); }
.ws-rich-editor .ws-format-group:first-child { padding-left: 0; }
.ws-rich-editor .ws-format-toolbar .ws-choice { min-width: 0; width: 116px; margin: 0; }
.ws-rich-editor .ws-format-toolbar .ws-choice-trigger { min-width: 0; height: 32px; }
.ws-rich-editor .ws-format-toolbar .ws-format-tool { width: 32px; height: 32px; padding: 0; flex-shrink: 0; color: var(--ui-text-primary); }
.ws-rich-editor .ws-format-tool[aria-pressed=true] { box-shadow: inset 0 0 0 1px var(--ui-stroke-secondary); }
.ws-rich-editor .ws-format-tool-label { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ws-rich-editor .ws-format-underline-glyph::before { content: 'U'; text-decoration: underline; font-size: 14px; }
.ws-rich-editor .ws-format-insert { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; border-top: 1px solid var(--ui-stroke-tertiary); margin-top: 6px; padding-top: 6px; }
.ws-rich-editor .ws-format-insert > button { min-height: 30px; gap: 6px; color: var(--ui-text-primary); }
.ws-editor-selection-tools { max-width: min(26rem, var(--radix-popover-content-available-width, calc(100vw - 16px))); }
`;
