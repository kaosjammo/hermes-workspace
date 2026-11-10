import { createElement as h } from "react";
import { ROUTES_AREA, SIDEBAR_NAV_AREA, host, gatewayActivationEpoch } from "@hermes/plugin-sdk";
import { Workspace } from "./workspace.jsx";
import { activateWorkspaceBackend } from "./backend-activation.mjs";
export default {
  id: "workspace",
  name: "Workspace",
  defaultEnabled: true,
  register(ctx) {
    return activateWorkspaceBackend(ctx, host, gatewayActivationEpoch, () => {
      ctx.register({
        id: "page",
        area: ROUTES_AREA,
        data: { path: "/workspace" },
        render: () => h(Workspace, { ctx }),
      });
      ctx.register({
        id: "nav",
        area: SIDEBAR_NAV_AREA,
        data: { path: "/workspace", label: "Workspace", codicon: "notebook" },
      });
    });
  },
};
