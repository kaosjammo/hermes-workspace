/** Workspace owns these SDK popup lifecycles, including their native portals.
 * Never infer plugin state from another app surface's roles or data-slot names.
 */
import { createElement as h, forwardRef, useLayoutEffect, useRef, useState } from "react";
import * as sdk from "@hermes/plugin-sdk";

const openPopups = new Set();
export const hasWorkspacePopup = () => openPopups.size > 0;
export const isWorkspacePopupTarget = target => Boolean(target?.closest?.('[data-workspace-popup]'));
export const isWorkspacePopupTrigger = target => Boolean(target?.closest?.('[data-workspace-popup-trigger]'));

function ownedRoot(Native) {
  return function WorkspacePopup({ open, defaultOpen = false, onOpenChange, ...props }) {
    const [localOpen, setLocalOpen] = useState(defaultOpen);
    const token = useRef({});
    const shown = open ?? localOpen;
    useLayoutEffect(() => {
      const owned = token.current;
      if (shown) openPopups.add(owned);
      return () => { openPopups.delete(owned); };
    }, [shown]);
    return h(Native, { ...props, open: shown, onOpenChange: next => {
      if (open === undefined) setLocalOpen(next);
      onOpenChange?.(next);
    } });
  };
}

function ownedContent(Native) {
  return forwardRef(function WorkspacePopupContent(props, ref) {
    return h(Native, { ...props, ref, 'data-workspace-popup': '' });
  });
}

export const Dialog = ownedRoot(sdk.Dialog), Popover = ownedRoot(sdk.Popover),
  DropdownMenu = ownedRoot(sdk.DropdownMenu), Select = ownedRoot(sdk.Select);
export const DialogContent = ownedContent(sdk.DialogContent), PopoverContent = ownedContent(sdk.PopoverContent),
  DropdownMenuContent = ownedContent(sdk.DropdownMenuContent), SelectContent = ownedContent(sdk.SelectContent);

function ownedTrigger(Native) {
  return forwardRef(function WorkspacePopupTrigger(props, ref) {
    return h(Native, { ...props, ref, 'data-workspace-popup-trigger': '' });
  });
}
export const PopoverTrigger = ownedTrigger(sdk.PopoverTrigger), SelectTrigger = ownedTrigger(sdk.SelectTrigger),
  DropdownMenuTrigger = ownedTrigger(sdk.DropdownMenuTrigger);
