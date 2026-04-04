import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Box,
  Type,
  Image,
  Link2,
  Layout,
  Square,
  Circle,
  Table,
  List,
  FileText,
  Globe,
  Minus,
  Loader2,
} from "lucide-react";
import { useWorkspace, ElementNode } from "../store/store";
import { ScrollArea } from "../ui/scroll-area";

const ICON_SIZE = 14;

const TAG_COLORS: Record<string, string> = {
  body: "#60a5fa", html: "#60a5fa", main: "#60a5fa",
  nav: "#c084fc", header: "#c084fc", footer: "#c084fc",
  aside: "#818cf8",
  section: "#4ade80", article: "#4ade80",
  span: "#fb923c", strong: "#fdba74", em: "#fdba74",
  h1: "#facc15", h2: "#facc15", h3: "#facc15", h4: "#fde047", h5: "#fde047", h6: "#fde047",
  a: "#60a5fa", button: "#3b82f6",
  input: "#22d3ee", textarea: "#22d3ee", select: "#22d3ee", form: "#2dd4bf",
  img: "#f472b6", svg: "#22d3ee",
  ul: "#888", ol: "#888", li: "#888",
  table: "#818cf8", thead: "#a5b4fc", tbody: "#a5b4fc", tr: "#a5b4fc", td: "#c7d2fe", th: "#c7d2fe",
  label: "#888", code: "#86efac", pre: "#86efac", blockquote: "#93c5fd",
  p: "#888", div: "#888",
};

function getTagIcon(tag: string) {
  const color = TAG_COLORS[tag] || "#888";
  const iconProps = { size: ICON_SIZE, color, strokeWidth: 1.5 };
  switch (tag) {
    case "body": case "html": case "main": case "nav": case "header":
    case "footer": case "aside": return <Layout {...iconProps} />;
    case "section": case "button": case "input": case "textarea":
    case "select": case "form": case "td": case "th": return <Square {...iconProps} />;
    case "article": case "blockquote": case "pre": return <FileText {...iconProps} />;
    case "div": case "box": return <Box {...iconProps} />;
    case "span": case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
    case "p": case "label": case "strong": case "em": case "code": return <Type {...iconProps} />;
    case "a": return <Link2 {...iconProps} />;
    case "img": return <Image {...iconProps} />;
    case "svg": return <Circle {...iconProps} />;
    case "ul": case "ol": return <List {...iconProps} />;
    case "li": case "tr": return <Minus {...iconProps} />;
    case "table": case "thead": case "tbody": return <Table {...iconProps} />;
    default: return <Box {...iconProps} />;
  }
}

function matchesSearch(element: ElementNode, search: string): boolean {
  const s = search.toLowerCase();
  if (element.tag.toLowerCase().includes(s)) return true;
  if (element.text?.toLowerCase().includes(s)) return true;
  if (element.classes.some((c) => c.toLowerCase().includes(s))) return true;
  if (element.selector.toLowerCase().includes(s)) return true;
  return element.children.some((child) => matchesSearch(child, s));
}

function LayerItem({
  element,
  depth = 0,
  search = "",
}: {
  element: ElementNode;
  depth?: number;
  search?: string;
}) {
  const { state, dispatch } = useWorkspace();
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = element.children.length > 0;
  const isSelected = state.selectedElementId === element.id;
  const isHoveredEl = state.hoveredElementId === element.id;

  const isSearching = search.length > 0;
  const shouldShow = !isSearching || matchesSearch(element, search);
  if (!shouldShow) return null;

  const displayName = element.text
    ? `${element.tag} "${element.text.slice(0, 20)}${element.text.length > 20 ? "..." : ""}"`
    : element.tag;

  const classPreview = element.classes.length > 0
    ? `.${element.classes.slice(0, 2).join(".")}`
    : "";

  return (
    <div>
      <div
        className={`oc-layers-row ${isSelected ? "is-selected" : ""} ${isHoveredEl ? "is-hovered-element" : ""}`}
        onMouseEnter={() => dispatch({ type: "HOVER_ELEMENT", id: element.id })}
        onMouseLeave={() => dispatch({ type: "HOVER_ELEMENT", id: null })}
        onClick={() => dispatch({ type: "SELECT_ELEMENT", id: element.id, source: "panel" })}
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        <button
          className="oc-layers-toggle"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
          style={{ cursor: hasChildren ? "pointer" : "default" }}
        >
          {hasChildren ? (
            expanded || isSearching ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : null}
        </button>

        <span className="oc-layers-tag-icon" style={{ color: TAG_COLORS[element.tag] || "#888" }}>
          {getTagIcon(element.tag)}
        </span>

        <span
          className="oc-layers-name"
          style={{ opacity: element.visible ? 1 : 0.35 }}
        >
          {displayName}
          {classPreview && (
            <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.5 }}>
              {classPreview}
            </span>
          )}
        </span>

        <div className="oc-layers-actions">
          <button
            className="oc-layers-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "TOGGLE_ELEMENT_VISIBILITY", id: element.id });
            }}
          >
            {element.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button
            className="oc-layers-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "TOGGLE_ELEMENT_LOCK", id: element.id });
            }}
          >
            {element.locked ? <Lock size={12} style={{ color: "var(--color--status--warning)" }} /> : <Unlock size={12} />}
          </button>
        </div>
      </div>

      {(expanded || isSearching) &&
        hasChildren &&
        element.children.map((child) => (
          <LayerItem key={child.id} element={child} depth={depth + 1} search={search} />
        ))}
    </div>
  );
}

export function LayersPanel() {
  const { state } = useWorkspace();
  const [search, setSearch] = useState("");

  const elementCount = countElements(state.elements);
  const isEmpty = state.elements.length === 0;

  return (
    <div className="oc-panel">
      <div className="oc-panel-header">
        <span className="oc-panel-title">Layers</span>
        <span className="oc-panel-btn">{elementCount}</span>
      </div>

      <div className="oc-panel-section">
        <input
          className="oc-layers-search"
          type="text"
          placeholder="Search layers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ScrollArea className="oc-panel-body">
        {isEmpty && state.isLoading ? (
          <div className="oc-panel-empty">
            <Loader2 size={22} style={{ animation: "oc-spin 1s linear infinite", marginBottom: 12 }} />
            <p style={{ fontSize: 13, marginBottom: 4 }}>Loading page...</p>
            <p style={{ fontSize: 11, opacity: 0.5 }}>Scanning DOM tree and building layers</p>
          </div>
        ) : isEmpty ? (
          <div className="oc-panel-empty">
            <Globe size={28} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 13, marginBottom: 4 }}>No page loaded</p>
            <p style={{ fontSize: 11, opacity: 0.5 }}>Connect your project to inspect its structure</p>
          </div>
        ) : (
          <div style={{ padding: "4px 0" }}>
            {state.elements.map((el) => (
              <LayerItem key={el.id} element={el} search={search} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function countElements(elements: ElementNode[]): number {
  let count = elements.length;
  for (const el of elements) {
    count += countElements(el.children);
  }
  return count;
}
