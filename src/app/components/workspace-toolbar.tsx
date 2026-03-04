import React, { useState, useRef, useEffect } from "react";
import {
  Layers,
  Palette,
  Zap,
  Lightbulb,
  MousePointer2,
  Command,
  Monitor,
  Tablet,
  Smartphone,
  LogOut,
  FileCode,
  PenTool,
  Wifi,
  ListChecks,
  Globe,
  ChevronDown,
} from "lucide-react";
import { useWorkspace } from "../store";

interface WorkspaceToolbarProps {
  onNavigate?: (route: string) => void;
}

export function WorkspaceToolbar({ onNavigate }: WorkspaceToolbarProps = {}) {
  const { state, dispatch } = useWorkspace();

  const connectedIDEs = state.ides.filter((i) => i.status === "connected").length;
  const projectName = state.project?.name || "Untitled";
  const framework = state.project?.framework || "";
  const annotationCount = state.annotations.length;
  const pendingFeedback = state.feedbackItems.filter((f) => f.status === "pending").length;

  return (
    <div className="h-12 border-b border-border bg-[#0a0a0a] flex items-center justify-between px-3">
      {/* Left: Logo + Project */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-background"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-[13px] text-foreground tracking-tight">designdead</span>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Project indicator */}
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#111111] border border-[#1a1a1a]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              state.project?.status === "connected"
                ? "bg-[#50e3c2]"
                : "bg-[#444444]"
            }`}
          />
          <span className="text-[12px] text-foreground max-w-[140px] truncate">
            {projectName}
          </span>
          {framework && (
            <span className="text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded">
              {framework}
            </span>
          )}
        </div>

        {/* WS status indicator */}
        {state.wsStatus === "connected" && (
          <span className="flex items-center gap-1 text-[10px] text-[#50e3c2] bg-[#50e3c2]/10 px-1.5 py-0.5 rounded">
            <Wifi className="w-3 h-3" />
            MCP
          </span>
        )}

        {/* Route switcher */}
        <RouteSwitcher
          currentRoute={state.currentRoute}
          routeHistory={state.routeHistory}
          onNavigate={(route) => {
            dispatch({ type: "SET_CURRENT_ROUTE", route });
            dispatch({ type: "ADD_ROUTE_HISTORY", route });
            onNavigate?.(route);
          }}
        />
      </div>

      {/* Center: Panel toggles */}
      <div className="flex items-center gap-1 bg-[#111111] rounded-lg p-0.5 border border-[#1a1a1a]">
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${
            state.layersPanelOpen
              ? "bg-[#1a1a1a] text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => dispatch({ type: "TOGGLE_LAYERS_PANEL" })}
          title="Layers Panel"
        >
          <Layers className="w-3.5 h-3.5" />
          Layers
        </button>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${
            state.inspectorMode
              ? "bg-[#0070f3]/15 text-[#0070f3]"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => dispatch({ type: "TOGGLE_INSPECTOR" })}
          title="Inspector Mode"
        >
          <MousePointer2 className="w-3.5 h-3.5" />
          Inspect
        </button>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${
            state.stylePanelOpen
              ? "bg-[#1a1a1a] text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => dispatch({ type: "TOGGLE_STYLE_PANEL" })}
          title="Style Panel"
        >
          <Palette className="w-3.5 h-3.5" />
          Style
        </button>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${
            state.fileMapPanelOpen
              ? "bg-[#0070f3]/15 text-[#0070f3]"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => dispatch({ type: "TOGGLE_FILE_MAP_PANEL" })}
          title="File Map"
        >
          <FileCode className="w-3.5 h-3.5" />
          Files
        </button>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${
            state.annotationMode
              ? "bg-[#ff0080]/15 text-[#ff0080]"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => dispatch({ type: "TOGGLE_ANNOTATION_MODE" })}
          title="Annotation Mode"
        >
          <PenTool className="w-3.5 h-3.5" />
          Annotate
          {annotationCount > 0 && (
            <span className="text-[9px] bg-[#ff0080]/20 text-[#ff0080] px-1 rounded">
              {annotationCount}
            </span>
          )}
        </button>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${
            state.idePanelOpen
              ? "bg-[#f5a623]/15 text-[#f5a623]"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => dispatch({ type: "TOGGLE_IDE_PANEL" })}
          title="IDE & Agents"
        >
          <Zap className="w-3.5 h-3.5" />
          IDE
          {connectedIDEs > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#50e3c2]" />
          )}
        </button>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${
            state.brainstormMode
              ? "bg-[#7928ca]/15 text-[#7928ca]"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => dispatch({ type: "TOGGLE_BRAINSTORM" })}
          title="Brainstorm"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Ideas
        </button>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${
            state.waitlistOpen
              ? "bg-[#50e3c2]/15 text-[#50e3c2]"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => dispatch({ type: "SET_WAITLIST_OPEN", open: !state.waitlistOpen })}
          title="Agent Waitlist"
        >
          <ListChecks className="w-3.5 h-3.5" />
          Waitlist
          {pendingFeedback > 0 && (
            <span className="text-[9px] bg-[#50e3c2]/20 text-[#50e3c2] px-1 rounded">
              {pendingFeedback}
            </span>
          )}
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Viewport controls */}
        <div className="flex items-center gap-0.5 bg-[#111111] rounded p-0.5 border border-[#1a1a1a]">
          <button className="p-1 rounded bg-[#1a1a1a] text-foreground">
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded text-muted-foreground hover:text-foreground">
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded text-muted-foreground hover:text-foreground">
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Command palette */}
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#222222] hover:border-[#333333] transition-colors"
          onClick={() => dispatch({ type: "TOGGLE_COMMAND_PALETTE" })}
        >
          <Command className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">K</span>
        </button>
      </div>
    </div>
  );
}

function RouteSwitcher({
  currentRoute,
  routeHistory,
  onNavigate,
}: {
  currentRoute: string;
  routeHistory: string[];
  onNavigate: (route: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customRoute, setCustomRoute] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleGo = () => {
    const route = customRoute.trim();
    if (!route) return;
    onNavigate(route.startsWith("/") ? route : `/${route}`);
    setCustomRoute("");
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] bg-[#111111] border border-[#1a1a1a] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-colors"
        title="Switch route"
      >
        <Globe className="w-3 h-3" />
        <span className="max-w-[100px] truncate">{currentRoute}</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-50" />
      </button>

      {open && (
        <div
          data-designdead="route-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            width: 220,
            background: "#0a0a0a",
            border: "1px solid #1a1a1a",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 100,
            overflow: "hidden",
            fontFamily: "'Geist Sans', 'Inter', system-ui, sans-serif",
          }}
        >
          <div style={{ padding: "6px 8px", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                value={customRoute}
                onChange={(e) => setCustomRoute(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGo()}
                placeholder="/path..."
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  background: "#111",
                  border: "1px solid #1a1a1a",
                  borderRadius: 5,
                  color: "#ededed",
                  fontSize: 11,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <button
                onClick={handleGo}
                style={{
                  padding: "4px 10px",
                  background: "#0070f3",
                  border: "none",
                  borderRadius: 5,
                  color: "#fff",
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Go
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {routeHistory.map((route) => (
              <button
                key={route}
                onClick={() => {
                  onNavigate(route);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "6px 12px",
                  background: route === currentRoute ? "#0070f3" + "12" : "transparent",
                  border: "none",
                  borderLeft: route === currentRoute ? "2px solid #0070f3" : "2px solid transparent",
                  color: route === currentRoute ? "#0070f3" : "#888",
                  fontSize: 11,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "'Geist Mono', 'SF Mono', monospace",
                }}
              >
                {route}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}