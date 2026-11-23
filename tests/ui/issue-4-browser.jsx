// Isolated synthetic transport + production Database + real pinned UI controls.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Database } from '../../frontend/tables.jsx';
import { styles } from '../../frontend/styles.mjs';
import { fixtureTheme } from '@hermes/plugin-sdk';

// Disclosed fixture-only subset of host applyTheme's seed/palette mapping.
// Uses the host's actual Nous palettes; does not load native app/profile state.
window.issue4Theme=mode=>{
  const root=document.documentElement,c=mode==='dark'?fixtureTheme.darkColors:fixtureTheme.colors;
  root.classList.toggle('dark',mode==='dark');root.style.colorScheme=mode;
  const seeds={'--theme-foreground':c.foreground,'--theme-primary':c.primary,'--theme-secondary':c.secondary,'--theme-accent-soft':c.accent,'--theme-midground':c.midground??c.ring,'--theme-warm':c.primary,'--theme-background-seed':c.background,'--theme-sidebar-seed':c.sidebarBackground??c.background,'--theme-card-seed':c.card,'--theme-elevated-seed':c.popover,'--theme-bubble-seed':c.userBubble??c.popover,'--dt-primary-foreground':c.primaryForeground,'--dt-secondary-foreground':c.secondaryForeground,'--dt-accent-foreground':c.accentForeground,'--dt-border':c.border,'--dt-input':c.input,'--dt-ring':c.ring,'--dt-muted':c.muted};
  for(const [key,value]of Object.entries(seeds))root.style.setProperty(key,value);
};
window.issue4Theme('light');

function Fixture() {
  const [state,setState]=useState(null),[selected,setSelected]=useState(''),[error,setError]=useState('');
  window.issue4State=state;
  const refresh=async()=>{const next=await fetch('/state').then(r=>r.json());setState(next);return next;};
  React.useEffect(()=>{refresh().then(s=>setSelected(s.items.find(i=>i.title==='Field observations').id));},[]);
  const item=state?.items.find(i=>i.id===selected);
  const command=async(op,payload)=>{
    const data=typeof payload==='function'?payload(state):payload;
    const r=await fetch('/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,payload:data,revision:state.revision,scope:state.scope_id})});
    const result=await r.json();if(!r.ok)throw Error(result.error);await refresh();return result;
  };
  return <><style>{styles}</style><header className="fixture-tools">
    <strong>Issue 4 · Synthetic database fixture</strong>
    <label>Dataset <select aria-label="Fixture dataset" value={selected} onChange={e=>setSelected(e.target.value)}>{state?.items.filter(i=>i.kind==='database'&&i.title!=='Related sites').map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
    <button onClick={()=>window.issue4Theme(document.documentElement.classList.contains('dark')?'light':'dark')}>Toggle fixture theme</button>
    <span>Production Store, synthetic HTTP adapter. No native agent.</span>
  </header><main className="ws-root"><div className="ws-work"><h1>{item?.title}</h1>{item&&<Database key={item.id} item={item} state={state} command={command} locked={item.title==='Locked observations'} onOpen={id=>setError('Fixture opened record '+id)} onError={e=>setError(e.message)} confirm={()=>{}}/>}{error&&<p role="alert">{error}</p>}</div></main></>;
}
createRoot(document.getElementById('app')).render(<Fixture/>);
