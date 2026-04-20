// ──────────────────────────────────────────────────────────
// Column 1 — Navigation
// ──────────────────────────────────────────────────────────
//
// Phase 1B-a: LOCALHOST is live.
// - New Chat + Skills are placeholders (Phase 1B-d/1B-e).
// - CHATS tree is placeholder (1B-e).
// - LOCALHOST polls `discover_localhost_services` every 5s.
//   Dev servers are clickable → sets project.devServerUrl so the
//   Column 3 source-node previews the user's app.
// - Profile row opens the Phase 1B-b menu (next sub-step).
// ──────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  MessageSquarePlus,
  Sparkles,
  PanelLeftClose,
  Circle,
  Database,
  Server,
  Globe,
} from "lucide-react";
import { useWorkspace } from "../0canvas/store/store";
import {
  discoverLocalhostServices,
  type LocalhostService,
} from "../native/tauri-events";

const POLL_INTERVAL_MS = 5000;

/** URL that represents 0canvas itself — never a valid preview target. */
function selfOrigin(): string {
  if (typeof window === "undefined") return "";
  // In dev mode this is http://localhost:5173 (Vite serving our own app).
  // In the release .app it's http://tauri.localhost or similar, and port
  // 5173 would be somebody else's dev server — no special handling needed.
  return window.location.origin.replace(/\/$/, "");
}

function useLocalhostServices() {
  const [services, setServices] = useState<LocalhostService[]>([]);

  useEffect(() => {
    let cancelled = false;
    const self = selfOrigin();

    const poll = async () => {
      try {
        const raw = await discoverLocalhostServices();
        // Mark our own dev-server URL as "self" so it renders
        // disabled — clicking it would nest 0canvas inside 0canvas.
        const marked = raw.map((s) =>
          s.url === self && s.kind === "dev-server"
            ? { ...s, kind: "engine" as const, label: "0canvas (self)" }
            : s,
        );
        if (!cancelled) setServices(marked);
      } catch {
        // Silent — probe failures are expected on plain-browser dev.
      }
    };

    poll();
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return services;
}

function ServiceIcon({ kind }: { kind: LocalhostService["kind"] }) {
  const common = { size: 12 };
  switch (kind) {
    case "dev-server":
      return <Globe {...common} />;
    case "database":
      return <Database {...common} />;
    case "engine":
      return <Server {...common} />;
    default:
      return <Circle {...common} />;
  }
}

function ServiceRow({
  service,
  isActive,
  onSelect,
}: {
  service: LocalhostService;
  isActive: boolean;
  onSelect: () => void;
}) {
  const clickable = service.kind === "dev-server";
  return (
    <button
      className={`oc-column-1__service ${isActive ? "is-active" : ""} ${
        clickable ? "" : "is-disabled"
      }`}
      onClick={clickable ? onSelect : undefined}
      title={clickable ? `Use ${service.url} as preview` : service.label}
      disabled={!clickable}
    >
      <span className="oc-column-1__service-icon">
        <ServiceIcon kind={service.kind} />
      </span>
      <span className="oc-column-1__service-port">:{service.port}</span>
      <span className="oc-column-1__service-label">{service.label}</span>
    </button>
  );
}

export function Column1Nav() {
  const { state, dispatch } = useWorkspace();
  const services = useLocalhostServices();
  const currentUrl = state.project?.devServerUrl ?? "";

  const handleSelect = (service: LocalhostService) => {
    if (!state.project) return;
    dispatch({
      type: "CONNECT_PROJECT",
      project: { ...state.project, devServerUrl: service.url },
    });
  };

  return (
    <aside className="oc-column-1" aria-label="Navigation">
      <div className="oc-column-1__header">
        <div className="oc-column-1__brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="oc-column-1__brand-name">0canvas</span>
        </div>
        <button className="oc-column-1__collapse" title="Collapse" disabled>
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="oc-column-1__actions">
        <button className="oc-column-1__action" disabled>
          <MessageSquarePlus size={16} />
          <span>New Chat</span>
        </button>
        <button className="oc-column-1__action" disabled>
          <Sparkles size={16} />
          <span>Skills</span>
        </button>
      </div>

      <section className="oc-column-1__section">
        <h3 className="oc-column-1__section-title">CHATS</h3>
        <p className="oc-column-1__placeholder">Chat threads land in Phase 1B-e.</p>
      </section>

      <section className="oc-column-1__section">
        <h3 className="oc-column-1__section-title">
          LOCALHOST
          <span className="oc-column-1__section-badge">{services.length}</span>
        </h3>
        {services.length === 0 ? (
          <p className="oc-column-1__placeholder">
            No dev servers detected. Start your app's dev server (e.g. <code>pnpm dev</code>)
            and this list will update within a few seconds.
          </p>
        ) : (
          <div className="oc-column-1__services">
            {services.map((s) => (
              <ServiceRow
                key={s.port}
                service={s}
                isActive={s.url === currentUrl}
                onSelect={() => handleSelect(s)}
              />
            ))}
          </div>
        )}
      </section>

      <div className="oc-column-1__spacer" />

      <footer className="oc-column-1__footer">
        <button className="oc-column-1__profile" disabled>
          <div className="oc-column-1__avatar">0</div>
          <span>Profile</span>
        </button>
      </footer>
    </aside>
  );
}
