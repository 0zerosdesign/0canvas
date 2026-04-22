// ──────────────────────────────────────────────────────────
// File Watcher — Watch for CSS and .0c file changes
// ──────────────────────────────────────────────────────────
//
// Uses @parcel/watcher for native file watching with C++
// event coalescing. Falls back gracefully if native watcher
// is unavailable.
//
// Debounces per-file (50ms) to coalesce rapid editor saves.
//
// ──────────────────────────────────────────────────────────

import * as path from "node:path";
import type { EngineCache } from "./cache";

export type FileChangeType = "create" | "update" | "delete";
export type FileChangeHandler = (filePath: string, type: FileChangeType, fileType: "css" | "oc" | "jsx" | "other") => void;

interface WatcherSubscription {
  unsubscribe: () => Promise<void>;
}

export class FileWatcher {
  private subscription: WatcherSubscription | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private running = false;

  constructor(
    private root: string,
    private cache: EngineCache,
    private onChange?: FileChangeHandler
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const watcher = await import("@parcel/watcher");
      this.subscription = await watcher.subscribe(
        this.root,
        (err, events) => {
          if (err) {
            console.error("[Zeros] Watcher error:", err);
            return;
          }
          for (const event of events) {
            this.handleEvent(event.path, event.type as "create" | "update" | "delete");
          }
        },
        {
          ignore: [
            "**/node_modules/**",
            "**/dist/**",
            "**/.next/**",
            "**/build/**",
            "**/.zeros/**",
            "**/.git/**",
            "**/*.zeros-tmp",
          ],
        }
      );
      console.log("[Zeros] File watcher started (native)");
    } catch (err) {
      console.warn("[Zeros] Native file watcher unavailable, falling back to polling:", err);
      // In fallback mode, the cache is still rebuilt on manual triggers
      // (e.g., when a WebSocket message requests fresh data)
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    // Clear all pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private handleEvent(filePath: string, type: "create" | "update" | "delete"): void {
    // Debounce per-file: coalesce events within 50ms
    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    this.debounceTimers.set(
      filePath,
      setTimeout(() => {
        this.debounceTimers.delete(filePath);
        this.processEvent(filePath, type);
      }, 50)
    );
  }

  private processEvent(filePath: string, type: FileChangeType): void {
    const ext = path.extname(filePath).toLowerCase();
    let fileType: "css" | "oc" | "jsx" | "other";

    if (ext === ".css") {
      fileType = "css";
      // Update the selector index
      if (type === "delete") {
        this.cache.removeFile(filePath);
      } else {
        this.cache.updateFile(filePath);
      }
    } else if (ext === ".0c") {
      fileType = "oc";
      // .0c files don't go into the CSS cache
    } else if (ext === ".tsx" || ext === ".jsx") {
      fileType = "jsx";
    } else {
      fileType = "other";
      return; // Ignore non-relevant files
    }

    // Notify the engine
    if (this.onChange) {
      this.onChange(filePath, type, fileType);
    }
  }
}
