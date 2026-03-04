import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowRight,
  Check,
  Loader2,
  Monitor,
  Wifi,
  WifiOff,
  Sparkles,
  Lightbulb,
  Code2,
  Zap,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Copy,
  Globe,
  Layers,
  AlertCircle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Terminal,
  Download,
  Server,
  ArrowDown,
} from "lucide-react";
import { useWorkspace, IDEConnection, ProjectConnection } from "../store";
import {
  PROXY_PORT,
  PROXY_SERVER_SCRIPT,
  PROXY_SCRIPT_FILENAME,
} from "./proxy-server-script";
import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  getPackageFiles,
} from "../engine-package";

// ──────────────────────────────────────────────────────────
// Proxy server detection
// ──────────────────────────────────────────────────────────
type ProxyStatus = "unknown" | "checking" | "connected" | "unavailable";

type ProxyHealthResponse = {
  ok: boolean;
  name: string;
  version: string;
  port: number;
};

type DetectedServer = {
  port: number;
  framework: string;
  corsOk?: boolean;
};

/**
 * Try to connect to the DesignDead proxy server.
 * The proxy has CORS + PNA headers, so this works from any origin.
 */
async function checkProxy(
  port: number = PROXY_PORT
): Promise<ProxyHealthResponse | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://localhost:${port}/__dd__/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      return (await res.json()) as ProxyHealthResponse;
    }
  } catch {
    // Proxy not running or PNA blocked
  }
  return null;
}

/**
 * Scan for dev servers through the proxy.
 */
async function scanViaProxy(
  proxyPort: number = PROXY_PORT
): Promise<DetectedServer[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`http://localhost:${proxyPort}/__dd__/scan`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return data.servers || [];
    }
  } catch {
    // Proxy not available
  }
  return [];
}

/**
 * Direct port probe (works when running on localhost).
 */
async function probePortDirect(
  port: number
): Promise<{ alive: boolean; corsOk: boolean }> {
  const url = `http://localhost:${port}`;

  // Strategy 1: Regular fetch
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "text/html,*/*" },
    });
    clearTimeout(timer);
    return { alive: true, corsOk: true };
  } catch {
    /* CORS/PNA/network error */
  }

  // Strategy 2: no-cors
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(url, {
      mode: "no-cors",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return { alive: true, corsOk: false };
  } catch {
    /* nothing running */
  }

  return { alive: false, corsOk: false };
}

const COMMON_PORTS = [
  3000, 3001, 5173, 5174, 4200, 8080, 8000, 4321, 1234, 3333,
];

/**
 * Detect ports that belong to the host environment (Figma Make, etc.)
 * and should be excluded from scan results.
 */
function getExcludedPorts(): Set<number> {
  const excluded = new Set<number>();

  // Exclude the port this page is served from (Figma Make's own Vite server)
  try {
    const currentPort = parseInt(window.location.port);
    if (currentPort) excluded.add(currentPort);
  } catch { /* not on localhost */ }

  // Exclude the proxy port (we don't want to show the proxy as a "detected server")
  excluded.add(PROXY_PORT);

  // If we're inside an iframe, also exclude the parent's port
  try {
    if (window.parent !== window) {
      const parentPort = parseInt(new URL(document.referrer).port);
      if (parentPort) excluded.add(parentPort);
    }
  } catch { /* cross-origin parent */ }

  // Figma Make typically runs Vite on 5173/5174 — if we detect that
  // the current page is served by Vite (via HMR markers), exclude both
  if (
    document.querySelector('script[type="module"][src*="/@vite"]') ||
    document.querySelector('script[type="module"][src*="node_modules/.vite"]') ||
    (window as any).__vite_plugin_react_preamble_installed__
  ) {
    excluded.add(5173);
    excluded.add(5174);
  }

  return excluded;
}

async function scanDirect(): Promise<DetectedServer[]> {
  const excluded = getExcludedPorts();
  const portsToScan = COMMON_PORTS.filter((p) => !excluded.has(p));

  const results = await Promise.allSettled(
    portsToScan.map(async (port) => {
      const result = await probePortDirect(port);
      if (result.alive) {
        return {
          port,
          framework: guessFramework(port),
          corsOk: result.corsOk,
        };
      }
      return null;
    })
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<DetectedServer | null> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value!);
}

function guessFramework(port: number): string {
  if (port === 5173 || port === 5174) return "Vite";
  if (port === 3000 || port === 3001) return "Next.js / React";
  if (port === 4200) return "Angular";
  if (port === 8080) return "Vue / Webpack";
  if (port === 4321) return "Astro";
  if (port === 1234) return "Parcel";
  if (port === 8000) return "Python / Django";
  if (port === 3333) return "AdonisJS / Remix";
  return "Web App";
}

// ──────────────────────────────────────────────────────────
// Step indicator
// ──────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i === current
              ? "w-6 bg-foreground"
              : i < current
              ? "w-1.5 bg-foreground/40"
              : "w-1.5 bg-[#333333]"
          }`}
        />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// IDE Card
// ──────────────────────────────────────────────────────────
function IDECard({
  ide,
  selected,
  onSelect,
}: {
  ide: IDEConnection;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left group ${
        selected
          ? "border-foreground/30 bg-[#111111]"
          : "border-[#1a1a1a] bg-[#080808] hover:border-[#333333] hover:bg-[#0c0c0c]"
      }`}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-[13px] text-white shrink-0"
        style={{ background: ide.color }}
      >
        {ide.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-foreground">{ide.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {ide.description}
        </div>
      </div>
      <div className="shrink-0">
        {selected ? (
          <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
            <Check className="w-3 h-3 text-background" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border border-[#333333] group-hover:border-[#555555] transition-colors" />
        )}
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// Server card
// ──────────────────────────────────────────────────────────
function ServerCard({
  server,
  selected,
  onSelect,
}: {
  server: DetectedServer;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left w-full group ${
        selected
          ? "border-foreground/30 bg-[#111111]"
          : "border-[#1a1a1a] bg-[#080808] hover:border-[#333333]"
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-[#0070f3]/10 border border-[#0070f3]/20 flex items-center justify-center shrink-0">
        <Monitor className="w-4.5 h-4.5 text-[#0070f3]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-foreground flex items-center gap-2">
          localhost:{server.port}
          <span className="w-1.5 h-1.5 rounded-full bg-[#50e3c2] animate-pulse" />
        </div>
        <div className="text-[11px] text-muted-foreground">
          {server.framework}
        </div>
      </div>
      <div className="shrink-0">
        {selected ? (
          <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
            <Check className="w-3 h-3 text-background" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border border-[#333333] group-hover:border-[#555555] transition-colors" />
        )}
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// Setup instructions for proxy
// ──────────────────────────────────────────────────────────
function ProxySetupGuide({
  onCopy,
  onDownload,
  copied,
  proxyStatus,
  onRetry,
}: {
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
  proxyStatus: ProxyStatus;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] overflow-hidden">
      <div className="p-3 border-b border-[#1a1a1a] flex items-center gap-2">
        <Server className="w-3.5 h-3.5 text-[#0070f3]" />
        <span className="text-[12px] text-foreground">
          DesignDead Proxy Server
        </span>
        {proxyStatus === "connected" && (
          <span className="text-[10px] text-[#50e3c2] bg-[#50e3c2]/10 px-1.5 py-0.5 rounded ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#50e3c2]" />
            Connected
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          The proxy bridges your local dev server with DesignDead. It handles
          CORS + Private Network Access headers, scans ports, and injects the
          inspection bridge.
        </p>

        {/* Step 1: Save the script */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-[#0070f3] uppercase tracking-wider">
            <span className="w-4 h-4 rounded-full bg-[#0070f3]/10 flex items-center justify-center text-[9px]">
              1
            </span>
            Save the proxy script
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={onDownload}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#1a1a1a] rounded-lg text-[11px] text-foreground hover:border-[#333333] transition-colors"
            >
              <Download className="w-3 h-3" />
              Download {PROXY_SCRIPT_FILENAME}
            </button>
            <button
              onClick={onCopy}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#1a1a1a] rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-colors"
            >
              {copied ? (
                <Check className="w-3 h-3 text-[#50e3c2]" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Step 2: Run it */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-[#0070f3] uppercase tracking-wider">
            <span className="w-4 h-4 rounded-full bg-[#0070f3]/10 flex items-center justify-center text-[9px]">
              2
            </span>
            Run in your terminal
          </div>
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg px-3 py-2 flex items-center gap-2">
            <Terminal className="w-3 h-3 text-muted-foreground shrink-0" />
            <code
              className="text-[11px] text-[#50e3c2] flex-1"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              node {PROXY_SCRIPT_FILENAME} --target 3000
            </code>
          </div>
          <p className="text-[10px] text-[#444444]">
            Replace 3000 with your dev server's port
          </p>
        </div>

        {/* Step 3: Connect */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-[#0070f3] uppercase tracking-wider">
            <span className="w-4 h-4 rounded-full bg-[#0070f3]/10 flex items-center justify-center text-[9px]">
              3
            </span>
            Detect & connect
          </div>
          <button
            onClick={onRetry}
            disabled={proxyStatus === "checking"}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-foreground text-background rounded-lg text-[11px] hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {proxyStatus === "checking" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking for proxy...
              </>
            ) : proxyStatus === "connected" ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Proxy connected!
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                Check for proxy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main ConnectProject Component
// ──────────────────────────────────────────────────────────
export function ConnectProject() {
  const { state, dispatch } = useWorkspace();
  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [detectedServers, setDetectedServers] = useState<DetectedServer[]>([]);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [selectedIDE, setSelectedIDE] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [mode, setMode] = useState<"local" | "production" | null>(
    null
  );
  const [productionUrl, setProductionUrl] = useState("");
  const [scanAttempted, setScanAttempted] = useState(false);

  // Proxy state
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus>("unknown");
  const [proxyInfo, setProxyInfo] = useState<ProxyHealthResponse | null>(null);
  const [showProxySetup, setShowProxySetup] = useState(false);

  // Check for proxy on mount + when selecting local mode
  const checkForProxy = useCallback(async () => {
    setProxyStatus("checking");
    const result = await checkProxy();
    if (result) {
      setProxyStatus("connected");
      setProxyInfo(result);
    } else {
      setProxyStatus("unavailable");
      setProxyInfo(null);
    }
    return result;
  }, []);

  // Auto-check proxy on local mode selection
  useEffect(() => {
    if (mode === "local") {
      checkForProxy();
    }
  }, [mode, checkForProxy]);

  // Scan for servers (tries proxy first, then direct)
  const scanServers = useCallback(async () => {
    setScanning(true);
    setDetectedServers([]);
    setScanAttempted(true);

    let servers: DetectedServer[] = [];

    // Try via proxy first (works from any origin)
    if (proxyStatus === "connected") {
      servers = await scanViaProxy();
    }

    // If proxy didn't find anything, try direct
    if (servers.length === 0) {
      servers = await scanDirect();
    }

    setDetectedServers(servers);
    if (servers.length === 1) setSelectedPort(servers[0].port);
    setScanning(false);
  }, [proxyStatus]);

  // Auto-scan after proxy check completes
  useEffect(() => {
    if (
      step === 1 &&
      mode === "local" &&
      (proxyStatus === "connected" || proxyStatus === "unavailable")
    ) {
      scanServers();
    }
  }, [step, mode, proxyStatus]);

  const handleConnect = () => {
    setConnecting(true);

    let devUrl: string;
    let framework = "Web App";
    const useProxy = proxyStatus === "connected";

    if (mode === "local") {
      const port = selectedPort;
      devUrl = port
        ? `http://localhost:${port}`
        : customUrl.trim();
      framework = port ? guessFramework(port) : "Web App";

      // If proxy is available, tell it the target port and use proxy URL
      if (useProxy && port) {
        // POST to /__dd__/target to set the proxy's target port
        fetch(`http://localhost:${PROXY_PORT}/__dd__/target`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ port }),
        }).catch(() => {});
        // Set devServerUrl to the proxy root — the proxy transparently
        // forwards all requests to the target and injects the bridge script
        devUrl = `http://localhost:${PROXY_PORT}`;
      }
    } else {
      devUrl = productionUrl.trim();
    }

    const project: ProjectConnection = {
      name:
        projectName ||
        (mode === "local"
          ? "Local Project"
          : "Production App"),
      devServerUrl: devUrl,
      productionUrl: mode === "production" ? devUrl : undefined,
      framework,
      status: "connecting",
    };

    if (selectedIDE) {
      dispatch({
        type: "UPDATE_IDE_STATUS",
        id: selectedIDE,
        status: "connected",
      });
    }

    dispatch({ type: "CONNECT_PROJECT", project });

    setTimeout(() => {
      dispatch({ type: "UPDATE_PROJECT_STATUS", status: "connected" });
      setConnecting(false);
    }, 1200);
  };

  const copySetupCommand = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyProxyScript = () => {
    navigator.clipboard.writeText(PROXY_SERVER_SCRIPT);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const downloadProxyScript = () => {
    const blob = new Blob([PROXY_SERVER_SCRIPT], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = PROXY_SCRIPT_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canProceedStep1 =
    mode === "local"
      ? !!(selectedPort || customUrl.trim())
      : mode === "production"
      ? !!productionUrl.trim()
      : false;

  const selectedIDEData = state.ides.find((i) => i.id === selectedIDE);

  return (
    <div className="h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#ededed 1px, transparent 1px), linear-gradient(90deg, #ededed 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#0070f3]/[0.03] blur-[120px]" />

      <div className="relative z-10 w-full max-w-[480px] mx-4 max-h-[90vh] overflow-y-auto">
        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-background"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-[22px] text-foreground tracking-tight">
                designdead
              </span>
            </div>

            <h1
              className="text-[28px] text-foreground tracking-tight mb-3"
              style={{ lineHeight: "1.2" }}
            >
              Visual feedback meets
              <br />
              <span className="text-muted-foreground">
                AI-powered development
              </span>
            </h1>

            <p
              className="text-[14px] text-muted-foreground mb-10 max-w-[360px] mx-auto"
              style={{ lineHeight: "1.6" }}
            >
              Connect your project, inspect any element visually, edit styles
              live, brainstorm ideas, and send structured instructions to your AI
              coding agent.
            </p>

            <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
              {[
                {
                  icon: <Layers className="w-3 h-3" />,
                  label: "Visual Inspector",
                },
                {
                  icon: <Sparkles className="w-3 h-3" />,
                  label: "Live Editing",
                },
                {
                  icon: <Zap className="w-3 h-3" />,
                  label: "AI Agent Sync",
                },
                {
                  icon: <Lightbulb className="w-3 h-3" />,
                  label: "Brainstorming",
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-[#111111] border border-[#1a1a1a] px-2.5 py-1 rounded-full"
                >
                  {f.icon}
                  {f.label}
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg text-[14px] hover:opacity-90 transition-opacity"
            >
              Connect your project
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Engine mode — npm package */}
            <div className="mt-6 mb-2">
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 text-[12px] text-[#0070f3] hover:underline transition-colors"
              >
                <Download className="w-3 h-3" />
                Use as npm package instead
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <p className="text-[11px] text-[#444444] mt-2">
              Works with any framework. React, Next.js, Vue, Angular, Svelte,
              Astro...
            </p>
          </div>
        )}

        {/* ── Step 1: Connect Server ── */}
        {step === 1 && (
          <div>
            <StepDots current={0} total={2} />

            <h2 className="text-[20px] text-foreground tracking-tight mt-6 mb-2">
              Connect your project
            </h2>
            <p className="text-[13px] text-muted-foreground mb-6">
              Where is your app running?
            </p>

            {/* Mode selector */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode("local")}
                className={`flex-1 flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${
                  mode === "local"
                    ? "border-foreground/30 bg-[#111111]"
                    : "border-[#1a1a1a] bg-[#080808] hover:border-[#333333]"
                }`}
              >
                <Monitor className="w-4 h-4 text-[#0070f3]" />
                <div>
                  <div className="text-[13px] text-foreground">
                    Local Dev Server
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    localhost
                  </div>
                </div>
              </button>
              <button
                onClick={() => setMode("production")}
                className={`flex-1 flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${
                  mode === "production"
                    ? "border-foreground/30 bg-[#111111]"
                    : "border-[#1a1a1a] bg-[#080808] hover:border-[#333333]"
                }`}
              >
                <Globe className="w-4 h-4 text-[#50e3c2]" />
                <div>
                  <div className="text-[13px] text-foreground">
                    Production URL
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Live URL
                  </div>
                </div>
              </button>
            </div>

            {mode === "local" && (
              <>
                {/* Proxy status banner */}
                <div className="mb-4">
                  {proxyStatus === "checking" && (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl border border-[#1a1a1a] bg-[#080808]">
                      <Loader2 className="w-4 h-4 text-[#0070f3] animate-spin shrink-0" />
                      <span className="text-[12px] text-muted-foreground">
                        Looking for DesignDead proxy on port {PROXY_PORT}...
                      </span>
                    </div>
                  )}
                  {proxyStatus === "connected" && (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl border border-[#50e3c2]/20 bg-[#50e3c2]/5">
                      <CheckCircle2 className="w-4 h-4 text-[#50e3c2] shrink-0" />
                      <div className="flex-1">
                        <span className="text-[12px] text-[#50e3c2]">
                          Proxy connected on port {proxyInfo?.port || PROXY_PORT}
                        </span>
                        <span className="text-[10px] text-[#50e3c2]/60 block">
                          Port scanning, bridge injection & resource proxying
                          active
                        </span>
                      </div>
                    </div>
                  )}
                  {proxyStatus === "unavailable" && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-[#f5a623]/20 bg-[#f5a623]/5">
                      <Info className="w-4 h-4 text-[#f5a623] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[12px] text-[#f5a623] mb-1">
                          Proxy not detected
                        </p>
                        <p className="text-[11px] text-[#f5a623]/70 mb-2">
                          Without the proxy, port scanning may not work from
                          this environment. The proxy handles Private Network
                          Access headers to bridge your dev server.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowProxySetup(!showProxySetup)}
                            className="text-[11px] text-[#0070f3] hover:underline flex items-center gap-1"
                          >
                            <Terminal className="w-3 h-3" />
                            {showProxySetup ? "Hide" : "Setup"} proxy
                          </button>
                          <button
                            onClick={checkForProxy}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Proxy setup guide (expandable) */}
                {showProxySetup && proxyStatus !== "connected" && (
                  <div className="mb-4">
                    <ProxySetupGuide
                      onCopy={copyProxyScript}
                      onDownload={downloadProxyScript}
                      copied={copiedScript}
                      proxyStatus={proxyStatus}
                      onRetry={checkForProxy}
                    />
                  </div>
                )}

                {/* Scanning / detected servers */}
                {scanning ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-[#1a1a1a] bg-[#080808] mb-4">
                    <Loader2 className="w-4 h-4 text-[#0070f3] animate-spin" />
                    <div>
                      <span className="text-[13px] text-muted-foreground block">
                        Scanning for running dev servers...
                      </span>
                      <span className="text-[10px] text-[#444444]">
                        {proxyStatus === "connected"
                          ? "via proxy"
                          : "direct scan"}{" "}
                        — ports: {COMMON_PORTS.join(", ")}
                      </span>
                    </div>
                  </div>
                ) : detectedServers.length > 0 ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-[#50e3c2]" />
                        Detected servers ({detectedServers.length})
                      </span>
                      <button
                        onClick={scanServers}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Rescan
                      </button>
                    </div>
                    <div className="space-y-2">
                      {detectedServers.map((server) => (
                        <ServerCard
                          key={server.port}
                          server={server}
                          selected={selectedPort === server.port}
                          onSelect={() => {
                            setSelectedPort(server.port);
                            setCustomUrl("");
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : scanAttempted && !scanning ? (
                  <div className="p-4 rounded-xl border border-[#1a1a1a] bg-[#080808] mb-4 text-center">
                    <WifiOff className="w-5 h-5 text-[#444444] mx-auto mb-2" />
                    <p className="text-[12px] text-muted-foreground mb-1">
                      No running servers detected
                    </p>
                    <p className="text-[11px] text-[#444444] mb-2">
                      Start your dev server (e.g.{" "}
                      <code className="text-[#50e3c2]">npm run dev</code>)
                      {proxyStatus !== "connected" &&
                        " and start the proxy server"}
                      , then scan again
                    </p>
                    <button
                      onClick={scanServers}
                      className="text-[11px] text-[#0070f3] hover:underline mt-1 inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Scan again
                    </button>
                  </div>
                ) : null}

                {/* Manual URL input */}
                <div className="mb-1">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block">
                    Or enter URL manually
                  </span>
                  <input
                    type="text"
                    placeholder="http://localhost:3000"
                    value={customUrl}
                    onChange={(e) => {
                      setCustomUrl(e.target.value);
                      setSelectedPort(null);
                    }}
                    className="w-full bg-[#080808] border border-[#222222] rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-[#444444] focus:outline-none focus:border-[#444444] transition-colors"
                    style={{
                      fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                    }}
                  />
                </div>
              </>
            )}

            {mode === "production" && (
              <div>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block">
                  Production URL
                </span>
                <input
                  type="text"
                  placeholder="https://myapp.vercel.app"
                  value={productionUrl}
                  onChange={(e) => setProductionUrl(e.target.value)}
                  className="w-full bg-[#080808] border border-[#222222] rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-[#444444] focus:outline-none focus:border-[#444444] transition-colors"
                  style={{
                    fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                  }}
                />
                <p className="text-[11px] text-[#444444] mt-2">
                  Connect your IDE in the next step to link code changes
                </p>
              </div>
            )}

            {/* Project name */}
            {mode && (
              <div className="mt-4">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block">
                  Project name
                  <span className="text-[#444444] normal-case tracking-normal ml-1">
                    optional
                  </span>
                </span>
                <input
                  type="text"
                  placeholder="My Awesome App"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-[#080808] border border-[#222222] rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-[#444444] focus:outline-none focus:border-[#444444] transition-colors"
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => {
                  setStep(0);
                  setMode(null);
                }}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="inline-flex items-center gap-2 px-5 py-2 bg-foreground text-background rounded-lg text-[13px] hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Connect IDE ── */}
        {step === 2 && (
          <div>
            <StepDots current={1} total={2} />

            <h2 className="text-[20px] text-foreground tracking-tight mt-6 mb-2">
              Connect your IDE
            </h2>
            <p className="text-[13px] text-muted-foreground mb-6">
              Choose how you want to sync design changes with code.
            </p>

            <div className="space-y-2 mb-6">
              {state.ides.map((ide) => (
                <IDECard
                  key={ide.id}
                  ide={ide}
                  selected={selectedIDE === ide.id}
                  onSelect={() => setSelectedIDE(ide.id)}
                />
              ))}
            </div>

            {/* Setup instructions */}
            {selectedIDEData && (
              <div className="p-4 rounded-xl border border-[#1a1a1a] bg-[#080808] mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[12px] text-foreground">
                    Setup for {selectedIDEData.name}
                  </span>
                </div>
                <SetupInstructions
                  ide={selectedIDEData}
                  copied={copied}
                  onCopy={copySetupCommand}
                />
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setStep(1)}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedIDE(null);
                    handleConnect();
                  }}
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleConnect}
                  disabled={!selectedIDE || connecting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-foreground text-background rounded-lg text-[13px] hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Launch workspace
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Use as npm package ── */}
        {step === 3 && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#0070f3]/10 border border-[#0070f3]/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#0070f3]" />
              </div>
              <div>
                <h2 className="text-[18px] text-foreground tracking-tight">
                  Engine Mode
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  npm package — zero server dependencies
                </p>
              </div>
            </div>

            {/* Architecture explainer */}
            <div className="p-3 rounded-xl border border-[#0070f3]/20 bg-[#0070f3]/5 mb-5">
              <p className="text-[11px] text-[#0070f3]/80" style={{ lineHeight: "1.6" }}>
                Like <span className="text-[#0070f3]">agentation.dev</span> and{" "}
                <span className="text-[#0070f3]">design-playground</span>,
                DesignDead runs as a self-contained engine inside your app. No
                server, no proxy, no iframe, no build pipeline. Just import and
                render.
              </p>
            </div>

            {/* Step 1: Install */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-1.5 text-[10px] text-[#0070f3] uppercase tracking-wider">
                <span className="w-4 h-4 rounded-full bg-[#0070f3]/10 flex items-center justify-center text-[9px]">
                  1
                </span>
                Install
              </div>
              <button
                onClick={() =>
                  copySetupCommand(`npm install ${PACKAGE_NAME} -D`)
                }
                className="w-full flex items-center justify-between bg-[#080808] border border-[#1a1a1a] rounded-lg px-3 py-2.5 hover:border-[#333333] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-3 h-3 text-muted-foreground" />
                  <code
                    className="text-[12px] text-[#50e3c2]"
                    style={{ fontFamily: "'Geist Mono', monospace" }}
                  >
                    npm install {PACKAGE_NAME} -D
                  </code>
                </div>
                {copied ? (
                  <Check className="w-3 h-3 text-[#50e3c2]" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </div>

            {/* Step 2: Usage */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-1.5 text-[10px] text-[#0070f3] uppercase tracking-wider">
                <span className="w-4 h-4 rounded-full bg-[#0070f3]/10 flex items-center justify-center text-[9px]">
                  2
                </span>
                Add to your app
              </div>
              <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3 overflow-x-auto">
                <pre
                  className="text-[11px] text-muted-foreground"
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    lineHeight: "1.7",
                    margin: 0,
                  }}
                >
                  <span className="text-[#888]">{"// In your root component:"}</span>
                  {"\n"}
                  <span className="text-[#c678dd]">import</span>
                  {" { "}
                  <span className="text-[#e5c07b]">DesignDead</span>
                  {" } "}
                  <span className="text-[#c678dd]">from</span>
                  {" "}
                  <span className="text-[#98c379]">'designdead'</span>
                  {";"}
                  {"\n\n"}
                  <span className="text-[#c678dd]">function</span>
                  {" "}
                  <span className="text-[#61afef]">App</span>
                  {"() {"}
                  {"\n  "}
                  <span className="text-[#c678dd]">return</span>
                  {" ("}
                  {"\n    <>"}
                  {"\n      <"}
                  <span className="text-[#e5c07b]">YourApp</span>
                  {" />"}
                  {"\n      <"}
                  <span className="text-[#e5c07b]">DesignDead</span>
                  {" />"}
                  {"\n    </>"}
                  {"\n  );"}
                  {"\n}"}
                </pre>
              </div>
            </div>

            {/* Step 3: Done */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-1.5 text-[10px] text-[#0070f3] uppercase tracking-wider">
                <span className="w-4 h-4 rounded-full bg-[#0070f3]/10 flex items-center justify-center text-[9px]">
                  3
                </span>
                That's it
              </div>
              <div className="p-3 rounded-xl border border-[#1a1a1a] bg-[#080808]">
                <div className="space-y-2">
                  {[
                    { icon: <Layers className="w-3 h-3" />, text: "Floating inspector panel appears in your app" },
                    { icon: <Sparkles className="w-3 h-3" />, text: "Click any element to inspect its styles" },
                    { icon: <Zap className="w-3 h-3" />, text: "Copy structured output for AI agents" },
                    { icon: <Code2 className="w-3 h-3" />, text: "Edit CSS values live in the panel" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="text-[#50e3c2]">{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                How it works
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Install", desc: "npm package", color: "#0070f3" },
                  { label: "Import", desc: "React component", color: "#50e3c2" },
                  { label: "Inspect", desc: "In-page DOM", color: "#f5a623" },
                ].map((step, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-[#1a1a1a] bg-[#080808] text-center"
                  >
                    <div className="text-[11px] text-foreground mb-0.5">{step.label}</div>
                    <div className="text-[9px]" style={{ color: step.color }}>{step.desc}</div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#444444] text-center">
                No server. No proxy. No iframe. No PNA issues. Just React.
              </p>
            </div>

            {/* Props table */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                Available props
              </div>
              <div className="rounded-lg border border-[#1a1a1a] bg-[#080808] overflow-hidden">
                {[
                  { prop: "position", default: '"bottom-right"', desc: "Panel position" },
                  { prop: "theme", default: '"dark"', desc: "dark | light | auto" },
                  { prop: "defaultOpen", default: "false", desc: "Start expanded" },
                  { prop: "devOnly", default: "true", desc: "Hide in production" },
                  { prop: "shortcut", default: '"d"', desc: "Ctrl+Shift+{key}" },
                ].map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-1.5 ${
                      i > 0 ? "border-t border-[#1a1a1a]" : ""
                    }`}
                  >
                    <code
                      className="text-[10px] text-[#0070f3]"
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    >
                      {row.prop}
                    </code>
                    <span className="text-[10px] text-[#444444]">{row.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Download package scaffold */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                Package scaffold (for contributors)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getPackageFiles().map((file) => (
                  <button
                    key={file.path}
                    onClick={() => {
                      const blob = new Blob([file.content], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = file.path.split("/").pop() || file.path;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground bg-[#080808] border border-[#1a1a1a] rounded-md hover:border-[#333333] hover:text-foreground transition-colors"
                    title={file.description}
                  >
                    <Download className="w-2.5 h-2.5" />
                    {file.path}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#444444]">
                Download these to set up the npm package repo for publishing
              </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setStep(0)}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(1)}
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                Or connect a dev server instead
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// IDE setup instructions component
function SetupInstructions({
  ide,
  copied,
  onCopy,
}: {
  ide: IDEConnection;
  copied: boolean;
  onCopy: (text: string) => void;
}) {
  const commands: Record<string, { cmd: string; desc: string }> = {
    "claude-code": {
      cmd: "claude mcp add designdead",
      desc: "Run this in your terminal. Claude Code will automatically receive design instructions.",
    },
    cursor: {
      cmd: "npx designdead@latest init --cursor",
      desc: "Adds a .cursor/rules file and configures the MCP bridge.",
    },
    vscode: {
      cmd: "npx designdead@latest init --vscode",
      desc: "Installs the VS Code extension and sets up Copilot integration.",
    },
    windsurf: {
      cmd: "npx designdead@latest init --windsurf",
      desc: "Configures the Windsurf cascade agent bridge.",
    },
    antigravity: {
      cmd: "npx designdead@latest init --antigravity",
      desc: "Sets up the Antigravity visual agent integration.",
    },
  };

  const info = commands[ide.type];
  if (!info) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => onCopy(info.cmd)}
        className="w-full flex items-center justify-between bg-[#111111] border border-[#1a1a1a] rounded-lg px-3 py-2 hover:border-[#333333] transition-colors group"
      >
        <code
          className="text-[11px] text-[#50e3c2]"
          style={{ fontFamily: "'Geist Mono', monospace" }}
        >
          {info.cmd}
        </code>
        {copied ? (
          <Check className="w-3 h-3 text-[#50e3c2]" />
        ) : (
          <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
      <p className="text-[11px] text-[#444444]">{info.desc}</p>
    </div>
  );
}