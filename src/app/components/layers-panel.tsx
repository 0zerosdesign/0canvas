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
import { useWorkspace, ElementNode } from "../store";
import { ScrollArea } from "./ui/scroll-area";

const FONT = "'Geist Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const C = {
  bg: "#0a0a0a",
  surface: "#111111",
  border: "#1e1e1e",
  fg: "#ededed",
  fgMuted: "#888888",
  fgDim: "#555555",
  accent: "#0070f3",
};

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
  const [hovered, setHovered] = useState(false);
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

  const rowBg = isSelected
    ? "rgba(0,112,243,0.12)"
    : isHoveredEl || hovered
    ? "rgba(255,255,255,0.03)"
    : "transparent";

  return (
    <div style={{ fontFamily: FONT }}>
      <div
        onMouseEnter={() => {
          setHovered(true);
          dispatch({ type: "HOVER_ELEMENT", id: element.id });
        }}
        onMouseLeave={() => {
          setHovered(false);
          dispatch({ type: "HOVER_ELEMENT", id: null });
        }}
        onClick={() => dispatch({ type: "SELECT_ELEMENT", id: element.id, source: "panel" })}
        style={{
          display: "flex",
          alignItems: "center",
          height: 30,
          paddingLeft: depth * 16 + 8,
          paddingRight: 8,
          cursor: "pointer",
          background: rowBg,
          transition: "background 0.1s ease",
          borderLeft: isSelected ? `2px solid ${C.accent}` : "2px solid transparent",
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            flexShrink: 0,
            background: "transparent",
            border: "none",
            cursor: hasChildren ? "pointer" : "default",
            padding: 0,
            color: C.fgDim,
          }}
        >
          {hasChildren ? (
            expanded || isSearching ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : null}
        </button>

        <span style={{ flexShrink: 0, marginRight: 6, display: "inline-flex" }}>
          {getTagIcon(element.tag)}
        </span>

        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: isSelected ? 500 : 400,
            color: isSelected ? C.accent : C.fg,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            opacity: element.visible ? 1 : 0.35,
          }}
        >
          {displayName}
          {classPreview && (
            <span style={{ color: C.fgDim, marginLeft: 4, fontSize: 10 }}>
              {classPreview}
            </span>
          )}
        </span>

        {hovered && (
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
            <IconBtn
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "TOGGLE_ELEMENT_VISIBILITY", id: element.id });
              }}
            >
              {element.visible ? <Eye size={12} color={C.fgDim} /> : <EyeOff size={12} color={C.fgDim} />}
            </IconBtn>
            <IconBtn
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "TOGGLE_ELEMENT_LOCK", id: element.id });
              }}
            >
              {element.locked ? <Lock size={12} color={C.orange} /> : <Unlock size={12} color={C.fgDim} />}
            </IconBtn>
          </div>
        )}
      </div>

      {(expanded || isSearching) &&
        hasChildren &&
        element.children.map((child) => (
          <LayerItem key={child.id} element={child} depth={depth + 1} search={search} />
        ))}
    </div>
  );
}

const C_ORANGE = "#f5a623";

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: 4,
        background: h ? "rgba(255,255,255,0.06)" : "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

export function LayersPanel() {
  const { state } = useWorkspace();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const elementCount = countElements(state.elements);
  const isEmpty = state.elements.length === 0;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.bg,
        borderRight: `1px solid ${C.border}`,
        fontFamily: FONT,
        color: C.fg,
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: C.fgMuted }}>
          Layers
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: C.fgMuted,
            background: C.surface,
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          {elementCount}
        </span>
      </div>

      <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}` }}>
        <input
          type="text"
          placeholder="Search layers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: "100%",
            background: C.surface,
            border: `1px solid ${searchFocused ? C.accent + "60" : C.border}`,
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            color: C.fg,
            fontFamily: FONT,
            outline: "none",
            transition: "border-color 0.15s ease",
          }}
        />
      </div>

      <ScrollArea style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {isEmpty && state.isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
            <Loader2 size={22} color={C.accent} style={{ animation: "dd-spin 1s linear infinite", marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: C.fgMuted, marginBottom: 4 }}>Loading page...</p>
            <p style={{ fontSize: 11, color: C.fgDim }}>Scanning DOM tree and building layers</p>
          </div>
        ) : isEmpty ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
            <Globe size={28} color="#333" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: C.fgMuted, marginBottom: 4 }}>No page loaded</p>
            <p style={{ fontSize: 11, color: C.fgDim }}>Connect your project to inspect its structure</p>
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
