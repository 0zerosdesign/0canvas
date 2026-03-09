import * as vscode from "vscode";
import { parseDDFile, serializeDDFile, applyPatch } from "../shared/ddFile";
import type { HostToWebviewMessage, WebviewToHostMessage } from "../shared/protocol";
import type { DDProjectFile } from "../shared/types";

export class DDCustomEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = "designdead.editor";

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DDCustomEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      DDCustomEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    );
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const webview = webviewPanel.webview;

    // Configure webview
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview"),
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };

    // Set the HTML content
    webview.html = this.getHtmlForWebview(webview);

    // Track whether we're currently applying our own edit (to prevent loops)
    let isApplyingEdit = false;

    // Send initial document state when webview is ready
    const sendDocumentToWebview = () => {
      const text = document.getText();
      const result = parseDDFile(text);

      if (result.valid) {
        const msg: HostToWebviewMessage = {
          type: "documentUpdated",
          doc: result.data,
          version: document.version,
        };
        webview.postMessage(msg);
      } else {
        const msg: HostToWebviewMessage = {
          type: "error",
          errors: result.errors,
        };
        webview.postMessage(msg);
      }
    };

    // Handle messages from webview
    const messageDisposable = webview.onDidReceiveMessage(
      async (message: WebviewToHostMessage) => {
        switch (message.type) {
          case "ready":
            // Send initial document state
            {
              const text = document.getText();
              const result = parseDDFile(text);
              if (result.valid) {
                const msg: HostToWebviewMessage = {
                  type: "init",
                  doc: result.data,
                  version: document.version,
                };
                webview.postMessage(msg);
              } else {
                const msg: HostToWebviewMessage = {
                  type: "error",
                  errors: result.errors,
                };
                webview.postMessage(msg);
              }
            }
            break;

          case "openAsText":
            vscode.commands.executeCommand(
              "vscode.openWith",
              document.uri,
              "default"
            );
            break;

          case "applyPatch":
            {
              const text = document.getText();
              const result = parseDDFile(text);

              if (!result.valid) {
                const msg: HostToWebviewMessage = {
                  type: "reject",
                  requestId: message.requestId,
                  reason: "Current document is invalid: " + result.errors.join(", "),
                };
                webview.postMessage(msg);
                return;
              }

              try {
                const updated = applyPatch(result.data, message.patch);
                const serialized = serializeDDFile(updated);

                isApplyingEdit = true;

                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                  document.positionAt(0),
                  document.positionAt(text.length)
                );
                edit.replace(document.uri, fullRange, serialized);
                const success = await vscode.workspace.applyEdit(edit);

                isApplyingEdit = false;

                if (success) {
                  const msg: HostToWebviewMessage = {
                    type: "ack",
                    requestId: message.requestId,
                    version: document.version,
                  };
                  webview.postMessage(msg);
                } else {
                  const msg: HostToWebviewMessage = {
                    type: "reject",
                    requestId: message.requestId,
                    reason: "Failed to apply edit to document",
                  };
                  webview.postMessage(msg);
                }
              } catch (err) {
                isApplyingEdit = false;
                const msg: HostToWebviewMessage = {
                  type: "reject",
                  requestId: message.requestId,
                  reason: `Patch error: ${err instanceof Error ? err.message : String(err)}`,
                };
                webview.postMessage(msg);
              }
            }
            break;
        }
      }
    );

    // Sync file changes to webview (handles external edits, text editor changes, etc.)
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return;
      if (isApplyingEdit) return;
      if (e.contentChanges.length === 0) return;

      sendDocumentToWebview();
    });

    // Clean up on panel dispose
    webviewPanel.onDidDispose(() => {
      messageDisposable.dispose();
      changeDisposable.dispose();
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    // Get webview asset URIs
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview", "assets", "webview.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview", "assets", "index.css")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src ${webview.cspSource} https: data:;
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
    font-src ${webview.cspSource} https: data:;
    frame-src data: blob:;
  " />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>DesignDead</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
