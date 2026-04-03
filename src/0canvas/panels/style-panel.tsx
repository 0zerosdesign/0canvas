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
import { useWorkspace, findElement } from "../store/store";
import { copyToClipboard } from "../utils/clipboard";
import { ScrollArea } from "../ui/scroll-area";

type StyleCategory = {
  name: string;
  icon: React.ReactNode;
  properties: string[];
};

const STYLE_CATEGORIES: StyleCategory[] = [
  {
    name: "Layout",
    icon: <Grid3x3 size={14} color="#A3A3A3" />,
    properties: [
      "display", "position", "flexDirection", "alignItems", "justifyContent",
      "flexWrap", "gap", "gridTemplateColumns", "gridTemplateRows",
      "overflow", "float", "clear", "zIndex",
    ],
  },
  {
    name: "Spacing",
    icon: <Box size={14} color="#A3A3A3" />,
    properties: [
      "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
    ],
  },
  {
    name: "Size",
    icon: <Ruler size={14} color="#A3A3A3" />,
    properties: ["width", "height", "maxWidth", "maxHeight", "minHeight", "minWidth"],
  },
  {
    name: "Typography",
    icon: <Type size={14} color="#A3A3A3" />,
    properties: [
      "fontSize", "fontWeight", "lineHeight", "textAlign", "color",
      "letterSpacing", "fontFamily", "textDecoration", "textTransform",
      "whiteSpace", "verticalAlign", "listStyleType",
    ],
  },
  {
    name: "Fill & Border",
    icon: <Palette size={14} color="#A3A3A3" />,
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
    <div className="oc-style-property">
      <span className="oc-style-prop-name">
        {formatProperty(property)}
      </span>
      <div className="oc-style-prop-value-wrap">
        {swatchColor && (
          <span className="oc-style-swatch" style={{ background: swatchColor }} />
        )}
        {editing ? (
          <input
            autoFocus
            className="oc-style-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") { setEditValue(value); setEditing(false); }
            }}
          />
        ) : (
          <span
            onClick={() => { setEditValue(value); setEditing(true); }}
            className="oc-style-click-value"
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
  const activeProperties = category.properties.filter(
    (p) => elementStyles[p] !== undefined && elementStyles[p] !== ""
  );

  if (activeProperties.length === 0) return null;

  return (
    <div className="oc-panel-section">
      <button
        onClick={() => setExpanded(!expanded)}
        className="oc-style-section-btn"
      >
        {expanded ? (
          <ChevronDown size={12} color="#A3A3A3" className="oc-style-chevron" />
        ) : (
          <ChevronRight size={12} color="#A3A3A3" className="oc-style-chevron" />
        )}
        <span className="oc-style-section-icon">{category.icon}</span>
        <span className="oc-style-section-name">{category.name}</span>
        <span className="oc-style-section-count">{activeProperties.length}</span>
      </button>
      {expanded && (
        <div className="oc-style-section-children">
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
      <div className="oc-panel">
        <div className="oc-panel-header">
          <span className="oc-panel-title">Style</span>
        </div>
        <div className="oc-style-empty-centered">
          <div>
            {state.elements.length === 0 ? (
              <>
                <Globe size={28} color="#404040" className="oc-style-empty-icon" />
                <p>Connect a project to inspect styles</p>
              </>
            ) : (
              <>
                <MousePointer2 size={28} color="#404040" className="oc-style-empty-icon" />
                <p>Select an element to inspect its styles</p>
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
    <div className="oc-panel">
      {/* Header */}
      <div className="oc-style-header-col">
        <div className="oc-style-header-row">
          <span className="oc-panel-title">Style</span>
          <CopyBtn onClick={() => copyToClipboard(`${selectedElement.selector} {\n${cssOutput}\n}`)} />
        </div>

        <div className="oc-style-header-meta">
          <span className="oc-style-tag-badge">
            {"<"}{selectedElement.tag}{">"}
          </span>
          {styleCount > 0 && (
            <span className="oc-style-prop-count">{styleCount} properties</span>
          )}
        </div>

        {selectedElement.classes.length > 0 && (
          <div className="oc-style-class-list">
            {selectedElement.classes.slice(0, 6).map((cls) => (
              <span key={cls} className="oc-style-class-badge">.{cls}</span>
            ))}
            {selectedElement.classes.length > 6 && (
              <span className="oc-style-class-overflow">+{selectedElement.classes.length - 6}</span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="oc-style-tabs">
        {(["styles", "computed", "code"] as const).map((t) => (
          <TabBtn key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="oc-panel-body">
        {tab === "styles" && (
          <div>
            {STYLE_CATEGORIES.map((cat) => (
              <StyleSection key={cat.name} category={cat} elementStyles={selectedElement.styles} elementId={selectedElement.id} />
            ))}
            {styleCount === 0 && (
              <div className="oc-panel-empty">
                <p>No computed styles available yet.</p>
                <p className="oc-style-sub-hint">Click this element in the preview to load styles.</p>
              </div>
            )}
          </div>
        )}

        {tab === "computed" && (
          <div className="oc-style-tab-content">
            <BoxModel styles={selectedElement.styles} />
            <div className="oc-style-selector-block">
              <span className="oc-style-label">Selector</span>
              <code className="oc-style-selector-code">
                {selectedElement.selector}
              </code>
            </div>
            <div>
              <span className="oc-style-label">All Properties ({styleCount})</span>
              {Object.entries(selectedElement.styles)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => (
                  <div key={k} className="oc-style-computed-row">
                    <span className="oc-style-computed-name">
                      {k.replace(/([A-Z])/g, "-$1").toLowerCase()}
                    </span>
                    <span className="oc-style-prop-value">{v}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {tab === "code" && (
          <div className="oc-style-tab-content">
            <pre className="oc-style-code-block">
              <span className="oc-style-syntax-comment">{"/* CSS */\n"}</span>
              <span className="oc-style-syntax-selector">{selectedElement.selector}</span>
              <span className="oc-style-syntax-comment">{" {\n"}</span>
              {Object.entries(selectedElement.styles).map(([k, v]) => (
                <span key={k}>
                  <span className="oc-style-syntax-property">{"  "}{k.replace(/([A-Z])/g, "-$1").toLowerCase()}</span>
                  <span className="oc-style-syntax-comment">{": "}</span>
                  <span className="oc-style-syntax-value">{v}</span>
                  <span className="oc-style-syntax-comment">{";\n"}</span>
                </span>
              ))}
              <span className="oc-style-syntax-comment">{"}"}</span>
            </pre>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`oc-style-tab${active ? " is-active" : ""}`}
    >
      {label}
    </button>
  );
}

function CopyBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="oc-panel-btn"
      title="Copy CSS"
    >
      <Copy size={14} />
    </button>
  );
}

function BoxModel({ styles }: { styles: Record<string, string> }) {
  return (
    <div className="oc-style-boxmodel">
      <div className="oc-style-boxmodel-margin">
        <div className="oc-style-boxmodel-margin-label">
          margin <span className="oc-style-boxmodel-dim">{styles.margin || styles.marginTop || "0"}</span>
        </div>
        <div className="oc-style-boxmodel-padding">
          <div className="oc-style-boxmodel-padding-label">
            padding <span className="oc-style-boxmodel-dim">{styles.padding || styles.paddingTop || "0"}</span>
          </div>
          <div className="oc-style-boxmodel-content">
            <span className="oc-style-boxmodel-content-label">
              {styles.width || "auto"} x {styles.height || "auto"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
