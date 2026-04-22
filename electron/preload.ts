// ──────────────────────────────────────────────────────────
// Zeros Electron — preload bridge
// ──────────────────────────────────────────────────────────
//
// Exposes `window.__ZEROS_NATIVE__` to the renderer via contextBridge.
// The API matches Tauri's `invoke()` + `listen()` shape so the React
// façade in src/native/runtime.ts can route to either runtime with the
// same call shape.
//
// Channel conventions:
//   zeros:invoke   — renderer → main request/response (ipcRenderer.invoke)
//   zeros:event    — main → renderer fan-out ({name, payload} envelope)
// ──────────────────────────────────────────────────────────

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const INVOKE_CHANNEL = "zeros:invoke";
const EVENT_CHANNEL = "zeros:event";

interface ZerosEventEnvelope {
  name: string;
  payload: unknown;
}

/** Subscribers keyed by event name. Each entry is a Set of handlers so
 *  duplicate subscribes deliver once per handler (matches Tauri's
 *  `listen()` behaviour — each subscription is independent). */
const subscribers = new Map<string, Set<(payload: unknown) => void>>();

// ONE ipcRenderer listener fans out to name-specific subscribers. We
// never remove this (lifetime = preload), so no leaks; individual
// handlers are removed from the Sets when callers unsubscribe.
ipcRenderer.on(EVENT_CHANNEL, (_event: IpcRendererEvent, envelope: ZerosEventEnvelope) => {
  if (!envelope || typeof envelope.name !== "string") return;
  const set = subscribers.get(envelope.name);
  if (!set) return;
  for (const handler of set) {
    try {
      handler(envelope.payload);
    } catch (err) {
      // A bad subscriber shouldn't kill the fan-out.
      // eslint-disable-next-line no-console
      console.error(`[Zeros] event handler threw for "${envelope.name}":`, err);
    }
  }
});

const bridge = {
  /** Call a main-process command. Args is passed through as the single
   *  object payload the handler receives (mirrors Tauri's `invoke`). */
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    return ipcRenderer.invoke(INVOKE_CHANNEL, { cmd, args });
  },

  /** Subscribe to a named event. Returns an unsubscribe function. */
  on<T = unknown>(eventName: string, handler: (payload: T) => void): () => void {
    let set = subscribers.get(eventName);
    if (!set) {
      set = new Set();
      subscribers.set(eventName, set);
    }
    const wrapped = (p: unknown) => handler(p as T);
    set.add(wrapped);
    return () => {
      set!.delete(wrapped);
      if (set!.size === 0) subscribers.delete(eventName);
    };
  },
};

contextBridge.exposeInMainWorld("__ZEROS_NATIVE__", bridge);

// eslint-disable-next-line no-console
console.log("[Zeros] preload: __ZEROS_NATIVE__ exposed on window");
