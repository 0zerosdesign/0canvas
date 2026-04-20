// ──────────────────────────────────────────────────────────
// Source Node — Resizable viewport for main app preview
// ──────────────────────────────────────────────────────────

import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import {
  MessageCircle,
  Send,
  Check,
  RefreshCw,
  GitFork,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
} from "lucide-react";
import { useWorkspace, type FeedbackItem } from "../store/store";
import { copyToClipboard } from "../utils/clipboard";
import {
  buildElementTree,
  rebuildElementMap,
  getElementById,
  setInspectionTarget,
  startInspect,
  stopInspect,
  isInspecting,
  highlightElement,
  onForkElementRequest,
  onChangeRequest,
  onDeleteFeedbackRequest,
  setFeedbackLookup,
  renderFeedbackMarkers,
  setInspectMode,
  setThemeTokensProvider,
  setThemeChangesProvider,
  onThemeChangeRequest,
  onThemeResetRequest,
  renderThemeChangeMarkers,
  clearThemeChangeMarkers,
} from "../inspector";

export type SourceNodeData = {
  label: string;
  onForkPage: (viewportWidth: number) => void;
  onForkComponent: (elementId: string, viewportWidth: number) => void;
};

// ── Viewport presets ───────────────────────────────────────

const PRESETS = [
  { label: "Desktop", width: 1440, icon: Monitor },
  { label: "Laptop", width: 1280, icon: Laptop },
  { label: "Tablet", width: 768, icon: Tablet },
  { label: "Mobile", width: 375, icon: Smartphone },
];

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 300;
const CHROME_HEIGHT = 40;
const HANDLE_GAP = 8; // gap around card for resize grab zones

export function SourceNode({ id, data, selected }: NodeProps) {
  const { label, onForkPage, onForkComponent } = data as SourceNodeData;
  const { state, dispatch } = useWorkspace();
  const { updateNode, getZoom } = useReactFlow();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [elementCount, setElementCount] = useState(0);
  const [dims, setDims] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("Laptop");

  // Prefer the project's configured dev-server URL. Fall back to
  // window.location.href only if it clearly isn't pointing at 0canvas
  // itself (npm-overlay legacy mode — 0canvas was injected into the host
  // app, so the host URL was the right preview target). In the Mac app
  // the webview's own origin IS 0canvas, so recursing into an iframe of
  // ourselves is never correct.
  const iframeSrc = (() => {
    const projectUrl = state.project?.devServerUrl;
    if (projectUrl && projectUrl.length > 0) return projectUrl;
    if (typeof window === "undefined") return "";
    const isMacApp = "__TAURI_INTERNALS__" in window;
    if (isMacApp) return "";
    return window.location.href;
  })();

  // ── Apply dimensions to the ReactFlow node ──────────────

  const applyDims = useCallback((w: number, h: number) => {
    const cw = Math.max(MIN_WIDTH, Math.round(w));
    const ch = Math.max(MIN_HEIGHT, Math.round(h));
    setDims({ w: cw, h: ch });
    updateNode(id, { style: { width: cw + HANDLE_GAP * 2, height: ch + HANDLE_GAP } });
    const match = PRESETS.find((p) => Math.abs(p.width - cw) < 20);
    setActivePreset(match ? match.label : "");
  }, [id, updateNode]);

  // ── Respond to global breakpoint changes ─────────────────
  useEffect(() => {
    const bp = state.activeBreakpoint;
    const presetMap: Record<string, number> = { desktop: 1440, laptop: 1280, tablet: 768, mobile: 375 };
    const targetWidth = presetMap[bp] || DEFAULT_WIDTH;
    if (Math.abs(dims.w - targetWidth) > 20) {
      applyDims(targetWidth, dims.h);
    }
  }, [state.activeBreakpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Iframe load ──────────────────────────────────────────

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const contentDoc = iframe.contentDocument;
      if (!contentDoc?.body) { setIframeError(true); return; }
      setInspectionTarget(contentDoc, iframe);
      setIframeLoaded(true);
      setIframeError(false);
      const tree = buildElementTree();
      rebuildElementMap();
      dispatch({ type: "SET_ELEMENTS", elements: tree });
      setElementCount(countNodes(tree));

      // Auto-start inspect mode so clicking elements works immediately
      startInspect((elId, el) => {
        dispatch({ type: "SELECT_ELEMENT", id: elId, source: "inspect" });
        const win = el.ownerDocument.defaultView;
        if (!win) return;
        const computed = win.getComputedStyle(el);
        const styles: Record<string, string> = {};
        const props = [
          "color", "backgroundColor", "fontSize", "fontFamily", "fontWeight",
          "lineHeight", "padding", "margin", "width", "height", "display",
          "flexDirection", "alignItems", "justifyContent", "gap", "position",
          "borderRadius", "border", "boxShadow", "opacity", "transform",
        ];
        for (const prop of props) {
          const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
          const val = computed.getPropertyValue(cssProp);
          if (val && val !== "none" && val !== "normal" && val !== "auto") styles[prop] = val;
        }
        dispatch({ type: "SET_ELEMENT_STYLES", id: elId, styles });
      });
      setInspecting(true);

      setTimeout(() => {
        try {
          const iframeEl = iframeRef.current;
          if (!iframeEl?.contentDocument?.body) return;
          setInspectionTarget(iframeEl.contentDocument, iframeEl);
          const fullTree = buildElementTree();
          rebuildElementMap();
          const fullCount = countNodes(fullTree);
          if (fullCount > countNodes(tree)) {
            dispatch({ type: "SET_ELEMENTS", elements: fullTree });
            setElementCount(fullCount);
          }
        } catch { /* noop */ }
      }, 800);
    } catch {
      setIframeError(true);
    }
  }, [dispatch]);

  const scanDOM = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    setInspectionTarget(iframe.contentDocument, iframe);
    const tree = buildElementTree();
    rebuildElementMap();
    dispatch({ type: "SET_ELEMENTS", elements: tree });
    setElementCount(countNodes(tree));
  }, [dispatch]);

  // ── Copy feedback to clipboard ──────────────────────────

  const [sendCopied, setSendCopied] = useState(false);

  const handleCopyFeedback = useCallback(() => {
    const pending = state.feedbackItems.filter((f: FeedbackItem) => f.status === "pending");
    if (pending.length === 0) return;

    const lines: string[] = [];
    lines.push(`# ZeroCanvas Feedback (${pending.length} items)`);
    lines.push("");
    lines.push("## Feedback Items");
    lines.push("");
    pending.forEach((item: FeedbackItem, i: number) => {
      lines.push(`### ${i + 1}. ${item.elementSelector} [${item.intent.toUpperCase()} - ${item.severity.toUpperCase()}]`);
      lines.push(`- **Selector:** \`${item.elementSelector}\``);
      lines.push(`- **Tag:** ${item.elementTag} | **Classes:** ${item.elementClasses.join(", ") || "(none)"}`);
      lines.push(`- **Feedback:** ${item.comment}`);
      lines.push("");
    });

    copyToClipboard(lines.join("\n"));
    dispatch({ type: "MARK_FEEDBACK_SENT", ids: pending.map((f: FeedbackItem) => f.id) });
    setSendCopied(true);
    setTimeout(() => setSendCopied(false), 2000);
  }, [state.feedbackItems, dispatch]);

  // ── Inspect ──────────────────────────────────────────────

  const toggleInspect = useCallback(() => {
    if (isInspecting()) {
      stopInspect();
      setInspecting(false);
      return;
    }
    const iframe = iframeRef.current;
    if (iframe?.contentDocument) {
      setInspectionTarget(iframe.contentDocument, iframe);
      rebuildElementMap();
    }
    dispatch({ type: "SET_ACTIVE_VARIANT", id: null });
    startInspect((elId, el) => {
      dispatch({ type: "SELECT_ELEMENT", id: elId, source: "inspect" });
      const win = el.ownerDocument.defaultView;
      if (!win) return;
      const computed = win.getComputedStyle(el);
      const styles: Record<string, string> = {};
      const props = [
        "color", "backgroundColor", "fontSize", "fontFamily", "fontWeight",
        "lineHeight", "padding", "margin", "width", "height", "display",
        "flexDirection", "alignItems", "justifyContent", "gap", "position",
        "borderRadius", "border", "boxShadow", "opacity", "transform",
      ];
      for (const prop of props) {
        const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        const val = computed.getPropertyValue(cssProp);
        if (val && val !== "none" && val !== "normal" && val !== "auto") styles[prop] = val;
      }
      dispatch({ type: "SET_ELEMENT_STYLES", id: elId, styles });
    });
    setInspecting(true);
  }, [dispatch]);

  // ── Viewport presets & reset ─────────────────────────────

  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    applyDims(preset.width, dims.h);
  }, [dims.h, applyDims]);

  const resetHeight = useCallback(() => {
    applyDims(dims.w, DEFAULT_HEIGHT);
  }, [dims.w, applyDims]);

  // ── Fork element & highlight sync ────────────────────────

  useEffect(() => {
    onForkElementRequest((elementId: string) => {
      onForkComponent(elementId, dims.w);
    });
    return () => { onForkElementRequest(null); };
  }, [onForkComponent, dims.w]);

  // ── Register feedback callbacks (Add / Delete / Lookup) ──
  useEffect(() => {
    // Add or update feedback
    onChangeRequest((elementId: string, description: string, clickPos: { x: number; y: number }) => {
      // Check if feedback already exists for this element → update instead of add
      const existing = state.feedbackItems.find((f) => f.elementId === elementId && f.status === "pending");
      if (existing) {
        dispatch({ type: "UPDATE_FEEDBACK", id: existing.id, updates: { comment: description } });
        return;
      }
      const el = getElementById(elementId);
      const item = {
        id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        variantId: state.activeVariantId || "",
        elementId,
        elementSelector: el ? (el.id ? `#${el.id}` : el.tagName.toLowerCase() + (el.className ? `.${el.className.split(" ")[0]}` : "")) : "",
        elementTag: el?.tagName.toLowerCase() || "",
        elementClasses: el ? Array.from(el.classList) : [],
        comment: description,
        intent: "change" as const,
        severity: "suggestion" as const,
        status: "pending" as const,
        timestamp: Date.now(),
        // Store click position so the marker appears where the pill was
        boundingBox: { x: clickPos.x, y: clickPos.y, width: 0, height: 0 },
      };
      dispatch({ type: "ADD_FEEDBACK", item });
    });

    // Delete feedback by element ID
    onDeleteFeedbackRequest((elementId: string) => {
      const existing = state.feedbackItems.find((f) => f.elementId === elementId && f.status === "pending");
      if (existing) dispatch({ type: "REMOVE_FEEDBACK", id: existing.id });
    });

    // Lookup: does this element already have feedback?
    setFeedbackLookup((elementId: string) => {
      const existing = state.feedbackItems.find((f) => f.elementId === elementId && f.status === "pending");
      return existing ? { id: existing.id, comment: existing.comment } : null;
    });

    return () => {
      onChangeRequest(null);
      onDeleteFeedbackRequest(null);
      setFeedbackLookup(null);
    };
  }, [state.activeVariantId, state.feedbackItems, dispatch]);

  // ── Render feedback markers on inspected page ──
  useEffect(() => {
    const markers = state.feedbackItems
      .filter((f) => f.boundingBox && f.status === "pending")
      .map((f, i) => ({
        id: f.id,
        number: i + 1,
        elementId: f.elementId,
        comment: f.comment,
        boundingBox: f.boundingBox!,
      }));
    renderFeedbackMarkers(markers);
  }, [state.feedbackItems]);

  // ── Inspect mode: switches based on themeMode and designMode ──
  useEffect(() => {
    if (state.themeMode) {
      setInspectMode("theme");
    } else if (state.designMode === "feedback") {
      setInspectMode("feedback");
    } else {
      setInspectMode("style");
    }
  }, [state.themeMode, state.designMode]);

  // ── Theme Mode: provide tokens to inspector ──
  useEffect(() => {
    if (!state.themeMode) {
      setThemeTokensProvider(null);
      setThemeChangesProvider(null);
      onThemeChangeRequest(null);
      onThemeResetRequest(null);
      clearThemeChangeMarkers();
      return;
    }

    setThemeTokensProvider(() => {
      const tokens: { name: string; value: string }[] = [];
      for (const file of state.themes.files) {
        for (const token of file.tokens) {
          if (token.syntax !== "color") continue;
          const defaultTheme = file.themes.find((t) => t.isDefault) || file.themes[0];
          const value = defaultTheme ? token.values[defaultTheme.id] : Object.values(token.values)[0];
          if (value) tokens.push({ name: token.name, value });
        }
      }
      return tokens;
    });

    // Provide stored changes so the popup can show original source info
    setThemeChangesProvider(() => state.themeChanges);

    onThemeChangeRequest((change) => {
      const existing = state.themeChanges.find(
        (c) => c.elementId === change.elementId && c.property === change.property
      );
      if (existing) {
        // PRESERVE original values — only update the "new" side
        dispatch({
          type: "UPDATE_THEME_CHANGE",
          id: existing.id,
          updates: {
            newToken: change.newToken,
            newValue: change.newValue,
            timestamp: Date.now(),
            boundingBox: change.boundingBox,
          },
        });
      } else {
        dispatch({
          type: "ADD_THEME_CHANGE",
          item: {
            id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...change,
            timestamp: Date.now(),
          },
        });
      }
    });

    onThemeResetRequest((elementId, property) => {
      const existing = state.themeChanges.find(
        (c) => c.elementId === elementId && c.property === property
      );
      if (existing) dispatch({ type: "REMOVE_THEME_CHANGE", id: existing.id });
    });

    return () => {
      setThemeTokensProvider(null);
      setThemeChangesProvider(null);
      onThemeChangeRequest(null);
      onThemeResetRequest(null);
    };
  }, [state.themeMode, state.themes.files, state.themeChanges, dispatch]);

  // ── Theme Mode: render change markers ──
  useEffect(() => {
    if (!state.themeMode) { clearThemeChangeMarkers(); return; }
    const markers = state.themeChanges.map((c, i) => ({
      id: c.id,
      number: i + 1,
      elementId: c.elementId,
      label: `${c.property}: var(${c.newToken})`,
      boundingBox: c.boundingBox,
    }));
    renderThemeChangeMarkers(markers);
  }, [state.themeChanges, state.themeMode]);

  useEffect(() => {
    if (state.hoveredElementId) highlightElement(state.hoveredElementId, "hover");
    else highlightElement(null, "hover");
  }, [state.hoveredElementId]);

  useEffect(() => {
    if (state.selectedElementId) highlightElement(state.selectedElementId, "select");
    else highlightElement(null, "select");
  }, [state.selectedElementId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.selectedElementId) {
        dispatch({ type: "SELECT_ELEMENT", id: null });
        highlightElement(null, "select");
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [state.selectedElementId, dispatch]);

  useEffect(() => {
    return () => { stopInspect(); };
  }, []);

  // ── Sync initial node size to include handle gap ─────────

  useEffect(() => {
    updateNode(id, { style: { width: dims.w + HANDLE_GAP * 2, height: dims.h + HANDLE_GAP } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Custom resize drag handlers ──────────────────────────
  // These replace NodeResizer. They use pointer capture for
  // reliable dragging even when the cursor leaves the element,
  // and account for ReactFlow zoom level.

  const startDrag = useCallback((
    e: React.PointerEvent,
    axis: "left" | "right" | "bottom"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = dims.w;
    const startH = dims.h;
    const zoom = getZoom();

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;

      let newW = startW;
      let newH = startH;

      if (axis === "right") newW = startW + dx;
      if (axis === "left") newW = startW - dx;
      if (axis === "bottom") newH = startH + dy;

      applyDims(newW, newH);
    };

    const onUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      setIsResizing(false);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }, [dims.w, dims.h, getZoom, applyDims]);

  // Selection border
  const BORDER_W = selected ? 2.5 : 1;
  const borderColor = selected ? "var(--color--outline--on-background)" : "var(--color--border--on-surface-0)";

  return (
    <div
      data-0canvas="source-node"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      {/* ── Chrome Bar — floats above the node ── */}
      <div
        className="oc-source-chrome"
        style={{
          position: "absolute",
          left: HANDLE_GAP,
          right: HANDLE_GAP,
          bottom: "100%",
          marginBottom: 8,
          height: CHROME_HEIGHT,
          justifyContent: "space-between",
          border: "1px solid var(--color--border--on-surface-0)",
          borderRadius: 10,
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          cursor: selected ? "default" : "pointer",
        }}
      >
        {/* Left: URL pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div className="oc-source-url">
            <span style={{ fontSize: 9, color: "var(--color--text--muted)", flexShrink: 0 }}>localhost</span>
            <span style={{ fontSize: 10 }}>{state.currentRoute || "/"}</span>
          </div>
        </div>

        {/* Right: tools */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Feedback button — becomes a group [Feedback | Send] when items exist */}
          {(() => {
            const pendingCount = state.feedbackItems.filter((f) => f.status === "pending").length;
            const hasFeedback = pendingCount > 0;
            return (
              <div className={`oc-source-btn-group ${hasFeedback ? "has-items" : ""}`}>
                <button
                  className={`oc-source-btn ${inspecting ? "is-active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggleInspect(); }}
                  title="Feedback (I)"
                  style={{ position: "relative" }}
                >
                  <MessageCircle style={{ width: 12, height: 12 }} />
                  {hasFeedback && (
                    <span className="oc-source-badge">{pendingCount}</span>
                  )}
                </button>
                {hasFeedback && (
                  <button
                    className="oc-source-btn oc-source-send-btn"
                    onClick={(e) => { e.stopPropagation(); handleCopyFeedback(); }}
                    title={sendCopied ? "Copied!" : `Copy ${pendingCount} feedback items to clipboard`}
                  >
                    {sendCopied
                      ? <Check style={{ width: 11, height: 11, color: "#10B981" }} />
                      : <Send style={{ width: 11, height: 11 }} />}
                  </button>
                )}
              </div>
            );
          })()}
          <button
            className="oc-source-btn"
            onClick={(e) => { e.stopPropagation(); scanDOM(); }}
            title="Rescan"
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
          <div style={{ width: 1, height: 16, background: "var(--color--border--on-surface-0)" }} />
          <button
            className="oc-source-btn"
            onClick={(e) => { e.stopPropagation(); onForkPage(dims.w); }}
            title="Fork Page"
          >
            <GitFork style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── Viewport / iframe — inset by HANDLE_GAP ── */}
      <div
        className="oc-variant-card"
        style={{
          position: "absolute",
          top: 0,
          left: HANDLE_GAP,
          right: HANDLE_GAP,
          bottom: HANDLE_GAP,
          display: "flex",
          flexDirection: "column",
          border: `${BORDER_W}px solid ${borderColor}`,
          borderRadius: 0,
          boxShadow: selected
            ? "0 0 0 1px var(--color--outline--on-background), 0 8px 32px rgba(37,99,235,0.12)"
            : "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* No dev server configured — Mac app Phase 1A-2c state.
              Phase 1B adds an editable URL pill + LOCALHOST auto-discovery so
              this placeholder resolves to a real preview automatically. */}
          {!iframeSrc && (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "var(--color--surface--0)", zIndex: 3,
              padding: "24px 40px", textAlign: "center",
            }}>
              <Monitor style={{ width: 28, height: 28, color: "var(--color--text--muted)", marginBottom: 12 }} />
              <p style={{ color: "var(--color--text--primary)", fontSize: 13, margin: 0, fontWeight: 500 }}>
                No preview server configured
              </p>
              <p style={{ color: "var(--color--text--muted)", fontSize: 11, margin: "6px 0 0", maxWidth: 420, lineHeight: 1.55 }}>
                Start your project's dev server (e.g. <code style={{ fontFamily: "var(--oc-font-mono, monospace)" }}>pnpm dev</code>).
                Phase 1B wires the URL bar and localhost auto-discovery so this shows up automatically.
              </p>
            </div>
          )}

          {/* Loading */}
          {iframeSrc && !iframeLoaded && !iframeError && (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "var(--color--surface--0)", zIndex: 2,
            }}>
              <Loader2 style={{
                width: 28, height: 28, color: "var(--color--text--primary)",
                animation: "spin 1s linear infinite", marginBottom: 12,
              }} />
              <p style={{ color: "var(--color--text--muted)", fontSize: 12, margin: 0 }}>Loading preview...</p>
            </div>
          )}

          {/* Error */}
          {iframeError && (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "var(--color--surface--0)", zIndex: 2,
            }}>
              <Monitor style={{ width: 24, height: 24, color: "var(--color--status--critical)", marginBottom: 8 }} />
              <p style={{ color: "var(--color--text--muted)", fontSize: 11, margin: 0 }}>Preview unavailable</p>
            </div>
          )}

          <iframe
            ref={iframeRef}
            name="0canvas-preview"
            src={iframeSrc}
            onLoad={handleIframeLoad}
            title="ZeroCanvas Preview"
            data-0canvas="preview-iframe"
            style={{
              width: "100%", height: "100%", border: "none",
              display: "block", background: "#fff",
              pointerEvents: isResizing ? "none" : "auto",
            }}
          />

          {/* Inspect overlay badge */}
          {inspecting && (
            <div style={{
              position: "absolute", top: 8, left: "50%",
              transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 8,
                background: "var(--color--base--primary)",
                color: "var(--color--text--on-primary)",
                fontSize: 11, fontWeight: 500,
                boxShadow: "0 2px 12px rgba(37,99,235,0.3)",
              }}>
                <MessageCircle style={{ width: 12, height: 12 }} />
                Click to add feedback
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Resize grab zones + visible handle bars ── */}
      {/* Each zone is a wide (HANDLE_GAP) transparent area with a thin visible bar inside. */}
      {/* Pointer capture ensures dragging works even if cursor leaves the handle. */}

      {/* Left grab zone */}
      <div
        className={`oc-resize-zone oc-resize-zone-left ${isResizing ? "is-active" : ""}`}
        onPointerDown={(e) => startDrag(e, "left")}
        style={{
          position: "absolute", left: 0, top: 0, bottom: HANDLE_GAP,
          width: HANDLE_GAP, cursor: "ew-resize", zIndex: 10,
        }}
      >
        <div className={`oc-resize-handle oc-resize-handle-left ${isResizing ? "is-active" : ""}`} />
      </div>

      {/* Right grab zone */}
      <div
        className={`oc-resize-zone oc-resize-zone-right ${isResizing ? "is-active" : ""}`}
        onPointerDown={(e) => startDrag(e, "right")}
        style={{
          position: "absolute", right: 0, top: 0, bottom: HANDLE_GAP,
          width: HANDLE_GAP, cursor: "ew-resize", zIndex: 10,
        }}
      >
        <div className={`oc-resize-handle oc-resize-handle-right ${isResizing ? "is-active" : ""}`} />
      </div>

      {/* Bottom grab zone */}
      <div
        className={`oc-resize-zone oc-resize-zone-bottom ${isResizing ? "is-active" : ""}`}
        onPointerDown={(e) => startDrag(e, "bottom")}
        style={{
          position: "absolute", bottom: 0, left: HANDLE_GAP, right: HANDLE_GAP,
          height: HANDLE_GAP, cursor: "ns-resize", zIndex: 10,
        }}
      >
        <div className={`oc-resize-handle oc-resize-handle-bottom ${isResizing ? "is-active" : ""}`} />
      </div>

      {/* Bottom: reset + height label */}
      <div
        style={{
          position: "absolute",
          bottom: -22,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: isResizing || dims.h !== DEFAULT_HEIGHT ? 1 : 0,
          transition: "opacity 0.15s",
          pointerEvents: isResizing || dims.h !== DEFAULT_HEIGHT ? "auto" : "none",
        }}
      >
        {dims.h !== DEFAULT_HEIGHT && (
          <button
            onClick={(e) => { e.stopPropagation(); resetHeight(); }}
            style={{
              padding: "2px 8px", borderRadius: 4, border: "none",
              background: "transparent", color: "var(--color--text--muted)",
              fontSize: 10, fontFamily: "var(--font-sans)", cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Reset to default height"
          >
            Reset ({DEFAULT_HEIGHT}px)
          </button>
        )}
        <div style={{
          padding: "2px 10px", borderRadius: 10,
          background: "var(--color--surface--0)",
          border: "1px solid var(--color--border--on-surface-0)",
          fontSize: 10, fontWeight: 500,
          color: "var(--color--text--on-surface-variant)",
          fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
        }}>
          {dims.h}px
        </div>
      </div>

      {/* ── Right side: vertical preset list, centered to the right handle ── */}
      <div
        style={{
          position: "absolute",
          right: -8,
          top: "50%",
          transform: "translate(100%, -50%)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingLeft: 8,
        }}
      >
        {/* Current width pill */}
        <div style={{
          padding: "3px 10px", borderRadius: 8, marginBottom: 2,
          background: "var(--color--surface--0)",
          border: "1px solid var(--color--border--on-surface-0)",
          fontSize: 10, fontWeight: 600,
          color: "var(--color--text--on-surface-variant)",
          fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
          textAlign: "center",
        }}>
          {dims.w}px
        </div>

        {/* Preset buttons */}
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.label;
          return (
            <button
              key={preset.label}
              onClick={(e) => { e.stopPropagation(); applyPreset(preset); }}
              title={`${preset.label} (${preset.width}px)`}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: 8,
                border: isActive ? "1px solid var(--color--border--on-surface-1)" : "1px solid transparent",
                background: isActive ? "var(--color--surface--1)" : "transparent",
                color: isActive ? "var(--color--text--on-surface)" : "var(--color--text--muted)",
                fontSize: 10,
                fontWeight: isActive ? 500 : 400,
                fontFamily: "var(--font-sans)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function countNodes(nodes: any[]): number {
  let count = 0;
  for (const n of nodes) { count++; if (n.children) count += countNodes(n.children); }
  return count;
}
