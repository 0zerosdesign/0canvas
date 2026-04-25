import type { AgentAdapter, AgentAdapterContext } from "../../types";
import { StreamJsonAdapter } from "../shared";
import { ampSpec } from "./spec";

export function createAmpAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new StreamJsonAdapter(ampSpec, ctx);
}

export { ampSpec } from "./spec";
