import { test } from "node:test";
import assert from "node:assert/strict";
import { folderDestinations } from "../../frontend/folder-destinations.mjs";

const folder = (id, title, parent_id = null, extra = {}) =>
  ({ id, title, parent_id, kind: "folder", ...extra });
const items = [
  folder("projects", "Projects"),
  folder("areas", "Areas"),
  folder("book", "Book One", "novel"),
  folder("novel", "Novel", "projects"),
  folder("website", "Website", "projects"),
  folder("draft-a", "Drafts", "book"),
  folder("draft-b", "Drafts", "website"),
  folder("deleted", "Trashed", null, { deleted_at: "2026-11-10" }),
  folder("hidden-child", "Hidden child", "deleted"),
  { id: "page", title: "Document", kind: "page", parent_id: "website" },
];

test("destinations preserve sidebar hierarchy despite interleaved storage order", () => {
  const options = folderDestinations(items, "page");
  assert.deepEqual(options.map(([id]) => id),
    ["", "projects", "novel", "book", "draft-a", "website", "draft-b", "areas"]);
  assert.deepEqual(options.slice(1).map(([, , hierarchy]) => hierarchy.depth),
    [1, 2, 3, 4, 2, 3, 1]);
  assert.equal(options.find(([id]) => id === "draft-a")[2].path,
    "Workspace root / Projects / Novel / Book One / Drafts");
  assert.equal(options.find(([id]) => id === "draft-b")[2].path,
    "Workspace root / Projects / Website / Drafts");
});

test("moving a folder excludes its entire subtree, retaining its parent and siblings", () => {
  assert.deepEqual(folderDestinations(items, "novel").map(([id]) => id),
    ["", "projects", "website", "draft-b", "areas"]);
  assert.deepEqual(folderDestinations(items, "projects").map(([id]) => id),
    ["", "areas"]);
  assert.deepEqual(folderDestinations([], "page"), [["", "Workspace root"]]);
});
