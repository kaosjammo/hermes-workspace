/** Production identity components; synthetic DOM SDK. Real controls verified separately. */
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out=process.env.HWS_QUALIFICATION_HOME;assert.ok(out);
const require=createRequire(path.resolve('.local/toolchain/package.json'));
await fs.mkdir(out+'/build',{recursive:true});
await require('esbuild').build({stdin:{contents:'export {AuthorHeader,UsernameDialog} from "./frontend/identity.jsx";export {createElement as h,act} from "react";export {createRoot} from "react-dom/client";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:out+'/build/review01-components.mjs',alias:{'@hermes/plugin-sdk':path.resolve('tests/ui/sdk-fixture.jsx'),react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))},define:{'process.env.NODE_ENV':'"development"'},plugins:process.env.ISSUE10_PREDECESSOR?[{name:'exact-predecessor-component',setup(build){build.onLoad({filter:/frontend\/identity\.jsx$/},()=>({contents:execFileSync('git',['show','9f32ee17689e3be38276892754cef08129f74a1b:frontend/identity.jsx'],{encoding:'utf8'}),loader:'jsx'}));}}]:[]});
const {JSDOM}=require('jsdom'),dom=new JSDOM('<div id="app"></div>',{url:'https://review01.synthetic.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','Node','Event','MouseEvent'])globalThis[key]=dom.window[key];
globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {AuthorHeader,UsernameDialog,h,act,createRoot}=await import(out+'/build/review01-components.mjs');
const root=createRoot(document.getElementById('app'));
after(async()=>{await act(()=>root.unmount());window.close();require('esbuild').stop()});
test('F005 long human and native agent reply names have an operable full-name disclosure',async()=>{
 for(const [author,name]of [['user','庭🌿'.repeat(35)],['agent','Engineer 👩‍💻 '+ 'Native 東京 '.repeat(30)]]){
  await act(()=>root.render(h(AuthorHeader,{key:author,entry:{id:author,author,author_identity:{kind:author==='user'?'human':'agent',name}}})));
  const trigger=document.querySelector('button[aria-label^="Show full author name"]');assert.ok(trigger,'F005 keyboard/touch disclosure trigger exists');
  await act(()=>trigger.click());const content=document.querySelector('.ws-author-full-name');assert.ok(content);assert.ok(content.textContent.includes(name));
  await act(()=>[...content.parentElement.querySelectorAll('button')].find(b=>b.textContent==='Close').click());assert.equal(document.querySelector('.ws-author-full-name'),null);
 }
});
test('comment summary author remains noninteractive, preventing nested disclosure buttons',async()=>{
 await act(()=>root.render(h('button',null,h(AuthorHeader,{entry:{author_identity:{kind:'human',name:'庭🌿'.repeat(35)}}}))));
 assert.equal(document.querySelectorAll('button').length,1);
});
