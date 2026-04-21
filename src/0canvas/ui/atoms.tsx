// ============================================================
// Atoms — Badge, StatusDot, Kbd, Divider, Pill, Icon
// Small building blocks that compose into larger primitives.
// ============================================================
import * as React from "react";
import { cn } from "./cn";

// ── Badge ──────────────────────────────────────────────────
export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "critical"
  | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  variant = "default",
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn("oc-ui-badge", className)}
      data-variant={variant}
      {...rest}
    />
  );
}

// ── StatusDot ──────────────────────────────────────────────
export type DotStatus =
  | "default"
  | "success"
  | "info"
  | "warning"
  | "critical"
  | "connecting";

export function StatusDot({
  status = "default",
  className,
  ...rest
}: { status?: DotStatus } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("oc-ui-status-dot", className)}
      data-status={status}
      {...rest}
    />
  );
}

// ── Kbd ────────────────────────────────────────────────────
export function Kbd({
  className,
  ...rest
}: React.HTMLAttributes<HTMLElement>) {
  return <kbd className={cn("oc-ui-kbd", className)} {...rest} />;
}

// ── Divider ────────────────────────────────────────────────
export function Divider({
  orientation = "horizontal",
  className,
  ...rest
}: {
  orientation?: "horizontal" | "vertical";
} & React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={cn("oc-ui-divider", className)}
      data-orientation={orientation}
      {...rest}
    />
  );
}

// ── Pill ───────────────────────────────────────────────────
// A compact rounded-pill control used in the chat composer,
// branch switcher, model picker, permission picker, etc.
export interface PillProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}
export const Pill = React.forwardRef<HTMLButtonElement, PillProps>(
  function Pill({ active, className, disabled, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn("oc-ui-pill", className)}
        data-active={active ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        disabled={disabled}
        type="button"
        {...rest}
      >
        {children}
      </button>
    );
  },
);

// ── Icon wrapper ───────────────────────────────────────────
// Wrap a lucide icon with the project's icon-size tokens so we
// never ship raw `size={14}` props scattered across the app.
export function Icon({
  as: Component,
  size = "md",
  className,
  ...rest
}: {
  as: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>;
  size?: "xs" | "sm" | "md" | "lg";
} & Omit<React.SVGAttributes<SVGSVGElement>, "size">) {
  const px = { xs: 10, sm: 12, md: 14, lg: 16 }[size];
  return (
    <Component
      size={px}
      className={cn("oc-ui-icon", className)}
      data-size={size}
      {...rest}
    />
  );
}
