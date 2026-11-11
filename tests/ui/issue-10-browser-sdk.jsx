/** Real pinned SDK controls/styles; fixture atoms and transport are synthetic. */
export * from './issue-8-native-sdk.jsx';
import {host,switchProfile,switchConnection,advanceEpoch} from './sdk-fixture.jsx';
host.state.profile.set('alpha');
host.profileRoutes=async()=>[
  {connectionId:host.activeConnectionId(),profile:'alpha',targetProfile:'alpha',mode:'in_process'},
  {connectionId:host.activeConnectionId(),profile:'beta',targetProfile:'beta',mode:'in_process'},
];
host.requestProfile=async(route,method,params)=>{
  if(method!=='profiles.get_asset'||params.asset!=='avatar')throw Error('Fixture permits only recorded avatar reads');
  window.issue10Calls.push({route,method,params});
  const response=await fetch('/fixture/avatar/'+encodeURIComponent(params.name));
  if(!response.ok)throw Error('Synthetic avatar transport failure');
  return response.json();
};
export {host,switchProfile,switchConnection,advanceEpoch};
