// ──────────────────────────────────────────────────────────
// 0canvas Sidebar — Dashboard webview in the Activity Bar
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import type { BridgeStatus } from "./websocket-client";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "0canvas.dashboardView";

  private view?: vscode.WebviewView;
  private bridgeStatus: BridgeStatus = "disconnected";
  private devServerUrl: string | null = null;
  private pendingFeedbackCount = 0;
  private agentName = "Unknown";

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === "openBrowser") {
        if (this.devServerUrl) {
          vscode.env.openExternal(vscode.Uri.parse(this.devServerUrl));
        }
      }
      if (message.command === "sendFeedback") {
        vscode.commands.executeCommand("0canvas.sendToAgent");
      }
      if (message.command === "copyFeedback") {
        vscode.commands.executeCommand("0canvas.copyFeedback");
      }
    });

    this.render();
  }

  updateBridgeStatus(status: BridgeStatus) {
    this.bridgeStatus = status;
    this.render();
  }

  updateDevServerUrl(url: string | null) {
    this.devServerUrl = url;
    this.render();
  }

  updatePendingFeedback(count: number) {
    this.pendingFeedbackCount = count;
    this.render();
  }

  updateAgent(name: string) {
    this.agentName = name;
    this.render();
  }

  private render() {
    if (!this.view) return;
    this.view.webview.html = this.getHtml();
  }

  private getHtml(): string {
    const bridgeColor =
      this.bridgeStatus === "connected" ? "#22c55e"
      : this.bridgeStatus === "connecting" ? "#eab308"
      : "#71717a";
    const bridgeLabel =
      this.bridgeStatus === "connected" ? "Connected"
      : this.bridgeStatus === "connecting" ? "Connecting..."
      : "Disconnected";
    const bridgeIcon =
      this.bridgeStatus === "connected" ? "&#x2714;" : "&#x25CB;";

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 16px 14px;
    }

    .logo {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 20px;
    }
    .logo svg { flex-shrink: 0; }
    .logo-text {
      font-size: 16px; font-weight: 700;
      color: var(--vscode-foreground);
    }
    .logo-version {
      font-size: 11px; color: var(--vscode-descriptionForeground);
      margin-left: 4px; font-weight: 400;
    }

    .section {
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px; font-weight: 600;
    }

    .status-row {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 0;
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      flex-shrink: 0;
    }
    .status-label {
      font-size: 12px;
    }
    .status-value {
      font-size: 12px; color: var(--vscode-descriptionForeground);
      margin-left: auto;
    }

    .btn {
      display: flex; align-items: center; justify-content: center;
      gap: 6px; width: 100%; padding: 8px 12px;
      border: none; border-radius: 4px;
      font-size: 12px; font-weight: 500;
      cursor: pointer; transition: opacity 0.15s;
      margin-bottom: 6px;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn:disabled {
      opacity: 0.5; cursor: not-allowed;
    }

    .divider {
      height: 1px;
      background: var(--vscode-widget-border);
      margin: 14px 0;
    }

    .hint {
      font-size: 11px; color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }
    .kbd {
      padding: 1px 5px; border-radius: 3px;
      background: var(--vscode-keybindingLabel-background);
      border: 1px solid var(--vscode-keybindingLabel-border);
      font-size: 10px; font-family: var(--vscode-editor-font-family);
    }
  </style>
</head>
<body>
  <div class="logo">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
    <span class="logo-text">0canvas<span class="logo-version">v0.0.1</span></span>
  </div>

  <!-- Bridge Status -->
  <div class="section">
    <div class="section-title">Bridge</div>
    <div class="status-row">
      <span class="status-dot" style="background: ${bridgeColor};"></span>
      <span class="status-label">WebSocket</span>
      <span class="status-value">${bridgeLabel}</span>
    </div>
    ${this.devServerUrl ? `
    <div class="status-row">
      <span class="status-dot" style="background: #22c55e;"></span>
      <span class="status-label">Dev Server</span>
      <span class="status-value">${this.devServerUrl}</span>
    </div>
    ` : `
    <div class="status-row">
      <span class="status-dot" style="background: #71717a;"></span>
      <span class="status-label">Dev Server</span>
      <span class="status-value">Not detected</span>
    </div>
    `}
    <div class="status-row">
      <span class="status-dot" style="background: #3b82f6;"></span>
      <span class="status-label">Agent</span>
      <span class="status-value">${this.agentName}</span>
    </div>
  </div>

  <!-- Actions -->
  <div class="section">
    <div class="section-title">Actions</div>
    <button class="btn btn-primary" onclick="openBrowser()" ${!this.devServerUrl ? "disabled" : ""}>
      Open in Browser
    </button>
    <button class="btn btn-secondary" onclick="sendFeedback()">
      Send Feedback to Agent ${this.pendingFeedbackCount > 0 ? `(${this.pendingFeedbackCount})` : ""}
    </button>
    <button class="btn btn-secondary" onclick="copyFeedback()">
      Copy Feedback
    </button>
  </div>

  <div class="divider"></div>

  <p class="hint">
    Open your app in the browser, then press
    <kbd class="kbd">Ctrl</kbd>+<kbd class="kbd">Shift</kbd>+<kbd class="kbd">D</kbd>
    to toggle the design overlay.
  </p>

  <script>
    const vscode = acquireVsCodeApi();
    function openBrowser() { vscode.postMessage({ command: "openBrowser" }); }
    function sendFeedback() { vscode.postMessage({ command: "sendFeedback" }); }
    function copyFeedback() { vscode.postMessage({ command: "copyFeedback" }); }
  </script>
</body>
</html>`;
  }
}
