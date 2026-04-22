// ──────────────────────────────────────────────────────────
// Terminal — xterm.js + tauri-plugin-pty, multi-session
// ──────────────────────────────────────────────────────────
//
// Each TerminalSession spawns /bin/zsh -l in the current
// project root and wires it bidirectionally to an xterm.js
// instance. TerminalPanel manages any number of sessions
// side-by-side: a tab strip at the top, plus-button to add,
// close-button per tab. Inactive sessions stay mounted with
// `display: none` so their pty keeps receiving output and
// you don't lose state when switching away.
//
// Keyboard: ⌘T adds a new session, ⌘W closes the active one
// (only fires when the Terminal tab is visible — xterm's
// own shortcuts win otherwise).
//
// Deferred:
//   - Terminal persistence across Zeros restarts (v0.2)
//   - Per-session shell override (custom cwd / user-picked
//     command) — currently every session is zsh in the engine
//     root.
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X as XIcon } from "lucide-react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { spawn, type IPty } from "tauri-pty";
import "@xterm/xterm/css/xterm.css";
import { useWorkspace } from "../zeros/store/store";
import { isTauri, nativeInvoke } from "../native/runtime";

// NOTE: the current terminal uses `tauri-pty` directly, so it only
// works in the Tauri build. Phase 6 swaps this for node-pty over IPC
// so it also works under Electron. Until then, `isTauri()` is the
// right guard here (not `isNativeRuntime()`) — spinning up xterm with
// tauri-pty in an Electron window would explode on import.
async function resolveProjectRoot(): Promise<string | undefined> {
  if (!isTauri()) return undefined;
  try {
    const root = await nativeInvoke<string | null>("get_engine_root");
    return root ?? undefined;
  } catch {
    return undefined;
  }
}

/** Preferred cwd for a new pty: the active chat's folder if set, else
 *  the engine root. Lets `cd` land exactly where the user's agent is
 *  already reading files. */
async function resolveSessionCwd(
  chatFolder: string | null,
): Promise<string | undefined> {
  if (chatFolder) return chatFolder;
  return resolveProjectRoot();
}

// Desaturated palette — ANSI hues stay distinguishable (so `ls`, git
// log, grep output still parses visually) but everything's pulled
// back so the terminal chrome reads as quiet grey alongside the rest
// of the Mac shell instead of a neon-coloured island.
const TERMINAL_THEME = {
  background: "#0a0a0a",
  foreground: "#d4d4d4",
  cursor: "#a3a3a3",
  cursorAccent: "#0a0a0a",
  selectionBackground: "rgba(255, 255, 255, 0.12)",
  black: "#0a0a0a",
  red: "#c4807d",
  green: "#a3c094",
  yellow: "#c9b173",
  blue: "#8aa8c8",
  magenta: "#b298c0",
  cyan: "#8fb8b8",
  white: "#d4d4d4",
  brightBlack: "#737373",
  brightRed: "#d89995",
  brightGreen: "#b8d2a8",
  brightYellow: "#d9c485",
  brightBlue: "#a0bcd8",
  brightMagenta: "#c4acd0",
  brightCyan: "#a0c8c8",
  brightWhite: "#fafafa",
};

// ── Single session (xterm + pty) ──────────────────────────

function TerminalSession({
  active,
  cwdOverride,
}: {
  active: boolean;
  cwdOverride?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<IPty | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    if (!isTauri()) {
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
      convertEol: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    termRef.current = term;
    fitRef.current = fit;

    requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {
        /* fit before layout settles is fine */
      }
      if (active) term.focus();
    });

    let cancelled = false;
    let disposeOnData: (() => void) | undefined;
    let disposeOnExit: (() => void) | undefined;
    let disposeOnInput: (() => void) | undefined;

    (async () => {
      try {
        const cwd = await resolveSessionCwd(cwdOverride ?? null);
        if (cancelled) return;

        term.writeln(
          `\x1b[90m[Zeros] starting /bin/zsh${cwd ? ` in ${cwd}` : ""}\x1b[0m`,
        );

        const pty = spawn("/bin/zsh", ["-l"], {
          name: "xterm-256color",
          cols: term.cols,
          rows: term.rows,
          cwd,
        });
        ptyRef.current = pty;

        const dec = new TextDecoder();
        const toText = (data: unknown): string => {
          if (typeof data === "string") return data;
          if (data instanceof Uint8Array) return dec.decode(data);
          if (data instanceof ArrayBuffer) return dec.decode(new Uint8Array(data));
          if (Array.isArray(data)) return dec.decode(new Uint8Array(data));
          return "";
        };

        const dataSub = pty.onData((data) => term.write(toText(data)));
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
        console.error("[Zeros terminal] spawn failed:", err);
        term.writeln(
          `\r\n\x1b[31m[Zeros] terminal spawn failed: ${msg}\x1b[0m`,
        );
        setError(msg);
      }
    })();

    const hostEl = hostRef.current;
    const onClick = () => term.focus();
    hostEl.addEventListener("mousedown", onClick);

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        ptyRef.current?.resize(term.cols, term.rows);
      } catch {
        /* transient layout jitter */
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
      fitRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refit + focus when this session becomes active (it was display:none).
  useEffect(() => {
    if (!active) return;
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
        if (ptyRef.current && termRef.current) {
          ptyRef.current.resize(termRef.current.cols, termRef.current.rows);
        }
      } catch {
        /* ignore */
      }
      termRef.current?.focus();
    });
  }, [active]);

  return (
    <div className="oc-terminal">
      {error && <div className="oc-terminal__error">{error}</div>}
      <div ref={hostRef} className="oc-terminal__host" />
    </div>
  );
}

// ── Multi-session container ───────────────────────────────

type SessionMeta = { id: string };

function newSessionId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function TerminalPanel() {
  const { state } = useWorkspace();
  // Resolve the cwd we'll hand to freshly-spawned pties. When a chat is
  // active we land in its folder; otherwise fall back to the engine
  // root (handled inside the session). Existing sessions keep their
  // original cwd — switching chats doesn't teleport an open zsh.
  const activeCwd = useMemo<string | undefined>(() => {
    const chat = state.chats.find((c) => c.id === state.activeChatId);
    return chat?.folder || undefined;
  }, [state.chats, state.activeChatId]);

  const [sessions, setSessions] = useState<SessionMeta[]>(() => [
    { id: newSessionId() },
  ]);
  const [activeId, setActiveId] = useState<string>(() => sessions[0].id);

  const addSession = useCallback(() => {
    const id = newSessionId();
    setSessions((prev) => [...prev, { id }]);
    setActiveId(id);
  }, []);

  const closeSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length === 0) {
          const fresh: SessionMeta = { id: newSessionId() };
          setActiveId(fresh.id);
          return [fresh];
        }
        if (id === activeId) {
          setActiveId(next[next.length - 1].id);
        }
        return next;
      });
    },
    [activeId],
  );

  // ⌘T adds a session, ⌘W closes the active one — only while Terminal
  // tab is visible so we don't interfere with Cmd+W elsewhere.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        addSession();
      } else if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        closeSession(activeId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, addSession, closeSession]);

  return (
    <div className="oc-terminal-panel">
      <nav className="oc-terminal-panel__tabs" role="tablist">
        {sessions.map((s, i) => {
          const isActive = s.id === activeId;
          return (
            <div
              key={s.id}
              className={`oc-terminal-panel__tab ${isActive ? "is-active" : ""}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(s.id)}
            >
              <span>Terminal {i + 1}</span>
              <button
                className="oc-terminal-panel__close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(s.id);
                }}
                title="Close terminal"
                aria-label="Close terminal"
              >
                <XIcon size={10} />
              </button>
            </div>
          );
        })}
        <button
          className="oc-terminal-panel__add"
          onClick={addSession}
          title="New terminal (⌘T)"
          aria-label="New terminal"
        >
          <Plus size={12} />
        </button>
      </nav>
      <div className="oc-terminal-panel__sessions">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="oc-terminal-panel__session"
            style={{ display: s.id === activeId ? "flex" : "none" }}
          >
            <TerminalSession active={s.id === activeId} cwdOverride={activeCwd} />
          </div>
        ))}
      </div>
    </div>
  );
}
