import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
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
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  SharedVariantNode,
  PageNode,
  type SharedVariantNodeData,
  type PageNodeData,
  type CanvasVariantData,
  type VariantNodeCallbacks,
  VARIANT_GAP_X,
  VARIANT_GAP_Y,
  DEFAULT_VARIANT_W,
  DEFAULT_VARIANT_H,
} from "@designdead/canvas";
import type { DDProjectFile, DDVariant } from "../../shared/types";
import type { DDPatch } from "../../shared/protocol";

const NODE_TYPES: NodeTypes = {
  page: PageNode,
  variant: SharedVariantNode,
};

const VARIANT_COL_OFFSET = 320;

interface Props {
  doc: DDProjectFile;
  onPatch: (patch: DDPatch) => void;
}

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return useCallback((...args: any[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as unknown as T;
}

// Convert DDVariant to CanvasVariantData
function toCanvasVariant(v: DDVariant): CanvasVariantData {
  return {
    id: v.id,
    name: v.name,
    html: v.content.html,
    css: v.content.styles,
    sourceType: v.sourceElementId ? "component" : "page",
    sourceElementId: v.sourceElementId,
    sourceViewportWidth: v.sourceViewportWidth,
    parentId: v.parentId || null,
    status: v.status || "draft",
    createdAt: v.createdAt,
    feedback: v.feedback.map((f) => ({
      id: f.id,
      text: f.text,
      severity: f.severity,
      elementId: f.elementId,
      createdAt: f.createdAt,
      resolved: (f as any).resolved,
    })),
    canvasPosition: v.canvasPosition,
    canvasSize: v.canvasSize,
  };
}

function DesignCanvasInner({ doc, onPatch }: Props) {
  const [canvasInteracting, setCanvasInteracting] = useState(false);

  const pageMap = useMemo(() => new Map(doc.pages.map((p) => [p.id, p])), [doc.pages]);

  // Build callbacks for variant actions (wired to onPatch)
  const variantCallbacks = useMemo<VariantNodeCallbacks>(() => ({
    onRename: (variantId, newName) =>
      onPatch({ op: "updateVariantName", variantId, name: newName }),
    onDelete: (variantId) =>
      onPatch({ op: "deleteVariant", variantId }),
    onFinalize: (variantId) =>
      onPatch({ op: "updateVariantStatus", variantId, status: "finalized" }),
    onResize: (variantId, width, height) =>
      onPatch({ op: "updateVariantCanvasSize", variantId, size: { width, height } }),
    onDeleteFeedback: (variantId, feedbackId) =>
      onPatch({ op: "deleteFeedback", variantId, feedbackId }),
    onResolveFeedback: (variantId, feedbackId) =>
      onPatch({ op: "resolveFeedback", variantId, feedbackId }),
  }), [onPatch]);

  const { flowNodes, flowEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    for (let i = 0; i < doc.pages.length; i++) {
      const page = doc.pages[i];
      const variantCount = doc.variants.filter((v) => v.pageId === page.id).length;
      const pos = page.canvasPosition || { x: 0, y: i * 200 };

      nodes.push({
        id: `page-${page.id}`,
        type: "page",
        position: pos,
        data: {
          page: { id: page.id, name: page.name, route: page.route },
          framework: doc.workspace.framework,
          variantCount,
        } satisfies PageNodeData,
        draggable: true,
      });
    }

    for (const [pageId, page] of pageMap) {
      const variants = doc.variants.filter((v) => v.pageId === pageId);
      const rootVariants = variants.filter((v) => !v.parentId);
      const childMap = new Map<string, DDVariant[]>();
      for (const v of variants) {
        if (v.parentId) {
          const children = childMap.get(v.parentId) || [];
          children.push(v);
          childMap.set(v.parentId, children);
        }
      }

      let yOffset = 0;

      function layoutVariant(variant: DDVariant, depth: number, parentNodeId: string) {
        const canvasVariant = toCanvasVariant(variant);
        const nodeW = canvasVariant.canvasSize?.width || canvasVariant.sourceViewportWidth || DEFAULT_VARIANT_W;
        const nodeH = canvasVariant.canvasSize?.height || Math.round(nodeW * (DEFAULT_VARIANT_H / DEFAULT_VARIANT_W));

        const pos = canvasVariant.canvasPosition || {
          x: VARIANT_COL_OFFSET + depth * (Math.max(nodeW, DEFAULT_VARIANT_W) + VARIANT_GAP_X),
          y: yOffset,
        };

        if (!canvasVariant.canvasPosition) {
          yOffset += nodeH + VARIANT_GAP_Y;
        }

        nodes.push({
          id: variant.id,
          type: "variant",
          position: pos,
          data: {
            variant: canvasVariant,
            callbacks: variantCallbacks,
            routeLabel: page?.route,
          } satisfies SharedVariantNodeData,
          style: { width: nodeW, height: nodeH },
          draggable: true,
        });

        edges.push({
          id: `edge-${parentNodeId}-${variant.id}`,
          source: parentNodeId,
          target: variant.id,
          type: "smoothstep",
          animated: (variant.status || "draft") === "draft",
          style: { stroke: "#333", strokeWidth: 1.5 },
        });

        const children = childMap.get(variant.id) || [];
        for (const child of children) {
          layoutVariant(child, depth + 1, variant.id);
        }
      }

      for (const rv of rootVariants) {
        layoutVariant(rv, 0, `page-${pageId}`);
      }
    }

    return { flowNodes: nodes, flowEdges: edges };
  }, [doc, pageMap, variantCallbacks]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const debouncedSavePosition = useDebouncedCallback(
    (nodeId: string, x: number, y: number) => {
      if (nodeId.startsWith("page-")) {
        onPatch({ op: "updatePagePosition", pageId: nodeId.replace("page-", ""), position: { x: Math.round(x), y: Math.round(y) } });
      } else {
        onPatch({ op: "updateVariantPosition", variantId: nodeId, position: { x: Math.round(x), y: Math.round(y) } });
      }
    },
    500
  );

  const debouncedSaveViewport = useDebouncedCallback(
    (viewport: Viewport) => {
      onPatch({
        op: "updateCanvasViewport",
        viewport: { x: Math.round(viewport.x), y: Math.round(viewport.y), zoom: Math.round(viewport.zoom * 100) / 100 },
      });
    },
    1000
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      debouncedSavePosition(node.id, node.position.x, node.position.y);
    },
    [debouncedSavePosition]
  );

  useEffect(() => {
    if (!canvasInteracting) return;
    const style = document.createElement("style");
    style.id = "dd-canvas-guard";
    style.textContent = `iframe { pointer-events: none !important; }`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [canvasInteracting]);

  const initialViewport = doc.canvas?.viewport || undefined;

  return (
    <div style={{ width: "100%", height: "100%", background: "#080808" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMoveStart={() => setCanvasInteracting(true)}
        onMoveEnd={(_event: unknown, viewport: Viewport) => {
          setCanvasInteracting(false);
          debouncedSaveViewport(viewport);
        }}
        onNodeDragStart={() => setCanvasInteracting(true)}
        onNodeDragStop={(event, node) => {
          setCanvasInteracting(false);
          handleNodeDragStop(event, node);
        }}
        fitView={!initialViewport}
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        defaultViewport={initialViewport}
        minZoom={0.05}
        maxZoom={2}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        nodesDraggable
        nodeDragThreshold={5}
        nodesConnectable={false}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: "#080808" }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1a1a1a" gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 8 }}
        />
        <MiniMap
          nodeColor={(node) => node.type === "page" ? "#0070f3" : "#333"}
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 8 }}
        />
      </ReactFlow>
    </div>
  );
}

export function DesignCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <DesignCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
