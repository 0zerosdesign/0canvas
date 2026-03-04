import React, { useState } from "react";
import {
  GitBranch,
  Plus,
  Check,
  Send,
  Clock,
  MoreHorizontal,
  ArrowUpRight,
  Trash2,
  Copy,
  Star,
} from "lucide-react";
import { useWorkspace, DesignVersion } from "../store";
import { ScrollArea } from "./ui/scroll-area";

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STATUS_STYLES: Record<DesignVersion["status"], { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-[#333333]", text: "text-[#888888]", label: "Draft" },
  active: { bg: "bg-[#0070f3]/20", text: "text-[#0070f3]", label: "Active" },
  sent: { bg: "bg-[#7928ca]/20", text: "text-[#7928ca]", label: "Sent" },
  applied: { bg: "bg-[#50e3c2]/20", text: "text-[#50e3c2]", label: "Applied" },
};

function VersionCard({ version }: { version: DesignVersion }) {
  const { state, dispatch } = useWorkspace();
  const isActive = state.activeVersionId === version.id;
  const status = STATUS_STYLES[version.status];

  return (
    <div
      className={`p-3 border rounded-lg transition-all cursor-pointer ${
        isActive
          ? "border-[#0070f3]/40 bg-[#0070f3]/5"
          : "border-[#1a1a1a] bg-[#0a0a0a] hover:border-[#333333]"
      }`}
      onClick={() => dispatch({ type: "SET_ACTIVE_VERSION", id: version.id })}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[13px] text-foreground">{version.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.bg} ${status.text}`}>
            {status.label}
          </span>
          <button className="p-0.5 hover:bg-[#1a1a1a] rounded">
            <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {version.description && (
        <p className="text-[11px] text-muted-foreground mb-2 pl-5.5">
          {version.description}
        </p>
      )}

      <div className="flex items-center justify-between pl-5.5">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            {formatTimeAgo(version.timestamp)}
          </span>
        </div>

        {version.agentTarget && (
          <span className="text-[10px] text-[#7928ca] flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            {version.agentTarget}
          </span>
        )}
      </div>

      {/* Actions */}
      {isActive && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-[#1a1a1a]">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#0070f3] text-white rounded text-[11px] hover:bg-[#0070f3]/90 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              const ide = state.ides.find((i) => i.status === "connected");
              if (ide) {
                dispatch({ type: "SEND_TO_IDE", versionId: version.id, ideId: ide.id });
              }
            }}
          >
            <Send className="w-3 h-3" />
            Send to IDE
          </button>
          <button
            className="p-1.5 border border-[#1a1a1a] rounded hover:bg-[#1a1a1a] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Copy className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}

export function VersionManager() {
  const { state, dispatch } = useWorkspace();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const createVersion = () => {
    if (!newName.trim()) return;
    const version: DesignVersion = {
      id: `v${Date.now()}`,
      name: newName,
      timestamp: Date.now(),
      changes: [...state.styleChanges],
      status: "draft",
      description: `${state.styleChanges.length} style changes captured`,
    };
    dispatch({ type: "ADD_VERSION", version });
    setNewName("");
    setShowNew(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px] text-foreground">Versions</span>
          <span className="text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded">
            {state.versions.length}
          </span>
        </div>
        <button
          className="p-1 hover:bg-[#1a1a1a] rounded transition-colors"
          onClick={() => setShowNew(!showNew)}
        >
          <Plus className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* New version form */}
      {showNew && (
        <div className="p-3 border-b border-border">
          <input
            autoFocus
            placeholder="Version name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createVersion();
              if (e.key === "Escape") setShowNew(false);
            }}
            className="w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#0070f3] mb-2"
          />
          <div className="flex gap-2">
            <button
              className="flex-1 py-1.5 bg-foreground text-background rounded text-[11px] hover:opacity-90"
              onClick={createVersion}
            >
              Save Version
            </button>
            <button
              className="px-3 py-1.5 border border-border rounded text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowNew(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Version list */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {state.versions
            .slice()
            .sort((a, b) => b.timestamp - a.timestamp)
            .map((version) => (
              <VersionCard key={version.id} version={version} />
            ))}
        </div>
      </ScrollArea>

      {/* Pending changes */}
      {state.styleChanges.length > 0 && (
        <div className="p-3 border-t border-border bg-[#0a0a0a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-foreground">Unsaved Changes</span>
            <span className="text-[10px] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.5 rounded">
              {state.styleChanges.length}
            </span>
          </div>
          <button
            className="w-full py-1.5 border border-dashed border-[#333333] rounded text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
            onClick={() => setShowNew(true)}
          >
            + Save as Version
          </button>
        </div>
      )}
    </div>
  );
}