// Synthetic SDK seam only. Native components/loader remain coordinator qualification.
import React, { useEffect, useState, useSyncExternalStore } from "react";
export const makeAtom = (value) => {
  const listeners = new Set();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      listeners.forEach((fn) => fn());
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
};
const profile = makeAtom("synthetic-a"),
  connectionId = makeAtom("local"),
  epoch = makeAtom(1);
export const nativeCalls = [];
export const host = {
  state: {
    profile,
    connectionId,
    gateway: makeAtom("open"),
    focusedSessionOwner: {
      get: () => ({ connectionId: connectionId.get(), profile: profile.get() }),
    },
  },
  activeConnectionId: () => connectionId.get(),
  profileRoutes: async () => [
    {
      connectionId: "local",
      profile: profile.get(),
      targetProfile: profile.get(),
    },
  ],
  requestProfile: async (route, method, params) => {
    nativeCalls.push({ route, method, params });
    if (method === "plugins.manage" && params.action === "list")
      return { plugins: [{ key: "workspace", status: "enabled" }] };
    if (method === "session.list")
      return {
        sessions: [{ id: "thread-existing", title: "Existing native thread" }],
      };
    if (method === "session.create" || method === "session.resume")
      return {
        info: { desktop_protocol: "hermes-gateway-v1" },
        stored_session_id: params.session_id ?? "thread-new",
        session_id: "runtime-new",
      };
    return { admission_id: "admission-new" };
  },
  openSession: async (id, opts) =>
    nativeCalls.push({ method: "open", id, opts }),
  navigate: () => {},
};
export const gatewayActivationEpoch = () => epoch.get();
export const useGatewayActivationEpoch = () => useValue(epoch);
export const switchProfile = (name) => {
  epoch.set(epoch.get() + 1);
  profile.set(name);
};
export const useValue = (atom) =>
  useSyncExternalStore(atom.subscribe ?? (() => () => {}), atom.get);
export function useQuery({
  queryKey,
  queryFn,
  enabled = true,
  refetchInterval,
}) {
  const [state, setState] = useState({});
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer;
    const load = () =>
      Promise.resolve()
        .then(queryFn)
        .then(
          (data) => complete({ data }),
          (error) => complete({ error }),
        );
    const complete = next => {
      if (!active) return;
      setState(next);
      const delay = typeof refetchInterval === "function" ? refetchInterval({ state: next }) : refetchInterval;
      if (delay) timer = setTimeout(load, delay);
    };
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [JSON.stringify(queryKey), enabled]);
  return state;
}
export const Button = ({ variant, size, loading, children, ...props }) =>
  React.createElement(
    "button",
    { ...props, disabled: props.disabled || loading },
    children,
  );
// Synthetic component seam only; real hover/focus behavior is browser-qualified.
export const Tip = ({ label, children }) =>
  React.createElement('span', { 'data-tip': label }, children);
export const Input = React.forwardRef((props, ref) =>
  React.createElement("input", { ...props, ref }),
);
export const Textarea = React.forwardRef((props, ref) =>
  React.createElement("textarea", { ...props, ref }),
);
export const Checkbox = ({ checked, onCheckedChange, ...props }) =>
  React.createElement("input", {
    ...props,
    type: "checkbox",
    checked,
    onChange: (e) => onCheckedChange(e.target.checked),
  });
const pass = ({ children }) => React.createElement("div", null, children);
export function Select({ children, value, onValueChange, disabled }) {
  const options = [];
  let accessibility = {};
  const walk = (nodes) =>
    React.Children.forEach(nodes, (child) => {
      let node = child;
      if (!React.isValidElement(node)) return;
      // The production ownership layer composes SDK parts through pure
      // forwardRef wrappers. Resolve that composition before identifying the
      // fixture part; do not borrow aria props from arbitrary descendants.
      while (node.type?.$$typeof === Symbol.for("react.forward_ref")) {
        node = node.type.render(node.props, node.props.ref ?? null);
        if (!React.isValidElement(node)) return;
      }
      if (node.type === SelectItem)
        options.push(
          React.createElement(
            "option",
            { key: node.props.value, value: node.props.value },
            node.props.children,
          ),
        );
      else {
        if (node.type === SelectTrigger) {
          accessibility = Object.fromEntries(Object.entries(node.props).filter(([key]) => key.startsWith("aria-")));
        }
        walk(node.props.children);
      }
    });
  walk(children);
  return React.createElement(
    "select",
    {
      ...accessibility,
      value,
      disabled,
      onChange: (e) => onValueChange(e.target.value),
    },
    options,
  );
}
export const SelectTrigger = ({ children }) => React.createElement("div", null, children),
  SelectValue = () => null,
  SelectContent = pass,
  SelectItem = ({ children }) => React.createElement("span", null, children);
export const Dialog = ({ children, open }) =>
  open ? React.createElement("div", { role: "dialog" }, children) : null;
export const DialogContent = pass,
  DialogHeader = pass,
  DialogFooter = pass,
  DialogTitle = ({ children }) => React.createElement("h2", null, children),
  DialogDescription = pass;
export const ConfirmDialog = ({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel,
}) =>
  open
    ? React.createElement(
        "div",
        { role: "dialog" },
        title,
        description,
        React.createElement(
          "button",
          { onClick: () => Promise.resolve(onConfirm()).then(onClose) },
          confirmLabel,
        ),
      )
    : null;
export const ROUTES_AREA = "routes",
  SIDEBAR_NAV_AREA = "sidebar.nav";
export const KEYBINDS_AREA = "keybinds";
export const switchConnection = (id) => {
  epoch.set(epoch.get() + 1);
  connectionId.set(id);
};
export const advanceEpoch = () => epoch.set(epoch.get() + 1);

export const DropdownMenu = pass,
  DropdownMenuContent = pass;
export const DropdownMenuTrigger = ({ children }) => children;
export const DropdownMenuItem = ({ children, onSelect, disabled }) =>
  React.createElement("button", { disabled, onClick: onSelect }, children);
export const Codicon = () => null;

const PopoverContext = React.createContext({ open: false, onOpenChange: () => {} });
export const Popover = ({ open, onOpenChange, children }) =>
  React.createElement(PopoverContext.Provider, { value: { open, onOpenChange } }, children);
export const PopoverTrigger = ({ children, asChild, ...props }) => {
  const { open, onOpenChange } = React.useContext(PopoverContext);
  return React.cloneElement(children, { ...props, onClick: event => {
    children.props.onClick?.(event);
    if (!event.defaultPrevented) onOpenChange?.(!open);
  } });
};
export const PopoverContent = ({ children }) =>
  React.useContext(PopoverContext).open ? React.createElement("div", null, children) : null;
export const GlyphSpinner = () => null;
// Minimal public SearchField contract seam; real native rendering is browser-qualified.
export const SearchField = ({ value, onChange, placeholder, onClear, onKeyDown,
  loading = false, trailingAction, "aria-label": label }) =>
  React.createElement("div", { "data-loading": loading },
    React.createElement("input", { "aria-label": label, placeholder, value, onKeyDown,
      onChange: e => onChange(e.target.value) }),
    trailingAction,
    !loading && value && React.createElement("button", { "aria-label": "Clear search",
      onClick: onClear ?? (() => onChange("")) }, "Clear"));
export const EmptyState = ({ title, description }) =>
  React.createElement("div", null, title, description);
export const ErrorState = EmptyState;
