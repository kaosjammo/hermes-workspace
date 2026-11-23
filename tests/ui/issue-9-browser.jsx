/** Full production Workspace; synthetic transport/admission and native atoms. */
import {createElement as h} from 'react';
import {createRoot} from 'react-dom/client';
import {Workspace} from '../../frontend/workspace.jsx';
import {host} from './issue-10-browser-sdk.jsx';
import {nousTheme} from '@/themes/presets';
window.issue10Calls=[];
const ctx={storage:{get:key=>JSON.parse(localStorage.getItem(key)||'null'),set:(key,value)=>localStorage.setItem(key,JSON.stringify(value)),remove:key=>localStorage.removeItem(key)},onDispose:()=>{},
 rest:async(path,options={})=>{
  const response=await fetch('/api'+path,{method:options.method??'GET',headers:{'Content-Type':'application/json','X-Fixture-Profile':host.state.profile.get()},...(options.body?{body:JSON.stringify(options.body)}:{})});
  const data=await response.json();if(!response.ok)throw Error(data.detail||'Synthetic API failure');return data;
 }};
function theme(mode){
 const root=document.documentElement,c=mode==='dark'?nousTheme.darkColors:nousTheme.colors;
 root.classList.toggle('dark',mode==='dark');root.style.colorScheme=mode;
 const values={'--theme-foreground':c.foreground,'--theme-primary':c.primary,'--theme-secondary':c.secondary,'--theme-accent-soft':c.accent,'--theme-midground':c.midground??c.ring,'--theme-warm':c.primary,'--theme-background-seed':c.background,'--theme-sidebar-seed':c.sidebarBackground??c.background,'--theme-card-seed':c.card,'--theme-elevated-seed':c.popover,'--theme-bubble-seed':c.userBubble??c.popover,'--dt-primary-foreground':c.primaryForeground,'--dt-secondary-foreground':c.secondaryForeground,'--dt-accent-foreground':c.accentForeground,'--dt-border':c.border,'--dt-input':c.input,'--dt-ring':c.ring,'--dt-muted':c.muted};
 for(const[key,value]of Object.entries(values))root.style.setProperty(key,value);
}
theme('light');window.issue9={theme,rest:ctx.rest};
createRoot(document.getElementById('app')).render(h(Workspace,{ctx}));
