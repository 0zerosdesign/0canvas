// ──────────────────────────────────────────────────────────
// renderers — public surface
// ──────────────────────────────────────────────────────────

export { MessageView } from "./message-view";
export { defaultRegistry, resolveRenderer } from "./registry";
export type {
  ApplyReceipt,
  Renderer,
  RendererContext,
  RendererRegistry,
  ToolMatcher,
} from "./types";

// Design-tool metadata stays exported because PermissionBar (still in
// agent-chat.tsx for now) needs the same matcher and prompt builder.
// Phase 0 follow-up moves PermissionBar into renderers/ too.
export {
  DESIGN_TOOLS,
  matchDesignTool,
  lookupCurrentValue,
} from "./design-tools";
export type { DesignToolEntry, PermissionPrompt } from "./design-tools";
export { matchSubagent } from "./subagent";
export type { SubagentInfo } from "./subagent";
