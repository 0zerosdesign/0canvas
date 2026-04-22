// ──────────────────────────────────────────────────────────
// Phase 4-J — Mission Control
// ──────────────────────────────────────────────────────────
//
// A tiny dashboard over the AI subprocess bridge. Subscribes to
// `ai-stream-event` and keeps a rolling buffer of sessions +
// chars streamed + last error. Enough for the user to see what's
// happening without instrumenting each provider separately.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Activity,
  Gauge,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type SessionRecord = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  chars: number;
  toolCalls: number;
  error: string | null;
};

type StreamEvent = {
  sessionId: string;
  kind: string;
  content?: string | null;
  data?: unknown;
};

import { isNativeRuntime, nativeListen } from "../native/runtime";

// Very rough token estimate — real tokenizer is provider-specific and
// runtime-expensive. A 4 chars/token average is close enough for a
// "how much am I spending" feel in the panel header.
function approxTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function fmtDuration(start: number, end: number | null): string {
  const ms = (end ?? Date.now()) - start;
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export function MissionPanel() {
  const [sessions, setSessions] = useState<Map<string, SessionRecord>>(
    () => new Map(),
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Keep the durations live while a session is in-flight.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isNativeRuntime()) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const off = await nativeListen<StreamEvent>("ai-stream-event", (payload) => {
        const { sessionId, kind, content } = payload;
        setSessions((prev) => {
          const next = new Map(prev);
          const existing =
            next.get(sessionId) ?? {
              id: sessionId,
              startedAt: Date.now(),
              endedAt: null,
              chars: 0,
              toolCalls: 0,
              error: null,
            };
          if (kind === "text" && typeof content === "string") {
            existing.chars += content.length;
          } else if (kind === "tool") {
            existing.toolCalls += 1;
          } else if (kind === "error" && content) {
            existing.error = content;
            setLastError(content);
          } else if (kind === "end") {
            existing.endedAt = Date.now();
          }
          next.set(sessionId, { ...existing });
          return next;
        });
      });
      if (cancelled) off();
      else unlisten = off;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const list = Array.from(sessions.values()).sort(
    (a, b) => b.startedAt - a.startedAt,
  );
  const active = list.filter((s) => s.endedAt === null);
  const totalChars = list.reduce((sum, s) => sum + s.chars, 0);

  return (
    <div className="oc-mission" data-tick={tick}>
      <div className="oc-mission__header">
        <h2 className="oc-mission__title">
          <Sparkles size={14} /> Mission Control
        </h2>
        <p className="oc-mission__subtitle">
          Live activity from Claude / Codex subprocesses. Subscribes to
          <code> ai-stream-event</code> and stops recording when a session
          ends.
        </p>
      </div>

      <div className="oc-mission__cards">
        <MetricCard
          icon={<Activity size={14} />}
          label="Active sessions"
          value={String(active.length)}
          tint="info"
        />
        <MetricCard
          icon={<Gauge size={14} />}
          label="Tokens (approx.)"
          value={approxTokens(totalChars).toLocaleString()}
          tint="success"
        />
        <MetricCard
          icon={<AlertTriangle size={14} />}
          label={lastError ? "Last error" : "No errors"}
          value={lastError ?? "—"}
          tint={lastError ? "danger" : "muted"}
        />
      </div>

      <section className="oc-mission__section">
        <h3 className="oc-mission__section-title">Recent sessions</h3>
        {list.length === 0 ? (
          <p className="oc-mission__empty">
            No AI calls yet. Send a message in the Chat tab and this panel
            will populate.
          </p>
        ) : (
          <ul className="oc-mission__sessions">
            {list.slice(0, 20).map((s) => (
              <li key={s.id} className="oc-mission__session">
                <div className="oc-mission__session-main">
                  <code className="oc-mission__session-id">
                    {s.id.slice(-8)}
                  </code>
                  <span className="oc-mission__session-meta">
                    {fmtDuration(s.startedAt, s.endedAt)} ·{" "}
                    {approxTokens(s.chars).toLocaleString()} tok ·{" "}
                    {s.toolCalls} tool
                    {s.toolCalls === 1 ? "" : "s"}
                  </span>
                </div>
                {s.endedAt === null ? (
                  <span className="oc-mission__chip is-info">
                    <Activity size={10} /> live
                  </span>
                ) : s.error ? (
                  <span className="oc-mission__chip is-danger">
                    <AlertTriangle size={10} /> error
                  </span>
                ) : (
                  <span className="oc-mission__chip is-success">
                    <CheckCircle2 size={10} /> done
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: "info" | "success" | "danger" | "muted";
}) {
  return (
    <div className={`oc-mission__card is-${tint}`}>
      <span className="oc-mission__card-icon">{icon}</span>
      <div className="oc-mission__card-body">
        <span className="oc-mission__card-label">{label}</span>
        <span className="oc-mission__card-value" title={value}>
          {value}
        </span>
      </div>
    </div>
  );
}
