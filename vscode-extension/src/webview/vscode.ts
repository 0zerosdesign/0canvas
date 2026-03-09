import type { HostToWebviewMessage, WebviewToHostMessage } from "../shared/protocol";

// Acquire the VS Code webview API (available only inside webview context)
interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    try {
      api = acquireVsCodeApi();
    } catch {
      // Fallback for development outside VS Code
      api = {
        postMessage: (msg) => console.log("[vscode.postMessage]", msg),
        getState: () => null,
        setState: () => {},
      };
    }
  }
  return api;
}

export function postMessage(message: WebviewToHostMessage): void {
  getVsCodeApi().postMessage(message);
}

export function onMessage(handler: (message: HostToWebviewMessage) => void): () => void {
  const listener = (event: MessageEvent<HostToWebviewMessage>) => {
    handler(event.data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
