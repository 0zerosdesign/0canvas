// ──────────────────────────────────────────────────────────
// AI Chat Panel — Variant-aware AI design agent
// ──────────────────────────────────────────────────────────
//
// Sends the FULL variant HTML + CSS to the AI.
// AI rewrites the HTML/CSS → variant updates live in iframe.
// Designer fine-tunes with style editor.
//
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Send, Bot, User, Loader2, Sparkles, Square, Check, AlertCircle,
  Undo2, ArrowRight, X, FolderOpen, ChevronDown, MoreHorizontal,
  GitBranch, Eye, Image as ImageIcon, TerminalSquare,
  Compass, Users, Plug, Clock, FileText, MessageCircle,
  Brain, LogIn, Search, Zap,
  type LucideIcon,
} from "lucide-react";
import { useWorkspace, findElement, type AiThinkingEffort, type AiPermissionMode } from "../store/store";
import { useBridge } from "../bridge/use-bridge";
import type { BridgeMessage } from "../bridge/messages";
import { streamChat, isAiConfigured, saveAiSettings, type OpenAIMessage } from "../lib/openai";
import { runCliLogin } from "../lib/ai-cli";
import { listSkills, type Skill } from "../../native/native";
import { applyStyle, flashElement } from "../inspector";
import { ScrollArea } from "../ui/scroll-area";
import { Button, Textarea } from "../ui";
import { AcpMode } from "../acp/acp-mode";

// ── Diff / pending changes types ─────────────────────────

interface PendingCssChange {
  property: string;
  oldValue: string;
  newValue: string;
  checked: boolean;
}

interface PendingVariantRewrite {
  html: string;
  css?: string;
}

interface StreamAppliedEntry {
  property: string;
  camelProp: string;
  oldValue: string;
  newValue: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  pending?: boolean;
  applied?: boolean;
  appliedChanges?: string[];
}

const VARIANT_SYSTEM_PROMPT = `You are the AI design agent for Zeros. You redesign UI components.

You receive a component's HTML. Redesign it as requested.

CRITICAL RULES:
1. Return ONLY the component HTML in this exact block:

\`\`\`html-apply
<div class="component">
  <!-- your redesigned HTML here -->
</div>
\`\`\`

2. Use INLINE STYLES on elements (style="..."). Do NOT return a separate CSS block.
   The variant renders in an isolated iframe — inline styles are the most reliable.
3. Keep it SHORT. Only return the component HTML, not a full page.
4. Do NOT include <html>, <head>, <body>, <style>, or <script> tags.
5. Do NOT return any framework CSS (Tailwind utilities, ReactFlow, etc).
6. Use modern CSS in inline styles: flexbox, grid, border-radius, box-shadow, gradients.
7. Be creative and make it look POLISHED and PROFESSIONAL.
8. Use a cohesive color palette. Prefer subtle shadows, rounded corners, good spacing.
9. Keep the same general content/text but redesign the visual presentation.
10. Brief description of changes (1-2 sentences), then the html-apply block. Nothing else.`;

const ELEMENT_SYSTEM_PROMPT = `You are the AI design agent for Zeros — a visual design tool on production code.
The designer selects elements and asks you to make visual changes.

When making CSS changes, return a css-apply block:

\`\`\`css-apply
property: value;
\`\`\`

The system auto-applies these to the selected element. Be concise.`;

// ── Slash commands (Phase 4) ─────────────────────────────
//
// Triggered when the input starts with `/`. Arrow keys navigate,
// Enter selects, Esc closes. Each command either performs a side
// effect (and clears the input) or expands into a placeholder the
// user can continue typing on top of.

type SlashCommand = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  // When the user picks this command: either run a side effect and
  // return the new input text, or return a placeholder string to
  // seed the textarea with.
  action: (ctx: SlashCommandContext) => Promise<string> | string;
};

type SlashCommandContext = {
  provider: "claude" | "codex" | "other";
  cycleEffort: () => AiThinkingEffort;
  clearChat: () => void;
};

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "explore",
    label: "/explore",
    description: "Browse community resources",
    icon: Compass,
    action: () => "Show me what I can do with Zeros.",
  },
  {
    id: "agents",
    label: "/agents",
    description: "Show available agents",
    icon: Users,
    action: () => "List all available agents.",
  },
  {
    id: "skills",
    label: "/skills",
    description: "Show available skills",
    icon: Sparkles,
    action: () => "List all installed skills.",
  },
  {
    id: "plugins",
    label: "/plugins",
    description: "Show installed plugins",
    icon: Plug,
    action: () => "List installed plugins.",
  },
  {
    id: "mcp",
    label: "/mcp",
    description: "View MCP server status",
    icon: Plug,
    action: () => "Show MCP server status.",
  },
  {
    id: "rewind",
    label: "/rewind",
    description: "Rewind to a previous checkpoint",
    icon: Clock,
    action: () => "Rewind to the last checkpoint.",
  },
  {
    id: "spec",
    label: "/spec",
    description: "Create a spec sheet",
    icon: FileText,
    action: () => "Create a spec sheet for: ",
  },
  {
    id: "interview",
    label: "/interview",
    description: "Zeros interviews you to understand the task",
    icon: MessageCircle,
    action: () => "Interview me about what I'm trying to build.",
  },
  {
    id: "thinking",
    label: "/thinking",
    description: "Cycle thinking effort",
    icon: Brain,
    action: (ctx) => {
      const next = ctx.cycleEffort();
      return `Thinking effort set to ${next}.`;
    },
  },
  {
    id: "model",
    label: "/model",
    description: "Change the AI model",
    icon: Search,
    action: () => "/model ",
  },
  {
    id: "auth",
    label: "/auth",
    description: "Sign in with Claude Pro / ChatGPT Pro",
    icon: LogIn,
    action: async (ctx) => {
      const cli = ctx.provider === "codex" ? "codex" : "claude";
      try {
        await runCliLogin(cli);
      } catch {
        /* user will see error via Terminal */
      }
      return "";
    },
  },
  {
    id: "login",
    label: "/login",
    description: "Sign in with Claude Pro / ChatGPT Pro",
    icon: LogIn,
    action: async (ctx) => {
      const cli = ctx.provider === "codex" ? "codex" : "claude";
      try {
        await runCliLogin(cli);
      } catch {
        /* user will see error via Terminal */
      }
      return "";
    },
  },
  {
    id: "clear",
    label: "/clear",
    description: "Clear this conversation",
    icon: X,
    action: (ctx) => {
      ctx.clearChat();
      return "";
    },
  },
];

function SlashMenu({
  query,
  selectedIndex,
  onSelectIndex,
  onPick,
}: {
  query: string;
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
  onPick: (cmd: SlashCommand) => void;
}) {
  const matches = filterSlashCommands(query);
  if (matches.length === 0) return null;
  return (
    <div className="oc-slash-menu" role="listbox">
      {matches.map((cmd, i) => (
        <button
          key={cmd.id}
          role="option"
          aria-selected={i === selectedIndex}
          className={`oc-slash-item ${i === selectedIndex ? "is-active" : ""}`}
          onMouseEnter={() => onSelectIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(cmd);
          }}
        >
          <code className="oc-slash-label">{cmd.label}</code>
          <span className="oc-slash-desc">{cmd.description}</span>
        </button>
      ))}
      <div className="oc-slash-footer">
        <span>↑↓ navigate</span>
        <span>Enter select</span>
        <span>Esc close</span>
      </div>
    </div>
  );
}

function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().replace(/^\//, "");
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) =>
    c.label.slice(1).toLowerCase().startsWith(q),
  );
}

// ── Model picker (Stream 5) ──────────────────────────────
// Two-level dropdown: providers at top, models for the active provider
// below. Matches the structure the user showed in the Claude / Codex
// screenshots. Provider icon + tint mirrors the auth/brand identity.

type ProviderKey = "claude" | "codex";

type ModelEntry = {
  value: string;
  label: string;
  badge?: string;
};

const MODELS_BY_PROVIDER: Record<ProviderKey, ModelEntry[]> = {
  claude: [
    { value: "claude-opus-4-7", label: "Claude Opus 4.7", badge: "NEW" },
    { value: "claude-opus-4-6", label: "Claude Opus 4.6", badge: "1M" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  codex: [
    { value: "gpt-5.4", label: "GPT-5.4", badge: "NEW" },
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
    { value: "gpt-5-codex", label: "GPT-5 Codex" },
  ],
};

function providerKey(p: string): ProviderKey {
  if (p === "codex" || p === "openai" || p === "chatgpt") return "codex";
  return "claude";
}

function ProviderIcon({ provider, size = 12 }: { provider: ProviderKey; size?: number }) {
  return provider === "claude" ? (
    // Brand glyph tint — primitive scale is intentional. check:ui ignore-next
    <Sparkles size={size} style={{ color: "var(--orange-400)" }} />
  ) : (
    <Bot size={size} style={{ color: "var(--text-on-surface-variant)" }} />
  );
}

function ModelPickerPill({
  settings,
  onChange,
}: {
  settings: ReturnType<typeof useWorkspace>["state"]["aiSettings"];
  onChange: (next: ReturnType<typeof useWorkspace>["state"]["aiSettings"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = providerKey(settings.provider);
  const models = MODELS_BY_PROVIDER[current];
  const currentModelLabel =
    models.find((m) => m.value === settings.model)?.label ?? models[0]?.label ?? "";

  const switchProvider = (p: ProviderKey) => {
    const firstModel = MODELS_BY_PROVIDER[p][0].value;
    onChange({ ...settings, provider: p as typeof settings.provider, model: firstModel });
  };

  const pickModel = (value: string) => {
    onChange({ ...settings, model: value });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="oc-chat-dropdown-root">
      <button
        className="oc-chat-toolbar-pill"
        title={`Model: ${currentModelLabel}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <ProviderIcon provider={current} size={12} />
        <ChevronDown size={10} className="oc-chat-toolbar-caret" />
      </button>
      {open && (
        <div className="oc-chat-dropdown-menu oc-chat-model-menu">
          {(["claude", "codex"] as ProviderKey[]).map((p) => (
            <button
              key={p}
              className={`oc-chat-dropdown-item ${
                current === p ? "is-active" : ""
              }`}
              onClick={() => {
                switchProvider(p);
                // leave menu open so the user can pick a model after switching
              }}
              type="button"
            >
              <span className="oc-chat-dropdown-item-row">
                <ProviderIcon provider={p} size={14} />
                <span className="oc-chat-dropdown-item-label">
                  {p === "claude" ? "Claude" : "Codex"}
                </span>
              </span>
              {current === p && (
                <Check size={12} className="oc-chat-dropdown-item-check" />
              )}
            </button>
          ))}
          <div className="oc-chat-dropdown-divider" />
          <div className="oc-chat-dropdown-section-label">
            {current === "claude" ? "Model" : "Codex Model"}
          </div>
          {models.map((m) => (
            <button
              key={m.value}
              className={`oc-chat-dropdown-item ${
                settings.model === m.value ? "is-active" : ""
              }`}
              onClick={() => pickModel(m.value)}
              type="button"
            >
              <span className="oc-chat-dropdown-item-row">
                <span className="oc-chat-dropdown-item-label">{m.label}</span>
                {m.badge && (
                  <span className="oc-chat-dropdown-badge">{m.badge}</span>
                )}
              </span>
              {settings.model === m.value && (
                <Check size={12} className="oc-chat-dropdown-item-check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Open-project dropdown (Stream 5) ─────────────────────
// "Open" button in the chat header → Open Terminal / Open in Finder
// for the active project root. Mirrors the Cursor header pattern.

function OpenProjectMenu() {
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<string>("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { isNativeRuntime, nativeInvoke } = await import("../../native/runtime");
      if (!isNativeRuntime()) return;
      try {
        const r = await nativeInvoke<string | null>("get_engine_root");
        setRoot(r ?? "");
      } catch {
        /* ignore — engine not up yet */
      }
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleAction = async (kind: "terminal" | "finder") => {
    setOpen(false);
    if (!root) return;
    try {
      const mod = await import("../../native/native");
      if (kind === "terminal") await mod.openInTerminal(root);
      else await mod.revealInFinder(root);
    } catch (err) {
      console.warn("[Zeros] open project action failed", err);
    }
  };

  return (
    <div ref={rootRef} className="oc-chat-dropdown-root is-top is-right">
      <button
        className="oc-chat-headerbtn"
        title="Open project folder / terminal"
        onClick={() => setOpen((v) => !v)}
        type="button"
        disabled={!root}
      >
        <FolderOpen size={13} />
        <span>Open</span>
        <ChevronDown size={11} className="oc-chat-headerbtn-caret" />
      </button>
      {open && (
        <div className="oc-chat-dropdown-menu">
          <button
            className="oc-chat-dropdown-item"
            onClick={() => handleAction("terminal")}
            type="button"
          >
            <span className="oc-chat-dropdown-item-row">
              <TerminalSquare size={12} />
              <span className="oc-chat-dropdown-item-label">Open Terminal</span>
            </span>
          </button>
          <button
            className="oc-chat-dropdown-item"
            onClick={() => handleAction("finder")}
            type="button"
          >
            <span className="oc-chat-dropdown-item-row">
              <FolderOpen size={12} />
              <span className="oc-chat-dropdown-item-label">Open in Finder</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Branch switcher pill (Stream 5) ──────────────────────
// Reads current branch + list on open via the git.branchList/Switch
// helpers. Mirrors the Col 2 Git panel's branch menu in a compact
// footer-pill form.

function BranchSwitcherPill() {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<
    Array<{ name: string; isHead: boolean; isRemote: boolean }>
  >([]);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const mod = await import("../../native/native");
      const list = await mod.git.branchList();
      setBranches(list);
    } catch {
      setBranches([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  // Initial load so the pill label reflects current branch on mount.
  useEffect(() => { refresh(); }, [refresh]);

  const current =
    branches.find((b) => b.isHead)?.name ??
    (branches[0]?.name ?? "main");
  const local = branches.filter((b) => !b.isRemote);

  const handleSwitch = async (name: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const mod = await import("../../native/native");
      await mod.git.branchSwitch(name);
      await refresh();
      setOpen(false);
    } catch (err) {
      console.warn("[Zeros] branch switch failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className="oc-chat-dropdown-root is-footer">
      <button
        className="oc-chat-footer-pill"
        title={`Branch: ${current}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <GitBranch size={11} />
        <span>{current}</span>
        <ChevronDown size={10} className="oc-chat-toolbar-caret" />
      </button>
      {open && (
        <div className="oc-chat-dropdown-menu">
          <div className="oc-chat-dropdown-section-label">Branches</div>
          {local.length === 0 ? (
            <div className="oc-chat-dropdown-empty">
              No branches found. Open a git repo to switch branches.
            </div>
          ) : (
            local.map((b) => (
              <button
                key={b.name}
                className={`oc-chat-dropdown-item ${
                  b.isHead ? "is-active" : ""
                }`}
                onClick={() => !b.isHead && handleSwitch(b.name)}
                disabled={b.isHead || busy}
                type="button"
              >
                <span className="oc-chat-dropdown-item-row">
                  <GitBranch size={11} />
                  <span className="oc-chat-dropdown-item-label">{b.name}</span>
                </span>
                {b.isHead && (
                  <Check size={12} className="oc-chat-dropdown-item-check" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Effort label mapping for the Adaptive Thinking pill.
function effortLabel(e: AiThinkingEffort): string {
  switch (e) {
    case "low": return "Low";
    case "medium": return "Medium";
    case "high": return "High";
    case "xhigh": return "xHigh";
  }
}

// Permission-mode label mapping for the Permission pill.
function permissionLabel(p: AiPermissionMode): string {
  switch (p) {
    case "plan": return "Plan Only";
    case "ask": return "Ask First";
    case "auto-edit": return "Auto Edit";
    case "full": return "Full Access";
  }
}

// ── Simple dropdown pill (Stream 5) ──────────────────────
//
// Shared pill-with-dropdown primitive used by the Effort and
// Permission Mode pills on the chat composer. Keeps keyboard + click-
// outside handling in one place so future pills (Model picker, Branch
// switcher) can adopt the same shape.

type DropdownItem<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

function DropdownPill<T extends string>({
  label,
  title,
  icon,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  title: string;
  icon?: React.ReactNode;
  items: DropdownItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`oc-chat-dropdown-root ${className ?? ""}`}>
      <button
        className="oc-chat-toolbar-pill"
        title={title}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {icon}
        <span>{label}</span>
        <ChevronDown size={10} className="oc-chat-toolbar-caret" />
      </button>
      {open && (
        <div className="oc-chat-dropdown-menu">
          {items.map((item) => (
            <button
              key={item.value}
              className={`oc-chat-dropdown-item ${
                item.value === value ? "is-active" : ""
              }`}
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
              type="button"
            >
              <span className="oc-chat-dropdown-item-label">{item.label}</span>
              {item.hint && (
                <span className="oc-chat-dropdown-item-hint">{item.hint}</span>
              )}
              {item.value === value && (
                <Check size={12} className="oc-chat-dropdown-item-check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skill pill (Phase 4-H) ───────────────────────────────
//
// Clickable toolbar chip that opens a dropdown of available skills.
// When a skill is active it shows that skill's name; otherwise shows
// a neutral "Skills" label.

function SkillPillButton({
  skills,
  selected,
  onSelect,
}: {
  skills: Skill[];
  selected: Skill | null;
  onSelect: (s: Skill | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open]);

  return (
    <div ref={rootRef} className="oc-chat-skill-root">
      <button
        className="oc-chat-toolbar-pill is-skill"
        title={selected ? `Skill: ${selected.name}` : "Pick a skill"}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="oc-chat-skill-chip">
          <Sparkles size={10} />
        </span>
        <span>{selected?.name ?? "Skills"}</span>
        <ChevronDown size={10} className="oc-chat-toolbar-caret" />
      </button>
      {open && (
        <div className="oc-chat-skill-menu">
          {skills.length === 0 ? (
            <p className="oc-chat-skill-empty">
              No skills yet. Add markdown files under{" "}
              <code>skills/</code> in your project root.
            </p>
          ) : (
            skills.map((s) => (
              <button
                key={s.id}
                className={`oc-chat-skill-item ${
                  selected?.id === s.id ? "is-active" : ""
                }`}
                onClick={() => {
                  onSelect(selected?.id === s.id ? null : s);
                  setOpen(false);
                }}
                type="button"
              >
                <span className="oc-chat-skill-item-name">{s.name}</span>
                {s.description && (
                  <span className="oc-chat-skill-item-desc">
                    {s.description}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Diff View: per-property accept/reject ────────────────

function DiffView({
  changes,
  onToggle,
  onApplySelected,
  onApplyAll,
  onReject,
}: {
  changes: PendingCssChange[];
  onToggle: (index: number) => void;
  onApplySelected: () => void;
  onApplyAll: () => void;
  onReject: () => void;
}) {
  const checkedCount = changes.filter((c) => c.checked).length;
  return (
    <div className="oc-ai-diff">
      <div className="oc-ai-diff-title">Proposed Changes</div>
      {changes.map((change, i) => (
        <label key={i} className="oc-ai-diff-row">
          <input
            type="checkbox"
            checked={change.checked}
            onChange={() => onToggle(i)}
            className="oc-ai-diff-check"
          />
          <span className="oc-ai-diff-prop">{change.property}:</span>
          <span className="oc-ai-diff-old">{change.oldValue || "(none)"}</span>
          <ArrowRight size={10} className="oc-ai-diff-arrow" />
          <span className="oc-ai-diff-new">{change.newValue}</span>
        </label>
      ))}
      <div className="oc-ai-diff-actions">
        <Button variant="primary" size="sm" onClick={onApplySelected} disabled={checkedCount === 0}>
          Apply{checkedCount < changes.length ? ` (${checkedCount})` : " Selected"}
        </Button>
        <Button variant="outline" size="sm" onClick={onApplyAll}>
          Apply All
        </Button>
        <Button variant="ghost" size="sm" onClick={onReject}>
          Reject
        </Button>
      </div>
    </div>
  );
}

function VariantDiffView({
  onApply,
  onReject,
}: {
  onApply: () => void;
  onReject: () => void;
}) {
  return (
    <div className="oc-ai-diff">
      <div className="oc-ai-diff-title">Redesign variant?</div>
      <div className="oc-ai-diff-actions">
        <Button variant="primary" size="sm" onClick={onApply}>
          Apply
        </Button>
        <Button variant="ghost" size="sm" onClick={onReject}>
          Reject
        </Button>
      </div>
    </div>
  );
}

export function AIChatPanel() {
  const { state, dispatch } = useWorkspace();
  const bridge = useBridge();
  // ACP beta mode — when true, the panel swaps its body for the ACP-native
  // surface (use-acp-session + agents-panel + acp-chat). Legacy state below
  // stays mounted so turning it off returns to the exact prior conversation.
  const [acpMode, setAcpMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  // Phase 4 slash palette. Open whenever the input line starts with "/".
  const [slashIndex, setSlashIndex] = useState(0);
  const slashOpen = input.startsWith("/") && !streaming;
  const slashMatches = slashOpen ? filterSlashCommands(input) : [];
  // Phase 4 skills — loaded once on mount. `selectedSkill` is the
  // currently-active skill chip; its body is prepended to the system
  // prompt for the next turn.
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  useEffect(() => {
    listSkills().then(setSkills).catch(() => setSkills([]));
  }, []);
  const [variantHistory, setVariantHistory] = useState<{ html: string; css: string }[]>([]);
  const [pendingCssChanges, setPendingCssChanges] = useState<PendingCssChange[] | null>(null);
  const [pendingVariant, setPendingVariant] = useState<PendingVariantRewrite | null>(null);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamAppliedRef = useRef<StreamAppliedEntry[]>([]);

  const aiSettings = state.aiSettings;
  const isLocalAI = aiSettings.provider === "chatgpt" || aiSettings.provider === "openai";
  const isIDE = aiSettings.provider === "ide";
  // Get active variant
  const activeVariant = state.activeVariantId
    ? state.variants.find((v) => v.id === state.activeVariantId)
    : null;

  const selectedElement = state.selectedElementId
    ? findElement(state.elements, state.selectedElementId)
    : null;

  // Determine context mode
  const hasVariant = !!activeVariant;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingCssChanges, pendingVariant]);

  // Phase 2-B: consume submissions pushed by InlineEdit / feedback pill.
  // Waits for any in-flight stream to finish so we don't interleave
  // concurrent AI calls.
  const pendingSub = state.pendingChatSubmission;
  useEffect(() => {
    if (!pendingSub || streaming) return;
    const { id, text } = pendingSub;
    handleSend(text);
    dispatch({ type: "CONSUME_CHAT_SUBMISSION", id });
  }, [pendingSub, streaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Parse and apply AI response ─────────────────────────

  const applyVariantRewrite = useCallback((content: string): string[] => {
    if (!activeVariant) return [];
    const changes: string[] = [];

    const htmlMatch = content.match(/```html-apply\s*\n([\s\S]*?)```/);
    const cssMatch = content.match(/```css-apply\s*\n([\s\S]*?)```/);

    if (htmlMatch) {
      // Save current state for undo
      setVariantHistory((prev) => [
        ...prev.slice(-9), // keep last 10
        {
          html: activeVariant.modifiedHtml || activeVariant.html,
          css: activeVariant.modifiedCss || activeVariant.css,
        },
      ]);

      const updates: Record<string, unknown> = {
        modifiedHtml: htmlMatch[1].trim(),
      };
      changes.push("Design updated");

      if (cssMatch) {
        updates.modifiedCss = cssMatch[1].trim();
      }

      dispatch({ type: "UPDATE_VARIANT", id: activeVariant.id, updates });
    }

    return changes;
  }, [activeVariant, dispatch]);

  const handleUndo = useCallback(() => {
    if (!activeVariant || variantHistory.length === 0) return;
    const prev = variantHistory[variantHistory.length - 1];
    setVariantHistory((h) => h.slice(0, -1));
    dispatch({
      type: "UPDATE_VARIANT",
      id: activeVariant.id,
      updates: { modifiedHtml: prev.html, modifiedCss: prev.css },
    });
    setMessages((msgs) => [...msgs, {
      id: `sys-${Date.now()}`, role: "assistant", content: "Reverted to previous design.",
      timestamp: Date.now(),
    }]);
  }, [activeVariant, variantHistory, dispatch]);

  // ── Diff accept/reject handlers ───────────────────────────

  const handleToggleCssChange = useCallback((index: number) => {
    setPendingCssChanges((prev) => {
      if (!prev) return prev;
      return prev.map((c, i) => i === index ? { ...c, checked: !c.checked } : c);
    });
  }, []);

  const handleApplySelectedCss = useCallback(() => {
    if (!pendingCssChanges || !selectedElement) return;
    const applied: string[] = [];
    for (const change of pendingCssChanges) {
      if (!change.checked) {
        // Revert streamed preview for unchecked properties
        const entry = streamAppliedRef.current.find((e) => e.property === change.property);
        if (entry) {
          applyStyle(selectedElement.id, change.property, change.oldValue);
          dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: entry.camelProp, value: change.oldValue });
        }
      } else {
        // Ensure it's applied in the store (was already applied via stream preview)
        const camelProp = change.property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        applyStyle(selectedElement.id, change.property, change.newValue);
        dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: camelProp, value: change.newValue });
        applied.push(`${change.property}: ${change.newValue}`);
      }
    }
    flashElement(selectedElement.id);
    setMessages((prev) => [...prev, {
      id: `applied-${Date.now()}`, role: "assistant",
      content: "Changes applied.", timestamp: Date.now(),
      applied: true, appliedChanges: applied,
    }]);
    setPendingCssChanges(null);
    setPendingContent(null);
    streamAppliedRef.current = [];
  }, [pendingCssChanges, selectedElement, dispatch]);

  const handleApplyAllCss = useCallback(() => {
    if (!pendingCssChanges || !selectedElement) return;
    const applied: string[] = [];
    for (const change of pendingCssChanges) {
      const camelProp = change.property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      applyStyle(selectedElement.id, change.property, change.newValue);
      dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: camelProp, value: change.newValue });
      applied.push(`${change.property}: ${change.newValue}`);
    }
    flashElement(selectedElement.id);
    setMessages((prev) => [...prev, {
      id: `applied-${Date.now()}`, role: "assistant",
      content: "All changes applied.", timestamp: Date.now(),
      applied: true, appliedChanges: applied,
    }]);
    setPendingCssChanges(null);
    setPendingContent(null);
    streamAppliedRef.current = [];
  }, [pendingCssChanges, selectedElement, dispatch]);

  const handleRejectCss = useCallback(() => {
    // Revert all streamed preview changes
    if (selectedElement && streamAppliedRef.current.length > 0) {
      for (const entry of streamAppliedRef.current) {
        applyStyle(selectedElement.id, entry.property, entry.oldValue);
        dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: entry.camelProp, value: entry.oldValue });
      }
    }
    setMessages((prev) => [...prev, {
      id: `rejected-${Date.now()}`, role: "assistant",
      content: "Changes rejected.", timestamp: Date.now(),
    }]);
    setPendingCssChanges(null);
    setPendingContent(null);
    streamAppliedRef.current = [];
  }, [selectedElement, dispatch]);

  const handleApplyVariant = useCallback(() => {
    if (!pendingVariant || !activeVariant || !pendingContent) return;
    // Save for undo
    setVariantHistory((prev) => [
      ...prev.slice(-9),
      {
        html: activeVariant.modifiedHtml || activeVariant.html,
        css: activeVariant.modifiedCss || activeVariant.css,
      },
    ]);
    const updates: Record<string, unknown> = { modifiedHtml: pendingVariant.html };
    if (pendingVariant.css) updates.modifiedCss = pendingVariant.css;
    dispatch({ type: "UPDATE_VARIANT", id: activeVariant.id, updates });
    setMessages((prev) => [...prev, {
      id: `applied-${Date.now()}`, role: "assistant",
      content: "Variant redesign applied.", timestamp: Date.now(),
      applied: true, appliedChanges: ["Design updated"],
    }]);
    setPendingVariant(null);
    setPendingContent(null);
  }, [pendingVariant, pendingContent, activeVariant, dispatch]);

  const handleRejectVariant = useCallback(() => {
    setMessages((prev) => [...prev, {
      id: `rejected-${Date.now()}`, role: "assistant",
      content: "Variant redesign rejected.", timestamp: Date.now(),
    }]);
    setPendingVariant(null);
    setPendingContent(null);
  }, []);

  const applyElementStyles = useCallback((content: string): string[] => {
    if (!selectedElement) return [];
    const applied: string[] = [];

    // Match ```css-apply ... ``` or ```css ... ```
    const cssApplyRegex = /```css-apply\s*\n([\s\S]*?)```/g;
    const cssRegex = /```css\s*\n([\s\S]*?)```/g;

    const blocks: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = cssApplyRegex.exec(content)) !== null) blocks.push(match[1]);
    if (blocks.length === 0) {
      while ((match = cssRegex.exec(content)) !== null) {
        if (!match[1].includes("{")) blocks.push(match[1]);
      }
    }

    for (const block of blocks) {
      for (const line of block.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
        const propMatch = trimmed.match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
        if (propMatch) {
          const [, property, value] = propMatch;
          const camelProp = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
          applyStyle(selectedElement.id, property, value);
          dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: camelProp, value });
          applied.push(`${property}: ${value}`);
        }
      }
    }

    // Flash the element to visualize the change
    if (applied.length > 0 && selectedElement) {
      flashElement(selectedElement.id);
    }

    return applied;
  }, [selectedElement, dispatch]);

  // IDE agent responses — show diff instead of auto-applying
  useEffect(() => {
    if (!bridge) return;
    return bridge.on("AI_CHAT_RESPONSE", (msg: BridgeMessage) => {
      const resp = msg as any;
      const content = resp.message || "";
      setStreaming(false);

      // Mark message as done
      setMessages((prev) =>
        prev.map((m) => m.pending ? { ...m, content, pending: false } : m)
      );

      if (activeVariant) {
        const htmlMatch = content.match(/```html-apply\s*\n([\s\S]*?)```/);
        const cssMatch = content.match(/```css-apply\s*\n([\s\S]*?)```/);
        if (htmlMatch) {
          setPendingVariant({
            html: htmlMatch[1].trim(),
            css: cssMatch ? cssMatch[1].trim() : undefined,
          });
          setPendingContent(content);
        }
      } else if (selectedElement) {
        // Parse css-apply blocks into pending changes for diff view
        const cssApplyRegex = /```css-apply\s*\n([\s\S]*?)```/g;
        const blocks: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = cssApplyRegex.exec(content)) !== null) blocks.push(match[1]);

        const changes: PendingCssChange[] = [];
        const applied: StreamAppliedEntry[] = [];
        for (const block of blocks) {
          for (const line of block.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
            const propMatch = trimmed.match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
            if (propMatch) {
              const [, property, value] = propMatch;
              const camelProp = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
              // Apply for preview
              const oldVal = applyStyle(selectedElement.id, property, value) || "";
              applied.push({ property, camelProp, oldValue: oldVal, newValue: value });
              changes.push({ property, oldValue: oldVal, newValue: value, checked: true });
            }
          }
        }
        if (changes.length > 0) {
          streamAppliedRef.current = applied;
          setPendingCssChanges(changes);
          setPendingContent(content);
        }
      }
    });
  }, [bridge, activeVariant, selectedElement]);

  // ── Send message ────────────────────────────────────────

  const handleSend = useCallback(async (overrideQuery?: string) => {
    const query = (overrideQuery ?? input).trim();
    if (!query || streaming) return;

    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`, role: "user", content: query, timestamp: Date.now(),
    }]);
    // Only clear the input box if we consumed its value; programmatic
    // submissions from inline-edit / feedback leave the user's draft alone.
    if (overrideQuery === undefined) setInput("");
    setStreaming(true);

    // ── Build context based on mode ──
    let systemPrompt: string;
    let contextBlock: string;

    if (hasVariant && activeVariant) {
      const variantHtml = activeVariant.modifiedHtml || activeVariant.html;

      // Only send the component HTML — NOT the page CSS (too large, confuses the AI)
      // Truncate if extremely long
      const htmlForAI = variantHtml.length > 3000
        ? variantHtml.slice(0, 3000) + "\n<!-- truncated -->"
        : variantHtml;

      systemPrompt = VARIANT_SYSTEM_PROMPT;
      contextBlock = `\n\nComponent: "${activeVariant.name}" (${activeVariant.sourceType})
Viewport: ${activeVariant.sourceViewportWidth || 560}px

Current HTML:
\`\`\`html
${htmlForAI}
\`\`\``;
    } else if (selectedElement) {
      systemPrompt = ELEMENT_SYSTEM_PROMPT;
      contextBlock = `\nSelected: \`${selectedElement.selector}\` (<${selectedElement.tag}>)
Classes: ${selectedElement.classes.join(" ")}
Styles:\n${Object.entries(selectedElement.styles)
        .map(([k, v]) => `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`)
        .slice(0, 20).join("\n")}`;
    } else {
      systemPrompt = ELEMENT_SYSTEM_PROMPT;
      contextBlock = "\nNo element or variant selected.";
    }

    // ── Local AI ──
    if (isLocalAI && isAiConfigured(aiSettings)) {
      const assistantMsgId = `ai-${Date.now()}`;
      setMessages((prev) => [...prev, {
        id: assistantMsgId, role: "assistant", content: "", timestamp: Date.now(), pending: true,
      }]);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        // Prepend the active skill's body to the system prompt so the
        // agent takes on the skill's persona + rules for this turn.
        const skillPrefix = selectedSkill
          ? `# Skill: ${selectedSkill.name}\n\n${selectedSkill.body}\n\n---\n\n`
          : "";

        const openaiMessages: OpenAIMessage[] = [
          { role: "system", content: skillPrefix + systemPrompt + contextBlock },
          ...messages.filter((m) => !m.pending).map((m) => ({
            role: m.role as "user" | "assistant", content: m.content,
          })),
          { role: "user", content: query },
        ];

        let accumulated = "";
        const streamApplied: StreamAppliedEntry[] = [];

        for await (const chunk of streamChat({
          settings: aiSettings, messages: openaiMessages, signal: controller.signal,
        })) {
          accumulated += chunk;

          // ── C3: Streaming visual preview for CSS properties ──
          // Apply CSS properties incrementally as they stream in
          if (selectedElement && !hasVariant) {
            const cssMatch = accumulated.match(/```css-apply\s*\n([\s\S]*?)(?:```|$)/);
            if (cssMatch) {
              const lines = cssMatch[1].split("\n");
              for (let i = streamApplied.length; i < lines.length; i++) {
                const propMatch = lines[i].trim().match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
                if (propMatch) {
                  const [, prop, val] = propMatch;
                  const camelProp = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
                  const oldVal = applyStyle(selectedElement.id, prop, val) || "";
                  streamApplied.push({ property: prop, camelProp, oldValue: oldVal, newValue: val });
                }
              }
            }
          }

          setMessages((prev) =>
            prev.map((m) => m.id === assistantMsgId ? { ...m, content: accumulated } : m)
          );
        }

        // ── C2: Show diff view instead of auto-applying ──
        // Mark message as done (no longer pending)
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId ? { ...m, pending: false } : m)
        );

        if (hasVariant) {
          // Variant rewrite: show apply/reject (no per-property diff)
          const htmlMatch = accumulated.match(/```html-apply\s*\n([\s\S]*?)```/);
          const cssMatch = accumulated.match(/```css-apply\s*\n([\s\S]*?)```/);
          if (htmlMatch) {
            setPendingVariant({
              html: htmlMatch[1].trim(),
              css: cssMatch ? cssMatch[1].trim() : undefined,
            });
            setPendingContent(accumulated);
          }
        } else if (selectedElement && streamApplied.length > 0) {
          // CSS changes: show per-property diff with checkboxes
          streamAppliedRef.current = streamApplied;
          setPendingCssChanges(
            streamApplied.map((entry) => ({
              property: entry.property,
              oldValue: entry.oldValue,
              newValue: entry.newValue,
              checked: true,
            }))
          );
          setPendingContent(accumulated);
        } else if (selectedElement) {
          // Fallback: try applying if streaming didn't catch any (e.g. plain css blocks)
          const applied = applyElementStyles(accumulated);
          if (applied.length > 0) {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantMsgId
                ? { ...m, applied: true, appliedChanges: applied }
                : m
              )
            );
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error
          ? err.name === "AbortError" ? "Stopped." : err.message
          : "Unknown error";
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId ? { ...m, content: errMsg, pending: false } : m)
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
      return;
    }

    // ── IDE Agent ──
    if (isIDE && bridge) {
      setMessages((prev) => [...prev, {
        id: `ai-${Date.now()}`, role: "assistant", content: "Sending to agent...",
        timestamp: Date.now(), pending: true,
      }]);
      bridge.send({ type: "AI_CHAT_REQUEST", query,
        selector: selectedElement?.selector, styles: selectedElement?.styles,
        route: state.currentRoute,
      } as any);
      setTimeout(() => {
        setStreaming((c) => {
          if (c) { setMessages((p) => p.map((m) => m.pending ? { ...m, content: "Sent to IDE agent.", pending: false } : m)); return false; }
          return c;
        });
      }, 10000);
      return;
    }

    setMessages((prev) => [...prev, {
      id: `ai-${Date.now()}`, role: "assistant",
      content: "No AI configured. Go to Settings → AI Settings.", timestamp: Date.now(),
    }]);
    setStreaming(false);
  }, [input, streaming, messages, selectedElement, activeVariant, hasVariant, aiSettings, isLocalAI, isIDE, bridge, state.currentRoute, applyVariantRewrite, applyElementStyles]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const activeChatTitle =
    state.chats.find((c) => c.id === state.activeChatId)?.title ?? "Chat";
  // Brand accent colors for the provider icon (Claude=orange, OpenAI=green).
  // Primitive tokens are used here because these are brand glyph tints,
  // not semantic UI color. check:ui ignore-next
  const providerIconTint = aiSettings.provider === "openai" ? "var(--green-500)" : aiSettings.provider === "chatgpt" ? "var(--green-500)" : "var(--orange-400)";

  // ACP beta surface — swaps the panel body only; header stays so the user
  // can toggle back to the legacy chat in one click. Legacy state above is
  // preserved intact across toggles.
  if (acpMode) {
    return (
      <div className="oc-panel oc-chat" data-Zeros="ai-chat">
        <div className="oc-chat-header">
          <span className="oc-chat-title">ACP · Beta</span>
          <div className="oc-chat-header-actions">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setAcpMode(false)}
              title="Back to legacy chat"
            >
              <ArrowRight size={13} style={{ transform: "rotate(180deg)" }} />
            </Button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <AcpMode />
        </div>
      </div>
    );
  }

  return (
    <div className="oc-panel oc-chat" data-Zeros="ai-chat">
      {/* Header — chat title, Open dropdown, diff badge, menu */}
      <div className="oc-chat-header">
        <span className="oc-chat-title">{activeChatTitle}</span>
        <div className="oc-chat-header-actions">
          <OpenProjectMenu />
          {variantHistory.length > 0 && (
            <Button variant="ghost" size="icon-sm" onClick={handleUndo} title="Undo last AI change">
              <Undo2 size={13} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setAcpMode(true)}
            title="Switch to ACP (Beta) — drive any ACP agent via the shared registry"
          >
            <Zap size={13} />
          </Button>
          <Button variant="ghost" size="icon-sm" title="More">
            <MoreHorizontal size={14} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="oc-panel-body oc-chat-body">
        <div className="oc-ai-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="oc-chat-empty">
              <p className="oc-chat-empty-title">Send a message to start</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`oc-ai-msg oc-ai-msg-${msg.role}`}>
              <div className="oc-ai-msg-icon">
                {msg.role === "user" ? <User size={12} /> : <Bot size={12} />}
              </div>
              <div className="oc-ai-msg-content">
                {msg.pending && !msg.content ? (
                  <span className="oc-ai-pending">
                    <Loader2 size={12} className="oc-ai-spinner" /> Thinking...
                  </span>
                ) : (
                  <>
                    <span style={{ whiteSpace: "pre-wrap" }}>
                      {/* Show text without code blocks for cleaner display */}
                      {msg.content
                        .replace(/```html-apply\s*\n[\s\S]*?```/g, "")
                        .replace(/```css-apply\s*\n[\s\S]*?```/g, "")
                        .trim() || (msg.applied ? "Changes applied." : msg.content)}
                    </span>
                    {msg.applied && msg.appliedChanges && msg.appliedChanges.length > 0 && (
                      <div className="oc-ai-applied">
                        <Check size={11} />
                        <span>{msg.appliedChanges.join(" + ")}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* ── C2: Diff view for pending CSS changes ── */}
          {pendingCssChanges && pendingCssChanges.length > 0 && (
            <DiffView
              changes={pendingCssChanges}
              onToggle={handleToggleCssChange}
              onApplySelected={handleApplySelectedCss}
              onApplyAll={handleApplyAllCss}
              onReject={handleRejectCss}
            />
          )}

          {/* ── C2: Diff view for pending variant rewrite ── */}
          {pendingVariant && (
            <VariantDiffView
              onApply={handleApplyVariant}
              onReject={handleRejectVariant}
            />
          )}
        </div>
      </ScrollArea>

      {/* Context chips — surface the element / variant the AI will see */}
      {(activeVariant || selectedElement) && (
        <div className="oc-ai-chips">
          {activeVariant && (
            <span
              className="oc-ai-chip is-variant"
              title={`Active variant: ${activeVariant.name}`}
            >
              @variant · {activeVariant.name}
            </span>
          )}
          {selectedElement && (
            <span
              className="oc-ai-chip"
              title={`Selected element: ${selectedElement.selector}`}
            >
              @element ·{" "}
              <code>
                {selectedElement.tag}
                {selectedElement.classes.length > 0
                  ? `.${selectedElement.classes[0]}`
                  : ""}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                className="oc-ai-chip-x"
                onClick={() =>
                  dispatch({ type: "SELECT_ELEMENT", id: null, source: "panel" })
                }
                title="Clear selection"
                aria-label="Clear element selection"
              >
                ×
              </Button>
            </span>
          )}
        </div>
      )}

      {/* Composer — input card with toolbar underneath */}
      <div className="oc-chat-composer">
        {slashOpen && slashMatches.length > 0 && (
          <SlashMenu
            query={input}
            selectedIndex={Math.min(slashIndex, slashMatches.length - 1)}
            onSelectIndex={setSlashIndex}
            onPick={async (cmd) => {
              const ctx: SlashCommandContext = {
                provider:
                  aiSettings.provider === "claude" || aiSettings.provider === "codex"
                    ? aiSettings.provider
                    : "other",
                cycleEffort: () => {
                  const order: AiThinkingEffort[] = ["low", "medium", "high", "xhigh"];
                  const idx = order.indexOf(aiSettings.thinkingEffort);
                  const next = order[(idx + 1) % order.length];
                  const updated = { ...aiSettings, thinkingEffort: next };
                  saveAiSettings(updated);
                  dispatch({ type: "SET_AI_SETTINGS", settings: updated });
                  return next;
                },
                clearChat: () => setMessages([]),
              };
              const result = await cmd.action(ctx);
              setInput(typeof result === "string" ? result : "");
              setSlashIndex(0);
            }}
          />
        )}
        <div className="oc-chat-composer-card">
          <Textarea
            className="oc-chat-composer-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSlashIndex(0);
            }}
            onKeyDown={(e) => {
              if (slashOpen && slashMatches.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSlashIndex((i) => (i + 1) % slashMatches.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const pick = slashMatches[Math.min(slashIndex, slashMatches.length - 1)];
                  const ctx: SlashCommandContext = {
                    provider:
                      aiSettings.provider === "claude" ||
                      aiSettings.provider === "codex"
                        ? aiSettings.provider
                        : "other",
                    cycleEffort: () => {
                      const order: AiThinkingEffort[] = [
                        "low",
                        "medium",
                        "high",
                        "xhigh",
                      ];
                      const idx = order.indexOf(aiSettings.thinkingEffort);
                      const next = order[(idx + 1) % order.length];
                      const updated = { ...aiSettings, thinkingEffort: next };
                      saveAiSettings(updated);
                      dispatch({ type: "SET_AI_SETTINGS", settings: updated });
                      return next;
                    },
                    clearChat: () => setMessages([]),
                  };
                  Promise.resolve(pick.action(ctx)).then((result) => {
                    setInput(typeof result === "string" ? result : "");
                    setSlashIndex(0);
                  });
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setInput("");
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder='Type your message… "/" for commands, "@" for files'
            disabled={streaming}
            rows={1}
            data-Zeros="ai-input"
          />
          <div className="oc-chat-composer-toolbar">
            <ModelPickerPill
              settings={aiSettings}
              onChange={(next) => {
                saveAiSettings(next);
                dispatch({ type: "SET_AI_SETTINGS", settings: next });
              }}
            />
            <DropdownPill<AiThinkingEffort>
              title="Adaptive thinking"
              label={effortLabel(aiSettings.thinkingEffort)}
              icon={<Brain size={11} />}
              value={aiSettings.thinkingEffort}
              items={[
                { value: "low", label: "Low", hint: "Quick answers" },
                { value: "medium", label: "Medium", hint: "Balanced" },
                { value: "high", label: "High", hint: "Thorough" },
                { value: "xhigh", label: "xHigh", hint: "Long-horizon" },
              ]}
              onChange={(v) => {
                const updated = { ...aiSettings, thinkingEffort: v };
                saveAiSettings(updated);
                dispatch({ type: "SET_AI_SETTINGS", settings: updated });
              }}
            />
            <Button variant="ghost" size="icon-sm" title="Attach image" type="button">
              <ImageIcon size={13} />
            </Button>
            <SkillPillButton
              skills={skills}
              selected={selectedSkill}
              onSelect={setSelectedSkill}
            />
            {selectedSkill && (
              <Button
                variant="ghost"
                size="icon-sm"
                title={`Clear skill (${selectedSkill.name})`}
                onClick={() => setSelectedSkill(null)}
                type="button"
              >
                <X size={12} />
              </Button>
            )}
            <div className="oc-chat-toolbar-spacer" />
            {streaming ? (
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={handleStop}
                title="Stop"
                type="button"
              >
                <Square size={11} />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="icon-sm"
                onClick={() => handleSend()}
                disabled={!input.trim()}
                title="Send"
                type="button"
              >
                <ArrowRight size={13} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Footer — branch pill, plan-only, token meter */}
      <div className="oc-chat-footer">
        <BranchSwitcherPill />
        <DropdownPill<AiPermissionMode>
          title="Permission mode"
          label={permissionLabel(aiSettings.permissionMode)}
          icon={<Eye size={11} />}
          value={aiSettings.permissionMode}
          className="is-footer"
          items={[
            { value: "full", label: "Full Access", hint: "Auto-approve everything" },
            { value: "auto-edit", label: "Auto Edit", hint: "Auto-approve reads + file edits" },
            { value: "ask", label: "Ask First", hint: "Prompt before writes & commands" },
            { value: "plan", label: "Plan Only", hint: "Read-only, no writes or commands" },
          ]}
          onChange={(v) => {
            const updated = { ...aiSettings, permissionMode: v };
            saveAiSettings(updated);
            dispatch({ type: "SET_AI_SETTINGS", settings: updated });
          }}
        />
        <div className="oc-chat-footer-spacer" />
        <span className="oc-chat-token-meter" title="Context usage">
          <span className="oc-chat-token-dot" />
          0%
        </span>
      </div>
    </div>
  );
}
