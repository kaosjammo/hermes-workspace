import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  memo,
} from "react";
import { itemContext, attachmentLabels, navigationContexts } from "./item-labels.mjs";
import { folderDestinations } from "./folder-destinations.mjs";
import { navigationOrderPayload } from "./navigation-order.mjs";
import {
  host,
  useValue,
  useQuery,
  useGatewayActivationEpoch,
  gatewayActivationEpoch,
  ErrorState,
  GlyphSpinner,
} from "@hermes/plugin-sdk";
import {
  h,
  Action,
  ActionMenu,
  Codicon,
  Field,
  Choice,
  errorMessage,
  operationError,
  UnsavedEditError,
  FormDialog,
  ContentDialog,
  versionChoices,
} from "./ui.jsx";
import { RestoreDialog } from "./restore.jsx";
import { PageTitle } from "./page-title.jsx";
import { DraftRepository } from "./drafts.mjs";
import { useNavigationResize, NavigationResizeHandle } from "./navigation-resize.jsx";
import { useDocumentWidth } from "./document-width.mjs";
import { useRunOutcomeDismissal } from "./run-outcome.mjs";
import { WorkspaceClient } from "./client.mjs";
import { WorkspaceSearch } from "./workspace-search.jsx";
import { styles } from "./styles.mjs";
import { RichEditor } from "./rich-editor.jsx";
import { RichPreview } from "./rich-preview.jsx";
import { Database, RecordProperties } from "./tables.jsx";
import { reviewScope, ScopeReviewDialog } from "./scope-review.jsx";
import { Comments } from "./comments.jsx";
import { IdentityProvider, UsernameDialog } from "./identity.jsx";
import { numberComments, anchorRange } from "./comment-highlights.jsx";
import { commentAnchor, captureAnchor } from "./editor.mjs";
import { activeRun } from "./database.mjs";
import { fileBase64, backupFileBase64, downloadFile } from "./editor.mjs";
import { createWorkflowAdapter } from "./workflow.js";
const ownerNow = () => [
  host.activeConnectionId(),
  host.state.profile.get(),
  gatewayActivationEpoch(),
];
export function Workspace({ ctx }) {
  const profile = useValue(host.state.profile),
    connection = useValue(host.state.connectionId),
    epoch = useGatewayActivationEpoch();
  const key = JSON.stringify([connection, profile, epoch]);
  return h(
    "div",
    { className: "ws-root" },
    h("style", null, styles),
    h(WorkspaceSource, { key, ctx, profile, sourceKey: key }),
  );
}
function NavigationLabel({ item, context, descriptionId }) {
  return h("span", { className: "ws-nav-label", title: item.title },
        h("span", null, item.title),
        context && h("small", { title: context.description }, context.caption),
        context && h("span", { className: "ws-title-reader", id: descriptionId }, context.description));
}
function NavigationOrderControls({ item, siblings, order }) {
  if (!order.mode) return null;
  const index = siblings.findIndex(row => row.id === item.id);
  const move = direction => {
    const target = siblings[index + direction];
    if (target) order.save(order.capture(item), target, direction < 0 ? "before" : "after");
  };
  return h("span", { className: "ws-order-controls", role: "group",
    "aria-label": `${item.title}, position ${index + 1} of ${siblings.length}`,
    onClick: e => e.stopPropagation(), onKeyDown: e => { if (e.key !== "Escape") e.stopPropagation(); } },
    h(Action, { variant: "ghost", className: "ws-order-handle", "aria-label": `Drag ${item.title}`,
      title: `Drag ${item.title}. Or use Move up and Move down.`,
      "aria-describedby": order.helpId, disabled: order.pending || siblings.length < 2,
      draggable: !order.pending && siblings.length > 1,
      onDragStart: e => order.start(e, item), onDragEnd: order.end }, h(Codicon, { name: "gripper" })),
    h(Action, { variant: "ghost", "aria-label": `Move ${item.title} up`, title: "Move up",
      disabled: order.pending || index === 0, onClick: () => move(-1) }, h(Codicon, { name: "arrow-up" })),
    h(Action, { variant: "ghost", "aria-label": `Move ${item.title} down`, title: "Move down",
      disabled: order.pending || index === siblings.length - 1, onClick: () => move(1) }, h(Codicon, { name: "arrow-down" })));
}
const Tree = memo(function Tree({ childrenByParent, contexts, parent = null, onOpen, selected, initializeDisclosure, order }) {
  return h(
    "ul",
    null,
    (childrenByParent.get(parent) ?? [])
      .map((item) =>
        h(
          "li",
          { key: item.id, "data-ws-item-id": item.id },
          item.kind === "folder"
            ? h(
                "details",
                { ref: initializeDisclosure },
                h(
                  "summary",
                  order.row(item),
                  h(Codicon, {
                    name: "chevron-right",
                    className: "ws-disclosure-caret",
                  }),
                  h(
                    Action,
                    {
                      variant: "ghost",
                      onClick: () => onOpen(item.id),
                      "aria-current": selected === item.id ? "page" : undefined,
                      "aria-label": contexts.has(item.id) ? item.title : undefined,
                      "aria-describedby": contexts.has(item.id) ? `ws-tree-context-${item.id}` : undefined,
                    },
                    h(NavigationLabel, { item, context: contexts.get(item.id), descriptionId: `ws-tree-context-${item.id}` }),
                  ),
                  h(NavigationOrderControls, { item, siblings: childrenByParent.get(parent), order }),
                ),
                h(Tree, { childrenByParent, contexts, parent: item.id, onOpen, selected, initializeDisclosure, order }),
              )
            : h(
                "div",
                { ...order.row(item), className: "ws-nav-row ws-order-row" },
                h(
                  Action,
                  {
                    className: "ws-tree-item",
                    variant: "ghost",
                    "aria-current": selected === item.id ? "page" : undefined,
                    "aria-label": contexts.has(item.id) ? item.title : undefined,
                    "aria-describedby": contexts.has(item.id) ? `ws-tree-context-${item.id}` : undefined,
                    onClick: () => onOpen(item.id),
                  },
                  h(Codicon, {
                    name: item.kind === "database" ? "table" : "file-text",
                  }),
                  h(NavigationLabel, { item, context: contexts.get(item.id), descriptionId: `ws-tree-context-${item.id}` }),
                ),
                h(NavigationOrderControls, { item, siblings: childrenByParent.get(parent), order }),
              ),
        ),
      ),
  );
});
function FolderNavigation({ childrenByParent, contexts, onOpen, selected, scope, reorder }) {
  const treeId = useId();
  const tree = useRef(null), defaultOpen = useRef(true);
  // Native disclosures retain individual state on their existing DOM nodes.
  // Initialize only on attachment, so polling/navigation never resets a toggle.
  const initializeDisclosure = useCallback(node => {
    if (node) node.open = defaultOpen.current;
  }, []);
  const setAll = useCallback(open => {
    defaultOpen.current = open;
    // Reconcile the actual DOM synchronously, including native toggles whose
    // notifications are still pending. No delayed state mirror can undo intent.
    tree.current?.querySelectorAll("details").forEach(node => { node.open = open; });
  }, []);
  const [mode, setMode] = useState(false), [pending, setPending] = useState(false),
    [feedback, setFeedback] = useState({ text: "", failed: false }), [target, setTarget] = useState(null);
  const busy = useRef(false), drag = useRef(null), serial = useRef(0), toggle = useRef(null), mounted = useRef(true);
  const restoreOrderFocus = useRef(null);
  const helpId = `${treeId}-order-help`, mime = "application/x-hermes-workspace-order";
  const signature = JSON.stringify([...childrenByParent].map(([parent, rows]) => [parent, rows.map(row => row.id)]));
  useLayoutEffect(() => { drag.current = null; setTarget(null); }, [scope, signature]);
  useLayoutEffect(() => {
    if (pending || !restoreOrderFocus.current) return;
    const { node, id, sourceScope } = restoreOrderFocus.current;
    restoreOrderFocus.current = null;
    // Moving an ancestor DOM node or disabling a pending button can blur it.
    // Restore only lost focus; never steal it from the editor or another control.
    if (sourceScope !== scope || (document.activeElement !== document.body && document.activeElement !== node)) return;
    const row = [...(tree.current?.querySelectorAll('[data-ws-order-row]') ?? [])]
      .find(row => row.dataset.wsOrderRow === id);
    const destination = node.isConnected && !node.disabled ? node : row?.querySelector('.ws-order-handle:not(:disabled)');
    destination?.focus({ preventScroll: true });
  }, [pending, scope]);
  useEffect(() => () => { mounted.current = false; drag.current = null; }, []);
  const capture = item => ({ id: item.id, parent: item.parent_id, scope,
    siblings: (childrenByParent.get(item.parent_id) ?? []).map(row => row.id) });
  const cancel = () => {
    if (!drag.current) return;
    drag.current = null; setTarget(null);
    setFeedback({ text: "Reordering cancelled. Saved order unchanged.", failed: false });
  };
  const save = async (request, item, position) => {
    if (busy.current || request.id === item.id || request.parent !== item.parent_id || request.scope !== scope) return;
    const focused = document.activeElement;
    if (tree.current?.contains(focused)) restoreOrderFocus.current = { node: focused, id: request.id, sourceScope: scope };
    busy.current = true; drag.current = null; setTarget(null); setPending(true);
    setFeedback({ text: "Saving folder order…", failed: false });
    try {
      await reorder({ ...request, target_id: item.id, position });
      if (mounted.current) setFeedback({ text: `Saved order. “${request.title ?? request.id}” ${position} “${item.title}”.`, failed: false });
    } catch (error) {
      if (mounted.current) setFeedback({ text: `Could not save order. ${error.message} Try again with the current order.`, failed: true });
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };
  const order = {
    mode, pending, helpId, capture: item => ({ ...capture(item), title: item.title }), save,
    start: (event, item) => {
      if (busy.current || !mode) { event.preventDefault(); return; }
      const token = `${treeId}:${++serial.current}`;
      drag.current = { ...capture(item), title: item.title, token };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(mime, token);
      event.dataTransfer.setData("text/plain", item.title);
      // Keep the source DOM/layout untouched until native drag capture finishes.
      // Inserting live feedback here can cancel Chromium's drag before capture.
    },
    end: cancel,
    row: item => ({ className: "ws-order-row", "data-ws-order-row": item.id,
      "data-order-position": target?.id === item.id ? target.position : undefined,
      onDragOver: event => {
        const request = drag.current;
        if (!mode || busy.current || !request || request.scope !== scope) return;
        if (request.parent !== item.parent_id || request.id === item.id) {
          event.dataTransfer.dropEffect = "none"; setTarget(null); return;
        }
        event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move";
        const box = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < box.top + box.height / 2 ? "before" : "after";
        setTarget(old => old?.id === item.id && old.position === position ? old : { id: item.id, position });
        setFeedback(old => {
          const text = `Drop ${position} “${item.title}”. Same folder only; use Move to change folders.`;
          return old.text === text ? old : { text, failed: false };
        });
      },
      onDragLeave: event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setTarget(old => old?.id === item.id ? null : old);
      },
      onDrop: event => {
        const request = drag.current;
        if (!request || request.token !== event.dataTransfer.getData(mime)) { cancel(); return; }
        event.preventDefault(); event.stopPropagation();
        const box = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < box.top + box.height / 2 ? "before" : "after";
        void save(request, item, position);
      } }),
  };
  const hasFolders = [...childrenByParent.values()].some(items => items.some(item => item.kind === "folder"));
  const canReorder = [...childrenByParent.values()].some(items => items.length > 1);
  return h("div", { className: "ws-folder-navigation", "data-reordering": mode, "aria-busy": pending,
    onKeyDown: event => {
      if (event.key !== "Escape" || event.isComposing || busy.current) return;
      event.stopPropagation(); event.preventDefault();
      if (drag.current) cancel();
      else { setMode(false); toggle.current?.focus({ preventScroll: true }); }
    } },
    h("div", { className: "ws-tree-actions", role: "group", "aria-label": "Folder tree actions" },
      hasFolders && h(Action, { variant: "ghost", "aria-controls": treeId,
        onClick: () => setAll(true) }, "Expand all"),
      hasFolders && h(Action, { variant: "ghost", "aria-controls": treeId,
        onClick: () => setAll(false) }, "Collapse all"),
      canReorder && h(Action, { ref: toggle, variant: "ghost", "aria-pressed": mode, disabled: pending,
        "aria-controls": treeId, onClick: () => { cancel(); setMode(value => !value); } }, mode ? "Done reordering" : "Reorder")),
    mode && h("p", { id: helpId, className: "ws-order-help" }, "Drag a handle, or use Move up and Move down. Escape cancels. Same folder only; use Move to change folders."),
    h("p", { className: "ws-order-status", role: feedback.failed ? "alert" : "status", "aria-atomic": true }, feedback.text),
    h("div", { id: treeId, ref: tree }, h(Tree, { childrenByParent, contexts, onOpen, selected, initializeDisclosure, order })));

}
function WorkspaceSource({ ctx, profile, sourceKey }) {
  // Retired in-flight queries must not report into a later mount's client.
  const queryInstance = useId();
  const client = useMemo(
    () => new WorkspaceClient(ctx, ownerNow),
    [ctx, sourceKey],
  );
  const workflow = useMemo(() => createWorkflowAdapter(ctx), [ctx, sourceKey]);
  const navigation = useNavigationResize(ctx.storage, client.owner);
  const compactHeader = navigation.availableWidth > 0 && navigation.availableWidth <= 480;
  const header = useRef(null), focusedHeaderAction = useRef(null);
  useLayoutEffect(() => {
    if (compactHeader && focusedHeaderAction.current && !focusedHeaderAction.current.isConnected && document.activeElement === document.body)
      header.current?.querySelector('[aria-label="Workspace menu"]')?.focus({ preventScroll: true });
  }, [compactHeader]);
  const trackHeaderFocus = { onFocus: event => { focusedHeaderAction.current = event.currentTarget; }, onBlur: () => { focusedHeaderAction.current = null; } };
  const drafts = useMemo(() => {
    const [connectionId, ownerProfile] = JSON.parse(client.owner);
    return ctx.storage
      ? new DraftRepository(ctx.storage, connectionId, ownerProfile)
      : null;
  }, [ctx.storage, client]);
  const state = useSyncExternalStore(
    client.subscribe,
    client.snapshot,
    client.snapshot,
  );
  const [usernameDialog, setUsernameDialog] = useState(null);
  const [selected, setSelected] = useState(null),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState(null),
    [confirmation, setConfirmation] = useState(null),
    [restore, setRestore] = useState(null),
    [replacementLoad, setReplacementLoad] = useState(null),
    [notice, setNotice] = useState(""),
    [trash, setTrash] = useState(false),
    [navExpanded, setNavExpanded] = useState(false),
    [errorAction, setErrorAction] = useState("action"),
    [errorContext, setErrorContext] = useState(null);
  const navId = useId(), navToggle = useRef(null), workPane = useRef(null);
  const importing = useRef(false), [importBusy, setImportBusy] = useState(false), [importedItem, setImportedItem] = useState(null);
  // Explicit destinations start at their heading. Polling and edits preserve reading position.
  useLayoutEffect(() => {
    if (workPane.current) { workPane.current.scrollTop = 0; workPane.current.scrollLeft = 0; }
  }, [selected, trash]);
  const importInput = useRef(null),
    backupInput = useRef(null),
    flush = useRef(async () => {}),
    selectionIntent = useRef(0);
  const nextSelectionIntent = useCallback(() => ++selectionIntent.current, []);
  const errorReceipt = useRef(null);
  const report = useCallback(
    (err, action = "action") => {
      if (client.current() && err instanceof UnsavedEditError) return;
      if (client.current()) {
        const context = typeof action === "string" ? { operation: action } : action;
        // A later report, even for this section, belongs to another attempt.
        errorReceipt.current = { context, client };
        setError(err?.message ?? String(err)); setErrorAction(context?.operation ?? "action"); setErrorContext(context);
      }
    },
    [client],
  );
  const sectionFeedback = useMemo(() => ({
    begin(itemId, change) {
      const context = { operation: "revertSection", itemId,
        scopeId: client.snapshot()?.scope_id, scopeVersion: client.scopeVersion,
        versionId: change.version_id, generationId: change.generation_id, changeId: change.change_id };
      return { context, previous: errorReceipt.current };
    },
    complete(attempt, result) {
      const previous = attempt.previous, context = attempt.context;
      if (!client.current() || !previous || previous.client !== client || errorReceipt.current !== previous ||
          context.scopeId !== client.snapshot()?.scope_id || context.scopeVersion !== client.scopeVersion ||
          Object.keys(context).some(key => previous.context?.[key] !== context[key])) return;
      const checkpoint = client.snapshot()?.versions.find(version => version.id === result?.recovery_version_id);
      // Preview and consent are not recovery. The accepted command result and
      // published Store checkpoint must agree before retiring its prior error.
      if (result?.reverted !== true || result.item_id !== context.itemId || result.change_id !== context.changeId ||
          checkpoint?.section_revert_of !== context.changeId ||
          checkpoint.section_revert_receipt?.generation_id !== context.generationId ||
          !Array.isArray(result.removed_reply_ids) ||
          JSON.stringify(checkpoint.section_revert_receipt.removed_reply_ids) !== JSON.stringify(result.removed_reply_ids)) return;
      errorReceipt.current = null;
      setError(""); setErrorContext(null);
    },
  }), [client]);
  const command = useCallback(
    (op, payload) => client.command(op, payload),
    [client],
  );
  const reorder = useCallback(request => client.command("reorder_item",
    current => navigationOrderPayload(current, request)), [client]);
  const refresh = useCallback(() => client.load(), [client]);
  const loadReplacement = async (ticket, committed = true) => {
    client.assertCurrent();
    setRestore(null);
    setSelected(null);
    setTrash(false);
    setDialog(null);
    setConfirmation(null);
    setReplacementLoad({ ticket, committed });
    setError("");
    setNotice(
      committed === "unknown"
        ? "Replacement outcome remains unknown. Loading current Workspace only…"
        : committed
          ? "Restore completed. Loading replaced Workspace…"
          : "Replacement refused. Loading current Workspace…",
    );
    try {
      if (client.replacement) await client.reloadRestore(ticket);
      else await client.load();
      client.assertCurrent();
      setReplacementLoad(null);
      setNotice(
        committed === "unknown"
          ? "Current Workspace loaded. The replacement outcome remains unknown. Do not repeat replacement to recover a lost response."
          : committed
            ? "Workspace restored."
            : "Current Workspace loaded. Replacement was refused.",
      );
    } catch (err) {
      if (client.current())
        setNotice(
          (committed === "unknown"
            ? "Replacement outcome remains unknown; current Workspace could not be loaded. "
            : committed
              ? "Restore completed, but Workspace could not be loaded. "
              : "Replacement refused, but Workspace could not be loaded. ") +
            err.message +
            " Retry loading only; replacement will not be repeated.",
        );
    }
  };
  const queryState = useQuery({
    queryKey: ["workspace", sourceKey, queryInstance],
    queryFn: refresh,
    refetchInterval: 3000,
    gcTime: 0,
    retry: false,
  });
  const failedRunIds = useRef(new Set());
  const runs = (state?.runs ?? []).filter((r) =>
    ["running", "pending", "starting", "stopping"].includes(r.status) && !failedRunIds.current.has(r.id),
  );
  const runFailureContext = useRef(null);
  const runQuery = useQuery({
    queryKey: ["workspace-runs", sourceKey, queryInstance, runs.map((r) => r.id).join(",")],
    enabled: runs.length > 0,
    queryFn: async () => {
      client.assertCurrent();
      for (const run of runs) {
        try { await workflow.status(run); }
        catch (error) {
          runFailureContext.current = { operation: "runStatus", itemId: run.item_id,
            pageTitle: client.snapshot()?.items.find(item => item.id === run.item_id)?.title,
            threadId: run.session_id };
          failedRunIds.current.add(run.id);
          report(error, runFailureContext.current);
        }
        client.assertCurrent();
      }
      return refresh();
    },
    // A failed observation is not evidence that another automatic attempt is
    // safe or useful. Keep explicit recovery available without an error loop.
    refetchInterval: query => query.state.error ? false : 3000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retryOnMount: false,
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (queryState.error) report(queryState.error, "load");
  }, [queryState.error, report]);
  useEffect(() => {
    if (runQuery.error) report(runQuery.error, runFailureContext.current ?? { operation: "runStatus" });
  }, [runQuery.error, report]);
  useEffect(
    () => () => {
      client.dispose();
      workflow.dispose();
    },
    [client, workflow],
  );
  const registerFlush = useCallback((fn) => {
    flush.current = fn;
    return () => {
      if (flush.current === fn) flush.current = async () => {};
    };
  }, []);
  const open = useCallback(async (id) => {
    const intent = nextSelectionIntent();
    try {
      await flush.current();
      client.assertCurrent();
      if (client.snapshot()?.items.find((i) => i.id === id)?.kind !== "folder")
        await command("open_item", { id });
      if (client.current() && intent === selectionIntent.current) {
        setSelected(id);
        setNavExpanded(false);
        requestAnimationFrame(() => { if (navToggle.current?.getClientRects().length) navToggle.current.focus(); });
        setTrash(false);
      }
    } catch (err) {
      report(err);
    }
  }, [client, command, report, nextSelectionIntent]);
  const home = async () => {
    const intent = nextSelectionIntent();
    try {
      await flush.current();
      client.assertCurrent();
      if (intent !== selectionIntent.current) return;
      setSelected(null);
      setTrash(false);
    } catch (err) {
      report(err);
    }
  };
  const act = (fn, current = () => true) => void Promise.resolve().then(fn).catch(err => {
    if (!current()) return;
    if (client.current() && err instanceof UnsavedEditError) err.focus();
    report(err);
  });
  const confirm = useCallback((config) => setConfirmation(config), []);
  const transfer = async (path, body) => {
    await flush.current();
    const response = await client.transfer(path, body);
    client.assertCurrent();
    return response;
  };
  const download = async (path) => {
    const result = await transfer(path);
    client.assertCurrent();
    downloadFile(result.download ?? result.result ?? result);
  };
  const upload = async (file, backup = false) => {
    if (!file) return;
    if (!backup && importing.current) return;
    const intent = selectionIntent.current;
    if (!backup) { importing.current = true; setImportBusy(true); setImportedItem(null); }
    try {
    client.assertCurrent();
    if (backup) await flush.current();
    const ticket = backup ? client.captureRestore() : null;
    const data_base64 = await (backup
      ? backupFileBase64(file)
      : fileBase64(file));
    client.assertCurrent();
    if (backup) {
      client.assertRestore(ticket, true);
      setRestore({ ticket, data: data_base64 });
      return;
    }
    const result = await transfer("/import", {
      name: file.name,
      data_base64,
      ...(selected &&
      state.items.find((i) => i.id === selected)?.kind === "folder"
        ? { parent_id: selected }
        : {}),
    });
    await refresh();
    const item = result.result?.item ?? result.item ?? result.result;
    if (item?.id && intent === selectionIntent.current) await open(item.id);
    else if (item?.id) { setImportedItem(item); setNotice(`Imported ${file.name}. Your current page stays open.`); }
    const warnings = result.result?.warnings ?? result.warnings;
    if (warnings?.length) setNotice(`Imported ${file.name}. ${warnings.join(" ")}`);
    } finally { if (!backup) { importing.current = false; if (client.current()) setImportBusy(false); } }
  };
  const create = (kind, returnFocus = document.activeElement) => act(async () => {
    await flush.current();
    client.assertCurrent();
    setDialog({ kind, returnFocus });
  });
  const items = useMemo(() => state?.items.filter(i => !i.deleted_at) ?? [], [state?.items]);
  const itemIndex = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const childrenByParent = useMemo(() => {
    const index = new Map();
    for (const item of items) {
      if (item.kind === 'record') continue;
      const siblings = index.get(item.parent_id) ?? [];
      siblings.push(item); index.set(item.parent_id, siblings);
    }
    return index;
  }, [items]);
  const navContexts = useMemo(() => navigationContexts(state?.items, state?.attachments), [state?.items, state?.attachments]);
  const item = itemIndex.get(selected);
  const currentRun = item && activeRun(state, item.id);
  return h(IdentityProvider, {client}, h(
    "div",
    { className: "ws-root" },
    h(
      "header",
      { ref: header, className: `ws-topbar${compactHeader ? " ws-topbar-compact" : ""}` },
      h("h1", null, h(Codicon, { name: "notebook" }), "Workspace"),
      h("span", { className: "ws-source" }, profile),
      !compactHeader && h(Action, { ...trackHeaderFocus, onClick: () => act(home) }, "Home"),
      !compactHeader && h(
        Action,
        { ...trackHeaderFocus, disabled: !state, onClick: () => create("page") },
        "New page",
      ),
      h(
        ActionMenu,
        { label: "Workspace menu", disabled: !state, showChevron: !compactHeader,
          triggerLabel: compactHeader ? h(Codicon, { name: "ellipsis", "aria-hidden": true }) : "Workspace menu",
          triggerProps: compactHeader ? { size: "icon-sm" } : {} },
        compactHeader && h(Action, { onClick: () => act(home) }, "Home"),
        compactHeader && h(Action, { disabled: !state, onClick: (_event, opener) => create("page", opener) }, "New page"),
        h(Action, { disabled: !state, onClick: () => act(async () => { await flush.current(); await refresh(); setError(""); }) }, "Reload state"),
        h(Action, { disabled: !state, onClick: (_event, opener) => setUsernameDialog({opener}) }, "set username"),
        h(
          Action,
          { disabled: !state, onClick: (_event, opener) => create("folder", opener) },
          "New folder",
        ),
        h(
          Action,
          { disabled: !state, onClick: (_event, opener) => create("database", opener) },
          "New database",
        ),
        h(
          Action,
          { disabled: !state || importBusy, onClick: () => importInput.current.click() },
          "Import",
        ),
        h(
          Action,
          { disabled: !state, onClick: () => act(() => download("/backup")) },
          "Back up Workspace",
        ),
        h(
          Action,
          { disabled: !state, onClick: () => backupInput.current.click() },
          "Restore backup",
        ),
      ),
    ),
    notice &&
      h(
        "div",
        { className: "ws-notice", role: "status" },
        notice,
        importedItem && h(Action, { onClick: () => act(() => open(importedItem.id)) }, "Open imported page"),
        !replacementLoad && h(Action, { variant: "text", onClick: () => setNotice("") }, "Dismiss notice"),
        replacementLoad &&
          h(
            Action,
            {
              onClick: () =>
                void loadReplacement(
                  replacementLoad.ticket,
                  replacementLoad.committed,
                ),
            },
            "Load replaced Workspace",
          ),
      ),
    error &&
      h(
        "div",
        { className: "ws-error", role: "alert" },
        h("p", null, operationError(error, errorContext)),
        operationError(error, errorContext) !== error && h("details", null, h("summary", null, "Technical details"), h("pre", null, error)),
        h(
          "div",
          { className: "ws-actions" },
          errorAction === "import" && h(Action, { onClick: () => importInput.current.click() }, "Choose another file"),
          errorAction === "load" && h(
            Action,
            {
              onClick: () =>
                act(async () => {
                  await refresh();
                  setError("");
                }),
            },
            "Reload state",
          ),
          errorContext?.retry && (!errorContext.itemId || errorContext.itemId === item?.id) && h(Action, {
            onClick: () => void errorContext.retry().then(() => setError("")).catch(err => report(err, errorContext)),
          }, "Retry thread list"),
          ["runStart", "runStatus"].includes(errorContext?.operation) && errorContext.itemId && errorContext.itemId !== item?.id && h(Action, {
            onClick: () => act(() => open(errorContext.itemId)),
          }, "Open run page"),
          ["runStart", "runStatus"].includes(errorContext?.operation) && errorContext.threadId && h(Action, {
            onClick: () => act(() => workflow.openThread(errorContext.threadId)),
          }, "Open linked thread"),
          h(
            Action,
            { variant: "text", onClick: () => setError("") },
            "Dismiss",
          ),
        ),
      ),
    h("input", {
      ref: importInput,
      type: "file",
      hidden: true,
      accept: ".md,.markdown,.csv,.docx,.pdf",
      onChange: (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        void upload(file).catch(err => report(err, { operation: "import", fileName: file?.name }));
      },
    }),
    importBusy && h("div", { className: "ws-notice", role: "status" }, "Importing file… You can keep browsing Workspace."),
    h("input", {
      ref: backupInput,
      type: "file",
      hidden: true,
      accept: ".zip,.json",
      onChange: (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        void upload(file, true).catch(err => report(err, "backup"));
      },
    }),
    !state
      ? h(
          "div",
          { className: "ws-home", role: "status" },
          queryState.error
            ? h(ErrorState, {
                title: "Workspace could not be loaded",
                description: h("p", { className: "ws-state-description max-w-prose text-center text-sm leading-5" },
                  "Check that the Workspace backend is enabled for this profile, then reload state."),
              })
            : h(
                "span",
                { className: "ws-loading" },
                h(GlyphSpinner, { ariaLabel: "Loading Workspace" }),
                "Loading Workspace…",
              ),
        )
      : h(
          "div",
          { className: "ws-body", ref: navigation.body, style: { "--ws-nav-width": `${navigation.width}px`, "--ws-pane-height": `${navigation.availableHeight || 640}px` } },
          h(
            "nav",
            { className: "ws-nav", "aria-label": "Workspace pages", "data-expanded": navExpanded },
            h(Action, { ref: navToggle, className: "ws-nav-toggle", variant: "ghost", "aria-expanded": navExpanded, "aria-controls": navId, onClick: () => setNavExpanded(v => !v) }, h(Codicon, { name: navExpanded ? "chevron-down" : "chevron-right" }), h("span", null, `Pages · ${item?.title ?? "Home"}`)),
            h("div", { className: "ws-nav-content", id: navId },
            h(WorkspaceSearch, { client, scope: state.scope_id, revision: state.revision,
              destination: `${selected ?? 'home'}:${trash}`, onOpen: open, contexts: navContexts }),
            h("h2", null, "Folders and pages"),
            items.length
              ? h(FolderNavigation, { childrenByParent, contexts: navContexts, onOpen: open, selected, scope: state.scope_id, reorder })
              : h("p", { className: "ws-empty" }, "Create your first page."),
            h("h2", null, "Recents"),
            h(
              "ul",
              null,
              (state.recents ?? []).map((recent) => {
                const row = itemIndex.get(typeof recent === "string" ? recent : (recent.item_id ?? recent.id));
                return (
                  row &&
                  h(
                    "li",
                    { key: row.id },
                    h(
                      Action,
                      { variant: "ghost", onClick: () => open(row.id),
                        "aria-label": navContexts.has(row.id) ? row.title : undefined,
                        "aria-describedby": navContexts.has(row.id) ? `ws-recent-context-${row.id}` : undefined },
                      h(NavigationLabel, { item: row, context: navContexts.get(row.id), descriptionId: `ws-recent-context-${row.id}` }),
                    ),
                  )
                );
              }),
            ),
            h(
              Action,
              {
                onClick: () => {
                  const intent = nextSelectionIntent();
                  act(async () => {
                    await flush.current();
                    if (intent !== selectionIntent.current) return;
                    setTrash(true);
                  }, () => intent === selectionIntent.current);
                },
              },
              `Trash (${state.items.filter((i) => i.deleted_at).length})`,
            ),
            ),
          ),
          h(NavigationResizeHandle, { navigation, controls: navId }),
          navigation.error && h("p", { className: "ws-status-announcement", role: "status" }, navigation.error),
          h(
            "main",
            { className: "ws-work", ref: workPane, tabIndex: -1, "aria-label": "Workspace content" },
            trash
              ? h(Trash, { state, command, onError: report, confirm })
              : item
                  ? h(Document, {
                      key: JSON.stringify([state.scope_id, item.id]),
                      item,
                      state,
                      client,
                      ctx,
                      drafts,
                      workflow,
                      command,
                      refresh,
                      onOpen: open,
                      onError: report,
                      sectionFeedback,
                      registerFlush,
                      flush,
                      confirm,
                      currentRun,
                      setDialog,
                    })
                  : h(Home, {
                      contexts: navContexts, itemIndex,
                      items,
                      state,
                      drafts,
                      onOpen: open,
                      create,
                      setDialog,
                    }),
          ),
        ),
    usernameDialog && h(UsernameDialog, {client, returnFocus:usernameDialog.opener, onClose:() => setUsernameDialog(null)}),
    dialog &&
      h(CreateDialog, {
        dialog,
        items,
        state,
        command,
        onClose: () => setDialog(null),
        onOpen: open,
        parentId: item?.kind === "folder" ? item.id : null,
      }),
    restore &&
      h(RestoreDialog, {
        client,
        ticket: restore.ticket,
        data: restore.data,
        onClose: () => setRestore(null),
        onCommitted: (ticket) => void loadReplacement(ticket),
        onRefused: (ticket) => void loadReplacement(ticket, false),
        onUseCurrent: (ticket) => void loadReplacement(ticket, "unknown"),
      }),
    confirmation &&
      h(FormDialog, {
        returnFocus: confirmation.returnFocus,
        title: confirmation.title,
        description: confirmation.description,
        confirm: confirmation.label,
        destructive: true,
        focusConfirm: true,
        onClose: () => setConfirmation(null),
        onSubmit: async () => {
          if (!confirmation.skipFlush) await flush.current();
          client.assertCurrent();
          await confirmation.action();
        },
      }),
  ));
}
function Home({ items, state, drafts, onOpen, create, setDialog, contexts, itemIndex }) {
  const descriptionPrefix = useId();
  const recoverable = drafts ? ["content", "title", "property", "discussion"].flatMap(field => drafts.list(state.scope_id, field)) : [];
  const pageRows = useMemo(() => items
    .filter(item => item.kind === "page" || item.kind === "database")
    .map(item => {
      const context = contexts?.get(item.id), description = `${descriptionPrefix}-${item.id}`;
      const parent = itemIndex?.get(item.parent_id);
      return h("li", { key: item.id, className: "ws-home-item" },
        h(Action, { variant: "link", "aria-describedby": description, onClick: () => onOpen(item.id) }, item.title),
        h("span", { className: "ws-home-location", "aria-hidden": true }, context?.caption ?? `${parent?.title || "Workspace"} · ${item.kind}`),
        h("span", { id: description, className: "ws-title-reader" }, context?.description ?? itemContext(item, items, state.attachments)));
    }),
    [items, state.attachments, onOpen, contexts, itemIndex, descriptionPrefix]);
  return h(
    "section",
    { className: "ws-home" },
    recoverable.length > 0 &&
      h(
        "section",
        { "aria-label": "Recoverable drafts" },
        h("h2", null, "Recoverable drafts"),
        h(
          "p",
          { className: "ws-muted" },
          "These local drafts belong to this exact connection, profile and Workspace. Open a page to recover or discard its draft; nothing is saved automatically.",
        ),
        h(
          "ul",
          null,
          recoverable.map((entry) => {
            const page = items.find((i) => i.id === entry.item_id);
            return h(
              "li",
              { key: `${entry.field ?? "content"}:${entry.item_id}:${entry.property_id ?? ""}` },
              page
                ? h(
                    Action,
                    { onClick: () => onOpen(page.id) },
                    `${entry.field === "title" ? "Recover title" : entry.field === "property" ? "Recover property" : entry.field === "discussion" ? "Continue feedback" : "Recover draft"}: ${page.title}${entry.property_id ? ` · ${state.items.find(i => i.id === page.database_id)?.columns?.find(c => c.id === entry.property_id)?.name ?? "Property"}` : ""}`,
                  )
                : h(
                    "span",
                    null,
                    `Draft for unavailable item ${entry.item_id}; restore the item from Trash to recover it.`,
                  ),
            );
          }),
        ),
      ),
    h("h2", null, "Your pages"),
    h(
      "p",
      { className: "ws-muted" },
      "Keep documents and databases together. Leave comments when you want Hermes to work on a page.",
    ),
    h(
      "div",
      { className: "ws-actions" },
      h(Action, { onClick: () => create("page") }, "New page"),
      h(Action, { onClick: () => create("database") }, "New database"),
    ),
    h(
      "ul",
      { className: "ws-list" },
      pageRows,
    ),
    h("h2", null, "Templates"),
    state.templates.length
      ? h(
          "ul",
          { className: "ws-list" },
          state.templates.map((t) =>
            h(
              "li",
              { key: t.id },
              h(Action, { onClick: () => setDialog({ template: t }) }, t.name),
            ),
          ),
        )
      : h(
          "p",
          { className: "ws-empty" },
          "Save a page or record as a template to reuse its content and properties.",
        ),
    h("h2", null, "Import and recovery"),
    h(
      "p",
      { className: "ws-muted" },
      "Import Markdown, CSV, Word (.docx) or text-based PDF. Word and PDF become editable content with their original attachments; exact layout and scanned-PDF OCR are not supported. Markdown and CSV exports are portable content. Use Back up Workspace to preserve comments, structure, history and attachments.",
    ),
  );
}
function Trash({ state, command, onError, confirm }) {
  const rows = state.items.filter((i) => i.deleted_at);
  return h(
    "section",
    { className: "ws-home" },
    h("h2", null, "Trash"),
    h(
      "p",
      { className: "ws-muted" },
      "Items stay here until you restore or permanently delete them. There is no automatic expiry.",
    ),
    !rows.length && h("p", { className: "ws-empty" }, "Trash is empty."),
    h(
      "ul",
      { className: "ws-list" },
      rows.map((item) =>
        h(
          "li",
          { key: item.id },
          h("strong", null, item.title),
          h("span", { className: "ws-muted" }, ` (${item.kind})`),
          h(
            "div",
            { className: "ws-actions" },
            h(
              Action,
              {
                onClick: () =>
                  void command("restore", { id: item.id }).catch(onError),
              },
              "Restore",
            ),
            h(
              Action,
              {
                onClick: () =>
                  confirm({
                    title: `Permanently delete ${item.title}?`,
                    description:
                      item.kind === "folder"
                        ? "This permanently deletes the folder and its contents, comments and attachments. This cannot be undone."
                        : "This permanently deletes this item, its comments and attachments. This cannot be undone.",
                    label: "Permanently delete",
                    action: () => command("purge", { id: item.id }),
                  }),
              },
              "Permanently delete",
            ),
          ),
        ),
      ),
    ),
  );
}
function CreateDialog({
  dialog,
  items,
  state,
  command,
  onClose,
  onOpen,
  parentId,
}) {
  const template = dialog.template;
  const kind = dialog.kind ?? "page";
  const fields = [
    {
      name: "title",
      label: template
        ? "New item title"
        : `${kind[0].toUpperCase() + kind.slice(1)} title`,
    },
    {
      name: "parent_id",
      label: "Folder",
      options: [
        ["", "Workspace root"],
        ...items.filter((i) => i.kind === "folder").map((i) => [i.id, i.title]),
      ],
    },
  ];
  if (template?.kind === "record")
    fields.push({
      name: "database_id",
      label: "Database for record template",
      options: [
        ["", "Page template"],
        ...items
          .filter((i) => i.kind === "database")
          .map((i) => [i.id, i.title]),
      ],
    });
  return h(FormDialog, {
    title: template ? `Use ${template.name}` : `New ${kind}`,
    returnFocus: dialog.returnFocus,
    initial: { parent_id: parentId ?? "" },
    fields,
    onClose,
    onSubmit: async (v) => {
      if (template?.kind === "record" && !v.database_id)
        throw new Error(
          "Choose a compatible database for this record template.",
        );
      const payload = {
        title: v.title,
        parent_id: template?.kind === "record" ? null : v.parent_id || null,
        ...(v.database_id ? { database_id: v.database_id } : {}),
      };
      const created = await command(
        template ? "apply_template" : "create_item",
        template
          ? { ...payload, template_id: template.id }
          : { ...payload, kind },
      );
      await onOpen(created.id);
    },
  });
}
function Document({
  item,
  state,
  client,
  ctx,
  drafts,
  workflow,
  command,
  refresh,
  onOpen,
  onError,
  sectionFeedback,
  registerFlush,
  flush,
  confirm,
  currentRun,
  setDialog,
}) {
  const [formatTarget, setFormatTarget] = useState(null),
    [toolbarTarget, setToolbarTarget] = useState(null),
    [commentTarget, setCommentTarget] = useState(null),
    [pageActions, setPageActions] = useState(null);
  const transferPageMenuFocus = useRef(false);
  const pageHeader = useRef(null);
  useLayoutEffect(() => {
    const header = pageHeader.current, pane = header?.closest(".ws-work");
    if (!pane) return;
    const previous = pane.style.scrollPaddingTop;
    const measure = () => {
      const height = header.offsetHeight + 12;
      pane.style.scrollPaddingTop = `${height}px`;
      header.closest(".ws-layout").style.setProperty("--ws-page-controls-height", `${height}px`);
    };
    measure();
    const observer = globalThis.ResizeObserver ? new ResizeObserver(measure) : null;
    observer?.observe(header);
    return () => { observer?.disconnect(); pane.style.scrollPaddingTop = previous; };
  }, []);
  const documentWidth = useDocumentWidth(ctx.storage, client.owner, state.scope_id, item.id);
  const draftBuffer = useMemo(
    () => drafts?.bind(state.scope_id, item.id) ?? null,
    [drafts, state.scope_id, item.id],
  );
  const discussionBuffer = useMemo(() => drafts?.bind(state.scope_id, item.id, "discussion") ?? null, [drafts, state.scope_id, item.id]);
  const retainedDiscussion = useMemo(() => discussionBuffer?.read()?.draft ?? null, [discussionBuffer]);
  const [scopeReview, setScopeReview] = useState(null);
  const [commentGeometry, setCommentGeometry] = useState([]), [hoveredComment, setHoveredComment] = useState(null);
  const receiveGeometry = useCallback(next => setCommentGeometry(old =>
    old.length === next.length && old.every((p,i) => p.id === next[i].id && p.block === next[i].block && p.slotBlock === next[i].slotBlock && p.lineGroup === next[i].lineGroup && JSON.stringify(p.anchor) === JSON.stringify(next[i].anchor) &&
      Math.abs(p.top-next[i].top)<0.5 && Math.abs(p.blockBottom-next[i].blockBottom)<0.5) ? old : next), []);
  const [pending, setPending] = useState(false);
  const submissionSequence = useRef(0);
  const [controlPending, setControlPending] = useState(false), controlOperation = useRef(false);
  const [sectionBusy, setSectionBusy] = useState(false), [sectionFrozen, setSectionFrozen] = useState(false), [sectionReview, setSectionReview] = useState(null);
  const sectionOperation = useRef(null);
  const pendingFiles = useRef(async () => {});
  const registerPendingFiles = useCallback(fn => { pendingFiles.current = fn; return () => { if (pendingFiles.current === fn) pendingFiles.current = async () => {}; }; }, []);
  const locked = Boolean(currentRun) || pending;
  const [text, setText] = useState(""),
    [anchor, setAnchor] = useState(() => retainedDiscussion?.anchor ?? null),
    [activeComment, setActiveComment] = useState(null),
    [showResolved, setShowResolved] = useState(() => state.comments.some(c => c.item_id === item.id && c.resolved && retainedDiscussion?.replies?.[c.id])),
    [localDialog, setLocalDialog] = useState(null);
  const localDialogOpener = useRef(null);
  const [pageSurface, setPageSurface] = useState(null), [surfaceBusy, setSurfaceBusy] = useState(false), [surfaceError, setSurfaceError] = useState("");
  const surfaceOpener = useRef(null), surfaceTransfer = useRef(false);
  const openPageSurface = (name, opener) => {
    surfaceOpener.current = opener ?? document.activeElement;
    surfaceTransfer.current = false; setSurfaceError(""); setPageSurface(name);
  };
  const openLocalDialog = (name, opener) => {
    localDialogOpener.current = opener ?? document.activeElement;
    setLocalDialog(name);
  };
  const attachment = useRef(null), editorFocus = useRef(null);
  const headingId = useId();
  const titleBuffer = useMemo(() => drafts?.bind(state.scope_id, item.id, "title") ?? null, [drafts, state.scope_id, item.id]);
  const editorFlushes = useRef({ title: async () => {}, body: async () => {}, discussion: async () => {} });
  const propertyFlushes = useRef(new Map());
  const propertyBuffer = useCallback((recordId, columnId) => drafts?.bind(state.scope_id, recordId, "property", columnId) ?? null, [drafts, state.scope_id]);
  const registerPropertyFlush = useCallback((id, fn) => {
    propertyFlushes.current.set(id, fn);
    return () => { if (propertyFlushes.current.get(id) === fn) propertyFlushes.current.delete(id); };
  }, []);
  const registerTitleFlush = useCallback(fn => {
    editorFlushes.current.title = fn;
    return () => { if (editorFlushes.current.title === fn) editorFlushes.current.title = async () => {}; };
  }, []);
  const registerDiscussionFlush = useCallback(fn => {
    editorFlushes.current.discussion = fn;
    return () => { if (editorFlushes.current.discussion === fn) editorFlushes.current.discussion = async () => {}; };
  }, []);
  const registerBodyFlush = useCallback(fn => {
    editorFlushes.current.body = fn;
    return () => { if (editorFlushes.current.body === fn) editorFlushes.current.body = async () => {}; };
  }, []);
  const flushEditors = async () => {
    try {
      await editorFlushes.current.title();
      await editorFlushes.current.body();
      await editorFlushes.current.discussion();
      for (const save of propertyFlushes.current.values()) await save();
    } catch (err) {
      if (err instanceof UnsavedEditError) err.focus();
      throw err;
    }
  };
  useEffect(() => registerFlush(async () => {
    if (sectionOperation.current) await sectionOperation.current;
    await flushEditors();
  }), [registerFlush]);
  const sectionTask = work => {
    if (sectionOperation.current) return sectionOperation.current;
    setSectionBusy(true);
    const operation = Promise.resolve().then(async () => {
      // An already-admitted image must settle before freezing its editor;
      // otherwise browser insertion into a read-only canvas would be lost.
      await pendingFiles.current();
      client.assertCurrent();
      setSectionFrozen(true);
      await new Promise(resolve => requestAnimationFrame(resolve));
      return work();
    }).finally(() => {
      sectionOperation.current = null;
      if (client.current()) { setSectionBusy(false); setSectionFrozen(false); }
    });
    sectionOperation.current = operation;
    return operation;
  };
  const applySection = (preview, confirmed, feedback) => sectionTask(async () => {
    await flushEditors();
    client.assertCurrent();
    const result = await command("revert_section", {
      version_id: preview.version_id, generation_id: preview.generation_id, change_id: preview.change_id,
      dataset_epoch: preview.dataset_epoch, content_hash: preview.content_hash, manual_revision: preview.manual_revision, confirmed,
    });
    sectionFeedback.complete(feedback, result);
  });
  const restoreSectionReading = reading => {
    if (!reading) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!client.current() || !reading.pane.isConnected) return;
      const editor = reading.pane.querySelector('.ws-editor[contenteditable]');
      const range = reading.anchor && editor && anchorRange(editor, reading.anchor);
      // Restore only an exact surviving selection, independently of changed
      // section text. Keep dialog/action focus and never guess a new passage.
      if (range) {
        const focused = document.activeElement, selection = getSelection();
        selection.removeAllRanges(); selection.addRange(range);
        focused?.focus?.({ preventScroll: true });
      }
      reading.pane.scrollTop = reading.top; reading.pane.scrollLeft = reading.left;
    }));
  };
  const revertSection = (comment, opener) => {
    const change = comment.section_change;
    if (!change || change.status !== "available" || locked) return;
    const feedback = sectionFeedback.begin(item.id, change);
    const pane = opener?.closest('.ws-work'), editor = pane?.querySelector('.ws-editor[contenteditable]');
    const reading = pane ? { pane, top: pane.scrollTop, left: pane.scrollLeft, anchor: editor && captureAnchor(editor) } : null;
    let reviewing = false;
    return sectionTask(async () => {
      await flushEditors();
      client.assertCurrent();
      const preview = await command("preview_section_revert", {
        version_id: change.version_id, generation_id: change.generation_id, change_id: change.change_id,
      });
      if (preview.requires_confirmation) {
        reviewing = true;
        setSectionReview({ preview, opener, commentId: comment.id, reading, feedback });
      }
      else {
        const result = await command("revert_section", {
          version_id: preview.version_id, generation_id: preview.generation_id, change_id: preview.change_id,
          dataset_epoch: preview.dataset_epoch, content_hash: preview.content_hash, manual_revision: preview.manual_revision, confirmed: false,
        });
        sectionFeedback.complete(feedback, result);
      }
    }).then(() => {
      if (!reviewing) restoreSectionReading(reading);
      requestAnimationFrame(() => {
        if (document.activeElement === document.body || document.activeElement === opener)
          document.getElementById(`ws-bubble-${comment.id}`)?.focus({ preventScroll: true });
      });
    }).catch(error => { restoreSectionReading(reading); onError(error, feedback.context); });
  };
  const pageComments = numberComments(state.comments.filter(
    c => c.item_id === item.id,
  ).map(c => ({ ...c, anchor: commentAnchor(c) })))
    .filter(c => showResolved || !c.resolved);
  const returnToEditor = () => editorFocus.current?.();
  const revealComment = (id) => {
    // The discussion becomes active; keep the saved editor Range, not a stale
    // browser selection that would mask the persistent passage decoration.
    getSelection()?.removeAllRanges();
    setActiveComment(id);
    requestAnimationFrame(() =>
      document
        .getElementById(`ws-discussion-${id}`)
        ?.focus({ preventScroll: true }),
    );
  };
  const lastRun = state.runs.filter((r) => r.item_id === item.id).at(-1);
  const runOutcome = useRunOutcomeDismissal(ctx.storage, client.owner, state.scope_id, item.id, lastRun);
  const database = state.items.find((i) => i.id === item.database_id);
  const versions = state.versions.filter((v) => v.item_id === item.id);
  const preRunVersions = versions.filter(v => !v.section_revert_of), sectionVersions = versions.filter(v => v.section_revert_of);
  const dialogVersions = localDialog === "section-version" ? sectionVersions : preRunVersions;
  const versionDialog = localDialog === "version" || localDialog === "section-version";
  const act = (fn) => void Promise.resolve().then(fn).catch(onError);
  const safeSave = useCallback(
    (html) => command("update_item", { id: item.id, patch: { content: html } }),
    [command, item.id],
  );
  const submitRun = async (explicitItemIds, review = null) => {
    client.assertCurrent();
    if (
      review &&
      (client.snapshot().scope_id !== review.scope_id ||
        client.snapshot().revision !== review.revision ||
        reviewScope(client.snapshot(), item.id).signature !== review.signature)
    )
      throw new Error(
        "Comments or target items changed. Close and review this run again.",
      );
    await flush.current();
    client.assertCurrent();
    if (
      review &&
      (client.snapshot().scope_id !== review.scope_id ||
        client.snapshot().revision !== review.revision ||
        reviewScope(client.snapshot(), item.id).signature !== review.signature)
    )
      throw new Error(
        "Comments or target items changed. Close and review this run again.",
      );
    const sequence = ++submissionSequence.current;
    setPending(true);
    try {
      await workflow.addressComments(item.id, explicitItemIds, review && {
        scope_id: review.scope_id, revision: review.revision,
      }, async () => {
        await refresh();
        if (client.current() && submissionSequence.current === sequence) setPending(false);
      });
    } finally {
      if (client.current()) {
        if (submissionSequence.current === sequence) setPending(false);
        await refresh();
      }
    }
  };
  const address = async () => {
    await flush.current();
    client.assertCurrent();
    const review = reviewScope(client.snapshot(), item.id);
    if (review.targets.length) setScopeReview(review);
    else await submitRun([]);
  };
  const runControl = async action => {
    if (controlOperation.current) return;
    controlOperation.current = true;
    setControlPending(true);
    try {
      await action();
    } finally {
      controlOperation.current = false;
      if (client.current()) {
        setControlPending(false);
        await refresh();
      }
    }
  };
  const attachmentDownload = (attachment) => {
    client.assertCurrent();
    downloadFile(attachment);
  };
  return h(
    "div",
    {
      className: `ws-layout${item.kind === "folder" ? " ws-folder-layout" : ""}${documentWidth.wide ? " ws-wide-document" : ""}`,
    },
    h("header", { ref: pageHeader, className: "ws-page-controls", "aria-label": "Page controls" },
      h("div", { ref: setFormatTarget, className: "ws-page-format-slot ws-rich-editor" }),
      item.kind !== "folder" && h("div", { ref: setCommentTarget, className: "ws-page-comment-controls" }),
        h(
          "div",
          { className: "ws-page-actions" },
          h(
            ActionMenu,
            { label: "Page actions", disabled: sectionBusy,
              onCloseAutoFocus: event => {
                if (transferPageMenuFocus.current) {
                  event.preventDefault(); transferPageMenuFocus.current = false;
                }
              },
              triggerLabel: h(Codicon, { name: "ellipsis", "aria-hidden": true }),
              showChevron: false,
              triggerProps: { id: `ws-page-actions-${item.id}`, className: "ws-page-control ws-page-menu-control", title: "Page actions" } },
            item.kind !== "folder" && h(Action, {
              disabled: locked || pageActions?.busy || !pageActions,
              onClick: () => { transferPageMenuFocus.current = true; pageActions?.compose(); },
            }, item.kind === "database" ? "Add database comment" : "Add whole-page comment"),
            item.kind !== "folder" && h(Action, {
              onClick: () => { transferPageMenuFocus.current = true; pageActions?.thread(); },
              disabled: !pageActions,
            }, "Page thread"),
            item.kind !== "folder" && h(Action, {
              onClick: (_event, opener) => openPageSurface("details", opener),
            }, "Page details"),
            item.kind !== "folder" && h(Action, {
              onClick: (_event, opener) => openPageSurface("export", opener),
            }, "Export and recovery"),
            ["page", "record"].includes(item.kind) && h(Action, {
              onClick: () => act(() => { client.assertCurrent(); documentWidth.toggle(); }),
            }, `Wide document mode: ${documentWidth.wide ? "On" : "Off"}`),
            ["page", "record"].includes(item.kind) &&
              h(
                Action,
                {
                  disabled: locked,
                  onClick: (_event, opener) =>
                    openLocalDialog("template", opener),
                },
                "Save as template",
              ),
            item.kind !== "record" &&
              h(
                Action,
                {
                  disabled: locked,
                  onClick: (_event, opener) => openLocalDialog("move", opener),
                },
                "Move to folder",
              ),
            h(
              Action,
              {
                disabled: locked,
                onClick: () =>
                  confirm({
                    title: `Move ${item.title} to Trash?`,
                    description:
                      item.kind === "folder"
                        ? "This folder and every page, database and record inside it move to Trash. You can restore them later."
                        : "You can restore this item from Trash.",
                    label: "Move to Trash",
                    action: () => command("trash", { id: item.id }),
                  }),
              },
              "Move to Trash",
            ),
          ),
        ),
      h("div", { ref: setToolbarTarget, className: "ws-page-toolbar-slot ws-rich-editor" })),
    scopeReview &&
      h(ScopeReviewDialog, {
        review: scopeReview,
        currentTitle: item.title,
        currentId: item.id,
        currentThreadId: item.thread_id,
        onClose: () => setScopeReview(null),
        onSubmit: (ids) => submitRun(ids, scopeReview),
      }),
    sectionBusy && h("div", { className: "ws-banner", role: "status" }, sectionFrozen ? "Reviewing the saved section… Editing will resume when this operation finishes." : "Finishing pending files before section review…"),
    sectionReview && h(FormDialog, {
      key: `${sectionReview.preview.content_hash}:${sectionReview.preview.manual_revision}`,
      title: "Revert section after manual edits?", confirm: "Revert section", destructive: true,
      submitDisabled: sectionReview.expired === true,
      errorSummary: sectionReview.expired
        ? "This review has expired. Choose Review section again to see the current section before reverting."
        : undefined,
      recoveryAction: sectionReview.expired ? { label: "Review section again", onClick: () => sectionTask(async () => {
        await flushEditors();
        client.assertCurrent();
        const old = sectionReview.preview;
        const preview = await command("preview_section_revert", {
          version_id: old.version_id, generation_id: old.generation_id, change_id: old.change_id,
        });
        // A refreshed preview is a new review, never permission to apply it.
        setSectionReview({ ...sectionReview, preview, expired: false });
      }) } : undefined,
      returnFocus: sectionReview.opener,
      description: "You edited this page after Hermes changed it. Reverting restores only this highlighted section and removes its associated AI responses. Manual edits inside it may be overwritten; every unrelated change and human reply stays intact. Saved history retains the recovery receipt.",
      renderHelp: () => h("div", { className: "ws-section-preview" },
        h("strong", null, "Current section"), h(RichPreview, { label: "Current section preview",
          html: sectionReview.preview.current_html, text: sectionReview.preview.current_text, attachments: state.attachments }),
        h("strong", null, "Restore this section"), h(RichPreview, { label: "Restored section preview",
          html: sectionReview.preview.before_html, text: sectionReview.preview.before_text, attachments: state.attachments }),
        sectionReview.preview.before_text === sectionReview.preview.current_text &&
          sectionReview.preview.before_html !== sectionReview.preview.current_html &&
          h("p", { className: "ws-muted" }, "The text is unchanged; the highlighted section’s formatting will change."),
        h("p", { className: "ws-muted" }, "If the page changes while this dialog is open, this approval expires. Cancel keeps all current changes.")),
      onClose: () => { setSectionReview(null); restoreSectionReading(sectionReview.reading); },
      onSubmit: async () => {
        try { await applySection(sectionReview.preview, true, sectionReview.feedback); }
        catch (error) {
          // Every failed application retires this approval. Re-read current
          // provenance/content before another explicit confirmation.
          setSectionReview(current => current?.preview === sectionReview.preview ? { ...current, expired: true } : current);
          throw error;
        }
      },
      onSuccessFocus: () => document.getElementById(`ws-bubble-${sectionReview.commentId}`)?.focus({ preventScroll: true }),
    }),
      locked &&
        h(
          "div",
          { className: "ws-banner ws-run-banner", role: "status", "aria-label": "Active Workspace run" },
          h(GlyphSpinner, { ariaLabel: "Hermes is working" }),
          h(
            "strong",
            null,
            currentRun
              ? "Read-only while Hermes addresses comments"
              : "Preparing comment run…",
          ),
          h(
            "span",
            null,
            typeof currentRun?.progress === "string"
              ? currentRun.progress
              : (currentRun?.status ??
                  "Editing is disabled while this run is prepared."),
          ),
          currentRun &&
            h(Action, { disabled: controlPending, onClick: () => act(() => runControl(() => workflow.stop(currentRun))) }, "Stop"),
          currentRun &&
            h(
              Action,
              {
                disabled: controlPending,
                onClick: () =>
                  confirm({
                    title: "Recover document?",
                    description:
                      "The native thread may continue. This revokes its Workspace edit authority and unlocks this document. Saved partial changes and the pre-run version remain available for Restore. The native outcome remains unknown; this does not confirm the thread stopped.",
                    label: "Revoke Workspace edits",
                    skipFlush: true,
                    action: () => runControl(() => workflow.recover(currentRun)),
                  }),
              },
              "Recover document",
            ),
        ),
    lastRun && !locked && lastRun.status !== "completed" && !runOutcome.dismissed &&
      h("div", { className: "ws-banner ws-run-banner ws-outcome", role: "status", "aria-label": "Workspace run needs review" },
        h("strong", null, lastRun.status === "cancelled" ? "Run stopped — review saved changes" : "Run needs review"),
        h("span", null, lastRun.error?.startsWith("The native turn ended, but its proposed edits were not saved:")
          ? "The Hermes turn ended. Its proposed edits were not saved."
          : "Saved changes may be partial. The native thread may still be running."),
        h("div", { className: "ws-actions" },
          h(Action, { disabled: !preRunVersions.length, onClick: event => openLocalDialog("version", event.currentTarget) }, "Restore pre-run version"),
          h(Action, { disabled: !item.thread_id, onClick: () => act(() => workflow.openThread(item.thread_id)) }, "Open run thread"),
          h(Action, { "aria-label": "Dismiss run message", onClick: () => { runOutcome.dismiss(); returnToEditor(); } }, "Dismiss")),
        h("details", null, h("summary", null, "Run outcome details"),
          h("p", null, lastRun.error ? errorMessage(lastRun.error) : `Last run: ${lastRun.status}. Saved partial changes may remain.`),
          h("p", null, "Restoring Workspace content does not confirm that the native thread stopped. Comments remain yours to resolve."))),
    h(
      "article",
      { className: "ws-document", "aria-labelledby": headingId },
      lastRun?.status === "completed" && !locked &&
        h("div", { className: "ws-save", role: "status" }, "Last run completed. Comments remain yours to resolve."),
      h("div", { className: "ws-document-header" },
        h(
          "div",
          { className: "ws-page-kind" },
          h(Codicon, {
            name:
              item.kind === "database"
                ? "table"
                : item.kind === "folder"
                  ? "folder"
                  : "file-text",
          }),
          item.kind === "record"
            ? "Record"
            : item.kind === "database"
              ? "Database"
              : item.kind === "folder"
                ? "Folder"
                : "Page",
        ),
        h(PageTitle, { item, locked, interactionBlocked: sectionFrozen, buffer: titleBuffer, headingId,
          registerFlush: registerTitleFlush, onError,
          onSave: title => command("update_item", { id: item.id, patch: { title } }),
        }),

      ),
      documentWidth.error && h("p", { className: "ws-muted", role: "status" }, documentWidth.error),
      item.kind === "folder"
        ? h(
            "section",
            null,
            h("h2", null, "In this folder"),
            h(
              "div",
              { className: "ws-actions" },
              h(
                Action,
                { onClick: () => setDialog({ kind: "page" }) },
                "New page",
              ),
              h(
                Action,
                { onClick: () => setDialog({ kind: "folder" }) },
                "New subfolder",
              ),
              h(
                Action,
                { onClick: () => setDialog({ kind: "database" }) },
                "New database",
              ),
            ),
            h(
              "ul",
              { className: "ws-list" },
              state.items
                .filter((i) => !i.deleted_at && i.parent_id === item.id)
                .map((i) =>
                  h(
                    "li",
                    { key: i.id },
                    h(
                      Action,
                      { variant: "link", onClick: () => onOpen(i.id) },
                      i.title,
                    ),
                  ),
                ),
            ),
          )
        : h(
            "div",
            null,
            item.kind === "record" &&
              h(
                "div",
                null,
                database &&
                  h(
                    Action,
                    { variant: "link", onClick: () => onOpen(database.id) },
                    database.title,
                  ),
                h(RecordProperties, {
                  item,
                  database,
                  propertyBuffer,
                  registerPropertyFlush,
                  state,
                  command,
                  locked,
                  interactionBlocked: sectionFrozen,
                  onError,
                }),
              ),
            item.kind === "database"
              ? h(Database, {
                  item,
                  propertyBuffer,
                  registerPropertyFlush,
                  state,
                  command,
                  onOpen,
                  onError,
                  locked,
                  confirm,
                })
              : h(RichEditor, {
                  formatTarget, toolbarTarget,
                  item,
                  registerKeybind: ctx.register,
                  workspaceItems: state.items,
                  locked,
                  interactionBlocked: sectionFrozen,
                  registerPendingFiles,
                  onSave: safeSave,
                  onText: setText,
                  registerFlush: registerBodyFlush,
                  onError,
                  draftBuffer,
                  attachments: state.attachments,
                  onImage: async (file) => {
                    const data_base64 = await fileBase64(file);
                    client.assertCurrent();
                    return command("add_attachment", {
                      item_id: item.id,
                      name: file.name,
                      media_type: file.type,
                      data_base64,
                    });
                  },
                  onLink: (url) => act(() => ctx.os.openExternal(url)),
                  comments: pageComments,
                  activeComment,
                  hoveredComment,
                  onCommentHover: setHoveredComment,
                  onCommentGeometry: receiveGeometry,
                  pendingAnchor: anchor,
                  onComment: revealComment,
                  registerFocus: (focus) => {
                    editorFocus.current = focus;
                  },
                  onAnchor: (value) =>
                    value.navigate ? onOpen(value.navigate) : setAnchor(value),
                }),
            h("input", {
              ref: attachment,
              type: "file",
              hidden: true,
              onChange: (e) => {
                const file = e.target.files[0];
                e.target.value = "";
                if (file)
                  act(async () => {
                    const data_base64 = await fileBase64(file);
                    client.assertCurrent();
                    await command("add_attachment", {
                      item_id: item.id,
                      name: file.name,
                      media_type: file.type || "application/octet-stream",
                      data_base64,
                    });
                  });
              },
            }),
            h(
              "div",
              { className: "ws-attachments" },
              h("h2", null, "Attachments"),
              attachmentLabels(state.attachments.filter((a) => a.item_id === item.id))
                .map(({ attachment: a, label, detail }) =>
                  h(
                    "div",
                    { key: a.id },
                    h(
                      Action,
                      { variant: "link", "aria-describedby": `ws-attachment-${a.id}`, onClick: () => attachmentDownload(a) },
                      label,
                    ),
                    h("span", { id: `ws-attachment-${a.id}`, className: "ws-muted ws-attachment-detail" }, detail),
                  ),
                ),
            ),
          ),
      pageSurface && h(ContentDialog, {
        title: pageSurface === "details" ? "Page details" : "Export and recovery",
        description: item.title,
        returnFocus: surfaceOpener.current,
        busy: surfaceBusy,
        skipReturnFocus: () => surfaceTransfer.current,
        onClose: () => { if (!surfaceBusy) setPageSurface(null); },
      }, pageSurface === "details"
        ? h("p", { className: "ws-muted ws-item-id" }, `Workspace item ID: ${item.id}`)
        : h("div", { className: "ws-page-utilities" },
            h("h3", null, item.kind === "database" ? "Export table" : "Export document"),
            h("div", { className: "ws-actions" },
              ["md", "csv", "docx", "pdf"]
                .filter(format => item.kind === "database" ? format === "csv" : format !== "csv")
                .map(format => h(Action, {
                  key: format, disabled: surfaceBusy,
                  onClick: async () => {
                    if (surfaceBusy) return;
                    setSurfaceBusy(true); setSurfaceError("");
                    try {
                      await flush.current();
                      const result = await client.transfer(`/export/${encodeURIComponent(item.id)}?format=${format}`);
                      client.assertCurrent();
                      downloadFile(result.download ?? result.result ?? result);
                    } catch (error) { setSurfaceError(errorMessage(error)); }
                    finally { setSurfaceBusy(false); }
                  },
                }, `Export ${format.toUpperCase()}`))),
            h("p", { className: "ws-muted" }, "Document exports are not a full Workspace backup. Use the Workspace menu for a complete backup."),
            h("h3", null, "Attachments and recovery"),
            h("div", { className: "ws-actions" },
              h(Action, { disabled: locked || surfaceBusy, onClick: () => attachment.current.click() }, "Attach file"),
              h(Action, { disabled: locked || surfaceBusy || !preRunVersions.length,
                onClick: () => {
                  surfaceTransfer.current = true; setPageSurface(null);
                  openLocalDialog("version", surfaceOpener.current);
                },
              }, "Restore pre-run version"),
              sectionVersions.length > 0 && h(Action, { disabled: locked || surfaceBusy,
                onClick: () => {
                  surfaceTransfer.current = true; setPageSurface(null);
                  openLocalDialog("section-version", surfaceOpener.current);
                },
              }, "Recover before section revert")),
            surfaceBusy && h("p", { role: "status" }, "Preparing export…"),
            surfaceError && h("p", { role: "alert", className: "ws-save-error" }, surfaceError))),
      localDialog &&
        h(FormDialog, {
          returnFocus: localDialogOpener.current,
          confirm: versionDialog ? localDialog === "section-version" ? "Restore whole-page version" : "Restore pre-run version" : "Save",
          title:
            localDialog === "template"
              ? "Save template"
              : localDialog === "move"
                ? "Move to folder"
                : localDialog === "section-version" ? "Recover before section revert" : "Restore pre-run version",
          description:
            versionDialog
              ? localDialog === "section-version" ? "This restores the whole page, title and properties saved immediately before a section revert. It can replace later changes elsewhere on the page. Comments and replies remain user controlled." : "Restoring replaces the saved content and properties with the snapshot from before that run. Comments remain user controlled."
              : undefined,
          fields:
            localDialog === "template"
              ? [{ name: "name", label: "Template name" }]
              : localDialog === "move"
                ? [
                    {
                      name: "parent_id",
                      label: "Destination folder",
                      options: folderDestinations(state.items, item.id),
                    },
                  ]
                : [
                    {
                      name: "id",
                      label: localDialog === "section-version" ? "Before section revert" : "Pre-run version",
                      options: versionChoices(dialogVersions),
                    },
                  ],
          initial:
            localDialog === "move"
              ? { parent_id: item.parent_id ?? "" }
              : versionDialog
                ? { id: dialogVersions.at(-1)?.id }
                : {},
          onClose: () => setLocalDialog(null),
          renderHelp: versionDialog ? values => {
            const version = dialogVersions.find(row => row.id === values.id);
            return version && h("details", null, h("summary", null, "Version details"),
              h("p", null, "Exact saved time: ", h("time", { dateTime: version.created_at }, version.created_at)),
              h("p", null, "Version ID: ", h("code", null, version.id)));
          } : undefined,
          onSubmit: async (values) => {
            await flush.current();
            if (localDialog === "template")
              await command("save_template", {
                item_id: item.id,
                name: values.name,
              });
            else if (localDialog === "move")
              await command("update_item", {
                id: item.id,
                patch: { parent_id: values.parent_id || null },
              });
            else await command("restore_version", { id: values.id });
          },
        }),
    ),
    item.kind !== "folder" &&
      h(Comments, {
        controlsTarget: commentTarget,
        onPageActionsChange: setPageActions,
        key: item.id,
        item,
        draftBuffer: discussionBuffer,
        registerFlush: registerDiscussionFlush,
        state,
        text,
        anchor,
        setAnchor,
        activeComment,
        setActiveComment,
        geometry: commentGeometry,
        hoveredComment,
        setHoveredComment,
        showResolved,
        setShowResolved,
        returnToEditor,
        onPassage: (id, passage) => {
          setActiveComment(id);
          editorFocus.current?.(passage);
        },
        command,
        workflow,
        run: lastRun,
        locked: locked || pending || sectionBusy,
        onRevertSection: revertSection,
        onError,
        onRun: address,
        onRefresh: refresh,
      }),
  );
}
