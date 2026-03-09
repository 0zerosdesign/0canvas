// Message protocol between the extension host and webview.
// All communication happens via postMessage with typed messages.

import type { DDProjectFile } from "./types";

// ── Host → Webview messages ────────────────────────────────

export type HostToWebviewMessage =
  | { type: "init"; doc: DDProjectFile; version: number }
  | { type: "documentUpdated"; doc: DDProjectFile; version: number }
  | { type: "error"; errors: string[] }
  | { type: "ack"; requestId: string; version: number }
  | { type: "reject"; requestId: string; reason: string };

// ── Webview → Host messages ────────────────────────────────

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "openAsText" }
  | { type: "applyPatch"; requestId: string; patch: DDPatch };

// ── Patch operations ───────────────────────────────────────
// Structured edits that the webview sends to the host.
// The host applies them to the document and writes back.

export type DDPatch =
  | { op: "setProjectName"; value: string }
  | { op: "setBreakpoint"; key: "desktop" | "laptop" | "tablet" | "mobile"; value: number }
  | { op: "setVariable"; name: string; value: string | number | boolean | null }
  | { op: "deleteVariable"; name: string }
  | { op: "updateVariantName"; variantId: string; name: string }
  | { op: "updateVariantStatus"; variantId: string; status: "draft" | "finalized" | "sent" | "pushed" }
  | { op: "updateVariantContent"; variantId: string; html?: string; styles?: string }
  | { op: "deleteVariant"; variantId: string }
  | { op: "addFeedback"; variantId: string; feedback: { id: string; text: string; severity?: "info" | "low" | "medium" | "high" | "critical"; elementId?: string; createdAt: string } }
  | { op: "deleteFeedback"; variantId: string; feedbackId: string }
  | { op: "resolveFeedback"; variantId: string; feedbackId: string }
  | { op: "updateCanvasViewport"; viewport: { x: number; y: number; zoom: number } }
  | { op: "updateVariantPosition"; variantId: string; position: { x: number; y: number } }
  | { op: "updateVariantCanvasSize"; variantId: string; size: { width: number; height: number } }
  | { op: "updatePagePosition"; pageId: string; position: { x: number; y: number } };
