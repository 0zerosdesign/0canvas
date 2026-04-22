// ============================================================
// DropdownMenu — shadcn/Radix-style API.
//
// Usage:
//   <DropdownMenu>
//     <DropdownMenu.Trigger asChild>
//       <Button variant="ghost">Model</Button>
//     </DropdownMenu.Trigger>
//     <DropdownMenu.Content side="bottom" align="start">
//       <DropdownMenu.Label>Providers</DropdownMenu.Label>
//       <DropdownMenu.Item selected>Claude</DropdownMenu.Item>
//       <DropdownMenu.Separator />
//       <DropdownMenu.Item>GPT-5</DropdownMenu.Item>
//     </DropdownMenu.Content>
//   </DropdownMenu>
//
// Features:
//   • Click-outside and Escape dismiss (built in)
//   • Direction-aware (`side` + `align`) anchored to trigger
//   • max-height + internal scroll (60vh)
//   • z-index owned by the primitive (never pass z-index)
//   • No portal (keeps things simple in the Tauri webview)
// ============================================================
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "./cn";

type Side = "bottom" | "top";
type Align = "start" | "end";

interface Ctx {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  side: Side;
  align: Align;
  setSide: (s: Side) => void;
  setAlign: (a: Align) => void;
}
const DropdownCtx = React.createContext<Ctx | null>(null);
function useCtx() {
  const c = React.useContext(DropdownCtx);
  if (!c) throw new Error("DropdownMenu.* must be used inside <DropdownMenu>");
  return c;
}

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [side, setSide] = React.useState<Side>("bottom");
  const [align, setAlign] = React.useState<Align>("start");
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  // Dismiss on outside click / Escape
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (contentRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const value = React.useMemo(
    () => ({ open, setOpen, triggerRef, contentRef, side, align, setSide, setAlign }),
    [open, side, align],
  );
  return <DropdownCtx.Provider value={value}>{children}</DropdownCtx.Provider>;
}

// ── Trigger ────────────────────────────────────────────────
export interface DropdownTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}
function Trigger({ children, asChild = true }: DropdownTriggerProps) {
  const ctx = useCtx();
  const { triggerRef, open, setOpen } = ctx;
  const handleClick = (e: React.MouseEvent) => {
    (children.props as any).onClick?.(e);
    if (!e.defaultPrevented) setOpen(!open);
  };
  if (asChild) {
    return React.cloneElement(children, {
      ref: (el: HTMLElement | null) => {
        (triggerRef as React.MutableRefObject<HTMLElement | null>).current = el;
        const cRef = (children as any).ref;
        if (typeof cRef === "function") cRef(el);
        else if (cRef && "current" in cRef) cRef.current = el;
      },
      onClick: handleClick,
      "aria-haspopup": "menu",
      "aria-expanded": open,
    } as any);
  }
  return (
    <span
      ref={(el) => {
        (triggerRef as React.MutableRefObject<HTMLElement | null>).current = el;
      }}
      onClick={handleClick}
    >
      {children}
    </span>
  );
}

// ── Content ────────────────────────────────────────────────
export interface DropdownContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  side?: Side;
  align?: Align;
  sideOffset?: number;
}
function Content({
  side = "bottom",
  align = "start",
  sideOffset = 6,
  className,
  style,
  children,
  ...rest
}: DropdownContentProps) {
  const ctx = useCtx();
  if (!ctx.open) return null;

  // Compute inline position using the trigger rect.
  const tRect = ctx.triggerRef.current?.getBoundingClientRect();
  const pos: React.CSSProperties = { position: "fixed" };
  if (tRect) {
    if (side === "bottom") pos.top = tRect.bottom + sideOffset;
    else pos.top = tRect.top - sideOffset; // transformed below
    if (align === "start") pos.left = tRect.left;
    else pos.right = Math.max(window.innerWidth - tRect.right, 8);
    if (side === "top") {
      pos.top = undefined;
      pos.bottom = window.innerHeight - tRect.top + sideOffset;
    }
  }

  return (
    <div
      ref={ctx.contentRef as React.RefObject<HTMLDivElement>}
      role="menu"
      className={cn("oc-ui-dropdown-content", className)}
      style={{ ...pos, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

// ── Item ───────────────────────────────────────────────────
export interface DropdownItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  closeOnSelect?: boolean;
}
function Item({
  selected,
  disabled,
  closeOnSelect = true,
  onClick,
  className,
  children,
  ...rest
}: DropdownItemProps) {
  const ctx = useCtx();
  return (
    <button
      type="button"
      role="menuitem"
      className={cn("oc-ui-dropdown-item", className)}
      data-selected={selected ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (closeOnSelect && !e.defaultPrevented) ctx.setOpen(false);
      }}
      {...rest}
    >
      <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
        {children}
      </span>
      {selected ? <Check className="oc-ui-dropdown-item-check" /> : null}
    </button>
  );
}

// ── Label / Separator ──────────────────────────────────────
function DLabel({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("oc-ui-dropdown-label", className)} {...rest} />;
}
function Separator({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("oc-ui-dropdown-separator", className)}
      {...rest}
    />
  );
}

DropdownMenu.Trigger = Trigger;
DropdownMenu.Content = Content;
DropdownMenu.Item = Item;
DropdownMenu.Label = DLabel;
DropdownMenu.Separator = Separator;
