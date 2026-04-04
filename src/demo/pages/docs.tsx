import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Command,
  Copy,
  Cpu,
  ExternalLink,
  Eye,
  GitBranch,
  Layers,
  Lightbulb,
  MousePointer2,
  Package,
  Palette,
  PenTool,
  Send,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: <MousePointer2 className="h-5 w-5" />,
    title: "Click to inspect",
    description:
      "Point at any element and read its selector, computed styles, and DOM path without leaving the page.",
    color: "#216869",
  },
  {
    icon: <Palette className="h-5 w-5" />,
    title: "Live style edits",
    description:
      "Tweak spacing, colors, and CSS properties directly against the running UI and see the update immediately.",
    color: "#3B8D89",
  },
  {
    icon: <Layers className="h-5 w-5" />,
    title: "Layer tree",
    description:
      "Traverse the rendered hierarchy as a searchable tree so it is easier to isolate the right node quickly.",
    color: "#7A8F6B",
  },
  {
    icon: <Send className="h-5 w-5" />,
    title: "Agent-ready output",
    description:
      "Turn visual findings into structured notes that map well to Claude Code, Cursor, and similar agents.",
    color: "#C1784A",
  },
  {
    icon: <PenTool className="h-5 w-5" />,
    title: "Annotations",
    description:
      "Mark up screens with shapes, arrows, and notes to capture intent during feedback and review flows.",
    color: "#A55C48",
  },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    title: "Idea capture",
    description:
      "Keep lightweight design thoughts and potential experiments close to the exact UI state that inspired them.",
    color: "#B97A24",
  },
];

const API_ROWS = [
  {
    prop: "position",
    type: "string",
    defaultValue: '"bottom-right"',
    description:
      'Floating button position. Options: "bottom-right", "bottom-left", "top-right", "top-left".',
  },
  {
    prop: "defaultOpen",
    type: "boolean",
    defaultValue: "false",
    description: "Starts the panel in an open state.",
  },
  {
    prop: "theme",
    type: "string",
    defaultValue: '"dark"',
    description: 'Overlay theme. Options: "dark", "light", "auto".',
  },
  {
    prop: "shortcut",
    type: "string",
    defaultValue: '"d"',
    description: "Key used for the Ctrl+Shift+{key} toggle.",
  },
  {
    prop: "devOnly",
    type: "boolean",
    defaultValue: "true",
    description: "Hides the overlay in production builds.",
  },
  {
    prop: "zIndex",
    type: "number",
    defaultValue: "2147483640",
    description: "Applies the overlay z-index.",
  },
  {
    prop: "onToggle",
    type: "(open: boolean) => void",
    defaultValue: "--",
    description: "Callback fired whenever the panel opens or closes.",
  },
];

const IDES = [
  { name: "Claude Code", icon: "CC", cmd: "claude mcp add 0canvas", method: "MCP", color: "#216869" },
  { name: "Cursor", icon: "Cu", cmd: "npx 0canvas@latest init --cursor", method: "Extension", color: "#3B8D89" },
  { name: "Windsurf", icon: "Ws", cmd: "npx 0canvas@latest init --windsurf", method: "Extension", color: "#7A8F6B" },
  { name: "VS Code", icon: "VS", cmd: "npx 0canvas@latest init --vscode", method: "Extension", color: "#C1784A" },
  { name: "Antigravity", icon: "AG", cmd: "npx 0canvas@latest init --antigravity", method: "CLI", color: "#A55C48" },
];

const RUNTIME_DEPS = [
  { name: "@radix-ui/react-scroll-area", version: "^1.2.0" },
  { name: "lucide-react", version: "^0.400.0" },
  { name: "clsx", version: "^2.1.0" },
  { name: "tailwind-merge", version: "^3.0.0" },
];

const PEER_DEPS = [
  { name: "react", version: ">=18.0.0" },
  { name: "react-dom", version: ">=18.0.0" },
];

const WORKS_WITH = ["React", "Next.js", "Vite", "Remix", "CRA", "Astro"];
const STYLE_SUPPORT = ["Tailwind CSS", "CSS Modules", "styled-components", "Emotion", "Vanilla CSS", "Any CSS"];

function triggerCanvas() {
  const event = new KeyboardEvent("keydown", {
    key: "d",
    ctrlKey: true,
    shiftKey: true,
    bubbles: true,
  });

  window.dispatchEvent(event);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      aria-label={copied ? "Copied" : "Copy code"}
      className="demo-icon-button absolute right-4 top-4 h-9 w-9"
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <Check className="h-4 w-4 text-[var(--color--status--success)]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="demo-code-shell">
      <div className="flex items-center justify-between px-4 pb-0 pt-4">
        <span className="demo-code-label">{lang}</span>
      </div>
      <pre className="overflow-x-auto px-4 pb-4 pt-3 font-mono text-[12.5px] leading-7 text-[var(--color--text--on-surface)]">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  eyebrow,
}: {
  icon: React.ReactNode;
  title: string;
  eyebrow?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="space-y-3">
        {eyebrow ? (
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color--text--muted)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color--border--on-surface-0)] bg-white/80 text-[var(--color--text--primary)] shadow-[0_10px_25px_rgba(121,95,63,0.08)]">
            {icon}
          </div>
          <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-foreground">
            {title}
          </h2>
        </div>
      </div>
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
    <div className="demo-card h-full p-6">
      <div
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background: `${color}16`,
          border: `1px solid ${color}28`,
          color,
        }}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h3>
      <p className="text-[0.92rem] leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function ShortcutGroup({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ keys: string; action: string }>;
}) {
  return (
    <div className="demo-card p-6">
      <h3 className="mb-4 text-[0.98rem] font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h3>
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            className="flex items-center justify-between border-b border-[var(--color--border--on-surface-0)] py-3 last:border-0"
            key={row.keys}
          >
            <span className="text-[0.9rem] text-muted-foreground">{row.action}</span>
            <kbd className="demo-kbd">{row.keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="demo-card demo-float relative overflow-hidden p-6">
      <div className="demo-grid-accent" />
      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color--text--muted)]">
              Preview Surface
            </p>
            <h2 className="max-w-[14ch] text-[1.7rem] font-semibold leading-tight tracking-[-0.04em] text-foreground">
              Light, quiet, and still interactive.
            </h2>
          </div>
          <div className="demo-orb demo-pulse shrink-0" />
        </div>

        <div className="grid gap-3">
          <div className="demo-soft-card demo-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[var(--color--text--primary)]" />
                <span className="text-[0.82rem] font-semibold text-foreground">
                  Inspect mode
                </span>
              </div>
              <span className="demo-badge demo-badge-primary">Live DOM</span>
            </div>
            <div className="rounded-[1rem] border border-[var(--color--border--on-surface-0)] bg-white/80 p-4">
              <div className="mb-3 h-2 w-16 rounded-full bg-[var(--color--surface--2)]" />
              <div className="mb-2 flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-[var(--color--base--primary)]/12" />
                <div className="space-y-2">
                  <div className="h-2 w-28 rounded-full bg-[var(--color--surface--2)]" />
                  <div className="h-2 w-16 rounded-full bg-[var(--color--surface--2)]" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-10 flex-1 rounded-2xl border border-[var(--color--border--on-surface-0)] bg-[var(--color--surface--1)]" />
                <div className="h-10 w-16 rounded-2xl bg-[var(--color--base--primary)]/14" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="demo-soft-card demo-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Palette className="h-4 w-4 text-[var(--demo-accent)]" />
                <span className="text-[0.82rem] font-semibold text-foreground">
                  Style edits
                </span>
              </div>
              <div className="space-y-2">
                <div className="rounded-xl border border-[var(--color--border--on-surface-0)] bg-white/80 px-3 py-2 text-[0.78rem] text-muted-foreground">
                  gap: <span className="font-mono text-[var(--color--text--primary)]">24px</span>
                </div>
                <div className="rounded-xl border border-[var(--color--border--on-surface-0)] bg-white/80 px-3 py-2 text-[0.78rem] text-muted-foreground">
                  radius: <span className="font-mono text-[var(--color--text--primary)]">20px</span>
                </div>
              </div>
            </div>

            <div className="demo-soft-card demo-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Send className="h-4 w-4 text-[var(--color--status--success)]" />
                <span className="text-[0.82rem] font-semibold text-foreground">
                  Agent handoff
                </span>
              </div>
              <div className="rounded-xl border border-[var(--color--border--on-surface-0)] bg-white/80 p-3 text-[0.78rem] leading-6 text-muted-foreground">
                “Tighten hero spacing and mute the callout border.”
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="demo-page min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-[var(--color--border--on-surface-0)] bg-[rgba(253,249,242,0.78)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color--base--primary)] text-white shadow-[0_14px_30px_rgba(33,104,105,0.24)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[1rem] font-semibold tracking-[-0.03em] text-foreground">
                0canvas demo
              </div>
              <div className="text-[0.76rem] text-muted-foreground">
                separate demo-only design tokens
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              className="hidden items-center gap-2 text-[0.88rem] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              href="https://github.com/Withso/0canvas"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button className="demo-primary-button" onClick={triggerCanvas} type="button">
              Open 0canvas
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="pb-24">
        <section className="mx-auto max-w-[1120px] px-6 pt-6">
          <div className="demo-card demo-reveal flex items-start gap-3 p-4" style={{ animationDelay: "0.06s" }}>
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color--status--warning)]" />
            <div>
              <p className="mb-1 text-[0.95rem] font-semibold text-foreground">
                Not published to npm yet
              </p>
              <p className="text-[0.9rem] leading-7 text-muted-foreground">
                Running <code className="demo-inline-code">npm install @zerosdesign/0canvas</code> still returns a
                404. Use the GitHub install path or build from source for now. The sections below walk through both.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20 pt-12">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="demo-reveal space-y-7">
              <div className="flex flex-wrap gap-3">
                <span className="demo-badge demo-badge-primary">Light theme demo</span>
                <span className="demo-badge demo-badge-success">Open source</span>
                <span className="demo-badge demo-badge-warning">Subtle motion enabled</span>
              </div>

              <div className="space-y-5">
                <h1 className="max-w-[12ch] text-[clamp(3rem,7vw,5.35rem)] font-semibold leading-[0.96] tracking-[-0.08em] text-foreground">
                  Inspect UI without the noise.
                </h1>
                <p className="max-w-[58ch] text-[1.08rem] leading-8 text-muted-foreground">
                  This demo now uses its own quiet light-token system so it feels clearly separate from the main 0canvas
                  app while still giving us hover, depth, and motion behavior to inspect during development.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="demo-primary-button" onClick={triggerCanvas} type="button">
                  Open overlay
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a className="demo-secondary-button" href="#install-from-github">
                  Install from GitHub
                </a>
              </div>

              <div className="demo-card flex flex-wrap items-center gap-3 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Terminal className="h-4 w-4" />
                  <code className="line-through text-[0.88rem]">npm install @zerosdesign/0canvas -D</code>
                </div>
                <span className="demo-badge demo-badge-warning">publish pending</span>
              </div>
            </div>

            <HeroPreview />
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20" id="install-from-github">
          <SectionHeading eyebrow="Install" icon={<GitBranch className="h-4 w-4" />} title="Install from GitHub" />

          <div className="demo-card mb-6 p-5">
            <p className="text-[0.95rem] leading-7 text-muted-foreground">
              <strong className="text-[var(--color--text--primary)]">Use this until npm publishing is ready.</strong>{" "}
              Pull the package directly from the repository, then add the overlay to your app shell.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="demo-badge demo-badge-primary">Step 1</span>
                <span className="text-[0.95rem] font-semibold text-foreground">Install directly from GitHub</span>
              </div>
              <CodeBlock
                code={`# npm\nnpm install github:Withso/0canvas --save-dev\n\n# pnpm\npnpm add github:Withso/0canvas -D\n\n# yarn\nyarn add Withso/0canvas --dev`}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="demo-badge demo-badge-primary">Step 2</span>
                <span className="text-[0.95rem] font-semibold text-foreground">Mount the overlay</span>
              </div>
              <CodeBlock
                code={`import { ZeroCanvas } from "@zerosdesign/0canvas";\n\nfunction App() {\n  return (\n    <>\n      <YourApp />\n      <ZeroCanvas />\n    </>\n  );\n}`}
                lang="tsx"
              />
            </div>
          </div>

          <div className="demo-card mt-6 p-5">
            <p className="text-[0.92rem] leading-7 text-muted-foreground">
              If you install from GitHub, the repo still needs either a committed <code className="demo-inline-code">dist/</code>{" "}
              directory or a reliable <code className="demo-inline-code">postinstall</code> build step. Until that lands,
              use the source build workflow below.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20">
          <SectionHeading eyebrow="Capabilities" icon={<Sparkles className="h-4 w-4" />} title="Core feature set" />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <div className="demo-reveal" key={feature.title} style={{ animationDelay: `${0.06 * index}s` }}>
                <FeatureCard {...feature} />
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20">
          <SectionHeading eyebrow="API" icon={<BookOpen className="h-4 w-4" />} title="API reference" />

          <div className="demo-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="demo-table">
                <thead>
                  <tr>
                    <th>Prop</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {API_ROWS.map((row) => (
                    <tr key={row.prop}>
                      <td>
                        <code className="font-mono text-[var(--color--text--primary)]">{row.prop}</code>
                      </td>
                      <td>
                        <code className="font-mono text-[var(--color--status--warning)]">{row.type}</code>
                      </td>
                      <td>
                        <code className="font-mono text-muted-foreground">{row.defaultValue}</code>
                      </td>
                      <td className="text-muted-foreground">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20">
          <SectionHeading eyebrow="Shortcuts" icon={<Command className="h-4 w-4" />} title="Keyboard flow" />

          <div className="grid gap-6 md:grid-cols-2">
            <ShortcutGroup
              rows={[
                { keys: "Ctrl+Shift+D", action: "Toggle 0canvas" },
                { keys: "I", action: "Start or stop inspect mode" },
                { keys: "Ctrl+K", action: "Open command palette" },
                { keys: "Esc", action: "Close overlay or cancel" },
              ]}
              title="Global"
            />
            <ShortcutGroup
              rows={[
                { keys: "V", action: "Select tool" },
                { keys: "R", action: "Rectangle tool" },
                { keys: "O", action: "Circle tool" },
                { keys: "A", action: "Arrow tool" },
                { keys: "T", action: "Text tool" },
                { keys: "P", action: "Freehand tool" },
              ]}
              title="Annotation mode"
            />
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20">
          <SectionHeading eyebrow="IDE" icon={<Zap className="h-4 w-4" />} title="IDE integration" />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {IDES.map((ide, index) => (
              <div className="demo-card p-5" key={ide.name} style={{ animationDelay: `${0.05 * index}s` }}>
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl text-[0.78rem] font-semibold text-white"
                    style={{ background: ide.color }}
                  >
                    {ide.icon}
                  </div>
                  <div>
                    <div className="text-[0.98rem] font-semibold tracking-[-0.02em] text-foreground">
                      {ide.name}
                    </div>
                    <div className="text-[0.78rem] text-muted-foreground">via {ide.method}</div>
                  </div>
                </div>

                <code className="block rounded-2xl border border-[var(--color--border--on-surface-0)] bg-white/75 px-3 py-3 font-mono text-[0.74rem] leading-6 text-[var(--color--text--primary)]">
                  {ide.cmd}
                </code>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20">
          <SectionHeading eyebrow="Architecture" icon={<Cpu className="h-4 w-4" />} title="How it fits into your app" />
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
│  │  DOM inspector walks document.body         │  │
│  │  Scoped CSS injection prevents leaks       │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

No server · No proxy · No iframe · Direct DOM inspection`}
          />
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20" id="cursor-setup">
          <SectionHeading eyebrow="Source Build" icon={<Terminal className="h-4 w-4" />} title="Build from source" />

          <div className="space-y-5">
            <div className="demo-card p-5">
              <h3 className="mb-3 text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
                1. Clone the repository
              </h3>
              <CodeBlock code={`git clone https://github.com/Withso/0canvas.git\ncd 0canvas`} />
            </div>

            <div className="demo-card p-5">
              <h3 className="mb-3 text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
                2. Swap to the npm package manifest
              </h3>
              <p className="mb-4 text-[0.9rem] leading-7 text-muted-foreground">
                The repo currently keeps the publish manifest in{" "}
                <code className="demo-inline-code">package.publish.json</code>. Replace the active manifest before you build.
              </p>
              <CodeBlock
                code={`# Back up the Figma Make config\nmv package.json package.figmamake.json\n\n# Use the npm publish config\ncp package.publish.json package.json`}
              />
            </div>

            <div className="demo-card p-5">
              <h3 className="mb-3 text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
                3. Install dependencies
              </h3>
              <CodeBlock
                code={`# pnpm\npnpm install\n\n# npm\nnpm install\n\n# yarn\nyarn install`}
              />
            </div>

            <div className="demo-card p-5">
              <h3 className="mb-3 text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
                4. Build the package
              </h3>
              <CodeBlock code={`# Build once\npnpm build\n\n# Watch mode\npnpm watch`} />
            </div>

            <div className="demo-card p-5">
              <h3 className="mb-3 text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
                5. Test locally
              </h3>
              <CodeBlock
                code={`# Create a tarball\nnpm pack\n\n# Install the tarball elsewhere\nnpm install ../0canvas/zerosdesign-0canvas-0.0.1.tgz\n\n# Or use npm link\ncd 0canvas && npm link\ncd ../your-project && npm link @zerosdesign/0canvas`}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20">
          <SectionHeading eyebrow="Dependencies" icon={<Package className="h-4 w-4" />} title="Package shape" />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="demo-card p-6">
              <h3 className="mb-4 text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
                Runtime dependencies
              </h3>
              <div className="space-y-1">
                {RUNTIME_DEPS.map((dep) => (
                  <div
                    className="flex items-center justify-between border-b border-[var(--color--border--on-surface-0)] py-3 last:border-0"
                    key={dep.name}
                  >
                    <code className="font-mono text-[0.8rem] text-foreground">{dep.name}</code>
                    <code className="font-mono text-[0.78rem] text-muted-foreground">{dep.version}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="demo-card p-6">
              <h3 className="mb-4 text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
                Peer dependencies
              </h3>
              <div className="space-y-1">
                {PEER_DEPS.map((dep) => (
                  <div
                    className="flex items-center justify-between border-b border-[var(--color--border--on-surface-0)] py-3 last:border-0"
                    key={dep.name}
                  >
                    <code className="font-mono text-[0.8rem] text-foreground">{dep.name}</code>
                    <code className="font-mono text-[0.78rem] text-muted-foreground">{dep.version}</code>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[0.84rem] leading-6 text-muted-foreground">
                Your host app needs React 18 or newer. 0canvas uses your existing React runtime.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 pb-20">
          <SectionHeading eyebrow="Compatibility" icon={<Check className="h-4 w-4" />} title="Works with" />

          <div className="grid gap-6">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {WORKS_WITH.map((item) => (
                <div className="demo-card px-4 py-5 text-center" key={item}>
                  <span className="text-[0.94rem] font-medium text-foreground">{item}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {STYLE_SUPPORT.map((item) => (
                <div className="demo-card px-4 py-5 text-center" key={item}>
                  <span className="text-[0.84rem] text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6">
          <div className="demo-card relative overflow-hidden p-10 text-center sm:p-12">
            <div className="demo-grid-accent" />
            <div className="relative z-10 mx-auto max-w-[34rem] space-y-5">
              <span className="demo-badge demo-badge-primary">Ready to test motion and inspection</span>
              <h2 className="text-[2.1rem] font-semibold tracking-[-0.05em] text-foreground">
                Open the overlay and inspect this calmer demo surface.
              </h2>
              <p className="text-[1rem] leading-8 text-muted-foreground">
                Use <kbd className="demo-kbd">Ctrl+Shift+D</kbd> to launch 0canvas, then inspect the cards, hover states,
                and transitions across this page.
              </p>
              <div className="flex justify-center">
                <button className="demo-primary-button" onClick={triggerCanvas} type="button">
                  Open 0canvas
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
