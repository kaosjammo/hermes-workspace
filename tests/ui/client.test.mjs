import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WorkspaceClient,
  StaleWorkspaceError,
} from "../../frontend/client.mjs";
import { locateAnchor, visibleComments } from "../../frontend/editor.mjs";
import { tableRows, boardGroups } from "../../frontend/database.mjs";
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const state = (revision = 1) => ({
  scope_id: "synthetic-a",
  revision,
  items: [],
  comments: [],
  runs: [],
  versions: [],
  attachments: [],
  recents: [],
  templates: [],
});
test("production command queue uses current revision and never emits a queued write after profile activation changes", async () => {
  let owner = "a";
  let epoch = 1;
  const wait = deferred();
  const calls = [];
  const client = new WorkspaceClient(
    {
      rest: async (path, options) => {
        calls.push([path, options]);
        if (calls.length === 1) return wait.promise;
        return { result: {}, state: state(3) };
      },
    },
    () => [owner, epoch],
  );
  client.accept(state());
  const one = client.command("create_item", { kind: "page", title: "One" });
  const two = client.command("create_item", { kind: "page", title: "Two" });
  await Promise.resolve();
  owner = "b";
  epoch = 2;
  wait.resolve({ result: { id: "a" }, state: state(2) });
  await assert.rejects(one, StaleWorkspaceError);
  await assert.rejects(two, StaleWorkspaceError);
  assert.equal(calls.length, 1);
  assert.equal(client.snapshot().revision, 1);
});
test("production queue serializes revision and ignores stale GET snapshot", async () => {
  const revisions = [];
  let rev = 4;
  const client = new WorkspaceClient(
    {
      rest: async (_, options) => {
        revisions.push(options.body.payload.expected_revision);
        return { result: { id: "p" }, state: state(++rev) };
      },
    },
    () => ["a", 1],
  );
  client.accept(state(4));
  await Promise.all([
    client.command("update_item", { id: "p", patch: { title: "First" } }),
    client.command("update_item", { id: "p", patch: { title: "Second" } }),
  ]);
  assert.deepEqual(revisions, [4, 5]);
  client.accept(state(3));
  assert.equal(client.snapshot().revision, 6);
});
test("failed authoritative save stays failed and subsequent commands still work", async () => {
  let fail = true;
  const client = new WorkspaceClient(
    {
      rest: async () => {
        if (fail) throw new Error("409 conflict");
        return { result: 1, state: state(2) };
      },
    },
    () => ["a", 1],
  );
  client.accept(state());
  await assert.rejects(
    client.command("update_item", { id: "p", patch: { content: "draft" } }),
    /409/,
  );
  assert.equal(client.snapshot().revision, 1);
  fail = false;
  assert.equal(await client.command("open_item", { id: "p" }), 1);
});
test("anchors detach when missing or ambiguous; contextual duplicates locate precisely", () => {
  assert.equal(
    locateAnchor("one quote two quote", { quote: "quote" }).status,
    "detached",
  );
  assert.equal(locateAnchor("changed", { quote: "quote" }).status, "detached");
  assert.deepEqual(
    locateAnchor("one quote two quote", {
      quote: "quote",
      prefix: "two ",
      suffix: "",
    }),
    { status: "attached", start: 14, end: 19 },
  );
  assert.deepEqual(
    visibleComments(
      [
        { id: "a", resolved: false, replies: [{ author: "agent" }] },
        { id: "b", resolved: true },
      ],
      false,
    ).map((c) => c.id),
    ["a"],
  );
});
test("typed sorting filters and board groups operate on actual records without mutating source", () => {
  const rows = [
    { id: "a", title: "A", properties: { n: 10, status: "Done" } },
    { id: "b", title: "B", properties: { n: 2, status: "Todo" } },
  ];
  assert.deepEqual(
    tableRows(rows, [{ id: "n", type: "number" }], {
      sort: "n",
      direction: "asc",
      filter: "",
    }).map((r) => r.id),
    ["b", "a"],
  );
  assert.deepEqual(
    tableRows(rows, [], { filter: "todo" }).map((r) => r.id),
    ["b"],
  );
  assert.equal(
    boardGroups(rows, { id: "status", options: ["Todo", "Done", "Later"] }).get(
      "Later",
    ).length,
    0,
  );
  assert.equal(rows[0].id, "a");
});
test("production writes require a loaded scope and forward exactly the captured scope", async () => {
  const calls = [];
  const client = new WorkspaceClient(
    {
      rest: async (path, opts) => {
        calls.push({ path, opts });
        return { result: 1, state: state(2) };
      },
    },
    () => ["a", 1],
  );
  await assert.rejects(
    client.command("create_item", { kind: "page", title: "No scope" }),
    /Load Workspace/,
  );
  assert.equal(calls.length, 0);
  assert.throws(
    () => client.accept({ ...state(), scope_id: undefined }),
    /invalid state/,
  );
  client.accept(state());
  await client.command("create_item", { kind: "page", title: "Scoped" });
  await client.transfer("/import", { name: "page.md", data_base64: "YWJj" });
  assert.equal(calls[0].opts.body.expected_scope, "synthetic-a");
  assert.equal(calls[1].opts.body.expected_scope, "synthetic-a");
});

test("queued and in-flight writes retain captured storage scope even if same-source item IDs collide", async () => {
  const wait = deferred(),
    calls = [];
  const client = new WorkspaceClient(
    {
      rest: async (path, opts) => {
        calls.push(opts);
        return wait.promise;
      },
    },
    () => ["same-route", 1],
  );
  client.accept(state());
  const first = client.command("update_item", {
    id: "same-id",
    patch: { content: "original" },
  });
  const queued = client.command("update_item", {
    id: "same-id",
    patch: { content: "queued" },
  });
  await Promise.resolve();
  client.accept({ ...state(100), scope_id: "replacement" });
  wait.resolve({ result: {}, state: state(2) });
  await assert.rejects(first, StaleWorkspaceError);
  await assert.rejects(queued, StaleWorkspaceError);
  assert.equal(calls.length, 1);
  assert.equal(client.snapshot().scope_id, "replacement");
});
test("late GET cannot rebind a newer same-route storage scope", async () => {
  const wait = deferred();
  const client = new WorkspaceClient({ rest: async () => wait.promise }, () => [
    "same-route",
    1,
  ]);
  client.accept(state());
  const pending = client.load();
  client.accept({ ...state(0), scope_id: "replacement" });
  wait.resolve(state(10));
  await assert.rejects(pending, StaleWorkspaceError);
  assert.equal(client.snapshot().scope_id, "replacement");
});
test("a retired same-owner client's late GET remains fenced from a fresh client", async () => {
  const wait = deferred();
  const owner = () => ["same-route", "synthetic-profile", 1];
  const retired = new WorkspaceClient({ rest: () => wait.promise }, owner);
  const pending = retired.load();
  retired.dispose();
  const current = new WorkspaceClient({ rest: async () => state(7) }, owner);
  await current.load();
  wait.resolve(state(20));
  await assert.rejects(pending, StaleWorkspaceError);
  assert.equal(retired.current(), false);
  assert.equal(retired.snapshot(), null);
  assert.equal(current.current(), true);
  assert.equal(current.snapshot().revision, 7);
});
