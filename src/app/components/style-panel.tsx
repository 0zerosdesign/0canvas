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
  Minus,
  Globe,
  MousePointer2,
} from "lucide-react";
import { useWorkspace, findElement } from "../store";
import { copyToClipboard } from "./clipboard";
import { ScrollArea } from "./ui/scroll-area";

type StyleCategory = {
  name: string;
  icon: React.ReactNode;
  properties: string[];
};

const STYLE_CATEGORIES: StyleCategory[] = [
  {
    name: "Layout",
    icon: <Grid3x3 className="w-3.5 h-3.5" />,
    properties: [
      "display", "position", "flexDirection", "alignItems", "justifyContent",
      "flexWrap", "gap", "gridTemplateColumns", "gridTemplateRows",
      "overflow", "float", "clear", "zIndex",
    ],
  },
  {
    name: "Spacing",
    icon: <Box className="w-3.5 h-3.5" />,
    properties: [
      "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
    ],
  },
  {
    name: "Size",
    icon: <Ruler className="w-3.5 h-3.5" />,
    properties: ["width", "height", "maxWidth", "maxHeight", "minHeight", "minWidth"],
  },
  {
    name: "Typography",
    icon: <Type className="w-3.5 h-3.5" />,
    properties: [
      "fontSize", "fontWeight", "lineHeight", "textAlign", "color",
      "letterSpacing", "fontFamily", "textDecoration", "textTransform",
      "whiteSpace", "verticalAlign", "listStyleType",
    ],
  },
  {
    name: "Fill & Border",
    icon: <Palette className="w-3.5 h-3.5" />,
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

  const formatProperty = (prop: string) => {
    return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
  };

  // Try to extract a color swatch from the value
  const colorMatch = typeof value === "string"
    ? value.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/)
    : null;
  const swatchColor = isColor && colorMatch ? colorMatch[0] : null;

  return (
    <div className="flex items-center h-7 group hover:bg-[#ffffff06] px-3">
      <span
        className="w-[120px] shrink-0 text-[11px] text-muted-foreground truncate"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {formatProperty(property)}
      </span>
      <div className="flex-1 flex items-center gap-1.5">
        {swatchColor && (
          <span
            className="w-3 h-3 rounded-sm border border-[#333333] shrink-0"
            style={{ background: swatchColor }}
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
              if (e.key === "Escape") {
                setEditValue(value);
                setEditing(false);
              }
            }}
            className="flex-1 bg-[#0070f3]/10 border border-[#0070f3]/30 rounded px-1.5 py-0 text-[11px] text-foreground focus:outline-none"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
        ) : (
          <span
            className="flex-1 text-[11px] text-foreground truncate cursor-text"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            onClick={() => {
              setEditValue(value);
              setEditing(true);
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
  const activeProperties = category.properties.filter(
    (p) => elementStyles[p] !== undefined && elementStyles[p] !== ""
  );

  if (activeProperties.length === 0) return null;

  return (
    <div className="border-b border-[#1a1a1a]">
      <button
        className="flex items-center w-full px-3 py-2 hover:bg-[#ffffff06] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground mr-1.5" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground mr-1.5" />
        )}
        <span className="mr-1.5 text-muted-foreground">{category.icon}</span>
        <span className="text-[11px] text-foreground">{category.name}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {activeProperties.length}
        </span>
      </button>
      {expanded && (
        <div className="pb-1">
          {activeProperties.map((prop) => (
            <StylePropertyRow
              key={prop}
              property={prop}
              value={elementStyles[prop]}
              elementId={elementId}
            />
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
      <div className="h-full flex flex-col bg-[#0a0a0a] border-l border-border">
        <div className="px-3 py-2.5 border-b border-border">
          <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
            Style
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            {state.elements.length === 0 ? (
              <>
                <Globe className="w-8 h-8 text-[#222222] mx-auto mb-3" />
                <p className="text-[12px] text-muted-foreground">
                  Connect a project to inspect styles
                </p>
              </>
            ) : (
              <>
                <MousePointer2 className="w-8 h-8 text-[#222222] mx-auto mb-3" />
                <p className="text-[12px] text-muted-foreground">
                  Select an element to inspect its styles
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const styleCount = Object.keys(selectedElement.styles).length;

  const cssOutput = Object.entries(selectedElement.styles)
    .map(
      ([k, v]) =>
        `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`
    )
    .join("\n");

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] border-l border-border">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
            Style
          </span>
          <button
            className="p-1 hover:bg-[#1a1a1a] rounded transition-colors"
            onClick={() => {
              copyToClipboard(
                `${selectedElement.selector} {\n${cssOutput}\n}`
              );
            }}
            title="Copy CSS"
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Element info */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[12px] text-[#0070f3] bg-[#0070f3]/10 px-1.5 py-0.5 rounded"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {"<"}{selectedElement.tag}{">"}
          </span>
          {styleCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {styleCount} properties
            </span>
          )}
        </div>
        {selectedElement.classes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedElement.classes.slice(0, 6).map((cls) => (
              <span
                key={cls}
                className="text-[10px] text-muted-foreground bg-[#111111] px-1.5 py-0.5 rounded border border-[#1a1a1a]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                .{cls}
              </span>
            ))}
            {selectedElement.classes.length > 6 && (
              <span className="text-[10px] text-muted-foreground">
                +{selectedElement.classes.length - 6}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["styles", "computed", "code"] as const).map((t) => (
          <button
            key={t}
            className={`flex-1 py-2 text-[11px] transition-colors ${
              tab === t
                ? "text-foreground border-b border-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {tab === "styles" && (
          <div>
            {STYLE_CATEGORIES.map((cat) => (
              <StyleSection
                key={cat.name}
                category={cat}
                elementStyles={selectedElement.styles}
                elementId={selectedElement.id}
              />
            ))}
            {styleCount === 0 && (
              <div className="p-6 text-center">
                <p className="text-[12px] text-muted-foreground">
                  No computed styles available yet.
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Click this element in the preview to load styles.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "computed" && (
          <div className="p-3">
            {/* Box model visualization */}
            <div className="mb-4">
              <span className="text-[11px] text-muted-foreground mb-2 block">
                Box Model
              </span>
              <div className="bg-[#ff980020] border border-[#ff980040] rounded-lg p-3 text-center">
                <div className="text-[10px] text-[#ff9800] mb-1">
                  margin
                  <span className="text-[9px] opacity-60 ml-1">
                    {selectedElement.styles.margin || selectedElement.styles.marginTop || "0"}
                  </span>
                </div>
                <div className="bg-[#4caf5020] border border-[#4caf5040] rounded p-3">
                  <div className="text-[10px] text-[#4caf50] mb-1">
                    padding
                    <span className="text-[9px] opacity-60 ml-1">
                      {selectedElement.styles.padding || selectedElement.styles.paddingTop || "0"}
                    </span>
                  </div>
                  <div className="bg-[#2196f320] border border-[#2196f340] rounded p-2">
                    <span className="text-[11px] text-[#2196f3]">
                      {selectedElement.styles.width || "auto"} x{" "}
                      {selectedElement.styles.height || "auto"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Selector */}
            <div className="mb-3">
              <span className="text-[11px] text-muted-foreground mb-1 block">
                Selector
              </span>
              <code
                className="text-[11px] text-[#50e3c2] bg-[#111111] px-2 py-1.5 rounded block border border-[#1a1a1a] break-all"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {selectedElement.selector}
              </code>
            </div>

            {/* All properties flat list */}
            <div>
              <span className="text-[11px] text-muted-foreground mb-2 block">
                All Properties ({styleCount})
              </span>
              <div className="space-y-0">
                {Object.entries(selectedElement.styles)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center py-1 text-[10px] border-b border-[#111111]"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      <span className="text-muted-foreground w-[110px] shrink-0 truncate">
                        {k.replace(/([A-Z])/g, "-$1").toLowerCase()}
                      </span>
                      <span className="text-foreground truncate">{v}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {tab === "code" && (
          <div className="p-3">
            <pre
              className="text-[11px] text-foreground bg-[#111111] p-3 rounded border border-[#1a1a1a] overflow-x-auto whitespace-pre"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span className="text-muted-foreground">{"/* CSS */\n"}</span>
              <span className="text-[#50e3c2]">{selectedElement.selector}</span>
              <span className="text-muted-foreground">{" {\n"}</span>
              {Object.entries(selectedElement.styles).map(([k, v]) => (
                <span key={k}>
                  <span className="text-[#79b8ff]">
                    {"  "}
                    {k.replace(/([A-Z])/g, "-$1").toLowerCase()}
                  </span>
                  <span className="text-muted-foreground">{": "}</span>
                  <span className="text-[#f5a623]">{v}</span>
                  <span className="text-muted-foreground">{";\n"}</span>
                </span>
              ))}
              <span className="text-muted-foreground">{"}"}</span>
            </pre>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}