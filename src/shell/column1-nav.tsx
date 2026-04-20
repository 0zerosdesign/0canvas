// ──────────────────────────────────────────────────────────
// Column 1 — Navigation (Phase 1A scaffold)
// ──────────────────────────────────────────────────────────
//
// This is a placeholder that establishes visual real estate for
// the real Column 1 content being built in Phase 1B:
//   - Logo + New Chat + Skills
//   - CHATS tree (projects, chat threads)
//   - LOCALHOST auto-discovered services
//   - TERMINALS count badge
//   - Profile menu (How to / Settings / Logout)
//   - Collapse toggle
//
// For 1A-1 it renders a minimal stub so the three-column layout
// has correct proportions and the app looks like a Mac IDE shell
// rather than today's single-surface overlay.
// ──────────────────────────────────────────────────────────

import React from "react";
import { MessageSquarePlus, Sparkles, PanelLeftClose } from "lucide-react";

export function Column1Nav() {
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
        <p className="oc-column-1__placeholder">Project navigation lands in Phase 1B.</p>
      </section>

      <section className="oc-column-1__section">
        <h3 className="oc-column-1__section-title">LOCALHOST</h3>
        <p className="oc-column-1__placeholder">Service discovery lands in Phase 1B.</p>
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
