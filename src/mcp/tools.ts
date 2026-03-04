import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getBridgeState, subscribe, type BridgeEvent } from "./bridge";

export function registerTools(server: McpServer) {
  server.tool(
    "designdead_get_pending",
    "List all pending feedback items from the DesignDead UI. Optionally filter by variant ID.",
    { variantId: z.string().optional().describe("Filter by variant ID. Use 'main' for the main app preview.") },
    async ({ variantId }) => {
      const state = getBridgeState();
      let items = state.feedbackItems.filter((f) => f.status === "pending");
      if (variantId) items = items.filter((f) => f.variantId === variantId);

      if (items.length === 0) {
        return { content: [{ type: "text", text: "No pending feedback items." }] };
      }

      const lines = items.map((item, i) => {
        return [
          `## ${i + 1}. [${item.intent.toUpperCase()}] ${item.elementSelector}`,
          `- **ID:** ${item.id}`,
          `- **Variant:** ${item.variantId}`,
          `- **Tag:** ${item.elementTag}`,
          `- **Classes:** ${item.elementClasses.join(", ") || "(none)"}`,
          `- **Severity:** ${item.severity}`,
          `- **Feedback:** ${item.comment}`,
          item.boundingBox ? `- **Position:** ${item.boundingBox.x}x${item.boundingBox.y} (${item.boundingBox.width}x${item.boundingBox.height})` : "",
          "",
        ].filter(Boolean).join("\n");
      });

      const md = `# DesignDead Pending Feedback (${items.length} items)\n\n${lines.join("\n")}`;
      return { content: [{ type: "text", text: md }] };
    }
  );

  server.tool(
    "designdead_get_variant",
    "Get the HTML, CSS, and metadata for a specific variant by ID.",
    { variantId: z.string().describe("The variant ID to retrieve.") },
    async ({ variantId }) => {
      const state = getBridgeState();
      const variant = state.variants.find((v) => v.id === variantId);

      if (!variant) {
        return { content: [{ type: "text", text: `Variant '${variantId}' not found.` }] };
      }

      const html = variant.modifiedHtml || variant.html;
      const css = variant.modifiedCss || variant.css;

      const md = [
        `# Variant: ${variant.name}`,
        `- **ID:** ${variant.id}`,
        `- **Type:** ${variant.sourceType}`,
        variant.sourceSelector ? `- **Selector:** \`${variant.sourceSelector}\`` : "",
        variant.sourceElementId ? `- **Source Element ID:** ${variant.sourceElementId}` : "",
        variant.sourcePageRoute ? `- **Source Route:** ${variant.sourcePageRoute}` : "",
        `- **Status:** ${variant.status}`,
        `- **Created:** ${new Date(variant.createdAt).toISOString()}`,
        "",
        "## HTML",
        "```html",
        html,
        "```",
        "",
        css ? `## CSS\n\`\`\`css\n${css}\n\`\`\`` : "",
      ].filter(Boolean).join("\n");

      return { content: [{ type: "text", text: md }] };
    }
  );

  server.tool(
    "designdead_resolve_feedback",
    "Mark one or more feedback items as resolved. Call this after you've implemented the requested changes.",
    { ids: z.array(z.string()).describe("Array of feedback item IDs to mark as resolved.") },
    async ({ ids }) => {
      const state = getBridgeState();
      let resolved = 0;
      for (const id of ids) {
        state.resolvedIds.add(id);
        const item = state.feedbackItems.find((f) => f.id === id);
        if (item) {
          item.status = "resolved";
          resolved++;
        }
      }
      return { content: [{ type: "text", text: `Resolved ${resolved} feedback item(s).` }] };
    }
  );

  server.tool(
    "designdead_push_changes",
    "Send modified HTML/CSS back to the DesignDead UI for a specific variant. The browser will update the preview.",
    {
      variantId: z.string().describe("The variant ID to update."),
      html: z.string().describe("The modified HTML content."),
      css: z.string().optional().describe("The modified CSS content."),
    },
    async ({ variantId, html, css }) => {
      const state = getBridgeState();
      const variant = state.variants.find((v) => v.id === variantId);
      if (variant) {
        variant.modifiedHtml = html;
        if (css) variant.modifiedCss = css;
      }
      return { content: [{ type: "text", text: `Updated variant '${variantId}'. Changes will be reflected in the DesignDead UI.` }] };
    }
  );

  server.tool(
    "designdead_list_variants",
    "List all variants in the current DesignDead project.",
    {},
    async () => {
      const state = getBridgeState();
      if (state.variants.length === 0) {
        return { content: [{ type: "text", text: "No variants in the current project." }] };
      }

      const lines = state.variants.map((v) => {
        const feedbackCount = state.feedbackItems.filter((f) => f.variantId === v.id && f.status === "pending").length;
        return `- **${v.name}** (${v.id}) — ${v.sourceType} — ${v.status} — ${feedbackCount} pending feedback`;
      });

      const md = `# DesignDead Variants (${state.variants.length})\n\n${lines.join("\n")}`;
      return { content: [{ type: "text", text: md }] };
    }
  );

  server.tool(
    "designdead_get_project",
    "Get the current DesignDead project information.",
    {},
    async () => {
      const state = getBridgeState();
      if (!state.project) {
        return { content: [{ type: "text", text: "No project connected." }] };
      }
      const md = [
        `# Project: ${state.project.name}`,
        `- **ID:** ${state.project.id}`,
        `- **App URL:** ${state.project.appUrl}`,
        `- **Variants:** ${state.variants.length}`,
        `- **Pending Feedback:** ${state.feedbackItems.filter((f) => f.status === "pending").length}`,
      ].join("\n");
      return { content: [{ type: "text", text: md }] };
    }
  );

  server.tool(
    "designdead_watch",
    "Long-poll for new feedback items. Returns any pending items added since the given timestamp.",
    { since: z.number().optional().describe("Unix timestamp (ms) to get items after. Defaults to 0.") },
    async ({ since }) => {
      const state = getBridgeState();
      const cutoff = since || 0;
      const newItems = state.feedbackItems.filter(
        (f) => f.timestamp > cutoff && f.status === "pending"
      );

      if (newItems.length === 0) {
        return { content: [{ type: "text", text: "No new feedback since the given timestamp." }] };
      }

      const lines = newItems.map((item) =>
        `- [${item.intent}/${item.severity}] ${item.elementSelector}: "${item.comment}" (ID: ${item.id})`
      );

      return {
        content: [{
          type: "text",
          text: `# New Feedback (${newItems.length} items since ${new Date(cutoff).toISOString()})\n\n${lines.join("\n")}`,
        }],
      };
    }
  );
}
