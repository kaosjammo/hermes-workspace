import { test, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { WorkspaceClient } from "../../frontend/client.mjs";
import { workspaceHref, sanitizeHTML } from "../../frontend/editor.mjs";
import { httpFixture } from "./http-fixture.mjs";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div>', {
  url: "https://workspace.test",
  pretendToBeVisual: true,
});
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "Node",
  "DocumentFragment",
  "MutationObserver",
  "Event",
  "MouseEvent",
  "InputEvent",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLFormElement",
  "HTMLButtonElement",
  "CustomEvent",
  "FocusEvent",
])
  globalThis[key] = dom.window[key];
globalThis.getSelection = () => dom.window.getSelection();
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {
  RecordProperties,
  Database,
  createElement: h,
  createRoot,
  act,
} = await import("../../.local/frontend/repair-1/native-runtime.mjs");
const root = createRoot(document.querySelector("#app"));
const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));
const choose = async (label, text) => {
  const parent = [...document.querySelectorAll("label")].find((n) =>
    n.querySelector(`button[aria-label="${label}"]`),
  );
  const select = parent?.querySelector("select");
  assert.ok(select, label);
  const option = [...select.options].find(option => option.textContent.trim() === text);
  assert.ok(option, `${label}: ${text}`);
  await act(async () => {
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await tick();
};
test("production table/record/board nullable clears persist and reopen through actual native controls -> HTTP -> SQLite", async () => {
  const fixture = httpFixture();
  const client = new WorkspaceClient(fixture, () => [
    "local",
    "synthetic-repair1",
    1,
  ]);
  await client.load();
  const db = await client.command("create_item", {
    kind: "database",
    title: "Tasks",
  });
  await client.command("set_columns", {
    id: db.id,
    columns: [
      { id: "s", name: "Status", type: "select", options: ["Todo", "Done"] },
      { id: "d", name: "Due", type: "date" },
      { id: "t", name: "Text", type: "text" },
    ],
  });
  const row = await client.command("create_item", {
    kind: "record",
    database_id: db.id,
    title: "Record",
    properties: { s: "Done", d: "2026-11-07", t: "value" },
  });
  let failure;
  const command = async (op, payload) => {
    try {
      return await client.command(op, payload);
    } catch (err) {
      failure = err;
      throw err;
    }
  };
  for (const surface of ["table", "record", "board"]) {
    await client.command("update_item", {
      id: row.id,
      patch: { properties: { s: "Done", d: "2026-11-07", t: "value" } },
    });
    const state = client.snapshot();
    const database = state.items.find((i) => i.id === db.id),
      item = state.items.find((i) => i.id === row.id);
    await act(async () =>
      root.render(
        h(
          "form",
          null,
          surface === "record"
            ? h(RecordProperties, {
                item,
                database,
                state,
                command,
                locked: false,
                onError: (e) => {
                  failure = e;
                },
              })
            : h(Database, {
                item: database,
                state,
                command,
                locked: false,
                confirm: () => {},
                onOpen: () => {},
                onError: (e) => {
                  failure = e;
                },
              }),
        ),
      ),
    );
    if (surface === "board") {
      await choose("View", "Board");
      await choose("Move Record", "No value");
    } else {
      await choose("Status", "No value");
      for (const label of ["Due", "Text"]) {
        const input = document.querySelector(`input[aria-label="${label}"]`);
        await act(async () => {
          input.focus();
          Object.getOwnPropertyDescriptor(
            dom.window.HTMLInputElement.prototype,
            "value",
          ).set.call(input, "");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await act(async () => input.blur());
        await tick();
      }
    }
    assert.equal(failure, undefined);
    await act(async () => root.render(null));
    const reopened = new WorkspaceClient(fixture, () => [
      "local",
      "synthetic-repair1",
      1,
    ]);
    await reopened.load();
    const props = reopened
      .snapshot()
      .items.find((i) => i.id === row.id).properties;
    assert.equal(props.s, null);
    assert.equal(props.d, surface === "board" ? "2026-11-07" : null);
    assert.equal(props.t, surface === "board" ? "value" : "");
  }
});
test("canonical editor Workspace fragment survives production Store, Markdown export, complete backup and restore", async () => {
  const fixture = httpFixture(),
    client = new WorkspaceClient(fixture, () => ["local", "synthetic-link", 1]);
  await client.load();
  const db = await client.command("create_item", {
    kind: "database",
    title: "Tasks",
  });
  const href = workspaceHref(db.id);
  const content = sanitizeHTML(`<p><a href="${href}">Tasks</a></p>`);
  const page = await client.command("create_item", {
    kind: "page",
    title: "Link page",
    content,
  });
  const exported = await client.transfer(`/export/${page.id}?format=md`);
  assert.match(
    Buffer.from(exported.data_base64, "base64").toString(),
    new RegExp(`#workspace/${db.id}`),
  );
  const backup = await client.transfer("/backup");
  assert.ok(backup.data_base64);
  const receiver = httpFixture(),
    restored = new WorkspaceClient(receiver, () => [
      "local",
      "synthetic-restored",
      1,
    ]);
  await restored.load();
  await restored.transfer("/restore-backup", {
    data_base64: backup.data_base64,
  });
  await restored.load();
  assert.match(
    restored.snapshot().items.find((i) => i.id === page.id).content,
    new RegExp(`#workspace/${db.id}`),
  );
  assert.notEqual(restored.snapshot().scope_id, client.snapshot().scope_id);
});
afterEach(async () => {
  await act(async () => root.render(null));
});
after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});
