// ============================================================
// StatusBar — 22px bottom bar.
//
// Cursor/VSCode pattern. Slim, dense, always visible.
//   Left:  git branch, agent status, ACP connection
//   Right: problems count, project URL
//
// Uses semantic tokens only. Items are purely informational
// here in v0; click-targets will be added feature-by-feature.
// ============================================================
import React from "react";
import { GitBranch, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useWorkspace } from "../0canvas/store/store";
import { StatusDot } from "../0canvas/ui";

export function StatusBar() {
  const { state } = useWorkspace();
  const project = state.project;
  const connection = project?.status ?? "disconnected";
  const dot =
    connection === "connected"
      ? "success"
      : connection === "connecting"
      ? "connecting"
      : connection === "error"
      ? "critical"
      : "default";
  const connLabel =
    connection === "connected"
      ? "Connected"
      : connection === "connecting"
      ? "Connecting"
      : connection === "error"
      ? "Error"
      : "Idle";

  const chats = state.chats ?? [];
  const activeChat = chats.find((c) => c.id === state.activeChatId);
  const branch = (activeChat as any)?.branch ?? "";

  return (
    <footer className="oc-statusbar" role="status">
      <div className="oc-statusbar__group">
        {branch ? (
          <span className="oc-statusbar__item">
            <GitBranch size={12} />
            {branch}
          </span>
        ) : null}
        <span className="oc-statusbar__item">
          <StatusDot status={dot as any} />
          {connLabel}
        </span>
      </div>
      <div className="oc-statusbar__group">
        {project?.devServerUrl ? (
          <span className="oc-statusbar__item oc-statusbar__item--muted">
            {connection === "connecting" ? (
              <Loader2 size={12} className="oc-spin" />
            ) : connection === "connected" ? (
              <Wifi size={12} />
            ) : (
              <WifiOff size={12} />
            )}
            {project.devServerUrl}
          </span>
        ) : null}
      </div>
    </footer>
  );
}
