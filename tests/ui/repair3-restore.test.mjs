import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WorkspaceClient,
  StaleWorkspaceError,
} from "../../frontend/client.mjs";
const state = (revision = 7) => ({
  scope_id: "owner-scope",
  revision,
  items: [],
  comments: [],
  runs: [],
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { resolve, promise };
};
test("compact restore commit invalidates old reads and writes until explicit authoritative reload", async () => {
  const old = deferred(),
    calls = [];
  let reads = 0;
  const c = new WorkspaceClient(
    {
      rest: async (p, o) => {
        calls.push({ p, o });
        if (p === "/state") return ++reads === 1 ? old.promise : state(8);
        return {
          restore_id: o.body.restore_id,
          status: "committed",
          result: { restored: true, scope_id: "owner-scope" },
        };
      },
    },
    () => ["connection", "profile", 1],
  );
  c.accept(state());
  const pending = c.load();
  const ticket = c.captureRestore();
  const reply = await c.restoreBackup(ticket, "archive");
  assert.equal(reply.status, "committed");
  assert.equal(c.snapshot(), null);
  old.resolve(state(7));
  await assert.rejects(pending, StaleWorkspaceError);
  await assert.rejects(c.command("update_item"), /Load Workspace|replacement/);
  const post = calls.find((x) => x.p === "/restore-backup");
  assert.equal(post.o.body.include_state, false);
  assert.equal(post.o.body.expected_revision, 7);
  assert.equal(post.o.body.expected_scope, "owner-scope");
  assert.match(post.o.body.restore_id, /^[a-f0-9]{32}$/);
  assert.ok(post.o.timeoutMs > 30000);
  await c.reloadRestore(ticket);
  assert.equal(c.snapshot().revision, 8);
});
test("lost commit response only reads scoped receipt; reload error cannot repeat replacement", async () => {
  const calls = [];
  let badRead = true;
  const c = new WorkspaceClient(
    {
      rest: async (p, o) => {
        calls.push({ p, o });
        if (p === "/restore-backup")
          throw Error("connection lost after commit");
        if (p.startsWith("/restore-status/"))
          return {
            restore_id: ticket.restore_id,
            status: "committed",
            result: { restored: true, scope_id: "owner-scope" },
          };
        if (badRead) throw Error("read unavailable");
        return state(8);
      },
    },
    () => ["connection", "profile", 1],
  );
  c.accept(state());
  const ticket = c.captureRestore();
  assert.equal((await c.restoreBackup(ticket, "archive")).status, "committed");
  await assert.rejects(c.reloadRestore(ticket), /read unavailable/);
  assert.equal(c.snapshot(), null);
  badRead = false;
  await c.reloadRestore(ticket);
  assert.equal(calls.filter((x) => x.p === "/restore-backup").length, 1);
  assert.equal(
    calls.filter((x) => x.p.startsWith("/restore-status/")).length,
    1,
  );
  assert.ok(calls[1].p.endsWith("?expected_scope=owner-scope"));
});
test("unknown receipt is explicit, never retries POST, and profile/epoch changes reject pending status publication", async () => {
  let owner = ["a", "default", 1];
  const status = deferred(),
    calls = [];
  const c = new WorkspaceClient(
    {
      rest: async (p) => {
        calls.push(p);
        if (p === "/restore-backup") throw Error("lost");
        return status.promise;
      },
    },
    () => owner,
  );
  c.accept(state());
  const ticket = c.captureRestore();
  const restore = c.restoreBackup(ticket, "archive");
  await new Promise((r) => setImmediate(r));
  owner = ["a", "other", 2];
  status.resolve({ restore_id: ticket.restore_id, status: "committed" });
  await assert.rejects(restore, StaleWorkspaceError);
  assert.equal(c.snapshot(), null);
  assert.equal(calls.length, 2);
  const d = new WorkspaceClient(
    {
      rest: async () => {
        throw Error("404 receipt unknown after restart");
      },
    },
    () => ["a", "default", 1],
  );
  d.accept(state());
  const t = d.captureRestore();
  assert.equal((await d.restoreBackup(t, "archive")).status, "unknown");
  assert.equal(d.snapshot(), null);
});
test("confirmation revision and queued commands cannot cross a replacement boundary", async () => {
  let calls = 0;
  const c = new WorkspaceClient(
    {
      rest: async () => {
        calls++;
        return { status: "committed" };
      },
    },
    () => ["a", "default", 1],
  );
  c.accept(state());
  const stale = c.captureRestore();
  c.accept(state(8));
  await assert.rejects(c.restoreBackup(stale, "archive"), StaleWorkspaceError);
  assert.equal(calls, 0);
  const ticket = c.captureRestore();
  const restore = c.restoreBackup(ticket, "archive");
  const write = c.command("update_item");
  await restore;
  await assert.rejects(write, /Load Workspace|replacement|source changed/);
  assert.equal(calls, 1);
});

test("explicit unknown readback retains uncertainty and fresh revision fences the next import and edit", async () => {
  const calls = [];
  const c = new WorkspaceClient(
    {
      rest: async (p, o) => {
        calls.push({ p, o });
        if (p === "/restore-backup" || p.startsWith("/restore-status/"))
          throw Error("receipt unavailable");
        if (p === "/state") return state(9);
        return { result: {}, state: state(10) };
      },
    },
    () => ["connection", "profile", 1],
  );
  c.accept(state());
  const ticket = c.captureRestore();
  const receipt = await c.restoreBackup(ticket, "archive");
  assert.equal(receipt.status, "unknown");
  const inspected = await c.inspectRestore(ticket);
  assert.equal(inspected.revision, 9);
  assert.equal(c.snapshot(), null);
  await c.reloadRestore(ticket);
  assert.equal(receipt.status, "unknown");
  await c.transfer("/import", { name: "fresh.md", data_base64: "YWJj" });
  assert.equal(
    calls.find((x) => x.p === "/import").o.body.expected_revision,
    9,
  );
  await c.command("update_item", { id: "page" });
  assert.equal(
    calls.find((x) => x.p === "/command").o.body.payload.expected_revision,
    10,
  );
  assert.equal(
    calls.find((x) => x.p === "/restore-backup").o.body.expected_revision,
    7,
  );
  assert.equal(calls.filter((x) => x.p === "/restore-backup").length, 1);
});

test("late authoritative restore load cannot publish after profile switch or dispose", async () => {
  for (const dispose of [false, true]) {
    const wait = deferred();
    let owner = ["a", "default", 1];
    const c = new WorkspaceClient(
      {
        rest: async (p, o) =>
          p === "/state"
            ? wait.promise
            : {
                restore_id: o.body.restore_id,
                status: "committed",
                result: { scope_id: "owner-scope" },
              },
      },
      () => owner,
    );
    c.accept(state());
    const ticket = c.captureRestore();
    await c.restoreBackup(ticket, "archive");
    const load = c.reloadRestore(ticket);
    if (dispose) c.dispose();
    else owner = ["a", "other", 2];
    wait.resolve(state(20));
    await assert.rejects(load, StaleWorkspaceError);
    assert.equal(c.snapshot(), null);
  }
});
