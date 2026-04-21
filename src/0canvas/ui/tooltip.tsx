// ============================================================
// Tooltip — hover-triggered label.
// Lightweight: uses absolute positioning relative to wrapper.
// ============================================================
import * as React from "react";
import { cn } from "./cn";

export function Tooltip({
  label,
  side = "bottom",
  children,
}: {
  label: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
}) {
  const [show, setShow] = React.useState(false);
  const [timerId, setTimerId] = React.useState<number | null>(null);
  const open = () => {
    const id = window.setTimeout(() => setShow(true), 400);
    setTimerId(id);
  };
  const close = () => {
    if (timerId) window.clearTimeout(timerId);
    setShow(false);
  };
  const pos: React.CSSProperties = { whiteSpace: "nowrap" };
  if (side === "bottom") { pos.top = "calc(100% + 4px)"; pos.left = "50%"; pos.transform = "translateX(-50%)"; }
  if (side === "top")    { pos.bottom = "calc(100% + 4px)"; pos.left = "50%"; pos.transform = "translateX(-50%)"; }
  if (side === "left")   { pos.right = "calc(100% + 4px)"; pos.top = "50%"; pos.transform = "translateY(-50%)"; }
  if (side === "right")  { pos.left = "calc(100% + 4px)"; pos.top = "50%"; pos.transform = "translateY(-50%)"; }
  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {children}
      {show ? (
        <span className={cn("oc-ui-tooltip")} style={pos} role="tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}
