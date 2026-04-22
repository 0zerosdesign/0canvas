// ============================================================
// Tabs — a controlled tab strip shared by Col 2, Col 3, and
// Settings. Use the TabList + Tab components directly when you
// need imperative control; the <Tabs> wrapper is convenience.
// ============================================================
import * as React from "react";
import { cn } from "./cn";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  rightSlot?: React.ReactNode;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  rightSlot,
}: TabsProps<T>) {
  return (
    <div
      className={cn("oc-ui-tabs-list", className)}
      style={{ justifyContent: "space-between" }}
      role="tablist"
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
        {items.map((item) => (
          <Tab
            key={item.id}
            active={item.id === value}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.id)}
          >
            {item.icon}
            {item.label}
          </Tab>
        ))}
      </div>
      {rightSlot ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
}

export interface TabProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}
export const Tab = React.forwardRef<HTMLButtonElement, TabProps>(
  function Tab({ active, disabled, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={active || undefined}
        className={cn("oc-ui-tab", className)}
        data-active={active ? "true" : "false"}
        disabled={disabled}
        type="button"
        {...rest}
      />
    );
  },
);
