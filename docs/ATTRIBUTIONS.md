# Attributions

Zeros builds on the following open-source projects and assets.
All are used under their respective licenses; see individual project
repositories for full license text.

## UI components & design

- **[shadcn/ui](https://ui.shadcn.com/)** — used under [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).
- **[lucide-react](https://lucide.dev)** — icon set, ISC license.
- **[Unsplash](https://unsplash.com)** — sample imagery in
  marketing-surface mocks, [Unsplash license](https://unsplash.com/license).

## Core native-app stack

- **[Tauri](https://tauri.app)** (MIT / Apache-2.0) — native app shell.
- **[@tauri-apps/plugin-deep-link](https://github.com/tauri-apps/plugins-workspace)**
  (MIT / Apache-2.0) — `zeros://` URL scheme.
- **[@tauri-apps/plugin-notification](https://github.com/tauri-apps/plugins-workspace)**
  (MIT / Apache-2.0) — native notifications.
- **[@tauri-apps/plugin-pty](https://github.com/rajivshah3/tauri-plugin-pty)**
  — embedded terminal PTY (Phase 1C).

## Rust crates

- **[git2-rs](https://github.com/rust-lang/git2-rs)** (MIT / Apache-2.0)
  — Git operations in `src-tauri/src/git.rs`.
- **[security-framework](https://github.com/kornelski/rust-security-framework)**
  (MIT / Apache-2.0) — macOS Keychain access for API keys.
- **[serde](https://serde.rs)** (MIT / Apache-2.0) — JSON
  serialization across the Tauri bridge.
- **[tokio](https://tokio.rs)** (MIT) — async runtime used by Tauri.

## JS engine stack

- **[PostCSS](https://postcss.org)** (MIT) — CSS parsing in
  `src/engine/css-resolver.ts`.
- **[@parcel/watcher](https://github.com/parcel-bundler/watcher)**
  (MIT) — native filesystem watcher.
- **[tinyglobby](https://github.com/SuperchupuDev/tinyglobby)** (MIT)
  — CSS file discovery.
- **[ws](https://github.com/websockets/ws)** (MIT) — engine ↔ webview
  WebSocket bridge.
- **[xterm.js](https://xtermjs.org)** (MIT) — terminal renderer in
  the Terminal panel.
- **[@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript)**
  (MIT) — direct Anthropic Messages API streaming.
- **[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)**
  (MIT) — MCP server implementation for external AI tools.

## Design references

- **Original UI design:** [Figma Design File](https://www.figma.com/design/pHn0A8C25STCmSniuSFuQp/Design-Collaboration-Tool)
- **Cursor** (cursor.com) — UI/UX inspiration for the 3-column shell.
- **Clonk / Komand** (clonk.ai) — inspiration for the skills system,
  pricing model, worktree parallel agents.

## TODO

- [ ] Audit `src-tauri/Cargo.toml` and list any crates not captured
      above.
- [ ] Add full LICENSE file references once distribution begins in
      Phase 5 (per App Store / notarization requirements if ever
      pursued).
- [ ] Generate a machine-readable `third-party-licenses.txt` on
      build for the About panel.
