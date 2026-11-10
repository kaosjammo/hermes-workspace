import plugin from "../../frontend/index.jsx";
import {host} from "@hermes/plugin-sdk";
const request=host.requestProfile.bind(host),routes=host.profileRoutes.bind(host);
host.profileRoutes=async()=>{
 const result=await routes();
 if(result.length)return result;
 return [{connectionId:host.activeConnectionId(),profile:host.state.profile.get(),targetProfile:host.state.profile.get()}];
};
host.requestProfile=async(route,method,params,...rest)=>{
 if(method==='session.list'){
  const mode=window.__wsRecentMode??'positive';
  if(mode==='error')throw Error('Synthetic recent-thread read unavailable');
  if(mode==='empty')return {sessions:[]};
  return {sessions:params.scope==='live'?[{stored_session_id:'synthetic-review22-thread-a',title:'Seasonal field notes',running:false,pending:[]}]:[{stored_session_id:'synthetic-review22-thread-a',title:'Seasonal field notes',running:false,pending:[]},{stored_session_id:'synthetic-review22-thread-b',title:'Seasonal field notes',running:false,pending:[]}]};
 }
 if(method==='session.resume')return {info:{desktop_protocol:'hermes-gateway-v1'},stored_session_id:params.session_id,session_id:'synthetic-runtime-'+params.session_id,running:false,pending:[]};
 return request(route,method,params,...rest);
};
export default plugin;
