/** Distribution-shaped build in task evidence; never writes desktop/plugin.js. */
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const out=process.env.ISSUE8_EVIDENCE??process.env.HWS_QUALIFICATION_HOME;
if(!out)throw Error('Task-owned evidence directory required');
const require=createRequire(new URL('../../.local/toolchain/package.json',import.meta.url));
const result=await require('esbuild').build({entryPoints:['frontend/index.jsx'],outfile:path.join(out,'production-plugin.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',external:['@hermes/plugin-sdk','react','react/jsx-runtime'],nodePaths:[path.resolve('.local/toolchain/node_modules')],metafile:true});
const bytes=await readFile(path.join(out,'production-plugin.js'));
const receipt={file:'production-plugin.js',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),inputs:result.metafile.inputs};
await writeFile(path.join(out,'production-build.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({bytes:receipt.bytes,sha256:receipt.sha256}));
