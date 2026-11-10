/** Run DOM suites in separate processes; their globals cannot share one realm. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(path.join(root, '.local'), { recursive: true });
const fixture = mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'hws-ui-check-'));
for (const name of ['home', 'hermes', 'tmp', 'cache', 'runtime'])
  mkdirSync(path.join(fixture, name));
const env = {
  PATH: process.env.PATH ?? '/usr/bin:/bin',
  LANG: process.env.LANG ?? 'C.UTF-8',
  HWS_QUALIFICATION_HOME: process.env.HWS_QUALIFICATION_HOME,
  HERMES_HOME: path.join(fixture, 'hermes'),
  TMPDIR: path.join(fixture, 'tmp'),
  XDG_CACHE_HOME: path.join(fixture, 'cache'),
  HERMES_RUNTIME_DIR: path.join(fixture, 'runtime'),
  PYTHONDONTWRITEBYTECODE: '1',
};
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root, env, encoding: 'utf8', timeout: 45000,
    maxBuffer: 8 * 1024 * 1024,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error || result.status !== 0) {
    process.stderr.write('Failed UI command: ' + JSON.stringify(args) + '\n');
    if (result.error) process.stderr.write(result.error.message + '\n');
    process.exit(result.status || 1);
  }
  return result.stdout;
}
run(['tests/ui/build-runtime.mjs']);
run(['tests/ui/build-native-runtime.mjs']);
let total = 0;
// Lane A is the real-browser/performance harness, launched through its own
// isolated Python wrapper; it is not a Node DOM test-file invocation.
const suites = readdirSync(path.join(root, 'tests/ui'))
  .filter(n => n.endsWith('.test.mjs') && n !== 'lane-a.test.mjs').sort();
if (!suites.length) throw new Error('No UI suites found');
for (const suite of suites) {
  const output = run(['--test', '--test-isolation=none', '--test-reporter=tap',
    '--test-force-exit', 'tests/ui/' + suite]);
  const count = /^# tests (\d+)$/m.exec(output);
  if (!count || Number(count[1]) < 1 || !/^# fail 0$/m.test(output)
      || !/^# cancelled 0$/m.test(output) || !/^# skipped 0$/m.test(output))
    throw new Error('Missing complete passing test summary for ' + suite);
  total += Number(count[1]);
}
console.log('UI_SUMMARY ' + JSON.stringify({ suites: suites.length, tests: total, failures: 0 }));
