import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceClient} from '../../frontend/client.mjs';
import {avatarData,createIdentityBridge,authorName,MAX_AVATAR_BYTES} from '../../frontend/identity.mjs';
const source='a'.repeat(64);
const author={kind:'agent',id:'b'.repeat(64),name:'Aster Ω',profile:'alpha',source_id:source,avatar_eligible:true};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2X8AAAAASUVORK5CYII=','base64');
const asset={found:true,mime:'image/png',size:png.length,data:'data:image/png;base64,'+png.toString('base64')};
function fixture(){
 let owner=['local-a','alpha',1];const calls=[];
 const client=new WorkspaceClient({},()=>owner);
 client.accept({scope_id:'scope-a',revision:0,items:[],identity:{source_id:source}});
 const route={connectionId:'local-a',profile:'alpha',targetProfile:'pinned-alpha',mode:'in_process'};
 const host={profileRoutes:async()=>[route,{...route,connectionId:'other-source'}],requestProfile:async(...args)=>{calls.push(args);return asset}};
 return {client,host,calls,route,switchOwner:value=>{owner=value}};
}
test('default/legacy labels and Unicode are literal text values',()=>{
 assert.equal(authorName({}),'user');assert.equal(authorName({author:'agent'}),'Hermes');
 assert.equal(authorName({author_identity:{name:'<script>庭 🌿</script>'}}),'<script>庭 🌿</script>');
});
test('recorded executor requests literal avatar on the exact supported descriptor',async()=>{
 const f=fixture();const data=await createIdentityBridge(f.client,f.host)(author);
 assert.equal(data,asset.data);assert.deepEqual(f.calls,[[f.route,'profiles.get_asset',{name:'alpha',asset:'avatar',profile:'pinned-alpha'}]]);
});
test('foreign sources/profiles, legacy, imported and human identities cannot request assets',async()=>{
 const f=fixture(),load=createIdentityBridge(f.client,f.host);
 for(const value of [null,{...author,kind:'human'},{...author,source_id:'c'.repeat(64)},{...author,profile:'beta'},{...author,avatar_eligible:false}])assert.equal(await load(value),null);
 assert.equal(f.calls.length,0);
});
test('stale owner after route wait and stale dataset after RPC wait never publish images',async()=>{
 const f=fixture();let release;f.host.profileRoutes=()=>new Promise(r=>release=r);
 const pending=createIdentityBridge(f.client,f.host)(author);
 f.switchOwner(['local-b','alpha',2]);release([f.route]);await assert.rejects(pending,/source changed/i);assert.equal(f.calls.length,0);
 const g=fixture();g.host.requestProfile=()=>new Promise(r=>release=r);
 const second=createIdentityBridge(g.client,g.host)(author);await Promise.resolve();await Promise.resolve();
 g.client.accept({scope_id:'new-dataset',revision:1,items:[],identity:{source_id:source}});release(asset);
 await assert.rejects(second,/source changed/i);
});
test('ambiguous routes fail closed without requesting any profile image',async()=>{
 const f=fixture();f.host.profileRoutes=async()=>[f.route,{...f.route}];
 assert.equal(await createIdentityBridge(f.client,f.host)(author),null);assert.equal(f.calls.length,0);
});
test('unsafe, malformed, absent, oversized and MIME/bytes mismatches all use neutral fallback',()=>{
 for(const value of [{found:false},{...asset,size:MAX_AVATAR_BYTES+1},{...asset,size:1},
   {...asset,mime:'image/svg+xml'},{...asset,data:'https://example.test/avatar.png'},
   {...asset,data:'data:image/png;base64,????'},{...asset,size:asset.size+1},
   {...asset,mime:'image/jpeg',data:asset.data.replace('image/png','image/jpeg')}])assert.equal(avatarData(value),null);
 assert.equal(avatarData(asset),asset.data);
});
