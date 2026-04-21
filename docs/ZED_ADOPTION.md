# Adopting Zed's patterns for 0canvas

## Context

0canvas today is single-user, local-only. The V2 engine spawns Claude/Codex as CLI subprocesses and ferries messages over a custom MCP + WebSocket bridge. There is no agent loop, no shared session primitive, no multi-user anything. Zed has open-sourced three pieces of infrastructure that each fill a gap in 0canvas — but licensing and primitive-fit differ sharply across them. This plan maps what to borrow, what to skip, and in what order, framed for a **designer-first** product, not a code editor.

Three buckets, ranked by ROI:

1. **ACP** — the biggest win. Open spec, Apache-2.0, directly usable.
2. **Agent panel shapes** — steal the vocabulary (threads, tool cards, mentions, permissions), rebuild the UI as design-native.
3. **Collab** — borrow UX patterns only. Zed's sync layer is the wrong primitive *and* the wrong license.

---

## 1. ACP (Agent Client Protocol) — use it directly

**What it is.** JSON-RPC 2.0 over stdio. Two trait surfaces (`Agent` and `Client`), streaming `SessionUpdate` notifications, rich `ToolCall` schema (`id`, `kind`, `status`, `content[]`, `locations[]`), permission gating via `session/request_permission`. Apache-2.0, SDKs in Rust/TS/Python/Java/Kotlin. Claude Code, Gemini CLI, and Codex all ship ACP bridges already.

**Why it matters for 0canvas.** The current engine reinvents every wire: bespoke WebSocket framing, bespoke MCP dispatcher, bespoke CLI-subprocess streaming, bespoke chat-panel parsing of CSS-apply blocks. ACP replaces all of that with one well-defined contract — and you inherit Claude Code / Codex / Gemini as pluggable backends for free.

**Strategic fork — two directions, both viable:**

- **(a) 0canvas as ACP client.** Embed the TS SDK, spawn external agents as subprocesses. Immediate UX upgrade; no protocol design work.
- **(b) 0canvas speaks ACP outward.** Implement the `Agent` trait. Zed / Neovim / any future ACP editor can drive 0canvas's design-aware agent from inside the user's existing workflow. Positioning shift: *0canvas is also an agent backend that carries design-system context.*

**Recommendation: (a) first, (b) later.** (a) ships the UX win now; (b) becomes a distribution play once the design-aware tooling is mature enough to stand alone.

**Designer-friendly reframing of ACP primitives:**

- `ToolCall.kind` ships with `read/edit/search/execute/think/fetch`. Extend with design-native kinds via `_meta` (the spec's vendor-extension seam): `style`, `variant-fork`, `token-apply`, `layout`, `component-wire`, `a11y-check`.
- Tool cards render as **design receipts** — "Changed padding on 3 cards · preview diff" with a thumbnail — not terminal output.
- `locations[]` drives **follow-along on the canvas**: viewport pans/zooms to the element the agent is editing, mimicking design pair-programming.
- `session/request_permission` becomes designer-legible: "Apply this token change to 12 components across 3 pages?" not "Allow `chmod`?".

## 2. Agent panel architecture — steal the shapes

Zed's `crates/agent` + `crates/agent_ui` model: `Thread` entity with messages + tool-use state + `ActionLog` + `ProjectSnapshot`; native and ACP threads share the datamodel; `@`-mentions via `MessageEditor` + `mention_set.rs`; hardcoded security rules layered under user-defined tool permissions; `MAX_SUBAGENT_DEPTH=1` for specialized delegation.

**Map to 0canvas:**

- **Thread → design session.** Per-variant or per-component. Persist in `.0c`.
- **Mentions → design-native context.** Not just files:
  - `@color/primary`, `@space/lg` — design tokens
  - `@Button`, `@LoginPage/v2` — components, variants
  - `@selection` — current canvas selection
  - Image mentions (already in ACP `ContentBlock`) — paste reference screenshots directly
- **Tool cards → visual diffs.** Thumbnails, before/after, affected-component counts. Not code fences.
- **Permissions → designer language.** "Agent wants to apply token change to 12 components" with a preview, one-click approve/deny.
- **Subagents → specialist roles.** `a11y-auditor`, `token-consolidator`, `responsive-checker`, `copy-reviewer`. Each a first-class agent profile with scoped tools.

**Do not copy Zed's visual density.** The panel should feel like Figma's comments/AI side-panel, not a terminal. Borrow the *shapes* (Thread / ToolCall / Mention / Permission), redesign the *surface*.

## 3. Collab panel — borrow UX, replace the sync layer

**Licensing reality (must flag).** Zed client is GPL-3.0, `crates/collab` server is **AGPL-3.0**. 0canvas cannot reuse the code commercially without going AGPL itself. Treat Zed as a reference architecture to read, not a dependency to vendor.

**CRDT fit reality.** Zed uses a custom sequence CRDT with tombstones over a dual-rope — built for text. A design canvas is a tree of nodes with property maps. Wrong primitive. Pick a tree/map CRDT with a permissive license: **Loro** (Rust, MIT — good fit if 0canvas goes deeper into Tauri), **Automerge** (MIT, mature), or **Yjs** (MIT, largest ecosystem). Recommendation: prototype with Yjs (fastest to ship), revisit Loro if Tauri-side sync becomes core.

**Borrow these patterns:**

- **Panel structure.** `collab_panel.rs`'s `ListEntry` + Section tree maps cleanly: ActiveCall → Shared Projects → Teammates → Favorites. Participants rendered as cursor-color avatar chips, not rows.
- **Anchor concept.** Zed's `Anchor` gives stable text positions across concurrent edits. For a design canvas you need the same for **node IDs** — stable references to nodes that survive concurrent reparenting. Bake into `.0c` schema before collab work begins (node UUIDs, not positional paths).
- **Follow-along.** Pin your viewport to another participant's camera. Trivial to implement on an infinite canvas; high-impact for design review.
- **Voice/screenshare via LiveKit.** Optional. Most design teams already use Zoom/Slack for calls; defer unless it becomes a sales point.

**The differentiating move (where Zed left room):**

Zed's agent crates have **zero references** to Room / participant / presence primitives. The agent is not a participant — collaborators only see its edits land as yours. In 0canvas, **make the agent a first-class participant from day one**: own `replica_id`, presence color, cursor on the canvas, visible "following" by humans, interruptible mid-action. Same CRDT ops, same presence channel, no bifurcation.

This is the 0canvas pitch: *"the first collaborative design tool where an AI is a teammate, not a button."* It is net-new — not a catch-up feature.

---

## Sequenced path

**Phase 1 — ACP as client (weeks).** Replace bespoke Claude/Codex subprocess spawn + custom MCP with an ACP client wrapper. Map the existing 5 MCP tools (read state, get styles, list tokens, get feedback, apply CSS) to `ToolCall` shape. Rewrite the chat panel around `SessionUpdate` streaming. Keep the current `.0c` schema unchanged.

**Phase 2 — design-native agent panel (1–2 months).** Extend `ToolCall.kind` via `_meta` for design kinds; build visual diff cards; redesign mentions for tokens/components/variants; reshape permission modals in designer language; add 1–2 specialist subagents.

**Phase 3 — node-ID anchors in `.0c` (prep for collab).** Migrate `.0c` to UUID-addressed nodes so future CRDT adoption doesn't require a second migration. Ship before any sync work.

**Phase 4 — collab + agent-as-participant (quarter+).** Pick tree CRDT (Yjs first). Build a thin Node or Rust sync server. Ship presence + follow-along on the canvas. Wire the agent as a participant with its own replica_id. Voice deferred.

**Phase 5 (stretch) — 0canvas speaks ACP outward.** Implement `Agent` trait; expose stdio entry point. 0canvas becomes an agent backend any ACP-capable editor can drive.

## Critical files to modify

- `src/engine/index.ts` — dispatcher; ACP wiring plugs in here
- `src/engine/mcp.ts` — tool definitions; map to ACP `ToolCall` shape (keep tool semantics, swap envelope)
- `src/engine/oc-manager.ts` — add stable node UUIDs to `.0c` schema in Phase 3
- `src/0canvas/panels/ai-chat-panel.tsx` — rebuild around `SessionUpdate` stream, tool cards, mentions
- `src/0canvas/bridge/ws-client.ts` — carry ACP session updates instead of bespoke STYLE_CHANGE / AI_CHAT_REQUEST messages
- `src/0canvas/store/store.tsx` — add session/thread model; keep provider switch

## Reusable assets found in 0canvas

- `buildAiContextMarkdown()` in `ai-chat-panel.tsx` — keep; feeds ACP `ContentBlock[]`
- `CanvasBridgeClient` — keep the transport; switch the payload to ACP
- System prompts (`VARIANT_SYSTEM_PROMPT`, `ELEMENT_SYSTEM_PROMPT`) — keep; attach as initial thread context
- `OCManager` JSON CRUD — extend with node UUIDs, otherwise reuse

## References

- ACP spec + SDKs: https://github.com/zed-industries/agent-client-protocol (Apache-2.0, reusable)
- Zed agent crates (read-only reference): https://github.com/zed-industries/zed/tree/main/crates/agent_ui
- Zed collab crates (read-only reference, AGPL): https://github.com/zed-industries/zed/tree/main/crates/collab_ui
- Tree CRDTs: automerge.org · docs.yjs.dev · loro.dev

## Verification

This is a strategy plan, not a code plan. Phase-1 verification (once approved and implemented): run the engine, confirm ACP handshake with Claude Code as external agent, send a design prompt, observe streaming `SessionUpdate`s land in the chat panel, confirm a tool call round-trips (read selection → apply CSS → broadcast to canvas). Each later phase gets its own testable milestone when scheduled.

---

## Licensing & legal posture

**Not legal advice — get a real IP/tech lawyer to sign off before commercial release. This section summarizes public license text as of April 2026; terms change.**

### Component licenses

| Component | License | Commercial closed-source? |
|---|---|---|
| ACP spec (github.com/zed-industries/agent-client-protocol) | Apache-2.0 | Yes |
| ACP TS SDK (`@agentclientprotocol/sdk`; old `@zed-industries/agent-client-protocol` is deprecated) | Apache-2.0 | Yes — re-verify the new package before shipping |
| OpenAI Codex CLI (github.com/openai/codex) | Apache-2.0 | Yes |
| Gemini CLI (github.com/google-gemini/gemini-cli) | Apache-2.0 | Yes |
| Claude Code CLI (`@anthropic-ai/claude-code`) | Anthropic proprietary, source-available | Subprocess invocation by end user is contemplated; third-party-wrapper case not explicitly addressed — lawyer |

Apache-2.0 obligations: preserve copyright notices, include the license text in binary distributions (§4). No patent or trademark grant (§3 is narrow; §6 excludes trademarks entirely).

### Trademark — Apache-2.0 §6 grants no trademark rights

- OK (nominative fair use in most jurisdictions): "0canvas integrates with Claude Code, OpenAI Codex, and Gemini CLI."
- Not OK without written permission from the vendor: their logos, "official partner", "certified integration", co-branded marketing, implying endorsement.

### End-user authentication — the real question

Two very different postures, both technically functional, with different legal risk profiles:

**(a) BYO API key — defensible, ship first.**
User pastes their own Anthropic / OpenAI / Google API key. They become the vendor's direct customer. Vendor's Business / API Terms apply to them, not to you. Liability, quota, and usage policy enforcement sit on the user. This is the clean path.

**(b) BYO consumer subscription (Claude Pro/Max, ChatGPT Plus, Google AI Studio login) — grey zone, needs legal review.**
Consumer ToS for all three vendors historically restrict "automated or programmatic access" and account sharing. Public ToS does *not* explicitly address whether a third-party app may orchestrate the vendor's own CLI while the CLI authenticates to the user's consumer subscription.

What makes (b) more defensible than it looks: **0canvas never touches credentials.** It spawns the vendor's *own published CLI* (Claude Code, Codex CLI, Gemini CLI) as a subprocess. The CLI handles auth. The vendor shipped that CLI knowing it can be invoked by other tools. This is fundamentally different from scraping a login or reverse-engineering a websocket — both of which are unambiguously prohibited.

What makes (b) still risky: the vendor's enforcement posture is about *scale and framing*, not just technical mechanism. A big-enough userbase, or marketing that implies the subscription is being "used through 0canvas" rather than "by the user via their own CLI", invites attention.

### "But Zed does this — isn't that proof it's legal?"

Zed does integrate the same CLIs via ACP, and their product works with users' consumer subscriptions. That's evidence the architecture is viable; it is **not** a legal defense for 0canvas:

- Vendor-to-vendor commercial agreements are private. Zed may have direct contracts with Anthropic / OpenAI / Google that the public never sees. Claude Code specifically is a featured Zed integration — not accidental.
- "Another company does this" never binds a third party. If 0canvas gets a cease-and-desist, "Zed does it too" doesn't help.
- Non-enforcement is not permission. Vendors often tolerate integrations until they stop tolerating them.

**The real defense is the architecture**, not the precedent. That defense is: 0canvas spawns the vendor's own official CLI as a subprocess; the CLI handles authentication against credentials the vendor issued to that same user; 0canvas never sees, stores, forwards, or automates the credential itself; the user initiates every session. If that description holds, 0canvas's legal surface is similar to Zed's — and to any terminal emulator that runs a vendor CLI.

### 0canvas's own Terms of Service must

- Require users to represent they own the API keys / subscriptions they bring, and have authority to use them with 0canvas.
- Bind users to each vendor's then-current usage policy (link out to each).
- Disclaim liability for user violations of vendor terms.
- Prohibit credential sharing across 0canvas users.

### Recommended ship order

1. **v1 — API-key BYO only.** Boring, clean, shippable. Covers Anthropic / OpenAI / Google API keys. No consumer-login path.
2. **v2 — Consumer-subscription BYO via official CLI only.** User's own machine, user-initiated sessions, vendor's own CLI handling auth. Add after legal review of each vendor's then-current consumer ToS.
3. **Never** — credential capture, headless farms on a single subscription, any form of reselling or metered gatekeeping of another vendor's capacity, scraping a web login.

### Open questions for a lawyer to resolve before v1

- Anthropic's stance on third-party commercial apps invoking Claude Code against an end user's Anthropic account (API or consumer).
- OpenAI's stance on the same for Codex CLI.
- Google's stance on the same for Gemini CLI.
- Whether 0canvas's marketing copy needs vendor review (logos: yes; names: likely no; screenshots of vendor UI inside 0canvas: unclear).
- Whether Tauri's packaging of Apache-2.0 CLIs requires a specific NOTICE / LICENSE bundling approach.
