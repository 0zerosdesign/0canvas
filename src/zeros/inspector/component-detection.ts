// ──────────────────────────────────────────────────────────
// Component Detection — Identify framework components from DOM elements
// ──────────────────────────────────────────────────────────
//
// Walks React fiber trees, Vue instances, Angular markers,
// and Svelte component boundaries to produce human-readable
// component names from raw DOM elements.
// ──────────────────────────────────────────────────────────

// ── React Fiber Walking ───────────────────────────────────

function getReactFiberKey(el: Element): string | null {
  for (const key of Object.keys(el)) {
    if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
      return key;
    }
  }
  return null;
}

function getReactFiber(el: Element): any | null {
  const key = getReactFiberKey(el);
  if (!key) return null;
  return (el as any)[key] || null;
}

const REACT_SKIP_PATTERNS = [
  /^Provider$/, /^Consumer$/, /^Context$/, /^Fragment$/,
  /^Suspense$/, /^StrictMode$/, /^Profiler$/, /^Portal$/,
  /^ForwardRef$/, /^Memo$/, /^Lazy$/,
  /^ClientPage/, /^ClientSegment/, /^ClientRoot/,
  /^InnerLayout/, /^OuterLayout/, /^RenderFromTemplate/,
  /^ScrollAndFocus/, /^RedirectBoundary/, /^NotFoundBoundary/,
  /^ErrorBoundary/, /^HotReload/, /^Router$/, /^Head$/,
  /^AppRouterAnnouncer/, /^Routes$/, /^Route$/,
  /^BrowserRouter/, /^Switch$/, /^Outlet$/,
  /^ThemeProvider/, /^StyleSheetManager/, /^HelmetProvider/,
  /^QueryClientProvider/, /^I18nextProvider/,
];

function isSkippedReactComponent(name: string): boolean {
  return REACT_SKIP_PATTERNS.some((p) => p.test(name));
}

function getFiberComponentName(fiber: any): string | null {
  if (!fiber || !fiber.type) return null;
  const type = fiber.type;

  if (typeof type === "function") {
    return type.displayName || type.name || null;
  }
  if (typeof type === "string") return null;

  if (type.$$typeof) {
    const symbol = type.$$typeof.toString();
    if (symbol.includes("forward_ref")) {
      return type.displayName || type.render?.displayName || type.render?.name || null;
    }
    if (symbol.includes("memo")) {
      const inner = type.type;
      return type.displayName || inner?.displayName || inner?.name || null;
    }
    if (symbol.includes("context")) {
      return type.displayName || type._context?.displayName || null;
    }
    if (symbol.includes("lazy")) {
      return type.displayName || null;
    }
  }
  return null;
}

function getNearestReactComponentName(el: Element): string | null {
  const fiber = getReactFiber(el);
  if (!fiber) return null;
  let current = fiber;
  let depth = 0;
  while (current && depth < 15) {
    const name = getFiberComponentName(current);
    if (name && !isSkippedReactComponent(name)) return name;
    current = current.return;
    depth++;
  }
  return null;
}

// ── Vue Detection ─────────────────────────────────────────

function getVueComponentName(el: Element): string | null {
  const vueInstance = (el as any).__vue__ || (el as any).__vueParentComponent;
  if (!vueInstance) return null;
  if (vueInstance.type) return vueInstance.type.name || vueInstance.type.__name || null;
  if (vueInstance.$options) return vueInstance.$options.name || vueInstance.$options._componentTag || null;
  return null;
}

// ── Angular Detection ─────────────────────────────────────

function getAngularComponentName(el: Element): string | null {
  const ng = (el.ownerDocument?.defaultView as any)?.ng;
  if (ng?.getComponent) {
    try {
      const component = ng.getComponent(el);
      if (component) return component.constructor?.name || null;
    } catch { /* noop */ }
  }
  const tag = el.tagName.toLowerCase();
  if (tag.includes("-") && !tag.startsWith("oc-")) {
    return tag.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
  }
  return null;
}

// ── Svelte Detection ──────────────────────────────────────

function getSvelteComponentName(el: Element): string | null {
  const meta = (el as any).__svelte_meta;
  if (meta?.loc?.file) {
    const match = meta.loc.file.match(/([^/\\]+)\.svelte$/);
    if (match) return match[1];
  }
  return null;
}

// ── CSS Module / Class-based Heuristics ───────────────────

const CSS_MODULE_PATTERN = /^([A-Z][a-zA-Z0-9]+)_[a-zA-Z][a-zA-Z0-9]*_[a-zA-Z0-9]{5,}$/;
const STYLED_COMPONENT_PATTERN = /^([A-Z][a-zA-Z0-9]+)-[a-zA-Z0-9]+$/;

function getComponentNameFromClasses(el: Element): string | null {
  for (const cls of el.classList) {
    const moduleMatch = cls.match(CSS_MODULE_PATTERN);
    if (moduleMatch) return moduleMatch[1];
    const styledMatch = cls.match(STYLED_COMPONENT_PATTERN);
    if (styledMatch) return styledMatch[1];
  }
  return null;
}

// ── Semantic Tag Detection ────────────────────────────────

const SEMANTIC_TAG_NAMES: Record<string, string> = {
  nav: "Navigation", header: "Header", footer: "Footer",
  main: "Main", aside: "Sidebar", article: "Article",
  section: "Section", form: "Form", dialog: "Dialog",
  details: "Details", summary: "Summary", figure: "Figure",
  figcaption: "FigCaption", table: "Table",
  thead: "TableHead", tbody: "TableBody", tfoot: "TableFoot",
};

// ── Accessible Name Detection ─────────────────────────────

function getAccessibleName(el: Element): string | null {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  const ariaLabelledBy = el.getAttribute("aria-labelledby");
  if (ariaLabelledBy) {
    const doc = el.ownerDocument || document;
    const labelEl = doc.getElementById(ariaLabelledBy);
    if (labelEl?.textContent) return labelEl.textContent.trim().slice(0, 30);
  }
  if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
    const id = el.getAttribute("id");
    if (id) {
      const doc = el.ownerDocument || document;
      const label = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label?.textContent) return label.textContent.trim().slice(0, 30);
    }
  }
  return null;
}

// ── Role-based Name ───────────────────────────────────────

function getRoleName(el: Element): string | null {
  const role = el.getAttribute("role");
  if (!role) return null;
  const roleNames: Record<string, string> = {
    banner: "Banner", navigation: "Navigation", main: "Main",
    complementary: "Sidebar", contentinfo: "ContentInfo",
    search: "Search", alert: "Alert", alertdialog: "AlertDialog",
    tablist: "TabList", tab: "Tab", tabpanel: "TabPanel",
    toolbar: "Toolbar", menu: "Menu", menubar: "MenuBar",
    menuitem: "MenuItem", listbox: "Listbox", option: "Option",
    tree: "Tree", treeitem: "TreeItem", grid: "Grid", treegrid: "TreeGrid",
  };
  return roleNames[role] || null;
}

// ── Data-testid / Data-component ──────────────────────────

function getDataAttributeName(el: Element): string | null {
  const attrs = ["data-testid", "data-test-id", "data-component", "data-component-name", "data-cy"];
  for (const attr of attrs) {
    const value = el.getAttribute(attr);
    if (value) {
      return value
        .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
        .replace(/^(.)/, (_, c) => c.toUpperCase());
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────

export type ComponentInfo = {
  displayName: string;
  source: "react" | "vue" | "angular" | "svelte" | "css-module" | "semantic" | "role" | "aria" | "data-attr" | "tag";
  tag: string;
  classes: string[];
};

/**
 * Identify the best human-readable name for a DOM element.
 * Priority: framework component → data attrs → CSS module → aria → role → semantic tag → fallback
 */
export function identifyElement(el: Element): ComponentInfo {
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter((c) => !c.startsWith("oc-")).slice(0, 3);

  const reactName = getNearestReactComponentName(el);
  if (reactName) return { displayName: reactName, source: "react", tag, classes };

  const vueName = getVueComponentName(el);
  if (vueName) return { displayName: vueName, source: "vue", tag, classes };

  const angularName = getAngularComponentName(el);
  if (angularName) return { displayName: angularName, source: "angular", tag, classes };

  const svelteName = getSvelteComponentName(el);
  if (svelteName) return { displayName: svelteName, source: "svelte", tag, classes };

  const dataName = getDataAttributeName(el);
  if (dataName) return { displayName: dataName, source: "data-attr", tag, classes };

  const cssModuleName = getComponentNameFromClasses(el);
  if (cssModuleName) return { displayName: cssModuleName, source: "css-module", tag, classes };

  const ariaName = getAccessibleName(el);
  if (ariaName) return { displayName: ariaName, source: "aria", tag, classes };

  const roleName = getRoleName(el);
  if (roleName) return { displayName: roleName, source: "role", tag, classes };

  const semanticName = SEMANTIC_TAG_NAMES[tag];
  if (semanticName) return { displayName: semanticName, source: "semantic", tag, classes };

  const fallbackClass = classes[0];
  const displayName = fallbackClass ? `${tag}.${fallbackClass}` : tag;
  return { displayName, source: "tag", tag, classes };
}
