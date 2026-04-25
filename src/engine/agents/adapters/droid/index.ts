import type { AgentAdapter, AgentAdapterContext } from "../../types";
import { StreamJsonAdapter } from "../shared";
import { droidSpec } from "./spec";

export function createDroidAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new StreamJsonAdapter(droidSpec, ctx);
}

export { droidSpec } from "./spec";
export { installDroidHooks } from "./hooks";
