import React, { useState } from "react";
import {
  Zap,
  Copy,
  Check,
} from "lucide-react";
import { useWorkspace, IDEConnection } from "../store/store";
import { copyToClipboard } from "../utils/clipboard";

function IDECard({ ide }: { ide: IDEConnection }) {
  return (
    <div className="oc-agent-ide-card">
      <div className="oc-agent-card-header">
        <div className="oc-agent-card-info">
          <div className="oc-agent-card-icon" style={{ background: ide.color }}>
            {ide.icon}
          </div>
          <div>
            <div className="oc-agent-card-name">{ide.name}</div>
            <div className="oc-agent-card-desc">{ide.description}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentPanel() {
  const { state } = useWorkspace();

  return (
    <div className="oc-panel">
      <div className="oc-panel-header">
        <div className="oc-agent-card-info">
          <Zap size={16} />
          <span>Supported IDEs</span>
        </div>
      </div>

      <div className="oc-panel-body" style={{ padding: 12 }}>
        {state.ides.map((ide) => <IDECard key={ide.id} ide={ide} />)}

        <div className="oc-agent-setup-card" style={{ marginTop: 12 }}>
          <div className="oc-agent-setup-hint">
            Use the Send button in the waitlist to copy feedback to your clipboard, then paste it into your AI agent chat.
          </div>
        </div>
      </div>
    </div>
  );
}
