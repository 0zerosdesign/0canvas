// ──────────────────────────────────────────────────────────
// Bridge Client — Polls the 0canvas MCP bridge for feedback
// ──────────────────────────────────────────────────────────

import * as http from "http";

export type FeedbackItem = {
  id: string;
  variantId: string;
  elementId: string;
  elementSelector: string;
  elementTag: string;
  elementClasses: string[];
  comment: string;
  intent: string;
  severity: string;
  status: "pending" | "sent" | "resolved";
  timestamp: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
};

type HealthResponse = {
  status: string;
  project: string | null;
  ide: string | null;
};

function fetchJSON<T>(url: string, timeout = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON"));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

export class BridgeClient {
  private port: number;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp = 0;
  private _onFeedback: ((items: FeedbackItem[]) => void) | null = null;
  private _onStatusChange: ((online: boolean) => void) | null = null;
  private _online = false;

  constructor(port = 24192) {
    this.port = port;
  }

  get online() {
    return this._online;
  }

  onFeedback(cb: (items: FeedbackItem[]) => void) {
    this._onFeedback = cb;
  }

  onStatusChange(cb: (online: boolean) => void) {
    this._onStatusChange = cb;
  }

  async checkHealth(): Promise<HealthResponse | null> {
    try {
      const data = await fetchJSON<HealthResponse>(
        `http://127.0.0.1:${this.port}/api/health`
      );
      if (!this._online) {
        this._online = true;
        this._onStatusChange?.(true);
      }
      return data;
    } catch {
      if (this._online) {
        this._online = false;
        this._onStatusChange?.(false);
      }
      return null;
    }
  }

  async getPendingFeedback(): Promise<FeedbackItem[]> {
    try {
      const data = await fetchJSON<{ items: FeedbackItem[] }>(
        `http://127.0.0.1:${this.port}/api/feedback?status=pending`
      );
      return data.items || [];
    } catch {
      return [];
    }
  }

  async poll(): Promise<void> {
    try {
      const data = await fetchJSON<{ pending: FeedbackItem[] }>(
        `http://127.0.0.1:${this.port}/api/poll?since=${this.lastPollTimestamp}`
      );

      if (!this._online) {
        this._online = true;
        this._onStatusChange?.(true);
      }

      if (data.pending && data.pending.length > 0) {
        this.lastPollTimestamp = Date.now();
        this._onFeedback?.(data.pending);
      }
    } catch {
      if (this._online) {
        this._online = false;
        this._onStatusChange?.(false);
      }
    }
  }

  startPolling(intervalMs = 2000) {
    this.stopPolling();
    this.checkHealth();
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  dispose() {
    this.stopPolling();
  }
}
