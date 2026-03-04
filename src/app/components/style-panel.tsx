import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Palette,
  Ruler,
  Type,
  Box,
  Grid3x3,
  Globe,
  MousePointer2,
} from "lucide-react";
import { useWorkspace, findElement } from "../store";
import { copyToClipboard } from "./clipboard";
import { ScrollArea } from "./ui/scroll-area";

const FONT = "'Geist Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const MONO = "'JetBrains Mono','Geist Mono','SF Mono','Fira Code',monospace";
const C = {
  bg: "#0a0a0a",
  surface: "#111111",
  surfaceHover: "#1a1a1a",
  border: "#1e1e1e",
  fg: "#ededed",
  fgMuted: "#888888",
  fgDim: "#555555",
  accent: "#0070f3",
  green: "#50e3c2",
  orange: "#f5a623",
};

type StyleCategory = {
  name: string;
  icon: React.ReactNode;
  properties: string[];
};

const STYLE_CATEGORIES: StyleCategory[] = [
  {
    name: "Layout",
    icon: <Grid3x3 size={14} color={C.fgMuted} />,
    properties: [
      "display", "position", "flexDirection", "alignItems", "justifyContent",
      "flexWrap", "gap", "gridTemplateColumns", "gridTemplateRows",
      "overflow", "float", "clear", "zIndex",
    ],
  },
  {
    name: "Spacing",
    icon: <Box size={14} color={C.fgMuted} />,
    properties: [
      "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
    ],
  },
  {
    name: "Size",
    icon: <Ruler size={14} color={C.fgMuted} />,
    properties: ["width", "height", "maxWidth", "maxHeight", "minHeight", "minWidth"],
  },
  {
    name: "Typography",
    icon: <Type size={14} color={C.fgMuted} />,
    properties: [
      "fontSize", "fontWeight", "lineHeight", "textAlign", "color",
      "letterSpacing", "fontFamily", "textDecoration", "textTransform",
      "whiteSpace", "verticalAlign", "listStyleType",
    ],
  },
  {
    name: "Fill & Border",
    icon: <Palette size={14} color={C.fgMuted} />,
    properties: [
      "background", "backgroundColor", "border", "borderTop", "borderBottom",
      "borderLeft", "borderRight", "borderRadius", "opacity", "boxShadow",
      "cursor",
    ],
  },
];

function StylePropertyRow({
  property,
  value,
  elementId,
}: {
  property: string;
  value: string;
  elementId: string;
}) {
  const { dispatch } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [hovered, setHovered] = useState(false);

  const isColor =
    property === "background" ||
    property === "backgroundColor" ||
    property === "color" ||
    (typeof value === "string" && (value.startsWith("#") || value.startsWith("rgb")));

  const handleSave = () => {
    dispatch({ type: "UPDATE_STYLE", elementId, property, value: editValue });
    setEditing(false);
  };

  const formatProperty = (prop: string) =>
    prop.replace(/([A-Z])/g, "-$1").toLowerCase();

  const colorMatch = typeof value === "string"
    ? value.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/)
    : null;
  const swatchColor = isColor && colorMatch ? colorMatch[0] : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        height: 28,
        padding: "0 12px",
        background: hovered ? "rgba(255,255,255,0.02)" : "transparent",
        fontFamily: FONT,
      }}
    >
      <span
        style={{
          width: 120,
          flexShrink: 0,
          fontSize: 11,
          color: C.fgMuted,
          fontFamily: MONO,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {formatProperty(property)}
      </span>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
        {swatchColor && (
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              border: `1px solid ${C.border}`,
              flexShrink: 0,
              background: swatchColor,
              display: "inline-block",
            }}
          />
        )}
        {editing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") { setEditValue(value); setEditing(false); }
            }}
            style={{
              flex: 1,
              background: `${C.accent}15`,
              border: `1px solid ${C.accent}50`,
              borderRadius: 4,
              padding: "1px 6px",
              fontSize: 11,
              color: C.fg,
              fontFamily: MONO,
              outline: "none",
            }}
          />
        ) : (
          <span
            onClick={() => { setEditValue(value); setEditing(true); }}
            style={{
              flex: 1,
              fontSize: 11,
              color: C.fg,
              fontFamily: MONO,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "text",
            }}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

function StyleSection({
  category,
  elementStyles,
  elementId,
}: {
  category: StyleCategory;
  elementStyles: Record<string, string>;
  elementId: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const activeProperties = category.properties.filter(
    (p) => elementStyles[p] !== undefined && elementStyles[p] !== ""
  );

  if (activeProperties.length === 0) return null;

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "8px 12px",
          background: hovered ? "rgba(255,255,255,0.02)" : "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: FONT,
          color: C.fg,
          transition: "background 0.1s ease",
        }}
      >
        {expanded ? (
          <ChevronDown size={12} color={C.fgMuted} style={{ marginRight: 6 }} />
        ) : (
          <ChevronRight size={12} color={C.fgMuted} style={{ marginRight: 6 }} />
        )}
        <span style={{ marginRight: 6, display: "inline-flex" }}>{category.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 450 }}>{category.name}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: C.fgMuted }}>{activeProperties.length}</span>
      </button>
      {expanded && (
        <div style={{ paddingBottom: 4 }}>
          {activeProperties.map((prop) => (
            <StylePropertyRow key={prop} property={prop} value={elementStyles[prop]} elementId={elementId} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StylePanel() {
  const { state } = useWorkspace();
  const [tab, setTab] = useState<"styles" | "computed" | "code">("styles");

  const selectedElement = state.selectedElementId
    ? findElement(state.elements, state.selectedElementId)
    : null;

  if (!selectedElement) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, borderLeft: `1px solid ${C.border}`, fontFamily: FONT, color: C.fg }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: C.fgMuted }}>Style</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center" }}>
            {state.elements.length === 0 ? (
              <>
                <Globe size={28} color="#333" style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 13, color: C.fgMuted }}>Connect a project to inspect styles</p>
              </>
            ) : (
              <>
                <MousePointer2 size={28} color="#333" style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 13, color: C.fgMuted }}>Select an element to inspect its styles</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const styleCount = Object.keys(selectedElement.styles).length;
  const cssOutput = Object.entries(selectedElement.styles)
    .map(([k, v]) => `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
    .join("\n");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, borderLeft: `1px solid ${C.border}`, fontFamily: FONT, color: C.fg }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: C.fgMuted }}>Style</span>
          <CopyBtn onClick={() => copyToClipboard(`${selectedElement.selector} {\n${cssOutput}\n}`)} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: C.accent, background: `${C.accent}18`, padding: "2px 8px", borderRadius: 4, fontFamily: MONO }}>
            {"<"}{selectedElement.tag}{">"}
          </span>
          {styleCount > 0 && (
            <span style={{ fontSize: 11, color: C.fgMuted }}>{styleCount} properties</span>
          )}
        </div>

        {selectedElement.classes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {selectedElement.classes.slice(0, 6).map((cls) => (
              <span key={cls} style={{ fontSize: 10, color: C.fgMuted, background: C.surface, padding: "2px 6px", borderRadius: 3, border: `1px solid ${C.border}`, fontFamily: MONO }}>
                .{cls}
              </span>
            ))}
            {selectedElement.classes.length > 6 && (
              <span style={{ fontSize: 10, color: C.fgDim }}>+{selectedElement.classes.length - 6}</span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
        {(["styles", "computed", "code"] as const).map((t) => (
          <TabBtn key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>

      {/* Content */}
      <ScrollArea style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {tab === "styles" && (
          <div>
            {STYLE_CATEGORIES.map((cat) => (
              <StyleSection key={cat.name} category={cat} elementStyles={selectedElement.styles} elementId={selectedElement.id} />
            ))}
            {styleCount === 0 && (
              <div style={{ padding: 24, textAlign: "center" }}>
                <p style={{ fontSize: 12, color: C.fgMuted }}>No computed styles available yet.</p>
                <p style={{ fontSize: 11, color: C.fgDim, marginTop: 4 }}>Click this element in the preview to load styles.</p>
              </div>
            )}
          </div>
        )}

        {tab === "computed" && (
          <div style={{ padding: 12 }}>
            <BoxModel styles={selectedElement.styles} />
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: C.fgMuted, display: "block", marginBottom: 6 }}>Selector</span>
              <code style={{ fontSize: 11, color: C.green, background: C.surface, padding: "6px 10px", borderRadius: 6, display: "block", border: `1px solid ${C.border}`, wordBreak: "break-all", fontFamily: MONO }}>
                {selectedElement.selector}
              </code>
            </div>
            <div>
              <span style={{ fontSize: 11, color: C.fgMuted, display: "block", marginBottom: 6 }}>All Properties ({styleCount})</span>
              {Object.entries(selectedElement.styles)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", padding: "3px 0", fontSize: 10, borderBottom: `1px solid ${C.surface}`, fontFamily: MONO }}>
                    <span style={{ color: C.fgMuted, width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {k.replace(/([A-Z])/g, "-$1").toLowerCase()}
                    </span>
                    <span style={{ color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {tab === "code" && (
          <div style={{ padding: 12 }}>
            <pre style={{ fontSize: 11, color: C.fg, background: C.surface, padding: 12, borderRadius: 8, border: `1px solid ${C.border}`, overflowX: "auto", whiteSpace: "pre", fontFamily: MONO }}>
              <span style={{ color: C.fgMuted }}>{"/* CSS */\n"}</span>
              <span style={{ color: C.green }}>{selectedElement.selector}</span>
              <span style={{ color: C.fgMuted }}>{" {\n"}</span>
              {Object.entries(selectedElement.styles).map(([k, v]) => (
                <span key={k}>
                  <span style={{ color: "#79b8ff" }}>{"  "}{k.replace(/([A-Z])/g, "-$1").toLowerCase()}</span>
                  <span style={{ color: C.fgMuted }}>{": "}</span>
                  <span style={{ color: C.orange }}>{v}</span>
                  <span style={{ color: C.fgMuted }}>{";\n"}</span>
                </span>
              ))}
              <span style={{ color: C.fgMuted }}>{"}"}</span>
            </pre>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: "8px 0",
        fontSize: 12,
        fontFamily: FONT,
        fontWeight: active ? 500 : 400,
        color: active ? C.fg : hovered ? C.fg : C.fgMuted,
        background: "transparent",
        border: "none",
        borderBottom: active ? `2px solid ${C.fg}` : "2px solid transparent",
        cursor: "pointer",
        transition: "all 0.15s ease",
        textAlign: "center",
      }}
    >
      {label}
    </button>
  );
}

function CopyBtn({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Copy CSS"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 4,
        borderRadius: 4,
        background: hovered ? C.surfaceHover : "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background 0.1s ease",
      }}
    >
      <Copy size={14} color={C.fgMuted} />
    </button>
  );
}

function BoxModel({ styles }: { styles: Record<string, string> }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <span style={{ fontSize: 11, color: C.fgMuted, display: "block", marginBottom: 8 }}>Box Model</span>
      <div style={{ background: "#ff980020", border: "1px solid #ff980040", borderRadius: 8, padding: 12, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#ff9800", marginBottom: 4 }}>
          margin <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 4 }}>{styles.margin || styles.marginTop || "0"}</span>
        </div>
        <div style={{ background: "#4caf5020", border: "1px solid #4caf5040", borderRadius: 6, padding: 12 }}>
          <div style={{ fontSize: 10, color: "#4caf50", marginBottom: 4 }}>
            padding <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 4 }}>{styles.padding || styles.paddingTop || "0"}</span>
          </div>
          <div style={{ background: "#2196f320", border: "1px solid #2196f340", borderRadius: 4, padding: 8 }}>
            <span style={{ fontSize: 11, color: "#2196f3" }}>
              {styles.width || "auto"} x {styles.height || "auto"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
