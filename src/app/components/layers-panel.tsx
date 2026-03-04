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

const TAG_ICONS: Record<string, React.ReactNode> = {
  body: <Layout className="w-3.5 h-3.5 text-blue-400" />,
  html: <Layout className="w-3.5 h-3.5 text-blue-400" />,
  main: <Layout className="w-3.5 h-3.5 text-blue-400" />,
  nav: <Layout className="w-3.5 h-3.5 text-purple-400" />,
  header: <Layout className="w-3.5 h-3.5 text-purple-400" />,
  footer: <Layout className="w-3.5 h-3.5 text-purple-400" />,
  aside: <Layout className="w-3.5 h-3.5 text-indigo-400" />,
  section: <Square className="w-3.5 h-3.5 text-green-400" />,
  article: <FileText className="w-3.5 h-3.5 text-green-400" />,
  div: <Box className="w-3.5 h-3.5 text-muted-foreground" />,
  span: <Type className="w-3.5 h-3.5 text-orange-400" />,
  h1: <Type className="w-3.5 h-3.5 text-yellow-400" />,
  h2: <Type className="w-3.5 h-3.5 text-yellow-400" />,
  h3: <Type className="w-3.5 h-3.5 text-yellow-400" />,
  h4: <Type className="w-3.5 h-3.5 text-yellow-300" />,
  h5: <Type className="w-3.5 h-3.5 text-yellow-300" />,
  h6: <Type className="w-3.5 h-3.5 text-yellow-300" />,
  p: <Type className="w-3.5 h-3.5 text-muted-foreground" />,
  a: <Link2 className="w-3.5 h-3.5 text-blue-400" />,
  button: <Square className="w-3.5 h-3.5 text-blue-500" />,
  input: <Square className="w-3.5 h-3.5 text-cyan-400" />,
  textarea: <Square className="w-3.5 h-3.5 text-cyan-400" />,
  select: <Square className="w-3.5 h-3.5 text-cyan-400" />,
  form: <Square className="w-3.5 h-3.5 text-teal-400" />,
  img: <Image className="w-3.5 h-3.5 text-pink-400" />,
  svg: <Circle className="w-3.5 h-3.5 text-cyan-400" />,
  ul: <List className="w-3.5 h-3.5 text-muted-foreground" />,
  ol: <List className="w-3.5 h-3.5 text-muted-foreground" />,
  li: <Minus className="w-3.5 h-3.5 text-muted-foreground" />,
  table: <Table className="w-3.5 h-3.5 text-indigo-400" />,
  thead: <Table className="w-3.5 h-3.5 text-indigo-300" />,
  tbody: <Table className="w-3.5 h-3.5 text-indigo-300" />,
  tr: <Minus className="w-3.5 h-3.5 text-indigo-300" />,
  td: <Box className="w-3.5 h-3.5 text-indigo-200" />,
  th: <Box className="w-3.5 h-3.5 text-indigo-200" />,
  label: <Type className="w-3.5 h-3.5 text-muted-foreground" />,
  strong: <Type className="w-3.5 h-3.5 text-orange-300" />,
  em: <Type className="w-3.5 h-3.5 text-orange-300" />,
  blockquote: <FileText className="w-3.5 h-3.5 text-blue-300" />,
  code: <Type className="w-3.5 h-3.5 text-green-300" />,
  pre: <FileText className="w-3.5 h-3.5 text-green-300" />,
};

function getIcon(tag: string) {
  return TAG_ICONS[tag] || <Box className="w-3.5 h-3.5 text-muted-foreground" />;
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
  const isHovered = state.hoveredElementId === element.id;

  // If searching, auto-expand matching branches
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
        className={`group flex items-center h-7 cursor-pointer transition-colors ${
          isSelected
            ? "bg-[#0070f3]/15 text-[#0070f3]"
            : isHovered
            ? "bg-[#ffffff08]"
            : "hover:bg-[#ffffff06]"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => dispatch({ type: "SELECT_ELEMENT", id: element.id })}
        onMouseEnter={() => dispatch({ type: "HOVER_ELEMENT", id: element.id })}
        onMouseLeave={() => dispatch({ type: "HOVER_ELEMENT", id: null })}
      >
        {/* Expand toggle */}
        <button
          className="w-4 h-4 flex items-center justify-center shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
        >
          {hasChildren ? (
            expanded || isSearching ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )
          ) : null}
        </button>

        {/* Icon */}
        <span className="ml-0.5 mr-1.5 shrink-0">{getIcon(element.tag)}</span>

        {/* Name */}
        <span
          className={`truncate flex-1 ${
            !element.visible ? "opacity-40" : ""
          }`}
          style={{ fontSize: "12px" }}
        >
          {displayName}
          {classPreview && (
            <span className="text-muted-foreground opacity-50 ml-1" style={{ fontSize: "10px" }}>
              {classPreview}
            </span>
          )}
        </span>

        {/* Actions */}
        <div className="hidden group-hover:flex items-center gap-0.5 mr-2 shrink-0">
          <button
            className="p-0.5 hover:bg-[#ffffff10] rounded"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "TOGGLE_ELEMENT_VISIBILITY", id: element.id });
            }}
          >
            {element.visible ? (
              <Eye className="w-3 h-3 text-muted-foreground" />
            ) : (
              <EyeOff className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
          <button
            className="p-0.5 hover:bg-[#ffffff10] rounded"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "TOGGLE_ELEMENT_LOCK", id: element.id });
            }}
          >
            {element.locked ? (
              <Lock className="w-3 h-3 text-orange-400" />
            ) : (
              <Unlock className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Children */}
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
    <div className="h-full flex flex-col bg-[#0a0a0a] border-r border-border">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
          Layers
        </span>
        <span className="text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded">
          {elementCount}
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <input
          type="text"
          placeholder="Search layers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#111111] border border-[#222222] rounded px-2 py-1 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#333333] transition-colors"
        />
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1 min-h-0">
        {isEmpty && state.isLoading ? (
          <div className="flex flex-col items-center justify-center p-6 pt-16 text-center">
            <Loader2 className="w-6 h-6 text-[#0070f3] animate-spin mb-3" />
            <p className="text-[12px] text-muted-foreground mb-1">
              Loading page...
            </p>
            <p className="text-[10px] text-muted-foreground">
              Scanning DOM tree and building layers
            </p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center p-6 pt-16 text-center">
            <Globe className="w-8 h-8 text-[#222222] mb-3" />
            <p className="text-[12px] text-muted-foreground mb-1">
              No page loaded
            </p>
            <p className="text-[10px] text-muted-foreground">
              Connect your project to inspect its structure
            </p>
          </div>
        ) : (
          <div className="py-1">
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