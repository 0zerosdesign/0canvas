// ──────────────────────────────────────────────────────────
// IPC commands: localhost scan — port of src-tauri/src/localhost.rs
// ──────────────────────────────────────────────────────────
//
// Column 1's LOCALHOST panel polls this to surface whatever is
// listening on common dev-server / database / engine ports. Plain
// TCP connect with a 120ms timeout — closed ports return refused
// instantly so the full sweep stays under ~100ms even on a cold
// machine.
// ──────────────────────────────────────────────────────────

import net from "node:net";
import type { CommandHandler } from "../router";

interface LocalhostService {
  port: number;
  url: string;
  kind: "dev-server" | "database" | "engine" | "unknown";
  label: string;
}

/** KNOWN_PORTS mirror. Engine range 24193–24200 matches the
 *  retry span src/engine/server.ts uses when 24193 is taken. */
const KNOWN_PORTS: Array<{
  port: number;
  kind: LocalhostService["kind"];
  label: string;
}> = [
  // Dev servers
  { port: 3000, kind: "dev-server", label: "Next.js / CRA" },
  { port: 3001, kind: "dev-server", label: "misc" },
  { port: 4000, kind: "dev-server", label: "Phoenix / misc" },
  { port: 4321, kind: "dev-server", label: "Astro" },
  { port: 5000, kind: "dev-server", label: "Flask / misc" },
  { port: 5173, kind: "dev-server", label: "Vite" },
  { port: 5174, kind: "dev-server", label: "Vite (alt)" },
  { port: 5500, kind: "dev-server", label: "Live Server" },
  { port: 8000, kind: "dev-server", label: "Python / misc" },
  { port: 8080, kind: "dev-server", label: "misc" },
  // Databases
  { port: 3306, kind: "database", label: "MySQL" },
  { port: 5432, kind: "database", label: "Postgres" },
  { port: 6379, kind: "database", label: "Redis" },
  { port: 27017, kind: "database", label: "MongoDB" },
  // Zeros engine
  { port: 24193, kind: "engine", label: "Zeros engine" },
  { port: 24194, kind: "engine", label: "Zeros engine" },
  { port: 24195, kind: "engine", label: "Zeros engine" },
  { port: 24196, kind: "engine", label: "Zeros engine" },
  { port: 24197, kind: "engine", label: "Zeros engine" },
  { port: 24198, kind: "engine", label: "Zeros engine" },
  { port: 24199, kind: "engine", label: "Zeros engine" },
  { port: 24200, kind: "engine", label: "Zeros engine" },
];

function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 120);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

export const discoverLocalhostServices: CommandHandler = async () => {
  // Scan all ports concurrently — each probe is bounded at 120ms so
  // the worst case is still ~150ms total.
  const results = await Promise.all(
    KNOWN_PORTS.map(async (entry): Promise<LocalhostService | null> => {
      const open = await portIsOpen(entry.port);
      if (!open) return null;
      return {
        port: entry.port,
        url: `http://localhost:${entry.port}`,
        kind: entry.kind,
        label: entry.label,
      };
    }),
  );
  return results.filter((r): r is LocalhostService => r !== null);
};
