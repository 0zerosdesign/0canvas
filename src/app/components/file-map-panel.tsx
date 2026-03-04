import React, { useState, useMemo } from "react";
import {
  FileCode,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  ExternalLink,
  MapPin,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Eye,
} from "lucide-react";
import { useWorkspace, FileMapping, findElement } from "../store";
import { ScrollArea } from "./ui/scroll-area";

// ──────────────────────────────────────────────────────────
// Heuristic file mapper (client-side inference)
// ──────────────────────────────────────────────────────────
function inferFileMappings(
  elements: any[],
  framework: string
): FileMapping[] {
  const mappings: FileMapping[] = [];

  function walk(el: any) {
    const mapping = inferSingleMapping(el, framework);
    if (mapping) mappings.push(mapping);
    if (el.children) el.children.forEach(walk);
  }

  elements.forEach(walk);
  return mappings;
}

function inferSingleMapping(
  el: any,
  framework: string
): FileMapping | null {
  const classes = el.classes || [];
  const tag = el.tag || "";
  const selector = el.selector || "";

  // Check for common component patterns in class names
  const componentPatterns: [RegExp, string, string][] = [
    [/navbar|nav-bar|navigation/i, "Navbar", "components/Navbar"],
    [/header/i, "Header", "components/Header"],
    [/footer/i, "Footer", "components/Footer"],
    [/sidebar/i, "Sidebar", "components/Sidebar"],
    [/hero/i, "Hero", "components/Hero"],
    [/card/i, "Card", "components/Card"],
    [/button|btn/i, "Button", "components/ui/Button"],
    [/modal|dialog/i, "Modal", "components/Modal"],
    [/form/i, "Form", "components/Form"],
    [/input/i, "Input", "components/ui/Input"],
    [/avatar/i, "Avatar", "components/Avatar"],
    [/badge/i, "Badge", "components/ui/Badge"],
    [/dropdown/i, "Dropdown", "components/Dropdown"],
    [/tooltip/i, "Tooltip", "components/ui/Tooltip"],
    [/table/i, "Table", "components/Table"],
    [/tab/i, "Tabs", "components/Tabs"],
    [/accordion/i, "Accordion", "components/Accordion"],
    [/carousel|slider/i, "Carousel", "components/Carousel"],
    [/search/i, "Search", "components/Search"],
    [/pricing/i, "Pricing", "components/Pricing"],
    [/features?/i, "Features", "components/Features"],
    [/testimonial/i, "Testimonials", "components/Testimonials"],
    [/cta|call.?to.?action/i, "CTA", "components/CTA"],
    [/banner/i, "Banner", "components/Banner"],
  ];

  // Check class names and selector for component patterns
  const allText = [...classes, selector, tag].join(" ");
  for (const [pattern, name, path] of componentPatterns) {
    if (pattern.test(allText)) {
      const ext = framework.toLowerCase().includes("next")
        ? ".tsx"
        : framework.toLowerCase().includes("vue")
        ? ".vue"
        : framework.toLowerCase().includes("svelte")
        ? ".svelte"
        : ".tsx";

      return {
        elementId: el.id,
        filePath: `src/${path}${ext}`,
        componentName: name,
        confidence: classes.some((c: string) => pattern.test(c))
          ? "high"
          : "medium",
      };
    }
  }

  // Infer from semantic HTML elements
  const semanticMap: Record<string, [string, string]> = {
    nav: ["Navigation", "components/Navigation"],
    header: ["Header", "layouts/Header"],
    footer: ["Footer", "layouts/Footer"],
    main: ["Main", "layouts/Main"],
    aside: ["Sidebar", "components/Sidebar"],
    article: ["Article", "components/Article"],
    section: ["Section", "components/Section"],
    form: ["Form", "components/Form"],
  };

  if (semanticMap[tag]) {
    const [name, path] = semanticMap[tag];
    return {
      elementId: el.id,
      filePath: `src/${path}.tsx`,
      componentName: name,
      confidence: "medium",
    };
  }

  return null;
}

// ──────────────────────────────────────────────────────────
// File tree grouping
// ──────────────────────────────────────────────────────────
type FileTreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
  mappings: FileMapping[];
};

function buildFileTree(mappings: FileMapping[]): FileTreeNode {
  const root: FileTreeNode = {
    name: "src",
    path: "src",
    isDir: true,
    children: [],
    mappings: [],
  };

  for (const m of mappings) {
    const parts = m.filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        let existing = current.children.find(
          (c) => !c.isDir && c.name === part
        );
        if (!existing) {
          existing = {
            name: part,
            path: m.filePath,
            isDir: false,
            children: [],
            mappings: [],
          };
          current.children.push(existing);
        }
        existing.mappings.push(m);
      } else {
        let dir = current.children.find((c) => c.isDir && c.name === part);
        if (!dir) {
          dir = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
            mappings: [],
          };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  // Sort: directories first, then files
  function sortTree(node: FileTreeNode) {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
  }

  sortTree(root);
  return root;
}

// ──────────────────────────────────────────────────────────
// File tree item component
// ──────────────────────────────────────────────────────────
function FileTreeItem({
  node,
  depth = 0,
  onSelectElement,
}: {
  node: FileTreeNode;
  depth?: number;
  onSelectElement: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  const confidenceColor = {
    high: "#50e3c2",
    medium: "#f5a623",
    low: "#666666",
  };

  if (!node.isDir) {
    return (
      <div>
        <div
          className="flex items-center gap-1.5 py-1 px-2 hover:bg-[#111111] rounded transition-colors group"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <FileCode className="w-3.5 h-3.5 text-[#0070f3] shrink-0" />
          <span className="text-[11px] text-foreground truncate flex-1">
            {node.name}
          </span>
          <span className="text-[9px] text-muted-foreground bg-[#1a1a1a] px-1 py-0.5 rounded">
            {node.mappings.length}
          </span>
        </div>
        {node.mappings.map((m) => (
          <button
            key={m.elementId}
            onClick={() => onSelectElement(m.elementId)}
            className="w-full flex items-center gap-1.5 py-1 px-2 hover:bg-[#0070f3]/5 rounded transition-colors text-left group"
            style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
          >
            <MapPin
              className="w-3 h-3 shrink-0"
              style={{ color: confidenceColor[m.confidence] }}
            />
            <span className="text-[10px] text-muted-foreground truncate flex-1">
              {m.componentName}
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: confidenceColor[m.confidence] }}
            />
            {m.lineNumber && (
              <span
                className="text-[9px] text-muted-foreground"
                style={{ fontFamily: "'Geist Mono', monospace" }}
              >
                L{m.lineNumber}
              </span>
            )}
            <Eye className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        className="w-full flex items-center gap-1.5 py-1 px-2 hover:bg-[#111111] rounded transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
        <FolderOpen className="w-3.5 h-3.5 text-[#f5a623] shrink-0" />
        <span className="text-[11px] text-foreground truncate">{node.name}</span>
      </button>
      {expanded &&
        node.children.map((child) => (
          <FileTreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            onSelectElement={onSelectElement}
          />
        ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main panel component
// ──────────────────────────────────────────────────────────
export function FileMapPanel() {
  const { state, dispatch } = useWorkspace();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"tree" | "element">("tree");

  // Generate inferred mappings if none from server
  const allMappings = useMemo(() => {
    if (state.fileMappings.length > 0) return state.fileMappings;
    return inferFileMappings(
      state.elements,
      state.project?.framework || "react"
    );
  }, [state.fileMappings, state.elements, state.project?.framework]);

  const filteredMappings = useMemo(() => {
    if (!search) return allMappings;
    const lower = search.toLowerCase();
    return allMappings.filter(
      (m) =>
        m.filePath.toLowerCase().includes(lower) ||
        m.componentName.toLowerCase().includes(lower)
    );
  }, [allMappings, search]);

  const fileTree = useMemo(
    () => buildFileTree(filteredMappings),
    [filteredMappings]
  );

  // Get mapping for selected element
  const selectedMapping = state.selectedElementId
    ? allMappings.find((m) => m.elementId === state.selectedElementId)
    : null;

  const selectedElement = state.selectedElementId
    ? findElement(state.elements, state.selectedElementId)
    : null;

  const handleSelectElement = (id: string) => {
    dispatch({ type: "SELECT_ELEMENT", id });
  };

  const serverMappingCount = state.fileMappings.length;
  const isInferred = serverMappingCount === 0 && allMappings.length > 0;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#0070f3]" />
          <span className="text-[13px] text-foreground">File Map</span>
          {isInferred && (
            <span className="flex items-center gap-1 text-[9px] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.5 rounded">
              <Sparkles className="w-2.5 h-2.5" />
              Inferred
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {allMappings.length} mappings
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["tree", "element"] as const).map((t) => (
          <button
            key={t}
            className={`flex-1 py-2 text-[11px] transition-colors ${
              tab === t
                ? "text-foreground border-b border-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "tree" ? "File Tree" : "Selected"}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab === "tree" && (
        <div className="px-3 py-2 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded-lg px-2.5 h-[28px]">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search files or components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        {tab === "tree" && (
          <div className="py-1">
            {allMappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <FileCode className="w-8 h-8 text-[#1a1a1a] mb-3" />
                <p className="text-[12px] text-muted-foreground mb-1">
                  No file mappings
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Load a page to auto-detect component-to-file mappings, or
                  connect an IDE for precise resolution
                </p>
              </div>
            ) : (
              fileTree.children.map((child) => (
                <FileTreeItem
                  key={child.path}
                  node={child}
                  onSelectElement={handleSelectElement}
                />
              ))
            )}
          </div>
        )}

        {tab === "element" && (
          <div className="p-3">
            {!selectedElement ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MapPin className="w-8 h-8 text-[#1a1a1a] mb-3" />
                <p className="text-[12px] text-muted-foreground mb-1">
                  No element selected
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Select an element to see its file mapping
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Selected element info */}
                <div className="p-3 bg-[#111111] rounded-xl border border-[#1a1a1a]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[12px] text-[#0070f3]">
                      &lt;{selectedElement.tag}&gt;
                    </span>
                    {selectedElement.classes.length > 0 && (
                      <span
                        className="text-[10px] text-muted-foreground truncate"
                        style={{ fontFamily: "'Geist Mono', monospace" }}
                      >
                        .{selectedElement.classes[0]}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-[10px] text-muted-foreground"
                    style={{ fontFamily: "'Geist Mono', monospace" }}
                  >
                    {selectedElement.selector}
                  </p>
                </div>

                {/* Mapped file */}
                {selectedMapping ? (
                  <div className="p-3 border border-[#0070f3]/20 bg-[#0070f3]/5 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <FileCode className="w-4 h-4 text-[#0070f3]" />
                      <span className="text-[12px] text-foreground">
                        {selectedMapping.componentName}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background:
                            selectedMapping.confidence === "high"
                              ? "#50e3c2"
                              : selectedMapping.confidence === "medium"
                              ? "#f5a623"
                              : "#666666",
                        }}
                      />
                    </div>
                    <p
                      className="text-[11px] text-muted-foreground mb-1"
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    >
                      {selectedMapping.filePath}
                      {selectedMapping.lineNumber
                        ? `:${selectedMapping.lineNumber}`
                        : ""}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{
                          background:
                            selectedMapping.confidence === "high"
                              ? "rgba(80,227,194,0.1)"
                              : "rgba(245,166,35,0.1)",
                          color:
                            selectedMapping.confidence === "high"
                              ? "#50e3c2"
                              : "#f5a623",
                        }}
                      >
                        {selectedMapping.confidence} confidence
                      </span>
                      {isInferred && (
                        <span className="text-[9px] text-muted-foreground">
                          (heuristic)
                        </span>
                      )}
                    </div>

                    <button className="w-full mt-3 flex items-center justify-center gap-1.5 py-1.5 border border-[#0070f3]/30 rounded-lg text-[10px] text-[#0070f3] hover:bg-[#0070f3]/10 transition-colors">
                      <ExternalLink className="w-3 h-3" />
                      Open in IDE
                    </button>
                  </div>
                ) : (
                  <div className="p-3 border border-[#1a1a1a] rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[12px] text-muted-foreground">
                        No mapping found
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      This element doesn't match any known component pattern.
                      Connect an IDE for exact file resolution via source maps.
                    </p>
                  </div>
                )}

                {/* Related mappings */}
                {selectedElement.children.length > 0 && (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Child Components
                    </span>
                    {allMappings
                      .filter((m) =>
                        selectedElement.children.some(
                          (c: any) => c.id === m.elementId
                        )
                      )
                      .slice(0, 8)
                      .map((m) => (
                        <button
                          key={m.elementId}
                          onClick={() => handleSelectElement(m.elementId)}
                          className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-[#111111] rounded transition-colors text-left"
                        >
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-foreground">
                            {m.componentName}
                          </span>
                          <span
                            className="text-[9px] text-muted-foreground flex-1 truncate"
                            style={{ fontFamily: "'Geist Mono', monospace" }}
                          >
                            {m.filePath}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Confidence legend */}
      <div className="px-3 py-2 border-t border-[#1a1a1a] flex items-center gap-3">
        <span className="text-[9px] text-muted-foreground">Confidence:</span>
        {(
          [
            ["#50e3c2", "High"],
            ["#f5a623", "Med"],
            ["#666666", "Low"],
          ] as const
        ).map(([color, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: color }}
            />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}