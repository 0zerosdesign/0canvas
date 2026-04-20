// ──────────────────────────────────────────────────────────
// Terminal — xterm.js + tauri-plugin-pty
// ──────────────────────────────────────────────────────────
//
// Spawns the user's $SHELL in the current project root and
// pipes it to an xterm.js instance. Arrow keys, mouse,
// unicode, resize — all native because pty+xterm handle them.
//
// Phase 1C scope:
//   - Single session per mount (re-entering the tab reuses the
//     live pty if it's still running; remount creates a new one).
//   - Resize on container size change via the fit addon.
//   - Clean shutdown on unmount: kill() the pty and dispose
//     the xterm instance.
//   - Clear user-visible error if the pty refuses to spawn.
//
// Deferred:
//   - Multiple terminal sessions (tabs-within-a-tab).
//   - Terminal persistence across 0canvas restarts.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { spawn, type IPty } from "tauri-pty";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";

function isTauriWebview(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function resolveProjectRoot(): Promise<string | undefined> {
  if (!isTauriWebview()) return undefined;
  try {
    const root = await invoke<string | null>("get_engine_root");
    return root ?? undefined;
  } catch {
    return undefined;
  }
}

const TERMINAL_THEME = {
  background: "#131313",
  foreground: "#e6e6e6",
  cursor: "#3b82f6",
  cursorAccent: "#131313",
  selectionBackground: "rgba(59, 130, 246, 0.3)",
  black: "#1a1a1a",
  red: "#ff6b6b",
  green: "#50e3c2",
  yellow: "#f5a623",
  blue: "#3b82f6",
  magenta: "#8b5cf6",
  cyan: "#50e3c2",
  white: "#e6e6e6",
  brightBlack: "#666",
  brightRed: "#ff6b6b",
  brightGreen: "#50e3c2",
  brightYellow: "#f5a623",
  brightBlue: "#3b82f6",
  brightMagenta: "#8b5cf6",
  brightCyan: "#50e3c2",
  brightWhite: "#fff",
};

export function TerminalPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const ptyRef = useRef<IPty | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    if (!isTauriWebview()) {
      setError("Integrated terminal requires the Mac app (pnpm tauri:dev).");
      return;
    }

    const term = new XTerm({
      theme: TERMINAL_THEME,
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 10000,
      // Without this xterm won't react to keydown events that lack a
      // printable char (arrow keys, backspace) — not the user's issue
      // here, but makes arrow history + Ctrl+C work out of the box.
      convertEol: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    termRef.current = term;

    // Fit as soon as the container has real dimensions, then focus so
    // keystrokes land in xterm from the first paint.
    requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {
        /* fit before layout settles is fine; resize observer re-runs */
      }
      term.focus();
    });

    let cancelled = false;
    let disposeOnData: (() => void) | undefined;
    let disposeOnExit: (() => void) | undefined;
    let disposeOnInput: (() => void) | undefined;

    (async () => {
      try {
        const cwd = (await resolveProjectRoot()) ?? undefined;
        if (cancelled) return;

        term.writeln(
          `\x1b[90m[0canvas] starting /bin/zsh${cwd ? ` in ${cwd}` : ""}\x1b[0m`,
        );

        // Spawn the shell. We deliberately pass an empty env object so
        // tauri-plugin-pty inherits the Tauri parent's environment as-is
        // (which is the shell that launched the app — full $PATH, etc.).
        // Passing `undefined` vars from the webview's fake `process.env`
        // otherwise strips PATH and the shell can't resolve commands.
        const pty = spawn("/bin/zsh", ["-l"], {
          name: "xterm-256color",
          cols: term.cols,
          rows: term.rows,
          cwd,
        });
        ptyRef.current = pty;

        // tauri-plugin-pty's Rust side returns Vec<u8>, which Tauri
        // serializes to the JS invoke() boundary as a plain array of
        // numbers (NOT a Uint8Array), despite what the plugin's .d.ts
        // claims. Normalise every reasonable shape to a string before
        // handing to xterm; silently dropping bytes here was the cause
        // of the "terminal boots but no prompt ever appears" symptom.
        const dec = new TextDecoder();
        const toText = (data: unknown): string => {
          if (typeof data === "string") return data;
          if (data instanceof Uint8Array) return dec.decode(data);
          if (data instanceof ArrayBuffer) return dec.decode(new Uint8Array(data));
          if (Array.isArray(data)) return dec.decode(new Uint8Array(data));
          return "";
        };
        const dataSub = pty.onData((data) => {
          term.write(toText(data));
        });
        disposeOnData = dataSub.dispose.bind(dataSub);

        const exitSub = pty.onExit(({ exitCode, signal }) => {
          term.writeln(
            `\r\n\x1b[90m[process exited with code ${exitCode}${
              signal ? ` (signal ${signal})` : ""
            }]\x1b[0m`,
          );
        });
        disposeOnExit = exitSub.dispose.bind(exitSub);

        const inputSub = term.onData((input) => {
          ptyRef.current?.write(input);
        });
        disposeOnInput = inputSub.dispose.bind(inputSub);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err ?? "unknown");
        console.error("[0canvas terminal] spawn failed:", err);
        term.writeln(
          `\r\n\x1b[31m[0canvas] terminal spawn failed: ${msg}\x1b[0m`,
        );
        setError(msg);
      }
    })();

    // Click the host → give xterm focus (helps after tab-switching).
    const hostEl = hostRef.current;
    const onClick = () => term.focus();
    hostEl.addEventListener("mousedown", onClick);

    // Resize observer → keep cols/rows in sync with the container.
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        ptyRef.current?.resize(term.cols, term.rows);
      } catch {
        /* ignore transient layout errors */
      }
    });
    ro.observe(hostEl);

    return () => {
      cancelled = true;
      ro.disconnect();
      hostEl.removeEventListener("mousedown", onClick);
      disposeOnInput?.();
      disposeOnData?.();
      disposeOnExit?.();
      try {
        ptyRef.current?.kill();
      } catch {
        /* already dead */
      }
      ptyRef.current = null;
      term.dispose();
      termRef.current = null;
    };
  }, []);

  return (
    <div className="oc-terminal">
      {error && <div className="oc-terminal__error">{error}</div>}
      <div ref={hostRef} className="oc-terminal__host" />
    </div>
  );
}
