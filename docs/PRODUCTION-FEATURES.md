# Workspace frozen-candidate feature audit

## Purpose and evidence boundary

Audience: the release preparer and catalogue reviewers. Purpose: describe the complete production-derived candidate without mistaking old documentation, issue status, test source or dormant modules for completed product behaviour.

- Frozen source: the production-derived source retained at this repository root, before release-only metadata/documentation changes.
- Manifest inventory identity: `d987016e5030a7b6acf9958d24fde92c208f582c8a0db8472942fb1b6d1d65b1`.
- Production commit recorded in the supplied manifest: `55b6926fd92549e0d9c6fb3824a65eefdba14bb7`.
- Frozen Desktop bundle SHA-256: `dce73634c6ec36ce5258ed212d99da7d519ec14dce66cc42e5c6a021834cd0e9`.
- Verified here: all 222 candidate files match their manifest hashes, with no missing or extra paths. The packager's complete inclusion rule selects 22 runtime/package files. All 70 Python files parse as ASTs without importing or executing them.
- Supplied provenance, not independently re-read here: all runtime files were overlaid from the actual installed package; current integration source matches those runtime files except the stale installed README. This audit did not touch or re-read the live installation.
- Coverage: every file was mechanically inventoried and hash-checked. Semantic review concentrated on frontend composition, implementation modules, API, build/package declarations and relevant regression assertions. The 136 test/support files were indexed; not every test body was reviewed. The PNG was hash-checked only, not viewed. This is not a claim that 222 files received line-by-line semantic inspection.
- No application tests, broad suite, build, install, provider run, browser/native interaction or external publication was performed. AST parsing and hashes are not functional tests.

The original [feature register](FEATURE-REGISTER.md) retains all 206 overlapping UI/workflow/data entries. They are not 206 distinct features or an upgrade of their original qualification labels. The audit is a source inventory, not an application-test or provider-success receipt.

### Status vocabulary

- **Implemented, composed:** source has an ordinary UI/backend path in this candidate. Not newly runtime-qualified.
- **Implemented, guarded native path:** backend and UI path exist, but successful completion depends on host/provider/native authority and separate qualification.
- **Primitive or unmounted:** code exists, but it is not an available completed Desktop experience in the default composition.
- **Not implemented/qualified as a claim:** do not advertise the broader capability.

All source paths below refer to the frozen tree. Regression references identify source evidence only, not passing results from this audit.

## Findings that materially change public copy

### MAJOR F-01: the old roadmap excludes functionality that is now installed

`README.md:103-109`, `docs/FEATURES.md:174-182` and `docs/QUALIFICATION.md:56` describe Expand/Collapse all, saved drag-and-drop ordering and clearer database creation as backlog. The frozen implementation contradicts that description:

- `frontend/workspace.jsx:160-277` composes Expand all, Collapse all, Reorder, sibling drag targets, keyboard alternatives and feedback.
- `workspace_plugin/store.py:1054-1118` persists sibling ordering with revision and run-lock checks.
- `frontend/tables.jsx:218-300,357-449` composes the top New menu, labelled record/property creation and per-board-lane creation.
- These strings are also present in the frozen installed bundle, as recorded in `source-coverage.json`; markers supplement source composition, not execution evidence.

**Correction:** include these capabilities with their exact scope. Reorder is sibling-only, not drag-to-reparent or arbitrary record ordering. Do not infer completion from whether issues are open or settled.

### MAJOR F-02: old working-only and repeat-run caveats need reconciliation

The old feature guide calls board creation and DOCX/PDF refinements working-only. They are present in the current production-derived `tables.jsx` and `workspace_plugin/interchange.py`. Include their bounded semantic behaviour, not lossless document conversion.

The archived manual-revision projection gap is not the current code path: `Store.snapshot(include_content_revisions=True)` derives tokens before private-field stripping (`store.py:341-355`), `Workflow.prepare` requests them (`workflow.py:156-162`) and the prompt uses `content_revision` (`workflow.py:178-204`). `test_default_native_lifecycle.py:126-142` explicitly covers a subsequent targeted proposal after manual revisions. This audit did not execute that test. Do not repeat the old gap as a freshly reproduced defect, and do not replace it with a provider-success claim.

### MAJOR F-03: complete inclusion does not make sharing a finished feature

The full package retains `shared_workspaces.py`. It contains substantive local membership and atomic move logic, not merely placeholders. However, the default API sets `shared_root=None`, reports sharing unavailable, and refuses shared routes before opening a store (`dashboard/plugin_api.py:177-193`). The static import graph reaches 35 frontend modules from `frontend/index.jsx` but not `profile-workspaces.jsx`, `profile-workspaces.mjs` or their styles.

Saved executor selection is inert data. `workflow.py:135-137` and `store.py:1494-1495` refuse unsupported executor/thread ownership rather than silently running under the ambient profile. Include all these files in the package while labelling the capability **primitive/unmounted**, not a released private/shared workspace switcher or independent per-page agent product.

### MAJOR F-04: identity and current comment UX must not disappear from the summary

`identity.jsx` is imported by the mounted Workspace; `Comments` uses `AuthorHeader`. Username persistence, recorded executing-agent attribution, scoped avatar lookup, full-name disclosure and origin-based reply layout are present. Current comment cards also have preview expansion, outside-intent collapse, stable numbering, changed-range highlights and separate Resolve/Delete/Revert controls. These are real implementation surfaces, not merely planned issue text.

### MAJOR F-05: qualification remains a separate release concern

`test_default_native_lifecycle.py:1-7,67-103` explicitly uses synthetic terminal data. The default finalisation path relies on actual process-bound private host interfaces (`native_owner.py`) and canonical session records (`native.py`, `final_run.py`). A catalogue probe, bundle identity, component test or native refusal is not a successful provider edit. The drafts retain this distinction. Older evidence in `docs/QUALIFICATION.md` refers to different identities and is not promoted to this candidate.

### MINOR F-06: old public documentation is internally stale beyond the README

The frozen feature guide/register/qualification pages retain older source and installation identities and mutually different status language. `README.draft.md` is self-contained and does not present those pages as a current acceptance certificate. Before publication, the release owner should reconcile those documents or explicitly label them historical. This task changes none of them.

## Comprehensive capability inventory

### documents-editor

Status: **implemented, composed**.

| Capability | Actual depth and boundaries | Source evidence |
|---|---|---|
| Page and record editing | In-place visual content and title editing. Record properties remain separate from prose. Folders are not document editors. | `workspace.jsx` WorkspaceSource and document rendering; `page-title.jsx`; `rich-editor.jsx`; `store.py` `_create`, `_patch` |
| Formatting controls | Format text disclosure and selected-text toolbar; Text and Heading 1–3; bold, italic, underline; lists, checklist, quote and code. Normal-weight markers can override inherited bold without permitting arbitrary CSS. | `rich-editor.jsx:531-704,969-1086`; `editor-commands.mjs`; `store.py` HTML parser |
| Links and embedded content | External links, stable `#workspace/` links, simple document tables and explicit local image upload. Image hydration uses stored attachment references. | `rich-editor.jsx`; `editor.mjs` safeHref/sanitise/hydrate paths; `interchange.py` `_url`, `_prepare_export` |
| Structural editing | Selected/caret formatting, rich paste, copy/cut and history retain supported rich structure and selection. Presentation-only comment gaps are stripped from saved HTML/history. Pasted images are removed and editor drop is prevented. | `editor-commands.mjs`; `rich-editor.jsx:780-916`; `editor.mjs` `editorHTML` |
| Keyboard use | Scoped Ctrl+Alt+B fallback; Ctrl/Cmd+I/U; undo/redo; Ctrl/Cmd+Alt+M; Tab can enter the selection toolbar. Host-claimed events and input-method composition are respected. Not a global host-keybinding replacement. | `rich-editor.jsx:782-864`; `tests/ui/lane-c.test.mjs` |
| Autosave and departure | Pending title/body/property writes flush before relevant navigation/agent actions. Failure stays visible and can prevent departure. Remote refresh does not intentionally overwrite an in-flight local draft. | `rich-editor.jsx`; `page-title.jsx`; `workspace.jsx`; `client.mjs` |
| Recovery drafts | Separate title, body, property and discussion buffers, keyed by connection/profile/dataset/item. Explicit recovery or discard; token acknowledgements do not clear newer drafts. Home exposes retained-document recovery. Storage failures ask the user to copy text. | `drafts.mjs:1-47`; `workspace.jsx`; `page-title.jsx`; `rich-editor.jsx` |
| Document width and details | Local normal/wide preference per document/source/dataset, page details and utility dialogues. Preferences are not document content and are excluded from canonical backup. | `document-width.mjs`; `workspace.jsx`; `ui.jsx` |

Regression sources: `tests/ui/repair2-editor.test.mjs`, `repair3-editor.test.mjs`, `repair1-drafts.test.mjs`, `ui-overhaul-recovery.test.mjs`, `ui-overhaul-wide.test.mjs`, `lane-c.test.mjs`, `tests/test_store.py` normal-weight/interchange cases. These include structural, IME, stale-source and failure paths; not native acceptance receipts.

### navigation-organisation

Status: **implemented, composed**.

| Capability | Actual depth and boundaries | Source evidence |
|---|---|---|
| Entry and Home | Workspace sidebar and `/workspace` route; Home catalogue, page/database/folder creation, folder contents and recently opened items. Selection/Home/Trash are component state, not separately registered routes. | `index.jsx`; `workspace.jsx`; `store.py` `execute` |
| Folder tree | Nested folders, current-item indication, retained native disclosure state during updates, Expand all and Collapse all including nested descendants. Bulk state is view state, not a synced folder property. | `workspace.jsx:101-277` |
| Saved ordering | Explicit Reorder mode with drag handles and Move up/down. Before/after positions within the same parent; stale sibling intent, cross-parent drops and foreign drag tokens refuse. No reparenting or database-record order changes. | `workspace.jsx:81-99,174-277`; `navigation-order.mjs`; `store.py:1054-1118` |
| Moves and labels | Separate folder destination dialogue excludes cyclic/subtree targets. Context distinguishes duplicate item and attachment names while keeping stable IDs. | `folder-destinations.mjs`; `item-labels.mjs`; `workspace.jsx`; `store.py` `_parent`, `_patch` |
| Pane navigation | Pointer/keyboard resizing, stored width, narrow-pane controls and destination focus. | `navigation-resize.jsx`; `workspace-navigation-styles.mjs`; `workspace.jsx` |
| Search | Literal, case-insensitive titles/plain content/text-valued computed properties; snippets, context, accurate totals and revision-bound pages. 200 ms frontend debounce, IME handling, clear/retry and stale-result suppression. It is not semantic search or a filesystem/chat index. | `workspace-search.jsx:1-98`; `client.mjs`; `store.py:462-482` |
| Templates | Save page/record content/properties and attachments; create independent copies with remapped attachment IDs. Record schema must match. Not a linked/synchronised live template. | `store.py:1244-1270`; `workspace.jsx` |
| Trash and purge | Cascade Trash, parent-aware restore, explicit permanent purge and reference repair. No automatic expiry. Removing comments is a separate action. | `store.py:1173-1194`, `_purge`; `workspace.jsx` |

Regression sources: `tests/ui/issue-2-tree.test.mjs`, `issue-3-navigation.test.mjs`, `folder-destinations.test.mjs`, `ui-overhaul-search.test.mjs`, `tests/test_issue3_navigation.py`, `tests/test_store.py` recents/search/Trash/template/purge cases.

### structured-databases

Status: **implemented, composed**.

| Capability | Actual depth and boundaries | Source evidence |
|---|---|---|
| Typed database schema | Text, number, checkbox, date, single-select, relation and formula properties. Backend validation owns schema and value acceptance. Removing a column removes its values and requires confirmation. | `tables.jsx`; `store.py` `_columns`, `_properties`, `_set_columns` |
| Record documents | Create/open records as documents with properties and comments; record-to-database ownership is immutable. Record removal uses Trash. | `tables.jsx:388-449`; `RecordProperties`; `store.py:748-779` |
| Creation surfaces | Top New menu provides New record/New property; inline record creator, trailing property control, board property control and per-lane creation remain. Duplicate pending submissions are gated; empty/invalid input and IME do not accidentally submit. | `tables.jsx` `PropertyCreator`, `NewRecordCreator`, `Database` |
| Drafts and field errors | Property/creation failures keep drafts, explicit retry/cancel and field-specific errors. Pending work guards navigation/view changes. Nullable values use null rather than conflating them with empty text. | `tables.jsx:1-306,307-369`; `drafts.mjs`; `database.mjs` |
| Table presentation | Literal filter, selected sort field/direction, record counts, active-record context and scrollable containment. Filter/sort are frontend view state, not persistent saved database views. | `tables.jsx:343-449`; `database.mjs` |
| Boards | Group by a single-select property; choose another select property, move a record through its property control and create directly into a lane or null/unassigned group. No board drag-and-drop claim. | `tables.jsx:373-428`; `database.mjs` `boardGroups` |
| Relations | Validated record-ID links to another database with Trash/purge repair. No rollups or automatic cross-row formulas. | `store.py` `_columns`, `_properties`, `_purge`; `tables.jsx` property editors |
| Formulas | Bounded scalar AST language; same-row dependency chains and cycle detection, arithmetic/comparison/Boolean/conditional operators and named helpers. Errors are exposed separately, not disguised as valid values. No Python eval, object access or cross-row reads. | `formulas.py:1-187`; `store.py` `_computed`; `tables.jsx:452-460` |
| Lock scope | Record edits respect the record run; schema mutation also checks affected records. Unlocked unrelated material remains usable. | `tables.jsx:348-349`; `store.py` `_unlocked`, `_set_columns` |

Regression sources: `tests/ui/issue-4.test.mjs`, `issue4-council-minor.test.mjs`, `rendered.test.mjs`, `repair1-persistence.test.mjs`, `tests/test_formulas.py`, `tests/test_store.py`. Examples such as invoices, subscriptions and scenes are user-created databases, not separate integrations.

### comments-review

Status: **implemented, composed**.

| Capability | Actual depth and boundaries | Source evidence |
|---|---|---|
| Feedback scope | Selection anchors on pages/records; whole-page/record/database comments. Databases reject passage anchors and folders reject comments. No table-cell comments. | `comments.jsx`; `rich-editor.jsx`; `store.py:1195-1209` |
| New-comment composition | Cancel at composer level, scoped Ctrl+Enter, plain Enter newline, exact retained text/anchor on failure, single-submit gate and IME checks. Comment references are not an authorisation panel. | `comments.jsx:365-440` |
| Stable numbering | Full-item ID-based ordinal mapping precedes resolved filtering. Whole-item/detached comments keep numbers; no invented passage for them. | `comment-highlights.jsx:5-46`; `comments.jsx`; `workspace.jsx` |
| Highlight association | CSS highlights and numbered gutter controls; hover/focus association and explicit passage navigation. Multiple discussions sharing a line remain separately selectable. Decorations are not saved content. | `comment-highlights.jsx:48-308`; `comment-bubbles.jsx` |
| Responsive placement | Margin cards in wider panes; reserved inline space near selected text in narrow panes, with table discussions placed after the table. Resize can reveal an already focused comment field without taking new focus. | `comment-bubbles.jsx:36-190`; comment/editor styles |
| Current card interaction | Collapsed author/preview/reply-count header; preview/card click opens; outside click or user Tab transition collapses. Escape collapses. Programmatic focus, text selection, active popups and pending operations are not treated as outside intent. | `comments.jsx:443-544`; `tests/ui/issue9-user-ux.test.mjs:36-97`; `comment-text-expansion.test.mjs` |
| Replies | Separate human, agent and unknown-origin presentation; author-labelled history; retained per-comment reply drafts and explicit submit. Literal reply text is not parsed as an author-role instruction. | `comments.jsx`; `identity.jsx`; `store.py` `_reply` |
| Resolve and reopen | User checkbox is independent of reply presence. Reopening preserves the discussion. Show/hide resolved controls do not invent resolution by the agent. | `comment-actions.jsx:14-43`; `store.py:1211-1229` |
| Delete discussion | Explicit confirmation, locked/pending gates, retention of unrelated drafts/content. Store keeps a provenance tombstone rather than erasing recovery IDs. Deletion is not prose deletion or section undo. | `comments.jsx`; `store.py:1217-1222`; `test_comment_deletion.py` |
| Changed-passage geometry | Display can map to actual changed spans, including disjoint ranges, not the whole initial broad selection. Unsafe mappings stay detached; no broad quote fallback. Earlier effective geometry can survive a later reverted generation when independently provable. | `sections.py` `addressed_anchors`, `map_anchor`; `store.py` `_section_geometry`, `_section_view`; `editor.mjs` |
| Action layout | Separate sibling Resolve/Delete/Revert controls avoid nesting inside the summary button. Disabled revert has an explanation; active operations deduplicate actions. | `comment-actions.jsx`; `comments.jsx`; comment styles |

Regression sources: `test_issue8_comments.py`, `test_changed_passage_highlights.py`, `test_comment_focus_fixes.py`, `test_comment_deletion.py`, `tests/ui/issue-8.test.mjs`, `issue-9-actions.test.mjs`, `issue9-user-ux.test.mjs`, `comment-text-expansion.test.mjs`, changed-passage browser/component sources. Native focus, zoom and pane sizing need execution evidence beyond source assertions.

### Author identity, a current mounted addition

Status: **implemented, composed**. This extends the older comments/profile inventory; it is not omitted merely because the older register predates it.

- A Set username dialogue saves/resets an admitted human display preference. The backend validates length/control characters, preserves immutable identity, and updates that human's known comments/replies. Unknown imported legacy authors are not reattributed to the receiving user.
- Agent identity is captured from the admitted executing home's structured profile metadata at run preparation. The saved outcome does not use whichever profile happens to be selected later.
- Eligible avatars are requested only from the exact matching host profile asset route. Source/dataset generation, MIME, base64, size and dimension checks precede display. Missing/unsafe/stale data uses a neutral initial fallback; no arbitrary URL/avatar fetch.
- Reply headers can disclose a long full name. Summary author content remains noninteractive to avoid nested controls. Human/agent alignment follows recorded origin, not names such as `Hermes` or `user`.
- Identity is display/provenance, not a permission grant. Backend identity capture still uses private host metadata helpers and is not advertised as an independent public server-identity contract.

Evidence: `frontend/identity.jsx:9-80`, `identity.mjs:1-79`; `workspace_plugin/identity.py:8-83`; `store.py:1135-1155`; `workflow.py:148-150`; `store.py:1634-1635`. Regression sources: `test_issue10_identity.py`, `test_issue10_api.py`, `test_issue10_workflow.py`, `test_issue10_review01.py`, `tests/ui/issue-10-identity.test.mjs`, `issue-10-review01.test.mjs`.

### native-agent-workflow

Status: **implemented, guarded native path**. No new provider-positive qualification in this task.

| Capability | Actual depth and boundaries | Source evidence |
|---|---|---|
| Explicit Address | Flush relevant drafts, capture all unresolved current-item comments including previously answered ones, then submit to Hermes. Resolved/deleted comments are excluded. | `workspace.jsx`; `workflow.js:118-175`; `store.py:1490-1565` |
| Thread lifecycle | Create/reuse a per-item native stored thread, explicitly select another eligible thread, open it in a native tab. Route, owner and activation epoch are captured across awaits. | `workflow.js:31-116,152-175,203-210`; `thread-picker.jsx`; `workflow.py` `bind_thread` |
| Thread discovery | Merge/deduplicate live and stored host feeds using canonical IDs; filter/select within the available recent list. This is not complete historical conversation search. | `workflow.js:84-105`; `thread-picker.jsx` |
| Per-run scope review | Fresh unchecked additional targets; authenticated, expiring, single-use review ID matched to revision/comment signature and exact selected IDs. A database grant includes its record descendants. Plain mentions, links and old target metadata do not mint permission. | `scope-review.jsx`; `workflow.py:94-171`; `store.py:1490-1565` |
| Context and guidance | Full captured allowed-item content and current comments, with exact revision tokens. Prompt asks for separate outcomes, concise replies, coherent changes and explicit requests for missing context. No automatic reading of all attachments or necessity-aware sibling retrieval product. | `workflow.py:178-204`; `store.py:341-355` |
| Ordinary proposal protocol | Final JSON edits/replies only; no model identity/grant fields. Pre/post hooks stage untrusted data. Confirmed canonical native completion and the actual serving owner are required before effects. | `final_run.py:35-116,152-211`; `finalization.py`; `native.py`; `native_owner.py` |
| Authorised edits | Restricted title/content/properties/columns patches; no model resolution, deletion, reparenting or arbitrary command API. Targeted replacements and full-content changes are distinct modes. | `store.py:1567-1649`; `finalization.py` `validate_proposal` |
| Outcomes | Per-captured-comment replies, including partial/inability explanations; replies-only work allowed. Agent replies do not resolve the user checkbox. | `finalization.py`; `workflow.py` `_outcomes`, `_finish`; `store.py` `apply_run` |
| Independent tool path | Registered `workspace_apply` remains independently guarded by native admission/epoch/scope. Ordinary final-output runs prohibit it rather than granting a streaming bypass. | `__init__.py:6-14`; `workflow.py` `apply`, `apply_tool`; `final_run.py` |

Regression sources: `test_default_native_lifecycle.py`, `test_default_native.py`, `test_native_observation.py`, `test_finalization.py`, `test_workflow.py`, `tests/ui/lane-b.test.mjs`. Synthetic canonical terminal data is explicitly identified in the lifecycle fixture; it is not provider inference.

### edit-controls-recovery

Status: **implemented**, with native cancellation/lifecycle results **separately unqualified**.

| Capability | Actual depth and boundaries | Source evidence |
|---|---|---|
| Targeted edits | Exact SHA-256, updated timestamp and manual revision; unique nonempty original HTML preimages, nonoverlapping ranges and canonical supported result. All replacements address the same original revision. No silent full-overwrite fallback. | `targeted_edits.py:15-76`; `store.py:1592-1649` |
| Atomic effects and receipts | Resolve compact edits before mutation; one transaction for edits/replies/provenance/receipt. Digest-bound retries do not duplicate effects and do not revive revoked scope. | `store.py` `_transaction`, `apply_run`; `final_run.py:171-209` |
| Conflicting terminal proposal | A joined native terminal turn with `TargetedEditConflict` is marked error/not saved, revokes the proposal and unlocks. Other unconfirmed failures can still require Recover. | `final_run.py:188-203`; lifecycle test `test_rejected_targeted_terminal_proposal_unlocks_without_applying_or_retrying` |
| Run locks and progress | Snapshot versions and lock all allowed items; unrelated unlocked documents remain usable. Progress/status reflects native ledger and saved state. Outcome dismissal is keyed to a run rather than hiding future runs. | `store.py:1552-1564`; `workflow.py` `status`; `run-outcome.mjs`; `workspace.jsx` |
| Stop | Persist revocation before requesting `prompt.cancel` for the exact admission. No guaranteed provider cancellation from local unlock. | `workflow.js:187-201`; `workflow.py` `stop`, `recover` |
| Recover | Explicit local authority revocation/unlock when continuity is unknown; preserves honest native uncertainty and prior accepted changes. Conservative process-owner cleanup is not proof of provider termination. | `workflow.py` `recover`; `store.py` `recover_runs`; `workspace.jsx` |
| Whole-item Restore | Saved title/content/properties/schema history; coordinated database/record restore. Later incompatible row values are retained visibly in record prose instead of silently discarded. Restore can replace newer edits. | `store.py:1271-1318`; `restore.jsx`; `workspace.jsx` |
| Section revert | Eligible anchored change provenance, exact preview tokens, revision/dataset checks and fresh consent after later manual edits. Retains unrelated content/attachments/properties. Unsafe overlap, superseded or ambiguous mappings refuse. | `sections.py`; `store.py` `_section_plan`, `_preview_section`, `_revert_section` |
| Revert reply cleanup and checkpoint | Only precisely associated agent response IDs are removed from the live discussion and archived in the pre-revert checkpoint. Comment identity, original feedback, unrelated/human replies and resolution are not replaced. No provenance means no guessed cleanup. | `store.py:1001-1032`; `_section_responses`; `test_issue9_revert.py` and review regressions |

Regression sources: `test_targeted_edits.py`, `test_sections.py`, `test_section_store.py`, `test_section_api.py`, `test_issue9_revert.py`, `test_issue9_review01.py`, `test_issue9_review02.py`, `test_issue9_review03.py`, `tests/ui/repair3-restore*.mjs`. Restore, section revert and local Recover are not synonyms.

### file-interchange

Status: **implemented, composed**, subject to semantic fidelity and resource limits.

| Capability | Actual depth and boundaries | Source evidence |
|---|---|---|
| Markdown | Import supported Markdown to editable sanitised HTML; retain original. Export supported semantic content/internal links. Not full Markdown-dialect fidelity or a graph backup. | `interchange.py` `_markdown`, `_md`, `import_file`, `export_document` |
| CSV | UTF-8 import to text-property records, bounded rows/columns/cells; no original CSV attachment. Export database values, quoting/newlines and formula-like text protection. Not typed round-trip or comment/prose export. | `interchange.py:354-433` |
| DOCX import | Validates OOXML archive/XML/relationships, rejects active or unsafe embedded content. Reads supported headings/marks/links/tables, numbering/restarts and code whitespace. Drawings/images and unsupported objects are omitted from editable text; original retained. | `interchange.py:540-664,1062-1076` |
| DOCX export | Real OOXML document, headings/marks/links, list numbering, preformatted code, table-cell block flow and supported local raster images. Not exact original layout or a promise that images round-trip through DOCX import. | `interchange.py:706-877` |
| PDF import | Strict text extraction in source-page order with original attachment. Encrypted PDFs and detected no-usable-text/image-only cases refuse. No OCR or layout reconstruction; no guarantee of extracting every image's embedded text from mixed content. | `interchange.py:912-935,1062-1076` |
| PDF export | Newly laid-out readable PDF, embedded supported Latin fonts/CJK handling, heading/quote/code styling, lists/tables and local raster flow including table cells. No universal font/script or exact pagination guarantee. | `interchange.py:938-1059` |
| Images | Resolve item-owned supported attachments, validate bytes/dimensions, embed supported local raster output. No remote image fetch; GIF/WebP may become a static frame. | `interchange.py` `_image_bytes`, `_prepare_export`; `editor.mjs` |
| Attachments and originals | Store original Markdown/DOCX/PDF and user-selected attachment bytes, list/download exact attachments, retain supported references through template copies/purge/recovery. No automatic model attachment parsing. | `workspace.jsx`; `store.py` `_attachment`, `_purge`; API import/export routes |
| Converter containment | Input/expanded archive/member/semantic limits; traversal, duplicate, symlink and dangerous XML/relationship checks; PDF child process with 20-second parent timeout, POSIX 15-second CPU and 512 MiB address-space limits. These are converter bounds, not one universal upload limit. | `interchange.py` `_archive_directory_preflight`, `_archive`, `_xml`, `_pdf_in_worker`, `_pdf_child`; API `_body`, `_binary` |

Regression sources: `test_interchange.py`, `test_interchange_review22.py`, `test_interchange_review24.py`, `test_review25_content.py`, `test_review26_pdf.py`, `test_review27_content.py`, `test_api.py` image/restore/interchange cases. Existing source characterisations and limits should not be described as lossless conversion.

### local-storage-backup

Status: **implemented, composed**.

- SQLite store under the selected profile's `plugin-data/workspace/`, outside installation; file/directory checks include symlink refusal and private database modes. Local application permissions are not encryption or OS-user isolation.
- Persistent categories: items, comments, versions, attachments, runs, recents and templates. Revision/dataset identities and transaction rollback constrain writes. Formulas and display anchors are derived projections, not duplicated raw backup state.
- Canonical archive includes complete supported stored graph, history, attachment bytes, templates and Trash. Schema/digest/graph validation precedes replacement; active-run and malformed graph constraints refuse invalid snapshots.
- Full replacement preserves the destination's scope boundary and detaches native sessions/run/executor authority and avatar authority. Historical provenance remains inert data. Local identity preferences, frontend drafts/preferences, credentials, native chat/configuration and shared-membership catalogue are not a restored authority source.
- Compact restore returns a commit receipt. A lost response is checked by scoped status/readback, not automatic destructive POST replay. Receipts are bounded/process-local, so a missing post-restart receipt means unknown, not permission to repeat.
- Lightweight catalogue, document and separate history endpoints exist. Catalogue avoids content/history/blob projection; document/history implementation can still load the graph internally. The mounted frontend still uses full state in key paths. Do not claim universal lazy loading, an indexed search engine or measured performance savings.

Evidence: `store.py:215-482,1714-1795,2269-2307`; `interchange.py:1089-1181`; `dashboard/plugin_api.py:119-170` and backup/restore endpoints; `client.mjs`; `restore.jsx`. Regression sources: `test_store.py`, `test_api.py`, `test_interchange.py`, `tests/ui/repair3-restore.test.mjs`, `repair3-restore-ui.test.mjs`.

### profile-ownership

Status: **implemented default private-profile path**, not automatic all-profile deployment.

- Host owns authentication, the selected profile home, profile routes and admission. Client JSON does not provide an arbitrary store path or authenticated principal.
- Renderer captures connection/profile/activation epoch, resets on source change and rejects stale read/write publication. REST writes are serialised and dataset-scoped.
- Registration waits for a usable host connection/profile. It lists the installed backend through profile-scoped `plugins.manage`; navigation is published only after confirmation. Default loading respects backend opt-out. Explicit Desktop On can request enabling this installed package and reads back the result. Uncertain mutation is not silently replayed.
- The pure `desktop_default_enabled` helper is a policy primitive, not implementation of automatic installation into current/future profiles. A Desktop switch is not a claim of complete backend/session lifecycle control.

Evidence: `index.jsx:5-24`; `backend-activation.mjs:1-97`; `workspace.jsx:58-73`; `client.mjs`; `dashboard/plugin_api.py:43-63,172-185`. Regression sources: `tests/ui/backend-activation.test.mjs`, `backend-registration.test.mjs`, `client.test.mjs`, `tests/host/test_profile_bridges.py`.

### unreleased-shared-executor

Status: **primitive or unmounted**, retained in complete package/source inventory.

| Present primitive | Exact boundary preventing a completed-product claim |
|---|---|
| Shared local project catalogue and per-project Store | Constructor requires an approved absolute local root. Production `create_router()` supplies none and `/workspace-capabilities` reports unavailable. |
| Explicit membership, editor/read-only roles, creator management and revocation | Application-level checks in `SharedWorkspaces`; no discovery/pooling of all profiles or OS-level isolation. Membership lock/revision fences are backend implementation, not a mounted team-sharing UI. |
| Shared CRUD route seam | Available only under explicit injected composition. Default shared routes refuse. No public cloud/account/link-sharing service. |
| Private-to-shared move | Explicit confirmation, same-filesystem attached SQLite transaction, both revisions/scopes checked, supported hierarchy/history preserved. Cross-boundary references or incompatible journal modes refuse the whole move. It is not general cross-filesystem migration. |
| Remembered executor profile/source/thread | Requires implementation-owned validator. Selection is inert; executor must be an admitted editor where applicable. Native review/prepare refuses unsupported saved ownership. |
| Standalone sharing/executor components | `ProfileWorkspaces` and `PageExecutorPicker` require navigation/draft/move/executor bridges. They are not imported by the mounted entrypoint. |
| Shared interchange/backup composition | No completed shared-project backup/import/export experience including membership catalogue is composed. Private Store backup is not a shared-project authority backup. |

Evidence: `shared_workspaces.py:21-278`; `store.py:1468-1489,1494-1495`; `dashboard/plugin_api.py:177-193` and shared routes; `frontend/profile-workspaces.jsx`, `profile-workspaces.mjs`; import-graph result in `source-coverage.json`. Regression sources: `test_shared_workspaces.py`, `test_api.py:230-294`, lane-D sources. Tests of injected roots/validators do not turn default disabled capabilities on.

### integration-interfaces

Status: **implemented package interfaces**, native private coupling remains a review concern.

- Unified package declares `workspace_apply`, `pre_llm_call` and `post_llm_call`, Desktop renderer and authenticated API. All backend Python modules, including dormant shared primitives, remain in the packager selection.
- API loading roots imports at this installation's namespace rather than ambient working-directory imports. Framework admission supplies authentication and the selected profile.
- Native adapter uses exact host profile descriptors. Server checks open the selected canonical `state.db` through `SessionDB`, read admission/transcript/runtime metadata and rely on the real same-process owner loop for final effects. `SessionDB` construction is not a promised read-only SQLite open.
- No separate plugin model client, cloud converter, hosted user account service or plugin-managed credential store. Explicit Hermes inference can disclose authorised context to the configured provider. The local PDF subprocess is an intentional runtime side effect.
- Package manifests currently say `0.1.0` and `requires_hermes: >=0.23.0`. This task did not alter release metadata. A later release-preparation-only bump to `0.1.1` remains outside these drafts.
- Build uses Node >=26 and esbuild, externalises the plugin SDK/React bridge, writes `desktop/plugin.js` and invokes the configured module smoke test. Packager stages a deterministic archive into a fresh output directory. None of those scripts were run here.

Evidence: `plugin.yaml`; `package.json`; `dashboard/manifest.json`; `__init__.py`; `dashboard/plugin_api.py`; `native.py`; `native_owner.py`; `final_run.py`; `scripts/build.mjs`, `scripts/shared-react.mjs`, `scripts/package.py`, `scripts/verify-package.py`.

## Explicit non-claims

Do not advertise real-time/cloud collaboration, public sharing links, an enabled private/shared switcher, independent page executor execution, universal all-profile installation, unlimited conversation search, automatic attachment/sibling retrieval, cross-row formulas/rollups, lossless Word/PDF conversion, scanned-PDF OCR, universal lazy loading, encryption, or measured token/cost/speed/editorial gains.

Do not claim that this static audit passed the application suite, qualified a live provider, proved active-provider Stop, exercised Electron, validated macOS/Windows or obtained catalogue acceptance. Preserve the complete candidate; narrow the claims, not the included functionality.

## Deliverables and handoff

- `README.draft.md`: self-contained public README, Australian English, no em dashes, complete feature scope with visible limitations.
- `PR-FEATURE-SUMMARY.draft.md`: concise catalogue-PR feature text and evidence boundary. Prepared only; no PR opened.
- `source-coverage.json`: complete mechanical file inventory, hashes, AST/symbol indexing, package selection and frontend reachability.
- `legacy-coverage-map.json`: all older entries retained as a crosswalk, with no inherited runtime status.
- `audit_evidence.py`: reproducible static evidence check, writes only within this report directory.

The frozen source, live installation, GitHub and other build-channel issue/thread settlement were not changed. Remaining release decisions belong to the release owner: reconcile historical docs, attach exact-final-candidate qualification receipts, decide any allowed metadata-only version bump and obtain approval before external submission.
