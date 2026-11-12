import {frontendRuntime} from './runtime-path.mjs';
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../.local/toolchain/package.json", import.meta.url));
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div>');
for (const key of ["window", "document", "HTMLElement", "Node", "Event", "MouseEvent", "MutationObserver"])
  globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement: h, createRoot, act, useDocumentWidth } = await import(frontendRuntime('ui-runtime.mjs'));
const values = new Map();
const storage = { get: (k, fallback) => values.has(k) ? values.get(k) : fallback, set: (k, v) => values.set(k, v) };
let root = createRoot(document.querySelector("#app"));
const owner = (profile = "default", epoch = 1) => JSON.stringify(["local", profile, epoch]);
function Probe({ profile = "default", scope = "private-a", item = "page-a", epoch = 1, store = storage }) {
  const pref = useDocumentWidth(store, owner(profile, epoch), scope, item);
  return h("button", { onClick: pref.toggle, "aria-pressed": pref.wide }, pref.error || String(pref.wide));
}
const render = async props => act(async () => root.render(h(Probe, props)));
const click = async () => act(async () => document.querySelector("button").click());
after(async () => { await act(async () => root.unmount()); dom.window.close(); });
test("width is per document/source/scope, survives remount and epoch, and restores normal", async () => {
  await render({}); assert.equal(document.querySelector("button").textContent, "false");
  await click(); assert.equal(document.querySelector("button").getAttribute("aria-pressed"), "true");
  await render({ item: "page-b" }); assert.equal(document.querySelector("button").textContent, "false");
  await render({ profile: "other" }); assert.equal(document.querySelector("button").textContent, "false");
  await render({ scope: "replacement" }); assert.equal(document.querySelector("button").textContent, "false");
  await act(async () => root.unmount()); root = createRoot(document.querySelector("#app"));
  await render({ epoch: 2 }); assert.equal(document.querySelector("button").textContent, "true");
  await click(); assert.equal(document.querySelector("button").textContent, "false");
  await render({ item: "page-b" }); await render({}); assert.equal(document.querySelector("button").textContent, "false");
});
test("unavailable local storage keeps a usable view and reports nonpersistent change", async () => {
  const broken = { get() { throw Error("unavailable"); }, set() { throw Error("quota"); } };
  await render({ store: broken, item: "failure" });
  await click(); assert.equal(document.querySelector("button").getAttribute("aria-pressed"), "true");
  assert.match(document.querySelector("button").textContent, /preference could not be saved/);
  assert.ok([...values.keys()].every(key => !key.includes("failure")), "failed preference never enters saved storage");
});
