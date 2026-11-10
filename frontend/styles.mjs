import { workspaceNavigationStyles } from './workspace-navigation-styles.mjs';
export const styles = `
.ws-root {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: var(--ui-text-primary);
  font: inherit;
  font-size: var(--font-size-base, 13px);
  line-height: 1.5;
  isolation: isolate;
  container-name: hermes-workspace;
  container-type: inline-size;
}
.ws-root * {
  box-sizing: border-box;
}
.ws-root [hidden] {
  display: none !important;
}
.ws-root button {
  max-width: 100%;
}
.ws-muted,
.ws-label,
.ws-source {
  color: var(--ui-text-secondary);
}
.ws-root .ws-state-description,
.ws-root .ws-empty-state .text-muted-foreground {
  color: var(--ui-text-secondary);
}
.ws-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--ui-stroke-tertiary);
  min-height: 49px;
  flex-wrap: wrap;
}
.ws-topbar h1 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  margin: 0 auto 0 0;
}
.ws-source {
  font-size: 12px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-body {
  display: grid;
  grid-template-columns: var(--ws-nav-width, 280px) 10px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.ws-nav {
  padding: 16px 12px;
  overflow: auto;
  overscroll-behavior: contain;
  min-width: 0;
  background: transparent;
}
.ws-nav h2 {
  font-size: 12px;
  font-weight: 500;
  margin: 28px 8px 8px;
  color: var(--ui-text-secondary);
}
.ws-nav .ws-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
}
.ws-nav .ws-search .ws-field {
  margin: 0;
  flex: 1;
}
.ws-nav .ws-search .ws-label {
  position: absolute;
  clip-path: inset(50%);
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.ws-nav .ws-search input {
  width: 100%;
  min-width: 0;
}
.ws-root .ws-search-input::placeholder {
  color: var(--ui-text-secondary);
  opacity: 1;
}
.ws-nav .ws-search > [data-slot="button"] {
  justify-self: end;
  width: auto;
  margin: 0;
}
.ws-search-status { margin: 0; color: var(--ui-text-secondary); font-size: 12px; }
.ws-search-status:not(:empty) { margin: 6px 8px 0; }
.ws-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.ws-nav li ul {
  padding-left: 10px;
  border-left: 1px solid var(--ui-stroke-tertiary);
  margin-left: 4px;
}
.ws-nav summary {
  display: flex;
  align-items: center;
  gap: 2px;
}
.ws-disclosure-caret { flex-shrink: 0; transition: transform 150ms; }
.ws-nav details[open] > summary > .ws-disclosure-caret { transform: rotate(90deg); }

.ws-nav summary > [data-slot="button"] { width: auto; min-width: 0; flex: 1; }
.ws-nav li > [data-slot="button"],
.ws-nav-row > [data-slot="button"],
.ws-nav summary > [data-slot="button"],
.ws-nav > [data-slot="button"] {
  justify-content: flex-start;
  width: 100%;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 6px 8px;
  font-weight: 400;
  min-height: 2rem;
  height: auto;
}
.ws-nav [aria-current="page"] {
  background: var(--ui-bg-quaternary);
  color: var(--ui-text-primary);
  font-weight: 600;
  border-left: 2px solid var(--ui-accent);
}
.ws-nav-label { display: flex; flex-direction: column; min-width: 0; }
.ws-nav-label > span:first-child, .ws-nav-label small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-nav-resize { display: flex; align-items: center; justify-content: center; cursor: col-resize; touch-action: none; user-select: none; border-inline: 1px solid var(--ui-stroke-tertiary); }
.ws-nav-grip { width: 4px; height: 32px; border-inline: 1px solid var(--ui-text-secondary); border-radius: 2px; }
.ws-nav-resize:hover, .ws-nav-resize:focus-visible { background: var(--ui-bg-quaternary); }
.ws-nav-resize:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: -2px; }
.ws-nav-label small { font-size: 11px; line-height: 1.4; color: var(--ui-text-secondary); font-weight: 400; }
.ws-nav-row {
  min-width: 0;
}
.ws-page-utilities h3 { margin: 0 0 8px; font: inherit; font-weight: 600; }
.ws-page-utilities h3:not(:first-child) { margin-top: 20px; }
.ws-page-utilities p { margin: 10px 0; }
.ws-item-id { overflow-wrap: anywhere; }
.ws-nav > button:last-child {
  margin-top: 24px;
}
.ws-work {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.ws-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  min-height: 100%;
  align-items: start;
  position: relative;
}
.ws-folder-layout {
  grid-template-columns: minmax(0, 1fr);
}
.ws-document {
  padding: 32px clamp(24px, 3.4vw, 56px) 48px;
  min-width: 0;
  position: relative;
}
.ws-document-header { display: contents; }
.ws-page-kind {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--ui-text-secondary);
  font-size: 12px;
  margin-bottom: 12px;
}
.ws-title-wrap {
  position: relative;
  margin: 0 0 12px;
}
.ws-root .ws-title {
  display: block;
  resize: none;
  overflow: hidden;
  min-height: 1.4em;
  height: auto;
  width: 100%;
  max-width: 100%;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0;
  font: inherit;
  font-size: clamp(26px, 2.7vw, 36px) !important;
  line-height: 1.25;
  font-weight: 650;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
  color: var(--ui-text-primary);
}
.ws-title:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 6px;
}
.ws-root .ws-title-empty { outline: 1px dashed var(--ui-stroke-secondary); outline-offset: 6px; }
.ws-root .ws-title-empty:focus-visible { outline: 2px solid var(--ui-accent); }
.ws-title-empty-cue { display: block; margin-top: 8px; font-size: 12px; color: var(--ui-text-secondary); }
.ws-page-actions {
  display: flex;
  gap: 8px;
  margin: 0 -8px 24px;
  align-items: center;
}
.ws-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ws-document h2 {
  font-size: 18px;
  font-weight: 600;
}
.ws-document-footer {
  display: flex;
  gap: 8px;
  padding: 16px 0;
  border-top: 1px solid var(--ui-stroke-tertiary);
  margin-top: 24px;
}
.ws-rich-editor {
  min-width: 0;
}
.ws-editor-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin: 0 -8px 12px;
}
.ws-editor-hint {
  font-size: 11px;
  text-align: right;
}
.ws-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 12px;
  margin-bottom: 16px;
  background: var(--ui-bg-secondary);
  border: 1px solid var(--ui-stroke-tertiary);
  border-radius: var(--radius-sm, 4px);
}
.ws-toolbar fieldset {
  display: contents;
}
.ws-toolbar .ws-choice {
  margin: 0;
  min-width: 120px;
}
.ws-toolbar .ws-label {
  font-size: 11px;
}
.ws-toolbar fieldset:disabled {
  opacity: 0.5;
}
.ws-editor-canvas {
  position: relative;
  min-width: 0;
}
.ws-editor {
  min-height: 260px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  outline: none;
  max-width: 72ch;
  padding: 0 0 32px;
  font-size: 14px;
}
.ws-wide-document .ws-editor {
  max-width: 100%;
}
.ws-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--ui-text-secondary);
  pointer-events: none;
}
.ws-editor:focus-visible {
  outline: none;
  box-shadow: -2px 0 var(--ui-stroke-secondary);
}
:is(.ws-editor, .ws-section-fragment) h1 {
  font-size: 1.85em;
  font-weight: 650;
  line-height: 1.35;
  margin: 1.3em 0 0.4em;
}
:is(.ws-editor, .ws-section-fragment) h2 {
  font-size: 1.5em;
  line-height: 1.4;
  margin: 1.2em 0 0.4em;
}
:is(.ws-editor, .ws-section-fragment) h3 {
  font-size: 1.2em;
  line-height: 1.4;
  margin: 1.2em 0 0.4em;
}
:is(.ws-editor, .ws-section-fragment) p {
  margin: 0.6em 0;
}
:is(.ws-editor, .ws-section-fragment) > :first-child {
  margin-top: 0;
}
:is(.ws-editor, .ws-section-fragment) ul,
:is(.ws-editor, .ws-section-fragment) ol {
  padding-left: 1.6em;
}
:is(.ws-editor, .ws-section-fragment) ul { list-style-type: disc; }
:is(.ws-editor, .ws-section-fragment) ol { list-style-type: decimal; }
:is(.ws-editor, .ws-section-fragment) ul ul { list-style-type: circle; }
:is(.ws-editor, .ws-section-fragment) ul ul ul { list-style-type: square; }
:is(.ws-editor, .ws-section-fragment) ol ol { list-style-type: lower-alpha; }
:is(.ws-editor, .ws-section-fragment) ol ol ol { list-style-type: lower-roman; }
:is(.ws-editor, .ws-section-fragment) li:has(> input[type="checkbox"]) { list-style: none; }
:is(.ws-editor, .ws-section-fragment) li {
  margin: 0.2em 0;
}
:is(.ws-editor, .ws-section-fragment) input[type="checkbox"] {
  accent-color: var(--ui-accent);
  margin-right: 6px;
}
:is(.ws-editor, .ws-section-fragment) blockquote {
  border-left: 3px solid var(--ui-stroke-secondary);
  padding: 4px 0 4px 18px;
  margin: 20px 0;
  color: var(--ui-text-secondary);
}
:is(.ws-editor, .ws-section-fragment) pre {
  font-family: var(--font-mono, monospace);
  padding: 16px;
  background: var(--ui-bg-quaternary);
  border-radius: var(--radius-sm, 4px);
  white-space: pre-wrap;
}
:is(.ws-editor, .ws-section-fragment) img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm, 4px);
}
:is(.ws-editor, .ws-section-fragment) table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  table-layout: fixed;
}
:is(.ws-editor, .ws-section-fragment) td,
:is(.ws-editor, .ws-section-fragment) th {
  border: 1px solid var(--ui-stroke-tertiary);
  padding: 8px;
  text-align: left;
  overflow-wrap: anywhere;
}
:is(.ws-editor, .ws-section-fragment) a {
  color: var(--ui-accent);
  text-decoration: underline;
}
:is(.ws-editor, .ws-section-fragment)[contenteditable="false"] {
  color: var(--ui-text-secondary);
}
.ws-save {
  font-size: 11px;
  color: var(--ui-text-secondary);
  padding: 4px 0;
  display: flex;
  gap: 8px;
  align-items: center;
}
.ws-selection-anchor { pointer-events: none; }
.ws-attachment-detail { display: inline-block; margin-inline-start: 8px; }
.ws-selection-popover { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; width: auto; max-width: min(26rem, var(--radix-popover-content-available-width, calc(100vw - 16px))); padding: 4px; }
.ws-selection-popover .ws-choice { margin: 0; min-width: 0; width: 6.5rem; }
.ws-selection-popover .ws-choice-trigger { min-width: 0; }
.ws-selection-popover button { color: var(--ui-text-primary); }
.ws-format-bold { font-weight: 700; }
.ws-format-italic { font-style: italic; }
.ws-format-underline { text-decoration: underline; }
.ws-loading { display: inline-flex; gap: 8px; align-items: center; }
.ws-passage-marker {
  position: absolute !important;
  left: -25px;
  min-width: 20px;
  height: 23px;
  padding: 0 !important;
  font-size: 10px !important;
  border: 1px solid var(--ui-stroke-secondary);
  color: var(--ui-accent);
  background: var(--ui-bg-primary);
}
.ws-passage-marker[aria-pressed="true"] {
  outline: 2px solid var(--ui-accent);
  outline-offset: 1px;
}
.ws-menu [role="menuitem"] { white-space: normal; overflow-wrap: anywhere; max-width: min(32rem, calc(100vw - 32px)); }
.ws-dialog { max-width: min(32rem, calc(100vw - 32px)); }
.ws-dialog [data-slot="dialog-title"] { padding-inline-end: 2rem; overflow-wrap: anywhere; }
.ws-dialog .ws-dialog-footer { flex-wrap: wrap; }
.ws-dialog .ws-dialog-description { color: var(--ui-text-secondary); }
.ws-dialog .ws-dialog-footer button { max-width: 100%; white-space: normal; height: auto; }
.ws-dialog .ws-recovery-actions { flex-direction: column; align-items: stretch; }
.ws-checkbox[data-state="unchecked"] { border-color: var(--ui-text-secondary); }
.ws-formula-help { font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.ws-formula-help p { margin: 8px 0; }
.ws-formula-help ul { margin: 8px 0; padding-left: 18px; list-style: disc; }
.ws-properties .ws-choice, .ws-table .ws-choice { margin: 0; }
.ws-board:focus-visible, .ws-table-wrap:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
.ws-nav-toggle { display: none; }
.ws-nav-content { min-width: 0; }
.ws-title-reader { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ws-title-status { font-size: 12px; margin: 6px 0 12px; }
.ws-save-error { font-size: 13px; color: var(--ui-text-primary); border-left: 2px solid var(--ui-stroke-secondary); padding-left: 10px; overflow-wrap: anywhere; }
.ws-title-recovery { font-size: 12px; margin-bottom: 12px; }
.ws-notice { padding: 12px 20px; border-bottom: 1px solid var(--ui-stroke-tertiary); font-size: 12px; overflow-wrap: anywhere; }
.ws-outcome { padding: 16px; margin-bottom: 24px; border: 1px solid var(--ui-stroke-secondary); border-left: 3px solid var(--ui-accent); font-size: 13px; line-height: 1.6; }
.ws-outcome p { margin: 8px 0; }
.ws-outcome.ws-run-banner { font-size: 12px; line-height: 1.5; border-top: 0; border-right: 0; }
.ws-outcome details { flex-basis: 100%; min-width: 0; }
.ws-outcome .ws-actions { flex-wrap: wrap; }
.ws-comments {
  padding: 32px 20px 40px;
  border-left: 1px solid var(--ui-stroke-tertiary);
  position: sticky;
  top: 0;
  max-height: 100cqh;
  overflow: auto;
  min-width: 0;
  font-size: 12px;
}
.ws-comments-heading {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ws-comments h2 {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}
.ws-comment-count {
  padding: 0 6px;
  border: 1px solid var(--ui-stroke-tertiary);
  border-radius: var(--radius-sm, 4px);
  font-size: 11px;
  color: var(--ui-text-secondary);
}
.ws-comments > p {
  line-height: 1.65;
  margin: 10px 0 16px;
}
.ws-comments > .ws-check {
  margin: 16px 0;
}
.ws-comment {
  padding: 16px 0;
  border-top: 1px solid var(--ui-stroke-tertiary);
  overflow-wrap: anywhere;
  scroll-margin: 16px;
}
.ws-comment-active {
  border-left: 2px solid var(--ui-accent);
  padding-left: 12px;
  margin-left: -14px;
}
.ws-comment:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 5px;
}
.ws-comment-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.ws-comment-meta .ws-muted {
  font-size: 11px;
}
.ws-comment p {
  white-space: pre-wrap;
  line-height: 1.65;
  margin: 10px 0;
}
.ws-comment .ws-check {
  font-size: 11px;
  color: var(--ui-text-secondary);
}
.ws-comment textarea {
  min-height: 54px !important;
}
.ws-reply-compose {
  margin-top: 12px;
  font-size: 11px;
  color: var(--ui-text-secondary);
}
.ws-reply-compose form {
  margin-top: 10px;
}
.ws-reply-compose form > button {
  margin-top: 8px;
}
.ws-anchor {
  font-size: 12px;
  color: var(--ui-text-secondary);
  border-left: 2px solid var(--ui-accent);
  padding: 4px 0 4px 10px;
  line-height: 1.6;
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.ws-anchor button {
  display: block;
  margin-top: 4px;
}
.ws-target {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ui-stroke-tertiary);
  border-radius: var(--radius-sm, 4px);
  padding: 2px 6px;
  margin: 4px 4px 0 0;
  font-size: 11px;
  color: var(--ui-text-secondary);
  overflow-wrap: anywhere;
  max-width: 100%;
}
.ws-reply {
  margin-left: 10px;
  padding-top: 8px;
  border-left: 1px solid var(--ui-stroke-tertiary);
  padding-left: 10px;
}
.ws-reply strong {
  font-size: 11px;
}
.ws-comment-composer {
  margin: 24px 0;
  min-width: 0;
}
.ws-comment-composer-anchored {
  border-top: 2px solid var(--ui-accent);
  padding-top: 12px;
}
.ws-comment-composer textarea {
  min-height: 86px;
  resize: vertical;
}
.ws-comment-composer > button {
  margin: 10px 8px 0 0;
}
.ws-thread-divider {
  border-top: 1px solid var(--ui-stroke-tertiary);
  margin: 28px 0 20px;
}
.ws-comments > .ws-actions button {
  white-space: normal;
  text-align: left;
}
.ws-comments > .ws-choice {
  max-width: 100%;
}
.ws-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
}
.ws-field,
.ws-choice {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
  min-width: 0;
}
.ws-label {
  font-size: 12px;
}
.ws-choice-trigger { min-width: 0; max-width: 100%; width: 100%; }
.ws-choice-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.ws-choice-content [role="option"] { white-space: normal; overflow-wrap: anywhere; }
.ws-banner {
  padding: 14px 16px;
  background: var(--ui-bg-quaternary);
  border-left: 3px solid var(--ui-accent);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.ws-run-banner {
  grid-column: 1 / -1;
  position: sticky;
  top: 0;
  z-index: 20;
  margin: 0;
  padding: 10px 16px;
  background: var(--ui-bg-elevated, var(--ui-bg-editor));
  border-bottom: 1px solid var(--ui-stroke-tertiary);
}
.ws-property-status, .ws-field-error { font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.ws-property-status { margin-top: 6px; }
.ws-property-status .ws-actions { margin-top: 6px; }
.ws-formula-value { display: flex; flex-direction: column; gap: 4px; }
.ws-field-error { color: var(--ui-text-secondary); }
.ws-discussion-draft { margin: 8px 0; }
.ws-error {
  padding: 12px 16px;
  color: var(--ui-text-primary);
  border-left: 3px solid var(--ui-accent);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ws-error .ws-actions {
  margin-top: 8px;
}
.ws-error pre, .ws-dialog [role="alert"] pre { white-space: pre-wrap; overflow-wrap: anywhere; max-width: 100%; }
.ws-home {
  padding: 40px clamp(24px, 4vw, 64px);
  max-width: 980px;
  min-width: 0;
}
.ws-home > h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 36px 0 12px;
}
.ws-home > h2:first-child {
  font-size: 30px;
  margin-top: 0;
  letter-spacing: -0.02em;
}
.ws-home > p {
  max-width: 68ch;
  line-height: 1.8;
}
.ws-home > .ws-actions {
  margin: 24px 0;
}
.ws-list {
  list-style: none;
  padding: 0;
  margin: 16px 0;
}
.ws-list > li {
  padding: 14px 0;
  border-bottom: 1px solid var(--ui-stroke-tertiary);
  overflow-wrap: anywhere;
}
.ws-list > li > button {
  white-space: normal;
  text-align: left;
}
.ws-list > li > .ws-muted {
  font-size: 11px;
  margin-left: 12px;
}
.ws-list > .ws-home-item { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.ws-list > .ws-home-item > button { max-width: 100%; height: auto; font-weight: 500; padding-inline: 0; }
.ws-home-location { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-text-secondary); font-size: 12px; }
.ws-list .ws-actions {
  margin-top: 8px;
}
.ws-empty {
  color: var(--ui-text-secondary);
  padding: 20px 0;
  line-height: 1.7;
  max-width: 64ch;
}
.ws-properties {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px 24px;
  padding: 12px 0 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--ui-stroke-tertiary);
}
.ws-properties > .ws-field {
  margin: 0;
}
.ws-table-wrap {
  overflow: auto;
  max-width: 100%;
  overscroll-behavior: contain;
  border: 1px solid var(--ui-stroke-tertiary);
  margin: 16px 0;
}
.ws-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 520px;
  font-size: 12px;
}
.ws-table td,
.ws-table th {
  border-bottom: 1px solid var(--ui-stroke-tertiary);
  padding: 10px 12px;
  text-align: left;
  min-width: 140px;
  max-width: 280px;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.ws-table th {
  font-weight: 500;
  color: var(--ui-text-secondary);
  background: var(--ui-bg-secondary);
}
.ws-table th button {
  white-space: normal;
}
.ws-table thead th {
  border-right: 1px solid var(--ui-stroke-tertiary);
}
.ws-table input:not([type="checkbox"]) {
  background: transparent;
  box-shadow: none;
  min-width: 100px;
}
.ws-table .ws-choice {
  margin: 0;
}
.ws-table .ws-label {
  position: absolute;
  clip-path: inset(50%);
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.ws-table tbody tr:hover {
  background: var(--ui-bg-secondary);
}
.ws-database-tools {
  display: flex;
  gap: 12px;
  align-items: end;
  flex-wrap: wrap;
}
.ws-database-tools > .ws-choice {
  min-width: 100px;
  margin: 0 auto 0 0;
}
.ws-database-filters {
  width: 100%;
  padding: 12px 0;
  border-bottom: 1px solid var(--ui-stroke-tertiary);
}
.ws-database-filters > div {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.ws-database-filters .ws-field {
  flex: 1;
  min-width: 140px;
}
.ws-database-filters summary {
  font-size: 12px;
  color: var(--ui-text-secondary);
}
.ws-board {
  display: flex;
  gap: 20px;
  overflow: auto;
  padding: 20px 0;
}
.ws-board-group {
  min-width: 200px;
  flex: 1;
  max-width: 320px;
}
.ws-board-group h3 {
  font-size: 12px;
  font-weight: 600;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--ui-stroke-secondary);
}
.ws-board-record {
  padding: 12px;
  border: 1px solid var(--ui-stroke-tertiary);
  background: var(--ui-bg-secondary);
  margin: 10px 0;
  border-radius: var(--radius-sm, 4px);
}
.ws-board-record > button {
  white-space: normal;
  text-align: left;
}
.ws-board-record .ws-label {
  font-size: 11px;
}
.ws-attachments {
  margin-top: 32px;
}
.ws-attachments h2 {
  font-size: 12px;
  color: var(--ui-text-secondary);
  margin: 0 0 8px;
}
.ws-attachments:has(> h2:only-child) {
  display: none;
}
.ws-document > details,
.ws-document > div > details {
  margin-top: 24px;
  color: var(--ui-text-secondary);
  font-size: 12px;
}
.ws-root summary {
  cursor: pointer;
}
.ws-root summary:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 3px;
}
.ws-menu {
  max-width: calc(100vw - 24px);
  max-height: var(--radix-dropdown-menu-content-available-height);
  overflow-y: auto;
}
.ws-menu [role="menuitem"] {
  white-space: normal;
  overflow-wrap: anywhere;
}
@container hermes-workspace (max-width: 1200px) {
  .ws-layout {
    grid-template-columns: minmax(0, 1fr) 268px;
  }
  .ws-document {
    padding: 28px 28px 40px;
  }
  .ws-comments {
    padding: 28px 16px;
  }
  .ws-editor-hint {
    display: none;
  }
}
@container hermes-workspace (max-width: 980px) {
  .ws-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .ws-comments {
    position: static;
    border-left: 0;
    border-top: 1px solid var(--ui-stroke-tertiary);
    max-height: none;
    padding: 24px 28px;
  }
  .ws-comments-heading {
    margin-bottom: 10px;
  }
  .ws-comments > p {
    max-width: 64ch;
  }
  .ws-comment-composer {
    max-width: 64ch;
  }
  .ws-title {
    font-size: 30px !important;
  }
}
@container hermes-workspace (max-width: 600px) {
  .ws-nav-resize { display: none; }
  .ws-body {
    display: flex;
    flex-direction: column;
  }
  .ws-nav {
    max-height: min(240px, 45cqh);
    border-right: 0;
    border-bottom: 1px solid var(--ui-stroke-tertiary);
    padding: 10px 16px;
  }
  .ws-nav-toggle { display: flex; width: 100%; justify-content: flex-start; text-align: left; }
  .ws-nav-toggle span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .ws-nav[data-expanded="false"] .ws-nav-content { display: none; }
  .ws-nav[data-expanded="false"] { overflow: visible; flex-shrink: 0; }
  .ws-nav h2 {
    margin: 16px 8px 6px;
  }
  .ws-nav .ws-search {
    flex-wrap: nowrap;
  }
  .ws-work {
    flex: 1;
  }
  .ws-document,
  .ws-home {
    padding: 24px;
  }
  .ws-topbar {
    padding: 10px 12px;
    gap: 8px;
  }
  .ws-source {
    display: none;
  }
  .ws-comments {
    padding: 24px;
  }
  .ws-passage-marker {
    left: -21px;
  }
  .ws-root .ws-title {
    font-size: 28px !important;
  }
  .ws-table-wrap {
    max-width: 100%;
  }
  .ws-toolbar {
    padding: 8px;
  }
  .ws-document-footer {
    margin-top: 16px;
  }
}
@container hermes-workspace (max-width: 480px) {
  .ws-topbar-compact { flex-wrap: nowrap; min-height: 40px; padding: 4px 12px; }
  .ws-topbar-compact h1 { white-space: nowrap; }
  .ws-nav { padding: 4px 12px; }
}
/* Passage bubbles share the document's scroll surface; there is no feed scroller. */
.ws-layout { display: block; margin-inline: auto; --ws-inline-comments: 0; --ws-comment-controls-gap: 20px; }
.ws-layout:not(.ws-folder-layout) > .ws-document { margin-right: 300px; }
.ws-comments.ws-bubbles { position: absolute; inset: 0 0 auto auto; width: 300px; padding: 0; max-height: none; overflow: visible; border: 0; pointer-events: none; }
.ws-bubble-header, .ws-bubble-group, .ws-bubble-footer { position: absolute; left: 12px; right: 20px; min-width: 0; pointer-events: auto; }
.ws-bubble-header p { margin: 8px 0; line-height: 1.5; }
.ws-bubble-header > div { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ws-bubble-header .ws-comments-heading { margin: 0; flex: 1; }
.ws-bubble-header .ws-actions { margin: 0; }
.ws-bubble-header .ws-check { margin: 0; flex: 1; }
.ws-bubble-header .ws-discussion-draft { flex-basis: 100%; }
.ws-bubble-header .ws-linked-thread { flex-basis: 100%; font-size: 12px; }
.ws-linked-thread > summary { cursor: pointer; color: var(--ui-text-secondary); }
.ws-linked-thread[open] > summary { margin-bottom: 8px; }
.ws-status-announcement { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ws-search-diagnostic { margin-top: 16px; }
.ws-search-diagnostic pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.ws-bubble { border: 1px solid var(--ui-stroke-secondary); border-radius: var(--radius-md, 6px); background: var(--ui-bg-editor); margin-bottom: 10px; overflow-wrap: anywhere; }
.ws-bubble-emphasis:not(.ws-bubble-selected) { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
.ws-bubble-selected { border-color: var(--ui-accent); border-left: 3px solid var(--ui-accent); }
.ws-bubble-cluster { border: 1px solid var(--ui-stroke-secondary); border-radius: var(--radius-md, 6px); background: var(--ui-bg-editor); }
.ws-bubble-cluster:has(.ws-bubble-selected) { border-color: var(--ui-accent); border-left: 3px solid var(--ui-accent); }
.ws-cluster-heading { display: flex; align-items: center; gap: 8px; padding: 8px 12px 0; }
.ws-cluster-heading > .ws-bubble-context { flex: 0 0 auto; }
.ws-cluster-heading .ws-choice { flex: 1; min-width: 0; margin: 0; }
.ws-cluster-heading .ws-choice-trigger { border-color: transparent; background: transparent; }
.ws-cluster-context { height: 1.5em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ws-bubble-cluster-emphasis { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
.ws-bubble-cluster-emphasis .ws-bubble-emphasis { outline: none; }
.ws-bubble-cluster .ws-choice button { width: 100%; max-width: 100%; min-width: 0; }
.ws-bubble-cluster [data-slot="select-value"] { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.ws-bubble-cluster .ws-bubble { margin: 0; border: 0; background: transparent; }
.ws-root .ws-bubble-summary { display: flex; flex-direction: column; align-items: stretch; gap: 6px; white-space: normal; width: 100%; height: auto; padding: 12px; text-align: left; font-weight: 400; }
.ws-bubble-context { font-size: 11px; color: var(--ui-text-secondary); line-height: 1.4; }
.ws-bubble-preview { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.6; }
.ws-bubble .ws-comment { padding: 12px; border-top: 1px solid var(--ui-stroke-tertiary); margin: 0; border-left: 0; }
.ws-bubble .ws-comment-composer { padding: 12px; margin: 0; border: 0; }
.ws-bubble-footer > div > h2 { margin: 12px 0; }
.ws-comment-controls-slot { pointer-events: none; }
.ws-comment-options { width: 240px; max-width: calc(100vw - 16px); display: grid; gap: 12px; }
.ws-comment-options .ws-check { margin: 0; }
.ws-section-preview { display: grid; gap: 8px; }
.ws-section-fragment { max-height: min(22vh, 180px); overflow: auto; line-height: 1.6; padding: 4px 0; overflow-wrap: anywhere; }
.ws-section-fragment:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
@container hermes-workspace (max-width: 1200px) {
  .ws-layout:not(.ws-folder-layout) > .ws-document { margin-right: 268px; }
  .ws-comments.ws-bubbles { width: 268px; }
}
@container hermes-workspace (max-width: 980px) {
  .ws-layout { --ws-inline-comments: 1; --ws-comment-controls-gap: 12px; }
  .ws-document-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
    margin-bottom: 12px;
  }
  .ws-document-header > .ws-title-wrap { grid-column: 1 / -1; grid-row: 1; margin: 0; }
  .ws-document-header > .ws-page-kind { grid-column: 1; grid-row: 2; align-self: center; margin: 0; }
  .ws-document-header > .ws-page-actions { grid-column: 2; grid-row: 2; justify-self: end; margin: 0 -8px 0 0; }
  .ws-layout:not(.ws-folder-layout) > .ws-document { margin-right: 0; }
  .ws-comments.ws-bubbles { width: 100%; }
  .ws-bubble-header, .ws-bubble-group, .ws-bubble-footer { left: 28px; right: 28px; }
  .ws-bubble-group { margin-left: 12px; border-left: 1px solid var(--ui-stroke-secondary); padding-left: 12px; }
}
@container hermes-workspace (max-width: 600px) {
  .ws-layout { --ws-comment-controls-gap: 8px; }
  .ws-document { padding-top: 12px; }
  .ws-document-header { margin-bottom: 8px; }
  .ws-editor-heading { margin-bottom: 8px; }
  .ws-bubble-header, .ws-bubble-group, .ws-bubble-footer { left: 24px; right: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .ws-root *,
  .ws-menu * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
${workspaceNavigationStyles}
`;
