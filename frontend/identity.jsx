import { PopoverTrigger, Dialog, DialogContent, Popover, PopoverContent } from "./owned-popups.jsx";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { host } from "@hermes/plugin-sdk";
import { h, Action, Input, errorMessage, isSubmitEnter } from './ui.jsx';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@hermes/plugin-sdk";
import { authorName, createIdentityBridge } from './identity.mjs';
const IdentityContext = createContext(null);

export function IdentityProvider({client, children}) {
  const loadAvatar = useMemo(() => createIdentityBridge(client, host), [client]);
  return h(IdentityContext.Provider, {value:loadAvatar}, children);
}

export function AuthorHeader({entry}) {
  const loadAvatar = useContext(IdentityContext), author = entry?.author_identity;
  const name = authorName(entry), [loaded,setLoaded] = useState(null);
  const [open,setOpen] = useState(false), trigger = useRef(null), close = useRef(null);
  const key = JSON.stringify(author);
  const image = loaded && loaded.key === key ? loaded.data : null;
  const pending = Boolean(loadAvatar && author?.kind === 'agent' && (!loaded || loaded.key !== key));
  useEffect(() => {
    let current = true;
    setLoaded(null);
    if (loadAvatar && author?.kind === 'agent')
      void loadAvatar(author).then(data => { if (current) setLoaded({key,data}); }).catch(() => { if (current) setLoaded({key,data:null}); });
    return () => { current = false; };
  }, [loadAvatar,key]);
  const contents = [
    h('span', {className:'ws-author-avatar', 'aria-hidden':true, 'data-avatar-state':pending?'loading':image?'image':'fallback'}, image
      ? h('img', {src:image, alt:'', width:20, height:20, referrerPolicy:'no-referrer',
          onLoad:e => { if (e.currentTarget.naturalWidth > 2048 || e.currentTarget.naturalHeight > 2048) setLoaded({key,data:null}); },
          onError:() => setLoaded({key,data:null})})
      : h('span', null, Array.from(name)[0]?.toLocaleUpperCase() || '•')),
    h('strong', {className:'ws-author-name'}, name)];
  // Comment authors also appear INSIDE the thread-summary button. Keep that
  // summary's complete accessible name and never nest another interactive
  // control. Reply headers are separate and can expose a native disclosure.
  if (entry?.author !== 'user' && entry?.author !== 'agent')
    return h('span', {className:'ws-author', title:name, 'aria-busy':pending}, ...contents);
  return h(Popover, {open, onOpenChange:setOpen},
    h(PopoverTrigger, {asChild:true},
      h(Action, {ref:trigger, variant:'ghost', className:'ws-author ws-author-disclosure',
        'aria-label':`Show full author name: ${name}`, 'aria-busy':pending,
        onMouseDown:event => event.preventDefault()}, ...contents)),
    h(PopoverContent, {className:'ws-author-details', align:'start',
      onOpenAutoFocus:event => { event.preventDefault(); close.current?.focus({preventScroll:true}); },
      onCloseAutoFocus:event => { event.preventDefault(); trigger.current?.focus({preventScroll:true}); },
      onClick:event => event.stopPropagation()},
      h('p', {className:'ws-author-full-name'}, name),
      h(Action, {ref:close, variant:'text', onClick:() => setOpen(false), 'aria-label':'Close author name'}, 'Close')));
}

export function UsernameDialog({client, onClose, returnFocus}) {
  const initial = client.snapshot()?.identity?.human?.name ?? 'user';
  const [value,setValue] = useState(initial === 'user' ? '' : initial);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const pending = useRef(false), opener = useRef(returnFocus ?? document.activeElement);
  const save = async name => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await client.command('set_username', {name}); onClose(); }
    catch (err) { setError(errorMessage(err)); }
    finally { pending.current = false; setBusy(false); }
  };
  return h(Dialog, {open:true, onOpenChange:open => { if (!open && !pending.current) onClose(); }},
    h(DialogContent, {className:'ws-dialog ws-username-dialog', style:{width:'min(24rem,calc(100% - 24px))'}, showCloseButton:!busy,
      onCloseAutoFocus:e => { e.preventDefault(); if (opener.current?.isConnected) opener.current.focus({preventScroll:true}); }},
      h(DialogHeader, null, h(DialogTitle,null,'Set username'),
        h(DialogDescription,null,'Shown on your comments and replies. Leave blank to use user.')),
      h('form', {onSubmit:e => { e.preventDefault(); void save(value); },
        onKeyDown:e => { if (e.key === 'Enter' && !isSubmitEnter(e)) e.preventDefault(); }},
        h('label', {className:'ws-field'}, 'Username', h(Input, {value, disabled:busy,
          'aria-label':'Username', 'aria-invalid':Boolean(error), 'aria-describedby':error?'ws-username-error':undefined,
          autoComplete:'off', onChange:e => setValue(e.target.value)})),
        error && h('p', {id:'ws-username-error',role:'alert'}, error),
        h(DialogFooter,{className:'ws-dialog-footer'},
          h(Action,{disabled:busy,onClick:() => void save('')},'Reset to user'),
          h(Action,{disabled:busy,onClick:onClose},'Cancel'),
          h(Action,{type:'submit',disabled:busy},busy?'Saving…':'Save')))));
}
