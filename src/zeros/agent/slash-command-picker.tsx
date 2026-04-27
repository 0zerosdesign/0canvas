// ──────────────────────────────────────────────────────────
// SlashCommandPicker — autocomplete for agent `available_commands`
// ──────────────────────────────────────────────────────────
//
// Slash commands are advertised by the agent session protocol
// `available_commands_update` notifications and live on
// `session.availableCommands`. Typing "/" at the start of
// a prompt opens this picker; selecting inserts "/<name> "
// and the user continues typing args (or hits Enter).
//
// The command itself is just text — the agent is responsible
// for recognising the "/" prefix. We don't extend the protocol;
// we just make the catalogue discoverable.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import type { AvailableCommand } from "../bridge/agent-events";
import { Button } from "../ui";

// ──────────────────────────────────────────────────────────
// Trigger detection
// ──────────────────────────────────────────────────────────

export interface SlashTrigger {
  /** Always 0 — slash commands only trigger at start of prompt. */
  start: 0;
  /** Index just past the last command-name char (i.e. the space, or eol). */
  end: number;
  /** Characters typed after "/" (before the first space). */
  query: string;
}

/** Show the picker iff the prompt starts with "/" and the caret sits
 *  inside the command-name segment. Once the user types a space the
 *  picker closes — they're typing args, not picking a command. */
export function detectSlashTrigger(
  text: string,
  caret: number,
): SlashTrigger | null {
  if (!text.startsWith("/")) return null;
  const match = text.match(/^\/(\S*)/);
  if (!match) return null;
  const end = 1 + match[1].length;
  if (caret > end) return null;
  return { start: 0, end, query: match[1] };
}

// ──────────────────────────────────────────────────────────
// Ranked filter
// ──────────────────────────────────────────────────────────

/** Case-insensitive contains, ranked by match position so
 *  shorter-prefix matches float to the top. */
export function filterSlashCommands(
  commands: AvailableCommand[],
  query: string,
  limit = 8,
): AvailableCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands.slice(0, limit);
  const scored: Array<{ cmd: AvailableCommand; score: number }> = [];
  for (const cmd of commands) {
    const idx = cmd.name.toLowerCase().indexOf(q);
    if (idx < 0) continue;
    scored.push({ cmd, score: idx });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.cmd);
}

// ──────────────────────────────────────────────────────────
// Picker component
// ──────────────────────────────────────────────────────────

interface SlashCommandPickerProps {
  commands: AvailableCommand[];
  highlightIndex: number;
  onHover: (index: number) => void;
  onPick: (command: AvailableCommand) => void;
}

export function SlashCommandPicker({
  commands,
  highlightIndex,
  onHover,
  onPick,
}: SlashCommandPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the active item scrolled into view as arrow keys move the cursor.
  useEffect(() => {
    const node = listRef.current?.children[highlightIndex] as
      | HTMLElement
      | undefined;
    if (node) node.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  if (commands.length === 0) {
    return (
      <div className="oc-acp-menu">
        <div className="oc-acp-menu-empty">No commands match.</div>
      </div>
    );
  }

  return (
    <div className="oc-acp-menu">
      <div className="oc-acp-menu-head">
        Slash · {commands.length} command{commands.length === 1 ? "" : "s"}
      </div>
      <div ref={listRef} className="oc-acp-menu-list">
        {commands.map((cmd, i) => {
          const active = i === highlightIndex;
          return (
            <Button
              key={cmd.name}
              variant="ghost"
              type="button"
              onMouseEnter={() => onHover(i)}
              onMouseDown={(e) => {
                // mousedown beats textarea blur.
                e.preventDefault();
                onPick(cmd);
              }}
              className={`oc-acp-menu-item ${
                active ? "oc-acp-menu-item-active" : ""
              }`}
            >
              <Terminal className="oc-acp-menu-item-icon w-3.5 h-3.5" />
              <div className="min-w-0 flex-1">
                <div className="oc-acp-menu-item-label">/{cmd.name}</div>
                {cmd.description && (
                  <div className="oc-acp-menu-item-hint">{cmd.description}</div>
                )}
              </div>
              {cmd.input && (
                <span className="oc-acp-menu-item-kind">takes input</span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
