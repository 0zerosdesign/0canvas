// ──────────────────────────────────────────────────────────
// electron-builder afterPack hook — deep ad-hoc resign
// ──────────────────────────────────────────────────────────
//
// Without a Developer ID, electron-builder's default ad-hoc sign is
// incomplete on arm64 Macs — macOS rejects it with "code has no
// resources but signature indicates they must be present" and the
// app silently exits on launch.
//
// Running `codesign --force --deep --sign -` re-signs the app
// bundle with a COMPLETE ad-hoc signature that seals all nested
// resources + frameworks. The user still needs
//   xattr -cr /Applications/Zeros.app
// to strip the quarantine flag on first install, but once that's
// done the app launches normally.
//
// When we eventually buy an Apple Developer cert, swap
// electron-builder.yml's `mac.identity: null` for the real
// identity and delete this hook.
// ──────────────────────────────────────────────────────────

const { execFileSync } = require("node:child_process");
const path = require("node:path");

/** @type {import("electron-builder").AfterPackContext => Promise<void>} */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  // eslint-disable-next-line no-console
  console.log(`[afterPack] deep ad-hoc re-sign: ${appPath}`);
  try {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
      stdio: "inherit",
    });
  } catch (err) {
    // Surface the codesign failure — silent failure here means the
    // packaged app will mysteriously exit on launch with no log.
    throw new Error(
      `afterPack codesign failed: ${err instanceof Error ? err.message : err}`,
    );
  }
};
