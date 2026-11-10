/** Standalone: the original integration owner wires navigation/draft hooks. */
import { createElement as h, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@hermes/plugin-sdk';
import { executorChoice } from './profile-workspaces.mjs';
import { profileWorkspacesStyles } from './profile-workspaces-styles.mjs';

function Choice({ label, value, choices, onChange, disabled }) {
  return h(Select, { value, onValueChange: onChange, disabled },
    h(SelectTrigger, { 'aria-label': label }, h(SelectValue, { placeholder: label })),
    h(SelectContent, null, choices.map(([id, text]) => h(SelectItem, { key: id, value: id }, text))));
}

function FormDialog({ title, description, open, onClose, children, onSubmit, action, busy }) {
  return h(Dialog, { open, onOpenChange: next => { if (!next && !busy) onClose(); } },
    h(DialogContent, { className: 'ws-profile-dialog', 'aria-describedby': undefined },
      h(DialogHeader, null, h(DialogTitle, null, title), h(DialogDescription, null, description)),
      h('form', { className: 'ws-profile-form', onSubmit: event => { event.preventDefault(); if (!busy) onSubmit(); } },
        children, h(DialogFooter, null,
          h(Button, { type: 'button', variant: 'outline', disabled: busy, onClick: onClose }, 'Cancel'),
          h(Button, { type: 'submit', disabled: busy }, busy ? 'Saving…' : action)))));
}

export function ProfileWorkspaces({ client, beforeSelect, onSelect, privateState,
  currentItem, beforeMove, onMoved, profileOptions = [] }) {
  const state = useSyncExternalStore(client.subscribe, client.snapshot, client.snapshot);
  const [dialog, setDialog] = useState(null), [name, setName] = useState(''),
    [member, setMember] = useState(''), [role, setRole] = useState('editor'),
    [target, setTarget] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const working = useRef(false);
  useEffect(() => { let live = true; client.load().catch(e => { if (live) setError(e.message); });
    return () => { live = false; }; }, [client]);
  const work = async callback => {
    if (working.current) return;
    working.current = true;
    setBusy(true); setError(null);
    try { await callback(); setDialog(null); }
    catch (e) { setError(e.message); }
    finally { working.current = false; setBusy(false); }
  };
  const selected = state.selected;
  const creator = selected?.workspace.owner_profile_id === state.profileId;
  const label = id => profileOptions.find(p => p.profileId === id)?.label ?? 'Local profile ' + id.slice(0, 8);
  return h('section', { className: 'ws-profile-workspaces', 'aria-label': 'Workspace and profiles' },
    h('style', null, profileWorkspacesStyles),
    state.capabilities?.shared_storage_configured && h(Choice, { label: 'Workspace',
      value: selected?.workspace.id ?? 'private', disabled: busy || state.loading,
      choices: [['private', 'Private workspace'], ...state.workspaces.map(w => [w.id, w.name])],
      onChange: id => work(() => client.select(id === 'private' ? null : id, { beforeSelect, onSelect })) }),
    state.capabilities?.shared_storage_configured && h(Button, { variant: 'outline', disabled: busy,
      onClick: () => { setName(''); setDialog('create'); } }, 'New shared workspace'),
    selected && h('span', null, selected.workspace.role === 'read_only' ? 'Read-only membership' : 'Editor membership'),
    creator && h(Button, { variant: 'outline', disabled: busy, onClick: () => { setMember(''); setRole('editor'); setDialog('members'); } }, 'Members'),
    !selected && currentItem && state.workspaces.length > 0 && h(Button, { variant: 'outline', disabled: busy,
      onClick: () => { setTarget(''); setDialog('move'); } }, 'Move to shared workspace'),
    state.loading && h('p', { role: 'status' }, 'Loading workspaces…'),
    !state.loading && state.capabilities && !state.capabilities.shared_storage_configured &&
      h('p', null, state.capabilities.blockers?.[0] ?? 'Shared Workspace storage is unavailable.'),
    (error || state.error) && h('p', { role: 'alert', className: 'ws-profile-error' }, error || state.error),
    h(FormDialog, { open: dialog === 'create', onClose: () => setDialog(null), title: 'New shared workspace',
      description: 'Your existing documents stay private and in place. Add chosen members after creating this workspace.',
      busy, action: 'Create workspace', onSubmit: () => work(async () => {
        if (!name.trim()) throw new Error('Enter a workspace name.');
        await client.create(name.trim());
      }) }, h('label', null, 'Workspace name', h(Input, { value: name, maxLength: 200, autoFocus: true, onChange: e => setName(e.target.value) }))),
    h(FormDialog, { open: dialog === 'members', onClose: () => setDialog(null), title: 'Workspace members',
      description: 'Only listed local profiles can open this workspace. Editors can change documents; read-only members can view them. These permissions apply within Workspace.',
      busy, action: 'Add member', onSubmit: () => work(async () => {
        if (!member) throw new Error('Choose an explicit local profile.');
        await client.setMember(selected, member, role);
      }) },
      h('ul', { className: 'ws-profile-members' }, selected?.workspace.members.map(m => h('li', { key: m.profile_id },
        h('span', null, label(m.profile_id)),
        m.profile_id === selected.workspace.owner_profile_id ? h('span', null, 'Editor') :
          h(Choice, { label: 'Role for ' + label(m.profile_id), value: m.role, disabled: busy,
            choices: [['editor', 'Editor'], ['read_only', 'Read-only']],
            onChange: nextRole => work(() => client.setMember(selected, m.profile_id, nextRole)) }),
        m.profile_id !== selected.workspace.owner_profile_id && h(Button, { type: 'button', variant: 'outline', disabled: busy,
          onClick: () => work(() => client.setMember(selected, m.profile_id, null)) }, 'Remove member')))),
      profileOptions.length ? h(Choice, { label: 'Local member profile', value: member || undefined, disabled: busy,
        choices: profileOptions.filter(p => !selected?.workspace.members.some(m => m.profile_id === p.profileId)).map(p => [p.profileId, p.label]), onChange: setMember }) :
        h('p', null, 'An authenticated local profile roster is required to add members.'),
      h(Choice, { label: 'Member role', value: role, choices: [['editor', 'Editor'], ['read_only', 'Read-only']], onChange: setRole, disabled: busy })),
    h(FormDialog, { open: dialog === 'move', onClose: () => setDialog(null), title: 'Move document into a shared workspace?',
      description: 'The selected document and its supported hierarchy, comments, attachments and recovery history move out of your private workspace. Destination members will gain access. Connected data that cannot move safely will refuse the whole move.',
      busy, action: 'Move document', onSubmit: () => work(async () => {
        if (!target || typeof beforeMove !== 'function' || typeof onMoved !== 'function')
          throw new Error('Choose a destination and connect the document move workflow first.');
        const freshPrivate = await beforeMove(currentItem.id); // flush/recovery hook, never a stale draft overwrite
        const view = await client.inspect(target);
        const result = await client.movePrivate(view, currentItem.id, freshPrivate ?? privateState, { confirmed: true });
        setDialog(null);
        try { await onMoved(result); } // serial owner refreshes both scopes; never replays the move
        catch { throw new Error('Document moved. Reload both workspaces to refresh the view; do not repeat the move.'); }
      }) }, h(Choice, { label: 'Destination workspace', value: target || undefined,
        choices: state.workspaces.filter(w => w.role === 'editor').map(w => [w.id, w.name]), onChange: setTarget, disabled: busy })));
}

export function PageExecutorPicker({ item, bridge, disabled = false, onSaved }) {
  const current = useRef({ item, bridge }), working = useRef(false);
  current.current = { item, bridge };
  const [profiles, setProfiles] = useState([]), [threads, setThreads] = useState([]),
    [profileId, setProfileId] = useState(item?.executor?.profile_id ?? ''),
    [threadId, setThreadId] = useState(item?.executor?.thread_id ?? ''),
    [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const supported = bridge && ['listProfiles', 'listThreads', 'bind', 'assertCurrent'].every(key => typeof bridge[key] === 'function');
  useEffect(() => {
    let live = true;
    setProfiles([]); setThreads([]); setProfileId(item?.executor?.profile_id ?? ''); setThreadId(item?.executor?.thread_id ?? '');
    if (supported) Promise.resolve().then(() => bridge.listProfiles()).then(rows => {
      bridge.assertCurrent(); if (live) setProfiles(rows);
    }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [bridge, item?.id, supported]);
  useEffect(() => {
    let live = true; setThreads([]);
    const profile = profiles.find(p => p.profileId === profileId);
    if (supported && profile) Promise.resolve().then(() => bridge.listThreads(profile)).then(rows => {
      bridge.assertCurrent(); if (live) setThreads(rows);
    }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [bridge, profiles, profileId, item?.id, supported]);
  if (!supported) return h('p', { className: 'ws-profile-error' },
    'Page executor selection is unavailable: a supported binding between the data owner, native executor source and matching thread is required.');
  return h('div', { className: 'ws-profile-workspaces', 'aria-label': 'Page executor' },
    h('style', null, profileWorkspacesStyles),
    h(Choice, { label: 'Executing local profile', value: profileId || undefined, choices: profiles.map(p => [p.profileId, p.label]),
      disabled: busy || disabled, onChange: id => { setProfileId(id); setThreadId(''); setError(null); } }),
    h(Choice, { label: 'Matching native thread', value: threadId || undefined, choices: threads.map(t => [t.id, t.title]),
      disabled: busy || disabled || !profileId, onChange: setThreadId }),
    h(Button, { disabled: disabled || busy || !profileId || !threadId, onClick: async () => {
      if (working.current) return;
      working.current = true;
      const captured = current.current;
      setBusy(true); setError(null);
      try {
        bridge.assertCurrent();
        const binding = executorChoice(profiles.find(p => p.profileId === profileId), threads.find(t => t.id === threadId));
        const saved = await bridge.bind(item, binding); bridge.assertCurrent();
        if (current.current.item?.id !== captured.item?.id || current.current.bridge !== captured.bridge) return;
        if (JSON.stringify(saved.executor) !== JSON.stringify(binding)) throw new Error('Saved executor binding did not match the selected source and thread.');
        onSaved?.(saved);
      } catch (e) { if (current.current.item?.id === captured.item?.id) setError(e.message); }
      finally { working.current = false; setBusy(false); }
    } }, busy ? 'Saving…' : 'Remember executor'),
    error && h('p', { role: 'alert', className: 'ws-profile-error' }, error));
}
