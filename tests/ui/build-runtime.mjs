import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(
  new URL("../../.local/toolchain/package.json", import.meta.url),
);
const esbuild = require("esbuild");
await esbuild.build({
  entryPoints: ["tests/ui/runtime-entry.jsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".local/frontend/ui-runtime.mjs",
  alias: {
    "@hermes/plugin-sdk": path.resolve("tests/ui/sdk-fixture.jsx"),
    react: path.dirname(require.resolve("react/package.json")),
    "react-dom": path.dirname(require.resolve("react-dom/package.json")),
  },
  define: { "process.env.NODE_ENV": '"development"' },
});
