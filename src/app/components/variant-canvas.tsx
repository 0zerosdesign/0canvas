// ──────────────────────────────────────────────────────────
// Variant Canvas — ReactFlow infinite canvas for main preview + variants
// ──────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useRef, useEffect } from "react";
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
import { useWorkspace, VariantData } from "../store";
import { SourceNode, type SourceNodeData } from "./source-node";
import { VariantNode, type VariantNodeData } from "./variant-node";
import { capturePageSnapshot, captureComponentSnapshot } from "./dom-inspector";
import { saveVariant, deleteVariant as dbDeleteVariant } from "./variant-db";
import { copyToClipboard } from "./clipboard";

const NODE_TYPES: NodeTypes = {
  source: SourceNode,
  variant: VariantNode,
};

const SOURCE_NODE_ID = "source-main";
const VARIANT_GAP_X = 60;
const VARIANT_GAP_Y = 40;
const VARIANT_COL_OFFSET = 900;

interface VariantCanvasProps {
  onNavigateRef?: React.MutableRefObject<((route: string) => void) | null>;
}

function VariantCanvasInner({ onNavigateRef }: VariantCanvasProps) {
  const { state, dispatch } = useWorkspace();
  const nodeIdCounter = useRef(0);

  const getNodeId = () => `variant-${++nodeIdCounter.current}-${Date.now()}`;

  // ── Build nodes from state ─────────────────────────────

  const handleForkPage = useCallback(() => {
    const snapshot = capturePageSnapshot();
    if (!snapshot) return;

    const variant: VariantData = {
      id: getNodeId(),
      name: `Page Fork ${state.variants.length + 1}`,
      ...snapshot,
      parentId: null,
      status: "draft",
      createdAt: Date.now(),
    };

    dispatch({ type: "ADD_VARIANT", variant });
    saveVariant(variant).catch(console.warn);
  }, [state.variants.length, dispatch]);

  const handleForkComponent = useCallback((elementId: string) => {
    const snapshot = captureComponentSnapshot(elementId);
    if (!snapshot) return;

    const variant: VariantData = {
      id: getNodeId(),
      name: `Component Fork ${state.variants.length + 1}`,
      ...snapshot,
      parentId: null,
      status: "draft",
      createdAt: Date.now(),
    };

    dispatch({ type: "ADD_VARIANT", variant });
    saveVariant(variant).catch(console.warn);
  }, [state.variants.length, dispatch]);

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
      parentId: sourceVariantId,
      status: "draft",
      createdAt: Date.now(),
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

  // ── Compute ReactFlow nodes + edges from state variants ─

  const { flowNodes, flowEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Source node (always at 0,0)
    nodes.push({
      id: SOURCE_NODE_ID,
      type: "source",
      position: { x: 0, y: 0 },
      data: {
        label: "Main Preview",
        onForkPage: handleForkPage,
        onForkComponent: handleForkComponent,
      } satisfies SourceNodeData,
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

    function layoutVariant(variant: VariantData, depth: number, parentNodeId: string) {
      const x = VARIANT_COL_OFFSET + depth * (480 + VARIANT_GAP_X);
      const y = yOffset;
      yOffset += 380 + VARIANT_GAP_Y;

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
        } satisfies VariantNodeData,
        draggable: true,
      });

      edges.push({
        id: `edge-${parentNodeId}-${variant.id}`,
        source: parentNodeId,
        target: variant.id,
        type: "smoothstep",
        animated: variant.status === "draft",
        style: { stroke: "#333", strokeWidth: 1.5 },
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
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync ReactFlow state when store variants change
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  return (
    <div
      data-designdead="variant-canvas"
      style={{ width: "100%", height: "100%", background: "#080808" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.05}
        maxZoom={2}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        nodesDraggable
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: "#080808" }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1a1a1a" gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 8 }}
        />
        <MiniMap
          nodeColor={(node) => node.type === "source" ? "#0070f3" : "#333"}
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 8 }}
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
