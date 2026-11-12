import {frontendRuntime} from './runtime-path.mjs';
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div>', {
  url: "https://workspace.test",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "Node",
  "FileReader",
  "Blob",
  "File",
  "Event",
  "MouseEvent",
])
  globalThis[key] = dom.window[key];
globalThis.getSelection = () => dom.window.getSelection();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {
  Workspace,
  createElement: h,
  createRoot,
  act,
} = await import(frontendRuntime('ui-runtime.mjs'));
const root = createRoot(document.querySelector("#app"));
const tick = async () => act(() => new Promise((r) => setTimeout(r, 15)));
const button = (t) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === t);
const click = async (t) => {
  const scope = document.querySelector("[role=dialog]") ?? document;
  const target = [...scope.querySelectorAll("button")].find(
    (b) => b.textContent === t,
  );
  assert.ok(target, t);
  await act(async () => target.click());
  await tick();
};
const state = {
  scope_id: "ui-restore-scope",
  revision: 7,
  items: [],
  comments: [],
  attachments: [],
  runs: [],
  versions: [],
  templates: [],
  recents: [],
};
async function selectBackup() {
  const input = document.querySelector('input[accept=".zip,.json"]');
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["synthetic archive"], "backup.zip")],
  });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
  await tick();
  await tick();
  assert.match(document.body.textContent, /Replace Workspace from backup/);
}
test("known commit dismisses replacement confirmation even when full load fails; retry is GET only", async () => {
  const calls = [];
  let committed = false,
    readFails = true;
  const ctx = {
    rest: async (p, o) => {
      calls.push({ p, o });
      if (p === "/state") {
        if (committed && readFails) throw Error("read unavailable");
        return structuredClone({ ...state, revision: committed ? 8 : 7 });
      }
      if (p === "/restore-backup") {
        committed = true;
        return {
          restore_id: o.body.restore_id,
          status: "committed",
          result: { restored: true, scope_id: state.scope_id },
        };
      }
    },
  };
  await act(async () => root.render(h(Workspace, { ctx })));
  await tick();
  await selectBackup();
  await click("Replace Workspace");
  assert.equal(Boolean(document.querySelector("[role=dialog]")), false);
  assert.match(
    document.body.textContent,
    /Restore completed, but Workspace could not be loaded/,
  );
  assert.equal(button("New page").disabled, true);
  readFails = false;
  await click("Load replaced Workspace");
  assert.match(document.body.textContent, /Workspace restored/);
  assert.equal(button("New page").disabled, false);
  assert.equal(calls.filter((x) => x.p === "/restore-backup").length, 1);
  await act(async () => root.render(null));
});
test("unknown delivery shows uncertainty and explicit inspect/use-current, never repeats destructive POST", async () => {
  const calls = [];
  const ctx = {
    rest: async (p, o) => {
      calls.push({ p, o });
      if (p === "/state") return structuredClone(state);
      throw Error("404 receipt missing after restart");
    },
  };
  await act(async () => root.render(h(Workspace, { ctx })));
  await tick();
  await selectBackup();
  await click("Replace Workspace");
  assert.match(document.body.textContent, /replacement outcome is unknown/);
  assert.equal(button("Restore backup").disabled, true);
  assert.equal(button("Use current Workspace (outcome unknown)"), undefined);
  await click("Inspect current Workspace");
  assert.match(
    document.body.textContent,
    /does not confirm the replacement outcome/,
  );
  await click("Use current Workspace (outcome unknown)");
  assert.equal(Boolean(document.querySelector("[role=dialog]")), false);
  assert.match(
    document.body.textContent,
    /replacement outcome remains unknown/,
  );
  assert.doesNotMatch(document.body.textContent, /Workspace restored/);
  assert.equal(button("New page").disabled, false);
  assert.equal(calls.filter((x) => x.p === "/restore-backup").length, 1);
  assert.equal(
    calls.filter((x) => x.p.startsWith("/restore-status/")).length,
    1,
  );
  await act(async () => root.render(null));
});
after(async () => {
  await act(async () => root.unmount());
  dom.window.close();
});
