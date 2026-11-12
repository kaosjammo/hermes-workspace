> **Historical initial-submission document.** For this production-derived replacement, use [current release status](RELEASE-STATUS.md), the [current README](../README.md) and [production feature audit](PRODUCTION-FEATURES.md). Old source identities, backlog labels and check totals below are preserved history, not qualification of the new pin.

# Workspace feature guide

This guide groups the maintained source inventory by what a user is trying to do. It covers implemented surfaces, qualification limits and unfinished work without treating them as one completed release. Consult [qualification](QUALIFICATION.md) before making installation or native-runtime claims.

The [feature register](FEATURE-REGISTER.md) preserves every inventoried UI, workflow and data entry. Those layers overlap; their combined entry count is not a distinct product-feature count.

<a id="documents-editor"></a>
## Documents and rich-text editing

- Create pages and record documents; edit their titles and rendered content in place.
- Apply headings, bold, italic and underline; write ordered/unordered lists, checklists, quotations and code blocks.
- Insert external hyperlinks, stable Workspace-item links, images and simple document tables.
- Use the compact formatting surface or selected-text toolbar. Editor shortcuts remain scoped so they do not take over Hermes-owned shortcuts.
- Preserve supported formatting during rich paste, copy and cut; undo and redo document edits.
- Autosave changes and flush pending edits before navigation or agent work. Save failures remain visible.
- Retain unsaved recovery drafts across source/connection changes. Recovery is an explicit choice, not an automatic overwrite of saved content.
- Choose normal or wide reading/editing layout per page or record. Width is a local view preference, not document content.

Record documents share the editor while retaining their database properties. Exact round-trip layout fidelity is outside scope. Local drafts and view preferences are outside the canonical Store backup.

[Detailed inventory](FEATURE-REGISTER.md#documents-editor)

<a id="navigation-organisation"></a>
## Navigation, folders, search, templates and Trash

- Open Workspace through the Hermes sidebar and browse its Home catalogue.
- Create nested folders, pages and databases; rename or move items and inspect folder contents.
- Reopen recent documents. Resize the navigation tree and retain its width preference; use the narrow-pane navigation controls.
- Search Workspace titles, document content and stored table text values with paged results and stale-result handling.
- Save page or record templates, then create independent copies of content, properties and attachment bytes.
- Move items to Trash, restore them with their hierarchy, or confirm permanent deletion. Folder deletion includes descendants; reference repair belongs to the deletion path.
- Reach page details, export and recovery through page actions.

Search covers Workspace records, not the entire filesystem, semantic embeddings or all native chat history. The release must reconcile exact navigation refinements against the frozen package rather than infer installed behaviour from a source snapshot.

[Detailed inventory](FEATURE-REGISTER.md#navigation-organisation)

<a id="structured-databases"></a>
## Structured tables, record documents, boards and formulas

- Create databases and records. Open each record as an editable document with its own discussion.
- Add or remove properties with validated schema and row values.
- Use text, number, checkbox, date and single-select properties, plus relations to other Workspace databases.
- Create records through the inline New record row and properties through the trailing table-header control. Clearer dedicated buttons are separately requested backlog work, not an additional shipped capability.
- Edit properties with validation feedback, retained drafts during pending writes and explicit retry paths.
- Sort/filter records and use a board grouped by a single-select property; change group/status values.
- Use bounded same-row formulas, dependencies, syntax help and visible errors. For example: `col("Hours") * col("Rate")`.

Formula support covers bounded arithmetic, comparisons, Boolean/conditional operations and supported scalar helpers. No arbitrary code, cross-row formulas or rollups are claimed. Relations are not a promise of rollup computation. Table text and record prose are distinct surfaces; cell-level comments and embedded live database views are outside scope.

Newer working-source refinements include per-lane board creation and selection/layout fixes. Their presence in a working file does not establish their presence in the submitted or installed artifact.

[Detailed inventory](FEATURE-REGISTER.md#structured-databases)

<a id="comments-review"></a>
## Passage comments, discussions and user-controlled resolution

- Comment on selected page/record text or leave whole-page, whole-record or whole-database feedback.
- Connect discussion bubbles with the matching text highlight, including overlapping discussions and narrow layouts.
- Navigate to the associated passage and open its discussion thread.
- Distinguish attached, detached and ambiguous anchors rather than choosing a different passage without permission.
- Add author-labelled replies and retain unsent comment/reply drafts within the Workspace scope.
- Submit through the focused comment controls, including the scoped keyboard submission path, and cancel an unsent comment without deleting saved feedback.
- Show or hide resolved discussions, resolve or reopen them as the user, and delete resolved or unresolved discussions after confirmation.

Deleting feedback does not delete the underlying prose or undo an agent edit. An agent reply never substitutes for the user's resolution checkbox. Exact shortcut/native focus behaviour remains subject to candidate-bound qualification.

[Detailed inventory](FEATURE-REGISTER.md#comments-review)

<a id="native-agent-workflow"></a>
## Address comments through a linked native Hermes conversation

The source-implemented workflow is explicit: save current edits, choose **Address comments**, capture the current item and unresolved comments, run in the linked native conversation, validate the final structured proposal, then save accepted edits and per-comment outcomes.

- Include all unresolved current-item comments, including previously answered comments; exclude those the user resolved.
- Create or reuse the item's native conversation, choose an eligible conversation from the bounded recent live/stored list, and open the linked thread.
- Use the configured Hermes model/provider/runtime rather than a separate plugin model client.
- Supply the complete captured current page as read context. Supply authorised related material only within the supported scope; nearby folders and incidental mentions do not grant access.
- Require explicit, fresh per-run approval for additional editable items. Approval stays bounded to captured identities and revisions.
- Support structured content changes, per-comment outcomes and replies-only work, including partial/inability explanations.
- Validate revision-bound targeted replacements; reject missing, stale, ambiguous or overlapping targets without silently falling back to an unrelated whole-document overwrite.
- Retain whole-document changes for work that genuinely needs them. Ordinary UI application consumes the final validated proposal, not streaming `workspace_apply` writes.

**Qualification:** genuine provider-positive saved editing remains unqualified. The frozen source README describes synthetic positive terminal fixtures and actual policy-veto refusal, not an accepted live-provider editing outcome. Current source also retains narrower guidance/metadata/reply-scope gaps. The archive's repeat-run revision finding needs reconciliation against the final candidate; do not describe it as reproduced today.

Full older conversation-history search, automatic attachment-content reading and necessity-aware sibling retrieval are not completed capabilities. No measured token, cost, speed or editorial-quality improvement is asserted.

[Detailed inventory](FEATURE-REGISTER.md#native-agent-workflow)

<a id="edit-controls-recovery"></a>
## Edit validation, run controls, drafts and recovery

- Bind admitted work to the captured profile, dataset, native owner, item scope and revisions. Model prose grants no write authority.
- Make admitted items read-only during work while other unlocked items remain usable; show run state and progress.
- Use transaction fences, idempotent application and edit/reply/provenance receipts to prevent duplicate or stale commits.
- Revoke Workspace write authority first when the user presses Stop, then request native cancellation.
- Offer explicit local recovery when native continuity is uncertain. Recovery can unlock local editing while the native thread's outcome remains unknown.
- Save pre-run versions and offer whole-item Restore, including coordinated database/schema recovery.
- Offer section revert for eligible anchored agent changes. Retain unrelated content, attachments, properties and discussion; revalidate the current page and request confirmation after later manual editing.
- Save a checkpoint before section revert. Refuse ambiguous, overlapping, superseded or otherwise unsafe section mappings.

Section revert, Restore pre-run version and local Recover are different operations. Whole-item Restore can overwrite later content; local Recover does not prove native cancellation. Active-provider Stop, complete lifecycle handling and native Electron behaviour remain unqualified. Archive descriptions are implementation/evidence records, not a current runtime acceptance certificate.

[Detailed inventory](FEATURE-REGISTER.md#edit-controls-recovery)

<a id="file-interchange"></a>
## Local import, export, attachments and conversion

**Import:** Markdown, UTF-8 CSV, Word `.docx` and text-based PDF.

**Export:** Markdown, UTF-8 CSV, semantic DOCX and readable newly laid-out PDF.

- Convert supported Word/PDF content into editable document semantics; retain original Word/PDF attachments.
- Retain item-owned attachments and supported document references. CSV import does not retain an original file attachment.
- Use local converters with bounded inputs, expanded archive validation and bounded PDF workers.
- Embed supported local raster images on export; do not fetch remote images. GIF/WebP output can use a static first frame rather than preserving animation.
- Prefix formula-like text in ordinary CSV output for spreadsheet safety. Full Store backup preserves the original values.

No OCR, legacy `.doc`, exact print layout or lossless round-trip is promised. No-text and mixed text/scanned PDF inputs are rejected rather than silently imported incompletely. Header/footer, footnote, drawing and tracked-change fidelity remain limited. Verify operation-specific limits against the candidate instead of publishing a single misleading upload-size promise.

Working-only DOCX list/code refinements and PDF styling/cell-image refinements need packaging and qualification before release claims.

[Detailed inventory](FEATURE-REGISTER.md#file-interchange)

<a id="local-storage-backup"></a>
## Local persistence and canonical Workspace backup

- Persist Workspace data in a profile-local SQLite store outside the plugin installation directory.
- Retain the item graph, properties/relations, comments/replies/anchors, attachments/originals, templates, Trash and saved pre-run/recovery history.
- Use dataset identity, revision checks, transaction boundaries and validated storage budgets.
- Export a versioned canonical archive with integrity/schema validation.
- Validate a complete restore before replacing the current dataset. Preserve internal references while detaching obsolete native thread/run authority.

Restore is replacement, not merge. Save a backup first. The canonical Store archive excludes frontend drafts/preferences, native conversations/configuration/credentials/execution authority and shared-membership catalogues. It is not a full-machine or full-Hermes-profile backup. Hash validation is not encryption or a signature.

[Detailed inventory](FEATURE-REGISTER.md#local-storage-backup)

<a id="profile-ownership"></a>
## Profile ownership, routing and dataset boundaries

Use Hermes-owned authentication and profile routing. Ordinary document/database operations remain scoped to the selected profile and captured dataset. Connection/profile changes invalidate stale work rather than transferring write authority to a different item or profile.

Source-side setup checks the installed backend through profile-scoped `plugins.manage` before publishing Desktop navigation. An explicit Desktop On decision may enable it through admitted host APIs; default loading respects opt-outs and restrictions. Agent tools in existing chats need a new session. The Desktop-only switch does not disable the backend.

That newer setup change is a separately reconciled documentation addendum, not an invented extra inventory entry or proof that native toggle execution passed. Do not claim automatic installation into future profiles, cross-profile document sharing or OS-level isolation.

[Detailed inventory](FEATURE-REGISTER.md#profile-ownership)

<a id="unreleased-shared-executor"></a>
## Unreleased shared projects and independent executors

These product directions remain outside completed release claims:

- Private profile spaces alongside local shared projects with explicit membership.
- Editor/read-only roles, authoritative membership revocation and unlisted-profile exclusion.
- Confirmed private-to-shared moves that preserve data and avoid partial exposure.
- Shared-space interchange and backup composition.
- A remembered per-page executor/profile with its matching native conversation, independent of the app's ambient profile.
- Complete current/future-profile availability with preserved opt-outs and admission rules.

The inventory retains backend primitives, selection data and frontend/API seams so this work is not forgotten. Partial or unmounted composition is not a shipped shared-workspace product.

[Detailed inventory](FEATURE-REGISTER.md#unreleased-shared-executor)

<a id="integration-interfaces"></a>
## Plugin interfaces and evidence boundaries

The unified package includes `plugin.yaml`, `__init__.py`, `workspace_plugin/`, its authenticated dashboard API and Desktop bundle. The manifest declares `workspace_apply`, `pre_llm_call` and `post_llm_call`; the renderer uses Hermes plugin SDK surfaces. Full-state and lightweight catalogue/document/history endpoints exist, but their presence does not establish lazy loading in every frontend view.

No core source change or separately operated hosted service is required by the plugin architecture. Local PDF workers and explicit native model work still need disclosure. Tests in source, generated bundles, installed package identity, loaded runtime identity and native visual acceptance are different evidence layers.

[Detailed inventory](FEATURE-REGISTER.md#integration-interfaces)

## New repository backlog, not shipped claims

Mike's latest intake adds:

- Expand all / Collapse all actions for the folder tree.
- Drag-and-drop reordering with saved ordering.
- Clear New record and New property buttons, reconciled with existing inline creation controls.

These requests are tracked in the standalone repository as [#2](https://github.com/kaosjammo/hermes-workspace/issues/2), [#3](https://github.com/kaosjammo/hermes-workspace/issues/3) and [#4](https://github.com/kaosjammo/hermes-workspace/issues/4). They do not change the archived inventory denominator or authorise implementation.
