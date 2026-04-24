// ──────────────────────────────────────────────────────────
// AgentPill — pick which ACP agent drives this composer
// ──────────────────────────────────────────────────────────
//
// Compact pill in the composer's footer row. Shows the selected
// agent's brand logo plus a green/gray dot indicating whether the
// agent's subprocess is warm. Clicking opens a dropdown with every
// enabled agent; selecting a different one bubbles up to the host
// composer (which opens a new chat bound to that agent — see Phase 8
// in the sessions-provider flow).
//
// Dropdown rows show: logo + name + green/gray warm dot, with a
// small `↗` icon that appears on hover to signal "selecting a
// different agent opens in a new tab."
// ──────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Check, Loader2, ArrowUpRight } from "lucide-react";
import { useAgentSessions } from "./sessions-provider";
import { useEnabledAgents } from "./enabled-agents";
import {
  loadAgents,
  refreshAgents,
  useAgentsSnapshot,
} from "./agents-cache";
import { AgentIcon } from "./agent-icon";
import { useWorkspace } from "../store/store";
import type { BridgeRegistryAgent } from "../bridge/messages";

function useClickAway(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

export interface AgentPillProps {
  selectedId: string | null;
  selectedName: string | null;
  onSelect: (agent: BridgeRegistryAgent) => void;
  disabled?: boolean;
  /** Logo-only trigger by default; set false for the legacy label layout. */
  compact?: boolean;
  /** Visual affordance on dropdown rows: "selecting opens in a new tab".
   *  True in chat views (where switching spawns a new chat); false in
   *  the empty composer (where selecting just sets the agent). */
  showOpenInNewTabHint?: boolean;
}

export function AgentPill({
  selectedId,
  selectedName,
  onSelect,
  disabled = false,
  compact = true,
  showOpenInNewTabHint = false,
}: AgentPillProps) {
  const sessions = useAgentSessions();
  const { isEnabled } = useEnabledAgents();
  const { dispatch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const agents = useAgentsSnapshot();
  const loading = agents === null;
  useClickAway(rootRef, open, () => setOpen(false));

  useEffect(() => {
    void loadAgents(sessions.listAgents);
  }, [sessions.listAgents]);

  useEffect(() => {
    if (!open) return;
    void refreshAgents(sessions.listAgents).catch(() => {});
  }, [open, sessions.listAgents]);

  const label = selectedName ?? selectedId ?? "Agent";
  const visible = (agents ?? [])
    .filter((a) => isEnabled(a.id))
    .sort((a, b) => {
      const aActive = a.installed === true ? 0 : 1;
      const bActive = b.installed === true ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.name.localeCompare(b.name);
    });
  const selected = visible.find((a) => a.id === selectedId) ?? null;
  const isSelectedWarm = !!selectedId && sessions.warmAgentIds.has(selectedId);

  const handleInactiveClick = () => {
    dispatch({ type: "SET_ACTIVE_PAGE", page: "settings" });
    setOpen(false);
  };

  const warmedRef = useRef<Set<string>>(new Set());
  const handleRowHover = (agentId: string, runnable: boolean) => {
    if (!runnable) return;
    if (warmedRef.current.has(agentId)) return;
    warmedRef.current.add(agentId);
    void sessions.initAgent(agentId).catch(() => {});
  };

  return (
    <div ref={rootRef} className="oc-chat-dropdown-root">
      <button
        type="button"
        className={`oc-chat-toolbar-pill oc-agent-trigger ${compact ? "oc-agent-trigger--compact" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={`Agent: ${label}`}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="oc-agent-trigger__logo">
          {selected ? (
            <AgentIcon
              agentId={selected.id}
              iconUrl={selected.icon ?? null}
              size={compact ? 14 : 12}
              className="oc-chat-agent-pill-icon"
            />
          ) : (
            <Bot size={compact ? 13 : 11} />
          )}
          <span
            className={`oc-agent-trigger__dot ${isSelectedWarm ? "is-warm" : "is-cold"}`}
            aria-label={isSelectedWarm ? "Agent ready" : "Agent not ready"}
          />
        </span>
        {!compact && <span>{label}</span>}
        <ChevronDown size={10} className="oc-chat-toolbar-caret" />
      </button>
      {open && (
        <div className="oc-chat-dropdown-menu" role="menu">
          <div className="oc-chat-dropdown-section-label">Agent</div>
          {loading && (
            <div className="oc-chat-dropdown-item-hint oc-chat-dropdown-item-hint--padded">
              <Loader2 size={11} className="oc-spin" /> Loading…
            </div>
          )}
          {!loading && visible.length === 0 && (
            <button
              type="button"
              className="oc-chat-dropdown-item-hint oc-chat-dropdown-item-hint--padded oc-chat-dropdown-item-hint--clickable"
              onClick={handleInactiveClick}
            >
              No agents enabled — open Settings → Agents
            </button>
          )}
          {visible.map((a) => {
            const isSelectedRow = a.id === selectedId;
            const isRunnable = a.installed === true;
            const isWarm = sessions.warmAgentIds.has(a.id);
            const switchesChat = showOpenInNewTabHint && !isSelectedRow;
            return (
              <button
                key={a.id}
                type="button"
                className={`oc-chat-dropdown-item is-agent ${isSelectedRow ? "is-active" : ""} ${isRunnable ? "" : "is-inactive"}`}
                onMouseEnter={() => handleRowHover(a.id, isRunnable)}
                onFocus={() => handleRowHover(a.id, isRunnable)}
                onClick={() => {
                  if (!isRunnable) {
                    handleInactiveClick();
                    return;
                  }
                  onSelect(a);
                  setOpen(false);
                }}
                title={
                  isRunnable
                    ? switchesChat
                      ? `${a.name} — opens in a new chat`
                      : a.name
                    : `${a.name} is not signed in — click to open Settings → Agents`
                }
              >
                <AgentIcon
                  agentId={a.id}
                  iconUrl={a.icon ?? null}
                  size={14}
                  className="oc-chat-agent-pill-icon"
                />
                <span className="oc-chat-dropdown-item-label">{a.name}</span>
                {isRunnable && (
                  <span
                    className={`oc-agent-row-dot ${isWarm ? "is-warm" : "is-cold"}`}
                    aria-label={isWarm ? "Agent ready" : "Agent cold"}
                  />
                )}
                {!isRunnable && (
                  <span
                    className="oc-chat-agent-inactive-hint"
                    title="Not signed in — click to set up"
                  >
                    Sign in
                  </span>
                )}
                {isRunnable && isSelectedRow && (
                  <Check size={12} className="oc-chat-dropdown-item-check" />
                )}
                {switchesChat && isRunnable && (
                  <ArrowUpRight
                    size={11}
                    className="oc-agent-row-newtab"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
