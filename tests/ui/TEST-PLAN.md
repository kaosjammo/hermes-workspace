# Workspace UI qualification

The lightweight lane checks execute production exports and mounted production
React components. The HTTP smoke check uses the real FastAPI TestClient/router/SQLite
with a synthetic admission function; native HTTP authentication is excluded. The SDK fixture models host doors/components and the REST fixture
is synthetic; these checks do not qualify the native disk loader, real SDK props,
authentication, native provider/session lifecycle, layout or browser editing engine.

Run from the project root after the coordinator provisions `.local/toolchain`:

```sh
export HOME="$PWD/.local/frontend/home"
export HERMES_HOME="$PWD/.local/frontend/hermes"
export TMPDIR="$PWD/.local/frontend/tmp"
.local/toolchain/node-v26.0.0-linux-x64/bin/node tests/ui/build-runtime.mjs
.local/toolchain/node-v26.0.0-linux-x64/bin/node --test --test-isolation=none --test-reporter=tap --test-force-exit tests/ui/client.test.mjs tests/ui/dom.test.mjs tests/ui/rendered.test.mjs tests/ui/http.test.mjs
```

`--test-isolation=none` exposes named assertions in this runtime. Test harness uses
coordinator-owned React/ReactDOM/jsdom/esbuild only, with generated bundle under
`.local/frontend/`. Force exit releases React/jsdom test-only scheduler resources;
production subscriptions/timers are explicitly disposed on unmount.

## Required real-host follow-up (coordinator owned, UNRUN in UI lane)

| Requirements | Actual host observation |
|---|---|
| W-01 | Load the single ESM via native disk loader, default available within host policy; explicit Desktop On admits/enables this profile’s installed backend before nav/open, while Desktop Off removes nav and route. Verify rejection and opt-out handling without unsupported imports or loader errors. |
| W-02–03 | Create folders nested several levels, page/database, move through folder picker, reopen, inspect recents only deliberate Workspace documents; external-file control. |
| W-04 | Browser contenteditable: every heading/format/list/checklist/link/internal database link/table/image/code/quote; real undo/redo before/after autosave, paste filtering, image upload/display/reopen, edited checklist checked state. |
| W-05–06 | Document/comment arrangement, selected text anchor + whole-page composer; comment addition sends no prompt. Narrow/short pane and keyboard reachability. |
| W-07–09 | Native create/reuse/existing-thread selection/open; every unresolved including previously agent-answered, resolved excluded; exact native admission/profile and replies, scope boundaries and no auto-resolution. |
| W-10–11 | Resolve/hide/show/reopen, restore actual pre-run snapshot while editor focused; properties/schema restored, resolution unchanged. |
| W-12–13 | Current/explicit related page locks, banner/disabled formatting/title/cells/Stop/actual progress; another page remains editable; cancellation/partial save, native failure, stopped admission and interrupted recovery remain honest. |
| W-14–17 | Database-wide comments only, record docs/properties; text/number/check/date/select; rows/columns/remove/filter/sort; formulas with names/IDs and error display; relations; board group moves; reusable page/compatible record templates. |
| W-18 | Actual selected-profile REST middleware and same-profile source-swap/in-flight save/import/download; colliding item IDs rejected by expected_scope; persistence restart. |
| W-19–20 | Search title/body/table text; open matching record; Trash every kind, folder-content warning, restore, permanent-delete confirmation; no expiry. |
| W-21–24 | Real Markdown/CSV/DOCX/text PDF import (including warnings), unsupported scan rejection, original retrieval; export MD/CSV/DOCX/PDF with attachments; full backup/replace confirmation/restore/ref detachment and no auto-run. |

Also cover empty/loading/backend-disabled/error/409/conflict/failed-save Retry,
profile switching with a pending save or file read, in-flight route change during
native thread selection, poll/status failure with Stop and explicit Recover document still available; recovery
confirmation preserves native UNKNOWN and does not send native cancellation, keyboard
focus/dialog dismissal, theme switching, 600px/short panes and zoom. React fixture
selection controls use native selects solely for test interaction; native Radix
Select/Dialog accessibility belongs to actual-host checks.

## Backend toggle regression

`backend-activation.test.mjs` and `backend-registration.test.mjs` exercise production activation and registration through a synthetic public SDK, including scoped enable/readback, refusal and late disposal. They do not establish native toggle execution, future-profile installation or live bundle activation. Broader UI failures remain separate from this scoped change.
