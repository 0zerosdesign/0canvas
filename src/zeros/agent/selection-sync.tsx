// ──────────────────────────────────────────────────────────
// SelectionSync — mirror the browser's selection state to the engine
// ──────────────────────────────────────────────────────────
//
// Runs as an effect-only component. Whenever the workspace selection
// changes, we send an ELEMENT_SELECTED message over the bridge. The
// engine caches the latest payload and exposes it as the
// Zeros_get_selection MCP tool, so the agent always knows what the
// designer is looking at without the user having to spell it out.
//
// Rendered null. Mounted once in app-shell under BridgeProvider.
// ──────────────────────────────────────────────────────────

import { useEffect } from "react";
import { useWorkspace, findElement } from "../store/store";
import { useBridge } from "../bridge/use-bridge";

export function SelectionSync() {
  const { state } = useWorkspace();
  const bridge = useBridge();

  useEffect(() => {
    if (!bridge) return;
    if (bridge.status !== "connected") return;

    const id = state.selectedElementId;
    if (!id) {
      // Explicitly clear the cache upstream by sending an empty selection.
      bridge.send({
        type: "ELEMENT_SELECTED",
        selector: "",
        tagName: "",
        className: "",
        computedStyles: {},
      });
      return;
    }

    const el = findElement(state.elements, id);
    if (!el) return;

    bridge.send({
      type: "ELEMENT_SELECTED",
      selector: el.selector,
      tagName: el.tag,
      className: el.classes.join(" "),
      computedStyles: el.styles,
    });
  }, [bridge, state.selectedElementId, state.elements]);

  return null;
}
