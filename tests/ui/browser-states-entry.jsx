// Render-only test contribution. Never packaged or installed into a real profile.
import { createElement as h, useState } from "react";
import { Workspace } from "../../frontend/workspace.jsx";
import { FormDialog, Button } from "../../frontend/ui.jsx";
import { ScopeReviewDialog } from "../../frontend/scope-review.jsx";
import { styles } from "../../frontend/styles.mjs";
import { nativeCalls } from "./sdk-fixture.jsx";
const page = {
  id: "synthetic-page",
  kind: "page",
  title: "Review the garden plan",
  parent_id: null,
  database_id: null,
  content:
    '<h2>A considered beginning</h2><p>Keep the young trees shaded until their roots settle.</p><p><input type="checkbox"> Review the watering plan</p>',
  properties: {},
  columns: [],
  thread_id: null,
};
const other = {
  ...page,
  id: "synthetic-related",
  title: "Watering notes",
  content: "<p>Water deeply in the morning.</p>",
};
const database = {
  ...page, id: "synthetic-database", kind: "database", title: "Garden review tasks", content: "",
  columns: [
    { id: "status", name: "Status", type: "select", options: ["Planned", "In progress", "Done", "Awaiting", "Deferred"] },
    { id: "hours", name: "Hours", type: "number" },
    { id: "ready", name: "Ready", type: "checkbox" },
    { id: "due", name: "Due", type: "date" },
    { id: "notes", name: "Notes", type: "text" },
    { id: "plant", name: "Plant", type: "relation", target_database_id: "synthetic-nursery" },
    { id: "estimate", name: "Estimate", type: "formula", formula: 'col("Hours") * 2' },
  ],
};
const record = {
  ...page, id: "synthetic-record", kind: "record", title: "Review the shade cover", database_id: database.id,
  content: '<h2>Review notes</h2><p>Inspect the shade cloth before noon.</p><p><input type="checkbox"> Check the ties</p>',
  properties: { status: "Planned", hours: 4, ready: false, due: "2026-11-20", notes: "Keep the trunk clear", plant: ["synthetic-plant"], estimate: 8 },
};
const nursery = { ...database, id: "synthetic-nursery", title: "Review nursery", columns: [] };
const plant = { ...record, id: "synthetic-plant", title: "River mint", database_id: nursery.id, properties: {} };
let state = {
  scope_id: "synthetic-ui-states",
  revision: 1,
  items: [page, other, database, record, nursery, plant],
  comments: [
    {
      id: "synthetic-comment",
      item_id: page.id,
      text: "Clarify the planting sequence.",
      anchor: null,
      resolved: false,
      replies: [],
      target_item_ids: [other.id],
    },
    {
      id: "synthetic-answered",
      item_id: page.id,
      text: "Review the watering schedule.",
      anchor: null,
      resolved: false,
      replies: [
        {
          id: "synthetic-reply",
          author: "agent",
          text: "An earlier reply; still unresolved.",
        },
      ],
      target_item_ids: [],
    },
    {
      id: "synthetic-resolved",
      item_id: page.id,
      text: "Completed review.",
      anchor: null,
      resolved: true,
      replies: [],
      target_item_ids: [],
    },
  ],
  runs: [],
  versions: [],
  templates: [],
  attachments: [],
  recents: [],
};
const calls = [];
let statusFailure = false;
const clone = () => structuredClone(state);
function run() {
  return state.runs.at(-1);
}
async function rest(path, options = {}) {
  const body = options.body ?? {};
  calls.push({ path, body: structuredClone(body) });
  if (statusFailure && (path === "/workflow/consume" || path === "/workflow/status"))
    throw Error("Synthetic native-owner status diagnostic; real provider lifecycle is not exercised.");
  if (path === "/state") return clone();
  if (path === "/command") {
    const { op, payload } = body;
    if (op === "open_item") {
      state.recents = [payload.id];
    } else if (op === "update_item") {
      Object.assign(
        state.items.find((i) => i.id === payload.id),
        payload.patch,
      );
    } else if (op === "restore_version") {
      const v = state.versions.find((v) => v.id === payload.id);
      Object.assign(
        state.items.find((i) => i.id === v.item_id),
        v.snapshot,
      );
    } else if (op === "resolve_comment")
      state.comments.find((c) => c.id === payload.id).resolved =
        payload.resolved;
    else if (op === "reply_comment")
      state.comments
        .find((c) => c.id === payload.id)
        .replies.push({
          id: "synthetic-user-reply",
          author: "user",
          text: payload.text,
        });
    else throw Error("Unsupported fixture command " + op);
    state.revision++;
    return { result: {}, state: clone() };
  }
  if (path === "/workflow/bind") {
    page.thread_id = body.thread_id;
    state.revision++;
    return { item: structuredClone(page) };
  }
  if (path === "/workflow/prepare") {
    const captured = state.comments
      .filter((c) => c.item_id === page.id && !c.resolved)
      .map((c) => c.id);
    const version = {
      id: `synthetic-version-${state.versions.length + 1}`,
      item_id: page.id,
      created_at: "2026-11-08T00:00:00Z",
      snapshot: structuredClone(page),
    };
    state.versions.push(version);
    page.thread_id = body.session_id;
    state.runs.push({
      id: `synthetic-run-${state.runs.length + 1}`,
      item_id: page.id,
      session_id: body.session_id,
      status: "running",
      comment_ids: captured,
      allowed_item_ids: [page.id, ...body.explicit_item_ids],
      progress:
        "Reviewing two unresolved comments. Synthetic transport fixture.",
      version_ids: [version.id],
    });
    state.revision++;
    return {
      run: structuredClone(run()),
      prompt: "Synthetic UI state exercise only",
      submission_id: run().id,
    };
  }
  if (path === "/workflow/consume" || path === "/workflow/status")
    return { run: structuredClone(run()), native_terminal: "UNKNOWN" };
  if (path === "/workflow/stop") {
    run().status = "cancelled";
    run().progress = "Stopped; saved partial changes retained";
    state.revision++;
    return { run: structuredClone(run()) };
  }
  if (path === "/workflow/recover") {
    run().status = "error";
    run().error =
      "Explicit recovery revoked Workspace authority. Native outcome remains unknown.";
    state.revision++;
    return { run: structuredClone(run()), native_terminal: "UNKNOWN" };
  }
  throw Error("Unsupported fixture path " + path);
}
const storage = new Map();
// Real public SDK controls with explicitly delayed synthetic submissions. This
// route exercises accessibility while pending without running an agent/provider.
function PendingControls() {
  const [dialog, setDialog] = useState(null);
  const [outcome, setOutcome] = useState("Ready");
  function submit(selected) {
    pendingFixture.calls.push({ dialog, selected });
    return new Promise((resolve, reject) => {
      pendingFixture.resolve = () => { setOutcome("Saved"); resolve(); };
      pendingFixture.reject = () => reject(Error("Synthetic delayed submission failed"));
    });
  }
  return h("div", { className: "ws-root", style: { padding: 24 } },
    h("style", null, styles),
    h("h1", null, "Pending control qualification"),
    h("p", null, "Actual Hermes SDK controls; delayed synthetic submissions only."),
    h(Button, { onClick: () => setDialog("form") }, "Open confirmation"),
    h(Button, { onClick: () => setDialog("scope") }, "Open scope review"),
    h("p", { role: "status" }, outcome),
    dialog === "form" && h(FormDialog, { title: "Confirm local change", confirm: "Save local change", onSubmit: submit, onClose: () => setDialog(null) }),
    dialog === "scope" && h(ScopeReviewDialog, {
      review: { targets: [{ id: "extra", label: "Watering notes", available: true, comments: [{ id: "reference", text: "A reference is not edit permission." }] }] },
      currentTitle: "Garden plan", currentId: "current", currentThreadId: null,
      onSubmit: submit, onClose: () => setDialog(null),
    }));
}
const pendingFixture = { calls: [] };
window.__workspacePendingFixture = pendingFixture;
window.__workspaceUiFixture = {
  failStatus: () => { statusFailure = true; },
  clearStatusFailure: () => { statusFailure = false; },
  read: () => ({
    state: clone(),
    calls: structuredClone(calls),
    nativeCalls: structuredClone(nativeCalls),
  }),
  partial: () => {
    page.content =
      "<h2>A considered beginning</h2><p>A saved partial change. Review before keeping it.</p>";
    run().status = "error";
    run().error =
      "Synthetic connection loss after a partial save; native outcome unknown.";
    state.revision++;
  },
  lockDatabase: () => {
    state.runs.push({ id: "synthetic-database-lock", item_id: database.id, session_id: "thread-existing", status: "running",
      allowed_item_ids: [database.id, record.id], comment_ids: [], progress: "Synthetic database/record lock; no native inference." });
    state.revision++;
  },
};
export default {
  id: "workspace-ui-states",
  name: "Workspace UI states (synthetic transport)",
  defaultEnabled: true,
  register(ctx) {
    ctx.register({ id: "pending-controls", area: "routes", data: { path: "/workspace-ui-pending" }, render: () => h(PendingControls) });
    const testCtx = {
      rest,
      storage: {
        get: (key) => storage.get(key),
        set: (key, value) => storage.set(key, value),
        remove: (key) => storage.delete(key),
      },
      onDispose: (fn) => ctx.onDispose(fn),
      os: ctx.os,
    };
    ctx.register({
      id: "route",
      area: "routes",
      data: { path: "/workspace-ui-states" },
      render: () =>
        h(
          "div",
          {
            style: { height: "100%", display: "flex", flexDirection: "column" },
          },
          h(
            "div",
            {
              style: {
                padding: "8px 20px",
                fontSize: 12,
                color: "var(--ui-text-secondary)",
                borderBottom: "1px solid var(--ui-stroke-tertiary)",
              },
            },
            "UI qualification fixture: actual Hermes controls; synthetic native transport and data. No provider inference.",
          ),
          h(Workspace, { ctx: testCtx }),
        ),
    });
  },
};
