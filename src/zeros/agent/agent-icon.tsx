// ──────────────────────────────────────────────────────────
// AgentIcon — branded agent logo renderer
// ──────────────────────────────────────────────────────────
//
// Fetches the CDN-served SVG, rewrites its `currentColor` to
// the agent's brand color (from agent-brands.ts), and inlines
// the result so the logo renders in its real brand color.
// Caches per-icon-url so we only pay the fetch once per session.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { brandColor } from "./agent-brands";

const svgCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function recolor(raw: string, color: string | null): string {
  if (!color) return raw;
  // Replace any `fill="currentColor"` / `stroke="currentColor"` and
  // the CSS style variant. Keeps the original geometry intact.
  return raw
    .replace(/fill="currentColor"/gi, `fill="${color}"`)
    .replace(/stroke="currentColor"/gi, `stroke="${color}"`)
    .replace(/fill:\s*currentColor/gi, `fill:${color}`)
    .replace(/stroke:\s*currentColor/gi, `stroke:${color}`);
}

async function fetchSvg(url: string): Promise<string> {
  const existing = inFlight.get(url);
  if (existing) return existing;
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    svgCache.set(url, text);
    return text;
  })();
  inFlight.set(url, p);
  try {
    return await p;
  } finally {
    inFlight.delete(url);
  }
}

export interface AgentIconProps {
  agentId: string | null | undefined;
  iconUrl: string | null | undefined;
  size?: number;
  className?: string;
  /** Fallback color when the agent has no brand entry. Defaults to
   *  the theme's muted text color. */
  fallbackColor?: string;
}

export function AgentIcon({
  agentId,
  iconUrl,
  size = 16,
  className,
  fallbackColor,
}: AgentIconProps) {
  const color = brandColor(agentId) ?? fallbackColor ?? null;
  const [svg, setSvg] = useState<string | null>(() =>
    iconUrl ? svgCache.get(iconUrl) ?? null : null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!iconUrl) {
      setSvg(null);
      setFailed(false);
      return;
    }
    const cached = svgCache.get(iconUrl);
    if (cached) {
      setSvg(cached);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setFailed(false);
    fetchSvg(iconUrl)
      .then((raw) => {
        if (cancelled) return;
        setSvg(raw);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [iconUrl]);

  const style: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (failed || !iconUrl) {
    return (
      <span className={className} style={style} aria-hidden="true">
        <Bot size={Math.round(size * 0.75)} />
      </span>
    );
  }

  if (!svg) {
    return <span className={className} style={style} aria-hidden="true" />;
  }

  const colored = recolor(svg, color);
  return (
    <span
      className={className}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: colored }}
    />
  );
}
