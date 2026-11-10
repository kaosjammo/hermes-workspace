/** Full production Workspace with explicit synthetic shared routing composition.
 * Product API/Store/membership and username/author controls are unmodified.
 */
import {createElement as h} from 'react';
import {createRoot} from 'react-dom/client';
import {Workspace} from '../../frontend/workspace.jsx';
import {host,switchProfile,advanceEpoch} from './issue-10-browser-sdk.jsx';
import {nousTheme} from '@/themes/presets';
window.issue10Calls=[];
const config=await (await fetch('/fixture/review01')).json();
let shared=false,view=null;
const request=async(url,options={},profile=host.state.profile.get())=>{
 const response=await fetch(url,{method:options.method??'GET',headers:{'Content-Type':'application/json','X-Fixture-Profile':profile},...(options.body?{body:JSON.stringify(options.body)}:{})});
 const data=await response.json();if(!response.ok)throw Error(data.detail||'Synthetic API failure');return data;
};
const ctx={storage:{get:key=>JSON.parse(localStorage.getItem(key)||'null'),set:(key,value)=>localStorage.setItem(key,JSON.stringify(value)),remove:key=>localStorage.removeItem(key)},onDispose:()=>{},
 rest:async(path,options={})=>{
  const profile=host.state.profile.get();
  if(!shared)return request('/api'+path,options,profile);
  const prefix='/shared-api/workspaces/'+config.project_id;
  if(path==='/state'){const result=await request(prefix+'/state',options,profile);view=result;return result.state;}
  if(path==='/command'){
   if(!view)throw Error('Load the explicit shared fixture first.');
   return request(prefix+'/command',{...options,body:{...options.body,membership_revision:view.workspace.membership_revision}},profile);
  }
  throw Error('Shared native execution and other unsupported fixture routes remain unavailable.');
 }};
function theme(mode){
 const root=document.documentElement,c=mode==='dark'?nousTheme.darkColors:nousTheme.colors;
 root.classList.toggle('dark',mode==='dark');root.style.colorScheme=mode;
 const values={'--theme-foreground':c.foreground,'--theme-primary':c.primary,'--theme-secondary':c.secondary,'--theme-accent-soft':c.accent,'--theme-midground':c.midground??c.ring,'--theme-warm':c.primary,'--theme-background-seed':c.background,'--theme-sidebar-seed':c.sidebarBackground??c.background,'--theme-card-seed':c.card,'--theme-elevated-seed':c.popover,'--theme-bubble-seed':c.userBubble??c.popover,'--dt-primary-foreground':c.primaryForeground,'--dt-secondary-foreground':c.secondaryForeground,'--dt-accent-foreground':c.accentForeground,'--dt-border':c.border,'--dt-input':c.input,'--dt-ring':c.ring,'--dt-muted':c.muted};
 for(const[key,value]of Object.entries(values))root.style.setProperty(key,value);
}
theme('light');
window.issue10={theme,switchProfile,advanceEpoch,rest:ctx.rest,config,
 selectShared:value=>{shared=value;view=null;advanceEpoch();},
 request,
};
createRoot(document.getElementById('app')).render(h(Workspace,{ctx}));
