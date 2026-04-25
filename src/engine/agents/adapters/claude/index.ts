// Public surface of the Claude adapter.

import type { AgentAdapter, AgentAdapterContext } from "../../types";
import { StreamJsonAdapter } from "../shared";
import { claudeSpec } from "./spec";

export function createClaudeAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new StreamJsonAdapter(claudeSpec, ctx);
}

export { claudeSpec } from "./spec";
export { ClaudeStreamTranslator } from "./translator";
export type { ClaudeTranslatorOptions } from "./translator";
export { installClaudeHooks } from "./hooks";
export type { ClaudeHookInstallInput } from "./hooks";
export { findTranscript, replayTranscript } from "./history";
