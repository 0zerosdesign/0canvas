// ──────────────────────────────────────────────────────────
// .0c Format — ZeroCanvas's design-as-code variant format
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

export const OC_FORMAT_VERSION = "0.1.0";

// ── Variable types ─────────────────────────────────────────

export type OCVariableType = "color" | "number" | "string";

export type OCVariable = {
  type: OCVariableType;
  value: string | number;
  description?: string;
};

// ── Breakpoint definitions ─────────────────────────────────

export type OCBreakpoint = {
  minWidth?: number;
  maxWidth?: number;
};

export type OCBreakpoints = {
  desktop: OCBreakpoint;
  tablet: OCBreakpoint;
  mobile: OCBreakpoint;
  [key: string]: OCBreakpoint;
};

export const DEFAULT_BREAKPOINTS: OCBreakpoints = {
  desktop: { minWidth: 1280 },
  tablet: { minWidth: 768, maxWidth: 1279 },
  mobile: { maxWidth: 767 },
};

// ── Node styles ────────────────────────────────────────────
// CSS properties that can be set on any node.
// Values can be literal or "$variable.name" references.

export type OCStyleValue = string | number;

export type OCStyles = {
  // Layout
  display?: OCStyleValue;
  flexDirection?: OCStyleValue;
  alignItems?: OCStyleValue;
  justifyContent?: OCStyleValue;
  gap?: OCStyleValue;
  gridTemplateColumns?: OCStyleValue;

  // Spacing
  padding?: OCStyleValue | [OCStyleValue, OCStyleValue, OCStyleValue, OCStyleValue];
  margin?: OCStyleValue | [OCStyleValue, OCStyleValue, OCStyleValue, OCStyleValue];

  // Sizing
  width?: OCStyleValue;
  height?: OCStyleValue;
  maxWidth?: OCStyleValue;
  minWidth?: OCStyleValue;
  maxHeight?: OCStyleValue;
  minHeight?: OCStyleValue;

  // Typography
  fontSize?: OCStyleValue;
  fontWeight?: OCStyleValue;
  fontFamily?: OCStyleValue;
  lineHeight?: OCStyleValue;
  letterSpacing?: OCStyleValue;
  textAlign?: OCStyleValue;
  textDecoration?: OCStyleValue;

  // Color
  color?: OCStyleValue;
  backgroundColor?: OCStyleValue;

  // Border
  borderRadius?: OCStyleValue;
  border?: OCStyleValue;
  borderColor?: OCStyleValue;
  borderWidth?: OCStyleValue;

  // Effects
  boxShadow?: OCStyleValue;
  opacity?: OCStyleValue;
  transform?: OCStyleValue;
  transition?: OCStyleValue;
  backdropFilter?: OCStyleValue;

  // Position
  position?: OCStyleValue;
  top?: OCStyleValue;
  right?: OCStyleValue;
  bottom?: OCStyleValue;
  left?: OCStyleValue;
  zIndex?: OCStyleValue;

  // Overflow
  overflow?: OCStyleValue;

  // Catch-all for uncommon properties
  [key: string]: OCStyleValue | OCStyleValue[] | undefined;
};

// ── Responsive overrides ───────────────────────────────────
// Per-breakpoint style overrides for a node.

export type OCResponsive = {
  [breakpoint: string]: Partial<OCStyles>;
};

// ── Node (the core building block) ─────────────────────────

export type OCNode = {
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
  styles?: OCStyles;

  // Responsive overrides
  responsive?: OCResponsive;

  // Children
  children?: OCNode[];
};

// ── Document root ──────────────────────────────────────────

export type OCDocument = {
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
  variables?: Record<string, OCVariable>;

  // Breakpoint definitions
  breakpoints?: OCBreakpoints;

  // The node tree
  tree: OCNode[];
};

// ── Helper: create empty document ──────────────────────────

export function createOCDocument(
  name: string,
  source: OCDocument["source"],
): OCDocument {
  return {
    version: OC_FORMAT_VERSION,
    name,
    source,
    variables: {},
    breakpoints: { ...DEFAULT_BREAKPOINTS },
    tree: [],
  };
}

// ── Helper: find node by ID in tree ────────────────────────

export function findNodeById(tree: OCNode[], id: string): OCNode | null {
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
  tree: OCNode[],
  id: string,
  updates: Partial<OCNode>,
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

export function deleteNodeById(tree: OCNode[], id: string): boolean {
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
  tree: OCNode[],
  parentId: string,
  node: OCNode,
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

export function countOCNodes(tree: OCNode[]): number {
  let count = 0;
  for (const node of tree) {
    count++;
    if (node.children) count += countOCNodes(node.children);
  }
  return count;
}
