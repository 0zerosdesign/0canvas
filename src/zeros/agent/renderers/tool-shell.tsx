// ──────────────────────────────────────────────────────────
// ShellCard — bash / shell tool calls
// ──────────────────────────────────────────────────────────
//
// Renders any tool with kind="execute". Today that's Claude
// Bash and (after Stage 7) Codex shell, Cursor shell, etc.
//
// Layout:
//   ┌────────────────────────────────────────────────────┐
//   │ [▶ icon]  $ npm run build              [✓] 12.3s   │  ← header
//   │ cwd: …apps/zeros                                   │  ← optional chip
//   ├────────────────────────────────────────────────────┤
//   │ output (xterm DOM render — ANSI parsed)            │  ← body
//   └────────────────────────────────────────────────────┘
//
// Collapse rules:
//   - in_progress / pending → expanded (user wants to see live output)
//   - completed / failed   → collapsed (default-collapsed for compactness;
//                                       click header to expand)
//   - failed expanded by default — failures need attention
//   - long output (> 5000 lines) → "Show all 5234 lines" button instead
//     of auto-mounting xterm; lazy mount on click
//
// xterm is created on-mount of the body; disposed on collapse so a
// long run with 50 shell cards doesn't hold 50 terminal grids in
// memory. Xterm.js v6 is DOM-renderer by default (no canvas/webgl).
// ──────────────────────────────────────────────────────────

import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Terminal as TerminalIcon, ChevronDown, ChevronRight } from "lucide-react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";
import { DurationChip } from "./live-duration";
import { resolveTokenValue } from "../../appearance/resolve-tokens";
import { useAppearance } from "../../appearance/provider";

const LARGE_OUTPUT_LINE_THRESHOLD = 5000;

export const ShellCard: Renderer<AgentToolMessage> = memo(function ShellCard({
  message,
}) {
  const tool = message;
  const command = readCommand(tool.rawInput);
  const cwd = readCwd(tool.rawInput);
  const output = readOutputText(tool);
  const lineCount = output ? output.split("\n").length : 0;
  const isLargeOutput = lineCount > LARGE_OUTPUT_LINE_THRESHOLD;
  const durationMs = tool.updatedAt - tool.createdAt;

  // Default-expanded while running OR on failure; default-collapsed on
  // successful completion (the highest-volume case).
  const [expanded, setExpanded] = useState(() => {
    if (tool.status === "in_progress" || tool.status === "pending") return true;
    if (tool.status === "failed") return true;
    return false;
  });
  // Whether the user has opted-in to mount xterm for a large output.
  const [forceMount, setForceMount] = useState(false);

  return (
    <div className="oc-agent-tool oc-agent-tool-shell">
      <button
        type="button"
        className="oc-agent-tool-head oc-agent-shell-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="oc-agent-tool-icon w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="oc-agent-tool-icon w-3.5 h-3.5" />
        )}
        <TerminalIcon className="oc-agent-tool-icon w-3.5 h-3.5" />
        <div className="oc-agent-tool-body">
          <div className="oc-agent-shell-cmd">
            <span className="oc-agent-shell-prompt">$</span>
            <span className="oc-agent-shell-cmd-text">
              {command || tool.title}
            </span>
          </div>
          {!expanded && output ? (
            <div className="oc-agent-shell-preview">
              {lastLine(output) || "(no output)"}
            </div>
          ) : null}
        </div>
        <div className="oc-agent-shell-meta">
          <DurationChip
            status={tool.status}
            startedAt={tool.createdAt}
            durationMs={durationMs}
            className="oc-agent-shell-duration"
          />
          <ShellStatusBadge status={tool.status} />
        </div>
      </button>
      {expanded && (
        <div className="oc-agent-shell-content">
          {cwd && (
            <div className="oc-agent-shell-cwd">
              <span className="oc-agent-shell-cwd-label">cwd</span>
              <span className="oc-agent-shell-cwd-path">{cwd}</span>
            </div>
          )}
          {!output ? (
            <div className="oc-agent-shell-empty">
              {tool.status === "in_progress"
                ? "Running…"
                : "(no output)"}
            </div>
          ) : isLargeOutput && !forceMount ? (
            <button
              type="button"
              className="oc-agent-shell-large"
              onClick={() => setForceMount(true)}
            >
              Show all {lineCount.toLocaleString()} lines
            </button>
          ) : (
            <ShellOutput text={output} />
          )}
        </div>
      )}
    </div>
  );
});

function ShellStatusBadge({ status }: { status: AgentToolMessage["status"] }) {
  const cls =
    status === "completed"
      ? "oc-agent-shell-status oc-agent-shell-status-ok"
      : status === "failed"
      ? "oc-agent-shell-status oc-agent-shell-status-fail"
      : "oc-agent-shell-status oc-agent-shell-status-run";
  const label =
    status === "completed"
      ? "exit 0"
      : status === "failed"
      ? "failed"
      : status === "in_progress"
      ? "running"
      : "queued";
  return <span className={cls}>{label}</span>;
}

// ──────────────────────────────────────────────────────────
// xterm-backed output area
// ──────────────────────────────────────────────────────────
//
// Rather than `<pre>{output}</pre>` we mount an xterm so ANSI
// colors, cursor codes, and progress-bar control sequences
// render correctly. Build / install / find tend to emit lots
// of ANSI; without xterm those would show as garbage.
//
// The instance lives only as long as the card is expanded —
// unmounted on collapse via React's unmount path. Re-expanding
// rebuilds (cheap; the tool output is in JS memory, no IPC).

function ShellOutput({ text }: { text: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  // Subscribe to appearance prefs so xterm restyles when the user
  // changes hue/intensity/theme — xterm needs concrete RGB strings,
  // it can't read CSS variables on its own.
  const { prefs } = useAppearance();

  // Mount xterm once.
  useLayoutEffect(() => {
    if (!hostRef.current) return;
    const term = new XTerm({
      disableStdin: true,
      cursorBlink: false,
      cursorStyle: "block",
      convertEol: true,
      fontSize: 11,
      fontFamily:
        "'SF Mono', 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
      scrollback: 10_000,
      // Use a DOM renderer (xterm's default in v6); no webgl/canvas
      // addon so the card has zero GPU footprint.
      theme: resolveXtermTheme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    xtermRef.current = term;
    fitRef.current = fit;
    // Kick a fit once the layout has settled.
    requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {
        /* no-op */
      }
    });
    return () => {
      term.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply theme whenever appearance prefs change so the xterm
  // chrome follows the user's hue/intensity in real time.
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.options.theme = resolveXtermTheme();
  }, [prefs.hue, prefs.intensity, prefs.mode, prefs.accent]);

  // Write text whenever it changes (streaming friendly — Stage 7
  // adapters push partial output via `tool_call_update.content`,
  // and React replaces `text` here every update).
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.reset();
    term.write(text);
  }, [text]);

  // Refit on container resize so width changes (panel drag) don't
  // truncate output.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      try {
        fitRef.current?.fit();
      } catch {
        /* no-op */
      }
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const heightLines = useMemo(() => {
    const lines = text.split("\n").length;
    return Math.min(Math.max(lines, 4), 24);
  }, [text]);

  return (
    <div
      ref={hostRef}
      className="oc-agent-shell-xterm"
      style={{ height: heightLines * 14 + 12 }}
    />
  );
}

// ──────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────

/** First-render fallbacks if getComputedStyle hasn't seen tokens.css
 *  yet. Should never hit in practice. */
// check:ui ignore-next
const FALLBACK_XTERM_BG = "#0d1117";
// check:ui ignore-next
const FALLBACK_XTERM_FG = "#e6edf3";
// check:ui ignore-next
const FALLBACK_XTERM_SEL = "#1f6feb55";

/** Read the current chrome surface + foreground tokens and shape them
 *  into an xterm theme object. xterm doesn't read CSS variables, so
 *  we resolve them here at mount time and again whenever prefs flip
 *  (hue / intensity / mode). */
function resolveXtermTheme() {
  const bg = resolveTokenValue("--surface-floor") ?? FALLBACK_XTERM_BG;
  const fg = resolveTokenValue("--text-primary") ?? FALLBACK_XTERM_FG;
  const cursor = resolveTokenValue("--text-muted") ?? fg;
  const sel = resolveTokenValue("--accent-soft-bg") ?? FALLBACK_XTERM_SEL;
  return {
    background: bg,
    foreground: fg,
    cursor,
    selectionBackground: sel,
  };
}

function readCommand(input: unknown): string {
  if (!isObj(input)) return "";
  const cmd = input.command;
  return typeof cmd === "string" ? cmd : "";
}

function readCwd(input: unknown): string {
  if (!isObj(input)) return "";
  const cwd = input.cwd ?? input.cwd_path ?? input.workdir;
  return typeof cwd === "string" ? cwd : "";
}

function readOutputText(tool: AgentToolMessage): string {
  if (!tool.content) return "";
  const parts: string[] = [];
  for (const block of tool.content) {
    if (block.type === "content") {
      const c = block.content as { type?: string; text?: string };
      if (c?.type === "text" && typeof c.text === "string") {
        parts.push(c.text);
      }
    }
  }
  return parts.join("");
}

function lastLine(text: string): string {
  const trimmed = text.replace(/\s+$/, "");
  if (!trimmed) return "";
  const idx = trimmed.lastIndexOf("\n");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
