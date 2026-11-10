/** Qualification only: production editor + pinned public SDK controls; synthetic persistence. */
import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { RichEditor } from "../../frontend/rich-editor.jsx";
import { styles } from "../../frontend/styles.mjs";
import { anchorRange } from "../../frontend/comment-highlights.jsx";
import { comboFromEvent, actionAllowedInInput } from "@/lib/keybinds/combo";
const initial =
  "<p>Morning river observations.</p><p>Keep this closing note unchanged.</p>";
const state = {
  html: initial,
  saves: [],
  anchors: [],
  errors: [],
  registrations: 0,
  flush: null,
  locked: false,
  mounted: true,
  generation: 0,
  attachments: [],
};
let update;
function Fixture() {
  const [, render] = useState(0);
  update = () => render((n) => n + 1);
  return h(
    "main",
    { className: "ws-root", style: { height: "100vh" } },
    h("style", null, styles),
    h(
      "div",
      {
        className: "ws-work",
        style: { padding: 32, overflow: "auto", width: "100%" },
      },
      h(
        "div",
        {
          className: "ws-document",
          style: { maxWidth: 750, margin: "0 auto", padding: 0 },
        },
        h("h1", null, "River field notes"),
        state.mounted &&
          h(RichEditor, {
            key: state.generation,
            item: { id: "synthetic-lane-c", content: state.html },
            locked: state.locked,
            onSave: async (html) => {
              state.html = html;
              state.saves.push(html);
              update();
            },
            onAnchor: (anchor) => {
              state.anchors.push(anchor);
            },
            onText: () => {},
            onError: (e) => state.errors.push(e.message),
            onLink: () => {},
            registerFlush: (fn) => {
              state.flush = fn;
              return () => {
                state.flush = null;
              };
            },
            registerKeybind: () => {
              state.registrations++;
              return () => {};
            },
            comments: [],
            attachments: state.attachments,
            onImage: async (file) => {
              const bytes = new Uint8Array(await file.arrayBuffer());
              const attachment = {
                id: "synthetic-image",
                media_type: file.type,
                name: file.name,
                data_base64: btoa(String.fromCharCode(...bytes)),
              };
              state.attachments = [attachment];
              update();
              return attachment;
            },
            workspaceItems: [
              { id: "other", title: "Watering notes", kind: "page" },
            ],
          }),
        h("input", {
          "aria-label": "Outside editor",
          placeholder: "Outside editor",
        }),
      ),
    ),
  );
}
window.laneC = {
  read: () => ({
    html: state.html,
    saves: state.saves.length,
    anchors: state.anchors,
    errors: state.errors,
    registrations: state.registrations,
    attachments: state.attachments,
  }),
  reopen: async () => {
    await state.flush?.();
    state.generation++;
    update();
  },
  setHTML: async (html) => {
    await state.flush?.();
    state.html = html;
    state.generation++;
    update();
  },
  lock: (locked) => {
    state.locked = locked;
    update();
  },
  flush: () => state.flush?.(),
  unmount: () => {
    state.mounted = false;
    update();
  },
  anchorStatus: (anchor) =>
    Boolean(anchorRange(document.querySelector(".ws-editor"), anchor)),
  combo: (event) => ({
    combo: comboFromEvent(event),
    sidebarAllowed: actionAllowedInInput(
      "sidebar.toggle",
      comboFromEvent(event),
    ),
  }),
};
const fixtureRoot = createRoot(document.getElementById("app"));
window.laneC.dispose = () => fixtureRoot.unmount();
fixtureRoot.render(h(Fixture));
