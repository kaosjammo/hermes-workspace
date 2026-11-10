import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdtempSync } from "node:fs";
/** Production HTTP + Store; only native admission is a synthetic fixture. */
export function httpFixture() {
  const owner = mkdtempSync(path.resolve(".local/frontend/http-repair1-"));
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
        timeout: 10000,
      },
    );
    if (result.status !== 0)
      throw new Error(
        `HTTP fixture process failed ${result.status}: ${result.stderr}`,
      );
    const response = JSON.parse(result.stdout);
    if (response.status >= 400)
      throw new Error(`${response.status}: ${response.body.detail}`);
    return response.body;
  };
  return { owner, rest };
}
