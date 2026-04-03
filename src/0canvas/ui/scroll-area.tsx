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
          overflowY: "scroll" as const,
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
        padding: "1px",
        transitionProperty: "color, background-color, border-color",
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        transitionDuration: "150ms",
        userSelect: "none",
        ...(isVertical
          ? { height: "100%", width: "10px", borderLeft: "1px solid transparent" }
          : { height: "10px", flexDirection: "column" as const, borderTop: "1px solid transparent" }),
      }}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        style={{
          background: "var(--grey-800)",
          position: "relative",
          flex: "1 1 0%",
          borderRadius: "9999px",
        }}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
