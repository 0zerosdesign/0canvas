import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { VariantData, FeedbackItem, DDProject } from "../app/store";

export type BridgeState = {
  project: DDProject | null;
  variants: VariantData[];
  feedbackItems: FeedbackItem[];
  resolvedIds: Set<string>;
  pushedChanges: { variantId: string; html: string; css?: string; timestamp: number }[];
  listeners: Set<(event: BridgeEvent) => void>;
};

export type BridgeEvent =
  | { type: "feedback_added"; items: FeedbackItem[] }
  | { type: "feedback_resolved"; ids: string[] }
  | { type: "variant_updated"; variant: VariantData }
  | { type: "changes_pushed"; variantId: string; html: string; css?: string };

const state: BridgeState = {
  project: null,
  variants: [],
  feedbackItems: [],
  resolvedIds: new Set(),
  pushedChanges: [],
  listeners: new Set(),
};

export function getBridgeState(): BridgeState {
  return state;
}

export function pushVariantChanges(variantId: string, html: string, css?: string): void {
  const variant = state.variants.find((v) => v.id === variantId);
  if (variant) {
    variant.modifiedHtml = html;
    if (css) variant.modifiedCss = css;
  }
  state.pushedChanges.push({ variantId, html, css, timestamp: Date.now() });
  emit({ type: "changes_pushed", variantId, html, css });
}

export function subscribe(listener: (event: BridgeEvent) => void): () => void {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

function emit(event: BridgeEvent) {
  for (const listener of state.listeners) {
    try { listener(event); } catch {}
  }
}

function corsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function jsonResponse(res: ServerResponse, data: unknown, status = 200) {
  corsHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    corsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === "/api/health" && req.method === "GET") {
    jsonResponse(res, { status: "ok", project: state.project?.name || null });
    return;
  }

  if (path === "/api/feedback" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const items: FeedbackItem[] = body.items || [];
    state.feedbackItems.push(...items);
    emit({ type: "feedback_added", items });
    jsonResponse(res, { received: items.length });
    return;
  }

  if (path === "/api/feedback" && req.method === "GET") {
    const variantId = url.searchParams.get("variantId");
    const status = url.searchParams.get("status") || "pending";
    let items = state.feedbackItems.filter((f) => f.status === status);
    if (variantId) items = items.filter((f) => f.variantId === variantId);
    jsonResponse(res, { items });
    return;
  }

  if (path === "/api/variants" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const variants: VariantData[] = body.variants || [];
    state.variants = variants;
    jsonResponse(res, { synced: variants.length });
    return;
  }

  if (path === "/api/variants" && req.method === "GET") {
    const id = url.searchParams.get("id");
    if (id) {
      const variant = state.variants.find((v) => v.id === id);
      jsonResponse(res, { variant: variant || null });
    } else {
      jsonResponse(res, { variants: state.variants });
    }
    return;
  }

  if (path === "/api/resolve" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const ids: string[] = body.ids || [];
    for (const id of ids) {
      state.resolvedIds.add(id);
      const item = state.feedbackItems.find((f) => f.id === id);
      if (item) item.status = "resolved";
    }
    emit({ type: "feedback_resolved", ids });
    jsonResponse(res, { resolved: ids.length });
    return;
  }

  if (path === "/api/push-changes" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const { variantId, html, css } = body;
    pushVariantChanges(variantId, html, css);
    jsonResponse(res, { pushed: true });
    return;
  }

  if (path === "/api/project" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    state.project = body.project || null;
    jsonResponse(res, { synced: true });
    return;
  }

  if (path === "/api/poll" && req.method === "GET") {
    const since = parseInt(url.searchParams.get("since") || "0", 10);
    const newItems = state.feedbackItems.filter((f) => f.timestamp > since && f.status === "pending");
    const newResolved = Array.from(state.resolvedIds);
    const newPushed = state.pushedChanges.filter((p) => p.timestamp > since);
    state.pushedChanges = state.pushedChanges.filter((p) => p.timestamp <= since);
    jsonResponse(res, { pending: newItems, resolved: newResolved, pushed: newPushed });
    return;
  }

  jsonResponse(res, { error: "Not found" }, 404);
}

export function startBridge(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      console.error(`[DesignDead Bridge] HTTP server on http://127.0.0.1:${actualPort}`);
      resolve(actualPort);
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        const retryServer = createServer(handleRequest);
        retryServer.listen(0, "127.0.0.1", () => {
          const addr = retryServer.address();
          const actualPort = typeof addr === "object" && addr ? addr.port : 0;
          console.error(`[DesignDead Bridge] Port ${port} in use, using ${actualPort}`);
          resolve(actualPort);
        });
      } else {
        reject(err);
      }
    });
  });
}
