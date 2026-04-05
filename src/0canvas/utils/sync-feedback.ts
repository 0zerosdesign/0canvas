import type { FeedbackItem, VariantData, OCProject } from "../store/store";

const DEFAULT_PORT = 24192;

export type SyncResult = {
  ok: boolean;
  sentCount: number;
  error?: string;
};

/**
 * Sync all pending feedback, variants, and project info to the MCP bridge.
 * Returns the number of feedback items synced.
 */
export async function syncFeedbackToBridge(
  feedbackItems: FeedbackItem[],
  variants: VariantData[],
  project: OCProject,
  port?: number,
): Promise<SyncResult> {
  const bridgePort = port || DEFAULT_PORT;
  const pendingItems = feedbackItems.filter((f) => f.status === "pending");

  if (pendingItems.length === 0) {
    return { ok: true, sentCount: 0 };
  }

  try {
    // Send feedback items
    const fbRes = await fetch(`http://127.0.0.1:${bridgePort}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: pendingItems }),
    });

    if (!fbRes.ok) {
      return { ok: false, sentCount: 0, error: `Bridge returned ${fbRes.status}` };
    }

    // Sync variants and project context
    await Promise.all([
      fetch(`http://127.0.0.1:${bridgePort}/api/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variants }),
      }),
      fetch(`http://127.0.0.1:${bridgePort}/api/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      }),
    ]);

    return { ok: true, sentCount: pendingItems.length };
  } catch (err) {
    return { ok: false, sentCount: 0, error: err instanceof Error ? err.message : "Bridge offline" };
  }
}
