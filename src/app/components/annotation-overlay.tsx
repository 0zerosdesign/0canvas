import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  MousePointer2,
  Square,
  ArrowUpRight,
  Type,
  Pencil,
  Circle,
  Trash2,
  Copy,
  Check,
  X,
  Undo2,
} from "lucide-react";
import { useWorkspace, Annotation, AnnotationTool } from "../store";

// ──────────────────────────────────────────────────────────
// Annotation colors
// ──────────────────────────────────────────────────────────
const ANNOTATION_COLORS = [
  "#ff0000",
  "#ff6b35",
  "#f5a623",
  "#50e3c2",
  "#0070f3",
  "#7928ca",
  "#ff0080",
  "#ffffff",
];

// ──────────────────────────────────────────────────────────
// Tools config
// ──────────────────────────────────────────────────────────
const TOOLS: { id: AnnotationTool; icon: React.ReactNode; label: string }[] = [
  {
    id: "select",
    icon: <MousePointer2 className="w-3.5 h-3.5" />,
    label: "Select",
  },
  { id: "rect", icon: <Square className="w-3.5 h-3.5" />, label: "Rectangle" },
  {
    id: "circle",
    icon: <Circle className="w-3.5 h-3.5" />,
    label: "Circle",
  },
  {
    id: "arrow",
    icon: <ArrowUpRight className="w-3.5 h-3.5" />,
    label: "Arrow",
  },
  { id: "text", icon: <Type className="w-3.5 h-3.5" />, label: "Text" },
  {
    id: "freehand",
    icon: <Pencil className="w-3.5 h-3.5" />,
    label: "Freehand",
  },
];

// ──────────────────────────────────────────────────────────
// Render a single annotation as SVG
// ──────────────────────────────────────────────────────────
function AnnotationShape({
  ann,
  isSelected,
  onSelect,
}: {
  ann: Annotation;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const strokeWidth = isSelected ? 2.5 : 2;

  switch (ann.tool) {
    case "rect":
      return (
        <g onClick={onSelect} style={{ cursor: "pointer" }}>
          <rect
            x={Math.min(ann.x, ann.x + (ann.width || 0))}
            y={Math.min(ann.y, ann.y + (ann.height || 0))}
            width={Math.abs(ann.width || 0)}
            height={Math.abs(ann.height || 0)}
            fill={`${ann.color}10`}
            stroke={ann.color}
            strokeWidth={strokeWidth}
            strokeDasharray={isSelected ? "6 3" : "none"}
            rx={3}
          />
          {isSelected && (
            <>
              <circle cx={ann.x} cy={ann.y} r={4} fill={ann.color} />
              <circle
                cx={ann.x + (ann.width || 0)}
                cy={ann.y + (ann.height || 0)}
                r={4}
                fill={ann.color}
              />
            </>
          )}
        </g>
      );

    case "circle":
      const cx = ann.x + (ann.width || 0) / 2;
      const cy = ann.y + (ann.height || 0) / 2;
      const rx = Math.abs((ann.width || 0) / 2);
      const ry = Math.abs((ann.height || 0) / 2);
      return (
        <g onClick={onSelect} style={{ cursor: "pointer" }}>
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill={`${ann.color}10`}
            stroke={ann.color}
            strokeWidth={strokeWidth}
            strokeDasharray={isSelected ? "6 3" : "none"}
          />
        </g>
      );

    case "arrow": {
      const endX = ann.endX ?? ann.x;
      const endY = ann.endY ?? ann.y;
      const angle = Math.atan2(endY - ann.y, endX - ann.x);
      const headLen = 12;
      const x1 = endX - headLen * Math.cos(angle - Math.PI / 6);
      const y1 = endY - headLen * Math.sin(angle - Math.PI / 6);
      const x2 = endX - headLen * Math.cos(angle + Math.PI / 6);
      const y2 = endY - headLen * Math.sin(angle + Math.PI / 6);

      return (
        <g onClick={onSelect} style={{ cursor: "pointer" }}>
          <line
            x1={ann.x}
            y1={ann.y}
            x2={endX}
            y2={endY}
            stroke={ann.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <polygon
            points={`${endX},${endY} ${x1},${y1} ${x2},${y2}`}
            fill={ann.color}
          />
          {isSelected && (
            <>
              <circle cx={ann.x} cy={ann.y} r={4} fill={ann.color} />
              <circle cx={endX} cy={endY} r={4} fill={ann.color} />
            </>
          )}
        </g>
      );
    }

    case "text":
      return (
        <g onClick={onSelect} style={{ cursor: "pointer" }}>
          {isSelected && (
            <rect
              x={ann.x - 4}
              y={ann.y - 18}
              width={(ann.text?.length || 1) * 8 + 8}
              height={24}
              fill="transparent"
              stroke={ann.color}
              strokeWidth={1}
              strokeDasharray="4 2"
              rx={3}
            />
          )}
          <text
            x={ann.x}
            y={ann.y}
            fill={ann.color}
            style={{
              fontSize: "14px",
              fontFamily: "'Geist Sans', sans-serif",
              fontWeight: 500,
              userSelect: "none",
            }}
          >
            {ann.text || "Text"}
          </text>
        </g>
      );

    case "freehand": {
      if (!ann.points || ann.points.length < 2) return null;
      const d = ann.points
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(" ");
      return (
        <g onClick={onSelect} style={{ cursor: "pointer" }}>
          <path
            d={d}
            fill="none"
            stroke={ann.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }

    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────
// Main annotation overlay component
// ──────────────────────────────────────────────────────────
export function AnnotationOverlay() {
  const { state, dispatch } = useWorkspace();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Partial<Annotation> | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<{x: number; y: number} | null>(null);
  const [copied, setCopied] = useState(false);

  const tool = state.annotationTool;
  const color = state.annotationColor;

  // Get cursor based on tool
  const getCursor = () => {
    switch (tool) {
      case "select":
        return "default";
      case "text":
        return "text";
      case "freehand":
        return "crosshair";
      default:
        return "crosshair";
    }
  };

  const getRelativePos = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (tool === "select") {
        setSelectedAnnotationId(null);
        return;
      }

      const pos = getRelativePos(e);

      if (tool === "text") {
        setTextPosition(pos);
        setTextInput("");
        return;
      }

      setDrawing(true);
      setSelectedAnnotationId(null);

      if (tool === "freehand") {
        setCurrentAnnotation({
          tool,
          x: pos.x,
          y: pos.y,
          points: [pos],
          color,
        });
      } else if (tool === "arrow") {
        setCurrentAnnotation({
          tool,
          x: pos.x,
          y: pos.y,
          endX: pos.x,
          endY: pos.y,
          color,
        });
      } else {
        setCurrentAnnotation({
          tool,
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color,
        });
      }
    },
    [tool, color, getRelativePos]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing || !currentAnnotation) return;
      const pos = getRelativePos(e);

      if (tool === "freehand") {
        setCurrentAnnotation((prev) => ({
          ...prev,
          points: [...(prev?.points || []), pos],
        }));
      } else if (tool === "arrow") {
        setCurrentAnnotation((prev) => ({
          ...prev,
          endX: pos.x,
          endY: pos.y,
        }));
      } else {
        setCurrentAnnotation((prev) => ({
          ...prev,
          width: pos.x - (prev?.x || 0),
          height: pos.y - (prev?.y || 0),
        }));
      }
    },
    [drawing, currentAnnotation, tool, getRelativePos]
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing || !currentAnnotation) return;
    setDrawing(false);

    // Check minimum size
    const isValid =
      tool === "freehand"
        ? (currentAnnotation.points?.length || 0) > 3
        : tool === "arrow"
        ? Math.hypot(
            (currentAnnotation.endX || 0) - (currentAnnotation.x || 0),
            (currentAnnotation.endY || 0) - (currentAnnotation.y || 0)
          ) > 10
        : Math.abs(currentAnnotation.width || 0) > 5 ||
          Math.abs(currentAnnotation.height || 0) > 5;

    if (isValid) {
      const annotation: Annotation = {
        id: `ann-${Date.now()}`,
        tool: currentAnnotation.tool || tool,
        x: currentAnnotation.x || 0,
        y: currentAnnotation.y || 0,
        width: currentAnnotation.width,
        height: currentAnnotation.height,
        points: currentAnnotation.points,
        endX: currentAnnotation.endX,
        endY: currentAnnotation.endY,
        color: currentAnnotation.color || color,
        timestamp: Date.now(),
      };
      dispatch({ type: "ADD_ANNOTATION", annotation });
    }

    setCurrentAnnotation(null);
  }, [drawing, currentAnnotation, tool, color, dispatch]);

  const handleTextSubmit = () => {
    if (!textPosition || !textInput.trim()) {
      setTextPosition(null);
      return;
    }

    const annotation: Annotation = {
      id: `ann-${Date.now()}`,
      tool: "text",
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
      color,
      timestamp: Date.now(),
    };
    dispatch({ type: "ADD_ANNOTATION", annotation });
    setTextPosition(null);
    setTextInput("");
  };

  const deleteSelected = () => {
    if (selectedAnnotationId) {
      dispatch({ type: "DELETE_ANNOTATION", id: selectedAnnotationId });
      setSelectedAnnotationId(null);
    }
  };

  // Export annotations as JSON
  const exportAnnotations = () => {
    const data = JSON.stringify(state.annotations, null, 2);
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!state.annotationMode) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTextPosition(null);
        setSelectedAnnotationId(null);
        if (drawing) {
          setDrawing(false);
          setCurrentAnnotation(null);
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedAnnotationId && !textPosition) {
          deleteSelected();
        }
      }
      // Tool shortcuts
      if (!textPosition) {
        if (e.key === "v") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "select" });
        if (e.key === "r") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "rect" });
        if (e.key === "o") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "circle" });
        if (e.key === "a") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "arrow" });
        if (e.key === "t") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "text" });
        if (e.key === "p") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "freehand" });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.annotationMode, drawing, selectedAnnotationId, textPosition, dispatch]);

  if (!state.annotationMode) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Floating toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <div className="flex items-center gap-1 bg-[#0a0a0a]/95 backdrop-blur-sm border border-[#222222] rounded-xl px-2 py-1.5 shadow-2xl">
          {/* Tools */}
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => dispatch({ type: "SET_ANNOTATION_TOOL", tool: t.id })}
              className={`p-1.5 rounded-lg transition-colors ${
                tool === t.id
                  ? "bg-[#0070f3]/15 text-[#0070f3]"
                  : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]"
              }`}
              title={`${t.label} (${t.id === "select" ? "V" : t.id[0].toUpperCase()})`}
            >
              {t.icon}
            </button>
          ))}

          <div className="w-px h-5 bg-[#222222] mx-1" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => dispatch({ type: "SET_ANNOTATION_COLOR", color: c })}
                className={`w-4 h-4 rounded-full transition-transform ${
                  color === c ? "scale-125 ring-1 ring-white/40" : ""
                }`}
                style={{ background: c, border: c === "#ffffff" ? "1px solid #444" : "none" }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-[#222222] mx-1" />

          {/* Actions */}
          <button
            onClick={() => {
              if (state.annotations.length > 0) {
                const last = state.annotations[state.annotations.length - 1];
                dispatch({ type: "DELETE_ANNOTATION", id: last.id });
              }
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
            title="Undo last"
            disabled={state.annotations.length === 0}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={deleteSelected}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#ff4444] hover:bg-[#ff4444]/10 transition-colors disabled:opacity-30"
            title="Delete selected"
            disabled={!selectedAnnotationId}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={exportAnnotations}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
            title="Copy annotations"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#50e3c2]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => dispatch({ type: "CLEAR_ANNOTATIONS" })}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#ff4444] hover:bg-[#ff4444]/10 transition-colors disabled:opacity-30"
            title="Clear all"
            disabled={state.annotations.length === 0}
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-5 bg-[#222222] mx-1" />

          {/* Count badge */}
          <span className="text-[10px] text-muted-foreground px-1.5">
            {state.annotations.length}
          </span>

          {/* Close annotation mode */}
          <button
            onClick={() => dispatch({ type: "TOGGLE_ANNOTATION_MODE" })}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors ml-0.5"
            title="Exit annotation mode"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG canvas for drawing */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Existing annotations */}
        {state.annotations.map((ann) => (
          <AnnotationShape
            key={ann.id}
            ann={ann}
            isSelected={ann.id === selectedAnnotationId}
            onSelect={() => {
              if (tool === "select") {
                setSelectedAnnotationId(ann.id);
              }
            }}
          />
        ))}

        {/* Currently drawing annotation */}
        {currentAnnotation && drawing && (
          <AnnotationShape
            ann={
              {
                id: "drawing",
                ...currentAnnotation,
                timestamp: Date.now(),
              } as Annotation
            }
            isSelected={false}
            onSelect={() => {}}
          />
        )}
      </svg>

      {/* Text input popup */}
      {textPosition && (
        <div
          className="absolute pointer-events-auto z-40"
          style={{ left: textPosition.x, top: textPosition.y - 6 }}
        >
          <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#333333] rounded-lg shadow-xl overflow-hidden">
            <input
              type="text"
              autoFocus
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTextSubmit();
                if (e.key === "Escape") setTextPosition(null);
              }}
              className="w-48 px-2.5 py-1.5 bg-transparent text-[12px] text-foreground focus:outline-none"
              placeholder="Type annotation..."
              style={{ color }}
            />
            <button
              onClick={handleTextSubmit}
              className="px-2 py-1.5 text-[#0070f3] hover:bg-[#0070f3]/10 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}