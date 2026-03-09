import React from "react";
import { postMessage } from "../vscode";

interface Props {
  errors: string[];
}

export function ErrorState({ errors }: Props) {
  return (
    <div className="dd-error">
      <div className="dd-error-icon">⚠️</div>
      <h2 className="dd-error-title">Invalid .dd file</h2>
      <p className="dd-error-desc">The file could not be parsed as a valid DesignDead project.</p>
      <ul className="dd-error-list">
        {errors.map((err, i) => (
          <li key={i}>{err}</li>
        ))}
      </ul>
      <button
        className="dd-btn dd-btn-primary"
        onClick={() => postMessage({ type: "openAsText" })}
      >
        Open as Text
      </button>
    </div>
  );
}
