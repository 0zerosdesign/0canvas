// ──────────────────────────────────────────────────────────
// Live Canvas — Preview iframe + DOM inspection
// ──────────────────────────────────────────────────────────
//
// Two modes:
//
// 1. IFRAME MODE (useIframePreview=true) — npm package
//    Loads the consumer's app inside an iframe. Inspects
//    elements within the iframe's DOM.
//
// 2. DIRECT MODE (useIframePreview=false) — local dev
//    Inspects the current page DOM directly (no iframe).
//    Shows instructions in the center.
//
// ──────────────────────────────────────────────────────────

import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  MousePointer2,
  RefreshCw,
  Copy,
  Check,
  Crosshair,
  Zap,
  Eye,
  Loader2,
  Monitor,
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
  setInspectionTarget,
  resetInspectionTarget,
} from "./dom-inspector";
import { copyToClipboard } from "./clipboard";

interface LiveCanvasProps {
  /** When true, loads the consumer's app in an iframe for preview.
   *  When false (default), uses direct DOM inspection (dev mode). */
  useIframePreview?: boolean;
  /** Mutable ref for programmatic route navigation from the toolbar. */
  onNavigateRef?: React.MutableRefObject<((route: string) => void) | null>;
}

export function LiveCanvas({ useIframePreview = false, onNavigateRef }: LiveCanvasProps) {
  const { state, dispatch } = useWorkspace();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [inspecting, setInspecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elementCount, setElementCount] = useState(0);
  const [lastScan, setLastScan] = useState<number>(0);
  const [iframeLoaded, setIframeLoaded] = useState(!useIframePreview);
  const [iframeError, setIframeError] = useState(false);
  const hasScannedRef = useRef(false);

  // ── Build iframe src — same URL ─────────────────────────
  const iframeSrc = typeof window !== "undefined" ? window.location.href : "";

  // ── Route navigation via ref callback ──────────────────
  useEffect(() => {
    if (!onNavigateRef || !useIframePreview) return;
    onNavigateRef.current = (route: string) => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const baseUrl = new URL(window.location.origin);
        const targetUrl = new URL(route, baseUrl);
        iframe.src = targetUrl.href;
        setIframeLoaded(false);
        setIframeError(false);
        hasScannedRef.current = false;

        dispatch({ type: "SET_CURRENT_ROUTE", route });
        dispatch({ type: "ADD_ROUTE_HISTORY", route });
      } catch (err) {
        console.warn("[DesignDead] Invalid route:", route, err);
      }
    };
    return () => {
      if (onNavigateRef) onNavigateRef.current = null;
    };
  }, [onNavigateRef, useIframePreview, dispatch]);

  // ── Detect route changes from iframe navigation ─────────
  useEffect(() => {
    if (!useIframePreview || !iframeLoaded) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const checkRoute = () => {
      try {
        const iframePath = iframe.contentWindow?.location.pathname;
        if (iframePath && iframePath !== state.currentRoute) {
          dispatch({ type: "SET_CURRENT_ROUTE", route: iframePath });
          dispatch({ type: "ADD_ROUTE_HISTORY", route: iframePath });
        }
      } catch { /* cross-origin */ }
    };

    const interval = setInterval(checkRoute, 2000);
    return () => clearInterval(interval);
  }, [useIframePreview, iframeLoaded, state.currentRoute, dispatch]);

  // ── Handle iframe load (iframe mode only) ───────────────
  const handleIframeLoad = useCallback(() => {
    if (!useIframePreview) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const contentDoc = iframe.contentDocument;
      if (!contentDoc || !contentDoc.body) {
        setIframeError(true);
        return;
      }

      // Set the inspector to target the iframe's document
      setInspectionTarget(contentDoc, iframe);
      setIframeLoaded(true);
      setIframeError(false);

      // Auto-scan the iframe's DOM
      const tree = buildElementTree();
      rebuildElementMap();
      dispatch({ type: "SET_ELEMENTS", elements: tree });
      setElementCount(countNodes(tree));
      setLastScan(Date.now());
      hasScannedRef.current = true;
    } catch (err) {
      console.warn("[DesignDead] Cannot access iframe content:", err);
      setIframeError(true);
    }
  }, [dispatch, useIframePreview]);

  // ── Scan DOM (works for both modes) ─────────────────────
  const scanDOM = useCallback(() => {
    if (useIframePreview) {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentDocument) return;
      setInspectionTarget(iframe.contentDocument, iframe);
    } else {
      resetInspectionTarget();
    }

    const tree = buildElementTree();
    rebuildElementMap();
    dispatch({ type: "SET_ELEMENTS", elements: tree });
    setElementCount(countNodes(tree));
    setLastScan(Date.now());
  }, [dispatch, useIframePreview]);

  // ── Auto-scan on mount (direct mode only) ───────────────
  useEffect(() => {
    if (!useIframePreview && !hasScannedRef.current) {
      hasScannedRef.current = true;
      const timer = setTimeout(scanDOM, 300);
      return () => clearTimeout(timer);
    }
  }, [scanDOM, useIframePreview]);

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
      // Ensure correct inspection target
      if (useIframePreview) {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentDocument) {
          setInspectionTarget(iframe.contentDocument, iframe);
          rebuildElementMap();
        }
      } else {
        resetInspectionTarget();
        rebuildElementMap();
      }

      startInspect((id, el) => {
        dispatch({ type: "SELECT_ELEMENT", id, source: "inspect" });

        // Get computed styles for the style panel
        const doc = useIframePreview
          ? iframeRef.current?.contentDocument || document
          : document;
        const win = doc.defaultView || window;
        const computed = win.getComputedStyle(el);
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

        stopInspect();
        setInspecting(false);
      });
      setInspecting(true);
    }
  }, [dispatch, useIframePreview]);

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

  // ── Ready to interact? ──────────────────────────────────
  const isReady = useIframePreview ? iframeLoaded : true;

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] relative">
      {/* Canvas toolbar */}
      <div className="h-9 border-b border-border bg-[#0a0a0a] flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          {/* Inspect toggle */}
          <button
            onClick={toggleInspect}
            disabled={!isReady}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-all ${
              inspecting
                ? "bg-[#0070f3] text-white"
                : "bg-[#111111] border border-[#1a1a1a] text-muted-foreground hover:text-foreground hover:border-[#333333]"
            } ${!isReady ? "opacity-50" : ""}`}
          >
            <Crosshair className="w-3 h-3" />
            {inspecting ? "Inspecting..." : "Inspect"}
            <kbd className="text-[9px] opacity-50 ml-1">I</kbd>
          </button>

          {/* Rescan */}
          <button
            onClick={scanDOM}
            disabled={!isReady}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] bg-[#111111] border border-[#1a1a1a] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-all ${!isReady ? "opacity-50" : ""}`}
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

          {/* Mode badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#50e3c2]/10 border border-[#50e3c2]/20">
            <Zap className="w-2.5 h-2.5 text-[#50e3c2]" />
            <span className="text-[9px] text-[#50e3c2]">
              {useIframePreview ? "Live Preview" : "Engine Mode"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main canvas area ──────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden bg-[#111111]">

        {/* ========== IFRAME PREVIEW MODE ========== */}
        {useIframePreview && (
          <>
            {/* Loading state */}
            {!iframeLoaded && !iframeError && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center z-20"
                style={{ background: "#0a0a0a" }}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#111111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-5 h-5 text-[#0070f3] animate-spin" />
                </div>
                <p className="text-[13px] text-foreground mb-1">Loading preview...</p>
                <p className="text-[11px] text-muted-foreground">
                  Rendering your application in the preview panel
                </p>
              </div>
            )}

            {/* Error state */}
            {iframeError && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center z-20"
                style={{ background: "#0a0a0a" }}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#ff4444]/10 border border-[#ff4444]/20 flex items-center justify-center mx-auto mb-4">
                  <Monitor className="w-5 h-5 text-[#ff4444]" />
                </div>
                <p className="text-[13px] text-foreground mb-1">Preview unavailable</p>
                <p className="text-[11px] text-muted-foreground mb-4" style={{ maxWidth: 300, textAlign: "center", lineHeight: "1.6" }}>
                  Cannot access the preview frame. This may happen with cross-origin restrictions.
                </p>
                <button
                  onClick={() => {
                    setIframeError(false);
                    setIframeLoaded(false);
                    if (iframeRef.current) {
                      iframeRef.current.src = iframeSrc;
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            )}

            {/* The iframe — loads consumer's app */}
            <iframe
              ref={iframeRef}
              name="designdead-preview"
              src={iframeSrc}
              onLoad={handleIframeLoad}
              title="DesignDead Preview"
              data-designdead="preview-iframe"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
                background: "#ffffff",
              }}
            />
          </>
        )}

        {/* ========== DIRECT INSPECTION MODE ========== */}
        {!useIframePreview && (
          <div className="flex-1 flex items-center justify-center" style={{ height: "100%" }}>
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
        )}

        {/* Inspection overlay hint (iframe mode) */}
        {useIframePreview && inspecting && (
          <div
            style={{
              position: "absolute",
              top: "0.75rem",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 30,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.375rem 0.75rem",
                borderRadius: "0.5rem",
                background: "#0070f3",
                color: "#ffffff",
                fontSize: "11px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                fontFamily: "'Geist Sans', 'Inter', sans-serif",
              }}
            >
              <Crosshair style={{ width: 12, height: 12 }} />
              Click any element in the preview to inspect
            </div>
          </div>
        )}
      </div>

      {/* Bottom status */}
      <div className="h-6 border-t border-border bg-[#0a0a0a] flex items-center justify-between px-3">
        <span className="text-[9px] text-[#444444]">
          {useIframePreview
            ? iframeLoaded
              ? elementCount > 0
                ? `DOM: ${elementCount} elements scanned`
                : "Preview loaded — click Inspect to start"
              : "Loading preview..."
            : elementCount > 0
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
