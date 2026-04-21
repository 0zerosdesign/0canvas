// ============================================================
// cn — class-name joiner used by every primitive.
// Mirrors the shadcn/ui convention: compose class strings with
// clsx, then dedupe-merge Tailwind utilities with tailwind-merge.
// Both packages are already in the project (see package.json).
// ============================================================
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
