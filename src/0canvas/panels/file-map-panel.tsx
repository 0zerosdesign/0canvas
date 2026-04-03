import React, { useState, useMemo, useCallback } from "react";
import {
  FileCode,
  FolderOpen,
  FolderClosed,
  ChevronRight,
  ChevronDown,
  Search,
  ExternalLink,
  MapPin,
  Sparkles,
  ArrowRight,
  Eye,
  Box,
  Layout,
  Type,
  Image,
  Link2,
  Square,
  Layers,
} from "lucide-react";
import { useWorkspace, FileMapping, ElementNode, findElement } from "../store/store";

/** Confidence-level colors using design tokens */
const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#10B981",   // var(--green-500)
  medium: "#F59E0B", // var(--yellow-500)
  low: "#EF4444",    // var(--red-500)
};

// ── Enhanced inference engine ──────────────────────────────

const COMPONENT_PATTERNS: [RegExp, string, string][] = [
  [/navbar|nav-bar|navigation|main-nav/i, "Navbar", "components/Navbar"],
  [/header|site-header|app-header/i, "Header", "components/Header"],
  [/footer|site-footer|app-footer/i, "Footer", "components/Footer"],
  [/sidebar|side-bar|side-nav/i, "Sidebar", "components/Sidebar"],
  [/hero|hero-section|hero-banner/i, "Hero", "components/Hero"],
  [/card|product-card|info-card/i, "Card", "components/Card"],
  [/button|btn|cta-button/i, "Button", "components/ui/Button"],
  [/modal|dialog|popup|overlay/i, "Modal", "components/Modal"],
  [/form|login-form|signup-form|contact-form/i, "Form", "components/Form"],
  [/input|text-input|search-input/i, "Input", "components/ui/Input"],
  [/avatar|user-avatar|profile-pic/i, "Avatar", "components/Avatar"],
  [/badge|status-badge|label-badge/i, "Badge", "components/ui/Badge"],
  [/dropdown|select-menu|popover/i, "Dropdown", "components/Dropdown"],
  [/tooltip|hint/i, "Tooltip", "components/ui/Tooltip"],
  [/table|data-table/i, "Table", "components/Table"],
  [/tabs?|tab-panel/i, "Tabs", "components/Tabs"],
  [/accordion|collapsible/i, "Accordion", "components/Accordion"],
  [/carousel|slider|swiper/i, "Carousel", "components/Carousel"],
  [/search|search-bar|search-box/i, "SearchBar", "components/SearchBar"],
  [/pricing|price-card|plan/i, "Pricing", "components/Pricing"],
  [/features?|feature-grid|feature-list/i, "Features", "components/Features"],
  [/testimonial|review|quote/i, "Testimonials", "components/Testimonials"],
  [/cta|call.?to.?action/i, "CTA", "components/CTA"],
  [/banner|alert-banner|notification/i, "Banner", "components/Banner"],
  [/breadcrumb/i, "Breadcrumb", "components/Breadcrumb"],
  [/pagination|pager/i, "Pagination", "components/Pagination"],
  [/progress|loader|spinner|loading/i, "Progress", "components/ui/Progress"],
  [/toggle|switch/i, "Toggle", "components/ui/Toggle"],
  [/checkbox|check-box/i, "Checkbox", "components/ui/Checkbox"],
  [/radio|radio-group/i, "Radio", "components/ui/Radio"],
  [/textarea|text-area/i, "Textarea", "components/ui/Textarea"],
  [/select|combo-box/i, "Select", "components/ui/Select"],
  [/code|code-block|code-window|syntax/i, "CodeBlock", "components/CodeBlock"],
  [/stats?|statistics|metric/i, "Stats", "components/Stats"],
  [/grid|masonry/i, "Grid", "components/Grid"],
  [/list|item-list/i, "List", "components/List"],
  [/logo/i, "Logo", "components/Logo"],
  [/menu|hamburger/i, "Menu", "components/Menu"],
  [/notification|toast|snackbar/i, "Toast", "components/Toast"],
  [/skeleton|placeholder/i, "Skeleton", "components/ui/Skeleton"],
  [/divider|separator|hr/i, "Divider", "components/ui/Divider"],
  [/chip|tag/i, "Tag", "components/ui/Tag"],
  [/stepper|wizard|step/i, "Stepper", "components/Stepper"],
  [/profile|user-profile/i, "Profile", "components/Profile"],
  [/gallery|image-grid/i, "Gallery", "components/Gallery"],
  [/timeline/i, "Timeline", "components/Timeline"],
  [/chat|message/i, "Chat", "components/Chat"],
  [/map|location/i, "Map", "components/Map"],
  [/video|player/i, "VideoPlayer", "components/VideoPlayer"],
  [/social|share/i, "Social", "components/Social"],
];

const SEMANTIC_MAP: Record<string, [string, string]> = {
  nav: ["Navigation", "components/Navigation"],
  header: ["Header", "layouts/Header"],
  footer: ["Footer", "layouts/Footer"],
  main: ["Main", "layouts/Main"],
  aside: ["Sidebar", "components/Sidebar"],
  article: ["Article", "components/Article"],
  section: ["Section", "components/Section"],
  form: ["Form", "components/Form"],
  dialog: ["Dialog", "components/Dialog"],
  details: ["Details", "components/Details"],
};

function getFileExtension(framework: string): string {
  const f = framework.toLowerCase();
  if (f.includes("next") || f.includes("react") || f.includes("remix")) return ".tsx";
  if (f.includes("vue") || f.includes("nuxt")) return ".vue";
  if (f.includes("svelte") || f.includes("sveltekit")) return ".svelte";
  if (f.includes("angular")) return ".component.ts";
  if (f.includes("astro")) return ".astro";
  if (f.includes("solid")) return ".tsx";
  return ".tsx";
}

function inferFileMappings(
  elements: ElementNode[],
  framework: string
): FileMapping[] {
  const mappings: FileMapping[] = [];
  const ext = getFileExtension(framework);
  const seen = new Set<string>();

  function walk(el: ElementNode) {
    const mapping = inferSingleMapping(el, ext, seen);
    if (mapping) mappings.push(mapping);
    if (el.children) el.children.forEach(walk);
  }

  elements.forEach(walk);
  return mappings;
}

function inferSingleMapping(
  el: ElementNode,
  ext: string,
  seen: Set<string>
): FileMapping | null {
  const classes = el.classes || [];
  const tag = el.tag || "";
  const selector = el.selector || "";
  const text = el.text || "";
  const id = el.id || "";

  // Build a searchable string from all sources
  const allText = [...classes, selector, tag, id].join(" ");

  // Check class names, selectors, IDs against component patterns
  for (const [pattern, name, path] of COMPONENT_PATTERNS) {
    if (pattern.test(allText)) {
      const confidence: "high" | "medium" | "low" = classes.some((c: string) => pattern.test(c))
        ? "high"
        : selector && pattern.test(selector)
        ? "medium"
        : "medium";

      const key = `${path}-${el.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      return {
        elementId: el.id,
        filePath: `src/${path}${ext}`,
        componentName: name,
        confidence,
      };
    }
  }

  // Infer from semantic HTML elements
  if (SEMANTIC_MAP[tag]) {
    const [name, path] = SEMANTIC_MAP[tag];
    const key = `${path}-${el.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      return {
        elementId: el.id,
        filePath: `src/${path}${ext}`,
        componentName: name,
        confidence: "medium",
      };
    }
  }

  // Infer from data-component / data-testid attributes (if present in selector)
  const dataMatch = selector.match(/\[data-(?:component|testid)="([^"]+)"\]/);
  if (dataMatch) {
    const componentName = dataMatch[1]
      .split(/[-_]/)
      .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");
    const key = `components/${componentName}-${el.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      return {
        elementId: el.id,
        filePath: `src/components/${componentName}${ext}`,
        componentName,
        confidence: "high",
      };
    }
  }

  // Infer from ARIA roles
  const roleMatch = selector.match(/\[role="([^"]+)"\]/);
  if (roleMatch) {
    const role = roleMatch[1];
    const roleMap: Record<string, [string, string]> = {
      navigation: ["Navigation", "components/Navigation"],
      banner: ["Banner", "components/Banner"],
      contentinfo: ["Footer", "components/Footer"],
      dialog: ["Dialog", "components/Dialog"],
      alert: ["Alert", "components/Alert"],
      tablist: ["Tabs", "components/Tabs"],
      menu: ["Menu", "components/Menu"],
      search: ["SearchBar", "components/SearchBar"],
    };
    if (roleMap[role]) {
      const [name, path] = roleMap[role];
      const key = `${path}-${el.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        return {
          elementId: el.id,
          filePath: `src/${path}${ext}`,
          componentName: name,
          confidence: "medium",
        };
      }
    }
  }

  return null;
}

// ── File tree types ────────────────────────────────────────

type FileTreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
  mappings: FileMapping[];
};

function buildFileTree(mappings: FileMapping[]): FileTreeNode {
  const root: FileTreeNode = { name: "src", path: "src", isDir: true, children: [], mappings: [] };

  for (const m of mappings) {
    const parts = m.filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        let existing = current.children.find((c) => !c.isDir && c.name === part);
        if (!existing) {
          existing = { name: part, path: m.filePath, isDir: false, children: [], mappings: [] };
          current.children.push(existing);
        }
        existing.mappings.push(m);
      } else {
        let dir = current.children.find((c) => c.isDir && c.name === part);
        if (!dir) {
          dir = { name: part, path: parts.slice(0, i + 1).join("/"), isDir: true, children: [], mappings: [] };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

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

function countTreeMappings(node: FileTreeNode): number {
  let count = node.mappings.length;
  for (const child of node.children) count += countTreeMappings(child);
  return count;
}

// ── Components ─────────────────────────────────────────────

function getElementIcon(tag: string) {
  const size = 12;
  const props = { size, strokeWidth: 1.5 };
  switch (tag) {
    case "nav": case "header": case "footer": case "aside": case "main":
      return <Layout {...props} />;
    case "section": case "article": case "div":
      return <Box {...props} />;
    case "button": case "input": case "textarea": case "select": case "form":
      return <Square {...props} />;
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
    case "p": case "span": case "label":
      return <Type {...props} />;
    case "a":
      return <Link2 {...props} />;
    case "img": case "svg": case "picture": case "video":
      return <Image {...props} />;
    default:
      return <Box {...props} />;
  }
}

function FileTreeItem({
  node,
  depth = 0,
  onSelectElement,
  selectedElementId,
}: {
  node: FileTreeNode;
  depth?: number;
  onSelectElement: (id: string) => void;
  selectedElementId: string | null;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const mappingCount = countTreeMappings(node);
  const hasSelectedChild = node.mappings.some((m) => m.elementId === selectedElementId);

  if (!node.isDir) {
    return (
      <div>
        <div
          className={`oc-filemap-tree-row${hasSelectedChild ? " is-selected" : ""}`}
          onClick={() => setExpanded(!expanded)}
          style={{ paddingLeft: depth * 14 + 8 }}
        >
          {node.mappings.length > 0 ? (
            expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />
          ) : (
            <span className="oc-filemap-chevron-spacer" />
          )}
          <FileCode size={13} className="shrink-0" />
          <span className="oc-filemap-filename">
            {node.name}
          </span>
          {node.mappings.length > 0 && (
            <span className="oc-filemap-badge">
              {node.mappings.length}
            </span>
          )}
        </div>
        {expanded && node.mappings.map((m) => (
          <MappingItem
            key={m.elementId}
            mapping={m}
            depth={depth + 1}
            onSelect={() => onSelectElement(m.elementId)}
            isSelected={m.elementId === selectedElementId}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        className="oc-filemap-tree-row"
        onClick={() => setExpanded(!expanded)}
        style={{ paddingLeft: depth * 14 + 8 }}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {expanded ? <FolderOpen size={13} /> : <FolderClosed size={13} />}
        <span className="oc-filemap-filename">{node.name}</span>
        {mappingCount > 0 && (
          <span className="oc-filemap-dir-count">
            {mappingCount}
          </span>
        )}
      </div>
      {expanded && node.children.map((child) => (
        <FileTreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          onSelectElement={onSelectElement}
          selectedElementId={selectedElementId}
        />
      ))}
    </div>
  );
}

function MappingItem({
  mapping,
  depth,
  onSelect,
  isSelected,
}: {
  mapping: FileMapping;
  depth: number;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const color = CONFIDENCE_COLORS[mapping.confidence];

  return (
    <button
      className={`oc-filemap-mapping${isSelected ? " is-selected" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{ paddingLeft: (depth + 1) * 14 + 8 }}
    >
      <MapPin size={10} style={{ color, flexShrink: 0 }} />
      <span className="oc-filemap-mapping-name">
        {mapping.componentName}
      </span>
      <span className="oc-filemap-mapping-dot" style={{ background: color }} />
      <Eye size={10} className="oc-filemap-mapping-eye" />
    </button>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const color = CONFIDENCE_COLORS[confidence];
  return (
    <span className="oc-filemap-conf-badge" style={{ background: `${color}15`, color }}>
      <span className="oc-filemap-conf-dot" style={{ background: color }} />
      {confidence}
    </span>
  );
}

// ── Selected element panel ─────────────────────────────────

function SelectedElementView({
  element,
  mapping,
  allMappings,
  isInferred,
  onSelectElement,
}: {
  element: ElementNode;
  mapping: FileMapping | null;
  allMappings: FileMapping[];
  isInferred: boolean;
  onSelectElement: (id: string) => void;
}) {
  const childMappings = allMappings.filter((m) =>
    element.children.some((c: ElementNode) => c.id === m.elementId)
  );

  return (
    <div className="oc-filemap-detail">
      {/* Element info card */}
      <div className="oc-filemap-card">
        <div className="oc-filemap-card-row">
          <span className="oc-filemap-card-tag">{getElementIcon(element.tag)}</span>
          <span className="oc-filemap-card-tag">
            &lt;{element.tag}&gt;
          </span>
          {element.classes.length > 0 && (
            <span className="oc-filemap-card-classes">
              .{element.classes.slice(0, 2).join(".")}
            </span>
          )}
        </div>
        <div className="oc-filemap-card-selector">
          {element.selector}
        </div>
        {element.text && (
          <div className="oc-filemap-card-text">
            "{element.text.slice(0, 60)}{element.text.length > 60 ? "..." : ""}"
          </div>
        )}
      </div>

      {/* Mapped file card */}
      {mapping ? (
        <div className="oc-filemap-mapped-card">
          <div className="oc-filemap-card-row">
            <FileCode size={14} />
            <span className="oc-filemap-mapped-name">{mapping.componentName}</span>
            <ConfidenceBadge confidence={mapping.confidence} />
          </div>
          <div className="oc-filemap-mapped-path">
            {mapping.filePath}{mapping.lineNumber ? `:${mapping.lineNumber}` : ""}
          </div>
          {isInferred && (
            <div className="oc-filemap-inferred-hint">
              <Sparkles size={10} />
              Heuristic mapping — connect IDE for exact resolution
            </div>
          )}
          <button
            className="oc-filemap-open-btn"
            onClick={() => {
              const vscodeUrl = `vscode://file/${mapping.filePath}${mapping.lineNumber ? `:${mapping.lineNumber}` : ""}`;
              window.open(vscodeUrl, "_blank");
            }}
          >
            <ExternalLink size={12} />
            Open in VS Code
          </button>
        </div>
      ) : (
        <div className="oc-filemap-nomap-card">
          <div className="oc-filemap-card-row">
            <MapPin size={14} />
            <span className="oc-filemap-nomap-title">No file mapping</span>
          </div>
          <div className="oc-filemap-nomap-desc">
            This element doesn't match known component patterns.
            Connect an IDE or add data-component attributes for exact resolution.
          </div>
        </div>
      )}

      {/* Child component mappings */}
      {childMappings.length > 0 && (
        <div>
          <div className="oc-filemap-section-title">
            Child Components ({childMappings.length})
          </div>
          <div className="oc-filemap-children-list">
            {childMappings.slice(0, 10).map((m) => (
              <button
                key={m.elementId}
                className="oc-filemap-child-btn"
                onClick={() => onSelectElement(m.elementId)}
              >
                <ArrowRight size={10} />
                <span className="oc-filemap-child-name">{m.componentName}</span>
                <span className="oc-filemap-child-path">
                  {m.filePath.split("/").pop()}
                </span>
                <ConfidenceBadge confidence={m.confidence} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary stats ──────────────────────────────────────────

function StatsBar({ mappings }: { mappings: FileMapping[] }) {
  const high = mappings.filter((m) => m.confidence === "high").length;
  const medium = mappings.filter((m) => m.confidence === "medium").length;
  const low = mappings.filter((m) => m.confidence === "low").length;
  const uniqueFiles = new Set(mappings.map((m) => m.filePath)).size;

  return (
    <div className="oc-filemap-stats">
      <div className="oc-filemap-stat">
        <FileCode size={10} />
        <span className="oc-filemap-stat-label">{uniqueFiles} files</span>
      </div>
      <div className="oc-filemap-stat">
        <Layers size={10} />
        <span className="oc-filemap-stat-label">{mappings.length} components</span>
      </div>
      <div className="flex-1" />
      <div className="oc-filemap-stat-dots">
        {high > 0 && <span className="oc-filemap-stat-dot">
          <span className="oc-filemap-dot" style={{ background: CONFIDENCE_COLORS.high }} />
          <span className="oc-filemap-dot-count">{high}</span>
        </span>}
        {medium > 0 && <span className="oc-filemap-stat-dot">
          <span className="oc-filemap-dot" style={{ background: CONFIDENCE_COLORS.medium }} />
          <span className="oc-filemap-dot-count">{medium}</span>
        </span>}
        {low > 0 && <span className="oc-filemap-stat-dot">
          <span className="oc-filemap-dot" style={{ background: CONFIDENCE_COLORS.low }} />
          <span className="oc-filemap-dot-count">{low}</span>
        </span>}
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────

export function FileMapPanel() {
  const { state, dispatch } = useWorkspace();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"tree" | "element">("tree");

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

  const fileTree = useMemo(() => buildFileTree(filteredMappings), [filteredMappings]);

  const selectedMapping = state.selectedElementId
    ? allMappings.find((m) => m.elementId === state.selectedElementId) || null
    : null;

  const selectedElement = state.selectedElementId
    ? findElement(state.elements, state.selectedElementId) || null
    : null;

  const handleSelectElement = useCallback((id: string) => {
    dispatch({ type: "SELECT_ELEMENT", id, source: "panel" });
  }, [dispatch]);

  const isInferred = state.fileMappings.length === 0 && allMappings.length > 0;

  return (
    <div className="oc-panel">
      {/* Header */}
      <div className="oc-filemap-header">
        <div className="oc-filemap-header-left">
          <FileCode size={14} />
          <span className="oc-filemap-header-title">File Map</span>
          {isInferred && (
            <span className="oc-filemap-inferred-badge">
              <Sparkles size={9} />
              Inferred
            </span>
          )}
        </div>
        <span className="oc-filemap-header-count">
          {allMappings.length}
        </span>
      </div>

      {/* Stats */}
      {allMappings.length > 0 && <StatsBar mappings={allMappings} />}

      {/* Tabs */}
      <div className="oc-filemap-tabs">
        {(["tree", "element"] as const).map((t) => (
          <button
            key={t}
            className={`oc-filemap-tab${tab === t ? " is-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "tree" ? "File Tree" : "Selected"}
          </button>
        ))}
      </div>

      {/* Search (tree tab only) */}
      {tab === "tree" && (
        <div className="oc-filemap-search-wrap">
          <div className="oc-filemap-search-box">
            <Search size={12} />
            <input
              className="oc-filemap-search-input"
              type="text"
              placeholder="Search files or components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="oc-filemap-content">
        {tab === "tree" && (
          <div className="oc-filemap-tree-pad">
            {allMappings.length === 0 ? (
              <div className="oc-filemap-empty">
                <FileCode size={32} className="mb-3" />
                <div className="oc-filemap-empty-title">
                  No file mappings
                </div>
                <div className="oc-filemap-empty-desc">
                  Inspect the page to detect component-to-file mappings, or connect an IDE for precise resolution.
                </div>
              </div>
            ) : (
              fileTree.children.map((child) => (
                <FileTreeItem
                  key={child.path}
                  node={child}
                  onSelectElement={handleSelectElement}
                  selectedElementId={state.selectedElementId}
                />
              ))
            )}
          </div>
        )}

        {tab === "element" && (
          selectedElement ? (
            <SelectedElementView
              element={selectedElement}
              mapping={selectedMapping}
              allMappings={allMappings}
              isInferred={isInferred}
              onSelectElement={handleSelectElement}
            />
          ) : (
            <div className="oc-filemap-empty">
              <MapPin size={32} className="mb-3" />
              <div className="oc-filemap-empty-title">
                No element selected
              </div>
              <div className="oc-filemap-empty-desc">
                Click an element in the canvas or layers panel to see its file mapping.
              </div>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="oc-filemap-footer">
        <span className="oc-filemap-footer-label">Confidence:</span>
        {([
          [CONFIDENCE_COLORS.high, "High"],
          [CONFIDENCE_COLORS.medium, "Med"],
          [CONFIDENCE_COLORS.low, "Low"],
        ] as const).map(([color, label]) => (
          <span key={label} className="oc-filemap-legend-item">
            <span className="oc-filemap-legend-dot" style={{ background: color }} />
            <span className="oc-filemap-legend-text">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
