# Tauri Setup

Prerequisites for running `pnpm tauri:dev` and `pnpm tauri:build`.

> For the phase plan this feeds into, see
> [TAURI_MAC_APP_PLAN.md](TAURI_MAC_APP_PLAN.md). For the product
> vision, see [PRODUCT_VISION_V3.md](PRODUCT_VISION_V3.md).

## 1. Rust + Cargo

The Tauri core and every Rust module under `src-tauri/src/` need the
standard Rust toolchain.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version   # 1.7x.x or newer
cargo --version
```

## 2. Xcode Command Line Tools (macOS)

Tauri's macOS bundler needs Apple developer tools for linking.

```bash
xcode-select --install
# Verify:
xcode-select -p
```

## 3. Bun

The Node engine is compiled to a single-file sidecar executable via
`bun build --compile`. This is the reliable path for bundling
`@parcel/watcher`'s native `.node` binary.

```bash
curl -fsSL https://bun.sh/install | bash
bun --version     # 1.1.x or newer
```

## 4. Project JS dependencies

```bash
pnpm install
```

Pulls in `@tauri-apps/cli`, the engine dependencies, and the shell's
React/TypeScript stack.

## 5. Run the app

```bash
# Full Tauri dev (Rust shell + Vite + sidecar):
pnpm tauri:dev

# Vite-only (no Tauri window, engine features limited):
pnpm dev
```

`pnpm tauri:dev` will:

1. Build the Node engine sidecar via `pnpm build:sidecar`
2. Run Vite on `http://localhost:5173`
3. Compile the Rust shell (`src-tauri/`)
4. Open a native macOS window pointing at the Vite dev server
5. Spawn the sidecar engine alongside and wire the WebSocket bridge
6. Hot-reload React changes without restarting the window

## 6. Production build

```bash
pnpm tauri:build
```

Produces an ad-hoc-signed `.app` and `.dmg` in
`src-tauri/target/release/bundle/`. See
[TAURI_MAC_APP_PLAN.md §Phase 5](TAURI_MAC_APP_PLAN.md#phase-5--distribution-polish--not-started)
for the signed-distribution setup (Developer ID, notarization,
auto-updater) — not needed for local builds.

## What each Rust module does

See the file-by-file breakdown in
[PRODUCT_VISION_V3.md §7](PRODUCT_VISION_V3.md#7-rust-backend--what-lives-where).

## TODO

- [ ] Document the Windows / Linux toolchain once Phase 6 starts
      (MSVC Build Tools on Windows, `webkit2gtk-4.1-dev` on Linux).
- [ ] Add a Troubleshooting section for common first-run errors:
      missing `pnpm build:sidecar` cache, port 24193 already taken,
      Xcode license not accepted.
- [ ] Add a note about `security-framework` needing macOS-specific
      Cargo targets (affects cross-compile experiments).
- [ ] Decide whether the sidecar should compile in the Tauri build
      pipeline or continue to be a separate `pnpm build:sidecar` step.
