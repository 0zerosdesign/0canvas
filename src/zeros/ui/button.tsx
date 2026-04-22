// ============================================================
// Button — the ONLY button in the app. shadcn-style API.
//
// Variants: default | primary | secondary | ghost | outline |
//           destructive | link
// Sizes:    sm | md (default) | lg | icon | icon-sm
//
// Never bypass this to style a raw <button>. If you need a new
// variant, extend this file and document it in RULES.md.
// ============================================================
import * as React from "react";
import { cn } from "./cn";

type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "destructive"
  | "link";

type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "default",
      size = "md",
      loading = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn("oc-ui-btn", className)}
        data-variant={variant}
        data-size={size}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
