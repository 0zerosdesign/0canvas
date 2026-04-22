"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

// ── Inline-style version of ScrollArea ──
// No dependency on cn/tailwind-merge/clsx — works in any consumer app.

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={className}
      style={{ position: "relative" }}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "inherit",
          overflow: "auto" as const,
          outline: "none",
        }}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  const isVertical = orientation === "vertical";
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={className}
      style={{
        display: "flex",
        touchAction: "none",
        padding: "var(--space-px)",
        transitionProperty: "color, background-color, border-color",
        transitionTimingFunction: "var(--ease-emphasized)",
        transitionDuration: "var(--dur-base)",
        userSelect: "none",
        ...(isVertical
          ? { height: "100%", width: "var(--space-5x)", borderLeft: "var(--space-px) solid transparent" }
          : { height: "var(--space-5x)", flexDirection: "column" as const, borderTop: "var(--space-px) solid transparent" }),
      }}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        style={{
          background: "var(--surface-1)",
          position: "relative",
          flex: "1 1 0%",
          borderRadius: "var(--radius-pill)",
        }}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
