import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdtempSync } from "node:fs";
/** Production HTTP + Store; only native admission is a synthetic fixture. */
export function httpFixture() {
  const owner = mkdtempSync(path.join(process.env.HWS_QUALIFICATION_HOME, "http-repair1-"));
  const rest = async (url, options) => {
    const result = spawnSync(
      process.env.HWS_PYTHON ?? "python3",
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
          HOME: process.env.HOME,
          HERMES_HOME: owner,
          TMPDIR: process.env.TMPDIR,
          UI_TEST_OWNER: owner,
          PYTHONDONTWRITEBYTECODE: "1",
        },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    if (result.status !== 0)
      throw new Error(
        `HTTP fixture process failed ${result.status}: ${result.error?.message ?? result.stderr}`,
      );
    const response = JSON.parse(result.stdout);
    if (response.status >= 400)
      throw new Error(`${response.status}: ${response.body.detail}`);
    return response.body;
  };
  return { owner, rest };
}
