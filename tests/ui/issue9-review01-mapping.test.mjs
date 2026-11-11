import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commentAnchor,locateAnchor} from '../../frontend/editor.mjs';
test('F007 exact independently mapped passage survives unavailable cleanup',()=>{
 const original={quote:'North river.',prefix:'',suffix:''};
 const exact={quote:'stream',prefix:'North ',suffix:'.South garden.'};
 const comment={anchor:original,section_change:{status:'unavailable',reason:'No trusted response association',highlight_status:'available',anchor:exact}};
 assert.deepEqual(commentAnchor(comment),exact);
 assert.equal(locateAnchor('North stream.South garden.',commentAnchor(comment)).status,'attached');
});
test('uncertain or superseded mapping never falls back to original stale text',()=>{
 for(const change of [{status:'unavailable'},{status:'unavailable',highlight_status:'unavailable'},{status:'unavailable',reason:'superseded'}])
  assert.equal(locateAnchor('North river.',commentAnchor({anchor:{quote:'North river.'},section_change:change})).status,'detached');
});
