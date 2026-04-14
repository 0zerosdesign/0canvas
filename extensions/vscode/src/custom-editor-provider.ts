// ──────────────────────────────────────────────────────────
// Custom Editor for .0c Files — Project Dashboard
// ──────────────────────────────────────────────────────────
//
// When a user opens a .0c file, instead of showing raw JSON,
// this shows a project dashboard with:
//   - Project info
//   - "Open in Browser" button
//   - Dev server status + start button
//   - Bridge connection status
//
// Design happens in the BROWSER, not here. This is the
// control center / launch pad.
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import { DevServerManager } from "./dev-server-manager";
import type { BridgeStatus } from "./websocket-client";

export class OCEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "0canvas.ocEditor";

  private devServer: DevServerManager;
  private bridgeStatus: BridgeStatus = "disconnected";
  private activeWebviews = new Set<vscode.WebviewPanel>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    devServer: DevServerManager
  ) {
    this.devServer = devServer;
  }

  updateBridgeStatus(status: BridgeStatus): void {
    this.bridgeStatus = status;
    for (const panel of this.activeWebviews) {
      this.updateWebview(panel);
    }
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    this.activeWebviews.add(webviewPanel);

    // Parse the .0c file
    let projectData = this.parseOCFile(document.getText());

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "startServer":
          await this.devServer.start();
          this.updateWebview(webviewPanel);
          break;
        case "openBrowser":
          await this.devServer.openBrowser();
          break;
        case "refresh":
          this.devServer.checkRunning();
          this.updateWebview(webviewPanel);
          break;
      }
    });

    // Update when document changes
    const changeListener = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        projectData = this.parseOCFile(document.getText());
        this.updateWebview(webviewPanel);
      }
    });

    // Update when dev server status changes
    this.devServer.onStatusChange(() => {
      this.updateWebview(webviewPanel);
    });

    webviewPanel.onDidDispose(() => {
      this.activeWebviews.delete(webviewPanel);
      changeListener.dispose();
    });

    // Initial render
    this.renderWebview(webviewPanel, projectData);
  }

  private updateWebview(panel: vscode.WebviewPanel): void {
    try {
      const doc = vscode.workspace.textDocuments.find((d) =>
        d.uri.scheme === "file" && d.fileName.endsWith(".0c")
      );
      const projectData = doc ? this.parseOCFile(doc.getText()) : null;
      this.renderWebview(panel, projectData);
    } catch {
      // Panel may be disposed
    }
  }

  private parseOCFile(text: string): ProjectInfo | null {
    try {
      const data = JSON.parse(text);
      return {
        name: data.project?.name ?? "Untitled",
        framework: data.workspace?.framework ?? "unknown",
        schemaVersion: data.schemaVersion ?? 1,
        revision: data.project?.revision ?? 0,
        updatedAt: data.project?.updatedAt ?? null,
        variantCount: data.variants?.length ?? 0,
        pageCount: data.pages?.length ?? 0,
        checkpointCount: data.history?.checkpoints?.length ?? 0,
      };
    } catch {
      return null;
    }
  }

  private renderWebview(panel: vscode.WebviewPanel, project: ProjectInfo | null): void {
    const serverStatus = this.devServer.checkRunning();
    panel.webview.html = this.getHtml(project, serverStatus.running, serverStatus.url);
  }

  private getHtml(
    project: ProjectInfo | null,
    serverRunning: boolean,
    serverUrl: string | null
  ): string {
    const bridgeColor =
      this.bridgeStatus === "connected" ? "#22c55e"
      : this.bridgeStatus === "connecting" ? "#eab308"
      : "#71717a";
    const bridgeLabel =
      this.bridgeStatus === "connected" ? "Connected"
      : this.bridgeStatus === "connecting" ? "Connecting..."
      : "Disconnected";

    const serverColor = serverRunning ? "#22c55e" : "#71717a";
    const serverLabel = serverRunning ? serverUrl ?? "Running" : "Stopped";

    const name = project?.name ?? "Unknown Project";
    const framework = project?.framework ?? "–";
    const revision = project?.revision ?? 0;
    const variants = project?.variantCount ?? 0;
    const pages = project?.pageCount ?? 0;
    const checkpoints = project?.checkpointCount ?? 0;
    const updatedAt = project?.updatedAt
      ? new Date(project.updatedAt).toLocaleString()
      : "–";

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 32px;
      max-width: 600px;
    }

    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
    .header svg { flex-shrink: 0; opacity: 0.7; }
    .header h1 { font-size: 22px; font-weight: 700; }
    .header .version { font-size: 12px; color: var(--vscode-descriptionForeground); margin-left: 8px; font-weight: 400; }

    .card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 8px; padding: 16px; margin-bottom: 16px;
    }
    .card-title {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
      color: var(--vscode-descriptionForeground); margin-bottom: 12px; font-weight: 600;
    }

    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .stat { display: flex; flex-direction: column; gap: 2px; }
    .stat-label { font-size: 11px; color: var(--vscode-descriptionForeground); }
    .stat-value { font-size: 13px; font-weight: 500; }

    .status-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-label { font-size: 12px; flex: 1; }
    .status-value { font-size: 12px; color: var(--vscode-descriptionForeground); }

    .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; }
    .btn {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; padding: 10px 16px; border: none; border-radius: 6px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      transition: opacity 0.15s;
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

    .hint {
      font-size: 11px; color: var(--vscode-descriptionForeground);
      margin-top: 16px; line-height: 1.5;
    }
    .kbd {
      padding: 1px 5px; border-radius: 3px;
      background: var(--vscode-keybindingLabel-background);
      border: 1px solid var(--vscode-keybindingLabel-border);
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
    <h1>${name}<span class="version">v${revision}</span></h1>
  </div>

  <!-- Project Info -->
  <div class="card">
    <div class="card-title">Project</div>
    <div class="stat-grid">
      <div class="stat">
        <span class="stat-label">Framework</span>
        <span class="stat-value">${framework}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Last Updated</span>
        <span class="stat-value">${updatedAt}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Pages</span>
        <span class="stat-value">${pages}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Variants</span>
        <span class="stat-value">${variants}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Checkpoints</span>
        <span class="stat-value">${checkpoints}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Schema</span>
        <span class="stat-value">v1</span>
      </div>
    </div>
  </div>

  <!-- Status -->
  <div class="card">
    <div class="card-title">Status</div>
    <div class="status-row">
      <span class="status-dot" style="background: ${serverColor};"></span>
      <span class="status-label">Dev Server</span>
      <span class="status-value">${serverLabel}</span>
    </div>
    <div class="status-row">
      <span class="status-dot" style="background: ${bridgeColor};"></span>
      <span class="status-label">Bridge</span>
      <span class="status-value">${bridgeLabel}</span>
    </div>
  </div>

  <!-- Actions -->
  <div class="actions">
    ${serverRunning
      ? `<button class="btn btn-primary" onclick="openBrowser()">Open in Browser</button>`
      : `<button class="btn btn-primary" onclick="startServer()">Start Dev Server</button>`
    }
    <button class="btn btn-secondary" onclick="refresh()">Refresh Status</button>
  </div>

  <p class="hint">
    Open your app in the browser, then press
    <kbd class="kbd">Ctrl</kbd>+<kbd class="kbd">Shift</kbd>+<kbd class="kbd">D</kbd>
    to toggle the design overlay.
  </p>

  <script>
    const vscode = acquireVsCodeApi();
    function startServer() { vscode.postMessage({ command: "startServer" }); }
    function openBrowser() { vscode.postMessage({ command: "openBrowser" }); }
    function refresh() { vscode.postMessage({ command: "refresh" }); }
  </script>
</body>
</html>`;
  }
}

interface ProjectInfo {
  name: string;
  framework: string;
  schemaVersion: number;
  revision: number;
  updatedAt: number | null;
  variantCount: number;
  pageCount: number;
  checkpointCount: number;
}
