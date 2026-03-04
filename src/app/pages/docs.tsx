import React, { useState } from "react";
import { Link } from "react-router";
import {
  Layers,
  Palette,
  Zap,
  MousePointer2,
  PenTool,
  Lightbulb,
  FileCode,
  Command,
  GitBranch,
  Copy,
  Check,
  Terminal,
  ArrowRight,
  Package,
  Cpu,
  Eye,
  Send,
  Sparkles,
  ChevronRight,
  ExternalLink,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-1.5 rounded-md bg-[#1a1a1a] border border-[#333333] hover:border-[#555555] text-muted-foreground hover:text-foreground transition-all"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#50e3c2]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="relative group">
      <pre
        className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 overflow-x-auto"
        style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "13px", lineHeight: "1.7" }}
      >
        <code className="text-[#ededed]">{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="p-5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl hover:border-[#333333] transition-all group">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <h3 className="text-foreground mb-2" style={{ fontSize: "15px" }}>{title}</h3>
      <p className="text-muted-foreground" style={{ fontSize: "13px", lineHeight: "1.6" }}>
        {description}
      </p>
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#111111] last:border-0">
      <span className="text-muted-foreground" style={{ fontSize: "13px" }}>{action}</span>
      <kbd
        className="bg-[#111111] border border-[#222222] text-foreground px-2 py-0.5 rounded-md"
        style={{ fontSize: "11px", fontFamily: "'Geist Mono', monospace" }}
      >
        {keys}
      </kbd>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Navigation ──────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-background">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-foreground tracking-tight" style={{ fontSize: "16px" }}>designdead</span>
            <span className="text-[10px] text-muted-foreground bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#222222]">v0.1.0</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Withso/design-dead"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              style={{ fontSize: "13px" }}
            >
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
            <Link
              to="/workspace"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
              style={{ fontSize: "13px" }}
            >
              Try Workspace
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── NOT PUBLISHED BANNER ──────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pt-6">
        <div className="p-4 bg-[#f5a623]/5 border border-[#f5a623]/20 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#f5a623] shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground mb-1" style={{ fontSize: "14px" }}>
              Not published to npm yet
            </p>
            <p className="text-muted-foreground" style={{ fontSize: "13px", lineHeight: "1.6" }}>
              Running <code className="text-[#f5a623]" style={{ fontFamily: "'Geist Mono', monospace" }}>npm install designdead</code> will fail with a 404 error because the package hasn't been published yet.
              To use DesignDead right now, install directly from GitHub or build from source. See the{" "}
              <a href="#install-from-github" className="text-[#0070f3] hover:underline">Install from GitHub</a> or{" "}
              <a href="#cursor-setup" className="text-[#0070f3] hover:underline">Build from Source</a> sections below.
            </p>
          </div>
        </div>
      </section>

      {/* ── Hero ────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pt-12 pb-16">
        <div className="max-w-[700px]">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[11px] text-[#50e3c2] bg-[#50e3c2]/10 px-2.5 py-1 rounded-full border border-[#50e3c2]/20">
              Open Source
            </span>
            <span className="text-[11px] text-muted-foreground bg-[#1a1a1a] px-2.5 py-1 rounded-full border border-[#222222]">
              MIT License
            </span>
            <span className="text-[11px] text-[#f5a623] bg-[#f5a623]/10 px-2.5 py-1 rounded-full border border-[#f5a623]/20">
              Pre-release
            </span>
          </div>
          <h1 className="text-foreground mb-5" style={{ fontSize: "48px", lineHeight: "1.15", letterSpacing: "-0.03em" }}>
            Visual feedback engine for{" "}
            <span className="bg-gradient-to-r from-[#0070f3] via-[#7928ca] to-[#ff0080] bg-clip-text text-transparent">
              AI-powered
            </span>{" "}
            development
          </h1>
          <p className="text-muted-foreground mb-8" style={{ fontSize: "17px", lineHeight: "1.7" }}>
            Inspect elements, edit styles live, and send structured instructions to your AI coding agent — all from a floating overlay inside your app. No server, no proxy, no iframe.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-3 relative">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <code className="text-muted-foreground line-through" style={{ fontSize: "14px", fontFamily: "'Geist Mono', monospace" }}>
                npm install designdead -D
              </code>
              <span className="text-[10px] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.5 rounded border border-[#f5a623]/20 ml-1">soon</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Install from GitHub (current method) ───── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20" id="install-from-github">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#50e3c2]/10 border border-[#50e3c2]/20 flex items-center justify-center">
            <GitBranch className="w-3.5 h-3.5 text-[#50e3c2]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>Install from GitHub (Current Method)</h2>
        </div>

        <div className="p-4 bg-[#50e3c2]/5 border border-[#50e3c2]/20 rounded-xl mb-6">
          <p className="text-muted-foreground" style={{ fontSize: "13px", lineHeight: "1.6" }}>
            <strong className="text-[#50e3c2]">Use this method until the npm package is published.</strong> Install directly from the GitHub repository.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#50e3c2]/10 border border-[#50e3c2]/20 text-[#50e3c2] flex items-center justify-center" style={{ fontSize: "12px" }}>1</span>
              <span className="text-foreground" style={{ fontSize: "14px" }}>Install from GitHub</span>
            </div>
            <CodeBlock code={`# npm\nnpm install github:Withso/design-dead --save-dev\n\n# pnpm\npnpm add github:Withso/design-dead -D\n\n# yarn\nyarn add Withso/design-dead --dev`} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#50e3c2]/10 border border-[#50e3c2]/20 text-[#50e3c2] flex items-center justify-center" style={{ fontSize: "12px" }}>2</span>
              <span className="text-foreground" style={{ fontSize: "14px" }}>Add to your app</span>
            </div>
            <CodeBlock
              lang="tsx"
              code={`import { DesignDead } from "designdead";\n\nfunction App() {\n  return (\n    <>\n      <YourApp />\n      <DesignDead />\n    </>\n  );\n}`}
            />
          </div>
        </div>

        <div className="mt-6 p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
          <p className="text-muted-foreground" style={{ fontSize: "13px", lineHeight: "1.6" }}>
            <strong className="text-foreground">Note:</strong> When installing from GitHub, the repo needs a <code className="text-[#50e3c2]" style={{ fontFamily: "'Geist Mono', monospace" }}>postinstall</code> build step or pre-built <code className="text-[#50e3c2]" style={{ fontFamily: "'Geist Mono', monospace" }}>dist/</code> folder committed. Until then, use the{" "}
            <a href="#cursor-setup" className="text-[#0070f3] hover:underline">Build from Source</a> method below.
          </p>
        </div>
      </section>

      {/* ── Quick Start (after npm publish) ──────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#0070f3]/10 border border-[#0070f3]/20 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-[#0070f3]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>Quick Start</h2>
          <span className="text-[10px] text-muted-foreground bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#222222] ml-2">after npm publish</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Install */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#0070f3]/10 border border-[#0070f3]/20 text-[#0070f3] flex items-center justify-center" style={{ fontSize: "12px" }}>1</span>
              <span className="text-foreground" style={{ fontSize: "14px" }}>Install the package</span>
            </div>
            <CodeBlock code={`npm install designdead --save-dev\n# or\npnpm add designdead -D\n# or\nyarn add designdead -D`} />
          </div>

          {/* Step 2: Add to app */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#0070f3]/10 border border-[#0070f3]/20 text-[#0070f3] flex items-center justify-center" style={{ fontSize: "12px" }}>2</span>
              <span className="text-foreground" style={{ fontSize: "14px" }}>Add to your app</span>
            </div>
            <CodeBlock
              lang="tsx"
              code={`import { DesignDead } from "designdead";\n\nfunction App() {\n  return (\n    <>\n      <YourApp />\n      <DesignDead />\n    </>\n  );\n}`}
            />
          </div>
        </div>

        <div className="mt-6 p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
          <p className="text-muted-foreground" style={{ fontSize: "13px", lineHeight: "1.6" }}>
            <strong className="text-foreground">That's it.</strong> No config files, no server to run, no proxy to configure. DesignDead injects itself as a floating overlay, inspects your DOM directly, and scopes all its CSS so it never affects your app.
          </p>
        </div>
      </section>

      {/* ── Features ────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#7928ca]/10 border border-[#7928ca]/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#7928ca]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>Features</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={<MousePointer2 className="w-5 h-5" />}
            title="Click to Inspect"
            description="Click any element on the page to instantly view its computed styles, CSS selector, and DOM path."
            color="#0070f3"
          />
          <FeatureCard
            icon={<Palette className="w-5 h-5" />}
            title="Live Style Editing"
            description="Edit CSS properties directly in the style panel. Changes apply immediately to the live page."
            color="#ff0080"
          />
          <FeatureCard
            icon={<Layers className="w-5 h-5" />}
            title="Layer Tree"
            description="Browse the full DOM hierarchy as a collapsible tree. Search, toggle visibility, and lock elements."
            color="#50e3c2"
          />
          <FeatureCard
            icon={<Send className="w-5 h-5" />}
            title="Agent Output"
            description="Generate structured markdown output designed for AI coding agents like Claude Code and Cursor."
            color="#f5a623"
          />
          <FeatureCard
            icon={<PenTool className="w-5 h-5" />}
            title="Annotations"
            description="Draw rectangles, circles, arrows, text, and freehand directly on the page for visual feedback."
            color="#ff0080"
          />
          <FeatureCard
            icon={<GitBranch className="w-5 h-5" />}
            title="Version Snapshots"
            description="Save style change snapshots as versions. Track drafts, sent, and applied states."
            color="#7928ca"
          />
          <FeatureCard
            icon={<FileCode className="w-5 h-5" />}
            title="File Mapping"
            description="Heuristic component-to-file inference. See which source file likely renders each element."
            color="#0070f3"
          />
          <FeatureCard
            icon={<Lightbulb className="w-5 h-5" />}
            title="Brainstorm"
            description="Jot down design ideas linked to specific versions. Quick prompts for common tweaks."
            color="#f5a623"
          />
          <FeatureCard
            icon={<Command className="w-5 h-5" />}
            title="Command Palette"
            description="Press Ctrl+K for quick access to all panels, tools, and actions."
            color="#ededed"
          />
        </div>
      </section>

      {/* ── Props / API ─────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#f5a623]/10 border border-[#f5a623]/20 flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-[#f5a623]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>API Reference</h2>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "13px" }}>
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>Prop</th>
                  <th className="text-left py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>Type</th>
                  <th className="text-left py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>Default</th>
                  <th className="text-left py-3 px-4 text-muted-foreground" style={{ fontWeight: 500 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { prop: "position", type: "string", default: '"bottom-right"', desc: 'FAB button position. Options: "bottom-right", "bottom-left", "top-right", "top-left"' },
                  { prop: "defaultOpen", type: "boolean", default: "false", desc: "Start with the panel open" },
                  { prop: "theme", type: "string", default: '"dark"', desc: 'Color theme. Options: "dark", "light", "auto"' },
                  { prop: "shortcut", type: "string", default: '"d"', desc: "Key for Ctrl+Shift+{key} toggle" },
                  { prop: "devOnly", type: "boolean", default: "true", desc: "Hide in production builds (NODE_ENV)" },
                  { prop: "zIndex", type: "number", default: "2147483640", desc: "CSS z-index for the overlay" },
                  { prop: "onToggle", type: "(open: boolean) => void", default: "--", desc: "Callback when panel opens/closes" },
                ].map((row) => (
                  <tr key={row.prop} className="border-b border-[#111111] last:border-0 hover:bg-[#111111]/50 transition-colors">
                    <td className="py-2.5 px-4">
                      <code className="text-[#0070f3]" style={{ fontFamily: "'Geist Mono', monospace" }}>{row.prop}</code>
                    </td>
                    <td className="py-2.5 px-4">
                      <code className="text-[#f5a623]" style={{ fontFamily: "'Geist Mono', monospace" }}>{row.type}</code>
                    </td>
                    <td className="py-2.5 px-4">
                      <code className="text-muted-foreground" style={{ fontFamily: "'Geist Mono', monospace" }}>{row.default}</code>
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Keyboard Shortcuts ──────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#50e3c2]/10 border border-[#50e3c2]/20 flex items-center justify-center">
            <Command className="w-3.5 h-3.5 text-[#50e3c2]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>Keyboard Shortcuts</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-foreground mb-4" style={{ fontSize: "14px" }}>Global</h3>
            <ShortcutRow keys="Ctrl+Shift+D" action="Toggle DesignDead" />
            <ShortcutRow keys="I" action="Start / stop inspect mode" />
            <ShortcutRow keys="Ctrl+K" action="Command palette" />
            <ShortcutRow keys="Esc" action="Close overlay / cancel" />
          </div>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-foreground mb-4" style={{ fontSize: "14px" }}>Annotation Mode</h3>
            <ShortcutRow keys="V" action="Select tool" />
            <ShortcutRow keys="R" action="Rectangle tool" />
            <ShortcutRow keys="O" action="Circle tool" />
            <ShortcutRow keys="A" action="Arrow tool" />
            <ShortcutRow keys="T" action="Text tool" />
            <ShortcutRow keys="P" action="Freehand tool" />
          </div>
        </div>
      </section>

      {/* ── IDE Integration ─────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#ff6b35]/10 border border-[#ff6b35]/20 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-[#ff6b35]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>IDE Integration</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: "Claude Code", icon: "CC", color: "#ff6b35", cmd: "claude mcp add designdead", method: "MCP" },
            { name: "Cursor", icon: "Cu", color: "#0070f3", cmd: "npx designdead@latest init --cursor", method: "Extension" },
            { name: "Windsurf", icon: "Ws", color: "#50e3c2", cmd: "npx designdead@latest init --windsurf", method: "Extension" },
            { name: "VS Code", icon: "VS", color: "#007acc", cmd: "npx designdead@latest init --vscode", method: "Extension" },
            { name: "Antigravity", icon: "AG", color: "#7928ca", cmd: "npx designdead@latest init --antigravity", method: "CLI" },
          ].map((ide) => (
            <div key={ide.name} className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl hover:border-[#333333] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                  style={{ background: ide.color, fontSize: "12px", fontWeight: 600 }}
                >
                  {ide.icon}
                </div>
                <div>
                  <span className="text-foreground block" style={{ fontSize: "14px" }}>{ide.name}</span>
                  <span className="text-muted-foreground" style={{ fontSize: "11px" }}>via {ide.method}</span>
                </div>
              </div>
              <div className="relative">
                <code
                  className="block bg-[#111111] border border-[#1a1a1a] rounded-lg px-3 py-2 text-[#50e3c2] break-all"
                  style={{ fontSize: "11px", fontFamily: "'Geist Mono', monospace" }}
                >
                  {ide.cmd}
                </code>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture ────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#ededed]/10 border border-[#ededed]/20 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-[#ededed]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>Architecture</h2>
        </div>

        <CodeBlock
          code={`┌─────────────────────────────────────────────────┐
│  Your App (React / Next.js / Vite / Remix)      │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  <DesignDead />                            │  │
│  │                                            │  │
│  │  ┌─ Toolbar ─────────────────────────────┐ │  │
│  │  │ Layers │ Inspect │ Style │ IDE │ Ideas │ │  │
│  │  └───────────────────────────────────────┘ │  │
│  │  ┌───────┬─────────────┬────────┐         │  │
│  │  │ Layer │   Canvas    │ Style  │         │  │
│  │  │ Panel │  (overlay)  │ Panel  │         │  │
│  │  └───────┴─────────────┴────────┘         │  │
│  │                                            │  │
│  │  DOM Inspector walks document.body         │  │
│  │  (skips [data-designdead] elements)        │  │
│  │  Scoped CSS injection (no leaks)           │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

No server · No proxy · No iframe · No Figma dependency
Direct DOM inspection · Works with any CSS framework`}
        />
      </section>

      {/* ── Cursor IDE Setup ────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20" id="cursor-setup">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#0070f3]/10 border border-[#0070f3]/20 flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-[#0070f3]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>Building from Source (Cursor IDE)</h2>
        </div>

        <div className="space-y-6">
          <div className="p-5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
            <h3 className="text-foreground mb-4" style={{ fontSize: "15px" }}>1. Clone the repository</h3>
            <CodeBlock code={`git clone https://github.com/Withso/design-dead.git\ncd design-dead`} />
          </div>

          <div className="p-5 bg-[#f5a623]/5 border border-[#f5a623]/20 rounded-xl">
            <h3 className="text-foreground mb-3" style={{ fontSize: "15px" }}>2. Swap to the npm package.json</h3>
            <p className="text-muted-foreground mb-4" style={{ fontSize: "12px", lineHeight: "1.6" }}>
              The repo has two package.json files: the Figma Make dev one (used by Vite) and <code className="text-[#f5a623]" style={{ fontFamily: "'Geist Mono', monospace" }}>package.publish.json</code> (the real npm config). Swap them before building:
            </p>
            <CodeBlock code={`# Back up the Figma Make config\nmv package.json package.figmamake.json\n\n# Use the npm publish config\ncp package.publish.json package.json`} />
          </div>

          <div className="p-5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
            <h3 className="text-foreground mb-4" style={{ fontSize: "15px" }}>3. Install all dependencies</h3>
            <CodeBlock
              code={`# Install with pnpm (recommended)\npnpm install\n\n# Or with npm\nnpm install\n\n# Or with yarn\nyarn install`}
            />
            <p className="text-muted-foreground mt-4" style={{ fontSize: "12px", lineHeight: "1.6" }}>
              This installs all runtime and dev dependencies including React, Radix UI, Lucide, tsup, and TypeScript.
            </p>
          </div>

          <div className="p-5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
            <h3 className="text-foreground mb-4" style={{ fontSize: "15px" }}>4. Build the package</h3>
            <CodeBlock
              code={`# Build once\npnpm build\n\n# Watch mode (rebuild on changes)\npnpm watch`}
            />
            <p className="text-muted-foreground mt-4" style={{ fontSize: "12px", lineHeight: "1.6" }}>
              tsup compiles the source to CJS + ESM with TypeScript declarations. Output goes to <code className="text-[#50e3c2]" style={{ fontFamily: "'Geist Mono', monospace" }}>dist/</code>.
            </p>
          </div>

          <div className="p-5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
            <h3 className="text-foreground mb-4" style={{ fontSize: "15px" }}>5. Test locally before publishing</h3>
            <CodeBlock
              code={`# Pack the package (creates a .tgz file)\nnpm pack\n\n# In another project, install from the .tgz\nnpm install ../design-dead/designdead-0.1.0.tgz\n\n# Or use npm link for live development\ncd design-dead && npm link\ncd ../your-project && npm link designdead`}
            />
          </div>

          <div className="p-5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
            <h3 className="text-foreground mb-4" style={{ fontSize: "15px" }}>6. Publish to npm</h3>
            <CodeBlock
              code={`# Login to npm (first time only)\nnpm login\n\n# Publish\nnpm publish\n\n# Or publish with a tag\nnpm publish --tag beta`}
            />
          </div>
        </div>
      </section>

      {/* ── Dependency Table ────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#ff0080]/10 border border-[#ff0080]/20 flex items-center justify-center">
            <Package className="w-3.5 h-3.5 text-[#ff0080]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>Dependencies</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-foreground mb-4" style={{ fontSize: "14px" }}>Runtime Dependencies</h3>
            {[
              { name: "@radix-ui/react-scroll-area", ver: "^1.2.0" },
              { name: "lucide-react", ver: "^0.400.0" },
              { name: "clsx", ver: "^2.1.0" },
              { name: "tailwind-merge", ver: "^3.0.0" },
            ].map((dep) => (
              <div key={dep.name} className="flex items-center justify-between py-1.5 border-b border-[#111111] last:border-0">
                <code className="text-foreground" style={{ fontSize: "12px", fontFamily: "'Geist Mono', monospace" }}>{dep.name}</code>
                <code className="text-muted-foreground" style={{ fontSize: "11px", fontFamily: "'Geist Mono', monospace" }}>{dep.ver}</code>
              </div>
            ))}
          </div>

          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-foreground mb-4" style={{ fontSize: "14px" }}>Peer Dependencies</h3>
            {[
              { name: "react", ver: ">=18.0.0" },
              { name: "react-dom", ver: ">=18.0.0" },
            ].map((dep) => (
              <div key={dep.name} className="flex items-center justify-between py-1.5 border-b border-[#111111] last:border-0">
                <code className="text-foreground" style={{ fontSize: "12px", fontFamily: "'Geist Mono', monospace" }}>{dep.name}</code>
                <code className="text-muted-foreground" style={{ fontSize: "11px", fontFamily: "'Geist Mono', monospace" }}>{dep.ver}</code>
              </div>
            ))}
            <p className="text-muted-foreground mt-3" style={{ fontSize: "11px", lineHeight: "1.5" }}>
              Your project must have React 18+ installed. DesignDead doesn't bundle React — it uses yours.
            </p>
          </div>
        </div>
      </section>

      {/* ── Compatibility ───────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[#50e3c2]/10 border border-[#50e3c2]/20 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-[#50e3c2]" />
          </div>
          <h2 className="text-foreground" style={{ fontSize: "22px" }}>Works With</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {["React", "Next.js", "Vite", "Remix", "CRA", "Astro"].map((fw) => (
            <div key={fw} className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl text-center hover:border-[#333333] transition-colors">
              <span className="text-foreground" style={{ fontSize: "14px" }}>{fw}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          {["Tailwind CSS", "CSS Modules", "styled-components", "Emotion", "Vanilla CSS", "Any CSS"].map((css) => (
            <div key={css} className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl text-center hover:border-[#333333] transition-colors">
              <span className="text-muted-foreground" style={{ fontSize: "13px" }}>{css}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="bg-gradient-to-br from-[#0070f3]/10 via-[#7928ca]/10 to-[#ff0080]/10 border border-[#222222] rounded-2xl p-12 text-center">
          <h2 className="text-foreground mb-4" style={{ fontSize: "28px", letterSpacing: "-0.02em" }}>
            Ready to try it?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-[480px] mx-auto" style={{ fontSize: "15px", lineHeight: "1.6" }}>
            Open the workspace page to test the full DesignDead UI with live DOM inspection, style editing, annotations, and agent output.
          </p>
          <Link
            to="/workspace"
            className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-xl hover:opacity-90 transition-opacity"
            style={{ fontSize: "15px" }}
          >
            Open Workspace
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-foreground flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-background">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-muted-foreground" style={{ fontSize: "13px" }}>designdead</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Withso/design-dead"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontSize: "12px" }}
            >
              GitHub
            </a>
            <span className="text-[#333333]" style={{ fontSize: "12px" }}>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}