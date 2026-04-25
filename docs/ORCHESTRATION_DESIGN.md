# Zeros Orchestration Layer — Design for Discussion

> **Doc label (PR 4):** Partial — design **proposal**, not a spec of the live app. The text still centers **ACP** as a wire protocol; the **shipping** path is the **native agent gateway** in `src/engine/agents/` (protocol-shaped compatibility may remain). See [`docs/Zeros-Structure/12-Doc-Index-And-Labels.md`](Zeros-Structure/12-Doc-Index-And-Labels.md).

**Status:** proposal, not yet built. Reviewed separately from the ACP capability and latency fixes.

## Why this layer

ACP is our wire-level protocol for talking to agents. It gives us tool calls, permission prompts, plans, modes, slash commands, and streaming updates — but only within a single agent session. ACP itself has nothing to say about:

- Multi-step workflows that span several prompts or several agents.
- Sub-agent delegation as a first-class orchestration primitive (ACP treats it as a tool call, but there's no primitive for "spawn this sub-agent under a different profile").
- Shared state that survives across turns, agents, or chats.
- Deterministic pipelines you can replay for auditing — which is what our flagship "autonomous design audit on production codebase" use case requires.
- Design-structure-aware agents that reason about components, tokens, and layouts, not just text.

Neither Zed nor opencode builds a graph engine on top of ACP. Both use a simpler model: profile (tool allowlist + MCP servers + rules) + `spawn_agent`-style delegation tool + rules library + thread history. That is the minimum viable list. Zeros needs a superset because our workflows are not "chat about code" — they're "run a structured audit and produce findings pinned to the canvas."

## The invariant we keep with ACP

**ACP is untouched.** Every orchestration primitive reduces to calling into an ACP session. When ACP adds a capability upstream, it flows through for free because the bindings are thin. Forks and proprietary protocols are out of scope.

## Seven primitives

Based on surveying Zed, opencode, LangGraph, Mastra, Inngest Agent Kit, OpenAI Agents SDK, Google ADK, CrewAI, AutoGen, smolagents, Rivet (Ironclad), and factory-style droid specialization. Ordered by load-bearing.

### 1. `AgentProfile`

```ts
type AgentProfile = {
  id: string;
  displayName: string;
  backend: AcpBackendId;           // claude-acp | codex-acp | gemini | opencode | ...
  systemPromptAddendum?: string;
  rules: RuleRef[];                // .rules files + RulesLibrary entries
  permissions: PermissionRuleset;  // opencode-style {permission, pattern, action}[]
  contextServers: ContextServerRef[];  // MCP servers auto-attached
  defaultModel?: ModelRef;
  defaultMode?: SessionModeId;
  canvasAware: boolean;
};
```

A profile is **orthogonal to the ACP backend.** The same `design-audit` profile can be bound to Claude, Codex, or Gemini — lets us benchmark identically across agents.

Merges Zed's profile + opencode's permission ruleset (which is strictly more expressive than Zed's). `permissions` follow `action: "allow" | "ask" | "deny"` with patterns and directory scoping.

### 2. `RulesLibrary`

```ts
type Rule =
  | { kind: "file"; path: string; defaultOn: boolean }         // .cursorrules, CLAUDE.md, AGENTS.md, GEMINI.md
  | { kind: "library"; id: string; content: string; defaultOn: boolean }
  | { kind: "typed"; id: string; scope: string; assertion: string }; // Zeros-specific: design-constraint predicates
```

Typed rules are the Zeros differentiator: `{scope: "text-elements", assertion: "wcag >= 4.5"}` lets the canvas MCP answer programmatically instead of the agent hallucinating audit results.

### 3. `AcpSessionBinding` — the leaf primitive

```ts
type AcpSessionBinding = {
  sessionId: string;
  parentSessionId?: string;
  profile: AgentProfile;
  connection: ClientSideConnection;  // ACP SDK
  events: EventBus;                   // fan-out of session/update
  hooks: {
    onPromptStart, onToolCall, onFinalMessage, onInterrupt
  };
};
```

Every orchestration operation — workflow step, subagent spawn, user chat, canvas @ask — is a binding. Bindings form a tree via `parentSessionId`.

### 4. Spawn / Handoff

Two duals, cloned from OpenAI Agents SDK + Zed's `spawn_agent_tool.rs` + opencode's `TaskTool`:

- **Spawn (agent-as-tool):** primary calls synthesized tool `spawn_<profile>`. A child binding is created with a fresh session. Parent continues after the child's final message. Used for research sub-tasks and audit parallelism.
- **Handoff (replace active binding):** transfer the user-facing chat to a new binding. An `input_filter` can rewrite the transcript before handoff. Used for mode switches.

Both go through an MCP tool exposed to the active ACP session — so **any backend that supports MCP can do Zeros spawn/handoff.** No per-agent work.

### 5. `Workflow` — minimal declarative DSL

```ts
workflow("design-audit")
  .step("scan",     { profile: "explore", prompt: "Enumerate all tokens in src/" })
  .parallel([
    { profile: "design-audit", prompt: "WCAG AA contrast" },
    { profile: "design-audit", prompt: "Component API drift" },
    { profile: "design-audit", prompt: "Unused tokens" },
  ])
  .synthesize({ profile: "write", prompt: "Prioritized report → {{scan.output}}" })
  .onInterrupt(approvalUi);
```

Takes the shape of Mastra's builder (`.then`, `.parallel`, `.branch`, `.foreach`, `.until`) but reduced to what we need. Each step = `binding.prompt()` + final-message collection.

**State lives in LangGraph-style channels with explicit reducers.** Parallel writes merge by reducer (e.g., `findings[]` appends, `summary` last-writer-wins). Survives across steps, queryable from the canvas.

Execution is sequential-with-fanout. No BSP scheduler. No visual graph editor (resisting the Rivet/n8n temptation — our users code).

### 6. `Interrupt` / HITL

Uniform wrapper that maps to:

- ACP `session/request_permission` → approval card in Zeros UI
- `interrupt(value)` inside a workflow step → pause, serialize state, wait for `resume(payload)`
- Canvas annotation `@approve(element)` → gate workflow progression on user action in the canvas

### 7. `Checkpoint` / `Run`

SQLite-backed (same choice as Zed and opencode). Each run is a record; each step completion writes channel values + binding state + ACP session ids. Resume = re-attach via `resume_session` / `load_session` (both in the `AgentConnection` trait for every backend). If a backend doesn't support resume, we degrade to re-sending the transcript.

## How primitives compose with ACP

```
┌──────────────────────────────────────────────────────────┐
│  Canvas / Composer / Chat  (Zeros UI)                    │
├──────────────────────────────────────────────────────────┤
│  Orchestration Layer (this proposal)                     │
│    Workflow / Interrupt / Checkpoint / Handoff           │
│    Profile Resolver / Rules Resolver                     │
│    AcpSessionBinding (tree)                              │
├──────────────────────────────────────────────────────────┤
│  ACP client (@agentclientprotocol/sdk)                   │
│    session/* JSON-RPC over stdio                         │
├──────────────────────────────────────────────────────────┤
│  ACP backends:                                           │
│    Claude | Codex | Gemini | opencode | Kimi |           │
│    Cursor | Factory Droid | Amp | (native, future)       │
│    + MCP servers (Zeros canvas MCP, user's servers)      │
└──────────────────────────────────────────────────────────┘
```

Invariants:

- Every leaf is an `AcpSessionBinding`. Orchestrator never touches models directly.
- Profile = what the agent sees. Orchestrator = what Zeros exposes to the agent (via MCP).
- Canvas tools (`canvas.get_selection`, `canvas.apply_mutation`, `design.audit_tokens`) are served as an MCP server — so **any backend that supports MCP gets them for free**.

## Two flagship use cases

### 1. Autonomous design audit on production codebase

Needs primitives 1, 3, 4, 5, 6, 7. Not 2 (rules) strictly, but the audit reads from rules so effectively all seven.

Shape:

1. `AgentProfile("design-audit")` with `permissions: read/grep/glob allow, write deny, bash deny except *test*`, rules `[design-tokens.md, a11y-checklist.md]`, context servers `[zeros-canvas-mcp]`.
2. `Workflow("design-audit")` with three phases: (a) enumerate sub-trees of `src/`, (b) parallel analyze (contrast / token coverage / type scale / spacing rhythm / component drift), (c) synthesize into `ZEROS_AUDIT.md` written via the `write` profile.
3. Checkpoint per step so a 20-minute audit survives laptop sleep.
4. Interrupts route to Zeros permission UI.

### 2. Canvas-aware agent (craft mode)

Needs primitives 1, 3, 6. Not a workflow — just a single binding.

Shape:

1. MCP server embedded in Zeros exposing canvas tools. Already partly exists.
2. `AgentProfile("canvas")` with `canvasAware: true`, context server = canvas MCP, rules = design-tokens.
3. `AcpSessionBinding` with per-turn injection of current selection into the prompt (the profile's `systemPromptAddendum` renderer).
4. Canvas `@ask` invokes `binding.prompt()` directly; streams tokens to a canvas overlay.

## Where Zeros should differ from existing frameworks

These are the design-tool axes nobody else optimizes for:

1. **Design structure is first-class state, not transcript.** Introduce `DesignGraph` channel (components, tokens, layouts, references). Canvas mutations update it; agent runs read via MCP. Nobody else has this.
2. **Audit as a primitive, not a use case.** Ship `AuditWorkflow` as a built-in with `inputs: {scope, rules}` → `outputs: Finding[]`. Findings render as canvas pins, not chat text.
3. **Canvas is the graph.** Resist visual workflow editors. Our users are designer-developers; they code workflows, they see results on the canvas.
4. **Every backend is interchangeable at workflow level.** Benchmark mode: run the same audit across all eight ACP backends in parallel, diff findings. Zeros becomes the design-aware ACP evaluation harness.
5. **Rules are typed.** Go beyond text `.rules` files: let rules declare constraints the MCP server answers programmatically (no agent hallucination).
6. **Profiles bundle design context.** Factory-droid-style catalogs — a profile like `figma-migration` auto-wires Figma MCP + token MCP + canvas MCP.

## Suggested build order

1. `**AgentProfile` + `PermissionRuleset`** — port opencode's ruleset, keep Zed-shape for familiarity.
2. `**RulesLibrary`** — port Zed's rules; add typed-design-rules schema.
3. `**AcpSessionBinding**` tree — make the current `acp-chat` a binding; implement `spawn` returning a child.
4. **Spawn-as-tool MCP server** — expose `spawn_agent` MCP tool so any ACP backend with MCP can use it. Clone Zed's `spawn_agent_tool.rs` semantics in TS.
5. `**Workflow` builder + SQLite checkpointer** — thin DSL, ~500 LOC.
6. **Approval/interrupt wrapper** — reuses existing `session/request_permission` UI.
7. `**DesignGraph` + canvas MCP server** — the differentiator.
8. `**AuditWorkflow` built-in** — flagship use case falsifies everything above.

Steps 1–6 mirror existing patterns. Steps 7–8 are Zeros-specific and where novel engineering lives.

## Risks / open questions

- **Can-we-fix-it gaps from the prior research** (Claude hooks, Codex message edit, opencode /undo). Orchestration does not replace those — they still need adapter fixes or upstream PRs. Don't conflate.
- **Permission ruleset complexity.** opencode's design is good but we'd carry cognitive load. Start with a simple allow/ask/deny and grow.
- **Design-graph scope.** Easy to over-engineer. V1 = read-only structural view (components + tokens + where they're used). Mutations = v2.
- **Visual graph temptation.** Keep saying no until we see repeated user asks for one. The canvas IS the graph for design work.
- **Upstream drift.** If a Zed adapter ships a new capability, we want it immediately. Orchestration must not hardcode around ACP gaps — if a gap is unavoidable, use `_meta` extension rather than forking.

## What this doc is NOT

- Not an implementation plan. When any primitive is ready to build, that's a separate scoped plan.
- Not a commitment to order. Items 1–3 are load-bearing; 4 enables multi-agent; 5–8 layer on top.
- Not a replacement for the ACP/latency fixes already approved separately.
