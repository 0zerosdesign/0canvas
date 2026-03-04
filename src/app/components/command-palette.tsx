import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Layers,
  Palette,
  Zap,
  Lightbulb,
  GitBranch,
  MousePointer2,
  Send,
  Copy,
  FileCode,
  PenTool,
} from "lucide-react";
import { useWorkspace } from "../store";

type CommandItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: string;
};

export function CommandPalette() {
  const { state, dispatch } = useWorkspace();
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch]);

  const commands: CommandItem[] = [
    {
      id: "toggle-layers",
      label: "Toggle Layers Panel",
      description: "Show or hide the layers panel",
      icon: <Layers className="w-4 h-4" />,
      shortcut: "L",
      action: () => {
        dispatch({ type: "TOGGLE_LAYERS_PANEL" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels",
    },
    {
      id: "toggle-styles",
      label: "Toggle Style Panel",
      description: "Show or hide the style panel",
      icon: <Palette className="w-4 h-4" />,
      shortcut: "S",
      action: () => {
        dispatch({ type: "TOGGLE_STYLE_PANEL" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels",
    },
    {
      id: "toggle-agents",
      label: "Toggle IDE Panel",
      description: "Show or hide the IDE & agents panel",
      icon: <Zap className="w-4 h-4" />,
      shortcut: "A",
      action: () => {
        dispatch({ type: "TOGGLE_IDE_PANEL" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels",
    },
    {
      id: "toggle-brainstorm",
      label: "Toggle Brainstorm Mode",
      description: "Open the brainstorming panel",
      icon: <Lightbulb className="w-4 h-4" />,
      shortcut: "B",
      action: () => {
        dispatch({ type: "TOGGLE_BRAINSTORM" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels",
    },
    {
      id: "toggle-inspector",
      label: "Toggle Inspector",
      description: "Enable or disable element inspector",
      icon: <MousePointer2 className="w-4 h-4" />,
      shortcut: "I",
      action: () => {
        dispatch({ type: "TOGGLE_INSPECTOR" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Tools",
    },
    {
      id: "toggle-file-map",
      label: "Toggle File Map",
      description: "Show or hide file-to-element mappings",
      icon: <FileCode className="w-4 h-4" />,
      shortcut: "F",
      action: () => {
        dispatch({ type: "TOGGLE_FILE_MAP_PANEL" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels",
    },
    {
      id: "toggle-annotations",
      label: "Toggle Annotation Mode",
      description: "Draw annotations on the preview",
      icon: <PenTool className="w-4 h-4" />,
      shortcut: "D",
      action: () => {
        dispatch({ type: "TOGGLE_ANNOTATION_MODE" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Tools",
    },
    {
      id: "clear-annotations",
      label: "Clear All Annotations",
      description: "Remove all drawn annotations",
      icon: <PenTool className="w-4 h-4" />,
      action: () => {
        dispatch({ type: "CLEAR_ANNOTATIONS" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Actions",
    },
    {
      id: "send-to-ide",
      label: "Send to IDE",
      description: "Send current changes to connected IDE",
      icon: <Send className="w-4 h-4" />,
      action: () => {
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Actions",
    },
    {
      id: "save-version",
      label: "Save Version",
      description: "Save current state as a new version",
      icon: <GitBranch className="w-4 h-4" />,
      shortcut: "V",
      action: () => {
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Actions",
    },
    {
      id: "copy-css",
      label: "Copy All CSS Changes",
      description: "Copy all pending CSS changes to clipboard",
      icon: <Copy className="w-4 h-4" />,
      action: () => {
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Actions",
    },
  ];

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, CommandItem[]>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm"
      onClick={() => dispatch({ type: "TOGGLE_COMMAND_PALETTE" })}
    >
      <div
        className="w-[520px] bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center px-4 py-3 border-b border-[#1a1a1a]">
          <Search className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            style={{ fontSize: "14px" }}
          />
          <kbd className="text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#222222]">
            ESC
          </kbd>
        </div>

        {/* Commands */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-1.5">
                <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
                  {category}
                </span>
              </div>
              {cmds.map((cmd) => (
                <button
                  key={cmd.id}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#1a1a1a] transition-colors"
                  onClick={cmd.action}
                >
                  <span className="text-muted-foreground">{cmd.icon}</span>
                  <div className="flex-1 text-left">
                    <span className="text-[13px] text-foreground block">
                      {cmd.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {cmd.description}
                    </span>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="text-[10px] text-muted-foreground bg-[#111111] px-1.5 py-0.5 rounded border border-[#1a1a1a]">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}