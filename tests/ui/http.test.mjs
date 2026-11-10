import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { WorkspaceClient } from "../../frontend/client.mjs";
import { propertyPatch } from "../../frontend/database.mjs";
const owner = mkdtempSync(path.resolve(".local/frontend/http-profile-"));
const rest = async (url, options) => {
  const result = spawnSync(
    path.resolve(".local/qualification-venv/bin/python"),
    ["tests/ui/api-bridge.py"],
    {
      cwd: process.cwd(),
      input:
        JSON.stringify({
          path: url,
          method: options?.method ?? "GET",
          body: options?.body,
        }) + "\n",
      env: {
        ...process.env,
        HOME: path.resolve(".local/frontend/home"),
        HERMES_HOME: owner,
        TMPDIR: path.resolve(".local/frontend/tmp"),
        UI_TEST_OWNER: owner,
        PYTHONDONTWRITEBYTECODE: "1",
      },
      encoding: "utf8",
      timeout: 5000,
    },
  );
  assert.equal(
    result.status,
    0,
    `${url} ${options?.body?.op ?? ""}: ${result.stderr}`,
  );
  const response = JSON.parse(result.stdout);
  if (response.status >= 400)
    throw new Error(`${response.status}: ${response.body.detail}`);
  return response.body;
};
test("production UI client -> production HTTP router -> profile Store roundtrip preserves hierarchy, typed row/formula, comments, template and attachment", async () => {
  const client = new WorkspaceClient({ rest }, () => [
    "local",
    "synthetic-http",
    1,
  ]);
  await client.load();
  const folder = await client.command("create_item", {
    kind: "folder",
    title: "Folder",
  });
  const sub = await client.command("create_item", {
    kind: "folder",
    title: "Nested",
    parent_id: folder.id,
  });
  const page = await client.command("create_item", {
    kind: "page",
    title: "Page",
    parent_id: sub.id,
    content: "<h2>Actual rich content</h2><p>Search needle</p>",
  });
  await client.command("open_item", { id: page.id });
  const db = await client.command("create_item", {
    kind: "database",
    title: "Tasks",
    parent_id: folder.id,
  });
  await client.command("set_columns", {
    id: db.id,
    columns: [
      { id: "n", name: "Count", type: "number" },
      {
        id: "status",
        name: "Status",
        type: "select",
        options: ["Todo", "Done"],
      },
      { id: "twice", name: "Double", type: "formula", formula: "n * 2" },
    ],
  });
  const row = await client.command("create_item", {
    kind: "record",
    database_id: db.id,
    title: "Record",
    properties: { n: 3, status: "Todo" },
  });
  await client.command("update_item", (latest) =>
    propertyPatch(latest, row.id, "status", "Done"),
  );
  const record = client.snapshot().items.find((i) => i.id === row.id);
  assert.equal(record.properties.n, 3);
  assert.equal(record.properties.twice, 6);
  assert.equal(record.properties.status, "Done");
  const comment = await client.command("add_comment", {
    item_id: page.id,
    text: "Please clarify",
    anchor: { quote: "Search needle", prefix: "", suffix: "" },
  });
  await client.command("reply_comment", { id: comment.id, text: "A reply" });
  assert.equal(client.snapshot().comments[0].resolved, false);
  await client.command("resolve_comment", { id: comment.id, resolved: true });
  const template = await client.command("save_template", {
    item_id: page.id,
    name: "Reusable",
  });
  const copy = await client.command("apply_template", {
    template_id: template.id,
    title: "Copy",
  });
  assert.match(copy.content, /Actual rich content/);
  assert.equal(
    client.snapshot().comments.filter((c) => c.item_id === copy.id).length,
    0,
  );
  const attachment = await client.command("add_attachment", {
    item_id: page.id,
    name: "image.png",
    media_type: "image/png",
    data_base64:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6fP4AAAAASUVORK5CYII=",
  });
  await client.command("update_item", {
    id: page.id,
    patch: {
      content: `<p><img src="attachment:${attachment.id}" alt="image"></p>`,
    },
  });
  assert.match(
    client.snapshot().items.find((i) => i.id === page.id).content,
    /attachment:/,
  );
  await client.command("trash", { id: folder.id });
  assert.ok(client.snapshot().items.find((i) => i.id === page.id).deleted_at);
  await client.command("restore", { id: folder.id });
  assert.equal(
    client.snapshot().items.find((i) => i.id === page.id).deleted_at,
    null,
  );
  const reopened = new WorkspaceClient({ rest }, () => [
    "local",
    "synthetic-http",
    1,
  ]);
  await reopened.load();
  assert.equal(reopened.snapshot().scope_id, client.snapshot().scope_id);
  assert.ok(
    reopened.snapshot().attachments.find((a) => a.id === attachment.id),
  );
  assert.equal(reopened.snapshot().comments[0].resolved, true);
});
