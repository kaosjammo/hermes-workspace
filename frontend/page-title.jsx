import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { h, Textarea, Action, errorMessage, isSubmitEnter, UnsavedEditError } from "./ui.jsx";

/** A scoped rename buffer. The existing command queue remains write authority. */
export function PageTitle({ item, locked: authorityLocked, interactionBlocked = false, buffer, registerFlush, onSave, onError, headingId }) {
  const locked = authorityLocked || interactionBlocked;
  const input = useRef(null), dirty = useRef(null), saving = useRef(Promise.resolve());
  const pending = useRef(0), token = useRef(null), mounted = useRef(true), editRevision = useRef(0);
  const [value, setValue] = useState(item.title);
  const [recovery, setRecovery] = useState(() => buffer?.read() ?? null);
  const [status, setStatus] = useState("Saved"), [error, setError] = useState("");
  const recoveryRef = useRef(recovery), latest = useRef(null);
  recoveryRef.current = recovery;
  latest.current = { item, locked: authorityLocked, onSave, buffer };
  const retain = (text) => {
    dirty.current = text;
    editRevision.current++;
    try { token.current = buffer?.put(text, item.title)?.token ?? null; }
    catch (err) { onError(err); }
  };
  const flush = () => {
    if (dirty.current === null) return saving.current;
    const title = dirty.current.trim();
    if (!title) {
      setError("Enter a title before saving or leaving this page.");
      setStatus("Title not saved");
      return Promise.reject(new UnsavedEditError("Title not saved. Enter a title before leaving this page.", () => input.current?.focus()));
    }
    if (recoveryRef.current) return Promise.reject(new UnsavedEditError("Recover or discard the retained title first.", () => input.current?.focus()));
    const savedToken = token.current, save = latest.current.onSave;
    const revision = editRevision.current, savedBuffer = latest.current.buffer;
    dirty.current = null;
    pending.current++;
    setStatus("Saving title…");
    setError("");
    const promise = saving.current.catch(() => {}).then(async () => {
      if (latest.current.locked) throw new Error("The title is read-only while Hermes is working.");
      await save(title);
    }).then(() => {
      if (savedToken) savedBuffer?.acknowledge(savedToken);
      if (mounted.current && revision === editRevision.current && dirty.current === null) { setValue(title); setStatus("Saved"); }
    }, (err) => {
      if (revision === editRevision.current) {
        if (dirty.current === null) dirty.current = title;
        if (mounted.current) { setStatus("Title not saved"); setError(errorMessage(err)); }
      }
      throw new UnsavedEditError(`Title not saved: ${errorMessage(err)}`, () => input.current?.focus());
    }).finally(() => { pending.current--; });
    saving.current = promise;
    promise.catch(() => {});
    return promise;
  };
  useEffect(() => registerFlush(flush), [registerFlush, recovery]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (dirty.current === null && pending.current === 0 && !recoveryRef.current) setValue(item.title);
  }, [item.title]);
  const resize = () => {
    if (input.current) { input.current.style.height = "auto"; input.current.style.height = `${input.current.scrollHeight}px`; }
  };
  useLayoutEffect(resize, [value]);
  useLayoutEffect(() => {
    const parent = input.current?.parentElement;
    if (!parent || !globalThis.ResizeObserver) return;
    let width = parent.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width !== parent.clientWidth) { width = parent.clientWidth; resize(); }
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  return h("div", { className: "ws-title-wrap" },
    h("h1", { id: headingId, className: "ws-title-reader" }, value.trim() || item.title),
    recovery && h("div", { className: "ws-title-recovery ws-banner", role: "status" },
      h("p", null, "A title draft is retained for this exact Workspace. Recovering applies and saves it: ", h("strong", null, recovery.title)),
      h(Action, { disabled: locked, onClick: () => {
        const text = recovery.title; recoveryRef.current = null; setRecovery(null); setValue(text); retain(text);
        void flush().catch(() => {});
      } }, "Recover title"),
      h(Action, { disabled: locked, onClick: () => {
        buffer?.discard(); recoveryRef.current = null; setRecovery(null); dirty.current = null;
        setValue(item.title); setError(""); setStatus("Saved");
      } }, "Discard retained title")),
    h(Textarea, {
      ref: input, rows: 1, className: `ws-title${value.trim() ? "" : " ws-title-empty"}`, "aria-label": "Page title", value,
      placeholder: "Page title",
      "aria-invalid": Boolean(error), "aria-describedby": !value.trim() ? `${headingId}-empty${status !== "Saved" ? ` ${headingId}-status` : ""}` : status !== "Saved" ? `${headingId}-status` : undefined,
      disabled: locked || Boolean(recovery),
      onChange: e => { const text = e.target.value; setValue(text); retain(text); setStatus("Unsaved title"); setError(""); },
      onBlur: () => { if (!locked && !recoveryRef.current && !error) void flush().catch(() => {}); },
      onKeyDown: e => { if (isSubmitEnter(e)) { e.preventDefault(); e.currentTarget.blur(); } },
    }),
    !value.trim() && h("span", { id: `${headingId}-empty`, className: "ws-title-empty-cue" }, "Page title — enter a name"),
    status !== "Saved" && h("div", { id: `${headingId}-status`, className: "ws-title-status", role: error ? "alert" : "status" },
      h("span", null, error ? `Title not saved. ${error}` : status),
      error && h(Action, { disabled: locked, onMouseDown: event => event.preventDefault(), onClick: event => {
        const opener = event.currentTarget;
        void flush().then(() => {
          if (document.activeElement === document.body || document.activeElement === opener) input.current?.focus();
        }).catch(() => {});
      } }, "Retry title save")),
  );
}
