# Workspace technical feature register

Historical source-coverage appendix. This appendix preserves the archived inventory, including incomplete work and limits. It is not a new audit of today's installed package or a list of 206 distinct completed features.

The archive contains 90 UI, 41 workflow and 75 data records. Every literal ID appears once below. Source-present, marker-only, partial and requested-only remain separate labels; none means live runtime acceptance.

Descriptions, status labels, evidence locations and limitations below are verbatim inventory data. Evidence locations refer to the archived working/installed snapshots and may not match a future public commit. The reader-facing guide and qualification document explain current draft positioning.

- [Feature guide](FEATURES.md)
- [Qualification and current candidate boundary](QUALIFICATION.md)
- [Machine-readable register](FEATURE-REGISTER.json)

## Contents

- [Documents and rich-text editing](#documents-editor)
- [Navigation, folders, search, templates and Trash](#navigation-organisation)
- [Structured tables, record documents, boards and formulas](#structured-databases)
- [Passage comments, discussions and user-controlled resolution](#comments-review)
- [Address comments in a linked native Hermes thread, with qualification limits](#native-agent-workflow)
- [Edit validation, run controls, retained drafts and recovery](#edit-controls-recovery)
- [Local file import, export, attachments and conversion limits](#file-interchange)
- [Local persistence and canonical Workspace backup](#local-storage-backup)
- [Profile ownership, routing and dataset boundaries](#profile-ownership)
- [Unreleased shared projects, independent executors and profile lifecycle gaps](#unreleased-shared-executor)
- [Plugin interfaces, read APIs and evidence boundaries](#integration-interfaces)

<a id="documents-editor"></a>
## Documents and rich-text editing

### UI-003: Create pages

Create a named page in Workspace root or a chosen folder; opens the created page.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:395-400
  - frontend/workspace.jsx:806-868
- Installed evidence:
  - installed/desktop/plugin.js:7206 marker: "New page"
- Limits:
  - Uses backend create_item. Persistence and validation are not exercised.

### UI-016: Editable page titles

Auto-growing title field saves on blur/Enter and before navigation, shows unsaved/save-error state, retry and empty-title guidance.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/page-title.jsx:5-103
  - frontend/workspace.jsx:1223-1226
- Installed evidence:
  - installed/desktop/plugin.js:1087 marker: "aria-label": "Page title",
  - installed/desktop/plugin.js:1122 marker: } }, "Retry title save")
- Limits:
  - Blank titles refuse save/leaving. Applies to document kinds including folders and records. Disabled during locks or retained-title review.

### UI-024: In-place visual content editing

Rendered rich document is directly editable in a multiline contentEditable textbox, with placeholder and explicit read-only state.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:753-773
  - frontend/rich-editor.jsx:900-921
- Installed evidence:
  - installed/desktop/plugin.js:4267 marker: "aria-label": "Page content",
  - installed/desktop/plugin.js:4271 marker: "data-placeholder": "Start writing\u2026",
- Limits:
  - Not a Markdown-source editor or Word print-layout editor. Rendered editing quality has not been observed.

### UI-025: Format text disclosure

A labelled Format text button reveals one compact toolbar grouped by style, emphasis, lists, history and insertion.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:590-752
  - frontend/editor-styles.mjs:4-36
- Installed evidence:
  - installed/desktop/plugin.js:4112 marker: "Format text",
- Limits:
  - Toolbar initially collapsed and disabled during locks or draft recovery. Not counted again as separate duplicate instances of formatting features.

### UI-026: Text and heading styles

Style controls apply Text or Heading 1, 2 or 3 to selected editable blocks.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:634-652
  - frontend/rich-editor.jsx:978-998
  - frontend/editor-commands.mjs:339-368
- Installed evidence:
  - installed/desktop/plugin.js:4142 marker: label: "Block style",
- Limits:
  - Legacy allowlist accepts h4 but no Heading 4 control is offered. Structural transformations are static implementation evidence only.

### UI-027: Bold, italic and underline

Text emphasis commands preserve selection and expose pressed states in both full and selection toolbars.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:397-434
  - frontend/rich-editor.jsx:473-503
  - frontend/rich-editor.jsx:654-665
  - frontend/rich-editor.jsx:999-1022
  - frontend/editor.mjs:53-62
- Installed evidence:
  - installed/desktop/plugin.js:4166 marker: "aria-label": "Text emphasis"
  - installed/desktop/plugin.js:2246 marker: .ws-passage-marker[aria-pressed="true"] {
- Limits:
  - Inline formatting relies partly on browser execCommand/queryCommandState. No advertised strike, colour, font-family, alignment or font-size controls found.

### UI-028: Bulleted and numbered lists

Toolbar toggles unordered or ordered lists through structural commands preserving unselected branches.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:667-675
  - frontend/editor-commands.mjs:370-422
- Installed evidence:
  - installed/desktop/plugin.js:4181 marker: tool("Bullets", "insertUnorderedList", "list-unordered"),
  - installed/desktop/plugin.js:4182 marker: tool("Numbered list", "insertOrderedList", "list-ordered"),
- Limits:
  - Nested list HTML is supported, but no dedicated indent/outdent controls were found.

### UI-029: Checklists

Insert checkbox task content and toggle checks directly; labels and disabled state are hydrated from context.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:676-689
  - frontend/rich-editor.jsx:869-876
  - frontend/editor.mjs:200-213
- Installed evidence:
  - installed/desktop/plugin.js:289 marker: function hydrateChecklists(root, disabled = false) {
- Limits:
  - Inserts a checkbox paragraph with Task text, not a separate task database. Locks and draft recovery disable changes.

### UI-030: Quotation blocks

Block style offers Quote, with semantic blockquote formatting and themed rendering.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:643-651
  - frontend/editor-commands.mjs:355-365
  - frontend/styles.mjs:355-360
- Installed evidence:
  - installed/desktop/plugin.js:4155 marker: ["blockquote", "Quote"],

### UI-031: Code blocks

Block style offers Code block and converts content to pre/code text with preserved line breaks.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:643-651
  - frontend/editor-commands.mjs:319-337
  - frontend/styles.mjs:361-367
- Installed evidence:
  - installed/desktop/plugin.js:4156 marker: ["pre", "Code block"]
- Limits:
  - No language picker, syntax highlighting, execution or terminal integration control found.

### UI-032: External hyperlinks

Insert link dialog accepts URL and display text; clicking safe external links uses the host external-open API.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:710-719
  - frontend/rich-editor.jsx:878-884
  - frontend/rich-editor.jsx:1194-1246
  - frontend/editor.mjs:11-17
  - frontend/workspace.jsx:1385
- Installed evidence:
  - installed/desktop/plugin.js:4580 marker: confirm: dialog === "table" ? "Insert table" : "Insert link",
- Limits:
  - Permitted schemes are http, https and mailto, plus valid internal Workspace links. No link-edit/unlink dialogue was found.

### UI-033: Links to Workspace items

Workspace link picker links pages, databases, records or folders by human context; links navigate to the referenced item.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:740-749
  - frontend/rich-editor.jsx:1153-1193
  - frontend/rich-editor.jsx:1231-1246
  - frontend/editor.mjs:237-243
- Installed evidence:
  - installed/desktop/plugin.js:4255 marker: "Workspace link"
- Limits:
  - Only active items in this Workspace. Links are not embedded live table or board views.

### UI-034: Simple document tables

Insert table dialog creates editable cell content using bounded row and column dimensions.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:720-729
  - frontend/rich-editor.jsx:1166-1175
  - frontend/rich-editor.jsx:1204-1229
- Installed evidence:
  - installed/desktop/plugin.js:4580 marker: confirm: dialog === "table" ? "Insert table" : "Insert link",
  - installed/desktop/plugin.js:4614 marker: throw new Error("Use 1\u201330 rows and 1\u201312 columns.");
- Limits:
  - Creation bounds are 1 to 30 rows and 1 to 12 columns. No dedicated add/remove/resize/merge table-row or column controls found in the document editor; database table tools are separate.

### UI-035: Image attachments in content

Insert PNG, JPEG, GIF or WebP image at a saved editor location and retain its attachment; progress and changed-insertion-point errors are visible.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:730-739
  - frontend/rich-editor.jsx:1081-1152
  - frontend/workspace.jsx:1375-1383
  - frontend/editor.mjs:214-234
- Installed evidence:
  - installed/desktop/plugin.js:4529 marker: "Adding image\u2026 Leaving this page waits for the image and its saved content."
  - installed/desktop/plugin.js:4545 marker: throw new Error("Choose a PNG, JPEG, GIF or WebP image.");
- Limits:
  - Uses the shared 20 MB file limit. Pasted images are removed and file drag/drop is prevented. No image resize/crop or independent alt-text editor found.

### UI-036: Rich paste, copy and cut

Paste sanitises rich HTML or escaped plain text; copy/cut removes temporary comment layout gaps while retaining portable rich content.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:435-472
  - frontend/rich-editor.jsx:774-775
  - frontend/rich-editor.jsx:886-899
  - frontend/editor.mjs:36-87
  - frontend/editor.mjs:183-198
- Installed evidence:
  - installed/desktop/plugin.js:3977 marker: const copyWithoutLayout = (event, cut = false) => {
  - installed/desktop/plugin.js:3279 marker: function pasteBlockHTML(root, html) {
- Limits:
  - Scripts/styles/unsafe URLs and arbitrary formatting attributes are not retained. Pasted images are removed; external image URLs are not allowed. No exact-layout interchange claim.

### UI-037: Undo and redo

Toolbar and scoped keyboard/input history commands restore sanitised content and selection.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:397-414
  - frontend/rich-editor.jsx:692-700
  - frontend/rich-editor.jsx:845-857
  - frontend/editor-commands.mjs:513-570
- Installed evidence:
  - installed/desktop/plugin.js:4204 marker: "aria-label": "Edit history"
- Limits:
  - History bound is 100 entries or approximately 16 MiB of UTF-16 HTML, except the final retained entry. This is editor-local history, distinct from persistent pre-run versions.

### UI-038: Automatic selected-text toolbar

One compact native popover follows text selection with Text style, Bold, Italic, Underline, Link and Comment; Tab enters controls and Escape restores editor selection.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:219-312
  - frontend/rich-editor.jsx:808-825
  - frontend/rich-editor.jsx:923-1047
  - frontend/editor-styles.mjs:36
- Installed evidence:
  - installed/desktop/plugin.js:4413 marker: "aria-label": "Selected text actions",
- Limits:
  - Hidden during pending comment anchor, lock, draft recovery or insert dialogue. Native zoom/collision/keyboard acceptance is not observed. Formatting features are inventoried once despite two entrypoints.

### UI-039: Scoped keyboard editing

Editor bubbling handlers provide conditional Ctrl+Alt+B, Ctrl/Meta+I/U, Alt+Ctrl/Meta+M and Undo/Redo, respecting claimed host events and IME.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:776-857
  - frontend/ui.jsx:34-44
  - REQUIREMENTS.md:232-234
- Installed evidence:
  - installed/desktop/plugin.js:4283-4323 scoped editor key handlers, including conditional Ctrl+Alt+B at 4224-4227, Alt+Ctrl/Meta+M at 4244-4246, italic/underline and undo/redo; textual implementation markers only
- Limits:
  - Ctrl+B and Ctrl+Shift+B are not remapped here. Actual host/custom-binding/platform routing is unverified; Ctrl+Alt+B is not advertised by this editor.

### UI-075: Page details and utility dialogues

Page actions opens native Page details or Export and recovery dialogues, with focus return, Close, busy/error handling and no matching document-footer entrypoint.

- Category: Page actions
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1227-1238
  - frontend/workspace.jsx:1438-1483
  - frontend/ui.jsx:344-358
- Installed evidence:
  - installed/desktop/plugin.js:8045 marker: }, "Page details"),
  - installed/desktop/plugin.js:8048 marker: }, "Export and recovery"),
- Limits:
  - Page details currently contains only Workspace item ID. Utilities unavailable for folders. Full control/focus parity is source-visible, not runtime accepted.

### UI-083: Persistent page-local normal or wide document width

Page/record Page actions exposes Wide document mode: On/Off, changing editor max-width from 72ch to 100% and storing source/profile/dataset/item-scoped local preference.

- Category: Page actions
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - frontend/document-width.mjs:6-28
  - frontend/workspace.jsx:887
  - frontend/workspace.jsx:1090
  - frontend/workspace.jsx:1239-1241
  - frontend/styles.mjs:294-305
- Installed evidence:
  - installed/desktop/plugin.js:1298-1325
  - installed/desktop/plugin.js:2127
  - installed/desktop/plugin.js:7895
  - installed/desktop/plugin.js:8049-8054
- Limits:
  - Previous installed-absent statement is obsolete for current frozen package. Concrete generated preference/toggle implementation is present; no runtime persistence/layout/no-leakage acceptance inferred.
  - Normal default; only stored boolean true enables wide. Missing/failed storage defaults normal on read, while failed write changes current view and reports unsaved preference.
  - Page/record only; display remains bounded by navigation/document/comment layout, not fullscreen. Active run alone does not disable display change, sectionBusy disables Page actions.
  - Preference is not document content, export/version payload, native grant or canonical backup. No storage subscription synchronizes duplicate mounted views.

### DATA-011: Rich page persistence

Creates pages with stable IDs, titles, semantic HTML, parent linkage, modification timestamp and optional native-thread reference; updates title and content through Store commands.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:677-734
  - working/workspace_plugin/store.py:96-177
- Installed evidence:
  - installed/workspace_plugin/store.py:677-734
  - installed/workspace_plugin/store.py:96-177
- Limits:
  - This inventories persisted semantic content, not editor toolbar or native editing acceptance. Content limit is 2000000 characters before and after sanitisation.

### DATA-016: Stable internal links across interchange

Native #workspace/<id> fragment references survive sanitised content, Markdown and full backup with stable identifiers.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:130-135
  - working/workspace_plugin/interchange.py:31-35
  - working/tests/test_interchange.py:411-436
- Installed evidence:
  - installed/workspace_plugin/interchange.py:130-135
  - installed/workspace_plugin/interchange.py:31-35
- Limits:
  - Links are inert references, not ownership grants; missing targets remain unavailable rather than failing graph validation.

### DATA-075: Page-local document-width preference

Local Boolean document-width preference is keyed by connection, profile, dataset scope and item, separate from prose, versions and native grants; the current installed generated bundle now includes its implementation.

- Category: Local preferences
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - frontend/document-width.mjs:3-29
  - frontend/workspace.jsx:887
- Installed evidence:
  - installed/desktop/plugin.js:1298-1325
- Limits:
  - Previous installed-absent limitation is superseded by current frozen package. Source presence is not observed persistence.
  - This SDK preference is not canonical SQLite content, template data or complete Store backup. Missing/failed read defaults false; only explicit true enables wide.

<a id="navigation-organisation"></a>
## Navigation, folders, search, templates and Trash

### UI-001: Workspace route and sidebar entry

Plugin registers the Workspace quick link and /workspace route, default-enabled.

- Category: Navigation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/index.jsx:4-20
- Installed evidence:
  - installed/desktop/plugin.js:8389 marker: data: { path: "/workspace" },
- Limits:
  - Only /workspace is registered. Selected page, Home and Trash are local view state, not separate registered URL routes. Plugin disable/removal behaviour is host-owned and not observed.

### UI-002: Home page catalogue

Home lists active pages and databases with context and creation entrypoints.

- Category: Navigation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:659-725
- Installed evidence:
  - installed/desktop/plugin.js:7510 marker: h("h2", null, "Your pages"),
- Limits:
  - Records are opened through their database, search or links rather than this catalogue. No native runtime observation.

### UI-004: Create nested folders

Create folders and subfolders, choosing their parent; folder view exposes New subfolder.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:409-413
  - frontend/workspace.jsx:806-868
  - frontend/workspace.jsx:1282-1322
- Installed evidence:
  - installed/desktop/plugin.js:7227 marker: "New folder"
  - installed/desktop/plugin.js:8103 marker: "New subfolder"

### UI-006: Folder tree and selected item

Recursive expandable folder tree opens pages, folders and databases and marks the selected item.

- Category: Navigation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:69-131
  - frontend/workspace.jsx:373-383
  - frontend/workspace.jsx:543-546
- Installed evidence:
  - installed/desktop/plugin.js:7360 marker: h("h2", null, "Folders and pages"),
- Limits:
  - Folders initially render open. Records are deliberately excluded from this tree. No drag-and-drop organisation control found.

### UI-007: Folder contents view

Folder destination lists its non-deleted immediate children and contextual creation actions.

- Category: Navigation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1282-1322
- Installed evidence:
  - installed/desktop/plugin.js:8091 marker: h("h2", null, "In this folder"),

### UI-008: Recently opened items

Recents opens backend-provided Workspace item references; opening a nonfolder records open_item.

- Category: Navigation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:288-304
  - frontend/workspace.jsx:547-568
- Installed evidence:
  - installed/desktop/plugin.js:7362 marker: h("h2", null, "Recents"),
- Limits:
  - Frontend does not discover external files. Recency ordering and retention are backend supplied.

### UI-009: Move to folder

Page actions moves a nonrecord item to root or a chosen active folder.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1252-1259
  - frontend/workspace.jsx:1501-1518
  - frontend/workspace.jsx:1546-1550
- Installed evidence:
  - installed/desktop/plugin.js:8069 marker: "Move to folder"
- Limits:
  - Disabled for locked items. Selector excludes the item itself but frontend does not remove all descendants; backend must reject invalid folder cycles.

### UI-010: Resize navigation

Pointer separator and keyboard controls resize navigation with a stored source/profile preference.

- Category: Navigation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/navigation-resize.jsx:5-91
  - frontend/workspace.jsx:535-586
- Installed evidence:
  - installed/desktop/plugin.js:1273 marker: "aria-label": "Resize Workspace navigation",
- Limits:
  - Default 280 px; nominal bounds 200 to 560 px, further bounded to leave document room. Arrows adjust 10 px, Shift 40 px, Home/End bounds. Key navigation-width:v1:[connection,profile]; below 600 px the separator is hidden. Save failure leaves view-only width.

### UI-011: Narrow-pane navigation and destination focus

Narrow-pane navigation and compact header keep Home/New page in Workspace menu at measured widths <=480px, with focus fallback to that menu when header actions disappear.

- Category: Navigation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:141-149
  - frontend/workspace.jsx:389-417
  - frontend/navigation-resize.jsx:18-47
  - frontend/styles.mjs:952-956
- Installed evidence:
  - installed/desktop/plugin.js:2774-2775
  - installed/desktop/plugin.js:7199
- Limits:
  - Compact header wiring is present in installed bundle; newest width/height measurement uses a different available object in current source. No keyboard/resize/zoom runtime acceptance established.

### UI-012: Contextual item and attachment labels

Duplicate titles gain folder/type/import context and ordinals; choices and search expose human labels, while IDs stay in payloads. Attachments show type, size and duplicate-name ordinal.

- Category: Navigation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/item-labels.mjs:2-81
  - frontend/workspace.jsx:69-73
  - frontend/workspace.jsx:1421-1434
- Installed evidence:
  - installed/desktop/plugin.js:44 marker: function navigationContexts(items = [], attachments = []) {
  - installed/desktop/plugin.js:77 marker: function attachmentLabels(attachments) {
- Limits:
  - Context derives only from supplied Workspace metadata. No user content was read for this inventory.

### UI-013: Workspace search and result navigation

Debounced search offers excerpts, keyboard entry to results, clear/Escape, pending/empty/error states, retry and explicit result navigation.

- Category: Search
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace-search.jsx:7-98
  - frontend/client.mjs:79-134
  - REQUIREMENTS.md:85-86
- Installed evidence:
  - installed/desktop/plugin.js:1729 marker: "aria-label": "Search Workspace",
  - installed/desktop/plugin.js:1766 marker: } }, "Retry search")
- Limits:
  - 200 ms debounce, at most 500 query characters. Title/document/database-text coverage is required but the matching backend was not inspected here. No semantic/vector search claim. Typing does not navigate or flush the editor.

### UI-014: Paged search results

Previous/Next results use a revision-bound backend search_page request with total and offsets.

- Category: Search
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace-search.jsx:44-65
  - frontend/workspace-search.jsx:95-97
  - frontend/client.mjs:113-129
- Installed evidence:
  - installed/desktop/plugin.js:1795 marker: current.offset > 0 && h(Action, { onClick: () => turnPage(Math.max(0, current.offset - current.limit), current.revision) }, "Previous results"),
  - installed/desktop/plugin.js:1796 marker: current.hasMore && h(Action, { onClick: () => turnPage(current.nextOffset, current.revision) }, "Next results")
- Limits:
  - 100 requested results per page. Changes invalidate the revision-bound result rather than silently mixing snapshots. Transport cancellation is not exposed; retired requests are ignored.

### UI-019: Move items to Trash

Page actions and table-row actions confirm soft deletion; folder warning says all contained content moves too.

- Category: Trash
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1261-1276
  - frontend/tables.jsx:301-339
- Installed evidence:
  - installed/desktop/plugin.js:5400 marker: label: "Move to Trash",
- Limits:
  - Locked items cannot be moved. Actual cascading deletion is backend responsibility.

### UI-020: Trash view and restore

Trash lists deleted items and restores them; copy explicitly says there is no automatic expiry.

- Category: Trash
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:569-581
  - frontend/workspace.jsx:752-783
- Installed evidence:
  - installed/desktop/plugin.js:7396 marker: `Trash (${state.items.filter((i) => i.deleted_at).length})`
  - installed/desktop/plugin.js:7560 marker: "Items stay here until you restore or permanently delete them. There is no automatic expiry."
- Limits:
  - Includes records as well as pages/folders/databases. Retention behaviour is stated in UI, not executed.

### UI-021: Permanent deletion

Trash requires explicit destructive confirmation before purge and warns about comments and attachments, including folder contents.

- Category: Trash
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:784-798
- Installed evidence:
  - installed/desktop/plugin.js:7586 marker: title: `Permanently delete ${item.title}?`,
- Limits:
  - Irreversible operation. No bulk-empty control found.

### UI-022: Save page or record as template

Page actions saves a named reusable template from page/record content and properties.

- Category: Templates
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1242-1250
  - frontend/workspace.jsx:1489-1500
  - frontend/workspace.jsx:1540-1545
- Installed evidence:
  - installed/desktop/plugin.js:8061 marker: "Save as template"
- Limits:
  - Not exposed for folders or databases. Disabled while locked; backend defines copy semantics.

### UI-023: Create from template

Home lists templates and opens a titled creation dialog with folder or compatible database selection.

- Category: Templates
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:726-742
  - frontend/workspace.jsx:815-866
- Installed evidence:
  - installed/desktop/plugin.js:7527 marker: h("h2", null, "Templates"),
  - installed/desktop/plugin.js:7628 marker: label: "Database for record template",
- Limits:
  - Record template requires a selected compatible database. No frontend template edit/delete management control found.

### DATA-010: Folder hierarchies

Folders contain nested folders, pages and tables. Parent validation rejects nonfolder containers, cycles and excessive hierarchy depth.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:481-508
  - working/workspace_plugin/store.py:677-699
  - working/workspace_plugin/store.py:1611-1625
  - working/tests/test_store.py:57-67
- Installed evidence:
  - installed/workspace_plugin/store.py:481-508
  - installed/workspace_plugin/store.py:677-699
  - installed/workspace_plugin/store.py:1611-1625
- Limits:
  - Nested pages are not an alternative hierarchy; folders cannot hold document content.

### DATA-014: Rename and reorganise stored items

Patches titles and folder parents under graph validation and lock checks, including validation of a destination folder.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:702-734
  - working/tests/test_store.py:57-67
- Installed evidence:
  - installed/workspace_plugin/store.py:702-734
- Limits:
  - Records retain table ownership. Moving a folder into itself or its descendants is rejected.

### DATA-015: Document-only recents

open_item deduplicates and prepends a document in recents, caps the list and removes trashed items.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:924-944
  - working/workspace_plugin/store.py:1811-1816
  - working/tests/test_store.py:89-103
- Installed evidence:
  - installed/workspace_plugin/store.py:924-944
  - installed/workspace_plugin/store.py:1811-1816
- Limits:
  - Up to 100 active pages, tables or records; no folder entries or automatic filesystem recents. Opening is a revision-changing write.

### DATA-026: Page and record template snapshots

Captures reusable page or record content and editable properties. Record templates include the source schema and require exact compatible columns at application.

- Category: Templates
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:1006-1032
  - working/workspace_plugin/store.py:1817-1836
  - working/tests/test_store.py:163-176
- Installed evidence:
  - installed/workspace_plugin/store.py:1006-1032
  - installed/workspace_plugin/store.py:1817-1836
- Limits:
  - Copies data, not comments, native runs or thread identity. No database/folder templates, template editing or deletion command is exposed.

### DATA-027: Independent template attachments

Templates copy attachment bytes and remap fresh attachment IDs on application, so they remain usable after the source page is purged.

- Category: Templates
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:1013-1032
  - working/workspace_plugin/store.py:1843-1858
  - working/tests/test_store.py:392-404
- Installed evidence:
  - installed/workspace_plugin/store.py:1013-1032
  - installed/workspace_plugin/store.py:1843-1858
- Limits:
  - Stored template and copied assets share the whole Store size/count limits.

### DATA-030: Local literal text search

Casefolded substring matching covers page/table/record titles, plain document text and string-valued record/formula properties; excludes folders and Trash.

- Category: Search
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:443-463
  - working/workspace_plugin/store.py:910-917
  - working/tests/test_store.py:89-103
- Installed evidence:
  - installed/workspace_plugin/store.py:443-463
  - installed/workspace_plugin/store.py:910-917
- Limits:
  - No semantic/vector search, attachment-body indexing or comments search. Legacy search returns only the first 200 matching full item projections.

### DATA-031: Paged summaries and stable search revisions

search_page returns lightweight IDs/kinds/titles/excerpts with total, offset, next_offset and has_more; further pages require the same saved revision.

- Category: Search
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:443-463
  - working/dashboard/plugin_api.py:298-311
  - working/tests/test_store.py:796-818
- Installed evidence:
  - installed/workspace_plugin/store.py:443-463
  - installed/dashboard/plugin_api.py:298-311
- Limits:
  - Page size 1 to 200. No index; graph and formula computation occur on each read. Shared command route does not expose search_page.

### DATA-032: Cascade Trash without expiry

Trashing a folder or table includes its descendants/records and removes their recents; pre-existing independently trashed children keep their own group.

- Category: Trash
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:935-945
  - working/tests/test_store.py:127-144
- Installed evidence:
  - installed/workspace_plugin/store.py:935-945
- Limits:
  - No automatic expiry path is present in the inspected Store; Trash is not a full copy and continues consuming the store budget.

### DATA-033: Hierarchy-aware restoration

Restores the selected Trash group while preserving previously independent deletions; requires a live parent folder/table before child restore.

- Category: Trash
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:946-958
  - working/workspace_plugin/store.py:1507-1518
  - working/tests/test_store.py:127-139
- Installed evidence:
  - installed/workspace_plugin/store.py:946-958
  - installed/workspace_plugin/store.py:1507-1518
- Limits:
  - Backup replacement reconstructs Trash grouping from hierarchy/timestamps. Restore is not an implicit permanent-delete undo.

### DATA-034: Explicit permanent purge with reference repair

Purges only trashed item hierarchies and owned data; prunes related run/comment/history/template references and checks all affected locks.

- Category: Trash
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:946-958
  - working/workspace_plugin/store.py:1131-1222
  - working/tests/test_store.py:380-390
- Installed evidence:
  - installed/workspace_plugin/store.py:946-958
  - installed/workspace_plugin/store.py:1131-1222
- Limits:
  - References to purged data are deliberately rewritten or removed. No automatic expiry, purge of active items or automatic purge recovery.

### DATA-074: Navigation preference stored outside documents

Navigation width uses public plugin storage under a connection/profile key, independent from document content and SQLite backups.

- Category: Local preferences
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/frontend/navigation-resize.jsx:5-17
  - working/frontend/navigation-resize.jsx:43-46
- Installed evidence:
  - installed/desktop/plugin.js:1180-1192
  - installed/desktop/plugin.js:1218-1225
- Limits:
  - This records storage semantics only; UI resizing is inventoried elsewhere. Preference is not dataset/page-specific and is not included in Store backup.

<a id="structured-databases"></a>
## Structured tables, record documents, boards and formulas

### UI-005: Create databases

Create a named Workspace table item in a chosen folder.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:414-418
  - frontend/workspace.jsx:806-868
- Installed evidence:
  - installed/desktop/plugin.js:7232 marker: "New database"
- Limits:
  - This is a managed structured table, not an external database connection.

### UI-042: Record documents and properties

A record opens its own rich document with database backlink and all properties above its content.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1327-1347
  - frontend/tables.jsx:110-149
- Installed evidence:
  - installed/desktop/plugin.js:4998 marker: function RecordProperties({
- Limits:
  - Records reuse page editor/comments/actions rather than a separate cell-comment surface. Formula properties are read-only.

### UI-043: Create and remove records

New record is an in-grid draft row beneath table records, including empty/filter-empty states; Enter/Create commits, Escape/Cancel discards, errors retain the mounted draft. Row-document opening and Trash use row controls.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/tables.jsx:216-275
  - frontend/tables.jsx:288-290
  - frontend/tables.jsx:320-338
- Installed evidence:
  - installed/desktop/plugin.js:5179-5288
  - installed/desktop/plugin.js:5395-5420
- Limits:
  - Installed bundle contains basic inline table creation, replacing the prior detached dialog. No bulk operation or inline rename of existing record titles.
  - Duplicate in-flight submissions/IME are locally gated; unknown server outcomes and persistent creation-draft recovery are not qualified. New title/error state is not a durable property buffer.
  - Per-board-group inline creation exists in latest source/working bundle, not current installed bundle. No runtime execution performed.

### UI-044: Add and remove columns

Add property is an accessible trailing table-header plus that opens a compact native contextual name/type editor; Board has a contextual property affordance. Seven types and existing validation are retained; removal remains a destructive column action.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/tables.jsx:151-213
  - frontend/tables.jsx:307-308
  - frontend/tables.jsx:324-329
  - frontend/ui.jsx:156-183
- Installed evidence:
  - installed/desktop/plugin.js:5070-5175
  - installed/desktop/plugin.js:5331-5336
  - installed/desktop/plugin.js:5395
- Limits:
  - No existing-column rename/reorder/settings-edit control. Supports text, number, checkbox, date, select, relation and formula.
  - Schema creation/removal disables if database or any record has active run authority. Source has split scrollable fields/fixed form actions for short panes, absent from installed bundle.
  - Mounted form values survive validation errors, but no persistent creation-draft buffer is wired; visual containment/focus/keyboard behavior unverified.

### UI-045: Typed editable property values

Table cells and record properties support text, numeric, date, checkbox and single-select values with Unassigned choice.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/tables.jsx:12-90
  - frontend/tables.jsx:301-339
- Installed evidence:
  - installed/desktop/plugin.js:4767 marker: [...column?.options ?? [], "Unassigned"].map((name) => [name, []])
  - installed/desktop/plugin.js:4936 marker: type: column.type === "number" ? "number" : column.type === "date" ? "date" : "text",
- Limits:
  - Text/number/date save on blur or Enter; checkbox/select save immediately. Empty number/date normalises to null. Locks on database or record disable editing.

### UI-047: Table filter and sorting

Database uses an immediately visible record filter, compact Table/Board choice and contextual Sort popover with field/direction; record count reports filtered versus total records.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/tables.jsx:240-255
  - frontend/tables.jsx:293-305
- Installed evidence:
  - installed/desktop/plugin.js:5300-5326
- Limits:
  - One substring filter and one sort field; numeric comparison for number properties, string locale-numeric comparison otherwise. Component-local settings, not saved views.
  - No paging/virtualization in this Database component. New records hidden by current filter receive an explicit created-but-hidden status.
  - Current source locks view/group switching while a creation draft is open; installed bundle does not include those draft-view guards.

### UI-048: Select-grouped board view

Existing single-select Board retains editable status cards. Latest source adds New record within each lane, setting the lane property at creation and keeping null/unassigned separate from a literal Unassigned option.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/database.mjs:29-39
  - frontend/tables.jsx:263-286
  - frontend/tables.jsx:306-319
- Installed evidence:
  - installed/desktop/plugin.js:4765-4774
  - installed/desktop/plugin.js:5328-5362
- Limits:
  - Installed board offers one generic creation control after all groups; no per-group creation. Working generated bundle has per-group creation but still old string sentinel logic; latest JSX/helper null/collision fixes are not in either generated bundle.
  - Requires a single-select column; otherwise guidance plus generic creation are provided. Moves use select, not drag-and-drop; grouping/view are local state.

### UI-049: Relations between Workspace tables

Relation properties use a compact contextual checkbox picker in table cells; open record properties retain the full checkbox list of records in the selected related database.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/tables.jsx:81-109
  - frontend/tables.jsx:334-336
- Installed evidence:
  - installed/desktop/plugin.js:4914-4930
- Limits:
  - Multi-record IDs only; no rollups, reciprocal relationship UI or record-link activation inside the checkbox list.
  - Contextual picker/source containment exists, but long-list/zoom/keyboard behavior is not runtime-qualified.

### UI-050: Same-row formulas and syntax help

Formula expression column renders computed output or per-record Calculation failed details; syntax and column-ID disclosure explain supported functions.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/tables.jsx:67-69
  - frontend/tables.jsx:301-339
  - frontend/tables.jsx:301-339
  - frontend/tables.jsx:342-349
  - frontend/database.mjs:48-69
- Installed evidence:
  - installed/desktop/plugin.js:5432 marker: { className: "ws-formula-help", "aria-label": "Formula syntax" },
  - installed/desktop/plugin.js:4899 marker: h("output", { "aria-label": column.name, "aria-invalid": Boolean(formulaError), "aria-describedby": formulaError ? errorId : void 0 }, formulaError ? "Calculation failed" : String(value ?? "
- Limits:
  - Help names arithmetic, comparisons, and/or/not, conditional expressions, IF, abs, round, min, max, len, lower, upper, concat and coalesce. Engine correctness was not inspected or executed. No rollups/automation UI.

### UI-051: Scrollable table and board containment

Redesigned database uses an internally scrollable minimum-480px table, compact contextual forms and contained Board. Latest source bounds grid height to pane height, sticks column headers and keeps first-column identity sticky only at grid widths >=500px; narrower layouts expose active-record context.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/database-grid-styles.mjs:9-45
  - frontend/database-grid-styles.mjs:58-70
  - frontend/tables.jsx:301-305
  - frontend/workspace.jsx:535
- Installed evidence:
  - installed/desktop/plugin.js:4684-4687
  - installed/desktop/plugin.js:4731-4741
  - installed/desktop/plugin.js:5324-5326
- Limits:
  - Installed bundle has internal horizontal scrolling/minimum 480px and narrow active-record context, but lacks latest bounded vertical grid, sticky column headers and split-scroll property form.
  - Latest source clears stale row context when creation is focused; neither generated bundle includes creationFocused implementation.
  - Source intends no whole-page overflow; not verified rendered layout, collision, touch or zoom acceptance.

### DATA-012: Standalone table items

Tables are database-kind Workspace items with content and schema and may live in folders; they are built-in data, not database-server connections.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:52-53
  - working/workspace_plugin/store.py:677-699
  - working/workspace_plugin/store.py:855-873
- Installed evidence:
  - installed/workspace_plugin/store.py:52-53
  - installed/workspace_plugin/store.py:677-699
  - installed/workspace_plugin/store.py:855-873
- Limits:
  - No external/local database engine querying or administration.

### DATA-013: Record documents and immutable table ownership

Records belong to exactly one table, have independent title/content/thread identity and typed properties, and expose parent table schema on detail reads.

- Category: Organisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:571-618
  - working/workspace_plugin/store.py:686-692
  - working/workspace_plugin/store.py:711-728
  - working/workspace_plugin/store.py:431-440
- Installed evidence:
  - installed/workspace_plugin/store.py:571-618
  - installed/workspace_plugin/store.py:686-692
  - installed/workspace_plugin/store.py:711-728
  - installed/workspace_plugin/store.py:431-440
- Limits:
  - A record cannot be moved between tables by patching its parent or database identity.

### DATA-017: Five basic typed properties

Validates text, finite bounded numbers, booleans, real ISO calendar dates and configured single-select values. Missing/null values are supported.

- Category: Tables
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:53-60
  - working/workspace_plugin/store.py:571-618
  - working/tests/test_store.py:69-77
- Installed evidence:
  - installed/workspace_plugin/store.py:53-60
  - installed/workspace_plugin/store.py:571-618
- Limits:
  - Unknown properties and wrong types refuse. Text limit 20000 characters, numbers bounded by absolute 1e15, select options limited to 100.

### DATA-018: Column schema and atomic row revalidation

Adds/removes/reorders columns through whole-schema replacement, enforces unique IDs/names and unambiguous references, prunes removed values and revalidates surviving row data atomically.

- Category: Tables
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:510-569
  - working/workspace_plugin/store.py:855-873
  - working/tests/test_store.py:79-87
- Installed evidence:
  - installed/workspace_plugin/store.py:510-569
  - installed/workspace_plugin/store.py:855-873
- Limits:
  - No automatic coercion for incompatible type changes. Up to 100 stored columns even where CSV parser admits more.

### DATA-019: Cross-table record relations

Relation properties contain bounded unique IDs of records in a declared Workspace table; invalid ownership or references refuse.

- Category: Tables
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:535-540
  - working/workspace_plugin/store.py:607-617
  - working/tests/test_store.py:146-161
- Installed evidence:
  - installed/workspace_plugin/store.py:535-540
  - installed/workspace_plugin/store.py:607-617
- Limits:
  - Up to 1000 related record IDs per value. Relations are local to one Store graph, not cross-private/shared-space links. No rollups or automatic reciprocal relation columns.

### DATA-020: Relation Trash and purge integrity

Trashing preserves existing relation references but prevents newly linking trashed targets. Purge removes dead record references, target-table relation columns and dependent formulas under affected-item locks.

- Category: Tables
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:721-727
  - working/workspace_plugin/store.py:859-862
  - working/workspace_plugin/store.py:1131-1222
  - working/tests/test_store.py:431-445
- Installed evidence:
  - installed/workspace_plugin/store.py:721-727
  - installed/workspace_plugin/store.py:859-862
  - installed/workspace_plugin/store.py:1131-1222
- Limits:
  - Purge also adjusts historical schemas and templates, so it is not limited to deleting the visible target row.

### DATA-021: Bounded same-row formula language

Supports literals, column IDs/names, col(), arithmetic + - * / %, comparisons, Boolean operations and lazy conditional expressions/IF.

- Category: Formulas
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/formulas.py:1-7
  - working/workspace_plugin/formulas.py:18-27
  - working/workspace_plugin/formulas.py:63-102
  - working/tests/test_formulas.py:6-28
- Installed evidence:
  - installed/workspace_plugin/formulas.py:1-7
  - installed/workspace_plugin/formulas.py:18-27
  - installed/workspace_plugin/formulas.py:63-102
- Limits:
  - No eval, arbitrary code, object access, indexing, exponentiation, cross-row reads or rollups. Source 1024 characters, 128 AST nodes and depth 20.

### DATA-022: Scalar formula functions

Provides abs, round, min, max, len, lower, upper, concat and coalesce with bounded scalar inputs and output.

- Category: Formulas
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/formulas.py:23-27
  - working/workspace_plugin/formulas.py:88-100
  - working/workspace_plugin/formulas.py:159-187
  - working/tests/test_formulas.py:30-46
- Installed evidence:
  - installed/workspace_plugin/formulas.py:23-27
  - installed/workspace_plugin/formulas.py:88-100
  - installed/workspace_plugin/formulas.py:159-187
- Limits:
  - Text results capped at 10000 characters, numeric magnitude at 1e15 and round precision from -15 to 15. Coalesce evaluates its arguments; only IF/conditional branches are lazy.

### DATA-023: Dependency chains and authoritative results

Validates references and rejects formula cycles/deep dependencies; computes values server-side and exposes null plus formula_errors on computation failure.

- Category: Formulas
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:543-568
  - working/workspace_plugin/store.py:586-589
  - working/workspace_plugin/store.py:620-661
  - working/tests/test_store.py:447-455
- Installed evidence:
  - installed/workspace_plugin/store.py:543-568
  - installed/workspace_plugin/store.py:586-589
  - installed/workspace_plugin/store.py:620-661
- Limits:
  - Computed values cannot be client-written. Formula results and errors are projections, not persisted writable properties; relation arrays are not scalar formula operands.

### DATA-024: Sorting and filtering

Derives visible table rows by case-insensitive substring filtering across title/property strings and ascending/descending sort by title or a property.

- Category: Tables
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/frontend/database.mjs:1-28
  - working/frontend/tables.jsx:151-299
- Installed evidence:
  - installed/desktop/plugin.js:4746-4764
  - installed/desktop/plugin.js:5178
- Limits:
  - Client-side view state, not a saved query/schema feature. Numeric comparator is specialised to number columns; other values use string comparison.

### DATA-025: Select-grouped boards

Select-grouped boards derive lanes from the same saved record properties. Latest source uses null for no value, separate from literal Unassigned, and per-lane creation writes the selected property.

- Category: Tables
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - frontend/database.mjs:29-39
  - frontend/tables.jsx:263-286
  - frontend/tables.jsx:306-319
- Installed evidence:
  - installed/desktop/plugin.js:4765-4774
  - installed/desktop/plugin.js:5328-5362
- Limits:
  - View/group configuration remains client-local; no independent board schema, automations or embedded live views.
  - Installed bundle still groups empty values and a real Unassigned option together and creates records generically, not per lane. Working generated bundle also predates latest null-sentinel source fix.
  - No data/model execution performed; UI lane-creation support must not be promoted to installed/native acceptance.

<a id="comments-review"></a>
## Passage comments, discussions and user-controlled resolution

### UI-052: Anchored selection comments

Select distinct document text then Comment to compose beside its passage; saved anchor carries quote and context. Add comment does not submit an agent run.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:367-396
  - frontend/rich-editor.jsx:1032-1045
  - frontend/editor.mjs:88-130
  - frontend/comments.jsx:333-351
- Installed evidence:
  - installed/desktop/plugin.js:4492 marker: "aria-label": "Add comment on selection",
  - installed/desktop/plugin.js:6345 marker: h("label", { htmlFor: composerId }, anchor ? "Comment on selection" : item.kind === "database" ? "Whole-database comment" : "Whole-page comment"),
- Limits:
  - Anchor needs unique quote plus prefix/suffix context of up to 48 characters. Ambiguous selections cannot be attached. Available on page and record documents, not database cells.

### UI-053: Whole-page and whole-database feedback

Named Add whole-page/database comment and options compose unanchored feedback, shown in Page/Database feedback location.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:275-294
  - frontend/comments.jsx:353-412
  - frontend/comments.jsx:491-535
- Installed evidence:
  - installed/desktop/plugin.js:6345 marker: h("label", { htmlFor: composerId }, anchor ? "Comment on selection" : item.kind === "database" ? "Whole-database comment" : "Whole-page comment"),
- Limits:
  - Use whole page can convert an in-progress selection comment to unanchored feedback. No individual database-cell comments.

### UI-054: Comment composer controls and submission shortcut

Composer provides visible Add comment and Cancel comment, context quote, optional Use whole page and scoped Ctrl+Enter with native tooltip and IME/duplicate guards.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:333-412
  - frontend/comment-styles.mjs:4-9
- Installed evidence:
  - installed/desktop/plugin.js:6389 marker: { label: "Add comment (Ctrl+Enter)" },
  - installed/desktop/plugin.js:6346 marker: h(Action, { variant: "text", style: { color: "var(--ui-text-secondary)" }, disabled: busy, onClick: cancel }, "Cancel comment")
- Limits:
  - Shortcut acts only in new-comment textarea and respects an already-prevented host event. Actual host shortcut routing is not tested. Cancel clears new-comment draft/anchor/targets, not existing discussion replies.

### UI-055: Persistent passage bubbles and compact thread expansion

Compact bordered comments align with highlighted passages in document scrolling; selecting a bubble expands the complete discussion and reply/resolution/revert controls.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:419-438
  - frontend/comment-bubbles.jsx:6-35
  - frontend/comment-bubbles.jsx:61-151
  - frontend/comment-bubbles.jsx:191-199
  - frontend/styles.mjs:957-993
- Installed evidence:
  - installed/desktop/plugin.js:2810 marker: .ws-root .ws-bubble-summary { display: flex; flex-direction: column; align-items: stretch; gap: 6px; white-space: normal; width: 100%; height: auto; padding: 12px; text-align: left; font-wei
  - installed/desktop/plugin.js:5801 marker: "aria-label": "Passage discussions"
- Limits:
  - Not an independently scrolling default feed. Geometry and layout observers are source-present, not evidence of correct alignment at runtime. Text previews clamp to three lines until expanded.

### UI-056: Passage markers, hover and focus discovery

Numbered gutter markers and CSS text highlights share hover/active state with bubbles; passage click opens discussion and non-colour underline/border cues identify emphasis.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comment-highlights.jsx:63-106
  - frontend/comment-highlights.jsx:171-205
  - frontend/comment-highlights.jsx:226-289
  - frontend/comments.jsx:423-435
- Installed evidence:
  - installed/desktop/plugin.js:2235 marker: .ws-passage-marker {
  - installed/desktop/plugin.js:3605 marker: "aria-label": `Open comment ${marker.index}: ${marker.quote}`,
- Limits:
  - CSS.highlights and Highlight are feature-detected. No independent screenshot or keyboard/tap acceptance. Hover does not intentionally focus, scroll or write document content.

### UI-057: Overlapping discussion groups

Nearby passage markers use native menus; colliding bubble discussions share one cluster with accessible Discussion at this passage choice.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comment-highlights.jsx:121-128
  - frontend/comment-highlights.jsx:257-289
  - frontend/comments.jsx:562-582
  - frontend/comment-bubbles.jsx:6-14
- Installed evidence:
  - installed/desktop/plugin.js:6663 marker: label: "Discussion at this passage",
  - installed/desktop/plugin.js:6654 marker: "aria-label": `${comments.length} passage discussions`,
- Limits:
  - Grouping is geometry based. Complex collision/overlap safety is not proven by source. Each underlying discussion is still processed separately.

### UI-058: Narrow inline passage layout

Below the inline-comment breakpoint bubbles reserve adjacent space near the actual selection line; table passage groups reserve space after the table.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comment-bubbles.jsx:61-150
  - frontend/styles.mjs:1001-1027
  - frontend/editor.mjs:183-198
  - frontend/editor-commands.mjs:519-533
- Installed evidence:
  - installed/desktop/plugin.js:278 marker: for (const gap of copy.querySelectorAll("[data-workspace-comment-gap]"))
  - installed/desktop/plugin.js:2779 marker: .ws-layout { display: block; margin-inline: auto; --ws-inline-comments: 0; --ws-comment-controls-gap: 20px; }
- Limits:
  - 980 px container breakpoint enables inline mode. Temporary gap nodes are removed from saved HTML, history and rich clipboard. Caret/selection/layout safety is not runtime qualified.

### UI-059: Show passage and detached-anchor guidance

Expanded discussions offer Show passage for an attached anchor, revealing the actual Range; missing/ambiguous anchors stay in a named Detached passages location.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:82-105
  - frontend/comments.jsx:529-535
  - frontend/rich-editor.jsx:324-365
  - frontend/editor.mjs:88-109
- Installed evidence:
  - installed/desktop/plugin.js:6049 marker: "Show passage"
  - installed/desktop/plugin.js:6593 marker: visible.some((c) => c.anchor && !attached.has(c.id)) && h("h2", null, "Detached passages"),
- Limits:
  - Matching is exact contextual text matching, not semantic relocation. Showing an existing passage suppresses a new-comment popup for that selection. No guessed reattachment.

### UI-060: Replies and author-labelled history

Expanded thread displays user/Hermes replies and a Reply disclosure with submit and Discard reply. A reply does not automatically resolve the comment.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:127-171
- Installed evidence:
  - installed/desktop/plugin.js:6128 marker: } }, "Discard reply")
- Limits:
  - Replies are plain text. Submission blocked during lock/busy/empty state; no reply-edit/delete control found independently of deleting the discussion.

### UI-061: User-controlled resolution and resolved visibility

Resolve checkbox can reopen resolved comments; resolved discussions hide by default and page-level Show resolved options reveal them, with unresolved count.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:54-79
  - frontend/comments.jsx:300-332
  - frontend/comments.jsx:477-525
  - frontend/workspace.jsx:908
- Installed evidence:
  - installed/desktop/plugin.js:6030 marker: comment.resolved ? "Resolved \u2014 uncheck to reopen" : "Resolve comment"
  - installed/desktop/plugin.js:6568 marker: "aria-label": "Show resolved comments",
- Limits:
  - Show resolved is local page component state, not persisted as a preference. A retained reply draft on a resolved discussion can initialise visibility to true. Agent replies do not tick resolution.

### UI-062: Delete discussion

Delete comment confirms removal of the discussion and replies without reverting document text or erasing section history.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:80-81
  - frontend/comments.jsx:539-560
- Installed evidence:
  - installed/desktop/plugin.js:6037 marker: }, "Delete comment"),
- Limits:
  - Locked/busy operations refuse deletion. Successful removal drops only that discussion reply draft and selection/hover state. Backend tombstone behaviour is not requalified here.

### UI-063: Feedback and reply draft retention

Composer text, target references, anchor and reply drafts are retained per exact Workspace; bubble metadata identifies Draft reply and reload can reopen it.

- Category: Comments
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:200-240
  - frontend/comments.jsx:267-274
  - frontend/comments.jsx:301-305
  - frontend/comments.jsx:433
  - frontend/comments.jsx:526
  - frontend/drafts.mjs:8-44
- Installed evidence:
  - installed/desktop/plugin.js:6585 marker: hasDraft && h("p", { className: "ws-muted ws-discussion-draft", role: "status" }, "Unsubmitted feedback is retained for this Workspace."),
  - installed/desktop/plugin.js:6438 marker: h("span", { className: "ws-bubble-context" }, `${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"} \xB7 ${selected ? "Collapse thread" : "Open thread"}${discussio
- Limits:
  - Retention failure blocks navigation with guidance to copy or submit. New-comment target checklist is no longer present; saved legacy references remain inert.

### WF-007: Whole-page, record-passage and whole-database feedback

Comments accept null whole-item anchors or bounded quote/prefix/suffix anchors. Folders refuse comments and databases refuse passage/cell anchors. Frontend selection capture requires a unique contextual occurrence.

- Category: comment-processing
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:959-972,1092-1096,1640-1646
  - frontend/editor.mjs:88-130
- Installed evidence:
  - workspace_plugin/store.py:959-972,1092-1096,1659-1665
- Limits:
  - Anchors are contextual text matches, not immutable editor block IDs. Missing or ambiguous passages detach rather than being guessed.

### WF-008: User-only resolution and persisted agent/user replies

Ordinary user command owns resolve/reopen; model patches cannot set resolution. Agent replies append through apply_run without resolving. Final proposals require exactly one outcome for every captured comment; legacy tool operations can append incrementally.

- Category: comment-processing
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:973-991,1098-1105,1389-1393,1424-1429
  - workspace_plugin/finalization.py:72-93
  - workspace_plugin/workflow.py:220-227
- Installed evidence:
  - workspace_plugin/store.py:973-991,1098-1105,1388-1392,1423-1428
  - workspace_plugin/finalization.py:72-93
- Limits:
  - Saved outcome text may honestly report inability or partial work; one persisted reply is not semantic edit success. Legacy tool path does not require one reply per call.

### WF-009: Discussion deletion distinct from resolution/reversion

User deletion removes discussion text/replies from current views via a provenance-preserving tombstone. Locked/deleted discussions refuse mutation; late run replies to deleted comments are rejected. Deletion does not revert the document.

- Category: comment-processing
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:973-984,1098-1105,1356-1361
  - frontend/comments.jsx:539-559
- Installed evidence:
  - workspace_plugin/store.py:973-984,1098-1105,1356-1361
- Limits:
  - Recovery/history retains stable provenance IDs; this is not erasure of historical change lineage.

### DATA-028: Durable comments, replies and target references

Stores page/record text anchors or whole-item feedback, separate user/agent replies, explicit resolved state and structured related-item IDs.

- Category: Discussion data
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:959-991
  - working/workspace_plugin/store.py:1083-1105
  - working/workspace_plugin/store.py:1632-1665
- Installed evidence:
  - installed/workspace_plugin/store.py:959-991
  - installed/workspace_plugin/store.py:1083-1105
  - installed/workspace_plugin/store.py:1632-1665
- Limits:
  - Tables accept whole-database comments only; no cell/folder comments. Text targets are data references, not edit authority; author labels are user/agent rather than a shared-member audit identity.

### DATA-029: Derived anchor attachment and deletion tombstones

Anchor quote/prefix/suffix derives attached versus detached status. Deleting feedback removes its text/replies while preserving a hidden provenance tombstone.

- Category: Discussion data
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:662-674
  - working/workspace_plugin/store.py:979-984
  - working/tests/test_comment_deletion.py:44-87
- Installed evidence:
  - installed/workspace_plugin/store.py:662-674
  - installed/workspace_plugin/store.py:979-984
- Limits:
  - Deleted comments are hidden from display snapshots and cannot be reopened or replied to. Repeated or absent passage matches detach rather than guessing.

<a id="native-agent-workflow"></a>
## Address comments in a linked native Hermes thread, with qualification limits

### UI-064: Address every unresolved comment

Address count launches one explicit run for all unresolved discussions, including already answered but unresolved feedback; comment creation alone does not run Hermes.

- Category: Agent workflow
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:306
  - frontend/comments.jsx:496-512
  - frontend/workspace.jsx:1031-1071
  - frontend/workflow.js:118-175
- Installed evidence:
  - installed/desktop/plugin.js:5563 marker: "aria-label": "Address selected scope",
  - installed/desktop/plugin.js:6513 marker: "aria-label": `${unresolved.length} unresolved comments`
- Limits:
  - Direct edits and per-comment outcomes are required in REQUIREMENTS.md:57-60; this UI routes to backend/native workflow but cannot prove actual model edits or complete replies. Resolved discussions are excluded by run review.

### UI-065: Per-run related-item edit approval

Single Review edits for this run dialogue permits current item plus explicitly checked related nonfolder items, showing legacy references and unavailable targets without preselection.

- Category: Agent workflow
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/scope-review.jsx:14-59
  - frontend/scope-review.jsx:61-154
  - frontend/workspace.jsx:1031-1057
  - frontend/workflow.js:129-150
- Installed evidence:
  - installed/desktop/plugin.js:5515 marker: h(DialogTitle3, null, "Review edits for this run"),
- Limits:
  - Consent checked against scope/revision/comment signature before and after flush; review_id validated before native creation. No persistent blanket grant or composer target checklist. Approvals outside Workspace are native responsibility, not verified here.

### UI-066: Persistent native thread reuse

First Address action creates a native thread and later runs reuse saved thread_id; compact Linked Hermes thread disclosure displays binding and run state.

- Category: Agent workflow
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:439-476
  - frontend/workflow.js:153-175
- Installed evidence:
  - installed/desktop/plugin.js:6467 marker: item.thread_id ? `Native thread: ${item.thread_id}` : "A native thread will be created on the first run and reused."
  - installed/desktop/plugin.js:6463 marker: h("summary", null, "Linked Hermes thread"),
- Limits:
  - Uses ambient selected connection/profile through captured public route descriptors. Does not implement independent executor selection. Creation/binding persistence was not exercised.

### UI-067: Open linked native thread

Open thread uses supported host.openSession with exact profile route and tab intent, also available from run recovery/error state.

- Category: Agent workflow
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:448-458
  - frontend/workflow.js:203-208
  - frontend/workspace.jsx:483-485
  - frontend/workspace.jsx:1192-1194
- Installed evidence:
  - installed/desktop/plugin.js:6852 marker: await host.openSession(threadId, { route, intent: "tab", keepAllProfilesScope: true });
- Limits:
  - Opens a native tab, not a custom embedded chat pane. Native tab layout and beside-document arrangement have not been observed.

### UI-068: Select an existing recent thread

Native dialogue lists recent live and saved sessions, filters title/ID locally, offers arrow/Enter and Tab navigation, excludes busy rows and retries load failure.

- Category: Agent workflow
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/thread-picker.jsx:5-80
  - frontend/workflow.js:84-117
- Installed evidence:
  - installed/desktop/plugin.js:5877 marker: "Recent live and saved threads only. Search filters this list; older history has not been searched."
  - installed/desktop/plugin.js:5916 marker: h(Action, { disabled: busy, onClick: () => setAttempt((n) => n + 1) }, "Reload threads")
- Limits:
  - Search is bounded recent-list filtering, not older full history. Exact listed row captures source/epoch; native resume checks eligibility before binding. No explicit new-thread/reset binding action found other than initial creation.

### UI-090: Full-history eligible native conversation search

The current requirement extends beyond recent-list filtering to public full-history search over eligible older threads. No complete integrated historical search control or request path is present.

- Category: Requested search gap
- Archived working status: `requested-only`
- Archived installed status: `absent`
- Working evidence:
  - frontend/thread-picker.jsx:5-6
  - frontend/thread-picker.jsx:49-50
  - frontend/thread-picker.jsx:70
  - frontend/workflow.js:84-105
  - frontend/WORKFLOW-ADAPTER.md:35-37
  - REQUIREMENTS.md:248
- Installed evidence:
  - installed/desktop/plugin.js:5875-5878 explicitly labels recent live/saved threads only and says older history has not been searched. This is a limitation marker, not an older-history implementation.
- Limits:
  - Existing picker searches only its bounded loaded recent rows. Its source explicitly warns older history has not been searched.
  - Pinned public API limitations are documented by the source contract, not freshly audited against the live host. No private history API or invented route was used.

### WF-003: Persistent per-item conversation creation, reuse and explicit rebinding

Existing item.thread_id is resumed and checked idle/native. Unbound items create a GUI session with a unique request/title suffix; prepare binds the durable stored_session_id. Picker binding validates the native session and persists it under the item lock.

- Category: conversation-binding
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - frontend/workflow.js:76-81,107-117,152-175
  - workspace_plugin/workflow.py:88-92,125-148
  - workspace_plugin/store.py:998-1005,1279-1317
- Installed evidence:
  - desktop/plugin.js:6740-6745,6767-6823
  - workspace_plugin/store.py:998-1005,1279-1317
- Limits:
  - Native busy state refuses resume. Request reuse cache is adapter-local; prepare/submission failure is not automatically replayed. Bound conversation history is not cleared by this adapter.

### WF-004: Live and stored conversation discovery

Reads native live and stored feeds on the same captured route, deduplicates canonical IDs, retains route identity with each listed row, and opens the linked thread through host.openSession.

- Category: conversation-binding
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - frontend/workflow.js:84-117,203-213
  - frontend/WORKFLOW-ADAPTER.md:35-37
- Installed evidence:
  - desktop/plugin.js:6748-6776,6848-6863
- Limits:
  - Recent feed filtering is not exhaustive full-history conversation search. No public substring/cursor full-history path is established in the frozen adapter documentation.

### WF-005: Explicit Address action and draft flush

Adding feedback only stores comments. Address flushes editor work, captures/revalidates review scope before and after flush, then prepares and submits one native run with server-issued run ID as submission_id.

- Category: run-admission
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - frontend/comments.jsx:496-512
  - frontend/workspace.jsx:1031-1071
  - frontend/workflow.js:165-175
  - workspace_plugin/store.py:959-972
- Installed evidence:
  - desktop/plugin.js:6813-6823
  - workspace_plugin/store.py:959-972
- Limits:
  - Static trace only; no actual button, pending draft, queue or native submission was exercised.

### WF-006: Every unresolved current-item comment captured on each run

Run selection includes all nondeleted unresolved comments on the current item, regardless of earlier replies, and excludes resolved comments. Their IDs are fixed in the run; selected related items do not automatically contribute their own discussions.

- Category: comment-processing
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:1253-1259,1286-1305
  - workspace_plugin/workflow.py:154-157,183-185
- Installed evidence:
  - workspace_plugin/store.py:1253-1259,1286-1305
  - workspace_plugin/workflow.py:154-157,183-185
- Limits:
  - Completion establishes saved outcomes, not that each substantive request was correctly solved.

### WF-010: Single-use explicit related-item run review

Review offers nonfolder items unchecked, captures source scope/revision/comment signature/exact selected IDs, issues an authenticated one-use review ID for 300 seconds, and revalidates it after Store writer wait before run locks/binding.

- Category: scope
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - frontend/scope-review.jsx:15-59,69-86,132-147
  - frontend/workflow.js:128-145
  - workspace_plugin/workflow.py:94-123,132-153
  - workspace_plugin/store.py:1246-1270,1291-1297
- Installed evidence:
  - desktop/plugin.js:5456-5588,6787-6798
  - workspace_plugin/workflow.py:94-123,132-153
  - workspace_plugin/store.py:1246-1270,1291-1297
- Limits:
  - Review authorises selected edits; it does not establish that each selected item is materially necessary. No separate read-only related-context selection is implemented.

### WF-011: Legacy structured targets and database descendant scope

Without a review, explicitly passed related IDs must be saved structured references on unresolved comments. Current item plus selected IDs are expanded to descendants; a database grant includes its row documents/properties. Raw prose and same-folder proximity do not expand scope.

- Category: scope
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - frontend/workflow.js:145-151
  - workspace_plugin/store.py:481-488,1083-1090,1289-1313
- Installed evidence:
  - desktop/plugin.js:6799-6803
  - workspace_plugin/store.py:481-488,1083-1090,1289-1313
- Limits:
  - Selected related items become edit scope, not merely context. Folder targets are refused.

### WF-012: Complete captured page and comment context retained

Preparation sends complete captured allowed-item content plus current-item comments, anchors and earlier replies. Both current working and installed prompts explicitly request COMPLETE-page reading and attach content_revision; targeted output does not truncate input.

- Category: context
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/workflow.py:154-202
  - workspace_plugin/store.py:335-343,646-675
- Installed evidence:
  - installed/workspace_plugin/workflow.py:154-202
  - installed/workspace_plugin/store.py:335-343,646-675
- Limits:
  - Supplying full content does not establish model attention or actual provider context fit/compression behavior. No attachment binary arrays or full version history are assembled into Address context. Revision metadata has the WF-020 projection defect.

### WF-013: Related-material necessity and absent-context guidance

Both current source variants tell the model that same-folder documents are not automatically included or writable; essential absent material must be explained for explicit existing run-review selection.

- Category: context
- Archived working status: `partial`
- Archived installed status: `partial`
- Working evidence:
  - workspace_plugin/workflow.py:180-202
  - frontend/scope-review.jsx:19-39
  - workspace_plugin/store.py:1300-1305
- Installed evidence:
  - installed/workspace_plugin/workflow.py:180-202
  - installed/workspace_plugin/store.py:1289-1305
- Limits:
  - Guidance only: no automatic necessity classifier, on-demand folder retriever or separately permissioned read-only related-context selection. Selected related items become allowed write scope and their full captured content is sent.

### WF-014: Attachments and reused native conversation context

Prompt contains item HTML references and discussion data, not attachment binary objects or full revision history. The same native session is reused without adapter-side history clearing; native conversational context remains host-managed.

- Category: context
- Archived working status: `partial`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/workflow.py:154-162,175-202
  - frontend/workflow.js:76-81,152-175
  - workspace_plugin/store.py:418-440
- Installed evidence:
  - workspace_plugin/workflow.py:154-162,175-202
  - desktop/plugin.js:6740-6745,6804-6823
- Limits:
  - No automatic attachment reading/extraction in Address preparation; import/export capabilities elsewhere are not model context delivery. Exact provider-visible native history was not inspected or exercised.

### WF-015: Ordinary authenticated UI run uses final JSON, not workspace_apply

API prepare injects principal, validates NativeOwner, transforms base prompt into exact edits/replies-only JSON, and arms finalization. Model is told not to call workspace_apply; asynchronous tool commits on such a run are explicitly refused. Authenticated consume saves the validated final proposal directly without manual approval/application.

- Category: model-output
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - dashboard/plugin_api.py:419-457
  - workspace_plugin/workflow.py:128-169,214-215
  - workspace_plugin/final_run.py:26-40,152-197
  - frontend/workflow.js:171-185
- Installed evidence:
  - dashboard/plugin_api.py:419-457
  - workspace_plugin/workflow.py:128-169,214-215
  - workspace_plugin/final_run.py:26-40,152-197
  - desktop/plugin.js:6821-6830
- Limits:
  - Important distinction: direct saved edits are implemented, but normal UI commits are end-of-turn rather than streamed tool writes. Real provider/native end-to-end success is unverified here.

### WF-016: Bounded untrusted proposal parsing and hook staging

Parser rejects duplicate JSON fields, nonfinite data, extra top-level/identity fields, malformed typed patches and duplicate comment replies. Registered pre-hook binds local origin; post-hook validates/stages exact committed user/final rows and saves native revision/history fingerprints. Hooks themselves do not apply changes.

- Category: model-output
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/finalization.py:25-93,124-163
  - workspace_plugin/final_run.py:59-132
- Installed evidence:
  - workspace_plugin/finalization.py:25-93,124-163
  - workspace_plugin/final_run.py:59-132
- Limits:
  - Hook failures may be fail-open upstream, but missing binding/staging is refused independently by consume. Parser enforces structure and scope, not editorial quality.

### WF-017: Canonical final result join and serving-owner commit

Consume joins exact run/session/principal/prompt/epoch/admission/generation/local-turn/committed-row proposal; requires successful nonpartial native completion and unchanged generation/revision/history. Actual serving owner serializes accepted mutation through journal and Store transaction, checks Stop and source digest, and completes only after persisted outcomes.

- Category: application
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/final_run.py:43-56,135-197
  - workspace_plugin/finalization.py:174-203
  - workspace_plugin/native.py:59-93,103-132
  - workspace_plugin/native_owner.py:11-91
- Installed evidence:
  - workspace_plugin/final_run.py:43-56,135-197
  - workspace_plugin/native.py:59-93,103-132
  - workspace_plugin/native_owner.py:11-91
- Limits:
  - Pinned default in-process host only; missing/retired owner, changed continuity or uncertain completion refuses. This is static workflow tracing, not renewed qualification of native authority or cross-profile experiments.

### WF-019: Bounded model edit fields and database validation

Both working and installed agent edit fields now include title/content/content_edits/properties/columns. Ownership/deletion/binding/resolution remain excluded; Store retains item-kind, HTML, column and typed property validation.

- Category: application
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/workflow.py:20-21,220-227
  - workspace_plugin/finalization.py:58-71
  - workspace_plugin/store.py:510-620,702-734,855-873,1344-1361
- Installed evidence:
  - installed/workspace_plugin/workflow.py:20-21,220-227,371-392
  - installed/workspace_plugin/finalization.py:58-71
  - installed/workspace_plugin/store.py:1344-1384
- Limits:
  - No model create/delete-row command through this patch path. Properties/columns retain existing replacement/normalization semantics, not content-range edits.

### WF-027: Whole-document editing remains a genuine supported mode

Both current variants retain patch.content for genuine page-wide restructuring and prefer content_edits for local fixes. The installed package is no longer restricted to full content strings for content modifications.

- Category: model-output
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/workflow.py:191-198
  - workspace_plugin/finalization.py:64-71
  - workspace_plugin/store.py:702-710,1348-1355
- Installed evidence:
  - installed/workspace_plugin/workflow.py:191-198
  - installed/workspace_plugin/finalization.py:58-71
  - installed/workspace_plugin/store.py:1348-1384
- Limits:
  - Page-wide versus local is model guidance, not a semantic server classifier. Full content does not acquire the content_edits revision/preimage contract; existing run locks and finalization source checks remain. No automatic full-content fallback from a failed compact patch was found.

### WF-028: Concise per-comment outcomes and replies-only work

Both current prompts request concise per-comment outcomes without duplicating the revised document. Replies-only work remains allowed; finalization requires every captured unresolved comment represented.

- Category: model-output
- Archived working status: `partial`
- Archived installed status: `partial`
- Working evidence:
  - workspace_plugin/workflow.py:183-198,204-208
  - workspace_plugin/final_run.py:35-40
  - workspace_plugin/finalization.py:53-57,86-93
- Installed evidence:
  - installed/workspace_plugin/workflow.py:183-202
  - installed/workspace_plugin/final_run.py:35-40
  - installed/workspace_plugin/finalization.py:53-57,86-93
- Limits:
  - Conciseness, relevance and no-duplication are prompt guidance; text bounds do not grade them. Ordinary final output is JSON data, not a second polished chat summary. Persisted inability/partial outcomes are not proof that requested edits succeeded.

<a id="edit-controls-recovery"></a>
## Edit validation, run controls, retained drafts and recovery

### UI-015: Loading, reload and contextual errors

Workspace shows loading/backend-unavailable state, Reload state, dismissible notices and operation-specific recovery links plus technical details.

- Category: Recovery
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:237-274
  - frontend/workspace.jsx:408
  - frontend/workspace.jsx:436-531
  - frontend/ui.jsx:64-92
- Installed evidence:
  - installed/desktop/plugin.js:7223 marker: }) }, "Reload state"),
  - installed/desktop/plugin.js:786 marker: h("summary", null, "Technical details"),
- Limits:
  - State and active-run polling use 3000 ms intervals. Errors do not prove the native execution stopped; separate thread/page links are offered.

### UI-017: Recover title drafts

Retained title drafts require Recover title or Discard retained title; recovery applies and saves explicitly.

- Category: Recovery
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/page-title.jsx:74-83
  - frontend/drafts.mjs:8-44
- Installed evidence:
  - installed/desktop/plugin.js:1072 marker: } }, "Recover title"),
  - installed/desktop/plugin.js:1081 marker: } }, "Discard retained title")
- Limits:
  - Local buffer is connection/profile/scope/item-bound, not automatic authoritative recovery.

### UI-018: Home recovery index and scoped buffers

Home lists content, title, property and discussion drafts, including unavailable-item guidance; storage separates connection/profile/scope and field.

- Category: Recovery
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:659-707
  - frontend/drafts.mjs:8-44
- Installed evidence:
  - installed/desktop/plugin.js:7482 marker: { "aria-label": "Recoverable drafts" },
- Limits:
  - Unavailable items must first be restored from Trash. No automatic saving on opening a retained draft. Local preferences are not demonstrated to be included in full backups.

### UI-040: Autosave with retry and navigation flush

Content saves after 650 ms idle, displays Saved/Saving/Unsaved/Not saved, retains failed edits and provides Retry save; navigation and operations flush pending changes.

- Category: Editor
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:107-218
  - frontend/rich-editor.jsx:1048-1088
  - frontend/workspace.jsx:288-316
  - frontend/workspace.jsx:943-957
- Installed evidence:
  - installed/desktop/plugin.js:4523 marker: "Retry save"
  - installed/desktop/plugin.js:4506 marker: "Saving\u2026": "Saving content\u2026",
- Limits:
  - Backend saves are not exercised. Autosave is blocked by authority locks or retained-draft review; pending image operations settle before leaving.

### UI-041: Recover or discard body drafts

A retained rich-content draft is shown for explicit recovery/discard, warning when the saved base changed. Recovery replaces editor content and autosaves.

- Category: Recovery
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/rich-editor.jsx:538-589
  - frontend/drafts.mjs:25-44
- Installed evidence:
  - installed/desktop/plugin.js:4084 marker: "Recover draft"
  - installed/desktop/plugin.js:4094 marker: "Discard retained draft"
- Limits:
  - Editor stays read-only until the retained draft is reviewed. Recovery is a replacement, not a merge.

### UI-046: Property draft retention and retry

Property editors retain unsaved values, expose status/error, Retry property save and Discard property draft and block navigation while recovery needs review.

- Category: Databases
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/tables.jsx:14-65
  - frontend/tables.jsx:91-102
  - frontend/drafts.mjs:25-44
- Installed evidence:
  - installed/desktop/plugin.js:4967 marker: } }, "Retry property save"),
  - installed/desktop/plugin.js:4979 marker: } }, "Discard property draft")
- Limits:
  - Drafts are per record and column. Computed formula properties are excluded. No runtime persistence observation.

### UI-069: Read-only run banner and real progress

Active run makes allowed documents read-only, disables editing controls and shows preparing/status/progress plus Stop; other pages remain navigable.

- Category: Agent workflow
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:244-268
  - frontend/workspace.jsx:904
  - frontend/workspace.jsx:1142-1163
  - frontend/database.mjs:40-45
  - frontend/rich-editor.jsx:762-765
- Installed evidence:
  - installed/desktop/plugin.js:7964 marker: currentRun ? "Read-only while Hermes addresses comments" : "Preparing comment run\u2026"
- Limits:
  - Progress comes from backend state, not invented percentage. Allowed related items can also lock through allowed_item_ids. Backend and native lifecycle not exercised.

### UI-070: Stop and explicit authority recovery

Stop revokes Workspace write authority before native cancellation; Recover document confirmation can explicitly revoke edits and unlock while warning the native outcome remains unknown.

- Category: Agent workflow
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workflow.js:187-201
  - frontend/workspace.jsx:1072-1081
  - frontend/workspace.jsx:1162-1186
- Installed evidence:
  - installed/desktop/plugin.js:7979 marker: label: "Revoke Workspace edits",
  - installed/desktop/plugin.js:6839 marker: await rpc(token, route, "prompt.cancel", { session_id: stopped.control.session_id, admission_id: stopped.control.admission_id });
- Limits:
  - Stop is not claimed as confirmed native termination. Recovery may leave partial saved edits and preserves pre-run Restore; it skips draft flush to a locked item.

### UI-071: Run outcome review

Completed run says comments remain user-resolved; stopped/error/unknown outcomes show partial-change warnings, thread/restore actions and details.

- Category: Agent workflow
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1188-1202
  - frontend/comments.jsx:471-476
  - frontend/ui.jsx:83-85
- Installed evidence:
  - installed/desktop/plugin.js:7996 marker: h("strong", null, lastRun.status === "cancelled" ? "Run stopped \u2014 review saved changes" : "Run needs review"),
  - installed/desktop/plugin.js:8015 marker: lastRun?.status === "completed" && !locked && h("div", { className: "ws-save", role: "status" }, "Last run completed. Comments remain yours to resolve."),
- Limits:
  - A native reply or terminal state is not presented as proof of successful document edits. No runtime/model outcome claim.

### UI-072: Pre-run whole-page restore

Export and recovery and outcome review expose saved pre-run versions with readable dates, exact identity details and explicit restore confirmation.

- Category: Recovery
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1022-1025
  - frontend/workspace.jsx:1470-1475
  - frontend/workspace.jsx:1484-1552
  - frontend/ui.jsx:45-63
- Installed evidence:
  - installed/desktop/plugin.js:8001 marker: h(Action, { disabled: !preRunVersions.length, onClick: (event) => openLocalDialog("version", event.currentTarget) }, "Restore pre-run version"),
  - installed/desktop/plugin.js:8327 marker: h("p", null, "Exact saved time: ", h("time", { dateTime: version.created_at }, version.created_at)),
- Limits:
  - Replaces content/properties from a snapshot, not section-only undo. Comments remain user-controlled. Disabled while locked and saves/flushes first. Snapshot creation and restoration are backend operations not observed.

### UI-073: Anchored section-only revert

A discussion with available section_change exposes Revert section; UI fetches provenance-bound preview and applies that section, with manual-edit confirmation and current/restored rich previews.

- Category: Recovery
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/comments.jsx:124-126
  - frontend/workspace.jsx:958-1004
  - frontend/workspace.jsx:1101-1140
  - frontend/rich-preview.jsx:6-33
- Installed evidence:
  - installed/desktop/plugin.js:7908 marker: title: "Revert section after manual edits?",
  - installed/desktop/plugin.js:7801 marker: const preview = await command("preview_section_revert", {
- Limits:
  - Only backend-provided available changes qualify, not replies alone. Failed apply expires consent and requires Review section again; generation/content-hash/manual-revision/epoch fields are sent. Isolation of unrelated edits, stale/overlap/manual-edit safety and actual backend behaviour are not proven by source.

### UI-074: Recover whole page from before section revert

Export and recovery offers a separate version selector for section-revert recovery checkpoints.

- Category: Recovery
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1022-1025
  - frontend/workspace.jsx:1476-1481
  - frontend/workspace.jsx:1487-1496
  - frontend/workspace.jsx:1519-1551
- Installed evidence:
  - installed/desktop/plugin.js:8291 marker: }, "Recover before section revert")
- Limits:
  - Explicitly restores the whole page/title/properties and warns it may replace later unrelated changes. This is not the section-only Revert section action.

### WF-020: Revision metadata supplied to model, with manual-revision projection gap

Both current prompts compute content_revision from public snapshot items. Store._public strips _manual_revision; content_revision defaults the missing field to zero, while the resolver compares with the current INTERNAL item. The previously reported repeated-run revision defect remains and is now present in installed source too.

- Category: targeted-edit-optimisation
- Archived working status: `partial`
- Archived installed status: `partial`
- Working evidence:
  - workspace_plugin/workflow.py:154-179
  - workspace_plugin/store.py:335-343,646-657,731-733,818-822,1058-1064
  - workspace_plugin/targeted_edits.py:15-18,50-55
- Installed evidence:
  - installed/workspace_plugin/workflow.py:154-179
  - installed/workspace_plugin/store.py:335-343,646-657,731-733,818-822,1058-1064
  - installed/workspace_plugin/targeted_edits.py:15-18,50-55
- Limits:
  - Source-derived, not an executed reproduction: after an agent content change establishes _section_generation, an ordinary nonempty manual patch increments internal _manual_revision. The next Address prompt advertises zero; a targeted proposal copying that value conflicts even with unchanged captured hash/timestamp. Restore can also advance manual revision.
  - Locks and finalization source binding do not recover metadata already stripped before prompt generation. Failure refuses the operation; no silent overwrite fallback was found.
  - Hold claims of reliable repeated targeted editing after manual edits until the projection path is corrected and candidate-bound repeated-run/native acceptance exists.

### WF-021: Targeted patch validation wired into both output/application paths

New content_edits requires exactly revision fields plus 1-100 before/after replacements. SHA format, timestamp shape, nonnegative exact integer manual revision, text/NUL and cumulative bounds are checked. finalization parser and Store both call the helper; Workflow admits the new field.

- Category: targeted-edit-optimisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/targeted_edits.py:21-47
  - workspace_plugin/workflow.py:20-21,191-197,373-391
  - workspace_plugin/finalization.py:16-19,64-71
  - workspace_plugin/store.py:1348-1355
- Installed evidence:
  - installed/workspace_plugin/targeted_edits.py:21-47
  - installed/workspace_plugin/workflow.py:20-21,191-197,371-392
  - installed/workspace_plugin/finalization.py:16-19,64-71
  - installed/workspace_plugin/store.py:1348-1381
- Limits:
  - Both real caller chains now exist in installed source: final JSON parser -> authenticated consume -> Store, and retained non-finalization workspace_apply -> Workflow.apply -> Store. This is not merely a helper file being packaged. WF-020 still limits successful use.
  - Source installation is not live behavior acceptance; no product imports, tests, native/model/runtime calls or private data access were performed.

### WF-022: Exact revision and unique original preimage resolution

Resolver compares content hash, updated_at and manual revision against current internal item, then requires every nonempty before range to occur exactly once in the same original document, counting overlapping occurrences.

- Category: targeted-edit-optimisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/targeted_edits.py:50-62
  - workspace_plugin/store.py:1370-1381
- Installed evidence:
  - installed/workspace_plugin/targeted_edits.py:50-62
  - installed/workspace_plugin/store.py:1370-1381
- Limits:
  - No fuzzy matching, empty insertion anchor or automatic reread/rebase. Missing/ambiguous/stale preimage raises a conflict, not a full-page overwrite.
  - Both variants retain the WF-020 prompt/internal revision mismatch when manual revision is positive.

### WF-023: Disjoint original-range edits and duplicate-document refusal

Ranges are sorted against one original revision, overlaps refused, then spliced without offset drift. A targeted item's edits must be consolidated into one patch; mixing full content and content_edits is forbidden.

- Category: targeted-edit-optimisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/targeted_edits.py:58-71
  - workspace_plugin/store.py:1348-1355
  - workspace_plugin/finalization.py:68-71
- Installed evidence:
  - installed/workspace_plugin/targeted_edits.py:58-71
  - installed/workspace_plugin/store.py:1348-1355
  - installed/workspace_plugin/finalization.py:68-71
- Limits:
  - Overlapping requests must be consolidated by the model; no automatic conflict merge. before can be a whole document, so semantic locality is guidance rather than a strict range-size policy.

### WF-024: Canonical unchanged-byte preservation with no silent overwrite fallback

Resolver retains all outside substrings, bounds final content, and requires sanitizer(candidate) to equal candidate exactly before application. Store converts resolved compact edits into ordinary content patches only after every compact edit resolves successfully.

- Category: targeted-edit-optimisation
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/targeted_edits.py:66-76
  - workspace_plugin/store.py:1370-1388
  - workspace_plugin/workflow.py:194-197
- Installed evidence:
  - installed/workspace_plugin/targeted_edits.py:66-76
  - installed/workspace_plugin/store.py:1370-1388
  - installed/workspace_plugin/workflow.py:194-197
- Limits:
  - Canonical HTML refusal can require model correction. Internally this still reconstructs full content and uses existing full-state validation/persistence; it is not a section-only SQLite update.

### WF-025: Atomic edits, replies, section provenance and operation receipts

Both current variants resolve every compact edit before any mutation inside Store BEGIN IMMEDIATE, retain native authorizer-after-wait, locks and scope checks, then commit edits/replies/section provenance/operation receipts with full graph validation.

- Category: concurrency
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:304-333,1319-1395
  - workspace_plugin/final_run.py:171-189
- Installed evidence:
  - installed/workspace_plugin/store.py:304-333,1319-1395
  - installed/workspace_plugin/final_run.py:171-195
- Limits:
  - Installed is no longer full-content-only: compact pre-resolution is present. Workflow journal/finish remain separate from Store commit, with receipt recovery rather than a cross-database atomic transaction. Atomic rejection is not evidence of substantive model correctness.

### WF-026: Digest-bound idempotent application and replay refusal

Canonical original edits/replies payload hashes identify operations. Scope, active status and locks are checked on retries, then existing receipt returns before targeted stale-preimage resolution. Receipt and effects commit together; identical retry does not duplicate replies/changes or advance revision when unchanged.

- Category: concurrency
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/workflow.py:228-238
  - workspace_plugin/store.py:1319-1373,1393-1395
  - workspace_plugin/final_run.py:178-195
- Installed evidence:
  - workspace_plugin/workflow.py:228-238
  - workspace_plugin/store.py:1319-1385,1392-1394
  - workspace_plugin/final_run.py:178-195
- Limits:
  - A receipt does not reactivate terminal/revoked runs. Idempotence is exact canonical operation payload, not arbitrary semantically equivalent rewrite recognition.

### WF-029: Read-only admitted documents and per-scope locks

begin_run versions and locks every allowed item. Store user mutations and section reverts check locks, while admitted model patches use the run token. Frontend derives locked state from current run/pending preparation, allowing unrelated pages to remain usable.

- Category: concurrency
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:490-502,702-704,736-750,1303-1315,1335-1341
  - frontend/workspace.jsx:904,1142-1186
- Installed evidence:
  - workspace_plugin/store.py:490-502,702-704,736-750,1303-1315,1335-1341
- Limits:
  - All granted related items, not just the currently visible page, are locked. No real concurrent edit or editor-state execution was attempted.

### WF-030: Stop revokes Workspace writes before exact native cancellation

Workflow persists revocation before native lookup/control response. Adapter then calls prompt.cancel with returned exact admission ID and checks status. Finalization checks pending/delivered native Stop and journal revocation; tool path checks revocation before Store effects.

- Category: lifecycle
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/workflow.py:209-215,309-323
  - frontend/workflow.js:187-196
  - workspace_plugin/final_run.py:43-48,171-177
- Installed evidence:
  - workspace_plugin/workflow.py:209-215,309-323
  - desktop/plugin.js:6832-6841
  - workspace_plugin/final_run.py:43-48,171-177
- Limits:
  - Revocation is not proof native execution stopped. Accepted earlier tool operations remain; normal final proposal is saved only at consume. If cancellation or finalization reconciliation fails, explicit recovery remains necessary.

### WF-031: Authoritative queued/running/terminal progress and missing outcomes

Status maps canonical admission queued/started/terminal/unknown into durable run progress. Completed requires persisted outcomes. Finish fills missing comments with failure/stopped explanatory outcomes and releases locks; finalization completion without all outcomes remains waiting for validated proposal, not success.

- Category: lifecycle
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/workflow.py:241-307
  - workspace_plugin/store.py:1397-1433
  - frontend/workspace.jsx:237-267
- Installed evidence:
  - workspace_plugin/workflow.py:241-307
  - workspace_plugin/store.py:1396-1432
- Limits:
  - Polling is every 3000ms. Adapter status calls consume first; a consume refusal prevents that invocation's subsequent status call, surfaces an error and may leave a run locked until explicit recovery. No percentage/timer claims model progress.

### WF-032: Explicit local recovery and conservative dead-owner cleanup

Run-specific Recover durably revokes authority, finishes locally with native UNKNOWN, records missing outcomes and unlocks without replay or native cancellation claims. Startup-style recover_runs only handles provably dead/reused process owners; constructor does not perform recovery.

- Category: lifecycle
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/workflow.py:325-353
  - workspace_plugin/store.py:1435-1458
  - frontend/workspace.jsx:1162-1197
- Installed evidence:
  - workspace_plugin/workflow.py:325-353
  - workspace_plugin/store.py:1434-1457
- Limits:
  - Unknown outcome is deliberately retained. Source method presence does not establish startup invocation on every host or restart-safe continuation.

### WF-033: Pre-run versions for every granted item

Each allowed item receives an immutable pre-run snapshot/group ID before locking; records include historical database columns. Earlier accepted operations and original versions are retained on Stop/failure for user review/Restore.

- Category: recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:1304-1313,1413-1458
  - workspace_plugin/workflow.py:258-266
- Installed evidence:
  - workspace_plugin/store.py:1304-1313,1412-1457
  - workspace_plugin/workflow.py:258-266
- Limits:
  - Pre-run versions exist even for runs with no eventual content edit. Saving a version does not prove successful model execution.

### WF-034: Whole-item and grouped database Restore

User restore_version restores title/content/properties/columns under locks and revision checks, reconciles historical record schema/group rows, retains later incompatible values as recovered content, and retires section generation. It does not rewrite discussion/reply/resolution state or prove native cancellation.

- Category: recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:1033-1081
  - frontend/workspace.jsx:1188-1197,1551
  - frontend/client.mjs:135-161
- Installed evidence:
  - workspace_plugin/store.py:1033-1081
- Limits:
  - Full Restore is broader than section-only revert; later manual content in restored fields can be overwritten. It is refused while relevant items are locked.

### WF-035: Durable actual-content-change section provenance

Only content differences invoke section capture. Provenance is tied to pre-run item version, run, generation, comment anchor, pre/post rich ranges and manual revision. Later content generations supersede older section actions; reply-only operations create no new section change.

- Category: section-reversion
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:758-822,1382-1388
  - workspace_plugin/sections.py:115-154
- Installed evidence:
  - workspace_plugin/store.py:758-822,1370-1387
  - workspace_plugin/sections.py:115-154
- Limits:
  - Not every agent edit is independently revertible: missing/ambiguous/deleted/cross-boundary/overlapping or overcomplex targets become unavailable. An older available generation may remain after unrelated noncontent edits, with confirmation if manual revision advanced.

### WF-036: Conservative rich section mapping and outside-byte retention

Token-aware diff maps unique quote/context anchors and rich pre/post boundaries, refuses inseparable overlap/boundary uncertainty, and reconstructs only the mapped section while retaining outside bytes. Requires exact canonical sanitized candidate; analysis is capped at 16000 tokens.

- Category: section-reversion
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/sections.py:16-50,53-101,115-177
  - workspace_plugin/store.py:752-756,844-853
- Installed evidence:
  - workspace_plugin/sections.py:16-50,53-101,115-177
  - workspace_plugin/store.py:752-756,844-853
- Limits:
  - SequenceMatcher token bound is not a model-token or latency measurement. Uncertainty never broadens to whole-page Restore.

### WF-037: Saved/draft revalidation, manual confirmation and revert checkpoint

Section preview binds dataset epoch, current hash/manual revision/generation/change IDs and rich before/current previews. Revert revalidates all, requires explicit confirmation after manual changes, checkpoints current item, records reverted_at and changes content only. Frontend flushes drafts, prevents parallel section operations and expires failed approvals.

- Category: section-reversion
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:736-750,824-853,906-909
  - frontend/workspace.jsx:958-1003,1102-1140
  - frontend/client.mjs:135-161
- Installed evidence:
  - workspace_plugin/store.py:736-750,824-853,906-909
- Limits:
  - No manual changes: source permits immediate section revert after fresh preview, without confirmation dialog. Manual changes anywhere after captured generation require confirmation. Cancel/unsaved/runtime behaviours were not executed here.

### DATA-004: Atomic revisions and rollback

BEGIN IMMEDIATE serialises writes, validates the complete graph, increments revision and commits or rolls back together. Expected revision conflicts refuse rather than overwrite.

- Category: Storage
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:304-333
  - working/tests/test_store.py:178-189
- Installed evidence:
  - installed/workspace_plugin/store.py:304-333
- Limits:
  - Store and several private routes permit omitted expected_revision; the ordinary frontend supplies it. Full graph load/save is not an incremental large-dataset engine.

### DATA-056: Saved version and typed schema restoration

Stored pre-run snapshots retain document content, title, properties and table schema; grouped table/record restore rehydrates old schema while visibly retaining incompatible later-row values in content.

- Category: Backup and recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:1033-1080
  - working/workspace_plugin/store.py:1306-1313
  - working/tests/test_store.py:296-316
  - working/tests/test_store.py:597-629
- Installed evidence:
  - installed/workspace_plugin/store.py:1033-1080
  - installed/workspace_plugin/store.py:1306-1313
- Limits:
  - Discussion/resolution and current attachments are not rolled back. Not a general automatic version for every keystroke; native run/revert algorithms are inventoried separately.

### DATA-072: Source/profile/dataset-bound draft buffers

Public plugin storage retains content, title, property and discussion drafts keyed by connection, profile, dataset scope and item, with property-column identity and token-based acknowledgement.

- Category: Local recovery storage
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/frontend/drafts.mjs:1-47
- Installed evidence:
  - installed/desktop/plugin.js:1127-1175
- Limits:
  - Recovery buffers are separate from authoritative SQLite and are not part of complete Store backup. Opening a draft does not write it to the server. No encryption or retention guarantee inferred from the storage API.

<a id="file-interchange"></a>
## Local file import, export, attachments and conversion limits

### UI-076: Import Markdown and CSV

Workspace Import accepts Markdown/CSV along with Word/PDF; import targets the selected folder, shows progress/warnings and opens the result only if navigation intent is unchanged.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:334-366
  - frontend/workspace.jsx:419-423
  - frontend/workspace.jsx:493-504
  - frontend/workspace.jsx:744-749
- Installed evidence:
  - `installed/desktop/plugin.js:7547 marker: "Import Markdown, CSV, Word (.docx) or text-based PDF. Word and PDF become editable content with their original attachments; exact layout and scanned-PDF OCR are not supported. Markdown and `
  - installed/desktop/plugin.js:7314 marker: importBusy && h("div", { className: "ws-notice", role: "status" }, "Importing file\u2026 You can keep browsing Workspace."),
- Limits:
  - Markdown editable pages and CSV tables are required by REQUIREMENTS.md:92-93. The frontend accepts formats and delegates conversion, so parsing/data fidelity remains backend-unverified. Shared file limit 20 MB.

### UI-077: Import editable Word and text PDF with originals

Word .docx and text-based PDF are accepted by Import; Home explains conversion to editable content with retained originals.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:493-501
  - frontend/workspace.jsx:744-749
  - frontend/ui.jsx:86-90
  - REQUIREMENTS.md:94-95
- Installed evidence:
  - `installed/desktop/plugin.js:7547 marker: "Import Markdown, CSV, Word (.docx) or text-based PDF. Word and PDF become editable content with their original attachments; exact layout and scanned-PDF OCR are not supported. Markdown and `
- Limits:
  - Original layout and scanned-PDF OCR are explicitly not supported; legacy .doc is not accepted. Converter availability, fidelity and attachment retention cannot be established from frontend alone.

### UI-078: Export documents to Markdown, Word and PDF

Export and recovery provides MD, DOCX and PDF download actions for pages and records, flushes content first and reports export progress/errors.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1447-1466
  - frontend/editor.mjs:168-180
- Installed evidence:
  - installed/desktop/plugin.js:8250 marker: ["md", "csv", "docx", "pdf"].filter((format) => item.kind === "database" ? format === "csv" : format !== "csv").map((format) => h(Action, {
  - installed/desktop/plugin.js:8293 marker: surfaceBusy && h("p", { role: "status" }, "Preparing export\u2026"),
- Limits:
  - UI/backend download contract is source-present; actual readable PDF, editable DOCX and rich-format conversion were not generated or opened. Document export is not a full backup.

### UI-079: Export database CSV

Database Export and recovery offers CSV only, not document export formats.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1448-1465
- Installed evidence:
  - installed/desktop/plugin.js:8250 marker: ["md", "csv", "docx", "pdf"].filter((format) => item.kind === "database" ? format === "csv" : format !== "csv").map((format) => h(Action, {
- Limits:
  - CSV is portable table content, not a full-fidelity Workspace backup. No exported data was accessed.

### UI-080: Attach and retrieve original files

Export and recovery allows Attach file; document attachment list downloads retained files with contextual labels/type/size.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:1083-1085
  - frontend/workspace.jsx:1399-1436
  - frontend/workspace.jsx:1467-1469
  - frontend/editor.mjs:145-150
  - frontend/editor.mjs:168-180
- Installed evidence:
  - installed/desktop/plugin.js:8275 marker: h(Action, { disabled: locked || surfaceBusy, onClick: () => attachment.current.click() }, "Attach file"),
  - installed/desktop/plugin.js:8219 marker: h("h2", null, "Attachments"),
- Limits:
  - Arbitrary attachment media types use octet-stream fallback and 20 MB shared limit. No attachment removal/rename control found. Download relies on backend supplied base64 bytes.

### DATA-035: Stored original and user attachment bytes

Stores item-owned filename, media type and base64 bytes with stable IDs, validating filename shape, MIME syntax and decoded size.

- Category: Attachments
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:1107-1129
  - working/workspace_plugin/store.py:1460-1468
  - working/dashboard/plugin_api.py:298-301
- Installed evidence:
  - installed/workspace_plugin/store.py:1107-1129
  - installed/workspace_plugin/store.py:1460-1468
  - installed/dashboard/plugin_api.py:298-301
- Limits:
  - 1000 attachment entries and 10000000 decoded bytes each, further constrained by state/HTTP budgets. No external path attachment input or standalone attachment-delete REST command.

### DATA-036: Attachment references and survivor repair

Validates content/history references and carries referenced assets on document/history reads; owner purge copies still-referenced assets to surviving documents and rewrites their URIs.

- Category: Attachments
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:425-430
  - working/workspace_plugin/store.py:1134-1138
  - working/workspace_plugin/store.py:1160-1170
  - working/workspace_plugin/store.py:1838-1842
  - working/tests/test_store.py:406-416
- Installed evidence:
  - installed/workspace_plugin/store.py:425-430
  - installed/workspace_plugin/store.py:1134-1138
  - installed/workspace_plugin/store.py:1160-1170
  - installed/workspace_plugin/store.py:1838-1842
- Limits:
  - Cross-item references can exist within one Store. Converter exports require supplied item-owned raster bytes, so not every admitted cross-item image reference exports unchanged.

### DATA-037: Deliberate local file import API

POST /import accepts a display filename and base64 payload, converts before committing, then atomically creates a page plus original or table plus records.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:1058-1072
  - working/workspace_plugin/interchange.py:1165-1172
  - working/dashboard/plugin_api.py:313-326
- Installed evidence:
  - installed/workspace_plugin/interchange.py:987-1001
  - installed/workspace_plugin/interchange.py:1094-1101
  - installed/dashboard/plugin_api.py:313-326
- Limits:
  - No file path, automatic folder ingestion, remote conversion service or native execution from imported data. Private-store route only.

### DATA-038: Markdown page import

Parses bounded Markdown headings, basic marks/links, nested lists/checklists, quotes, code fences and simple pipe tables into sanitised editable HTML, retaining original bytes.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:235-304
  - working/workspace_plugin/interchange.py:1064-1072
  - working/tests/test_interchange.py:61-72
- Installed evidence:
  - installed/workspace_plugin/interchange.py:235-304
  - installed/workspace_plugin/interchange.py:993-1001
- Limits:
  - UTF-8 with optional BOM; bounded common syntax, not full CommonMark or exact document round-trip. Raw active HTML is not passed through.

### DATA-039: Markdown document export

Exports semantic document content to UTF-8 Markdown with native fragment links, inline marks, lists/tasks, code, quotes, tables and image references.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:307-345
  - working/workspace_plugin/interchange.py:1075-1082
- Installed evidence:
  - installed/workspace_plugin/interchange.py:307-345
  - installed/workspace_plugin/interchange.py:1004-1011
- Limits:
  - Lossy interchange, not a full backup. Rich layout, some semantic marks, properties, comments and recovery history are not represented as complete data.

### DATA-040: UTF-8 CSV table import

Requires unique nonempty headers, correct row widths and quoted CSV syntax; preserves every value as text and creates a table with row documents.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:388-406
  - working/workspace_plugin/store.py:1470-1481
  - working/tests/test_interchange.py:210-225
- Installed evidence:
  - installed/workspace_plugin/interchange.py:388-406
  - installed/workspace_plugin/store.py:1470-1481
- Limits:
  - No type guessing or original CSV attachment. Parser caps 256 columns/10000 rows/128 KiB source bytes per cell, but Store caps 100 columns, 5000 total items and 20000-character text properties.

### DATA-041: Spreadsheet-safe CSV export

Exports current table schema names and active record property values as UTF-8 CSV; list/object values use JSON text and computed projections can be exported.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:409-429
  - working/dashboard/plugin_api.py:342-346
  - working/tests/test_interchange.py:74-86
- Installed evidence:
  - installed/workspace_plugin/interchange.py:409-429
  - installed/dashboard/plugin_api.py:342-346
- Limits:
  - Prefixes formula-like nonnumeric text by default, intentionally changing interchange text. No record-body/comment/history fidelity or preservation of typed schema.

### DATA-042: Editable DOCX import with originals

DOCX import retains the original bytes and extracts supported semantic content. Working now groups contiguous list paragraphs, nests lists up to depth 8, tracks numbering identities/starts/continuations/restarts/overrides, and decodes Word line breaks/tabs as code whitespace for Code-style paragraphs. Installed retains the prior importer.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/interchange.py:538-662
  - workspace_plugin/interchange.py:1058-1072
  - tests/test_interchange_review22.py:10-46
  - tests/test_interchange_review24.py:6-17
- Installed evidence:
  - installed/workspace_plugin/interchange.py:538-626
  - installed/workspace_plugin/interchange.py:987-1001
- Limits:
  - Working-only improvements: installed interchange.py is byte-identical to the previous installed and previous working baseline, so installed lists are still emitted as isolated flat one-item lists and Code-style br/tab handling is still the older conversion.
  - Neither variant reconstructs arbitrary Word style/layout fidelity, original pagination, drawings, headers, footnotes, floating objects or tracked-change history. Legacy .doc and OCR are unsupported. Original attachments do not make omitted image content editable.
  - Working numbered formats are reduced to ordered versus bullet categories rather than preserving every Word numbering glyph/template; stylesheet-derived numbering is not generally resolved. New regression source was read, not executed.

### DATA-043: Real DOCX semantic export

Real semantic DOCX export remains present in both variants. Working adds independent numbering identities per HTML list, list start overrides, and explicit Word br/tab elements for preformatted newline/tab content. Installed retains the older list numbering and preformatted-text exporter.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/interchange.py:704-873
  - workspace_plugin/interchange.py:1075-1082
  - tests/test_interchange_review22.py:10-46
  - tests/test_interchange_review24.py:6-17
- Installed evidence:
  - installed/workspace_plugin/interchange.py:668-829
  - installed/workspace_plugin/interchange.py:1004-1011
- Limits:
  - Working-only list/start/code-whitespace changes are not in the installed package. New source fixtures are not executed round-trip evidence.
  - Newly generated layout, fixed page/style defaults, no tracked changes/page-layout controls or exact import fidelity. Simple table support does not imply arbitrary rich nested table/list equivalence.

### DATA-044: Text-PDF import

Extracts supported PDF page text in source-page order to editable HTML with source-page headings and retains original bytes.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:909-932
  - working/workspace_plugin/interchange.py:1069-1072
  - working/tests/test_interchange.py:141-158
- Installed evidence:
  - installed/workspace_plugin/interchange.py:864-887
  - installed/workspace_plugin/interchange.py:998-1001
- Limits:
  - No OCR. Encrypted, no-text, image-only and mixed image-only pages refuse. No reconstruction of columns, layout, tables, embedded images or original text styling.

### DATA-045: Readable PDF export

Both variants generate newly laid-out readable PDFs. Working additionally styles top-level code with Courier/background and quotes with italic/indentation, and splits table-cell content into ordered text and byte-backed raster image flowables. Installed retains older body-style code/quote rendering and table-cell image placeholders.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/interchange.py:935-1055
  - tests/test_interchange_review22.py:48-57
  - tests/test_interchange.py:704-729
- Installed evidence:
  - installed/workspace_plugin/interchange.py:890-984
- Limits:
  - Working PDF table-cell raster embedding and code/quote styles are absent from installed interchange.py. Film only the package actually demonstrated; do not advertise these as installed.
  - Source implements bounded raster scaling and semantic text order, not arbitrary original PDF/Word layout or typography fidelity. New cell text rendering does not promise complete block-style fidelity within cells.
  - Latin uses embedded fonts; CJK relies on a standard reader CID font; complex shaping/RTL not promised. Converter dependencies, real generated output, pagination and host runtime were not exercised.

### DATA-046: Raster image export policy

Resolves item-owned attachment images or inline PNG/JPEG data, validates bounded rasters, embeds PNG/JPEG and converts GIF/WebP to the first frame.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:665-701
  - working/workspace_plugin/interchange.py:737-761
  - working/tests/test_api.py:339-401
- Installed evidence:
  - installed/workspace_plugin/interchange.py:629-665
  - installed/workspace_plugin/interchange.py:697-721
- Limits:
  - Never fetches remote images. 20000000-pixel and converter byte limits apply; malformed rasters refuse even Markdown export preparation. Converter ownership is stricter than generic in-store attachment references.

### DATA-047: Semantic normal-weight compatibility

Preserves explicit normal-weight text nested inside a heading/bold ancestor via a narrow data-workspace-weight token across Store, DOCX and PDF.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:134-140
  - working/workspace_plugin/interchange.py:178-180
  - working/workspace_plugin/interchange.py:601-609
  - working/workspace_plugin/interchange.py:715-735
  - working/workspace_plugin/interchange.py:969-974
  - working/tests/test_interchange.py:44-59
- Installed evidence:
  - installed/workspace_plugin/store.py:134-140
  - installed/workspace_plugin/interchange.py:178-180
  - installed/workspace_plugin/interchange.py:591-599
  - installed/workspace_plugin/interchange.py:679-695
  - installed/workspace_plugin/interchange.py:914-919
- Limits:
  - A single semantic token is supported, not arbitrary inline CSS or full Word style fidelity.

### DATA-048: Bounded local converter execution

Applies byte/tree/archive/row/page limits before commit; PDF conversion runs in a child with a wall deadline and POSIX CPU/address-space bounds.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:62-77
  - working/workspace_plugin/interchange.py:877-906
  - working/workspace_plugin/interchange.py:914
  - working/plugin.yaml:10-14
- Installed evidence:
  - installed/workspace_plugin/interchange.py:62-77
  - installed/workspace_plugin/interchange.py:832-861
  - installed/workspace_plugin/interchange.py:869
  - installed/plugin.yaml:10-14
- Limits:
  - Manifest pins converter dependencies; installation/availability not checked. PDF requires pypdf/reportlab, raster export needs Pillow. Non-POSIX resource behaviour and cross-platform fidelity remain unverified.

### DATA-049: Archive and semantic input validation

Validates ZIP framing/member counts, paths, duplicate entries, compression ratios and actual bytes; DOCX rejects unsafe XML relationships/active package parts and strips nonsemantic HTML.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:148-224
  - working/workspace_plugin/interchange.py:432-515
  - working/workspace_plugin/interchange.py:524-569
  - working/tests/test_interchange.py:271-300
- Installed evidence:
  - installed/workspace_plugin/interchange.py:148-224
  - installed/workspace_plugin/interchange.py:432-515
  - installed/workspace_plugin/interchange.py:524-569
- Limits:
  - These are static input-boundary implementations, not tested security guarantees or an OS sandbox. No probes were run.

<a id="local-storage-backup"></a>
## Local persistence and canonical Workspace backup

### UI-081: Complete Workspace backup

Workspace menu downloads /backup; Home and utility copy distinguish complete backup from Markdown/CSV/document exports.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:424-428
  - frontend/workspace.jsx:744-749
  - frontend/workspace.jsx:1466
  - REQUIREMENTS.md:98-99
- Installed evidence:
  - installed/desktop/plugin.js:7242 marker: "Back up Workspace"
- Limits:
  - Preservation of structure/comments/history/attachments is UI copy and required scope, not verified full round-trip fidelity. Native session references need separate restore handling.

### UI-082: Replace Workspace from backup with uncertain-outcome recovery

Restore backup selects ZIP/JSON then explicitly confirms replacement; receipt-based status prevents replay and offers inspect/current-state recovery after unknown results.

- Category: Interchange
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:334-350
  - frontend/workspace.jsx:505-514
  - frontend/restore.jsx:11-174
  - frontend/client.mjs:194-313
  - frontend/editor.mjs:144-157
- Installed evidence:
  - installed/desktop/plugin.js:879 marker: status === "confirmation" ? "Replace Workspace from backup?" : "Workspace replacement status"
  - installed/desktop/plugin.js:918 marker: "Check replacement status"
  - installed/desktop/plugin.js:927 marker: "Use current Workspace (outcome unknown)"
- Limits:
  - Maximum backup input 64,069,632 bytes. Dialogue warns current data is replaced and native threads detach. Unknown response is not retried as a second replacement. Readback counts explicitly do not prove the replacement outcome. No backup was opened or restored.

### WF-038: Backup preserves data/provenance while detaching native run identity

Backup/restore validates complete graph and section references, refuses replacement during active locks, retains comments/versions/attachments, clears native runs/thread/executor bindings on replacement and issues fresh section dataset epoch. Restored data cannot silently adopt foreign native threads.

- Category: recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/store.py:348-365,1483-1531,1682-1768
  - dashboard/plugin_api.py:356-417
- Installed evidence:
  - workspace_plugin/store.py:348-365,1482-1530,1681-1767
  - dashboard/plugin_api.py:356-417
- Limits:
  - Data portability is not workflow resumption; active run identity is deliberately removed. No backup data was opened and no restore was performed.

### DATA-001: Managed profile-local SQLite store

Stores Workspace under the explicitly supplied profile home in plugin-data/workspace/workspace.sqlite3, separate from installation files.

- Category: Storage
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:213-260
  - working/tests/test_store.py:46-55
- Installed evidence:
  - installed/workspace_plugin/store.py:213-260
- Limits:
  - No database-server provisioning or automatic discovery of external documents.

### DATA-002: Persistent canonical data categories

Persists items, comments, versions, attachment bytes, runs, recents and templates, plus metadata and durable item locks.

- Category: Storage
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:236-253
  - working/workspace_plugin/store.py:279-302
- Installed evidence:
  - installed/workspace_plugin/store.py:236-253
  - installed/workspace_plugin/store.py:279-302
- Limits:
  - JSON rows inside SQLite are the canonical document model, not arbitrary external database connections.

### DATA-006: Versioned bounded data graph

Schema version 1 and whole-state validation bound items, comments, columns, attachments, templates, recents, history, nesting and canonical JSON size.

- Category: Storage
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:51-62
  - working/workspace_plugin/store.py:257-259
  - working/workspace_plugin/store.py:1533-1544
- Installed evidence:
  - installed/workspace_plugin/store.py:51-62
  - installed/workspace_plugin/store.py:257-259
  - installed/workspace_plugin/store.py:1533-1544
- Limits:
  - 5000 items, 100 columns per table, 10000 comments, 1000 attachments, 500 templates, 100 recents, 20000 versions, 10000 runs; canonical state budget 64000000 bytes.

### DATA-007: Consistent display and raw backup snapshots

Display snapshots derive formulas and anchor state while hiding tombstones/private fields; backup_snapshot retains persisted Trash/history metadata without derived value inflation.

- Category: Storage
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:335-365
  - working/tests/test_store.py:752-763
- Installed evidence:
  - installed/workspace_plugin/store.py:335-365
- Limits:
  - Native workflow journal is a separate authority store and is not included in the canonical backup.

### DATA-050: Complete canonical Workspace archive

GET /backup builds a versioned ZIP containing canonical document/table graphs, comments/replies/anchors, attachments/originals, templates, recents, Trash and pre-run history.

- Category: Backup and recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:348-363
  - working/workspace_plugin/interchange.py:1140-1151
  - working/dashboard/plugin_api.py:356-363
  - working/tests/test_interchange.py:227-269
- Installed evidence:
  - installed/workspace_plugin/store.py:348-363
  - installed/workspace_plugin/interchange.py:1069-1080
  - installed/dashboard/plugin_api.py:356-363
- Limits:
  - Full fidelity is scoped to Store categories. No native conversation history, installation/config, workflow grants/journal or shared catalog/member metadata. Source run records are archived but intentionally not restored.

### DATA-051: Full-size backup transport budget

Full backups accept the Store 64000000-byte canonical raw snapshot budget independently of smaller document/converter limits and use an uncompressed ZIP member.

- Category: Backup and recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:72-77
  - working/workspace_plugin/interchange.py:1140-1151
  - working/dashboard/plugin_api.py:365-381
  - working/tests/test_interchange.py:438-477
- Installed evidence:
  - installed/workspace_plugin/interchange.py:72-77
  - installed/workspace_plugin/interchange.py:1069-1080
  - installed/dashboard/plugin_api.py:365-381
- Limits:
  - Full archive/request envelope headroom differs from ordinary 8 MiB file import; all canonical per-category/graph limits still apply. No capacity test executed.

### DATA-052: Version and digest checked archive validation

read_backup accepts only the complete version-1 snapshot envelope and validates its digest, JSON fields and canonical graph before any replacement.

- Category: Backup and recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:1085-1137
  - working/workspace_plugin/interchange.py:1154-1162
  - working/workspace_plugin/store.py:1870-1907
- Installed evidence:
  - installed/workspace_plugin/interchange.py:1014-1066
  - installed/workspace_plugin/interchange.py:1083-1091
  - installed/workspace_plugin/store.py:1870-1907
- Limits:
  - SHA-256 detects accidental corruption, not authenticity; archives are not encrypted or signed. Markdown/CSV and arbitrary ZIP files are not full backups.

### DATA-053: Atomic whole-dataset replacement

Restore replaces rather than merges, preserves internal IDs/references, validates the complete graph and uses the receiving Store scope/revision. Active receiving runs block replacement.

- Category: Backup and recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:1483-1531
  - working/workspace_plugin/interchange.py:1175-1177
  - working/dashboard/plugin_api.py:365-406
  - working/tests/test_store.py:242-271
- Installed evidence:
  - installed/workspace_plugin/store.py:1483-1531
  - installed/workspace_plugin/interchange.py:1104-1106
  - installed/dashboard/plugin_api.py:365-406
- Limits:
  - No automatic pre-replacement backup is created by this route. Capture/download a backup first. Omitted revision remains allowed in legacy noncompact calls.

### DATA-054: Native identity detachment on restore

Clears thread IDs, executor selections, thread-owner references, run records and version run/thread references; rotates the section dataset epoch and retains receiving-store scope.

- Category: Backup and recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/interchange.py:1122-1133
  - working/workspace_plugin/store.py:1502-1530
  - working/tests/test_shared_workspaces.py:239-249
- Installed evidence:
  - installed/workspace_plugin/interchange.py:1051-1062
  - installed/workspace_plugin/store.py:1502-1530
- Limits:
  - Does not import foreign native session authority or resume runs. Section provenance remains historical data, not an execution grant.

### DATA-055: Restore completion receipts and readback

Optional restore_id binds a scoped process-local receipt to the exact backup digest; repeated submissions return running/refused/committed/unknown state without repeating a known committed replacement.

- Category: Backup and recovery
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/dashboard/plugin_api.py:119-169
  - working/dashboard/plugin_api.py:376-417
  - working/tests/test_api.py:403-479
- Installed evidence:
  - installed/dashboard/plugin_api.py:119-169
  - installed/dashboard/plugin_api.py:376-417
- Limits:
  - 64 process-local receipts, not durable recovery after backend restart. Missing receipt means unknown and must not trigger an automatic replacement retry; compact restore requires captured revision.

<a id="profile-ownership"></a>
## Profile ownership, routing and dataset boundaries

### UI-084: Ambient Workspace owner and profile isolation

Workspace displays current profile and remounts scoped clients on connection/profile/activation-epoch changes; pending operations reject stale owners and drafts/preferences use scoped identity.

- Category: Profiles
- Archived working status: `source-present`
- Archived installed status: `marker-only`
- Working evidence:
  - frontend/workspace.jsx:52-67
  - frontend/workspace.jsx:132-153
  - frontend/workspace.jsx:391-394
  - frontend/client.mjs:9-28
  - frontend/client.mjs:35-57
  - frontend/workflow.js:36-65
- Installed evidence:
  - installed/desktop/plugin.js:1852 marker: .ws-source {
  - installed/desktop/plugin.js:1331 marker: super("Workspace source changed. Reopen the page in the selected profile.");
- Limits:
  - Header is an ambient profile badge, not an independent agent/executor picker. Isolation is source intent, not a tested profile-switch/storage guarantee. Narrow layout hides the badge.

### WF-002: Captured native route, profile and activation epoch

Adapter captures connection/profile/activation epoch, obtains one exact profile route, checks before and after awaits, and sends expected_scope on workflow POSTs. Native RPC goes through host.requestProfile; no separate inference client is configured.

- Category: native-integration
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - frontend/workflow.js:29-81
  - workspace_plugin/native.py:15-35
  - dashboard/plugin_api.py:419-457
- Installed evidence:
  - desktop/plugin.js:6695-6745
  - dashboard/plugin_api.py:419-457
- Limits:
  - Ambient owner routing is not independent executor selection. Native runtime/loading was not exercised.

### DATA-003: Profile and dataset identity isolation

Creates a stable random store scope and validates request-scoped owner selection and expected_scope before HTTP mutations.

- Category: Storage
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:255-271
  - working/dashboard/plugin_api.py:43-46
  - working/dashboard/plugin_api.py:104-107
  - working/dashboard/plugin_api.py:172-175
  - working/tests/test_api.py:147-161
- Installed evidence:
  - installed/workspace_plugin/store.py:255-271
  - installed/dashboard/plugin_api.py:43-46
  - installed/dashboard/plugin_api.py:104-107
  - installed/dashboard/plugin_api.py:172-175
- Limits:
  - Source-only isolation evidence; host authentication and live profile switching were not exercised.

### DATA-005: File and directory access boundaries

Store creates owner-private directories and a regular private database, refusing symlink store paths and multiply linked database files.

- Category: Storage
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:213-231
  - working/workspace_plugin/store.py:262-267
  - working/tests/test_store.py:457-465
- Installed evidence:
  - installed/workspace_plugin/store.py:213-231
  - installed/workspace_plugin/store.py:262-267
- Limits:
  - Application permissions and local file modes are not encryption or an OS sandbox. No filesystem probes performed.

### DATA-071: Host-owned authentication and profile routing

REST router depends on Hermes token admission and resolves selected home inside each request. Native workflow principals are host-owned and the HTTP command allowlist excludes raw run/bind authority.

- Category: Plugin boundary
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/dashboard/plugin_api.py:43-63
  - working/dashboard/plugin_api.py:115-118
  - working/dashboard/plugin_api.py:293-311
  - working/dashboard/plugin_api.py:437-457
- Installed evidence:
  - installed/dashboard/plugin_api.py:43-63
  - installed/dashboard/plugin_api.py:115-118
  - installed/dashboard/plugin_api.py:293-311
  - installed/dashboard/plugin_api.py:437-457
- Limits:
  - Host/private module compatibility and live authentication were not exercised; this is source wiring, not an independent security assessment.

### DATA-073: Owner-fenced REST write queue

The state client captures the source/profile owner, serialises ordinary commands and transfers, injects current scope/revision and refuses stale replies after owner/dataset changes.

- Category: Local recovery storage
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/frontend/client.mjs:1-76
  - working/frontend/client.mjs:135-180
- Installed evidence:
  - installed/desktop/plugin.js:1329-1398
  - installed/desktop/plugin.js:1469-1519
- Limits:
  - An in-memory state/write queue, not offline synchronisation or a durable operation log. Reads still load full /state.

<a id="unreleased-shared-executor"></a>
## Unreleased shared projects, independent executors and profile lifecycle gaps

### UI-085: Private or shared Workspace selection

Standalone ProfileWorkspaces offers Private workspace or a shared workspace choice when capability says shared storage is configured, with role/loading/error display.

- Category: Shared workspace scaffolding
- Archived working status: `partial`
- Archived installed status: `absent`
- Working evidence:
  - frontend/profile-workspaces.jsx:1-6
  - frontend/profile-workspaces.jsx:24-59
  - frontend/profile-workspaces.mjs:38-68
  - frontend/index.jsx:3
  - frontend/workspace.jsx:1-51
- Installed evidence:
  - installed/desktop/plugin.js:1-8401 no ProfileWorkspaces, createProfileWorkspacesClient or Private workspace selector marker.
- Limits:
  - Component and client exist but are not imported or mounted by index.jsx or workspace.jsx. Therefore no reachable selector in the inspected route.
  - Requires authenticated backend capabilities/root and beforeSelect/onSelect draft/navigation integration; missing hooks explicitly refuse. D-ROOT and D-LIFECYCLE are noted public capability gaps in REQUIREMENTS.md:248.
  - Not evidence of hosted/team collaboration, cross-machine sync or permission to switch real profiles.

### UI-086: Create a local shared workspace

Standalone dialogue asks for workspace name and creates a separate shared workspace without moving private documents.

- Category: Shared workspace scaffolding
- Archived working status: `partial`
- Archived installed status: `absent`
- Working evidence:
  - frontend/profile-workspaces.jsx:46-51
  - frontend/profile-workspaces.jsx:60-65
  - frontend/profile-workspaces.mjs:70-76
- Installed evidence:
  - installed/desktop/plugin.js:1-8401 no New shared workspace marker.
- Limits:
  - Not wired into the live frontend route. Requires shared_storage_configured capability and private scope; roster/storage setup not qualified. Name input maxLength 200.

### UI-087: Manage local profile memberships and roles

Standalone creator-only Members dialogue lists local profiles, adds/removes membership and changes editor/read-only role.

- Category: Shared workspace scaffolding
- Archived working status: `partial`
- Archived installed status: `absent`
- Working evidence:
  - frontend/profile-workspaces.jsx:41-43
  - frontend/profile-workspaces.jsx:52-53
  - frontend/profile-workspaces.jsx:66-83
  - frontend/profile-workspaces.mjs:92-102
- Installed evidence:
  - installed/desktop/plugin.js:1-8401 no Workspace members or New shared workspace marker.
- Limits:
  - Not mounted by Workspace. Requires authenticated profileOptions roster. Creator role cannot be changed/removed by these controls.
  - Read-only badge and role choices are scaffolding, not proof the main document UI enforces read-only membership. Backend membership/revocation was not reviewed in this inventory.

### UI-088: Move private document into shared workspace

Standalone confirmation chooses an editor destination and warns members gain access; beforeMove/onMoved hooks protect drafts and uncertain responses warn against replay.

- Category: Shared workspace scaffolding
- Archived working status: `partial`
- Archived installed status: `absent`
- Working evidence:
  - frontend/profile-workspaces.jsx:54-55
  - frontend/profile-workspaces.jsx:84-96
  - frontend/profile-workspaces.mjs:104-117
- Installed evidence:
  - installed/desktop/plugin.js:1-8401 no Move to shared workspace or Move document into a shared workspace marker.
- Limits:
  - Not integrated into the main document Page actions or route. Requires both hooks, fresh source/destination revisions and membership-bound shared view.
  - Promised supported hierarchy/comments/attachments/history transfer is copy and delegation, not observed data integrity. Unsupported connected data is intended to refuse the whole move.

### UI-089: Independent page executor and matching conversation

Standalone PageExecutorPicker contains local executing-profile and matching-thread selects plus Remember executor; executorChoice validates matching explicit source and profile identities.

- Category: Executor selection scaffolding
- Archived working status: `partial`
- Archived installed status: `absent`
- Working evidence:
  - frontend/profile-workspaces.jsx:99-146
  - frontend/profile-workspaces.mjs:124-138
  - frontend/workspace.jsx:1-51
  - frontend/workflow.js:36-52
  - REQUIREMENTS.md:185-220
  - REQUIREMENTS.md:248
- Installed evidence:
  - installed/desktop/plugin.js:1-8401 no PageExecutorPicker, Remember executor or Executing local profile marker.
- Limits:
  - Mandatory UI04 asks for explicit configured native agent/profile and eligible existing or new conversation, persistent reuse, immutable data-owner/executor identity, direct edits and exact Stop route. Ambient profile badge and Workspace switching do not satisfy it.
  - This standalone selector is not imported/mounted by the main route, and no real bridge is supplied there. It requires listProfiles/listThreads/bind/assertCurrent methods and otherwise renders an unavailable message only if mounted.
  - Scaffold offers matching existing thread only, with no explicit new-conversation option. Integrated workflow still captures the ambient connection/profile. D-EXECUTOR remains a declared capability gap and UI04 is not implemented/qualified.
  - No real cross-owner backend/native join, eligibility, grant, Stop or provider execution was evaluated.

### WF-039: Independent executor/shared owner execution remains unavailable

Workflow requires Store/native profile equality and refuses stored executor/thread-owner metadata without a qualified binding. NativeOwner requires actual default in-process owner. Capabilities report native_shared_executor and local_profile_backend_default false; selecting another profile's independent executor for this data is not implemented by ambient conversation routing.

- Category: scope
- Archived working status: `requested-only`
- Archived installed status: `absent`
- Working evidence:
  - workspace_plugin/workflow.py:25-33,135-137
  - workspace_plugin/store.py:1224-1251
  - workspace_plugin/native_owner.py:11-20
  - dashboard/plugin_api.py:177-193
  - REQUIREMENTS.md:185-220,248
- Installed evidence:
  - workspace_plugin/workflow.py:25-33,135-137
  - dashboard/plugin_api.py:177-193
- Limits:
  - Saved executor metadata is a composition seam, not product execution wiring. No forbidden experiment, writer control, cross-profile access or authority bypass was attempted; no global impossibility claim is made.

### DATA-057: Explicit-member local project data service

A separate local catalog and per-project Stores support multiple named shared projects while existing private profile stores remain untouched.

- Category: Sharing
- Archived working status: `partial`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/shared_workspaces.py:1-7
  - working/workspace_plugin/shared_workspaces.py:52-64
  - working/workspace_plugin/shared_workspaces.py:103-108
  - working/workspace_plugin/shared_workspaces.py:121-148
  - working/tests/test_shared_workspaces.py:47-61
- Installed evidence:
  - installed/workspace_plugin/shared_workspaces.py:1-7
  - installed/workspace_plugin/shared_workspaces.py:52-64
  - installed/workspace_plugin/shared_workspaces.py:103-108
  - installed/workspace_plugin/shared_workspaces.py:121-148
- Limits:
  - Partial product wiring: service requires an approved server-supplied absolute application root; default production router does not supply one. No cloud account, public share URL or synchronisation.

### DATA-058: Default editor and alternative read-only membership

Creation includes the creator as editor and adds only explicit member IDs. Omitted member role is editor; read_only permits viewing/search but no mutation.

- Category: Sharing
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/shared_workspaces.py:89-101
  - working/workspace_plugin/shared_workspaces.py:127-148
  - working/workspace_plugin/shared_workspaces.py:173-185
  - working/tests/test_shared_workspaces.py:63-77
- Installed evidence:
  - installed/workspace_plugin/shared_workspaces.py:89-101
  - installed/workspace_plugin/shared_workspaces.py:127-148
  - installed/workspace_plugin/shared_workspaces.py:173-185
- Limits:
  - Application-level access, not isolation from same-user OS tools. Synthetic source tests only; deployed shared-storage composition remains unavailable.

### DATA-059: Unlisted profiles have no project access

List queries join explicit membership and snapshots/commands check the authenticated profile before opening a project Store.

- Category: Sharing
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/shared_workspaces.py:89-108
  - working/workspace_plugin/shared_workspaces.py:121-125
  - working/workspace_plugin/shared_workspaces.py:168-185
  - working/tests/test_shared_workspaces.py:47-61
- Installed evidence:
  - installed/workspace_plugin/shared_workspaces.py:89-108
  - installed/workspace_plugin/shared_workspaces.py:121-125
  - installed/workspace_plugin/shared_workspaces.py:168-185
- Limits:
  - Member identifiers are opaque keys derived from authenticated server profile homes, not browser-selected private-store paths. No implicit all-profile sharing.

### DATA-060: Creator-managed member changes

Only the creating editor can add, change or remove members; the creator cannot remove or downgrade their own editor membership.

- Category: Sharing
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/shared_workspaces.py:150-166
  - working/dashboard/plugin_api.py:238-251
  - working/tests/test_shared_workspaces.py:93-99
- Installed evidence:
  - installed/workspace_plugin/shared_workspaces.py:150-166
  - installed/dashboard/plugin_api.py:238-251
- Limits:
  - No creator transfer, shared workspace rename/delete or project-role hierarchy beyond editor/read_only is exposed.

### DATA-061: Membership revisions and revocation fencing

Mutations capture membership revision and Store revision/scope; the catalog write lock spans permission admission, Store waits and commit, so stale revoked/readded membership refuses.

- Category: Sharing
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/shared_workspaces.py:89-101
  - working/workspace_plugin/shared_workspaces.py:110-114
  - working/workspace_plugin/shared_workspaces.py:173-185
  - working/tests/test_shared_workspaces.py:79-125
- Installed evidence:
  - installed/workspace_plugin/shared_workspaces.py:89-101
  - installed/workspace_plugin/shared_workspaces.py:110-114
  - installed/workspace_plugin/shared_workspaces.py:173-185
- Limits:
  - Serialised local writes are not simultaneous collaborative editing or sync. Existing durable run locks still apply.

### DATA-062: Shared CRUD API composition seam

Routes expose shared project create/list/state/command/member-change and explicit private move, deriving actor from the admitted server profile rather than JSON.

- Category: Sharing
- Archived working status: `partial`
- Archived installed status: `source-present`
- Working evidence:
  - working/dashboard/plugin_api.py:177-262
  - working/tests/test_api.py:230-293
- Installed evidence:
  - installed/dashboard/plugin_api.py:177-262
- Limits:
  - Production root is unset. Shared commands expose a bounded Store subset but no import/export/backup/history/catalog/paged-search route or workflow run route.

### DATA-063: Confirmed atomic private-to-shared move

Moves only a chosen hierarchy in a dual-SQLite transaction with explicit confirmation, exact source/destination scopes and revisions and admitted editor membership.

- Category: Sharing
- Archived working status: `partial`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/shared_workspaces.py:202-240
  - working/workspace_plugin/shared_workspaces.py:247-275
  - working/dashboard/plugin_api.py:253-262
  - working/tests/test_shared_workspaces.py:127-169
- Installed evidence:
  - installed/workspace_plugin/shared_workspaces.py:202-240
  - installed/workspace_plugin/shared_workspaces.py:247-275
  - installed/dashboard/plugin_api.py:253-262
- Limits:
  - Same local filesystem, distinct Stores and ordinary rollback journals required. Root record move refuses: move its complete table. Native journals/grants and global templates do not move. No generic copy/sync or reverse move API.

### DATA-064: Move reference and ownership preservation

Move transfers supported comments, attachments, versions, recents and contained run records, retaining original thread-owner provenance; graph validation refuses split dependencies/history.

- Category: Sharing
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/shared_workspaces.py:241-268
  - working/tests/test_shared_workspaces.py:145-193
- Installed evidence:
  - installed/workspace_plugin/shared_workspaces.py:241-268
- Limits:
  - Cross-boundary relations, comment targets, referenced assets or split historical/active run scope refuse rather than pruning or widening. Retained native thread IDs do not make moved pages executable.

### DATA-065: Exact local executor selection data

Validates and stores explicit executor profile/source/thread shape only via a trusted callback with captured revision. Shared binding requires caller and executor both to be editor members.

- Category: Executor eligibility
- Archived working status: `partial`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/shared_workspaces.py:28-42
  - working/workspace_plugin/shared_workspaces.py:187-200
  - working/workspace_plugin/store.py:1224-1244
  - working/tests/test_shared_workspaces.py:195-238
- Installed evidence:
  - installed/workspace_plugin/shared_workspaces.py:28-42
  - installed/workspace_plugin/shared_workspaces.py:187-200
  - installed/workspace_plugin/store.py:1224-1244
- Limits:
  - Partial: a saved pair is inert data, never a native admission or grant. No executor binding REST route or qualified production callback exists. Hosted/remote executor sources refuse.

### DATA-066: Data owner stays separate from native authority

Workflow checks Store/native profile equality, and refuses saved executor/thread_owner metadata until a qualified binding exists; data membership alone cannot start cross-owner native edits.

- Category: Executor eligibility
- Archived working status: `partial`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/workflow.py:24-38
  - working/workspace_plugin/workflow.py:125-140
  - working/workspace_plugin/store.py:1246-1251
  - working/dashboard/plugin_api.py:187-193
- Installed evidence:
  - installed/workspace_plugin/workflow.py:24-38
  - installed/workspace_plugin/workflow.py:125-140
  - installed/workspace_plugin/store.py:1246-1251
  - installed/dashboard/plugin_api.py:187-193
- Limits:
  - Shared/cross-profile Address, native results and exact Stop routing are not qualified. Do not confuse shared data CRUD with independently selected executor support.

### DATA-067: Current and future profile default policy

A pure desktop-default policy enables unset choices unless restricted while preserving explicit opt-out; capabilities separately report missing automatic local-profile backend lifecycle support.

- Category: Availability
- Archived working status: `partial`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/shared_workspaces.py:45-49
  - working/dashboard/plugin_api.py:187-193
  - working/tests/test_shared_workspaces.py:216-221
  - working/REQUIREMENTS.md:237-248
- Installed evidence:
  - installed/workspace_plugin/shared_workspaces.py:45-49
  - installed/dashboard/plugin_api.py:187-193
- Limits:
  - Partial/requested outcome: no current/future-profile install/enable lifecycle implementation or automatic setting writes demonstrated. Pure policy is not availability acceptance.

### DATA-068: Standalone frontend sharing seams not mounted

A scoped client and profile/member/move/executor components exist, but no production frontend importer or built bundle mount was found in either captured candidate.

- Category: Sharing
- Archived working status: `partial`
- Archived installed status: `unverified`
- Working evidence:
  - working/frontend/profile-workspaces.mjs:4-121
  - working/frontend/profile-workspaces.mjs:124-138
  - working/frontend/profile-workspaces.jsx:24-96
  - working/frontend/profile-workspaces.jsx:99-146
- Installed evidence:
  - installed/dashboard/plugin_api.py:177-193
- Limits:
  - Partial, not operational sharing UI. Owner supplies navigation/draft hooks, an authenticated roster and executor bridge; shared-root capability remains false. Component source is not installed as separate frontend files and sharing symbols are absent from the installed bundle.

### DATA-069: Shared-space interchange and project backup boundary

Current file import/export and full-backup routes always select the private owner Store; the shared service has no route for importing/exporting/restoring a shared project or its membership catalog.

- Category: Sharing
- Archived working status: `partial`
- Archived installed status: `source-present`
- Working evidence:
  - working/dashboard/plugin_api.py:172-185
  - working/dashboard/plugin_api.py:220-227
  - working/dashboard/plugin_api.py:313-417
  - working/workspace_plugin/shared_workspaces.py:52-64
  - working/workspace_plugin/store.py:51
- Installed evidence:
  - installed/dashboard/plugin_api.py:172-185
  - installed/dashboard/plugin_api.py:220-227
  - installed/dashboard/plugin_api.py:313-417
  - installed/workspace_plugin/shared_workspaces.py:52-64
  - installed/workspace_plugin/store.py:51
- Limits:
  - Partial shared-space parity: canonical Store backup can represent content through trusted Python composition, but shared membership metadata and shared REST interchange are not wired. No claim that private backup protects every project.

<a id="integration-interfaces"></a>
## Plugin interfaces, read APIs and evidence boundaries

### WF-001: Native tool and lifecycle hook registration

Unified agent entrypoint registers workspace_apply plus final_run.pre_hook and post_hook. The older capture_final_proposal helper is not the registered effect path.

- Category: native-integration
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - __init__.py:6-14
  - workspace_plugin/final_run.py:59-132
  - workspace_plugin/finalization.py:206-213
- Installed evidence:
  - __init__.py:6-14
  - workspace_plugin/final_run.py:59-132
- Limits:
  - Registration source is not evidence of current live plugin loading or successful provider hook delivery.

### WF-018: Independent native tool application path retained

The retained non-finalization native workspace_apply path accepts host-bound run edits/replies and reaches the same Store transaction. Current working and installed tool schemas now explicitly describe content_edits, its revision fields, exact before/after pairs and replacement bounds instead of leaving patch wholly generic.

- Category: application
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - workspace_plugin/workflow.py:204-239,356-392
  - workspace_plugin/native.py:134-174
- Installed evidence:
  - installed/workspace_plugin/workflow.py:204-239,356-392
  - installed/workspace_plugin/native.py:134-174
- Limits:
  - This is not the ordinary authenticated UI commit path: finalization-armed runs reject asynchronous workspace_apply commits. JSON Schema advertises shape and some bounds; mutual exclusion, preimage uniqueness, overlap, canonical HTML and aggregate bounds remain runtime checks. The richer schema does not repair WF-020.

### WF-040: Matched latency/token/payload and editorial-quality proof

Both current variants implement compact model-output data while retaining full page input, but this bounded review obtained no matched model/provider-visible payload, token, latency, cost or editorial-quality measurement. Installation does not supply that missing acceptance.

- Category: performance-evidence
- Archived working status: `requested-only`
- Archived installed status: `unverified`
- Working evidence:
  - docs/ADDENDUM-WIDE-PAGE-TARGETED-COMMENT-EDITS.md:14-20
  - workspace_plugin/workflow.py:175-202
  - workspace_plugin/store.py:1370-1395
  - frontend/workflow.js:67-74,177-185
- Installed evidence:
  - installed/workspace_plugin/workflow.py:175-202
  - installed/workspace_plugin/store.py:1370-1395
- Limits:
  - Do not claim measured speedup, token/cost savings, universal smaller payloads, or no quality loss. before text duplicates preimages; input gains guidance/revision data; Store reconstructs full content and still validates/saves full state; frontend still reads /state.
  - No tests, benchmarks or model experiments were run; historical synthetic artifacts were not treated as current loaded-runtime acceptance.

### WF-041: Targeted protocol synthetic regression sources

Frozen tests describe Store exact-preservation/idempotence/rollback/stale/missing/overlap/canonical/scope/Stop/section/Restore cases, a legacy native apply fixture, and a finalization consume fixture. These demonstrate intended test coverage in source, not passing execution or real inference acceptance.

- Category: verification-evidence
- Archived working status: `source-present`
- Archived installed status: `absent`
- Working evidence:
  - tests/test_targeted_edits.py:39-127
  - tests/test_workflow.py:79-89
  - tests/test_default_native_lifecycle.py:1-7,67-103,112-124
- Installed evidence:
- Limits:
  - The installed snapshot contains targeted_edits.py and its actual callers, but no test sources: absence here refers ONLY to regression test sources, not the protocol.
  - Working test sources express intended coverage, not passing execution or provider/native-hook acceptance. No tests/imports were run. Positive-manual-revision prompt round-trip is not established by the inspected fixtures.

### DATA-008: Lightweight catalog

GET /catalog returns navigation metadata, comment counts, active runs, recents and template summaries without projecting document bodies or attachment blobs.

- Category: API
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:387-416
  - working/dashboard/plugin_api.py:269-275
  - working/tests/test_store.py:820-832
- Installed evidence:
  - installed/workspace_plugin/store.py:387-416
  - installed/dashboard/plugin_api.py:269-275
- Limits:
  - No persistent search index or cache. Metadata query still scans SQLite rows.
  - Normal WorkspaceClient.loadState still calls /state; endpoint existence does not establish end-to-end lazy loading.

### DATA-009: Lazy document and separate history reads

GET /document/{id} returns current content, comments, relevant attachments, record schema, table-row summaries and relevant runs; /history returns versions separately.

- Category: API
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/workspace_plugin/store.py:418-441
  - working/dashboard/plugin_api.py:277-291
  - working/tests/test_store.py:834-858
- Installed evidence:
  - installed/workspace_plugin/store.py:418-441
  - installed/dashboard/plugin_api.py:277-291
- Limits:
  - Detail still loads the complete Store graph internally. History requires captured scope and revision at REST boundary.
  - Current frontend state client still loads /state rather than using catalog/detail for normal loading.

### DATA-070: Standalone agent and dashboard entrypoints

Plugin manifest declares workspace_apply/hooks and local conversion dependencies; agent __init__ registers the tool/hooks, dashboard manifest mounts the API, and API module namespace is installation-rooted.

- Category: Plugin boundary
- Archived working status: `source-present`
- Archived installed status: `source-present`
- Working evidence:
  - working/plugin.yaml:1-14
  - working/__init__.py:1-14
  - working/dashboard/manifest.json:1-7
  - working/dashboard/plugin_api.py:26-40
- Installed evidence:
  - installed/plugin.yaml:1-14
  - installed/__init__.py:1-14
  - installed/dashboard/manifest.json:1-7
  - installed/dashboard/plugin_api.py:26-40
- Limits:
  - Plugin source registration is not proof that current or future profile backends/desktop halves are enabled. No Hermes core changes or centrally operated service are required by this data model.
