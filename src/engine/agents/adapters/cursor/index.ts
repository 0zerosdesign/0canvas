import type { AgentAdapter, AgentAdapterContext } from "../../types";
import { StreamJsonAdapter } from "../shared";
import { cursorSpec } from "./spec";

export function createCursorAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new StreamJsonAdapter(cursorSpec, ctx);
}

export { cursorSpec } from "./spec";
