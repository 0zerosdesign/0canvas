// ──────────────────────────────────────────────────────────
// .dd Format — DesignDead's design-as-code variant format
// ──────────────────────────────────────────────────────────
//
// Inspired by Pencil.dev's .pen format. A structured JSON
// representation of UI variants that is:
//   - Cheaper for AI agents to read/modify (vs raw HTML/CSS)
//   - Based on HTML/CSS semantics (tags, classes, styles)
//   - Supports responsive breakpoints per node
//   - Supports design variables (tokens)
//   - Maps 1:1 to DOM for easy conversion
//
// ──────────────────────────────────────────────────────────

export const DD_FORMAT_VERSION = "0.1.0";

// ── Variable types ─────────────────────────────────────────

export type DDVariableType = "color" | "number" | "string";

export type DDVariable = {
  type: DDVariableType;
  value: string | number;
  description?: string;
};

// ── Breakpoint definitions ─────────────────────────────────

export type DDBreakpoint = {
  minWidth?: number;
  maxWidth?: number;
};

export type DDBreakpoints = {
  desktop: DDBreakpoint;
  tablet: DDBreakpoint;
  mobile: DDBreakpoint;
  [key: string]: DDBreakpoint;
};

export const DEFAULT_BREAKPOINTS: DDBreakpoints = {
  desktop: { minWidth: 1280 },
  tablet: { minWidth: 768, maxWidth: 1279 },
  mobile: { maxWidth: 767 },
};

// ── Node styles ────────────────────────────────────────────
// CSS properties that can be set on any node.
// Values can be literal or "$variable.name" references.

export type DDStyleValue = string | number;

export type DDStyles = {
  // Layout
  display?: DDStyleValue;
  flexDirection?: DDStyleValue;
  alignItems?: DDStyleValue;
  justifyContent?: DDStyleValue;
  gap?: DDStyleValue;
  gridTemplateColumns?: DDStyleValue;

  // Spacing
  padding?: DDStyleValue | [DDStyleValue, DDStyleValue, DDStyleValue, DDStyleValue];
  margin?: DDStyleValue | [DDStyleValue, DDStyleValue, DDStyleValue, DDStyleValue];

  // Sizing
  width?: DDStyleValue;
  height?: DDStyleValue;
  maxWidth?: DDStyleValue;
  minWidth?: DDStyleValue;
  maxHeight?: DDStyleValue;
  minHeight?: DDStyleValue;

  // Typography
  fontSize?: DDStyleValue;
  fontWeight?: DDStyleValue;
  fontFamily?: DDStyleValue;
  lineHeight?: DDStyleValue;
  letterSpacing?: DDStyleValue;
  textAlign?: DDStyleValue;
  textDecoration?: DDStyleValue;

  // Color
  color?: DDStyleValue;
  backgroundColor?: DDStyleValue;

  // Border
  borderRadius?: DDStyleValue;
  border?: DDStyleValue;
  borderColor?: DDStyleValue;
  borderWidth?: DDStyleValue;

  // Effects
  boxShadow?: DDStyleValue;
  opacity?: DDStyleValue;
  transform?: DDStyleValue;
  transition?: DDStyleValue;
  backdropFilter?: DDStyleValue;

  // Position
  position?: DDStyleValue;
  top?: DDStyleValue;
  right?: DDStyleValue;
  bottom?: DDStyleValue;
  left?: DDStyleValue;
  zIndex?: DDStyleValue;

  // Overflow
  overflow?: DDStyleValue;

  // Catch-all for uncommon properties
  [key: string]: DDStyleValue | DDStyleValue[] | undefined;
};

// ── Responsive overrides ───────────────────────────────────
// Per-breakpoint style overrides for a node.

export type DDResponsive = {
  [breakpoint: string]: Partial<DDStyles>;
};

// ── Node (the core building block) ─────────────────────────

export type DDNode = {
  id: string;
  tag: string;
  name?: string;

  // HTML attributes
  class?: string;
  href?: string;
  src?: string;
  alt?: string;
  type?: string;
  placeholder?: string;

  // Text content (for leaf nodes like h1, p, span, a, button)
  text?: string;

  // Styles (base — applies to all breakpoints)
  styles?: DDStyles;

  // Responsive overrides
  responsive?: DDResponsive;

  // Children
  children?: DDNode[];
};

// ── Document root ──────────────────────────────────────────

export type DDDocument = {
  version: string;
  name: string;

  // Source information (what was forked)
  source: {
    type: "page" | "component";
    selector?: string;
    route?: string;
    elementId?: string;
  };

  // Design variables (tokens)
  variables?: Record<string, DDVariable>;

  // Breakpoint definitions
  breakpoints?: DDBreakpoints;

  // The node tree
  tree: DDNode[];
};

// ── Helper: create empty document ──────────────────────────

export function createDDDocument(
  name: string,
  source: DDDocument["source"],
): DDDocument {
  return {
    version: DD_FORMAT_VERSION,
    name,
    source,
    variables: {},
    breakpoints: { ...DEFAULT_BREAKPOINTS },
    tree: [],
  };
}

// ── Helper: find node by ID in tree ────────────────────────

export function findNodeById(tree: DDNode[], id: string): DDNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ── Helper: update node by ID ──────────────────────────────

export function updateNodeById(
  tree: DDNode[],
  id: string,
  updates: Partial<DDNode>,
): boolean {
  for (let i = 0; i < tree.length; i++) {
    if (tree[i].id === id) {
      tree[i] = { ...tree[i], ...updates };
      return true;
    }
    if (tree[i].children) {
      if (updateNodeById(tree[i].children!, id, updates)) return true;
    }
  }
  return false;
}

// ── Helper: delete node by ID ──────────────────────────────

export function deleteNodeById(tree: DDNode[], id: string): boolean {
  for (let i = 0; i < tree.length; i++) {
    if (tree[i].id === id) {
      tree.splice(i, 1);
      return true;
    }
    if (tree[i].children) {
      if (deleteNodeById(tree[i].children!, id)) return true;
    }
  }
  return false;
}

// ── Helper: insert node as child of parent ─────────────────

export function insertNode(
  tree: DDNode[],
  parentId: string,
  node: DDNode,
  position?: number,
): boolean {
  for (const parent of tree) {
    if (parent.id === parentId) {
      if (!parent.children) parent.children = [];
      if (position !== undefined) {
        parent.children.splice(position, 0, node);
      } else {
        parent.children.push(node);
      }
      return true;
    }
    if (parent.children) {
      if (insertNode(parent.children, parentId, node, position)) return true;
    }
  }
  return false;
}

// ── Helper: count nodes ────────────────────────────────────

export function countDDNodes(tree: DDNode[]): number {
  let count = 0;
  for (const node of tree) {
    count++;
    if (node.children) count += countDDNodes(node.children);
  }
  return count;
}
