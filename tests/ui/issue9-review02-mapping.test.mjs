import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commentAnchor,locateAnchor} from '../../frontend/editor.mjs';
test('F009 earlier effective exact geometry survives latest reverted cleanup',()=>{
 const anchor={quote:'stream',prefix:'North ',suffix:'.South garden.'};
 const comment={anchor:{quote:'North river.',prefix:'',suffix:''},section_change:{status:'reverted',highlight_status:'available',anchor}};
 assert.deepEqual(commentAnchor(comment),{...anchor,paragraphs:true});
 assert.equal(locateAnchor('North stream.South garden.',commentAnchor(comment)).status,'attached');
});
test('F009 unavailable geometry never falls back to a broad quote after revert',()=>{
 const comment={anchor:{quote:'North river.',prefix:'',suffix:''},section_change:{status:'reverted',highlight_status:'unavailable'}};
 assert.equal(locateAnchor('North river.',commentAnchor(comment)).status,'detached');
});
