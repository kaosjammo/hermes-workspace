/** Task-only real SDK control/style build plus distribution-shaped bundle. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=process.cwd(),out=process.env.HWS_QUALIFICATION_HOME;
if(!out)throw Error('Task evidence directory required');
const require=createRequire(root+'/.local/toolchain/package.json');
const host=path.resolve('.local/host/.build/webapp-workspace/apps/desktop'),hostRequire=createRequire(host+'/package.json');
const output=out+'/build/browser';await fs.mkdir(output,{recursive:true});
const result=await require('esbuild').build({entryPoints:['tests/ui/issue-10-browser.jsx'],outfile:output+'/app.js',bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',nodePaths:[host+'/node_modules',root+'/.local/toolchain/node_modules'],alias:{'@hermes/plugin-sdk':root+'/tests/ui/issue-10-browser-sdk.jsx','@':host+'/src',react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))},metafile:true,define:{'process.env.NODE_ENV':'"development"'}});
const candidates=new Set();
for(const file of Object.keys(result.metafile.inputs)){
 if(!/\.[cm]?[jt]sx?$/.test(file))continue;
 const text=await fs.readFile(path.resolve(file),'utf8');
 for(const match of text.matchAll(/["'`]([^"'`\n]+)["'`]/g))for(const value of match[1].split(/\s+/))candidates.add(value);
}
const {compile}=hostRequire('@tailwindcss/node');
const compiler=await compile(await fs.readFile(host+'/src/styles.css','utf8'),{base:host+'/src',onDependency:()=>{}});
await fs.writeFile(output+'/host.css',compiler.build([...candidates]).replaceAll(/url\([^)]*codicon\.ttf[^)]*\)/g,'url(/codicon.ttf)'));
await fs.copyFile(hostRequire.resolve('@vscode/codicons/dist/codicon.ttf'),output+'/codicon.ttf');
await fs.cp(host+'/src/fonts',output+'/fonts',{recursive:true});
await fs.writeFile(output+'/index.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Issue 10 synthetic Workspace</title><link rel="stylesheet" href="/host.css"><link rel="stylesheet" href="/app.css"><style>html,body,#app{height:100%;margin:0}body{font-family:var(--font-sans,Arial,sans-serif);background:var(--ui-bg-editor);color:var(--ui-text-primary)}#app>.ws-root{height:100vh}</style></head><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>');
const production=await require('esbuild').build({entryPoints:['frontend/index.jsx'],outfile:out+'/build/production-plugin.js',bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',external:['@hermes/plugin-sdk','react','react/jsx-runtime'],nodePaths:[root+'/.local/toolchain/node_modules'],metafile:true});
const hashes={};for(const file of ['app.js','host.css','index.html'])hashes[file]=createHash('sha256').update(await fs.readFile(output+'/'+file)).digest('hex');
hashes['production-plugin.js']=createHash('sha256').update(await fs.readFile(out+'/build/production-plugin.js')).digest('hex');
await fs.writeFile(out+'/build/build.json',JSON.stringify({hashes,browserInputs:result.metafile.inputs,productionInputs:production.metafile.inputs,limits:'Full production Workspace; pinned SDK UI controls/styles; synthetic atoms, selected-profile admission and transport; real production API/Store and public registered avatar handler. No Electron IPC or real provider execution.'},null,2));
console.log(JSON.stringify({hashes,inputs:Object.keys(production.metafile.inputs).length}));require('esbuild').stop();
