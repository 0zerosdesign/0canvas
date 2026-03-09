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
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { useWorkspace, FileMapping, ElementNode, findElement } from "../store";

const FONT = "'Geist Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const MONO = "'Geist Mono','SF Mono','Fira Code',monospace";
const C = {
  bg: "#0a0a0a",
  surface: "#111111",
  border: "#1e1e1e",
  fg: "#ededed",
  fgMuted: "#888888",
  fgDim: "#555555",
  accent: "#0070f3",
  green: "#50e3c2",
  orange: "#f5a623",
  red: "#ff4444",
  purple: "#7928ca",
  pink: "#ff0080",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: C.green,
  medium: C.orange,
  low: C.fgDim,
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
  const [hovered, setHovered] = useState(false);
  const mappingCount = countTreeMappings(node);
  const hasSelectedChild = node.mappings.some((m) => m.elementId === selectedElementId);

  if (!node.isDir) {
    return (
      <div>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 28,
            paddingLeft: depth * 14 + 8,
            paddingRight: 8,
            cursor: "pointer",
            background: hasSelectedChild ? `${C.accent}12` : hovered ? "rgba(255,255,255,0.03)" : "transparent",
            borderLeft: hasSelectedChild ? `2px solid ${C.accent}` : "2px solid transparent",
            transition: "background 0.1s",
            fontFamily: FONT,
          }}
        >
          {node.mappings.length > 0 ? (
            expanded ? <ChevronDown size={10} color={C.fgDim} /> : <ChevronRight size={10} color={C.fgDim} />
          ) : (
            <span style={{ width: 10 }} />
          )}
          <FileCode size={13} color={C.accent} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: C.fg, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
          {node.mappings.length > 0 && (
            <span style={{
              fontSize: 9, color: C.fgDim, background: "#1a1a1a",
              padding: "1px 5px", borderRadius: 3, fontFamily: MONO,
            }}>
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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 28,
          paddingLeft: depth * 14 + 8,
          paddingRight: 8,
          cursor: "pointer",
          background: hovered ? "rgba(255,255,255,0.03)" : "transparent",
          transition: "background 0.1s",
          fontFamily: FONT,
        }}
      >
        {expanded ? <ChevronDown size={10} color={C.fgDim} /> : <ChevronRight size={10} color={C.fgDim} />}
        {expanded ? <FolderOpen size={13} color={C.orange} /> : <FolderClosed size={13} color={C.orange} />}
        <span style={{ fontSize: 11, color: C.fg, flex: 1 }}>{node.name}</span>
        {mappingCount > 0 && (
          <span style={{
            fontSize: 9, color: C.fgDim, fontFamily: MONO,
          }}>
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
  const [hovered, setHovered] = useState(false);
  const color = CONFIDENCE_COLORS[mapping.confidence];

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        height: 26,
        paddingLeft: (depth + 1) * 14 + 8,
        paddingRight: 8,
        background: isSelected ? `${C.accent}12` : hovered ? "rgba(255,255,255,0.03)" : "transparent",
        border: "none",
        borderLeft: isSelected ? `2px solid ${C.accent}` : "2px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: FONT,
        transition: "background 0.1s",
      }}
    >
      <MapPin size={10} color={color} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: C.fgMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {mapping.componentName}
      </span>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {hovered && <Eye size={10} color={C.fgDim} style={{ flexShrink: 0 }} />}
    </button>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const color = CONFIDENCE_COLORS[confidence];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 9, padding: "1px 6px", borderRadius: 4,
      background: `${color}15`, color,
      fontFamily: FONT,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: color }} />
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
    <div style={{ padding: 12, fontFamily: FONT }}>
      {/* Element info card */}
      <div style={{
        padding: 12, background: C.surface, borderRadius: 10,
        border: `1px solid ${C.border}`, marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ color: C.accent }}>{getElementIcon(element.tag)}</span>
          <span style={{ fontSize: 12, color: C.accent, fontWeight: 500 }}>
            &lt;{element.tag}&gt;
          </span>
          {element.classes.length > 0 && (
            <span style={{ fontSize: 10, color: C.fgDim, fontFamily: MONO }}>
              .{element.classes.slice(0, 2).join(".")}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: C.fgDim, fontFamily: MONO, wordBreak: "break-all" }}>
          {element.selector}
        </div>
        {element.text && (
          <div style={{
            fontSize: 10, color: C.fgMuted, marginTop: 6,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            "{element.text.slice(0, 60)}{element.text.length > 60 ? "..." : ""}"
          </div>
        )}
      </div>

      {/* Mapped file card */}
      {mapping ? (
        <div style={{
          padding: 12, borderRadius: 10, marginBottom: 12,
          border: `1px solid ${C.accent}30`,
          background: `${C.accent}08`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <FileCode size={14} color={C.accent} />
            <span style={{ fontSize: 12, color: C.fg, fontWeight: 500 }}>{mapping.componentName}</span>
            <ConfidenceBadge confidence={mapping.confidence} />
          </div>
          <div style={{ fontSize: 11, color: C.fgMuted, fontFamily: MONO, marginBottom: 4 }}>
            {mapping.filePath}{mapping.lineNumber ? `:${mapping.lineNumber}` : ""}
          </div>
          {isInferred && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 9, color: C.orange, marginBottom: 8,
            }}>
              <Sparkles size={10} />
              Heuristic mapping — connect IDE for exact resolution
            </div>
          )}
          <button
            onClick={() => {
              // Attempt VS Code open
              const vscodeUrl = `vscode://file/${mapping.filePath}${mapping.lineNumber ? `:${mapping.lineNumber}` : ""}`;
              window.open(vscodeUrl, "_blank");
            }}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, padding: "7px 0", borderRadius: 8,
              border: `1px solid ${C.accent}40`, background: `${C.accent}10`,
              color: C.accent, fontSize: 11, fontWeight: 500,
              cursor: "pointer", fontFamily: FONT,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = `${C.accent}20`; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = `${C.accent}10`; }}
          >
            <ExternalLink size={12} />
            Open in VS Code
          </button>
        </div>
      ) : (
        <div style={{
          padding: 12, borderRadius: 10, marginBottom: 12,
          border: `1px solid ${C.border}`, background: C.surface,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <MapPin size={14} color={C.fgDim} />
            <span style={{ fontSize: 12, color: C.fgMuted }}>No file mapping</span>
          </div>
          <div style={{ fontSize: 10, color: C.fgDim, lineHeight: 1.5 }}>
            This element doesn't match known component patterns.
            Connect an IDE or add data-component attributes for exact resolution.
          </div>
        </div>
      )}

      {/* Child component mappings */}
      {childMappings.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, color: C.fgDim, textTransform: "uppercase",
            letterSpacing: "0.05em", marginBottom: 6, fontWeight: 500,
          }}>
            Child Components ({childMappings.length})
          </div>
          <div style={{
            borderRadius: 8, border: `1px solid ${C.border}`,
            overflow: "hidden",
          }}>
            {childMappings.slice(0, 10).map((m) => (
              <button
                key={m.elementId}
                onClick={() => onSelectElement(m.elementId)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "7px 10px",
                  background: "transparent", border: "none",
                  borderBottom: `1px solid ${C.border}`,
                  cursor: "pointer", textAlign: "left", fontFamily: FONT,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
              >
                <ArrowRight size={10} color={C.fgDim} />
                <span style={{ fontSize: 11, color: C.fg }}>{m.componentName}</span>
                <span style={{ fontSize: 9, color: C.fgDim, fontFamily: MONO, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 12px", borderBottom: `1px solid ${C.border}`,
      fontFamily: FONT,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <FileCode size={10} color={C.fgDim} />
        <span style={{ fontSize: 9, color: C.fgMuted }}>{uniqueFiles} files</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Layers size={10} color={C.fgDim} />
        <span style={{ fontSize: 9, color: C.fgMuted }}>{mappings.length} components</span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {high > 0 && <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.green }} />
          <span style={{ fontSize: 9, color: C.fgDim }}>{high}</span>
        </span>}
        {medium > 0 && <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.orange }} />
          <span style={{ fontSize: 9, color: C.fgDim }}>{medium}</span>
        </span>}
        {low > 0 && <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.fgDim }} />
          <span style={{ fontSize: 9, color: C.fgDim }}>{low}</span>
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
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: C.bg, fontFamily: FONT, color: C.fg,
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileCode size={14} color={C.accent} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>File Map</span>
          {isInferred && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 9, color: C.orange, background: `${C.orange}15`,
              padding: "1px 6px", borderRadius: 4,
            }}>
              <Sparkles size={9} />
              Inferred
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: C.fgDim, fontFamily: MONO }}>
          {allMappings.length}
        </span>
      </div>

      {/* Stats */}
      {allMappings.length > 0 && <StatsBar mappings={allMappings} />}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
        {(["tree", "element"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 450,
              fontFamily: FONT, border: "none", cursor: "pointer",
              background: "transparent",
              color: tab === t ? C.fg : C.fgDim,
              borderBottom: tab === t ? `2px solid ${C.fg}` : "2px solid transparent",
              transition: "all 0.15s",
            }}
          >
            {t === "tree" ? "File Tree" : "Selected"}
          </button>
        ))}
      </div>

      {/* Search (tree tab only) */}
      {tab === "tree" && (
        <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "0 10px", height: 28,
          }}>
            <Search size={12} color={C.fgDim} />
            <input
              type="text"
              placeholder="Search files or components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1, background: "transparent", border: "none",
                fontSize: 11, color: C.fg, fontFamily: FONT,
                outline: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {tab === "tree" && (
          <div style={{ paddingTop: 4, paddingBottom: 8 }}>
            {allMappings.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "48px 20px", textAlign: "center",
              }}>
                <FileCode size={32} color="#1a1a1a" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 12, color: C.fgMuted, marginBottom: 4 }}>
                  No file mappings
                </div>
                <div style={{ fontSize: 10, color: C.fgDim, lineHeight: 1.5, maxWidth: 200 }}>
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
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "48px 20px", textAlign: "center",
            }}>
              <MapPin size={32} color="#1a1a1a" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 12, color: C.fgMuted, marginBottom: 4 }}>
                No element selected
              </div>
              <div style={{ fontSize: 10, color: C.fgDim, lineHeight: 1.5 }}>
                Click an element in the canvas or layers panel to see its file mapping.
              </div>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "6px 12px", borderTop: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 9, color: C.fgDim }}>Confidence:</span>
        {([
          [C.green, "High"],
          [C.orange, "Med"],
          [C.fgDim, "Low"],
        ] as const).map(([color, label]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 9, color: C.fgDim }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
