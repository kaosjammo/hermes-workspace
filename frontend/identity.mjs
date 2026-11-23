/** Recorded-author assets only. Never a roster cache or an ambient-profile read. */
export const MAX_AVATAR_BYTES = 256 * 1024;
function boundedDimensions(bytes, mime) {
  const b = i => bytes.charCodeAt(i), le = (i,n) => Array.from({length:n},(_,k)=>b(i+k)*2**(8*k)).reduce((a,v)=>a+v,0);
  let width, height;
  if (mime === 'image/png' && bytes.length >= 24 && bytes.slice(12,16) === 'IHDR') {
    const be = i => b(i)*2**24+b(i+1)*2**16+b(i+2)*256+b(i+3);
    width=be(16);height=be(20);
  } else if (mime === 'image/webp' && bytes.length >= 30) {
    const kind=bytes.slice(12,16);
    if (kind==='VP8X') {width=le(24,3)+1;height=le(27,3)+1;}
    else if (kind==='VP8 ' && bytes.slice(23,26)==='\x9d\x01\x2a') {width=le(26,2)&16383;height=le(28,2)&16383;}
    else if (kind==='VP8L' && b(20)===47) {width=1+(le(21,2)&16383);height=1+((le(22,3)>>6)&16383);}
  } else if (mime === 'image/jpeg') {
    let i=2;
    while (i+8<bytes.length) {
      if (b(i++)!==255) return false;
      while (b(i)===255) i++;
      const marker=b(i++);
      if (marker===217 || marker===218) break;
      if (marker===1 || marker>=208 && marker<=215) continue;
      const size=b(i)*256+b(i+1);
      if (size<2 || i+size>bytes.length) return false;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        height=b(i+3)*256+b(i+4);width=b(i+5)*256+b(i+6);break;
      }
      i+=size;
    }
  }
  return width>0 && height>0 && width<=2048 && height<=2048 && width*height<=4194304;
}
export function avatarData(result) {
  if (result?.found !== true || !Number.isInteger(result.size) || result.size < 12 || result.size > MAX_AVATAR_BYTES) return null;
  if (!['image/png','image/jpeg','image/webp'].includes(result.mime) || typeof result.data !== 'string') return null;
  const prefix = `data:${result.mime};base64,`;
  if (!result.data.startsWith(prefix) || result.data.length > prefix.length + 4 * Math.ceil(MAX_AVATAR_BYTES / 3)) return null;
  const encoded = result.data.slice(prefix.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return null;
  let bytes;
  try { bytes = atob(encoded); } catch { return null; }
  if (bytes.length !== result.size) return null;
  const starts = (...magic) => magic.every((n,i) => bytes.charCodeAt(i) === n);
  const valid = result.mime === 'image/png' ? starts(137,80,78,71,13,10,26,10)
    : result.mime === 'image/jpeg' ? starts(255,216,255)
    : bytes.slice(0,4) === 'RIFF' && bytes.slice(8,12) === 'WEBP';
  return valid && boundedDimensions(bytes,result.mime) ? result.data : null;
}

export function createIdentityBridge(client, host) {
  return async author => {
    client.assertCurrent();
    const state = client.snapshot(), source = state?.identity?.source_id;
    const [connectionId, profile] = JSON.parse(client.owner);
    // This source has admitted this profile only. Even imported display metadata
    // cannot request another profile's image, credentials, URL or arbitrary asset.
    if (!source || author?.kind !== 'agent' || author.avatar_eligible !== true ||
        author.source_id !== source || author.profile !== profile) return null;
    const scope = state.scope_id, generation = client.scopeVersion;
    const check = () => {
      client.assertScope(scope);
      if (client.scopeVersion !== generation || client.snapshot()?.identity?.source_id !== source)
        throw new Error('Workspace author source changed.');
    };
    const routes = await host.profileRoutes();
    check();
    const matches = routes.filter(route => route.connectionId === connectionId && route.profile === author.profile);
    if (matches.length !== 1) return null;
    const route = Object.freeze({...matches[0]});
    const result = await host.requestProfile(route, 'profiles.get_asset', {
      name: author.profile, asset: 'avatar', profile: route.targetProfile,
    });
    check();
    return avatarData(result);
  };
}

export function authorName(entry) {
  return entry?.author_identity?.name || (entry?.author === 'agent' ? 'Hermes' : 'user');
}
