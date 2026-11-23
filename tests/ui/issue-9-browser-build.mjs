/** Reuse the production-shaped native-control build with issue-owned entry. */
import {readFile} from 'node:fs/promises';
const source=(await readFile('tests/ui/issue-10-browser-build.mjs','utf8'))
 .replace("entryPoints:['tests/ui/issue-10-browser.jsx']","entryPoints:['tests/ui/issue-9-browser.jsx']")
 .replace('Issue 10 synthetic Workspace','Issue 9 synthetic Workspace');
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
