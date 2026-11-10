import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { h } from "./ui.jsx";
import { elementScale } from "./editor.mjs";

const DEFAULT_WIDTH = 280, MIN_WIDTH = 200, MAX_WIDTH = 560;
const bounded = (value, max = MAX_WIDTH) => Math.round(Math.max(MIN_WIDTH, Math.min(max, value)));

/** The public SDK has no split-pane control. Keep only the local separator
 * mechanics here; native typography, tokens and plugin storage remain authoritative. */
export function useNavigationResize(storage, owner) {
  const key = `navigation-width:v1:${JSON.stringify(JSON.parse(owner).slice(0, 2))}`;
  const [preferred, setPreferred] = useState(() => {
    try {
      const value = storage?.get(key, DEFAULT_WIDTH);
      return typeof value === "number" && Number.isFinite(value) ? bounded(value) : DEFAULT_WIDTH;
    } catch { return DEFAULT_WIDTH; }
  });
  const [available, setAvailable] = useState({ width: 0, height: 0 }), [error, setError] = useState("");
  const body = useRef(null), drag = useRef(null), current = useRef(preferred);
  const [bodyNode, setBodyNode] = useState(null);
  const bindBody = useCallback(node => { body.current = node; setBodyNode(node); }, []);
  current.current = preferred;
  useLayoutEffect(() => {
    if (!body.current) return;
    if (globalThis.ResizeObserver) {
      // The observer supplies measured box data. Reading clientWidth in a
      // mount layout effect forces layout of the entire long navigation/home.
      const observer = new ResizeObserver(entries => {
        const entry = entries.find(entry => entry.target === body.current);
        if (entry) setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height });
      });
      observer.observe(body.current);
      return () => observer.disconnect();
    }
    const measure = () => setAvailable({ width: body.current.clientWidth, height: body.current.clientHeight });
    window.addEventListener("resize", measure); measure();
    return () => window.removeEventListener("resize", measure);
  }, [bodyNode]);
  // Leave useful document room in a constrained side-by-side pane. Below
  // 600px the existing full-width disclosure replaces the split entirely.
  const max = available.width ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, available.width - 390)) : MAX_WIDTH;
  const width = bounded(preferred, max);
  const persist = value => {
    try { storage?.set(key, value); setError(""); }
    catch { setError("Navigation resized for this view. Its width could not be saved."); }
  };
  return { body: bindBody, width, max, error, availableWidth: available.width, availableHeight: available.height,
    start(event) {
      if (event.button !== 0 || drag.current) return;
      event.preventDefault();
      drag.current = { id: event.pointerId, x: event.clientX, width, preferred: current.current };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    move(event) {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      const next = bounded(start.width + (event.clientX - start.x) / elementScale(body.current), max);
      current.current = next; setPreferred(next);
    },
    end(event, cancelled = false) {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      drag.current = null;
      if (cancelled) { current.current = start.preferred; setPreferred(start.preferred); }
      else persist(current.current);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    key(event) {
      const step = event.shiftKey ? 40 : 10;
      const next = { ArrowLeft: width - step, ArrowRight: width + step, Home: MIN_WIDTH, End: max }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      current.current = bounded(next, max); setPreferred(current.current); persist(current.current);
    },
  };
}

export function NavigationResizeHandle({ navigation, controls }) {
  return h("div", {
    className: "ws-nav-resize", role: "separator", tabIndex: 0,
    "aria-label": "Resize Workspace navigation", "aria-orientation": "vertical",
    "aria-controls": controls, "aria-valuemin": MIN_WIDTH, "aria-valuemax": navigation.max,
    "aria-valuenow": navigation.width, "aria-valuetext": `${navigation.width} pixels wide`,
    "aria-describedby": `${controls}-resize-help`,
    title: "Drag to resize navigation. Use Left and Right arrow keys when focused.",
    onPointerDown: navigation.start, onPointerMove: navigation.move,
    onPointerUp: event => navigation.end(event), onPointerCancel: event => navigation.end(event, true),
    onLostPointerCapture: event => navigation.end(event, true), onKeyDown: navigation.key,
  }, h("span", { "aria-hidden": true, className: "ws-nav-grip" }),
  h("span", { id: `${controls}-resize-help`, className: "ws-title-reader" },
    "Drag to resize navigation. Left and Right arrows adjust by 10 pixels, Shift by 40. Home sets the minimum and End the maximum."));
}
