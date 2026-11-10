import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceClient} from '../../frontend/client.mjs';
const state={scope_id:'search-owner',revision:8,items:[],comments:[],runs:[],versions:[],attachments:[]};
const page=(offset=0)=>({scope_id:state.scope_id,revision:8,
  items:Array.from({length:offset===200?15:100},(_,i)=>({id:`row-${offset+i}`,title:`Synthetic ${offset+i}`})),
  total:215,offset,limit:100,next_offset:offset<200?offset+100:null,has_more:offset<200});
test('read-only search pages retain one bounded page and never publish summaries as editable state',async()=>{
  const calls=[];const client=new WorkspaceClient({rest:async(path,opts)=>{calls.push({path,opts});return {result:page(opts.body.payload.offset)};}},()=>['local','private',1]);
  client.accept(state);const original=client.snapshot();
  const first=await client.search('Synthetic');const third=await client.search('Synthetic',{offset:200,revision:first.revision});
  assert.equal(first.total,215);assert.equal(third.items.length,15);assert.equal(third.items[0].id,'row-200');
  assert.equal(client.snapshot(),original);assert.equal(calls.length,2);
  for(const {opts} of calls){assert.equal(opts.body.op,'search_page');assert.equal(opts.body.include_state,false);assert.equal(opts.body.expected_scope,state.scope_id);assert.equal(opts.body.payload.expected_revision,8);}
  assert.throws(()=>client.search('Synthetic',{offset:100}),/Restart/);client.dispose();
});
test('cleared, superseded, foreign-scope and changed-revision search results cannot publish',async()=>{
  let release;let result=page();
  const client=new WorkspaceClient({rest:()=>new Promise(resolve=>release=()=>resolve({result}))},()=>['local','private',1]);client.accept(state);
  const old=client.search('Old');client.cancelSearch();release();await assert.rejects(old,/source changed/i);
  const foreign=client.search('Foreign');result={...page(),scope_id:'different'};release();await assert.rejects(foreign,/invalid search/i);
  const stale=client.search('Stale');result={...page(),revision:9};release();await assert.rejects(stale,/invalid search/i);
  assert.equal(client.snapshot(),state);client.dispose();
});
