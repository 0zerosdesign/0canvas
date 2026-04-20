# Tauri Setup (Phase 1A-2 prerequisites)

Phase 1A-1 shipped the three-column React shell and prepared the
`src-tauri/` scaffold. Before running `pnpm tauri:dev`, install the
three toolchains below.

## 1. Rust + Cargo (required)

The Tauri core and every Rust command you'll add in later phases need
the standard Rust toolchain.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# When it finishes, reload your shell or run:
source "$HOME/.cargo/env"

# Verify:
rustc --version   # rustc 1.7x.x or newer
cargo --version
```

## 2. Xcode Command Line Tools (required on macOS)

Tauri's macOS bundler needs the Apple developer tools for linking.

```bash
xcode-select --install
```

If already installed, `xcode-select -p` prints a path.

## 3. Bun (required for Phase 1A-3 sidecar compile)

Phase 1A-3 compiles the Node engine into a single-file executable via
`bun build --compile`. This is the reliable path for bundling
`@parcel/watcher`'s native `.node` binary into a Tauri sidecar.

```bash
curl -fsSL https://bun.sh/install | bash
bun --version     # 1.1.x or newer
```

## 4. Install project JS dependencies

```bash
pnpm install
```

This pulls in `@tauri-apps/cli` (already added to `devDependencies`).

## 5. Verify

```bash
# Browser-only iteration (still works after Phase 1A-1):
pnpm dev

# Tauri window mode (after Rust + Xcode CLT are installed):
pnpm tauri:dev
```

`pnpm tauri:dev` will:

1. Run `pnpm dev` as a subprocess (Vite on http://localhost:5173)
2. Compile the Rust shell (`src-tauri/`)
3. Open a native macOS window pointing at the Vite dev server
4. Hot-reload React changes without restarting the window

## What happens in later sub-phases

- **1A-2:** `src-tauri/src/sidecar.rs` spawns the Node engine, reads
  `.0canvas/.port`, and injects `window.__0CANVAS_PORT__` into the
  webview so the WebSocket bridge connects without a hardcoded port.
- **1A-3:** Native **Open Folder** file dialog, app menu (File / Edit /
  View / Window / Help), project switching.
- **Phase 1C:** Embedded terminal via `tauri-plugin-pty` + `xterm.js`.
- **Phase 3:** Git operations via `git2-rs`.
- **Phase 4:** `shell::spawn` for `claude-code`, `codex`, `gh` CLIs.
