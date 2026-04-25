import type { AgentAdapter, AgentAdapterContext } from "../../types";
import { StreamJsonAdapter } from "../shared";
import { codexSpec } from "./spec";

export function createCodexAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new StreamJsonAdapter(codexSpec, ctx);
}

export { codexSpec } from "./spec";
export { CodexStreamTranslator } from "./translator";
export type { CodexTranslatorOptions } from "./translator";
export { listCodexSessions } from "./history";
