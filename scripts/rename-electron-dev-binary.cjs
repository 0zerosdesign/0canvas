// ──────────────────────────────────────────────────────────
// Patch the dev Electron.app to identify as "Zeros Dev"
// ──────────────────────────────────────────────────────────
//
// `pnpm electron:dev` launches the prebuilt Electron binary that
// ships in node_modules. Its bundled Info.plist says CFBundleName =
// "Electron" — which is what macOS shows in the Dock tooltip, Apple
// menu, Cmd-Tab switcher, and About dialog. `app.setName()` from JS
// can rename app.getName() / userData paths but does NOT override
// those macOS-level labels.
//
// This script patches the dev binary's Info.plist so the Dock and
// macOS chrome show "Zeros Dev" while running unpackaged. Idempotent
// — safe to re-run. Has no effect on packaged builds (electron-
// builder produces its own .app from electron-builder.yml's
// productName field).
//
// Wired into the `electron:dev` script so a fresh `pnpm install`
// (which restores Electron's pristine Info.plist) is auto-fixed on
// the next dev run.
// ──────────────────────────────────────────────────────────

const fs = require("node:fs");
const path = require("node:path");

const NEW_NAME = "Zeros Dev";

function findElectronApp() {
  const repoRoot = path.resolve(__dirname, "..");
  const candidates = [
    path.join(repoRoot, "node_modules/electron/dist/Electron.app"),
  ];
  // pnpm hoists electron under .pnpm/electron@<version>/node_modules/electron
  const pnpmRoot = path.join(repoRoot, "node_modules/.pnpm");
  if (fs.existsSync(pnpmRoot)) {
    for (const entry of fs.readdirSync(pnpmRoot)) {
      if (entry.startsWith("electron@")) {
        candidates.push(
          path.join(
            pnpmRoot,
            entry,
            "node_modules/electron/dist/Electron.app",
          ),
        );
      }
    }
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function patchPlist(plistPath) {
  let plist = fs.readFileSync(plistPath, "utf8");
  let changed = false;
  for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
    const re = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);
    const m = plist.match(re);
    if (m) {
      if (m[2] !== NEW_NAME) {
        plist = plist.replace(re, `$1${NEW_NAME}$3`);
        changed = true;
      }
    } else if (key === "CFBundleDisplayName") {
      // Insert next to CFBundleName if missing — Electron's stock
      // plist sometimes omits the display-name key.
      plist = plist.replace(
        /(<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>)/,
        `$1\n\t<key>CFBundleDisplayName</key>\n\t<string>${NEW_NAME}</string>`,
      );
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(plistPath, plist);
  return changed;
}

function main() {
  if (process.platform !== "darwin") return;
  const appDir = findElectronApp();
  if (!appDir) {
    console.warn("[rename-dev-electron] Electron.app not found — skipping");
    return;
  }
  const plistPath = path.join(appDir, "Contents/Info.plist");
  if (!fs.existsSync(plistPath)) {
    console.warn(`[rename-dev-electron] missing ${plistPath} — skipping`);
    return;
  }
  const changed = patchPlist(plistPath);
  if (changed) {
    // Touch the bundle so LaunchServices re-reads the metadata. Not
    // a complete cache flush — if the Dock is stuck on the old name,
    // user can run:
    //   /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain user
    try {
      fs.utimesSync(appDir, new Date(), new Date());
    } catch {
      /* best-effort */
    }
    console.log(
      `[rename-dev-electron] patched ${path.relative(process.cwd(), plistPath)} → "${NEW_NAME}"`,
    );
  }
}

main();
