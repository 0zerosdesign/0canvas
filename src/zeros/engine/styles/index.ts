// ──────────────────────────────────────────────────────────
// Zeros Styles — barrel file
// Combines all CSS partials with scoping selector.
// ──────────────────────────────────────────────────────────

import { tokensCSS } from "./tokens";
import { layoutCSS } from "./layout";
import { panelsCSS } from "./panels";
import { toolbarCSS } from "./toolbar";
import { stylePanelCSS } from "./style-panel";
import { canvasCSS } from "./canvas";
import { commandPaletteCSS } from "./command-palette";
import { settingsCSS } from "./settings";

// Scope selector — all rules are scoped under [data-Zeros-root]
const S = "[data-Zeros-root]";

export const ZEROS_CSS = `
/* ============================================================
   Zeros — Complete Self-Contained Styles
   ============================================================ */
${[
  tokensCSS(S),
  layoutCSS(S),
  panelsCSS(S),
  toolbarCSS(S),
  stylePanelCSS(S),
  canvasCSS(S),
  commandPaletteCSS(S),
  settingsCSS(S),
].join("\n")}
`;
