import * as react_jsx_runtime from 'react/jsx-runtime';

interface DesignDeadProps {
    /** Panel position for the toggle button. Default: "bottom-right" */
    position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    /** Start with the panel open. Default: false */
    defaultOpen?: boolean;
    /** Color theme. "auto" follows prefers-color-scheme. Default: "dark" */
    theme?: "dark" | "light" | "auto";
    /** Keyboard shortcut key (used with Ctrl+Shift+{key}). Default: "d" */
    shortcut?: string;
    /** Only show in development (process.env.NODE_ENV !== "production"). Default: true */
    devOnly?: boolean;
    /** CSS z-index for the overlay. Default: 2147483640 */
    zIndex?: number;
    /** Optional callback when DesignDead opens/closes */
    onToggle?: (isOpen: boolean) => void;
}
declare function DesignDead({ position, defaultOpen, theme, shortcut, devOnly, zIndex, onToggle, }: DesignDeadProps): react_jsx_runtime.JSX.Element | null;

type ElementNode = {
    id: string;
    tag: string;
    classes: string[];
    children: ElementNode[];
    text?: string;
    styles: Record<string, string>;
    selector: string;
    visible: boolean;
    locked: boolean;
};
type StyleChange = {
    elementId: string;
    property: string;
    oldValue: string;
    newValue: string;
    timestamp: number;
};

/**
 * Build the full ElementNode tree from the current page DOM.
 * Skips DesignDead's own overlay elements.
 */
declare function buildElementTree(): ElementNode[];
/**
 * Rebuild the id↔element mapping.
 * Call after buildElementTree() to keep maps in sync.
 */
declare function rebuildElementMap(): void;
/**
 * Get the DOM element for a given DesignDead element ID.
 */
declare function getElementById(id: string): Element | null;
/**
 * Apply a CSS style change directly to a DOM element.
 * Returns the previous value for undo support.
 */
declare function applyStyle(elementId: string, property: string, value: string): string | null;
/**
 * Show a highlight overlay on a DOM element.
 */
declare function highlightElement(elementId: string | null, type?: "hover" | "select"): void;
/**
 * Remove all DesignDead overlays from the page.
 */
declare function cleanup(): void;
type InspectCallback = (elementId: string, element: Element) => void;
/**
 * Start click-to-inspect mode.
 * Click any element on the page to select it.
 */
declare function startInspect(onSelect: InspectCallback): void;
/**
 * Stop click-to-inspect mode.
 */
declare function stopInspect(): void;
declare function isInspecting(): boolean;
/**
 * Generate structured markdown output for an element,
 * suitable for pasting into AI coding agent prompts.
 */
declare function generateAgentOutput(elementId: string): string;

/**
 * Inject DesignDead's scoped CSS into the document head.
 * Safe to call multiple times — only injects once.
 */
declare function injectStyles(): void;
/**
 * Remove DesignDead's injected CSS from the document.
 */
declare function removeStyles(): void;

export { DesignDead, type DesignDeadProps, type ElementNode, type StyleChange, applyStyle, buildElementTree, cleanup, DesignDead as default, generateAgentOutput, getElementById, highlightElement, injectStyles, isInspecting, rebuildElementMap, removeStyles, startInspect, stopInspect };
