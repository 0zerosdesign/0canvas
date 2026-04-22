# Zeros dev-capability strategy — design-first, agent-driven, locally collaborative

## Context

Zeros is a design-first agentic tool (Nordcraft-aligned, Tauri + Rust + React). The user — a designer-developer, solo — wants it to also serve developers doing design-adjacent work, wants to eventually **build Zeros in Zeros itself**, wants design data to stay local (no cloud DB for designs) because designers love collab and storing design data is expensive to scale, and plans a **paid tier ($59/year)** with proper auth so Pro features can be gated.

Constraints:
- **USP is the design tool.** No explicit IDE chrome — no visible "Code / Run / Debug" tabs, no SCM sidebar, no extension marketplace.
- **Everything must be supported under the hood.** If an agent wants to open a file, LSP a symbol, run a test, or stage a commit, it works — the UI just doesn't advertise it.
- **Local-first for design state and collab.** A small auth/subscriptions DB is fine. Design data never leaves the device.
- **Agents are the primary dev interface.** Panels are fallback.
- **Solo ops budget.** Managed services (Supabase, Stripe, Cloudflare) over self-hosted infra. No Postgres we operate. No k8s. No 3am pages.

Research sources: Zed docs, OpenCode docs, Conductor docs, Rivet Agent OS docs. Current Zeros: git/env/todo/terminal panels built, ACP integration live, no code editor, no LSP, no collab.

## What this plan commits to

A phased buildout that keeps the design-tool face while making Zeros fully capable of self-hosting its own development. Each phase is independently shippable and testable.

---

## Strategic posture

1. **Design canvas is the default surface.** Code/diff/terminal/git panels only appear when the agent or user explicitly surfaces them (via request, error, or checkpoint review).
2. **No plugin API.** Extensibility = MCP for agents + curated native panels for users. (Carries forward from the earlier extension-posture decision.)
3. **CRDT buffers everywhere.** Code and design state both live on Automerge docs from day one — same storage that powers collab later, so we don't retrofit.
4. **Agents ship with guardrails.** Plan/Build mode split + per-tool permissions (from OpenCode). Per-turn checkpoints (from Conductor). Parallel agents in isolated worktrees (from Conductor).
5. **LSP without IDE chrome.** Tree-sitter for instant structural parsing; language servers spawned as Rust subprocesses; diagnostics surface through the agent or inline in the editor — never as a "Problems" panel.

---

## Phased buildout

### Phase A — Code editor as a first-class surface (hidden until needed)

**Goal:** when an agent opens/edits a file, a real editor appears. When no file is open, canvas is full-bleed.

**Editor choice: CodeMirror 6.** Monaco is ~5MB gzipped, assumes a VS-Code-shaped workspace, and ships a web-worker architecture that fights Tauri. CM6 is ~150KB, composable, framework-agnostic, and designed so you add only the extensions you need. For a reveal-surface editor that should feel like it's part of the canvas UI rather than an IDE-in-a-webview, CM6 wins on every axis.

**Package set (concrete):**
- `@uiw/react-codemirror` — the actively-maintained React wrapper. Handles React StrictMode cleanup (`view.destroy()`) correctly. (There are older wrappers that don't — avoid `react-codemirror2`.)
- `@codemirror/state`, `@codemirror/view`, `@codemirror/commands` — core.
- `@codemirror/lang-javascript`, `@codemirror/lang-rust`, `@codemirror/lang-css`, `@codemirror/lang-json`, `@codemirror/lang-markdown` — language bundles. Each ships Lezer parser + highlights + indent + folds in one install.
- `@codemirror/merge` — ships `MergeView` (side-by-side) **and** `unifiedMergeView` (inline diff decoration on a normal `EditorView`). Use `unifiedMergeView` for "agent edited this file" previews.
- `@automerge/automerge-codemirror` 0.2.x — binds an `EditorState` to an Automerge text field. Handles the reconciliation both ways.

**Parser architecture: Lezer inside the editor, tree-sitter in Rust.**

CM6 does not use tree-sitter natively — it uses its own Lezer parser. This is deliberate and actually fine for us: Lezer is already incremental, sub-frame on typical files, and ships batteries-included grammars. We use tree-sitter *separately*, in Rust, for things the editor doesn't need to own (outline, symbol extraction, agent-facing structural queries). See Phase B.

**Extension management via Compartments.**

CM6 configuration is data, not a plugin host. Use `Compartment.reconfigure()` to hot-swap LSP language, diagnostic set, theme, and merge mode without tearing down the `EditorView`. This matters because the reveal-surface swaps documents frequently as the agent opens new files; we don't want to remount the entire editor each time.

```ts
const lspCompartment = new Compartment();
const mergeCompartment = new Compartment();
const state = EditorState.create({
  doc,
  extensions: [
    basicSetup,
    lspCompartment.of(lspExtensionFor(filePath)),
    mergeCompartment.of([]),                // empty until agent edits arrive
    automergeBinding(automergeHandle, "content"),
    keymap.of([...]),
  ],
});
```

**Automerge buffers from day one.**

Every code buffer is an `Automerge.Text` field on an Automerge doc. The `@automerge/automerge-codemirror` binding converts CM6 transactions to Automerge changes and back. This means:

- Local undo/redo works (CM6's history on top of Automerge changes).
- Agent edits apply as Automerge changes with author metadata (`{author: "agent:claude-code"}`), so the transcript can attribute every change.
- When Phase D lands, buffers sync peer-to-peer with zero migration — same doc type, same storage, different transport.
- Floating text cursors survive concurrent edits correctly (Automerge native feature — no manual position translation needed for collaborator cursors).

**Storage — Rust side, disk-backed, sans-IO.**

`src-tauri/src/buffers.rs` owns Automerge docs. Library choice: **`samod`** (see Phase D for why — it's JS-wire-compatible with `automerge-repo`, sans-IO so it plugs into any transport, and keeps the door open for future JS peers). Docs persist to `.zeros/buffers/<doc-id>.automerge` on change. Load eagerly on open, keep in memory for the session, flush debounced to disk.

**Multibuffer — the agent-review surface.**

Zed's signature feature. When the agent edits N files in a turn, instead of opening N editor tabs, show **one** scrollable view with excerpts from each file (the edited hunks plus surrounding context). The user reviews/accepts/rejects per hunk in a single surface.

CM6 doesn't have native multibuffer. Three patterns are viable; we pick the **single-doc + excerpt-decorations** approach:

- One `EditorView` holds a synthetic doc built from excerpts of the real files.
- Non-excerpt regions are read-only (via `EditorState.readOnly` on ranges).
- Each excerpt is wrapped in a `Decoration` with a header showing `path:line-range` and accept/reject buttons.
- Edits to excerpts flow back to the source Automerge docs via the header's metadata. Decorations handle the mapping.

This is simpler to build than stacking N `EditorView`s and matches Zed's UX exactly.

**Editor surface UX:**
- Column-3 (already scaffolded in `src/shell/column3.tsx`) becomes the editor host. Default empty state = full canvas.
- When an agent opens a file, column-3 slides in with the editor. Swipe/click to dismiss.
- Multibuffer view replaces the editor view when an agent turn completes with file edits. Chat-transcript "View changes" chip opens it.
- No file tree by default. A command palette–style "open file" overlay (⌘P) is the user-driven entry point. Agent-driven is the primary one.

**Critical files — Phase A:**
- New: `src/editor/codemirror-host.tsx` — React host, `@uiw/react-codemirror`, compartments, Automerge binding.
- New: `src/editor/multibuffer.tsx` — single-doc + excerpt decorations, accept/reject per hunk.
- New: `src/editor/extensions/` — factored extension bundles per language + LSP compartment.
- `src/shell/column3.tsx` — mount editor or multibuffer based on state.
- New: `src-tauri/src/buffers.rs` — `samod` repo, disk persistence, Tauri commands `open_buffer`, `save_buffer`, `list_buffers`.
- New: `src-tauri/src/buffer_store.rs` — content-addressed blob store shared with checkpoints (Phase C).

**Verification — Phase A:**
- Agent says "open `src/app-shell.tsx`" → column-3 slides in with CM6 editor, Lezer highlights apply within one frame.
- Edit a character locally → Automerge change logged → survives app restart.
- Agent edits 4 files in a turn → chat transcript shows "View changes (4 files)" chip → clicking opens multibuffer with 4 excerpts → accept 3, reject 1 → main docs reflect only accepted changes.
- Force-quit app mid-edit → reopen → unsaved buffer state restored from Automerge snapshot.

### Phase B — LSP and language intelligence (no Problems panel)

**Goal:** agents and the reveal-surface editor get type info, go-to-def, rename, diagnostics. No IDE chrome. Two parallel systems: tree-sitter in Rust for instant structural queries, LSP for deep language intelligence.

#### B.1 — Tree-sitter in Rust (instant, always-on)

Not the same thing as syntax highlighting in the editor — Lezer handles that inside CM6 (Phase A). Tree-sitter here runs in Rust and answers structural questions that the editor and agents both ask:

- **Outline / symbol list** for a file (functions, classes, exports).
- **Fold ranges** for the multibuffer view.
- **Agent-facing structural queries** — "find all exports of this module", "find all callers of `useChatCwd`", "find the component tree below `AppShell`". These run without a language server attached.
- **Selection/motion** — structural "select next sibling", "expand selection to parent block" commands available in the command palette.

**Stack:**
- `tree-sitter` crate (0.24+).
- Grammar crates: `tree-sitter-typescript`, `tree-sitter-tsx`, `tree-sitter-rust`, `tree-sitter-css`, `tree-sitter-json`, `tree-sitter-markdown`.
- Query files (`highlights.scm`, `tags.scm`, `folds.scm`) bundled as Rust resources.
- Incremental parsing: on every buffer edit, `tree.edit()` with the offset change then `parser.parse(src, Some(&old_tree))` — constant-time for typical edits.

**Native Rust vs. tree-sitter-wasm in the WebView.** Native is 2-5× faster but requires an IPC hop for editor-facing results. For our case, editor syntax highlighting is Lezer's job (no IPC), and Rust-side tree-sitter serves agents + outline + structural queries — so native wins cleanly. No wasm tree-sitter needed.

**Parse cache.** `HashMap<BufferId, Tree>` keyed by Automerge doc ID. Re-parsed on change, invalidated on close. Memory footprint is tiny — a parse tree is a few hundred KB even for large files.

#### B.2 — LSP orchestrator (on-demand, Rust-managed)

Rust process manager in `src-tauri/src/lsp.rs` spawns language servers as needed. First-class support for:
- `typescript-language-server` (TS/TSX) — our main language since Zeros is TS.
- `rust-analyzer` (Rust) — needed for editing `src-tauri/`.
- `vscode-css-languageserver` (CSS) — needed for design-token editing and component styles.

Others added later. Start narrow.

**Stack:**
- `lsp-types` crate — protocol types.
- `lsp-server` crate — framing + JSON-RPC message I/O. This is what `rust-analyzer` uses internally; it's mature.
- `tokio::process::Command` — spawn language server subprocesses, capture stdio.
- Do **not** use `tower-lsp` — it's for *building* a language server, not proxying one. Overkill for our use.

**Server lifecycle:**
- Spawn on first buffer open for a language.
- Keep alive for the session.
- One server per workspace root (not per buffer).
- Shut down cleanly on app quit.
- Track document state client-side (`HashMap<Url, DocState>`) so we can synthesize `textDocument/didOpen` / `didChange` / `didClose` notifications as the user navigates.

**Server install story (borrowed from Zed).**
- Detect system-installed binary first (`which typescript-language-server`, `which rust-analyzer`).
- If missing, offer a one-click install via the app's `.zeros/bin/` local directory. Download official release for the platform, verify checksum, chmod +x, path it in.
- Never bundle servers in the Tauri app (bloats distribution; breaks updates).

#### B.3 — Tauri transport (no WebSockets, no worker hops)

The standard `codemirror-languageserver` package speaks WebSocket by default. We bypass that — the LSP server is in the same process tree as Tauri, no reason to encode messages as HTTP frames.

Custom transport instead:
- LSP server stdout/stdin → Rust framing via `lsp-server::Message`.
- Rust forwards frames through Tauri events (`lsp:message:<serverId>`) to the WebView.
- Frontend CM6 `codemirror-languageserver` uses a thin custom transport that subscribes to those events and sends via `invoke("lsp_send", { ... })`.
- Bidirectional, low-latency, no network.

**Missing from `codemirror-languageserver`:** code actions, semantic tokens, inlay hints. We add what we need incrementally — code actions first (they power "apply fix" in the editor).

#### B.4 — Diagnostics UX (agent-fed, not panel-fed)

This is the design-tool-centric decision: **no "Problems" panel ever**.

Where diagnostics surface:
- **Inline in the editor** — red underlines, hover explanations, `⌘.` for fixes. Standard CM6 affordance, nothing else needed. Only visible when the editor is visible.
- **Agent context** — the ACP `session-manager` subscribes to diagnostics and, on every agent turn, includes relevant diagnostics for any file the agent edited or read. Format: a structured tool-result block the agent sees as context. The agent decides whether to surface.
- **Checkpoint gating (optional)** — a config can prevent a checkpoint from being marked "clean" if diagnostics are present. Makes auto-advance workflows safer.

Never:
- No bottom "Problems" tab.
- No workspace-wide diagnostic badge in chrome.
- No "X errors, Y warnings" status bar. (We have no status bar.)

#### Critical files — Phase B

- New: `src-tauri/src/tree_sitter.rs` — parser pool, query cache, grammar registry.
- New: `src-tauri/src/lsp.rs` — server process manager, stdio framing, request/response tracking.
- New: `src-tauri/src/lsp_install.rs` — detect, download, checksum, chmod language servers.
- New: `src/engine/lsp/client.ts` — Tauri-event-based transport for `codemirror-languageserver`.
- `src/editor/codemirror-host.tsx` — wires LSP compartment per buffer.
- `src/engine/acp/session-manager.ts` — extend to pipe diagnostics as agent context.

#### Verification — Phase B

- Open a TS file with a deliberate type error → red underline appears within one frame (Lezer parse), hover shows LSP message within 3s of server spawn.
- Ask agent to "fix the type error here" → agent receives the LSP diagnostic as tool context and proposes a fix.
- Tree-sitter outline: open a file → `⌘\` or equivalent opens outline → all functions/classes listed → click navigates.
- Install flow: open a Rust file with no system `rust-analyzer` → app prompts "install rust-analyzer? (one-click)" → after install, LSP features work.
- No Problems panel exists anywhere in the UI.

### Phase C — Agent UX: Plan/Build, checkpoints, parallel sessions

**Goal:** raise the agent ceiling without raising UI complexity. Borrow from OpenCode (Plan/Build, subagents), Conductor (checkpoints, parallel worktrees, diff-review-first), and Rivet (durable session state). The net effect: users trust agents with bigger tasks because the *undo story* and the *safe-exploration story* are airtight.

#### C.1 — Plan / Build mode

The single most impactful UX change. Borrowed directly from OpenCode (`mode: primary` with per-tool permissions in markdown/YAML).

- **Plan mode (default).** Agent has read-only tools: file reads, LSP queries, grep, git read. Write tools (edit file, run shell, git write) return a permission-denied with "Switch to Build mode to apply." Agent cannot accidentally break things during exploration.
- **Build mode.** Write tools allowed. Toggle is a single chip in the composer, keyboard-shortcut bindable. Switch is per-session, not global.
- **Why this matters for designers:** "Tell me what you'd change to make this component responsive" stays safe. "Now do it" is a deliberate click. No fear of the agent touching things you didn't intend.
- **Per-tool permission tri-state** (OpenCode pattern). For each tool, Plan-mode default is `deny`, Build-mode default is `ask`. Power-users override via agent markdown. Example: an agent named `design-critic.md` might have `file_read: allow, file_edit: deny` in both modes — forcing it to be a reviewer role even in Build mode.
- **UI surface.** One chip in the composer reads `Plan` / `Build`. Clicking toggles. That's it. No separate settings page. The permission map is configurable but not required — defaults work.

#### C.2 — Per-turn checkpoints

Conductor's best idea: every *turn* is a restore point, not every edit. Reverting is a single click in the chat transcript.

**What a checkpoint contains:**
- Snapshot of every Automerge doc the agent read/wrote in the turn (cheap — CRDTs dedupe by content hash).
- The agent tool-call tree for the turn.
- A `checkpoint_id` embedded in the chat turn's UI.
- Optional: a hidden git ref `refs/Zeros/checkpoints/<session>/<turn>` so `git` sees it but it never appears in the user's branch list.

**Where checkpoints live:**
- `.zeros/checkpoints/<sessionId>/<turn>.json` — metadata + doc content hashes.
- Content-addressed blobs in `.zeros/checkpoints/blobs/` (dedupes unchanged docs across turns).
- A sliding window: keep last 50 turns per session; older turns get coalesced into the baseline. User can pin a checkpoint to prevent coalescing.

**Revert UX:**
- Each turn in the chat transcript has a "⤺ Revert to before this turn" affordance. One click.
- Revert restores buffers, canvas state, and any agent-touched files to their snapshot. Conversation history is preserved — the user sees "reverted to checkpoint T" as a new turn.
- Revert is itself a checkpoint — reverts are reversible.

**Why this beats git-based undo:**
- Git is file-granular; checkpoints are session-granular. If the agent edits 12 files in one turn and the user hates turn 7, one click rewinds exactly those 12 files across those 7 turns.
- Non-code state (canvas, design tokens in Automerge) isn't in git. Checkpoints cover it.
- The chat transcript is the revert UI — no separate "history" panel to learn.

#### C.3 — Parallel agent sessions in isolated worktrees

Conductor's core primitive: each session is its own sandboxed workspace. Adapted for a Tauri app.

**Model:**
- Each agent session = one git worktree under `.zeros/worktrees/<sessionId>/`.
- The main Zeros window always shows *one* active worktree; a session switcher in the left rail shows all sessions with live status (idle / thinking / awaiting-permission / error).
- Switching sessions is a view swap, not a reload. Agents in inactive sessions keep running in the background.
- Each session has its own Plan/Build state, its own checkpoint timeline, its own chat.

**Merge model:**
- "Apply this session" = three-way merge of the worktree against the main branch. Conflict resolution uses the existing `src/shell/git-panel.tsx` merge-conflict UI.
- Optional: designers who don't want to think about git see a simpler "Keep these changes" button that does the merge automatically, dropping into conflict resolution only if it can't fast-forward.
- A session can be "discarded" — worktree deleted, checkpoints archived for 30 days in case of regret.

**Why this matters:**
- Try three agents on the same problem in parallel ("make this responsive"), review all three diffs side-by-side, pick the best.
- Let a long-running agent task (big refactor, design-system migration) run in the background while you keep working in a different session.
- Isolates blast radius — a bad agent run can't trash your current design because it's in a different worktree.

**UI:**
- Session rail in the left column. Avatar/icon per session, color-coded by agent (Claude/Codex/Gemini). Click to switch.
- Active session gets its name in the title bar.
- Running agents show a subtle pulse; agents awaiting permission show an attention dot.

#### C.4 — Sub-agent delegation

OpenCode's primary/subagent split — invisible to casual users but powerful for power-users.

- Primary agents cycle with a keyboard shortcut (or by manual pick).
- `@mention` a subagent in the prompt to delegate: `@explore look at how auth works in this codebase` hands off to a read-only exploration subagent. Its result returns as context to the primary.
- Subagent defs live in `.zeros/agents/<name>.md`:
  ```
  ---
  name: design-critic
  mode: subagent
  tools:
    file_read: allow
    file_edit: deny
    shell: deny
  ---
  You are a design critic. Read the target component and explain three
  things that could be improved, ranked by impact.
  ```
- Ship Zeros with 3-4 built-in subagents (`@explore`, `@review`, `@design-critic`, `@lint`). Users/teams add more.

#### C.5 — Session durability

Rivet's pattern — sessions survive app restarts.

- Every session's chat transcript, tool calls, and checkpoint timeline persist to `.zeros/sessions/<sessionId>/`.
- Restart the app → all sessions reappear exactly where they were. Running agents reconnect if the subprocess is still alive; if not, the session shows "disconnected — click to resume" and a fresh ACP subprocess picks up from the last checkpoint.
- This is the difference between "agents as chat" (ephemeral, lose state on crash) and "agents as work" (durable, survive restarts).

#### Critical files — Phase C

- `src/zeros/acp/acp-mode.tsx`, `src/zeros/acp/use-acp-session.tsx` — Plan/Build state + permission map.
- `src/zeros/acp/sessions-provider.tsx` (already started per git status) — parallel sessions, session switcher state.
- `src/zeros/acp/acp-chat.tsx` — per-turn checkpoint UI, revert affordance, session name.
- New: `src-tauri/src/checkpoints.rs` — snapshot + restore + content-addressed blob store.
- New: `src-tauri/src/worktrees.rs` — git worktree orchestration. Reuses `src-tauri/src/git.rs` primitives.
- New: `src-tauri/src/session_store.rs` — durable session persistence (transcript, tool calls, checkpoints).
- New: `src/shell/session-rail.tsx` — left-column session switcher UI.
- New: `.zeros/agents/` convention — bundled subagents + user-defined ones.

#### Verification — Phase C

- **Plan/Build:** switch a session to Plan mode, ask agent to "edit this file" — receives a denial, surfaces it in chat. Switch to Build, same prompt — edit succeeds.
- **Checkpoints:** agent edits 5 files in a turn, user clicks "revert to before this turn" in the chat, all 5 files snap back, a new turn appears noting the revert. Click revert again — edits restored.
- **Parallel sessions:** start session A (Claude) on a refactor, start session B (Codex) on the same refactor, let both finish, view diffs side-by-side, merge A, discard B. Main worktree has only A's changes.
- **Subagents:** `@design-critic review this component` — primary agent invokes the subagent, subagent returns a review-text-only result (no edits), primary summarizes back to the user.
- **Durability:** start a long agent task, force-quit the app, reopen — session list shows the task, click to resume, agent picks up from last checkpoint without losing context.

### Phase D — Local-first collaboration (Pro-tier, iroh + Automerge)

**Goal:** LAN multiplayer out of the box; cross-LAN collab for Pro users via auth-gated signaling (Phase D.6). Design data never touches cloud storage. CRDT-correct merge. Cursors, selections, follow-mode. Shared agent sessions.

#### D.1 — Transport: iroh

iroh is the right choice — Rust-native, QUIC-based, designed for direct P2P with relay fallback. Alternatives considered and ruled out:
- **libp2p** — broader but heavier (Kademlia DHT, pub/sub, multiple transports we don't need). iroh narrower and simpler.
- **WebRTC DataChannels** — requires a JS bridge and has worse NAT-traversal tooling than iroh's battle-tested implementation.
- **Raw TCP/WebSockets via our own relay** — zero NAT traversal, we'd be building what iroh already solved.

**Concrete iroh mechanics:**

- **Version:** iroh 0.97.x (pre-1.0 but production-quality; used in Pixelfed, Sanity, Dropbox's internal tools).
- **Node identity:** Ed25519 keypair → `NodeId` (public key) = the address. Permanent per device. Generated once, persisted in Keychain.
- **Tickets:** `{NodeId, relay URL, direct addrs}` bundle. Shareable as short base32 string or QR code. This is the "invite link" format.
- **Hole punching:** iroh auto-discovers routes. ~90% of non-CGNAT pairs get direct UDP. Rest fall back to encrypted relay. No configuration.
- **LAN-only mode:** `discovery-local-network` feature (iroh's built-in mDNS) + `RelayMode::Disabled`. Peers on same subnet auto-discover without our own mDNS code. Means we don't need `mdns-sd` separately — iroh handles it.
- **Cross-LAN with relay fallback:** `RelayMode::Default` uses iroh's four public relays (free, rate-limited but enough for casual use). For Pro collab at scale, we run our own relay (iroh relay binary, stateless, ~50MB RAM, one DO or Cloudflare VM — tiny cost).

**Auth integration with Phase D.5 JWT:**
- iroh's `ProtocolHandler::accept` hook lets us validate on the first bidirectional stream.
- Client sends `{jwt}` as the opening message on a reserved stream.
- Server verifies JWT signature + expiry against Supabase public key (baked in).
- If valid, stream is upgraded to the protocol; if not, closed.
- Peer's iroh identity (`NodeId`) is *already* Ed25519-authenticated at the QUIC layer — JWT just proves subscription status.

#### D.2 — CRDT: Automerge via `samod`

Automerge core is Rust-native. For the repo layer (sync protocol, storage, network adapter plugging), choose wisely:

- **`automerge-repo` (JS)** — the reference implementation, well-documented, but JS-only. Using it means running CRDT logic in the WebView.
- **`automerge-repo-rs`** — Rust port, but **not JS-wire-compatible**. Dead-end if we ever want web peers.
- **`samod` 0.6.x** — JS-wire-compatible Rust `automerge-repo`, **sans-IO** (plugs into any transport), actively maintained. This is the right pick. It lets Rust own the CRDT state and speak the same protocol as JS peers if we ever add a web client.

**Supporting crate:** `autosurgeon` for `#[derive(Reconcile, Hydrate)]` — turns Rust structs into Automerge docs without manual JSON bashing.

**Document shape:**

- **Code buffers** — `Automerge.Text` field (already Phase A).
- **Canvas state** — `Automerge.List<Node>` for the scene tree; `Automerge.Map<string, Style>` for component styles. One Automerge doc per project.
- **Design tokens** — `Automerge.Map<string, Token>` in the project doc. Sync-friendly, conflict-free for independent key edits.
- **Selection, cursor, hover** — **NOT** in the Automerge doc. These are ephemeral presence (see D.3).

**Sync adapter: iroh as custom Automerge network adapter.**

`automerge-repo`'s network adapter interface is just "here's a byte stream; send sync messages over it." iroh gives us byte streams. The adapter:

```rust
impl NetworkAdapter for IrohAdapter {
    async fn send(&self, peer: PeerId, msg: SyncMessage) -> Result<()> {
        let conn = self.iroh_endpoint.connect(peer.0, AUTOMERGE_ALPN).await?;
        let (mut send, _) = conn.open_bi().await?;
        send.write_all(&msg.encode()).await?;
        Ok(())
    }
    // recv() pushes into the repo via channel
}
```

`iroh` has an official `protocols/automerge` example in their repo that does exactly this — we can copy the shape. ALPN string claims a protocol lane over the QUIC connection.

#### D.3 — Awareness (presence, cursors, selections)

Automerge doesn't persist awareness — that's correct, because cursors and voice indicators shouldn't conflict-merge. `automerge-repo` ships **ephemeral messages** as a first-class feature: `handle.broadcast(cbor_payload)` fires a fire-and-forget CBOR message to all peers on a doc; receivers get an `"ephemeral-message"` event. No persistence, no CRDT merge.

We use this for:
- Cursor position (every file per peer).
- Selection range.
- Active buffer / active canvas frame.
- "Talking" indicator (if user holds push-to-talk — Phase D+1, not v1).
- Typing indicator.

Broadcast rate cap: 10 Hz per peer. Jitter-throttled to avoid flooding the sync channel.

**Floating text cursors** — Automerge natively supports cursor positions that survive concurrent edits (unlike raw offsets which drift when concurrent inserts happen). Use the built-in `Automerge.Cursor` API for collaborator cursor rendering in CM6.

#### D.4 — Follow mode

Zed-style: click a collaborator avatar → your viewport tracks theirs.

- When following, subscribe to a peer's ephemeral "active view" stream.
- On every "active buffer changed", open that buffer locally.
- On every scroll/selection broadcast, match it.
- One-key disengage.

Implementation: one ephemeral message type + a frontend `useFollowMode()` hook. Nothing protocol-heavy.

#### D.5 — Shared agent sessions

ACP sessions run locally per user. "Shared" means:
- One peer is the driver (their machine runs the agent subprocess).
- Other peers subscribe as viewers via ephemeral messages.
- Every ACP message the driver sees is rebroadcast as an ephemeral message.
- Viewers see the transcript live; they can chat alongside but not inject commands (v1).
- In v2: viewers can propose commands that the driver approves with one click.

No cloud component for this. Rides on the already-established iroh doc connection.

#### D.6 — Signaling server (minimal, JWT-gated)

Covered in Phase D.6 below. The signaling server exists only to:
- Authenticate Pro users (JWT gate) so non-Pro peers can't free-ride cross-LAN.
- Keep a tiny ephemeral "room registry" keyed by room-id → list of Pro NodeIds, for "join my session" UX without copying tickets manually.

If we skip the signaling server entirely in v1, users paste iroh tickets to each other. That's fine — just means cross-LAN collab is friction-heavy until D.6 lands.

#### Offline-first and reconnect semantics

- Automerge is commutative — offline edits merge cleanly on reconnect. No last-writer-wins anywhere.
- On connection loss, local edits continue. `samod` queues outbound sync messages. Reconnect → catchup is automatic.
- If a peer disconnects permanently mid-session, their last-known state stays in everyone's local doc. No data loss.

#### Canvas state migration (big job — do in Phase D, not earlier)

Today `src/zeros/engine/` holds canvas state in plain React state / Zustand. Migrating to Automerge docs is non-trivial:
- Every mutation becomes an Automerge change.
- Undo/redo becomes Automerge-transaction-based instead of state snapshots.
- Selection stays local (not in the doc).

This is the single largest engineering task in Phase D. Budget accordingly.

#### Critical files — Phase D

- New: `src-tauri/src/collab.rs` — iroh endpoint, `samod` repo, doc registry.
- New: `src-tauri/src/collab_protocol.rs` — ALPN negotiation, Automerge sync adapter.
- New: `src-tauri/src/presence.rs` — ephemeral message send/recv, rate limiting.
- `src-tauri/src/auth.rs` (from D.5) — JWT verification used in iroh protocol handler.
- New: `src/engine/collab/presence.tsx` — React hook for remote cursors/selections.
- New: `src/engine/collab/follow-mode.tsx` — follow-mode state machine.
- `src/zeros/engine/` — canvas state migrated to Automerge via `autosurgeon`.
- `src/editor/codemirror-host.tsx` — extend with remote-cursor rendering via `Automerge.Cursor`.

#### Verification — Phase D

- Two laptops on same Wi-Fi. Open Zeros on both (both signed in Pro). One creates a project, the other shows it in a "nearby" list within 2s. Join without entering a ticket.
- Edit a canvas frame on laptop A → change appears on laptop B within 200ms (LAN).
- Type in a code buffer on both simultaneously → Automerge merges, no lost characters.
- Disconnect laptop A's Wi-Fi → both keep editing locally. Reconnect → diffs merge cleanly; no conflict UI needed.
- Click laptop B's avatar on laptop A → laptop A's viewport snaps to laptop B's active canvas frame; scroll on B syncs to A.
- Share agent session: B runs an agent turn, A sees the transcript stream in real time. A is viewer-only (cannot inject).
- Cross-LAN: second laptop on cellular tether. Paste iroh ticket. Direct connection established via hole punching (verify in logs). Same editing + presence behavior.

### Phase D.5 — Auth, paid tier, and the cloud surface (small on purpose)

**Goal:** ship a $59/year Pro plan with proper JWT-based auth and subscription verification. Design data stays local. The cloud surface is small — users and subscriptions only — so it scales with paying customers, not with design activity.

**What lives in cloud, what doesn't:**

| Cloud (scales with users) | Local (scales with design work) |
|---|---|
| `users` table (email, auth id) | All canvas state, components, tokens |
| `subscriptions` table (plan, status, expiry) | All code buffers, Automerge docs |
| Magic-link / session issuance | Local LSP, tree-sitter, diagnostics |
| Stripe webhook handler | Agent sessions, transcripts, checkpoints |
| Collab signaling (Phase D.6, room registry only) | Git state, env files, todos |
| | **Never in cloud:** file content, designs, buffers, agent chats |

This is the whole point: user counts are bounded by paying customers (thousands, maybe tens of thousands over years). Design data is unbounded (MBs per project, dozens of projects per user). Keeping design data local means infra cost grows linearly with revenue, not with usage.

**Stack (solo-dev friendly):**

- **Supabase** — Postgres + Auth + RLS. Free tier holds through early growth (500MB DB, 50k MAU, well beyond what a $59/year niche product needs for years). Two tables total: `profiles`, `subscriptions`.
- **Supabase Auth** — passwordless magic-link (primary) + "Sign in with Google" / GitHub (optional). Issues JWTs. No custom password store.
- **Stripe** — checkout + subscriptions. Webhook → Supabase Edge Function → update `subscriptions` row.
- **Resend** — transactional email. (Supabase Auth can also send, but Resend gives better deliverability and templates.)
- **Sentry** / **PostHog Cloud** — crashes + product analytics. Opt-in.

**Auth flow:**

1. User clicks "Sign in" in app → app opens browser to `auth.zeros.app/login?callback=Zeros://auth`.
2. Magic-link email → user clicks → Supabase issues JWT → redirected back to `Zeros://auth?token=...`.
3. App stores the refresh token in macOS Keychain (via existing `src-tauri/src/secrets.rs`).
4. On launch, app does `GET /api/me` → returns `{plan, expires_at, features}` → cached locally for 24h.
5. Pro-gated features check the cached claim. Offline grace: 14 days. After that, Pro features lock until next successful check.

**What Pro unlocks (per your call — design features are the moat):**

- Full design feature set: advanced token systems, framework adapters (Tailwind/Chakra/shadcn/Radix), theme presets, motion/animation editors, premium component library, multi-framework export.
- **Collab** (Phase D) — requires signaling infra, so it sits behind Pro naturally.
- More slots for parallel agent sessions (free = 1 at a time, Pro = unlimited).
- Priority support.

**What stays free forever:**

- Canvas basics, single-frame design editing.
- ACP agents with BYO API key (users pay Anthropic/OpenAI/Google directly).
- Git / env / todo / terminal panels.
- Editor + LSP + tree-sitter (Phases A + B).
- Checkpoints + plan-build mode (Phase C, single-session).

This is the standard "try agents free, pay for the design power" pitch. It's also the strongest viral loop — users share Zeros because the AI workflow is free; they convert because the design power is locked.

**Critical files:**
- New external repo: `Zeros-cloud/` — Supabase migrations (`profiles`, `subscriptions` tables), Edge Functions (Stripe webhook, signaling room registry), RLS policies.
- New: `src-tauri/src/auth.rs` — Supabase JWT verification, refresh-token handling, claim cache.
- New: `src/shell/auth-panel.tsx` — magic-link sign-in UI. Surfaces when a Pro feature is attempted while signed out.
- `src-tauri/src/secrets.rs` — extend to store Supabase refresh token.

**Operational cost at low scale:** Supabase free → $25/mo Pro when >50k MAU. Stripe (2.9% + $0.30). Resend free up to 3k emails/month. Cloudflare Workers (if used for signaling) free tier. **Monthly infra floor: $0–25.**

**Security posture:**

- JWT verified on every cloud call (Supabase does this server-side via RLS).
- App-side: Ed25519 public key of Supabase project baked in; JWTs validated offline for the 24h grace.
- Refresh tokens in Keychain, not plain disk.
- RLS policies mean a compromised client can only read/write its own row; no lateral leakage.
- Design data never leaves the device, so a full cloud breach leaks emails + subscription status only — recoverable damage.

### Phase D.6 — Collab with secure signaling (Pro tier)

**Goal:** enable cross-LAN collab for Pro users without storing design data server-side. The server *pairs* peers and authenticates them; all document sync stays P2P over iroh (Phase D).

**What the signaling layer does:**

- Holds a small ephemeral "room registry" keyed by JWT: `{room_id, host_jwt, peer_list, iroh_node_id, expires_at}`. Rows are ephemeral — gone within minutes of disconnect.
- Authenticates: only signed-in Pro users can create or join a room. JWT verified on every connection.
- Exchanges iroh tickets (NAT traversal hints, node IDs). Never sees document content.
- Optionally falls back to iroh's public relays for media (if direct P2P fails).

**What the signaling layer does NOT do:**

- Does not see or store document content.
- Does not persist rooms. Disconnect = gone.
- Does not hold presence, cursors, voice — those are P2P-only.
- Does not mediate CRDT sync. That's iroh + Automerge peer-to-peer.

**Implementation:**

- Cloudflare Durable Objects per room (stateful WebSocket, cheap, geographically close). Or a small Hono server on Cloudflare Workers if Durable Objects feel overkill.
- JWT auth middleware — Supabase public key baked in, verified per-connection.
- Room lifetime: first peer in → room created, last peer out → room destroyed + evicted from DO storage.
- Total server-side state per room: ~200 bytes. Total across all rooms: bounded by concurrent Pro users.

**Critical files:**
- `Zeros-cloud/signaling/` — Durable Object or Worker, JWT middleware, iroh ticket exchange.
- `src-tauri/src/collab.rs` (from Phase D) — extend with signaling-server client for off-LAN pairing; LAN mDNS path untouched.

**Fallback behavior:** if signaling is unreachable, app drops to LAN-only mDNS. Collab degrades gracefully, never fails catastrophically.

### Phase E — Design features (parallel track, not gated by A–D)

Keeps shipping regardless of dev buildout:
- Design token JSON system (framework-agnostic, feeds Tailwind/Chakra/shadcn adapters).
- More native style editors (spacing, typography, motion presets).
- Agent-driven component refactors (extract variant, rename prop across usages — LSP from Phase B powers this).

---

## What we are explicitly NOT building

- **No extension marketplace or plugin API.** Extensibility = MCP + native panels. (See prior extension-posture doc.)
- **No code-editor as front-and-center tab.** Editor is a reveal-surface, not a workspace mode.
- **No "Problems" / "Output" / "Debug Console" panels.** Diagnostics live inline or in agent context.
- **No design data in cloud.** Buffers, canvas state, agent transcripts, checkpoints — all local. The cloud DB holds only auth + subscription state.
- **No hosted collab document storage.** Signaling server pairs peers; docs sync P2P via iroh.
- **No AI inference proxy or metering.** BYO API key — users pay providers directly.
- **No debugger (DAP) in v1.** Zed has one; we don't need it for the designer/PM/design-engineer target. Revisit if users ask.
- **No remote dev / SSH-to-another-machine.** Tauri-local is the thesis. Revisit never unless real demand appears.

---

## Sequencing and dependencies

```
A (editor + Automerge buffers)  ──┐
                                  ├─→ C (agent UX — needs buffers + checkpoints)
B (tree-sitter + LSP)  ───────────┘
                                  
A (Automerge base)  ──────────────→ D (collab — extends Automerge to canvas + transport)
                                          │
                                          ├─→ D.5 (auth + Supabase + Pro gating)
                                          │
                                          └─→ D.6 (collab signaling, Pro-gated — depends on D.5 auth)

E (design features) — parallel throughout, not gated.
```

**Why A first:** unblocks C (checkpoints need CRDT buffers) and D (collab needs CRDT storage). Trying to retrofit CRDT later is expensive.

**Why B alongside A:** LSP + tree-sitter have no dependency on collab, but the editor surface from A is where their output lands. Ship them together so the first "agent opens a file" moment feels complete.

**Why D last:** collab is the biggest surface-area change (transport, discovery, presence, awareness). Doing it after A/B/C means we're adding collab to a tool that already works single-player, rather than debugging everything at once.

---

## Self-dogfooding: building Zeros in Zeros

The stated goal: build the next Zeros features *using Zeros itself*. This is both a product thesis and the strictest possible validation — if the tool can't build itself, it can't build anything serious.

### What "self-dogfooding" actually means

Not: writing a tiny demo component in Zeros. That proves nothing.

Actually: the next real feature you ship is developed *from inside Zeros*. Agent opens the relevant files, LSP tells the agent where things are typed wrong, you scrub through checkpoints when the agent wanders, you commit via the git panel, you run `pnpm dev` in the terminal panel, you design the new UI on the canvas, you export it to code — all inside Zeros.

### Minimum viable dogfooding stack (phase dependencies)

To write actual Zeros features in Zeros, you need, at minimum:

| Need | Provided by |
|---|---|
| Open and edit TS/TSX files with highlighting | Phase A |
| Type errors visible while editing | Phase B (LSP) |
| Agent can open + edit files + see diagnostics | Phases A + B + existing ACP |
| Revert a bad agent turn | Phase C (checkpoints) |
| Run two agent attempts in parallel | Phase C (parallel sessions) |
| Run `pnpm dev`, see hot reload | Existing terminal panel — already works |
| Stage, commit, push | Existing git panel — already works |
| Design the UI visually | Existing canvas + Phase E |
| Collab with teammates while doing this | Phase D (optional — solo dev first) |

**Critical path for solo dogfooding:** Phase A + Phase B + Phase C. That's it. Phase D/D.5/D.6/E are not blockers for the "I can build Zeros inside Zeros" milestone.

### Sharp edges specific to the self-hosting loop

1. **Editing the running app's source.** When Zeros is running and you edit `src/shell/column3.tsx` *inside Zeros*, Vite HMR fires and the app hot-reloads — editor included. This can wipe the editor state mid-edit. Two defenses:
   - Automerge doc persists to disk on every change; HMR reloads with state intact.
   - For Tauri-backend changes (`src-tauri/**`), the app needs a full restart. Mitigation: run a separate Zeros install (release build) as the dogfooding host; edit the dev repo inside it. Two binaries, same project.

2. **Recursion risk — editing ACP while an ACP session is running.** If the agent you're using edits `src/engine/acp/`, the next agent turn may hit a broken build. Mitigation: each agent session runs in its own worktree (Phase C.3). If the agent's edits break the engine in worktree A, main is untouched; you revert via checkpoint.

3. **Rust changes break the host.** Editing `src-tauri/src/*.rs` requires `cargo build`; the running app doesn't pick up Rust changes without a restart. Pattern: Rust changes happen in a dedicated "backend" worktree; the release-build dogfooding host is restarted when merging those. Frontend-only changes HMR in place.

4. **LSP restart on TS config changes.** `tsconfig.json` edits should restart the TS language server in-process — implement as a `lsp:restart` command exposed via the palette.

5. **Canvas → code export regressions.** If a design-feature-driven code export changes what's written to disk, self-dogfooding will hit those regressions immediately. This is a feature, not a bug — fastest feedback loop possible.

### Dogfooding milestone sequence (ordered, each a shippable signal)

1. **M1 — "Agent edits Zeros code."** After Phase A + B land, an agent opens `src/shell/column3.tsx` inside Zeros, edits it, checkpoint fires. Restart the app, change persists. First proof.

2. **M2 — "Build a feature end-to-end inside Zeros."** Pick one small real feature (e.g., "add a button to the git panel that copies the current branch name"). Do it entirely in-app: agent edits, LSP validates, terminal runs lint, git panel commits. Record the session. If anything forces you to open Cursor/VS Code, that's a Phase A/B bug list.

3. **M3 — "Build a design-involving feature inside Zeros."** Pick a feature that exercises canvas + code: e.g., a new style editor module. Design on canvas, export to code, agent wires it up, LSP validates, commit. This is the full loop.

4. **M4 — "Parallel agent variants."** Phase C.3. Two agents attempt the same feature differently; compare diffs; merge the better one. Demonstrates that Conductor-style parallelism works for design work, not just code.

5. **M5 — "Collab pair-build."** Phase D + D.6. Someone else joins your session (LAN or ticket). You both co-design + co-edit while an agent runs. Proves the full vision.

Each milestone is a concrete demo video you can put on the landing page. Each represents a week-to-two-weeks of real work post-phase-completion, not a year.

### What self-dogfooding reveals that beta testers won't

- Agent turn latency and jitter in real workflows.
- How often LSP misses context the agent would've found via tree-sitter.
- Where the canvas ↔ code boundary feels wrong.
- Which checkpoints users never use vs. revert constantly.
- Whether the multibuffer review UX scales past 3 files or becomes a mess at 10.
- How often users want a "Problems" panel and if the agent-fed pattern actually holds up.

You cannot learn these from outside the tool. That's why self-hosting is the thesis.

---

## Critical files summary (where work lands)

### New Rust modules in `src-tauri/src/`

- `buffers.rs`, `buffer_store.rs` — Automerge doc storage, content-addressed blobs. **(Phase A)**
- `tree_sitter.rs` — parser pool, query cache, grammar registry. **(Phase B.1)**
- `lsp.rs`, `lsp_install.rs` — language server process manager, stdio framing, binary detection/install. **(Phase B.2)**
- `checkpoints.rs` — per-turn snapshots, restore, dedupe. **(Phase C.2)**
- `worktrees.rs` — git worktree orchestration; reuses `git.rs`. **(Phase C.3)**
- `session_store.rs` — durable agent session state. **(Phase C.5)**
- `auth.rs` — Supabase JWT verify, refresh token handling, claim cache. **(Phase D.5)**
- `collab.rs`, `collab_protocol.rs`, `presence.rs` — iroh endpoint, samod repo, ALPN negotiation, Automerge sync adapter, ephemeral messages. **(Phase D)**

### New frontend modules in `src/`

- `editor/codemirror-host.tsx` — CM6 React host, compartments, Automerge binding. **(Phase A)**
- `editor/multibuffer.tsx` — excerpt-based multi-file review. **(Phase A)**
- `editor/extensions/` — per-language bundles. **(Phase A)**
- `engine/lsp/client.ts` — Tauri-event-based transport for `codemirror-languageserver`. **(Phase B)**
- `engine/collab/presence.tsx`, `engine/collab/follow-mode.tsx` — presence UI + follow-mode hook. **(Phase D)**
- `shell/session-rail.tsx` — left-column session switcher. **(Phase C.3)**
- `shell/auth-panel.tsx` — magic-link sign-in (surfaces on Pro gate). **(Phase D.5)**

### External repos

- `Zeros-cloud/` — Supabase project (migrations, RLS, Edge Functions) + Cloudflare Worker/Durable Object signaling. **(Phase D.5 + D.6)**

### Extended / modified

- `src/zeros/acp/acp-mode.tsx`, `use-acp-session.tsx` — Plan/Build mode, permission map. **(C.1)**
- `src/zeros/acp/sessions-provider.tsx` (in-progress in current git status) — parallel sessions list. **(C.3)**
- `src/zeros/acp/acp-chat.tsx` — checkpoint revert affordance. **(C.2)**
- `src/engine/acp/session-manager.ts` — pipe diagnostics as agent context; session durability. **(B.4, C.5)**
- `src-tauri/src/git.rs` — worktree helpers. **(C.3)**
- `src-tauri/src/secrets.rs` — extend to hold Supabase refresh token + iroh node keypair. **(D.5, D)**
- `src/shell/column3.tsx` — editor/multibuffer mount point. **(A)**
- `src/zeros/engine/*` — canvas state migrates to Automerge via `autosurgeon`. **(D)**

### New conventions

- `.zeros/buffers/` — per-project Automerge doc store.
- `.zeros/checkpoints/<sessionId>/` — snapshot timeline + blobs.
- `.zeros/worktrees/<sessionId>/` — per-session git worktrees.
- `.zeros/sessions/<sessionId>/` — durable session state.
- `.zeros/agents/<name>.md` — user-defined subagent definitions.
- `.zeros/bin/` — app-local language server binaries.

### Existing assets untouched (keep as-is)

- `src-tauri/src/env_files.rs`, `src-tauri/src/todo.rs`, `src-tauri/src/git.rs` core, `src-tauri/src/ai_cli.rs`.
- `src/shell/git-panel.tsx`, `env-panel.tsx`, `todo-panel.tsx`, `terminal-panel.tsx` — already production-ready.
- ACP base engine: `src/engine/acp/registry.ts`, `src/engine/acp/client.ts`.

---

## Verification plan

**Phase A:** agent says "open `src/app-shell.tsx`" → editor opens with syntax highlight. Agent edits it → Automerge change logged, multibuffer shows diff, user can accept/revert. Close app, reopen — buffer state restored from `.zeros/buffers/`.

**Phase B:** open a TS file → red underline appears on a deliberate type error within 2s (tree-sitter) and within 5s of LSP spawn. Agent asked to "fix this error" receives the diagnostic as tool-result context.

**Phase C:** start two agent sessions in parallel — each edits different files in its own worktree, no conflicts. Revert a turn → buffer + worktree state snap back. Define a custom "design-critic" subagent in `.zeros/agents/` → primary agent delegates to it successfully.

**Phase D:** two laptops on the same LAN, same Wi-Fi. Open Zeros on both, one creates a session, the other sees the mDNS advert and joins without entering anything. Edit a file on laptop A → character appears on laptop B within 200ms. Kill laptop A's Wi-Fi → laptop B keeps editing locally; reconnect → merges cleanly.

**Phase D.5 (auth):** Stripe test-mode checkout → Supabase `subscriptions` row updates via webhook within 5s. Sign in via magic link → app stores refresh token in Keychain → Pro-gated features unlock. Sign out → features re-lock. Run app offline for 14 days with a valid cached claim → Pro stays unlocked. After day 14, Pro locks until next successful `/api/me` check.

**Phase D.6 (signaling):** two Pro users, different LANs. One creates a room, other joins via signaling server. JWT verified on both sides. Durable Object registry holds ≤200 bytes per room. Kill signaling server mid-session — existing iroh connection continues, only new joiners blocked.

**Phase E:** ongoing — no dev-specific acceptance criteria.

**Self-dogfooding milestone:** after Phases A + B land, the user builds the next Zeros feature using Zeros itself. If that loop works end-to-end (agent opens relevant files, edits them, runs tests via terminal panel, commits via git panel, dev loop closes), the core thesis is validated.
