import React, { useState } from "react";
import { Zap, ChevronRight } from "lucide-react";
import { useWorkspace } from "../store/store";
import { AgentPanel } from "./agent-panel";
import { ScrollArea } from "../ui/scroll-area";

type SettingsSection = "ide-agents";

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: "ide-agents", label: "IDE & Agents", icon: <Zap size={16} /> },
];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("ide-agents");

  return (
    <div className="oc-settings-page">
      {/* Left: settings nav */}
      <div className="oc-settings-nav">
        <div className="oc-settings-nav-header">Settings</div>
        <div className="oc-settings-nav-list">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`oc-settings-nav-item ${activeSection === section.id ? "is-active" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="oc-settings-nav-icon">{section.icon}</span>
              <span className="oc-settings-nav-label">{section.label}</span>
              <ChevronRight size={14} className="oc-settings-nav-chevron" />
            </button>
          ))}
        </div>
      </div>

      {/* Right: settings content */}
      <div className="oc-settings-content">
        <ScrollArea className="oc-settings-scroll">
          {activeSection === "ide-agents" && <AgentPanel />}
        </ScrollArea>
      </div>
    </div>
  );
}
