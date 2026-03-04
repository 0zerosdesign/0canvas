// ──────────────────────────────────────────────────────────
// Live Canvas — Direct DOM inspection (replaces iframe preview)
// ──────────────────────────────────────────────────────────
//
// Instead of loading a dev server in an iframe through a proxy,
// this component inspects the current page DOM directly using
// the dom-inspector module. It provides:
//   - Click-to-inspect overlay
//   - Hover highlighting
//   - Element selection sync with layers/style panels
//   - Live style application
//
// This is the engine-mode replacement for preview-canvas.tsx.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  MousePointer2,
  RefreshCw,
  Copy,
  Check,
  Crosshair,
  Zap,
  Info,
  Eye,
  Pause,
  Play,
} from "lucide-react";
import { useWorkspace } from "../store";
import {
  buildElementTree,
  rebuildElementMap,
  getElementById,
  highlightElement,
  applyStyle,
  startInspect,
  stopInspect,
  isInspecting,
  generateAgentOutput,
  cleanup,
} from "./dom-inspector";
import { copyToClipboard } from "./clipboard";

export function LiveCanvas() {
  const { state, dispatch } = useWorkspace();
  const [inspecting, setInspecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elementCount, setElementCount] = useState(0);
  const [lastScan, setLastScan] = useState<number>(0);
  const hasScannedRef = useRef(false);

  // ── Initial DOM scan ─────────────────────────────────────
  const scanDOM = useCallback(() => {
    const tree = buildElementTree();
    rebuildElementMap();
    dispatch({ type: "SET_ELEMENTS", elements: tree });
    setElementCount(countNodes(tree));
    setLastScan(Date.now());
  }, [dispatch]);

  // Auto-scan on mount
  useEffect(() => {
    if (!hasScannedRef.current) {
      hasScannedRef.current = true;
      // Small delay to let the page render first
      const timer = setTimeout(scanDOM, 300);
      return () => clearTimeout(timer);
    }
  }, [scanDOM]);

  // ── Sync hover highlight with store ──────────────────────
  useEffect(() => {
    if (state.hoveredElementId) {
      highlightElement(state.hoveredElementId, "hover");
    } else {
      highlightElement(null, "hover");
    }
  }, [state.hoveredElementId]);

  // ── Sync selection highlight with store ──────────────────
  useEffect(() => {
    if (state.selectedElementId) {
      highlightElement(state.selectedElementId, "select");
    } else {
      highlightElement(null, "select");
    }
  }, [state.selectedElementId]);

  // ── Toggle inspect mode ──────────────────────────────────
  const toggleInspect = useCallback(() => {
    if (isInspecting()) {
      stopInspect();
      setInspecting(false);
    } else {
      startInspect((id, el) => {
        dispatch({ type: "SELECT_ELEMENT", id });

        // Get computed styles for the style panel
        const computed = window.getComputedStyle(el);
        const styles: Record<string, string> = {};
        const props = [
          "color", "backgroundColor", "fontSize", "fontFamily", "fontWeight",
          "lineHeight", "letterSpacing", "textAlign", "padding", "paddingTop",
          "paddingRight", "paddingBottom", "paddingLeft", "margin", "marginTop",
          "marginRight", "marginBottom", "marginLeft", "width", "height",
          "maxWidth", "maxHeight", "minWidth", "minHeight", "display",
          "flexDirection", "alignItems", "justifyContent", "gap", "position",
          "top", "right", "bottom", "left", "zIndex", "overflow", "opacity",
          "borderRadius", "border", "borderColor", "borderWidth", "boxShadow",
          "transform", "transition", "gridTemplateColumns",
        ];
        for (const prop of props) {
          const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
          const val = computed.getPropertyValue(cssProp);
          if (val && val !== "none" && val !== "normal" && val !== "auto") {
            styles[prop] = val;
          }
        }
        dispatch({ type: "SET_ELEMENT_STYLES", id, styles });

        // Stop inspect after selection
        stopInspect();
        setInspecting(false);
      });
      setInspecting(true);
    }
  }, [dispatch]);

  // ── Keyboard shortcut: I for inspect ─────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        toggleInspect();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleInspect]);

  // ── Copy agent output ────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (!state.selectedElementId) return;
    const output = generateAgentOutput(state.selectedElementId);
    copyToClipboard(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [state.selectedElementId]);

  // ── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      stopInspect();
      cleanup();
    };
  }, []);

  const timeSinceScan = lastScan
    ? Math.round((Date.now() - lastScan) / 1000)
    : null;

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] relative">
      {/* Canvas toolbar */}
      <div className="h-9 border-b border-border bg-[#0a0a0a] flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          {/* Inspect toggle */}
          <button
            onClick={toggleInspect}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-all ${
              inspecting
                ? "bg-[#0070f3] text-white"
                : "bg-[#111111] border border-[#1a1a1a] text-muted-foreground hover:text-foreground hover:border-[#333333]"
            }`}
          >
            <Crosshair className="w-3 h-3" />
            {inspecting ? "Inspecting..." : "Inspect"}
            <kbd className="text-[9px] opacity-50 ml-1">I</kbd>
          </button>

          {/* Rescan */}
          <button
            onClick={scanDOM}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] bg-[#111111] border border-[#1a1a1a] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Rescan
          </button>

          {/* Element count */}
          <span className="text-[10px] text-[#444444]">
            {elementCount > 0 ? `${elementCount} elements` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy agent output */}
          {state.selectedElementId && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-[#0070f3]/10 border border-[#0070f3]/20 text-[#0070f3] hover:bg-[#0070f3]/20 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy for Agent
                </>
              )}
            </button>
          )}

          {/* Engine badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#50e3c2]/10 border border-[#50e3c2]/20">
            <Zap className="w-2.5 h-2.5 text-[#50e3c2]" />
            <span className="text-[9px] text-[#50e3c2]">Engine Mode</span>
          </div>
        </div>
      </div>

      {/* Main canvas area — shows instructions/status */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-[360px] px-4">
          {inspecting ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-[#0070f3]/10 border border-[#0070f3]/20 flex items-center justify-center mx-auto mb-4">
                <Crosshair className="w-5 h-5 text-[#0070f3] animate-pulse" />
              </div>
              <h3 className="text-[15px] text-foreground mb-2">
                Click any element on the page
              </h3>
              <p className="text-[12px] text-muted-foreground" style={{ lineHeight: "1.6" }}>
                Hover to preview, click to select. The element's styles and
                selector will appear in the panels.
              </p>
              <button
                onClick={toggleInspect}
                className="mt-4 text-[11px] text-[#0070f3] hover:underline"
              >
                Cancel inspection
              </button>
            </>
          ) : state.selectedElementId ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-[#50e3c2]/10 border border-[#50e3c2]/20 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-5 h-5 text-[#50e3c2]" />
              </div>
              <h3 className="text-[15px] text-foreground mb-2">
                Element selected
              </h3>
              <p className="text-[12px] text-muted-foreground mb-1">
                View and edit styles in the Style panel (right).
              </p>
              <p className="text-[12px] text-muted-foreground mb-4">
                Browse the DOM tree in the Layers panel (left).
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={toggleInspect}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  <Crosshair className="w-3 h-3" />
                  Inspect another
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border border-[#1a1a1a] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-all"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy for Agent"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-[#111111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
                <MousePointer2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-[15px] text-foreground mb-2">
                Ready to inspect
              </h3>
              <p className="text-[12px] text-muted-foreground mb-1" style={{ lineHeight: "1.6" }}>
                DesignDead is running in engine mode. Click{" "}
                <strong>Inspect</strong> or press{" "}
                <kbd className="px-1 py-0.5 bg-[#111111] border border-[#1a1a1a] rounded text-[10px]">
                  I
                </kbd>{" "}
                to start selecting elements on the page.
              </p>
              <p className="text-[11px] text-[#444444] mt-3" style={{ lineHeight: "1.6" }}>
                The layers panel shows the DOM tree. Select any element to view
                and edit its styles. Copy structured output for your AI agent.
              </p>
              <button
                onClick={toggleInspect}
                className="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] bg-foreground text-background hover:opacity-90 transition-opacity mx-auto"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Start inspecting
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom status */}
      <div className="h-6 border-t border-border bg-[#0a0a0a] flex items-center justify-between px-3">
        <span className="text-[9px] text-[#444444]">
          {elementCount > 0
            ? `DOM: ${elementCount} elements scanned`
            : "No elements scanned yet"}
        </span>
        <span className="text-[9px] text-[#444444]">
          {lastScan > 0 && `Last scan: ${new Date(lastScan).toLocaleTimeString()}`}
        </span>
      </div>
    </div>
  );
}

function countNodes(nodes: any[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children) count += countNodes(node.children);
  }
  return count;
}