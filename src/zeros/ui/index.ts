// ============================================================
// Zeros UI primitives barrel — import from here, not from
// the individual component files, so the module graph stays
// stable across refactors.
//
//   import { Button, Input, DropdownMenu, Card } from "@/Zeros/ui";
// ============================================================
import "./primitives.css";

export { cn } from "./cn";
export { Button } from "./button";
export type { ButtonProps } from "./button";
export { Input, Textarea, Label } from "./input";
export {
  Badge,
  StatusDot,
  Kbd,
  Divider,
  Pill,
  Icon,
} from "./atoms";
export type { BadgeProps, BadgeVariant, DotStatus, PillProps } from "./atoms";
export { Card, CardHeader, CardBody, CardFooter } from "./card";
export { Tabs, Tab } from "./tabs";
export type { TabItem, TabsProps, TabProps } from "./tabs";
export { DropdownMenu } from "./dropdown-menu";
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "./dialog";
export { Tooltip } from "./tooltip";
export { ScrollArea } from "./scroll-area";
export { ErrorBoundary } from "./error-boundary";
