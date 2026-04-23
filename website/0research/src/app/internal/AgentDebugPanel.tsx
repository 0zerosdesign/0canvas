import { useState } from "react";
import type { AgentDebug } from "./agent";

interface Props {
  debug: AgentDebug;
}

export function AgentDebugPanel({ debug }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  return (
    <div className="oai-debug">
      <button
        className="oai-debug__toggle"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <svg
          className={`oai-debug__chevron ${isOpen ? "oai-debug__chevron--open" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="oai-debug__label">Agent Context</span>
        <span className="oai-debug__summary">
          {debug.examplesSelected.length} examples
          {" / "}~{debug.systemPromptTokens.toLocaleString()} tokens
          {" / "}{debug.totalMessages} messages
        </span>
      </button>

      {isOpen && (
        <div className="oai-debug__body">
          {/* Query */}
          <div className="oai-debug__section">
            <div className="oai-debug__section-title">User Query</div>
            <div className="oai-debug__value">
              {debug.query || "(empty — using default examples)"}
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="oai-debug__section">
            <div className="oai-debug__section-title">Knowledge Base</div>
            <div className="oai-debug__value">
              Searched {debug.kbSize.toLocaleString()} entries from ux-bites
            </div>
          </div>

          {/* Selected Examples */}
          <div className="oai-debug__section">
            <div className="oai-debug__section-title">
              Selected Examples ({debug.examplesSelected.length})
            </div>
            <div className="oai-debug__examples">
              {debug.examplesSelected.map((ex, i) => (
                <div key={i} className="oai-debug__example">
                  <span className="oai-debug__example-rank">#{i + 1}</span>
                  <span className="oai-debug__example-title">{ex.title}</span>
                  <span className="oai-debug__example-company">
                    {ex.company}
                  </span>
                  <span className="oai-debug__example-score">
                    score: {ex.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div className="oai-debug__section">
            <div className="oai-debug__section-title">
              System Prompt Sent to AI (~{debug.systemPromptTokens.toLocaleString()} tokens)
            </div>
            <div className="oai-debug__prompt-wrapper">
              <pre
                className={`oai-debug__prompt ${showFullPrompt ? "oai-debug__prompt--expanded" : ""}`}
              >
                {debug.systemPromptPreview}
              </pre>
              <button
                className="oai-debug__expand-btn"
                onClick={() => setShowFullPrompt(!showFullPrompt)}
                type="button"
              >
                {showFullPrompt ? "Collapse" : "Show full prompt"}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="oai-debug__section">
            <div className="oai-debug__section-title">Request Stats</div>
            <div className="oai-debug__stats">
              <span>Messages: {debug.totalMessages}</span>
              <span>System: ~{debug.systemPromptTokens.toLocaleString()} tokens</span>
              <span>Examples: {debug.examplesSelected.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
