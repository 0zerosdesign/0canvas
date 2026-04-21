// ──────────────────────────────────────────────────────────
// 0canvas Mac App — Entry Point (Tauri webview + Vite browser dev)
// ──────────────────────────────────────────────────────────
//
// This is loaded by index.html, which Tauri's devUrl points to
// in `cargo tauri dev` and which Vite serves in `pnpm dev` for
// browser-based iteration. One entry, one layout.
// ──────────────────────────────────────────────────────────

import { createRoot } from "react-dom/client";
import "./styles/design-tokens.css";
import { AppShell } from "./app-shell";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element missing from index.html");
}

createRoot(rootEl).render(<AppShell />);
