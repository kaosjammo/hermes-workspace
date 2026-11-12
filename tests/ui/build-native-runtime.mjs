import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const esbuild = require("esbuild");
await esbuild.build({
  entryPoints: ["tests/ui/native-entry.jsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  outfile: path.join(process.env.HWS_UI_RUNTIME_ROOT ?? ".local/frontend", "repair-1/native-runtime.mjs"),
  alias: {
    "@hermes/plugin-sdk": path.resolve("tests/ui/native-sdk-fixture.jsx"),
    "@": path.resolve(process.env.HWS_NATIVE_DESKTOP_SOURCE ?? ".local/host/.build/webapp-workspace/apps/desktop/src"),
    "@workspace-test-native": path.resolve(process.env.HWS_NATIVE_DESKTOP_SOURCE ?? ".local/host/.build/webapp-workspace/apps/desktop/src"),
    react: path.dirname(require.resolve("react/package.json")),
    "react-dom": path.dirname(require.resolve("react-dom/package.json")),
  },
  define: { "process.env.NODE_ENV": '"development"' },
});
