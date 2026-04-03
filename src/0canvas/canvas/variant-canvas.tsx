// ──────────────────────────────────────────────────────────
// Variant Canvas — ReactFlow infinite canvas for main preview + variants
// ──────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkspace, VariantData } from "../store/store";
import { SourceNode, type SourceNodeData } from "./source-node";
import { VariantNode, type VariantNodeData } from "./variant-node";
import { capturePageSnapshot, captureComponentSnapshot, getElementOuterHTML, pushVariantToMain as domPushToMain, setInspectionTarget, rebuildElementMap, buildElementTree } from "../inspector/dom-inspector";
import { saveVariant, deleteVariant as dbDeleteVariant } from "../db/variant-db";
import { copyToClipboard } from "../utils/clipboard";

const NODE_TYPES: NodeTypes = {
  source: SourceNode,
  variant: VariantNode,
};

const SOURCE_NODE_ID = "source-main";
const VARIANT_GAP_X = 80;
const VARIANT_GAP_Y = 60;
const VARIANT_COL_OFFSET = 1400;

interface VariantCanvasProps {
  onNavigateRef?: React.MutableRefObject<((route: string) => void) | null>;
}

function VariantCanvasInner({ onNavigateRef }: VariantCanvasProps) {
  const { state, dispatch } = useWorkspace();
  const nodeIdCounter = useRef(0);

  const getNodeId = () => `variant-${++nodeIdCounter.current}-${Date.now()}`;

  // ── Build nodes from state ─────────────────────────────

  const handleForkPage = useCallback((viewportWidth?: number) => {
    const snapshot = capturePageSnapshot();
    if (!snapshot) return;

    const variant: VariantData = {
      id: getNodeId(),
      name: `Page Fork ${state.variants.length + 1}`,
      ...snapshot,
      sourceElementId: null,
      sourcePageRoute: state.currentRoute,
      parentId: null,
      status: "draft",
      createdAt: Date.now(),
      sourceViewportWidth: viewportWidth,
      sourceContentHeight: snapshot.sourceContentHeight,
    };

    dispatch({ type: "ADD_VARIANT", variant });
    saveVariant(variant).catch(console.warn);
  }, [state.variants.length, state.currentRoute, dispatch]);

  const handleForkComponent = useCallback((elementId: string, viewportWidth?: number) => {
    const snapshot = captureComponentSnapshot(elementId);
    if (!snapshot) return;

    const outerHTML = getElementOuterHTML(elementId) || "";

    const variant: VariantData = {
      id: getNodeId(),
      name: `Component Fork ${state.variants.length + 1}`,
      ...snapshot,
      sourceElementId: elementId,
      sourcePageRoute: state.currentRoute,
      sourceOuterHTML: outerHTML,
      parentId: null,
      status: "draft",
      createdAt: Date.now(),
      sourceViewportWidth: viewportWidth,
      sourceContentHeight: snapshot.sourceContentHeight,
    };

    dispatch({ type: "ADD_VARIANT", variant });
    saveVariant(variant).catch(console.warn);
  }, [state.variants.length, state.currentRoute, dispatch]);

  const handleForkVariant = useCallback((sourceVariantId: string) => {
    const source = state.variants.find((v) => v.id === sourceVariantId);
    if (!source) return;

    const variant: VariantData = {
      id: getNodeId(),
      name: `${source.name} — Fork ${state.variants.filter((v) => v.parentId === sourceVariantId).length + 1}`,
      html: source.modifiedHtml || source.html,
      css: source.modifiedCss || source.css,
      mockData: { ...source.mockData },
      sourceType: source.sourceType,
      sourceSelector: source.sourceSelector,
      sourceElementId: source.sourceElementId,
      sourcePageRoute: source.sourcePageRoute,
      sourceOuterHTML: source.sourceOuterHTML,
      parentId: sourceVariantId,
      status: "draft",
      createdAt: Date.now(),
      sourceViewportWidth: source.sourceViewportWidth,
      sourceContentHeight: source.sourceContentHeight,
    };

    dispatch({ type: "ADD_VARIANT", variant });
    saveVariant(variant).catch(console.warn);
  }, [state.variants, dispatch]);

  const handleDeleteVariant = useCallback((variantId: string) => {
    dispatch({ type: "DELETE_VARIANT", id: variantId });
    dbDeleteVariant(variantId).catch(console.warn);
  }, [dispatch]);

  const handleFinalizeVariant = useCallback((variantId: string) => {
    dispatch({ type: "FINALIZE_VARIANT", id: variantId });
  }, [dispatch]);

  const handleSendToAgent = useCallback((variantId: string) => {
    const variant = state.variants.find((v) => v.id === variantId);
    if (!variant) return;

    const html = variant.modifiedHtml || variant.html;
    const css = variant.modifiedCss || variant.css;

    const output = [
      `# Variant: ${variant.name}`,
      `**Type:** ${variant.sourceType}`,
      variant.sourceSelector ? `**Selector:** \`${variant.sourceSelector}\`` : "",
      `**Status:** Finalized`,
      "",
      "## HTML",
      "```html",
      html.slice(0, 5000),
      html.length > 5000 ? "<!-- truncated -->" : "",
      "```",
      "",
      css ? "## CSS\n```css\n" + css.slice(0, 3000) + "\n```" : "",
    ].filter(Boolean).join("\n");

    copyToClipboard(output);
    dispatch({ type: "UPDATE_VARIANT", id: variantId, updates: { status: "sent" } });
  }, [state.variants, dispatch]);

  const handlePushToMain = useCallback((variantId: string) => {
    const variant = state.variants.find((v) => v.id === variantId);
    if (!variant || !variant.sourceElementId) return;

    const html = variant.modifiedHtml || variant.html;
    const css = variant.modifiedCss || variant.css;

    const success = domPushToMain(variant.sourceElementId, html, css || undefined);
    if (success) {
      dispatch({ type: "PUSH_VARIANT_TO_MAIN", id: variantId });
    }
  }, [state.variants, dispatch]);

  // ── Compute ReactFlow nodes + edges from state variants ─

  const { flowNodes, flowEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Source node (always at 0,0) — Framer-style resizable viewport
    nodes.push({
      id: SOURCE_NODE_ID,
      type: "source",
      position: { x: 0, y: 0 },
      data: {
        label: "Main Preview",
        onForkPage: handleForkPage,
        onForkComponent: handleForkComponent,
      } satisfies SourceNodeData,
      style: { width: 1280, height: 800 },
      draggable: true,
    });

    // Layout variants in columns by depth
    const rootVariants = state.variants.filter((v) => v.parentId === null);
    const childMap = new Map<string, VariantData[]>();
    for (const v of state.variants) {
      if (v.parentId) {
        const children = childMap.get(v.parentId) || [];
        children.push(v);
        childMap.set(v.parentId, children);
      }
    }

    let yOffset = 0;

    const DEFAULT_VARIANT_W = 560;
    const DEFAULT_VARIANT_H = 420;

    function layoutVariant(variant: VariantData, depth: number, parentNodeId: string) {
      const nodeW = variant.sourceViewportWidth || DEFAULT_VARIANT_W;
      const rawH = variant.sourceContentHeight || Math.round(nodeW * (DEFAULT_VARIANT_H / DEFAULT_VARIANT_W));
      // Add space for floating chrome bar (34px) + gap (8px), and ensure minimum useful height
      const FLOATING_HEADER_H = 42; // chrome bar + gap
      const minContentH = variant.sourceType === "component" ? 200 : DEFAULT_VARIANT_H;
      const nodeH = Math.max(rawH, minContentH) + FLOATING_HEADER_H;
      const x = VARIANT_COL_OFFSET + depth * (Math.max(nodeW, DEFAULT_VARIANT_W) + VARIANT_GAP_X);
      const y = yOffset;
      yOffset += nodeH + VARIANT_GAP_Y;

      nodes.push({
        id: variant.id,
        type: "variant",
        position: { x, y },
        data: {
          variant,
          onFork: handleForkVariant,
          onDelete: handleDeleteVariant,
          onFinalize: handleFinalizeVariant,
          onSendToAgent: handleSendToAgent,
          onPushToMain: handlePushToMain,
        } satisfies VariantNodeData,
        style: { width: nodeW, height: nodeH },
        draggable: true,
      });

      edges.push({
        id: `edge-${parentNodeId}-${variant.id}`,
        source: parentNodeId,
        target: variant.id,
        type: "smoothstep",
        animated: variant.status === "draft",
        style: { stroke: "var(--grey-700)", strokeWidth: 1.5 },
      });

      const children = childMap.get(variant.id) || [];
      for (const child of children) {
        layoutVariant(child, depth + 1, variant.id);
      }
    }

    for (const rv of rootVariants) {
      layoutVariant(rv, 0, SOURCE_NODE_ID);
    }

    return { flowNodes: nodes, flowEdges: edges };
  }, [
    state.variants,
    handleForkPage,
    handleForkComponent,
    handleForkVariant,
    handleDeleteVariant,
    handleFinalizeVariant,
    handleSendToAgent,
    handlePushToMain,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
  const [canvasInteracting, setCanvasInteracting] = useState(false);

  // Sync ReactFlow state when store variants change
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Disable iframe pointer events during canvas interactions (pan/zoom/drag)
  // This prevents iframes from stealing mouse events during drag operations
  useEffect(() => {
    if (!canvasInteracting) return;
    const style = document.createElement("style");
    style.id = "oc-canvas-interaction-guard";
    style.textContent = `[data-0canvas] iframe { pointer-events: none !important; }`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [canvasInteracting]);

  const handleMoveStart = useCallback(() => setCanvasInteracting(true), []);
  const handleMoveEnd = useCallback(() => setCanvasInteracting(false), []);
  const handleNodeDragStart = useCallback(() => setCanvasInteracting(true), []);
  const handleNodeDragStop = useCallback(() => setCanvasInteracting(false), []);

  // Auto-scan variant/source DOM into layers/styles when clicking on a node
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === "variant") {
      const variantData = (node.data as VariantNodeData).variant;
      dispatch({ type: "SET_ACTIVE_VARIANT", id: variantData.id });

      // Find the variant's iframe and scan its DOM
      setTimeout(() => {
        const variantContainer = document.querySelector(`[data-variant-id="${variantData.id}"]`);
        const iframe = variantContainer?.querySelector("iframe") as HTMLIFrameElement | null;
        if (!iframe?.contentDocument?.body) return;

        setInspectionTarget(iframe.contentDocument, iframe);
        const tree = buildElementTree();
        rebuildElementMap();
        dispatch({ type: "SET_ELEMENTS", elements: tree });
      }, 100);
    } else if (node.type === "source") {
      dispatch({ type: "SET_ACTIVE_VARIANT", id: null });

      // Find the source node's iframe and scan its DOM
      setTimeout(() => {
        const sourceContainer = document.querySelector(`[data-0canvas="source-node"]`);
        const iframe = sourceContainer?.querySelector("iframe[name='0canvas-preview']") as HTMLIFrameElement | null;
        if (!iframe?.contentDocument?.body) return;

        setInspectionTarget(iframe.contentDocument, iframe);
        const tree = buildElementTree();
        rebuildElementMap();
        dispatch({ type: "SET_ELEMENTS", elements: tree });
      }, 100);
    }
  }, [dispatch]);

  return (
    <div
      data-0canvas="variant-canvas"
      className="oc-vc-root"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMoveStart={handleMoveStart}
        onMoveEnd={handleMoveEnd}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.05}
        maxZoom={2}
        panOnScroll
        panOnScrollMode="free" as any
        zoomOnScroll
        zoomOnPinch
        nodesDraggable
        nodeDragThreshold={5}
        nodesConnectable={false}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
        className="oc-vc-flow"
      >
        <Background variant={BackgroundVariant.Dots} color="var(--grey-900)" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="oc-vc-controls"
        />
        <MiniMap
          nodeColor={(node) => node.type === "source" ? "var(--blue-600)" : "var(--grey-700)"}
          maskColor="rgba(0,0,0,0.7)"
          className="oc-vc-minimap"
        />
      </ReactFlow>
    </div>
  );
}

export function VariantCanvas(props: VariantCanvasProps) {
  return (
    <ReactFlowProvider>
      <VariantCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
