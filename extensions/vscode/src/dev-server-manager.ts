// ──────────────────────────────────────────────────────────
// Dev Server Manager — Auto-detect and start Vite dev server
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";

export class DevServerManager {
  private workspaceRoot: string;
  private terminal: vscode.Terminal | null = null;
  private _isRunning = false;
  private _url: string | null = null;
  private statusListeners: ((running: boolean, url: string | null) => void)[] = [];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get url(): string | null {
    return this._url;
  }

  /** Check if a dev server is already running by reading .0canvas/.port */
  checkRunning(): { running: boolean; url: string | null } {
    try {
      const portFile = path.join(this.workspaceRoot, ".0canvas", ".port");
      if (!fs.existsSync(portFile)) return { running: false, url: null };

      const port = parseInt(fs.readFileSync(portFile, "utf-8").trim(), 10);
      if (isNaN(port)) return { running: false, url: null };

      this._url = `http://localhost:${port}`;
      this._isRunning = true;
      return { running: true, url: this._url };
    } catch {
      return { running: false, url: null };
    }
  }

  /** Detect the dev command from package.json */
  detectDevCommand(): { command: string; args: string } | null {
    try {
      const pkgPath = path.join(this.workspaceRoot, "package.json");
      if (!fs.existsSync(pkgPath)) return null;

      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};

      // Check common dev script names in order of preference
      const candidates = ["test:ui", "dev", "start", "serve"];
      for (const name of candidates) {
        if (scripts[name]) {
          // Detect package manager
          const pm = this.detectPackageManager();
          return { command: pm, args: `run ${name}` };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /** Start the dev server in a VS Code terminal */
  async start(): Promise<string | null> {
    // Check if already running
    const status = this.checkRunning();
    if (status.running) {
      this.notifyListeners(true, status.url);
      return status.url;
    }

    const devCmd = this.detectDevCommand();
    if (!devCmd) {
      vscode.window.showWarningMessage(
        "0canvas: No dev script found in package.json. Add a \"dev\" or \"test:ui\" script."
      );
      return null;
    }

    // Create terminal and run
    this.terminal = vscode.window.createTerminal({
      name: "0canvas Dev Server",
      cwd: this.workspaceRoot,
    });
    this.terminal.show(true); // true = preserve focus
    this.terminal.sendText(`${devCmd.command} ${devCmd.args}`, true);

    // Wait for .0canvas/.port to appear (server ready signal)
    const url = await this.waitForPort(15000);

    if (url) {
      this._isRunning = true;
      this._url = url;
      this.notifyListeners(true, url);
      return url;
    } else {
      vscode.window.showWarningMessage(
        "0canvas: Dev server started but port file not detected. Check the terminal for errors."
      );
      return null;
    }
  }

  /** Open the browser to the dev server URL */
  async openBrowser(): Promise<void> {
    let url = this._url;
    if (!url) {
      const status = this.checkRunning();
      url = status.url;
    }

    if (url) {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } else {
      // Try to start, then open
      url = await this.start();
      if (url) {
        await vscode.env.openExternal(vscode.Uri.parse(url));
      }
    }
  }

  /** Subscribe to status changes */
  onStatusChange(cb: (running: boolean, url: string | null) => void): void {
    this.statusListeners.push(cb);
  }

  dispose(): void {
    this.terminal?.dispose();
    this.statusListeners = [];
  }

  // ── Private ────────────────────────────────────────────

  private detectPackageManager(): string {
    if (fs.existsSync(path.join(this.workspaceRoot, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(this.workspaceRoot, "yarn.lock"))) return "yarn";
    return "npm";
  }

  private waitForPort(timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      const portFile = path.join(this.workspaceRoot, ".0canvas", ".port");
      const start = Date.now();

      const check = () => {
        if (Date.now() - start > timeoutMs) {
          resolve(null);
          return;
        }

        try {
          if (fs.existsSync(portFile)) {
            const port = parseInt(fs.readFileSync(portFile, "utf-8").trim(), 10);
            if (!isNaN(port)) {
              resolve(`http://localhost:${port}`);
              return;
            }
          }
        } catch {
          // Ignore
        }

        setTimeout(check, 500);
      };

      check();
    });
  }

  private notifyListeners(running: boolean, url: string | null): void {
    for (const cb of this.statusListeners) cb(running, url);
  }
}
