// ──────────────────────────────────────────────────────────
// LOCALHOST service discovery
// ──────────────────────────────────────────────────────────
//
// Column 1's LOCALHOST section polls this command to surface
// whatever is listening on common dev-server / database /
// engine ports. Probing is a plain TCP connect with a short
// timeout — no HTTP client dependency, and closed ports return
// "connection refused" in microseconds so scanning the full
// list stays under ~100ms even on a cold machine.
//
// The returned `kind` lets the frontend decide what to do:
//   - `dev-server`: clickable → sets the preview iframe URL
//   - `database`:   informational (shows up so the user knows)
//   - `engine`:     our own sidecar; rendered separately
//   - `unknown`:    rare fallback
// ──────────────────────────────────────────────────────────

use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::time::Duration;

#[derive(Serialize, Clone)]
pub struct LocalhostService {
    pub port: u16,
    pub url: String,
    pub kind: String,
    pub label: String,
}

/// (port, kind, human-readable label)
/// The engine ports span 24193–24200 because that's the retry
/// range the engine itself uses when 24193 is taken.
const KNOWN_PORTS: &[(u16, &str, &str)] = &[
    // Dev servers
    (3000, "dev-server", "Next.js / CRA"),
    (3001, "dev-server", "misc"),
    (4000, "dev-server", "Phoenix / misc"),
    (4321, "dev-server", "Astro"),
    (5000, "dev-server", "Flask / misc"),
    (5173, "dev-server", "Vite"),
    (5174, "dev-server", "Vite (alt)"),
    (5500, "dev-server", "Live Server"),
    (8000, "dev-server", "Python / misc"),
    (8080, "dev-server", "misc"),
    // Databases
    (3306, "database", "MySQL"),
    (5432, "database", "Postgres"),
    (6379, "database", "Redis"),
    (27017, "database", "MongoDB"),
    // Zeros engine
    (24193, "engine", "Zeros engine"),
    (24194, "engine", "Zeros engine"),
    (24195, "engine", "Zeros engine"),
    (24196, "engine", "Zeros engine"),
    (24197, "engine", "Zeros engine"),
    (24198, "engine", "Zeros engine"),
    (24199, "engine", "Zeros engine"),
    (24200, "engine", "Zeros engine"),
];

fn port_is_open(port: u16) -> bool {
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), port);
    TcpStream::connect_timeout(&addr, Duration::from_millis(120)).is_ok()
}

#[tauri::command]
pub fn discover_localhost_services() -> Vec<LocalhostService> {
    KNOWN_PORTS
        .iter()
        .filter_map(|(port, kind, label)| {
            if port_is_open(*port) {
                Some(LocalhostService {
                    port: *port,
                    url: format!("http://localhost:{}", port),
                    kind: (*kind).to_string(),
                    label: (*label).to_string(),
                })
            } else {
                None
            }
        })
        .collect()
}
