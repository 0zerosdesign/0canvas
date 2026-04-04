import React, { useState } from "react";
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
      className="absolute top-3 right-3 p-1.5 rounded-md bg-[var(--color--surface--1)] border border-[var(--color--border--on-surface-1)] hover:border-[var(--color--border--on-surface-2)] text-muted-foreground hover:text-foreground transition-all"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[var(--color--status--success)]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="relative group">
      <pre
        className="bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl p-4 overflow-x-auto font-mono text-[13px] leading-[1.7]"
      >
        <code className="text-[var(--color--text--on-surface)]">{code}</code>
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
    <div className="p-5 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl hover:border-[var(--color--border--on-surface-1)] transition-all group">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <h3 className="text-foreground mb-2 text-[15px]">{title}</h3>
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color--border--on-surface-0)] last:border-0">
      <span className="text-muted-foreground text-[13px]">{action}</span>
      <kbd
        className="bg-[var(--color--surface--1)] border border-[var(--color--border--on-surface-0)] text-foreground px-2 py-0.5 rounded-md text-[11px] font-mono"
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
            <div className="w-7 h-7 rounded-lg bg-[var(--color--base--primary)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-foreground tracking-tight text-[16px]">0canvas</span>
            <span className="text-[10px] text-muted-foreground bg-[var(--color--surface--1)] px-2 py-0.5 rounded-full border border-[var(--color--border--on-surface-0)]">v0.1.0</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Withso/0canvas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-[13px]"
            >
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => { const e = new KeyboardEvent("keydown", { key: "d", ctrlKey: true, shiftKey: true, bubbles: true }); window.dispatchEvent(e); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color--base--primary)] text-white rounded-lg hover:opacity-90 transition-opacity text-[13px]"
            >
              Open 0canvas
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── NOT PUBLISHED BANNER ──────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pt-6">
        <div className="p-4 bg-[var(--color--status--warning)]/5 border border-[var(--color--status--warning)]/20 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--color--status--warning)] shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground mb-1 text-sm">
              Not published to npm yet
            </p>
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              Running <code className="text-[var(--color--status--warning)] font-mono">npm install @zerosdesign/0canvas</code> will fail with a 404 error because the package hasn't been published yet.
              To use ZeroCanvas right now, install directly from GitHub or build from source. See the{" "}
              <a href="#install-from-github" className="text-[var(--color--text--primary)] hover:underline">Install from GitHub</a> or{" "}
              <a href="#cursor-setup" className="text-[var(--color--text--primary)] hover:underline">Build from Source</a> sections below.
            </p>
          </div>
        </div>
      </section>

      {/* ── Hero ────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pt-12 pb-16">
        <div className="max-w-[700px]">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[11px] text-[var(--color--status--success)] bg-[var(--color--status--success)]/10 px-2.5 py-1 rounded-full border border-[var(--color--status--success)]/20">
              Open Source
            </span>
            <span className="text-[11px] text-muted-foreground bg-[var(--color--surface--1)] px-2.5 py-1 rounded-full border border-[var(--color--border--on-surface-0)]">
              MIT License
            </span>
            <span className="text-[11px] text-[var(--color--status--warning)] bg-[var(--color--status--warning)]/10 px-2.5 py-1 rounded-full border border-[var(--color--status--warning)]/20">
              Pre-release
            </span>
          </div>
          <h1 className="text-foreground mb-5 text-[48px] leading-[1.15] tracking-tight">
            Visual feedback engine for{" "}
            <span className="bg-gradient-to-r from-[var(--color--base--primary)] via-[var(--blue-700)] to-[var(--blue-500)] bg-clip-text text-transparent">
              AI-powered
            </span>{" "}
            development
          </h1>
          <p className="text-muted-foreground mb-8 text-[17px] leading-[1.7]">
            Inspect elements, edit styles live, and send structured instructions to your AI coding agent — all from a floating overlay inside your app. No server, no proxy, no iframe.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl px-4 py-3 relative">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <code className="text-muted-foreground line-through text-sm font-mono">
                npm install @zerosdesign/0canvas -D
              </code>
              <span className="text-[10px] text-[var(--color--status--warning)] bg-[var(--color--status--warning)]/10 px-1.5 py-0.5 rounded border border-[var(--color--status--warning)]/20 ml-1">soon</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Install from GitHub (current method) ───── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20" id="install-from-github">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 flex items-center justify-center">
            <GitBranch className="w-3.5 h-3.5 text-[var(--color--text--primary)]" />
          </div>
          <h2 className="text-foreground text-[22px]">Install from GitHub (Current Method)</h2>
        </div>

        <div className="p-4 bg-[var(--color--base--primary)]/5 border border-[var(--color--base--primary)]/20 rounded-xl mb-6">
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            <strong className="text-[var(--color--text--primary-light)]">Use this method until the npm package is published.</strong> Install directly from the GitHub repository.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 text-[var(--color--text--primary)] flex items-center justify-center text-xs">1</span>
              <span className="text-foreground text-sm">Install from GitHub</span>
            </div>
            <CodeBlock code={`# npm\nnpm install github:Withso/0canvas --save-dev\n\n# pnpm\npnpm add github:Withso/0canvas -D\n\n# yarn\nyarn add Withso/0canvas --dev`} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 text-[var(--color--text--primary)] flex items-center justify-center text-xs">2</span>
              <span className="text-foreground text-sm">Add to your app</span>
            </div>
            <CodeBlock
              lang="tsx"
              code={`import { ZeroCanvas } from "@zerosdesign/0canvas";\n\nfunction App() {\n  return (\n    <>\n      <YourApp />\n      <ZeroCanvas />\n    </>\n  );\n}`}
            />
          </div>
        </div>

        <div className="mt-6 p-4 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl">
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            <strong className="text-foreground">Note:</strong> When installing from GitHub, the repo needs a <code className="text-[var(--color--text--primary-light)] font-mono">postinstall</code> build step or pre-built <code className="text-[var(--color--text--primary-light)] font-mono">dist/</code> folder committed. Until then, use the{" "}
            <a href="#cursor-setup" className="text-[var(--color--text--primary)] hover:underline">Build from Source</a> method below.
          </p>
        </div>
      </section>

      {/* ── Quick Start (after npm publish) ──────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-[var(--color--text--primary)]" />
          </div>
          <h2 className="text-foreground text-[22px]">Quick Start</h2>
          <span className="text-[10px] text-muted-foreground bg-[var(--color--surface--1)] px-2 py-0.5 rounded-full border border-[var(--color--border--on-surface-0)] ml-2">after npm publish</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Install */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 text-[var(--color--text--primary)] flex items-center justify-center text-xs">1</span>
              <span className="text-foreground text-sm">Install the package</span>
            </div>
            <CodeBlock code={`npm install @zerosdesign/0canvas --save-dev\n# or\npnpm add @zerosdesign/0canvas -D\n# or\nyarn add @zerosdesign/0canvas -D`} />
          </div>

          {/* Step 2: Add to app */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 text-[var(--color--text--primary)] flex items-center justify-center text-xs">2</span>
              <span className="text-foreground text-sm">Add to your app</span>
            </div>
            <CodeBlock
              lang="tsx"
              code={`import { ZeroCanvas } from "@zerosdesign/0canvas";\n\nfunction App() {\n  return (\n    <>\n      <YourApp />\n      <ZeroCanvas />\n    </>\n  );\n}`}
            />
          </div>
        </div>

        <div className="mt-6 p-4 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl">
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            <strong className="text-foreground">That's it.</strong> No config files, no server to run, no proxy to configure. ZeroCanvas injects itself as a floating overlay, inspects your DOM directly, and scopes all its CSS so it never affects your app.
          </p>
        </div>
      </section>

      {/* ── Features ────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[var(--blue-700)]/10 border border-[var(--blue-700)]/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[var(--blue-700)]" />
          </div>
          <h2 className="text-foreground text-[22px]">Features</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={<MousePointer2 className="w-5 h-5" />}
            title="Click to Inspect"
            description="Click any element on the page to instantly view its computed styles, CSS selector, and DOM path."
            color="#2563EB"
          />
          <FeatureCard
            icon={<Palette className="w-5 h-5" />}
            title="Live Style Editing"
            description="Edit CSS properties directly in the style panel. Changes apply immediately to the live page."
            color="#3B82F6"
          />
          <FeatureCard
            icon={<Layers className="w-5 h-5" />}
            title="Layer Tree"
            description="Browse the full DOM hierarchy as a collapsible tree. Search, toggle visibility, and lock elements."
            color="#1D4ED8"
          />
          <FeatureCard
            icon={<Send className="w-5 h-5" />}
            title="Agent Output"
            description="Generate structured markdown output designed for AI coding agents like Claude Code and Cursor."
            color="#60A5FA"
          />
          <FeatureCard
            icon={<PenTool className="w-5 h-5" />}
            title="Annotations"
            description="Draw rectangles, circles, arrows, text, and freehand directly on the page for visual feedback."
            color="#3B82F6"
          />
          <FeatureCard
            icon={<GitBranch className="w-5 h-5" />}
            title="Version Snapshots"
            description="Save style change snapshots as versions. Track drafts, sent, and applied states."
            color="#1D4ED8"
          />
          <FeatureCard
            icon={<FileCode className="w-5 h-5" />}
            title="File Mapping"
            description="Heuristic component-to-file inference. See which source file likely renders each element."
            color="#2563EB"
          />
          <FeatureCard
            icon={<Lightbulb className="w-5 h-5" />}
            title="Brainstorm"
            description="Jot down design ideas linked to specific versions. Quick prompts for common tweaks."
            color="#1E40AF"
          />
          <FeatureCard
            icon={<Command className="w-5 h-5" />}
            title="Command Palette"
            description="Press Ctrl+K for quick access to all panels, tools, and actions."
            color="#93C5FD"
          />
        </div>
      </section>

      {/* ── Props / API ─────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-[var(--color--text--primary)]" />
          </div>
          <h2 className="text-foreground text-[22px]">API Reference</h2>
        </div>

        <div className="bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color--border--on-surface-0)]">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Prop</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Default</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Description</th>
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
                  <tr key={row.prop} className="border-b border-[var(--color--border--on-surface-0)] last:border-0 hover:bg-[var(--color--surface--1)]/50 transition-colors">
                    <td className="py-2.5 px-4">
                      <code className="text-[var(--color--text--primary)] font-mono">{row.prop}</code>
                    </td>
                    <td className="py-2.5 px-4">
                      <code className="text-[var(--color--status--warning)] font-mono">{row.type}</code>
                    </td>
                    <td className="py-2.5 px-4">
                      <code className="text-muted-foreground font-mono">{row.default}</code>
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
          <div className="w-6 h-6 rounded-md bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 flex items-center justify-center">
            <Command className="w-3.5 h-3.5 text-[var(--color--text--primary)]" />
          </div>
          <h2 className="text-foreground text-[22px]">Keyboard Shortcuts</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl p-5">
            <h3 className="text-foreground mb-4 text-sm">Global</h3>
            <ShortcutRow keys="Ctrl+Shift+D" action="Toggle ZeroCanvas" />
            <ShortcutRow keys="I" action="Start / stop inspect mode" />
            <ShortcutRow keys="Ctrl+K" action="Command palette" />
            <ShortcutRow keys="Esc" action="Close overlay / cancel" />
          </div>
          <div className="bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl p-5">
            <h3 className="text-foreground mb-4 text-sm">Annotation Mode</h3>
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
          <div className="w-6 h-6 rounded-md bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-[var(--color--text--primary)]" />
          </div>
          <h2 className="text-foreground text-[22px]">IDE Integration</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: "Claude Code", icon: "CC", color: "#2563EB", cmd: "claude mcp add 0canvas", method: "MCP" },
            { name: "Cursor", icon: "Cu", color: "#3B82F6", cmd: "npx 0canvas@latest init --cursor", method: "Extension" },
            { name: "Windsurf", icon: "Ws", color: "#1D4ED8", cmd: "npx 0canvas@latest init --windsurf", method: "Extension" },
            { name: "VS Code", icon: "VS", color: "#60A5FA", cmd: "npx 0canvas@latest init --vscode", method: "Extension" },
            { name: "Antigravity", icon: "AG", color: "#1E40AF", cmd: "npx 0canvas@latest init --antigravity", method: "CLI" },
          ].map((ide) => (
            <div key={ide.name} className="p-4 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl hover:border-[var(--color--border--on-surface-1)] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-semibold"
                  style={{ background: ide.color }}
                >
                  {ide.icon}
                </div>
                <div>
                  <span className="text-foreground block text-sm">{ide.name}</span>
                  <span className="text-muted-foreground text-[11px]">via {ide.method}</span>
                </div>
              </div>
              <div className="relative">
                <code
                  className="block bg-[var(--color--surface--1)] border border-[var(--color--border--on-surface-0)] rounded-lg px-3 py-2 text-[var(--color--text--primary-light)] break-all text-[11px] font-mono"
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
          <div className="w-6 h-6 rounded-md bg-[var(--color--text--on-surface)]/10 border border-[var(--color--text--on-surface)]/20 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-[var(--color--text--on-surface)]" />
          </div>
          <h2 className="text-foreground text-[22px]">Architecture</h2>
        </div>

        <CodeBlock
          code={`┌─────────────────────────────────────────────────┐
│  Your App (React / Next.js / Vite / Remix)      │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  <ZeroCanvas />                            │  │
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
│  │  (skips [data-0canvas] elements)        │  │
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
          <div className="w-6 h-6 rounded-md bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-[var(--color--text--primary)]" />
          </div>
          <h2 className="text-foreground text-[22px]">Building from Source (Cursor IDE)</h2>
        </div>

        <div className="space-y-6">
          <div className="p-5 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl">
            <h3 className="text-foreground mb-4 text-[15px]">1. Clone the repository</h3>
            <CodeBlock code={`git clone https://github.com/Withso/0canvas.git\ncd 0canvas`} />
          </div>

          <div className="p-5 bg-[var(--color--status--warning)]/5 border border-[var(--color--status--warning)]/20 rounded-xl">
            <h3 className="text-foreground mb-3 text-[15px]">2. Swap to the npm package.json</h3>
            <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
              The repo has two package.json files: the Figma Make dev one (used by Vite) and <code className="text-[var(--color--status--warning)] font-mono">package.publish.json</code> (the real npm config). Swap them before building:
            </p>
            <CodeBlock code={`# Back up the Figma Make config\nmv package.json package.figmamake.json\n\n# Use the npm publish config\ncp package.publish.json package.json`} />
          </div>

          <div className="p-5 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl">
            <h3 className="text-foreground mb-4 text-[15px]">3. Install all dependencies</h3>
            <CodeBlock
              code={`# Install with pnpm (recommended)\npnpm install\n\n# Or with npm\nnpm install\n\n# Or with yarn\nyarn install`}
            />
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              This installs all runtime and dev dependencies including React, Radix UI, Lucide, tsup, and TypeScript.
            </p>
          </div>

          <div className="p-5 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl">
            <h3 className="text-foreground mb-4 text-[15px]">4. Build the package</h3>
            <CodeBlock
              code={`# Build once\npnpm build\n\n# Watch mode (rebuild on changes)\npnpm watch`}
            />
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              tsup compiles the source to CJS + ESM with TypeScript declarations. Output goes to <code className="text-[var(--color--text--primary-light)] font-mono">dist/</code>.
            </p>
          </div>

          <div className="p-5 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl">
            <h3 className="text-foreground mb-4 text-[15px]">5. Test locally before publishing</h3>
            <CodeBlock
              code={`# Pack the package (creates a .tgz file)\nnpm pack\n\n# In another project, install from the .tgz\nnpm install ../0canvas/zerosdesign-0canvas-0.0.1.tgz\n\n# Or use npm link for live development\ncd 0canvas && npm link\ncd ../your-project && npm link @zerosdesign/0canvas`}
            />
          </div>

          <div className="p-5 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl">
            <h3 className="text-foreground mb-4 text-[15px]">6. Publish to npm</h3>
            <CodeBlock
              code={`# Login to npm (first time only)\nnpm login\n\n# Publish (scoped packages need --access public)\nnpm publish --access public\n\n# Or publish with a tag\nnpm publish --access public --tag beta`}
            />
          </div>
        </div>
      </section>

      {/* ── Dependency Table ────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[var(--blue-500)]/10 border border-[var(--blue-500)]/20 flex items-center justify-center">
            <Package className="w-3.5 h-3.5 text-[var(--blue-500)]" />
          </div>
          <h2 className="text-foreground text-[22px]">Dependencies</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl p-5">
            <h3 className="text-foreground mb-4 text-sm">Runtime Dependencies</h3>
            {[
              { name: "@radix-ui/react-scroll-area", ver: "^1.2.0" },
              { name: "lucide-react", ver: "^0.400.0" },
              { name: "clsx", ver: "^2.1.0" },
              { name: "tailwind-merge", ver: "^3.0.0" },
            ].map((dep) => (
              <div key={dep.name} className="flex items-center justify-between py-1.5 border-b border-[var(--color--border--on-surface-0)] last:border-0">
                <code className="text-foreground text-xs font-mono">{dep.name}</code>
                <code className="text-muted-foreground text-[11px] font-mono">{dep.ver}</code>
              </div>
            ))}
          </div>

          <div className="bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl p-5">
            <h3 className="text-foreground mb-4 text-sm">Peer Dependencies</h3>
            {[
              { name: "react", ver: ">=18.0.0" },
              { name: "react-dom", ver: ">=18.0.0" },
            ].map((dep) => (
              <div key={dep.name} className="flex items-center justify-between py-1.5 border-b border-[var(--color--border--on-surface-0)] last:border-0">
                <code className="text-foreground text-xs font-mono">{dep.name}</code>
                <code className="text-muted-foreground text-[11px] font-mono">{dep.ver}</code>
              </div>
            ))}
            <p className="text-muted-foreground mt-3 text-[11px] leading-normal">
              Your project must have React 18+ installed. ZeroCanvas doesn't bundle React — it uses yours.
            </p>
          </div>
        </div>
      </section>

      {/* ── Compatibility ───────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-md bg-[var(--color--base--primary)]/10 border border-[var(--color--base--primary)]/20 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-[var(--color--text--primary)]" />
          </div>
          <h2 className="text-foreground text-[22px]">Works With</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {["React", "Next.js", "Vite", "Remix", "CRA", "Astro"].map((fw) => (
            <div key={fw} className="p-4 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl text-center hover:border-[var(--color--border--on-surface-1)] transition-colors">
              <span className="text-foreground text-sm">{fw}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          {["Tailwind CSS", "CSS Modules", "styled-components", "Emotion", "Vanilla CSS", "Any CSS"].map((css) => (
            <div key={css} className="p-4 bg-[var(--color--surface--0)] border border-[var(--color--border--on-surface-0)] rounded-xl text-center hover:border-[var(--color--border--on-surface-1)] transition-colors">
              <span className="text-muted-foreground text-[13px]">{css}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="bg-gradient-to-br from-[var(--color--base--primary)]/10 via-[var(--blue-700)]/10 to-[var(--blue-500)]/10 border border-[var(--color--border--on-surface-0)] rounded-2xl p-12 text-center">
          <h2 className="text-foreground mb-4 text-[28px] tracking-tight">
            Ready to try it?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-[480px] mx-auto text-[15px] leading-relaxed">
            Press <kbd className="bg-[var(--color--surface--1)] border border-[var(--color--border--on-surface-0)] text-foreground px-2 py-0.5 rounded-md text-[12px] font-mono mx-1">Ctrl+Shift+D</kbd> to open the 0canvas overlay with live DOM inspection, style editing, annotations, and agent output.
          </p>
          <button
            onClick={() => { const e = new KeyboardEvent("keydown", { key: "d", ctrlKey: true, shiftKey: true, bubbles: true }); window.dispatchEvent(e); }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color--base--primary)] text-white rounded-xl hover:opacity-90 transition-opacity text-[15px]"
          >
            Open 0canvas
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[var(--color--base--primary)] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-muted-foreground text-[13px]">0canvas</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Withso/0canvas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors text-xs"
            >
              GitHub
            </a>
            <span className="text-[var(--color--text--hint)] text-xs">MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}