import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {commentAnchor,locateAnchor} from '../../frontend/editor.mjs';
const out=process.env.ISSUE9_EVIDENCE??process.env.HWS_QUALIFICATION_HOME;
assert.ok(out,'External issue-owned evidence required');
const cases=JSON.parse(execFileSync(path.resolve('.local/qualification-venv/bin/python'),['-c','import json,sys;from test_issue9_review03 import production_cases;print(json.dumps(production_cases(sys.argv[1])))',out+'/frontend-production-stores'],{encoding:'utf8',env:process.env}));
await fs.writeFile(out+'/frontend-production-cases.json',JSON.stringify(cases,null,2));
for(const c of cases)test('F012 production projection and frontend locator attach '+c.name+' no-effect passage',()=>{
 const anchor=commentAnchor(c.view);assert.equal(locateAnchor(c.plain,anchor).status,'attached');
 assert.equal(anchor.quote,'North river.');assert.equal(c.view.section_change.status,'unavailable');
 assert.equal(c.view.replies.length,4);assert.deepEqual(c.view.anchor,c.source_anchor);
});
