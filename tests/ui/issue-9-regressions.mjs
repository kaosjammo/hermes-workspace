/** Complete current suite inventory; preserve every result without fail-fast. */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const out=process.env.ISSUE9_EVIDENCE??process.env.HWS_QUALIFICATION_HOME;
if(!out)throw Error('External issue-owned evidence required');
fs.mkdirSync(out+'/suites',{recursive:true});const rows=[];
for(const file of ['tests/ui/build-runtime.mjs','tests/ui/build-native-runtime.mjs']){
 const p=spawnSync(process.execPath,[file],{encoding:'utf8',env:process.env});
 fs.writeFileSync(out+'/suites/'+file.split('/').at(-1)+'.log',(p.stdout??'')+(p.stderr??''));
 if(p.status!==0)throw Error('Fixture build failed: '+file);
}
for(const suite of fs.readdirSync('tests/ui').filter(n=>n.endsWith('.test.mjs')&&n!=='lane-a.test.mjs'&&!n.endsWith('-browser.test.mjs')).sort()){
 const argv=['--test','--test-isolation=none','--test-reporter=tap','--test-force-exit','tests/ui/'+suite];
 const p=spawnSync(process.execPath,argv,{encoding:'utf8',env:process.env,timeout:45000,maxBuffer:8*1024*1024});
 const output=(p.stdout??'')+(p.stderr??'');fs.writeFileSync(out+'/suites/'+suite+'.log',output);
 const field=name=>Number(new RegExp('^# '+name+' (\\d+)$','m').exec(output)?.[1]??0);
 const row={suite,argv,exit:p.status,error:p.error?.message,tests:field('tests'),pass:field('pass'),fail:field('fail'),skipped:field('skipped'),cancelled:field('cancelled')};rows.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(out+'/suites/summary.json',JSON.stringify(rows,null,2));
console.log('ISSUE9_ALL_SUITES '+JSON.stringify({suites:rows.length,tests:rows.reduce((s,r)=>s+r.tests,0),pass:rows.reduce((s,r)=>s+r.pass,0),fail:rows.reduce((s,r)=>s+r.fail,0),nonzero:rows.filter(r=>r.exit!==0).length}));
process.exitCode=rows.some(r=>r.exit!==0)?1:0;
