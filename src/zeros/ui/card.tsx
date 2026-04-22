// ============================================================
// Card — container primitive for grouped content.
// ============================================================
import * as React from "react";
import { cn } from "./cn";

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("oc-ui-card", className)} {...rest} />;
}

export function CardHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("oc-ui-card-header", className)} {...rest} />;
}

export function CardBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("oc-ui-card-body", className)} {...rest} />;
}

export function CardFooter({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("oc-ui-card-footer", className)} {...rest} />;
}
