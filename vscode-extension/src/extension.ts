import * as vscode from "vscode";
import { DDCustomEditorProvider } from "./providers/DDCustomEditorProvider";

export function activate(context: vscode.ExtensionContext) {
  // Register the custom editor provider for .dd files
  context.subscriptions.push(
    DDCustomEditorProvider.register(context)
  );

  // Register "Open as Text" command
  context.subscriptions.push(
    vscode.commands.registerCommand("designdead.openAsText", (uri?: vscode.Uri) => {
      const target = uri || vscode.window.activeTextEditor?.document.uri;
      if (target) {
        vscode.commands.executeCommand("vscode.openWith", target, "default");
      }
    })
  );
}

export function deactivate() {}
