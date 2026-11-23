/** Additional dataset routing is synthetic; every product module is bundled unchanged. */
import fs from 'node:fs/promises';
const out=process.env.HWS_QUALIFICATION_HOME;
const entry=out+'/review01-browser-entry.jsx';
const original=await fs.readFile('tests/ui/issue-9-browser.jsx','utf8');
await fs.writeFile(entry,original.replace("'../../frontend/workspace.jsx'",JSON.stringify(process.cwd()+'/frontend/workspace.jsx'))
 .replace("'./issue-10-browser-sdk.jsx'",JSON.stringify(process.cwd()+'/tests/ui/issue-10-browser-sdk.jsx'))
 .replace("fetch('/api'+path","fetch((location.search.includes('imported')?'/imported-api':'/api')+path"));
const builder=(await fs.readFile('tests/ui/issue-10-browser-build.mjs','utf8'))
 .replace("entryPoints:['tests/ui/issue-10-browser.jsx']",'entryPoints:['+JSON.stringify(entry)+']')
 .replace('Issue 10 synthetic Workspace','Issue 9 repair synthetic Workspace');
await import('data:text/javascript;base64,'+Buffer.from(builder).toString('base64'));
