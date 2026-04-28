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
const { execFileSync } = require("node:child_process");

const NEW_NAME = "Zeros Dev";
const NEW_EXEC = "Zeros Dev";
// LaunchServices keys its name + icon cache by CFBundleIdentifier. The
// stock Electron bundle ID is `com.github.Electron`, which macOS has
// already cached against the name "Electron" — patching CFBundleName
// alone won't override that cached entry. Giving the dev bundle a
// distinct ID makes LaunchServices treat it as a brand-new app. Kept
// separate from the prod ID (electron-builder.yml: design.zeros.app)
// so installed and dev apps coexist cleanly.
const NEW_BUNDLE_ID = "design.zeros.app.dev";
const REPO_ROOT = path.resolve(__dirname, "..");
const DEV_ICON_SRC = path.join(REPO_ROOT, "build/icons/icon-dev.icns");

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

function patchIcon(appDir) {
  // The dev bundle's CFBundleIconFile points to `electron.icns`. Overwrite
  // that with our transparent dev icon so the Dock launch icon, Finder
  // Get-Info, and Cmd-Tab switcher all show the Zeros Dev mark — not just
  // the runtime app.dock.setIcon() override which only kicks in after
  // the renderer is ready.
  if (!fs.existsSync(DEV_ICON_SRC)) return false;
  const dest = path.join(appDir, "Contents/Resources/electron.icns");
  if (!fs.existsSync(dest)) return false;
  const srcBuf = fs.readFileSync(DEV_ICON_SRC);
  if (fs.existsSync(dest)) {
    const dstBuf = fs.readFileSync(dest);
    if (srcBuf.equals(dstBuf)) return false;
  }
  fs.writeFileSync(dest, srcBuf);
  return true;
}

function refreshLaunchServices(appDir) {
  // LaunchServices caches CFBundleName/icon per bundle path. Without a
  // forced re-register, the Dock keeps showing the stock "Electron"
  // label even after the plist is patched. `lsregister -f` is the
  // documented nudge — best-effort, swallow failures.
  const lsregister =
    "/System/Library/Frameworks/CoreServices.framework/" +
    "Frameworks/LaunchServices.framework/Support/lsregister";
  try {
    execFileSync(lsregister, ["-f", appDir], { stdio: "ignore" });
  } catch {
    /* best-effort */
  }
}

function patchPlist(plistPath) {
  let plist = fs.readFileSync(plistPath, "utf8");
  let changed = false;
  const targets = {
    CFBundleName: NEW_NAME,
    CFBundleDisplayName: NEW_NAME,
    // The Cmd-Tab / App Switcher shows CFBundleExecutable when the app
    // is unsigned (which dev Electron is) — patching CFBundleName alone
    // leaves "Electron" visible there.
    CFBundleExecutable: NEW_EXEC,
    CFBundleIdentifier: NEW_BUNDLE_ID,
  };
  for (const [key, value] of Object.entries(targets)) {
    const re = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);
    const m = plist.match(re);
    if (m) {
      if (m[2] !== value) {
        plist = plist.replace(re, `$1${value}$3`);
        changed = true;
      }
    } else if (key === "CFBundleDisplayName") {
      // Insert next to CFBundleName if missing — Electron's stock
      // plist sometimes omits the display-name key.
      plist = plist.replace(
        /(<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>)/,
        `$1\n\t<key>CFBundleDisplayName</key>\n\t<string>${value}</string>`,
      );
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(plistPath, plist);
  return changed;
}

function patchExecutable(appDir) {
  // Rename Contents/MacOS/Electron → Contents/MacOS/<NEW_EXEC> so the
  // process name in `ps`, Activity Monitor, and the App Switcher all
  // show the dev branding. CFBundleExecutable in Info.plist must match
  // the file on disk, or macOS refuses to launch the bundle.
  const macosDir = path.join(appDir, "Contents/MacOS");
  const oldBin = path.join(macosDir, "Electron");
  const newBin = path.join(macosDir, NEW_EXEC);
  if (fs.existsSync(newBin)) return false;
  if (!fs.existsSync(oldBin)) return false;
  fs.renameSync(oldBin, newBin);
  return true;
}

function patchPathTxt(appDir) {
  // The `electron` npm package launches whatever path.txt points at.
  // After we rename the executable, path.txt has to follow or the dev
  // CLI errors with ENOENT.
  const electronPkgDir = path.resolve(appDir, "../..");
  const pathTxt = path.join(electronPkgDir, "path.txt");
  if (!fs.existsSync(pathTxt)) return false;
  const want = `Electron.app/Contents/MacOS/${NEW_EXEC}`;
  const current = fs.readFileSync(pathTxt, "utf8").trim();
  if (current === want) return false;
  fs.writeFileSync(pathTxt, want);
  return true;
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
  // Order matters: rename the on-disk binary first, then patch the
  // plist (CFBundleExecutable must match the new file), then path.txt
  // so `electron` CLI launches the right path.
  const execChanged = patchExecutable(appDir);
  const plistChanged = patchPlist(plistPath);
  const pathTxtChanged = patchPathTxt(appDir);
  const iconChanged = patchIcon(appDir);
  if (plistChanged || iconChanged || execChanged || pathTxtChanged) {
    // Touch the bundle so LaunchServices re-reads the metadata, then
    // force a re-register. Without this the Dock keeps the stale
    // "Electron" name + icon. If still stuck, nuclear option:
    //   /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain user
    try {
      fs.utimesSync(appDir, new Date(), new Date());
    } catch {
      /* best-effort */
    }
    refreshLaunchServices(appDir);
    const bits = [
      plistChanged && `name → "${NEW_NAME}"`,
      execChanged && `executable → "${NEW_EXEC}"`,
      pathTxtChanged && "path.txt",
      iconChanged && "icon → icon-dev.icns",
    ].filter(Boolean);
    console.log(`[rename-dev-electron] patched ${bits.join(", ")}`);
  }
}

main();
