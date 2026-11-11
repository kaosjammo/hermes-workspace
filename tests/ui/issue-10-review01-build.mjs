/** Reuse our original task-only build; change only this fixture entry point. */
import {readFile} from 'node:fs/promises';
const source=(await readFile('tests/ui/issue-10-browser-build.mjs','utf8'))
 .replace("entryPoints:['tests/ui/issue-10-browser.jsx']","entryPoints:['tests/ui/issue-10-review01-browser.jsx']");
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
