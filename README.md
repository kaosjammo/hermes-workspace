# Hermes Workspace

**Write and organise your work inside Hermes Desktop.**

Workspace brings rich documents, structured project databases and passage-level feedback into the same place you use Hermes. Keep a client brief beside its invoice tracker, draft a chapter beside its scene database, or maintain household records without moving the work into a separate hosted application.

The review workflow connects feedback to the document it concerns: select a passage, leave a comment and explicitly ask Hermes to address unresolved feedback in a linked native conversation. You decide when a comment is resolved.

> **Development preview.** This repository publishes a frozen standalone source snapshot. The feature descriptions come from the maintained inventory; catalog validation and final acceptance are tracked in [issue #1](https://github.com/kaosjammo/hermes-workspace/issues/1). Genuine provider-positive saved edits and native Electron acceptance remain unqualified; a working interface or a preview video does not establish those outcomes. See [qualification and limitations](docs/QUALIFICATION.md).

## What you can work with

### Documents you can keep editing

Write in place with headings, bold, italic, underline, lists, checklists, quotes and code blocks. Add links, images and simple tables. Use the selected-text toolbar, undo/redo and autosave. Choose normal or wide layout per page and organise pages in nested folders.

Workspace retains unsaved recovery drafts when a save or connection transition fails. Recover or discard them explicitly rather than silently replacing the saved document.

### Databases with a document behind each record

Use text, number, checkbox, date, single-select, relation and same-row formula properties. Filter and sort records, switch to a single-select-grouped board, and open a record as a full document with its own notes and feedback.

For example, track subscription renewals, client invoices or a story's scenes. Those are examples of user-created databases, not separate financial integrations or built-in accounting products. Formula expressions use bounded helpers such as `col("Hours") * col("Rate")`; they do not execute arbitrary code.

### Feedback that stays with the passage

Attach comments to selected text or leave whole-page, record or database feedback. Highlights and discussion bubbles connect the passage to its thread. Reply, reopen or delete a discussion after confirmation. Detached or ambiguous anchors stay visible instead of silently attaching to different text.

An agent reply does not resolve feedback. The user's checkbox controls resolution.

### A native Hermes review path

**Address comments** captures every unresolved current-item comment, including comments with earlier replies. It uses a linked Hermes conversation and the configured Hermes model/runtime. Additional editable items require explicit per-run approval; a mention or a folder relationship grants no edit authority.

The implementation validates the final structured proposal against the captured scope and revisions before committing edits and comment outcomes. It refuses stale or ambiguous targeted replacements. This is the source-implemented workflow, not a claim that provider-positive completion has passed the remaining native qualification gates.

### Review and recovery controls

Run controls include item locking, progress, Stop, pre-run versions and explicit recovery. Stop revokes Workspace write authority before requesting native cancellation. Local recovery does not prove that an unconfirmed native thread has stopped.

Eligible agent-changed passages can offer section revert, preserving unrelated content and requiring confirmation after later manual editing. Whole-item Restore is a separate operation. Unsafe section mappings are unavailable rather than guessed.

### Bring work in and take it out

Import Markdown, UTF-8 CSV, Word `.docx` and text-based PDF. Export Markdown, CSV, DOCX and newly laid-out PDF. Conversion runs locally and targets editable semantic content, not exact Word/PDF layout. No scanned-PDF OCR is included.

Retain supported attachments and original Word/PDF files. Export a canonical Workspace backup for the stored document/database graph, discussions, attachments, templates, Trash and recovery history. Ordinary Markdown/CSV exports are not full-fidelity backups.

## Organisation and everyday controls

- Nested folders, item moves, recent documents and a resizable navigation tree.
- Search across Workspace titles, document text and stored table text values.
- Templates that create independent documents or records, including copied attachments.
- Trash with restore and explicit permanent deletion.
- Profile-local storage outside the plugin installation directory.

See the [complete feature guide](docs/FEATURES.md) for the detailed controls and boundaries. The [technical feature register](docs/FEATURE-REGISTER.md) preserves all 206 overlapping source-inventory entries without advertising them as 206 distinct features.

## Why this is a plugin

A prompt can describe a workspace. This plugin supplies the persistent editor, typed databases, comment anchors, SQLite transactions, file converters and recovery controls inside Hermes Desktop. It connects those application surfaces to Hermes-owned conversations and completion handling through plugin interfaces.

The package declares `workspace_apply`, `pre_llm_call` and `post_llm_call`, alongside its Desktop renderer and authenticated plugin API. Ordinary Address runs consume a validated final proposal after confirmed completion; they are not streaming tool writes.

## Local data and disclosure

- Workspace stores its data under the selected Hermes profile's `plugin-data/workspace/`, outside the installation directory. Local storage is not encryption or OS-user isolation.
- Workspace has no separate hosted account service, cloud converter or plugin telemetry. Import/export conversion is local; PDF conversion uses bounded local workers.
- Starting native agent work may send the authorised document/comment context to your configured model provider. Local storage does not imply offline inference.
- Native agent tools and approvals remain subject to Hermes policy. Workspace does not gain edit rights from model prose or bypass a host refusal.
- Complete backup restore replaces the current Workspace dataset after validation. It is not a merge and does not restore native session authority, Hermes credentials/configuration or local frontend drafts/preferences. Download a backup before replacement.

## Installation and compatibility

The standalone source repository is [kaosjammo/hermes-workspace](https://github.com/kaosjammo/hermes-workspace). This is a development preview, not a catalog-approved release. Use the supported Hermes plugin installer with this repository only after reading the qualification limits. Catalog admission is tracked in [issue #1](https://github.com/kaosjammo/hermes-workspace/issues/1).

The documented qualification target is Linux x64 with pinned Hermes commit `90d6b98fd86d20981ee06ddd5b7d93e4320f26a4`. macOS/Windows execution, native Electron acceptance and complete provider lifecycle coverage remain unqualified. Supported profile setup must respect explicit opt-outs; automatic installation into future profiles is not claimed.

## Demo and release evidence

The prepared demo is under 90 seconds. Public demo media and exact-commit validation results will be linked from issue #1 as they become available. Browser-preview footage does not establish native agent completion.

See [qualification and limitations](docs/QUALIFICATION.md) for the exact evidence boundary and unreleased work.

## Build from source

Use Node 26 or newer. From the repository root:

```bash
mkdir -p .local/toolchain
cp package.json package-lock.json .local/toolchain/
npm ci --prefix .local/toolchain --ignore-scripts
node scripts/build.mjs
```

The build writes `desktop/plugin.js`. Use an isolated Hermes environment for catalog validation with `--install-deps`; it prepares dependencies and must not share the live installation dependency state.

## Roadmap

- [Expand/Collapse all folders](https://github.com/kaosjammo/hermes-workspace/issues/2).
- [Saved drag-and-drop reordering](https://github.com/kaosjammo/hermes-workspace/issues/3).
- [New record and New property buttons](https://github.com/kaosjammo/hermes-workspace/issues/4).

These are open requests, not completed capabilities.
