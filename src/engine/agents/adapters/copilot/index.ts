import type { AgentAdapter, AgentAdapterContext } from "../../types";
import { StreamJsonAdapter } from "../shared";
import { copilotSpec } from "./spec";

export function createCopilotAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new StreamJsonAdapter(copilotSpec, ctx);
}

export { copilotSpec } from "./spec";
export { stripAnsi } from "./ansi";
