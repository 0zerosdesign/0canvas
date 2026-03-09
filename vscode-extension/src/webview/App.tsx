import React, { useState, useEffect, useCallback } from "react";
import type { DDProjectFile } from "../shared/types";
import type { HostToWebviewMessage, DDPatch } from "../shared/protocol";
import { postMessage, onMessage } from "./vscode";
import { ProjectHeader } from "./components/ProjectHeader";
import { DesignCanvas } from "./components/DesignCanvas";
import { ErrorState } from "./components/ErrorState";

type AppState =
  | { status: "loading" }
  | { status: "error"; errors: string[] }
  | { status: "ready"; doc: DDProjectFile; version: number };

let patchCounter = 0;

export function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });

  useEffect(() => {
    const cleanup = onMessage((message: HostToWebviewMessage) => {
      switch (message.type) {
        case "init":
        case "documentUpdated":
          setState({ status: "ready", doc: message.doc, version: message.version });
          break;
        case "error":
          setState({ status: "error", errors: message.errors });
          break;
        case "ack":
          break;
        case "reject":
          console.warn("[DesignDead] Patch rejected:", message.reason);
          break;
      }
    });
    return cleanup;
  }, []);

  const sendPatch = useCallback((patch: DDPatch) => {
    const requestId = `patch-${++patchCounter}-${Date.now()}`;
    postMessage({ type: "applyPatch", requestId, patch });
  }, []);

  if (state.status === "loading") {
    return (
      <div className="dd-loading">
        <div className="dd-spinner" />
        <p>Loading .dd file...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState errors={state.errors} />;
  }

  const { doc } = state;

  return (
    <div className="dd-workspace">
      {/* Top toolbar */}
      <ProjectHeader project={doc.project} workspace={doc.workspace} onPatch={sendPatch} />

      {/* Full canvas area */}
      <div className="dd-canvas-area">
        <DesignCanvas doc={doc} onPatch={sendPatch} />
      </div>
    </div>
  );
}
