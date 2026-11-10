import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Checkbox, SearchField } from "@hermes/plugin-sdk";
import { h, Action, ActionMenu, ContextPopover, ContextTip, Field, Choice, Input, Codicon, isSubmitEnter, errorMessage, UnsavedEditError } from "./ui.jsx";
import { databaseGridStyles } from "./database-grid-styles.mjs";
import { itemLabel } from "./item-labels.mjs";
import {
  tableRows,
  boardGroups,
  activeRun,
  propertyPatch,
} from "./database.mjs";
export function Property({ column, value, onChange, state, disabled: authorityDisabled, interactionBlocked = false, buffer, registerFlush, formulaError, onSettled, compact = false }) {
  const disabled = authorityDisabled || interactionBlocked;
  const initial = useRef(buffer?.read() ?? null), recovery = useRef(Boolean(initial.current));
  const scalar = ["text", "number", "date"].includes(column.type);
  const display = next => scalar ? String(next ?? "") : next;
  const [draft, setDraft] = useState(() => initial.current ? initial.current.value : display(value));
  const [status, setStatus] = useState(initial.current ? "Property draft retained. Retry or discard it." : ""), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), container = useRef(null), mounted = useRef(true);
  const returnFocus = useRef(null);
  const dirty = useRef(null), revision = useRef(0), saving = useRef(Promise.resolve()), pending = useRef(0);
  const latest = useRef(null); latest.current = { onChange, disabled: authorityDisabled, buffer };
  const errorId = useId(), focus = () => container.current?.querySelector("input,button,textarea")?.focus();
  useEffect(() => {
    if (busy || !returnFocus.current) return;
    const opener = returnFocus.current;
    returnFocus.current = null;
    if (document.activeElement === document.body || document.activeElement === opener) focus();
  }, [busy, status, error]);
  const normalize = raw => column.type === "number" ? raw === "" ? null : Number(raw) : column.type === "date" && raw === "" ? null : raw;
  const flush = () => {
    if (recovery.current) return Promise.reject(new UnsavedEditError(`Review the retained ${column.name} property before leaving.`, focus));
    if (!dirty.current) return saving.current;
    const snapshot = dirty.current, save = latest.current.onChange, savedBuffer = latest.current.buffer;
    dirty.current = null; pending.current++; setBusy(true); setStatus("Saving property…"); setError("");
    const promise = saving.current.catch(() => {}).then(async () => {
      if (latest.current.disabled) throw Error("This property is read-only while Hermes is working.");
      await save(normalize(snapshot.value));
    }).then(() => {
      if (snapshot.token) savedBuffer?.acknowledge(snapshot.token);
      if (mounted.current && snapshot.revision === revision.current) { setDraft(display(normalize(snapshot.value))); setStatus(""); setError(""); }
    }, err => {
      if (snapshot.revision === revision.current) {
        if (!dirty.current) dirty.current = snapshot;
        if (mounted.current) { setStatus("Property not saved."); setError(errorMessage(err)); }
      }
      throw new UnsavedEditError(`${column.name} not saved: ${errorMessage(err)}`, focus);
    }).finally(() => { pending.current--; if (mounted.current) setBusy(pending.current > 0); onSettled?.(); });
    saving.current = promise; promise.catch(() => {}); return promise;
  };
  const change = (next, immediate = false) => {
    revision.current++; recovery.current = false; setDraft(next); setStatus("Unsaved property"); setError("");
    const snapshot = { value: next, revision: revision.current, token: null }; dirty.current = snapshot;
    try { snapshot.token = buffer?.put(next, value)?.token ?? null; }
    catch (err) { setError(errorMessage(err)); }
    if (immediate) void flush().catch(() => {});
  };
  useEffect(() => column.type !== "formula" ? registerFlush?.(flush) : undefined, [registerFlush, column.type]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const encoded = JSON.stringify(value);
  useEffect(() => {
    if (!dirty.current && pending.current === 0 && !recovery.current) setDraft(display(value));
    else if (recovery.current && !buffer?.read() && JSON.stringify(normalize(draft)) === JSON.stringify(value)) {
      recovery.current = false; setDraft(display(value)); setStatus(""); setError("");
    }
  }, [encoded, buffer]);
  if (column.type === "formula") return h("div", { className: "ws-formula-value" },
    h("output", { "aria-label": column.name, "aria-invalid": Boolean(formulaError), "aria-describedby": formulaError ? errorId : undefined }, formulaError ? "Calculation failed" : String(value ?? "—")),
    formulaError && h("span", { id: errorId, className: "ws-field-error", role: "alert" }, errorMessage(formulaError)));
  const accessibility = { "aria-invalid": Boolean(error), "aria-describedby": status || error ? errorId : undefined };
  let control;
  if (column.type === "checkbox") control = h(Checkbox, { ...accessibility, className: "ws-checkbox", "aria-label": column.name, checked: Boolean(draft), disabled, onCheckedChange: v => change(v === true, true) });
  else if (column.type === "select") {
    const options = column.options ?? [];
    let emptyLabel = "No value";
    while (options.includes(emptyLabel)) emptyLabel += " (clear)";
    control = h(Choice, { triggerProps: accessibility, label: column.name, showLabel: false, value: draft ?? "", disabled,
      options: [["", emptyLabel], ...options], onChange: next => change(next === "" ? null : next, true) });
  }
  else if (column.type === "relation") {
    const records = state.items.filter(i => !i.deleted_at && i.kind === "record" && i.database_id === column.target_database_id);
    const selected = Array.isArray(draft) ? draft : [];
    const choices = h("div", { ...accessibility, role: "group", "aria-label": column.name }, records.length ? records.map(record => h("label", { key: record.id, className: "ws-check" },
      h(Checkbox, { ...accessibility, className: "ws-checkbox", "aria-label": `${column.name}: ${record.title}`, disabled, checked: selected.includes(record.id),
        onCheckedChange: checked => change(checked ? [...selected, record.id] : selected.filter(id => id !== record.id), true) }), record.title)) : h("span", { className: "ws-muted" }, "No records in related database."));
    control = compact ? h(RelationPicker, { accessibility, disabled, column, records, selected }, choices) : choices;
  } else control = h(Input, { "aria-label": column.name, "aria-invalid": Boolean(error), "aria-describedby": status || error ? errorId : undefined, disabled,
    type: column.type === "number" ? "number" : column.type === "date" ? "date" : "text", value: draft ?? "",
    onChange: event => change(event.target.value), onBlur: () => { if (!recovery.current && !error) void flush().catch(() => {}); },
    onKeyDown: event => { if (isSubmitEnter(event)) event.currentTarget.blur(); } });
  return h("div", { ref: container, className: "ws-property" }, control,
    (status || error) && h("div", { id: errorId, className: "ws-property-status", role: error ? "alert" : "status" }, error ? `Property not saved. ${error}` : status,
      (error || recovery.current) && h("div", { className: "ws-actions" },
        h(Action, { disabled: disabled || busy, onMouseDown: event => event.preventDefault(), onClick: event => {
          returnFocus.current = event.currentTarget;
          if (recovery.current) { recovery.current = false; revision.current++; dirty.current = { value: draft, revision: revision.current, token: buffer?.read()?.token }; }
          void flush().catch(() => {});
        } }, "Retry property save"),
        h(Action, { disabled: disabled || busy, variant: "text", onMouseDown: event => event.preventDefault(), onClick: event => {
          returnFocus.current = event.currentTarget;
          revision.current++; dirty.current = null; recovery.current = false; saving.current = saving.current.catch(() => {}); buffer?.discard(); setDraft(display(value)); setStatus(""); setError("");
        } }, "Discard property draft"))));
}
function RelationPicker({ accessibility, disabled, column, records, selected, children }) {
  const [open, setOpen] = useState(false);
  return h(ContextPopover, { open, onOpenChange: setOpen, className: "ws-db-relation-popover", align: "start",
    trigger: h(Action, { ...accessibility, variant: "ghost", disabled, "aria-label": column.name, className: "ws-db-relation-trigger" },
      selected.length ? records.filter(r => selected.includes(r.id)).map(r => r.title).join(", ") : "Choose records…") }, children);
}
export function RecordProperties({
  item,
  database,
  state,
  command,
  locked,
  onError,
  propertyBuffer,
  registerPropertyFlush,
  interactionBlocked = false,
}) {
  const [, advanceDrafts] = useState(0);
  const settled = useCallback(() => advanceDrafts(version => version + 1), []);
  return h(
    "div",
    { className: "ws-properties" },
    (database?.columns ?? []).map((column) =>
      h(
        "div",
        { className: "ws-field", key: column.id },
        h("span", { className: "ws-label" }, column.name),
        h(Property, {
          key: column.id,
          buffer: propertyBuffer?.(item.id, column.id),
          registerFlush: fn => registerPropertyFlush?.(`${item.id}:${column.id}`, fn),
          formulaError: item.formula_errors?.[column.id],
          onSettled: settled,
          column,
          value: item.properties?.[column.id],
          state,
          disabled: locked,
          interactionBlocked,
          onChange: (value) =>
            command("update_item", (latest) =>
              propertyPatch(latest, item.id, column.id, value),
            ),
        }),
      ),
    ),
  );
}
const propertyIcons = { text: "symbol-string", number: "symbol-number", checkbox: "check", date: "calendar", select: "list-selection", relation: "link", formula: "symbol-operator" };
const propertyTypes = [["text", "Text"], ["number", "Number"], ["checkbox", "Checkbox"], ["date", "Date"], ["select", "Single select"], ["relation", "Relation"], ["formula", "Formula"]];

function PropertyCreator({ item, state, command, locked, registerFlush }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const empty = () => ({ name: "", type: "text", options: "", target: "", formula: "" });
  const [values, setValues] = useState(empty), gate = useRef(false), alive = useRef(true), composing = useRef(false);
  const input = useRef(null), form = useRef(null), errorId = useId();
  const closePending = useRef(false), reopenAfterClose = useRef(false);
  const latest = useRef(null); latest.current = { item, state, command, locked, values, error, busy };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => registerFlush?.(`creation:property:${item.id}`, async () => {
    const value = latest.current;
    const dirty = Object.entries(value.values).some(([key, text]) => key === "type" ? text !== "text" : Boolean(text));
    if (value.busy || value.error || dirty) throw new UnsavedEditError("Finish or cancel the new property before leaving this database.", () => { if (closePending.current) reopenAfterClose.current = true; else { setOpen(true); requestAnimationFrame(() => input.current?.focus()); } });
  }), [registerFlush, item.id]);
  const fieldProps = field => ({ "aria-invalid": error?.field === field, "aria-describedby": error?.field === field ? errorId : undefined });
  const invalid = (field, message) => Object.assign(Error(message), { propertyField: field });
  useEffect(() => {
    if (error?.field && !busy && (document.activeElement === document.body || form.current?.contains(document.activeElement)))
      form.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [error, busy]);
  const change = name => event => { setValues(old => ({ ...old, [name]: event.target.value })); setError(null); };
  const cancel = () => { if (gate.current) return; setOpen(false); setValues(empty()); setError(null); };
  return h(ContextPopover, { open, onOpenChange: next => { if (!gate.current) { if (!next) closePending.current = true; setOpen(next); } },
    onCloseAutoFocus: event => { closePending.current = false; if (reopenAfterClose.current) { reopenAfterClose.current = false; event.preventDefault(); setOpen(true); } },
    trigger: h(Action, { variant: "ghost", disabled: locked || busy, "aria-label": "Add property", className: "ws-db-add-property" }, h(Codicon, { name: "add", "aria-hidden": true }), "Add property"),
    className: "ws-db-property-popover", align: "end", side: "bottom",
    onEscapeKeyDown: event => { if (gate.current || composing.current || event.isComposing || event.keyCode === 229) event.preventDefault(); },
    onOpenAutoFocus: event => { event.preventDefault(); requestAnimationFrame(() => input.current?.focus({ preventScroll: true })); } },
      h("form", { ref: form, "aria-label": "New property", "aria-busy": busy, "aria-describedby": error && !error.field ? errorId : undefined,
        onCompositionStart: () => { composing.current = true; }, onCompositionEnd: () => { composing.current = false; },
        onKeyDown: event => { if (event.key === "Enter" && (composing.current || !isSubmitEnter(event) || event.repeat || event.ctrlKey || event.metaKey || event.altKey)) event.preventDefault(); },
        onSubmit: async event => {
          event.preventDefault(); if (gate.current || latest.current.locked || composing.current) return;
          if (!values.name.trim()) { setError({ field: "name", message: "Enter a property name." }); input.current?.focus(); return; }
          gate.current = true; setBusy(true); setError(null);
          try {
            const column = { id: "col_" + crypto.randomUUID().replaceAll("-", ""), name: values.name.trim(), type: values.type };
            if (column.type === "select") { column.options = values.options.split(",").map(v => v.trim()).filter(Boolean); if (!column.options.length) throw invalid("options", "Enter at least one select option."); if (new Set(column.options).size !== column.options.length) throw invalid("options", "Use each select option only once."); }
            if (column.type === "relation") { if (!values.target) throw invalid("target", "Choose a related database."); column.target_database_id = values.target; }
            if (column.type === "formula") { if (!values.formula.trim()) throw invalid("formula", "Enter a formula expression."); column.formula = values.formula; }
            const id = latest.current.item.id;
            await latest.current.command("set_columns", current => ({ id, columns: [...current.items.find(i => i.id === id).columns, column] }));
            if (alive.current) { setOpen(false); setValues(empty()); }
          } catch (err) {
            if (alive.current) {
              const message = errorMessage(err);
              // Present only known field-validation diagnostics at that field;
              // unknown/transport/revision/authority failures stay form-level.
              const formulaValidation = /^(?:Formula (?:must contain|nesting limit|node limit|dependency)|Invalid formula syntax$|Unsupported formula operation$|Unknown formula column|Private names are forbidden$|Wrong number of function arguments$|col requires a literal column name or id$)/.test(message);
              const field = err.propertyField ?? (values.type === "formula" && formulaValidation ? "formula" : /^Select options|^select option must/.test(message) ? "options" : message === "Relation target must be a Workspace database" ? "target" : /^(?:Column IDs and names must be unique|Column names\/IDs must be unambiguous|column name must)/.test(message) ? "name" : message === "Unsupported property type" ? "type" : null);
              setError({ field, message });
            }
          }
          finally { gate.current = false; if (alive.current) setBusy(false); }
        } },
        h("h3", null, "New property"),
        h("div", { className: "ws-db-property-fields" },
        h(Field, { ref: input, label: "Property name", value: values.name, required: true, maxLength: 200, disabled: locked || busy, ...fieldProps("name"), onChange: change("name") }),
        h(Choice, { label: "Property type", triggerProps: fieldProps("type"), value: values.type, options: propertyTypes, disabled: locked || busy, onChange: value => { setValues(old => ({ ...old, type: value })); setError(null); } }),
        values.type === "select" && h(Field, { label: "Select options (comma separated)", ...fieldProps("options"), value: values.options, disabled: locked || busy, placeholder: "To do, In progress, Done", onChange: change("options") }),
        values.type === "relation" && h(Choice, { label: "Related database", triggerProps: fieldProps("target"), value: values.target, disabled: locked || busy,
          options: [["", "Choose database"], ...state.items.filter(i => i.kind === "database" && !i.deleted_at).map(i => [i.id, itemLabel(i, state.items, state.attachments)])],
          onChange: value => { setValues(old => ({ ...old, target: value })); setError(null); } }),
        values.type === "formula" && h(Field, { label: "Formula expression", ...fieldProps("formula"), value: values.formula, disabled: locked || busy, onChange: change("formula") }),
        values.type === "formula" && h("details", null, h("summary", null, "Formula syntax and column IDs"), h(FormulaHelp, { columns: item.columns ?? [] })),
        error && h("p", { id: errorId, role: "alert", className: "ws-field-error" }, error.message),
        locked && h("p", { className: "ws-muted", role: "status" }, "Properties are read-only while Hermes is working.")),
        h("div", { className: "ws-db-form-actions" }, h(Action, { disabled: busy, onClick: cancel }, "Cancel"),
          h(Action, { type: "submit", disabled: locked || busy || !values.name.trim() }, busy ? "Adding…" : "Add property"))));
}

function NewRecordCreator({ draft, locked, onDraft, onCreate, onCancel, label = "New record", groupKey, onFocus }) {
  const form = useRef(null), input = useRef(null), composing = useRef(false);
  const titleId = useId(), messageId = useId();
  useEffect(() => {
    if (draft.open && !draft.busy && (document.activeElement === document.body || form.current?.contains(document.activeElement))) {
      form.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      input.current?.focus({ preventScroll: true });
    }
  }, [draft.open, draft.busy]);
  if (!draft.open) return h(Action, { variant: "ghost", className: "ws-db-new-record", disabled: locked, "aria-label": label, "data-group-key": groupKey, onFocus, onPointerDown: onFocus,
    onClick: () => onDraft({ ...draft, open: true, error: "", status: "" }) }, h(Codicon, { name: "add", "aria-hidden": true }), "New record");
  return h("form", { ref: form, className: "ws-db-record-draft", "aria-label": label, "aria-busy": draft.busy, onFocusCapture: onFocus, onPointerDownCapture: onFocus,
    onCompositionStart: () => { composing.current = true; }, onCompositionEnd: () => { composing.current = false; },
    onKeyDown: event => {
      if (event.key === "Escape" && !draft.busy && !composing.current && !event.isComposing && !event.nativeEvent?.isComposing) { event.preventDefault(); event.stopPropagation(); onCancel(); }
      if (event.key === "Enter" && (composing.current || !isSubmitEnter(event) || event.repeat || event.ctrlKey || event.metaKey || event.altKey)) event.preventDefault();
    }, onSubmit: event => { event.preventDefault(); if (!composing.current) void onCreate(); } },
    h("label", { className: "ws-db-draft-label", htmlFor: titleId }, "New record"),
    h(Input, { ref: input, id: titleId, "aria-label": "New record title", "aria-describedby": draft.error || draft.status ? messageId : undefined, placeholder: "Enter record title…", value: draft.title, maxLength: 500,
      required: true, disabled: locked || draft.busy, "aria-invalid": Boolean(draft.error),
      onChange: event => onDraft({ ...draft, title: event.target.value, error: "", status: "" }) }),
    h("div", { className: "ws-db-form-actions" }, h(Action, { type: "submit", disabled: locked || draft.busy || !draft.title.trim() }, draft.busy ? "Creating…" : "Create record"),
      h(Action, { "aria-label": "Cancel new record", disabled: draft.busy, onClick: onCancel }, "Cancel")),
    (draft.error || draft.status) && h("p", { id: messageId, role: draft.error ? "alert" : "status", className: draft.error ? "ws-field-error" : "ws-muted" }, draft.error || draft.status));
}

export function Database({ item, state, command, onOpen, onError, locked, confirm, propertyBuffer, registerPropertyFlush }) {
  const [sort, setSort] = useState(""), [direction, setDirection] = useState("asc"), [filter, setFilter] = useState(""), [view, setView] = useState("table"), [group, setGroup] = useState(""), [sortOpen, setSortOpen] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState(null);
  const [creationFocused, setCreationFocused] = useState(false);
  const focusCreation = () => { setActiveRecordId(null); setCreationFocused(true); };
  const [rowDraft, setRowDraft] = useState({ open: false, title: "", error: "", status: "", busy: false });
  const creationGuards = useRef(new Map());
  const registerCreationFlush = useCallback((id, fn) => {
    creationGuards.current.set(id, fn);
    const unregister = registerPropertyFlush?.(id, fn);
    return () => { if (creationGuards.current.get(id) === fn) creationGuards.current.delete(id); unregister?.(); };
  }, [registerPropertyFlush]);
  const changeView = async next => {
    try { for (const flush of creationGuards.current.values()) await flush(); setView(next); }
    catch (error) { if (error instanceof UnsavedEditError) error.focus(); onError?.(error); }
  };
  const rowGate = useRef(false), alive = useRef(true), section = useRef(null), latest = useRef(null);
  latest.current = { command, locked, item, rowDraft };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => registerCreationFlush(`creation:record:${item.id}`, async () => {
    const draft = latest.current.rowDraft;
    if (draft.busy || draft.title || draft.error) throw new UnsavedEditError("Finish or cancel the new record before leaving this database.", () => section.current?.querySelector('input[aria-label="New record title"]')?.focus());
  }), [registerCreationFlush, item.id]);

  const [, advanceDrafts] = useState(0), settled = useCallback(() => advanceDrafts(v => v + 1), []);
  const columns = item.columns ?? [], records = state.items.filter(i => i.kind === "record" && !i.deleted_at && i.database_id === item.id);
  const rows = tableRows(records, columns, { sort, direction, filter }), selectColumns = columns.filter(c => c.type === "select");
  const groupColumn = selectColumns.find(c => c.id === group) ?? selectColumns[0];
  const activeRecord = records.find(record => record.id === activeRecordId);
  const sortLabel = sort === "title" ? "Record title" : columns.find(column => column.id === sort)?.name;
  const schemaLocked = locked || records.some(record => Boolean(activeRun(state, record.id)));
  const write = (record, column, value) => command("update_item", current => propertyPatch(current, record.id, column.id, value));
  const cancelRecord = () => {
    if (rowGate.current) return;
    const key = rowDraft.target?.key;
    setRowDraft({ open: false, title: "", error: "", status: "", busy: false });
    requestAnimationFrame(() => [...(section.current?.querySelectorAll(".ws-db-new-record") ?? [])].find(button => button.dataset.groupKey === key)?.focus());
  };
  const createRecord = async () => {
    const current = latest.current, title = current.rowDraft.title.trim();
    if (rowGate.current || current.locked) return;
    if (!title) { setRowDraft(old => ({ ...old, error: "Enter a record title." })); return; }
    rowGate.current = true; setRowDraft(old => ({ ...old, busy: true, error: "", status: "" }));
    try {
      const target = current.rowDraft.target;
      const record = await current.command("create_item", { kind: "record", database_id: current.item.id, title,
        ...(target ? { properties: { [target.columnId]: target.value } } : {}) });
      if (alive.current) setRowDraft(old => ({ ...old, open: true, title: "", error: "", busy: false,
        status: tableRows([record], columns, { filter }).length ? `Created “${record.title}”.` : `Created “${record.title}”. It is hidden by the current filter.` }));
    } catch (err) { if (alive.current) setRowDraft(old => ({ ...old, busy: false, error: errorMessage(err) })); }
    finally { rowGate.current = false; }
  };
  const creation = h(NewRecordCreator, { draft: rowDraft, locked, onFocus: focusCreation, onDraft: setRowDraft, onCreate: createRecord, onCancel: cancelRecord });
  const groupName = value => {
    if (value !== null) return value;
    let label = "Unassigned";
    while ((groupColumn.options ?? []).includes(label)) label += " (no value)";
    return label;
  };
  const groupCreation = value => {
    const name = groupName(value);
    const key = JSON.stringify([groupColumn.id, value]), active = rowDraft.target?.key === key;
    return h(NewRecordCreator, { label: `New record in ${name}`, groupKey: key, onFocus: focusCreation,
      draft: active ? rowDraft : { open: false }, locked: locked || (rowDraft.open && !active),
      onDraft: draft => setRowDraft({ ...draft, title: draft.title ?? "", target: { key, columnId: groupColumn.id,
        value } }),
      onCreate: createRecord, onCancel: cancelRecord });
  };
  const rowActions = record => h(ActionMenu, { label: `Record actions: ${record.title}`, triggerLabel: h(Codicon, { name: "ellipsis", "aria-hidden": true }), showChevron: false,
    disabled: locked || Boolean(activeRun(state, record.id)), triggerProps: { className: "ws-db-row-actions", size: "icon-xs" } },
    h(Action, { onClick: (_event, opener) => confirm({ returnFocus: opener, title: `Move ${record.title} to Trash?`, description: "You can restore this record from Trash.", label: "Move to Trash", action: () => command("trash", { id: record.id }) }) }, "Move to Trash"));
  return h("section", { ref: section, className: "ws-database", "aria-label": "Database" },
    h("style", null, databaseGridStyles),
    h("div", { className: "ws-database-tools" },
      h(SearchField, { value: filter, "aria-label": "Filter records", placeholder: "Filter records…", containerClassName: "ws-db-filter opacity-100", onChange: setFilter, onClear: () => setFilter("") }),
      h(Choice, { label: "View", showLabel: false, value: view, disabled: rowDraft.open, options: [["table", "Table"], ["board", "Board"]], onChange: changeView }),
      h(ContextPopover, { open: sortOpen, onOpenChange: setSortOpen, className: "ws-db-sort-popover", align: "end", returnFocusOnEscape: true,
        trigger: h(Action, { variant: "ghost", "aria-label": sort ? `Sort: ${sortLabel}, ${direction === "asc" ? "ascending" : "descending"}` : "Sort" }, h(Codicon, { name: sort ? direction === "asc" ? "arrow-up" : "arrow-down" : "sort-precedence", "aria-hidden": true }), h("span", { className: "ws-db-sort-label" }, sort ? sortLabel : "Sort")) },
        h(Choice, { label: "Sort", value: sort, options: [["", "No sorting"], ["title", "Record title"], ...columns.map(c => [c.id, c.name])], onChange: setSort }),
        h(Choice, { label: "Direction", value: direction, options: [["asc", "Ascending"], ["desc", "Descending"]], onChange: setDirection })),
      ),
    h("div", { className: "ws-db-status", role: "status" },
      h("span", { className: "ws-db-count" }, filter ? `${rows.length} of ${records.length} records` : `${records.length} ${records.length === 1 ? "record" : "records"}`),
      creationFocused && view === "table" && h("span", { className: "ws-db-record-context" }, "New record"),
      activeRecord && !creationFocused && view === "table" && h("span", { className: "ws-db-record-context" }, "Record: ",
        h(ContextTip, { label: activeRecord.title }, h(Action, { variant: "link", onClick: () => onOpen(activeRecord.id) }, h("span", { className: "ws-db-record-label" }, activeRecord.title))))),
    view === "board" ? h("div", { className: "ws-db-board-view" },
      h("div", { className: "ws-db-board-tools" }, groupColumn && h(Choice, { label: "Group board by", value: groupColumn.id, disabled: rowDraft.open, options: selectColumns.map(c => [c.id, c.name]), onChange: setGroup }),
        h(PropertyCreator, { item, state, command, locked: schemaLocked, registerFlush: registerCreationFlush })),
      !groupColumn ? h("p", { className: "ws-db-empty" }, "Add a single-select property to group records on a board.") :
        h("div", { className: "ws-board", role: "region", "aria-label": "Database board, scroll for more groups", tabIndex: 0 },
          [...boardGroups(rows, groupColumn)].map(([value, groupRows]) => h("section", { className: "ws-board-group", key: JSON.stringify(value), role: "region", "aria-label": `Board group: ${groupName(value)}` },
            h("h3", null, groupName(value), h("span", { className: "ws-db-count" }, String(groupRows.length))),
            groupRows.map(record => h("div", { key: record.id, className: "ws-board-record" },
              h("div", { className: "ws-db-record-name" }, h(Action, { variant: "ghost", onClick: () => onOpen(record.id) }, record.title), rowActions(record)),
              h(Property, { column: { ...groupColumn, name: `Move ${record.title}` }, value: record.properties?.[groupColumn.id], state,
                disabled: locked || Boolean(activeRun(state, record.id)), buffer: propertyBuffer?.(record.id, groupColumn.id), onSettled: settled,
                registerFlush: fn => registerPropertyFlush?.(`${record.id}:${groupColumn.id}`, fn), onChange: value => write(record, groupColumn, value) }))),
            h("div", { className: "ws-db-board-create" }, groupCreation(value))))),
      !groupColumn && h("div", { className: "ws-db-board-create" }, creation)) :
      h("div", { className: "ws-table-wrap", role: "region", "aria-label": "Database table, scroll for more columns and records", tabIndex: 0 },
        h("table", { className: "ws-table" },
          h("thead", null, h("tr", null,
            h("th", { scope: "col", "aria-sort": sort === "title" ? direction === "asc" ? "ascending" : "descending" : undefined }, h("span", { className: "ws-db-column-name" }, h(Codicon, { name: "symbol-string", "aria-hidden": true }), "Record")),
            columns.map(column => h("th", { key: column.id, scope: "col", "aria-sort": sort === column.id ? direction === "asc" ? "ascending" : "descending" : undefined },
              h("div", { className: "ws-db-column-heading" }, h("span", { className: "ws-db-column-name", title: column.name }, h(Codicon, { name: propertyIcons[column.type], "aria-hidden": true }), column.name),
                h(ActionMenu, { label: `Column actions: ${column.name}`, triggerLabel: h(Codicon, { name: "ellipsis", "aria-hidden": true }), showChevron: false, disabled: schemaLocked,
                  triggerProps: { size: "icon-xs" } }, h(Action, { onClick: (_event, opener) => confirm({ returnFocus: opener, title: `Remove ${column.name}?`, description: "Values in this column will be removed from every record.", label: "Remove column",
                    action: () => command("set_columns", current => ({ id: item.id, columns: current.items.find(i => i.id === item.id).columns.filter(c => c.id !== column.id) })) }) }, "Remove column"))))),
            h("th", { key: "new-property", scope: "col", className: "ws-db-property-header" }, h(PropertyCreator, { item, state, command, locked: schemaLocked, registerFlush: registerCreationFlush })))),
          h("tbody", null,
            !rows.length && h("tr", { className: "ws-db-empty-row" }, h("td", { colSpan: columns.length + 2 }, filter ? "No records match this filter." : "No records yet. Add your first record below.")),
            rows.map(record => h("tr", { key: record.id, className: activeRecordId === record.id ? "ws-db-active-row" : undefined, onFocusCapture: () => { setActiveRecordId(record.id); setCreationFocused(false); }, onPointerDownCapture: () => { setActiveRecordId(record.id); setCreationFocused(false); } },
              h("th", { scope: "row" }, h("div", { className: "ws-db-record-name" }, h(Action, { variant: "ghost", onClick: () => onOpen(record.id) }, h(Codicon, { name: "file-text", "aria-hidden": true }), record.title), rowActions(record))),
              columns.map(column => h("td", { key: column.id }, h(Property, { compact: true, key: `${record.id}:${column.id}`, buffer: propertyBuffer?.(record.id, column.id),
                registerFlush: fn => registerPropertyFlush?.(`${record.id}:${column.id}`, fn), formulaError: record.formula_errors?.[column.id], onSettled: settled, column, value: record.properties?.[column.id], state,
                disabled: locked || Boolean(activeRun(state, record.id)), onChange: value => write(record, column, value) }))),
              h("td", { className: "ws-db-property-spacer", "aria-hidden": true }))),
            h("tr", { className: "ws-db-create-row" }, h("td", { colSpan: columns.length + 2 }, creation))))),
    h("details", { className: "ws-db-schema-help" }, h("summary", null, "Column IDs for formulas"), h(FormulaHelp, { columns })));
}

function FormulaHelp({ columns }) {
  const numeric = columns.filter(c => c.type === "number");
  const example = numeric.length > 1 ? `col(${JSON.stringify(numeric[0].name)}) * col(${JSON.stringify(numeric[1].name)})` : numeric.length ? `col(${JSON.stringify(numeric[0].name)}) * 2` : columns.length ? `len(col(${JSON.stringify(columns[0].name)}))` : "2 + 3";
  return h("section", { className: "ws-formula-help", "aria-label": "Formula syntax" },
    h("p", null, 'Use col("Column name") or a column ID from this database. For example: ',
      h("code", null, example)),
    h("p", { className: "ws-muted" }, 'Same-row arithmetic (+ − * / %), comparisons, and/or/not, conditional expressions, IF, abs, round, min, max, len, lower, upper, concat and coalesce. Formula errors appear on each record.'),
    columns.length > 0 && h("ul", null, columns.map(c => h("li", { key: c.id }, `${c.name}: `, h("code", null, c.id)))),
  );
}
