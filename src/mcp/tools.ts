import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getBridgeState, pushVariantChanges, subscribe, getProjectFile, setProjectFile, type BridgeEvent } from "./bridge";
import {
  type OCDocument,
  type OCNode,
  findNodeById,
  updateNodeById,
  deleteNodeById,
  insertNode,
} from "../0canvas/format/oc-format";
import {
  type OCProjectFile,
  validateOCProjectFile,
  OC_PROJECT_SCHEMA_VERSION,
} from "../0canvas/format/oc-project";

export function registerTools(server: McpServer) {
  server.tool(
    "0canvas_get_pending",
    "List all pending feedback items from the ZeroCanvas UI. Optionally filter by variant ID.",
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

      const md = `# ZeroCanvas Pending Feedback (${items.length} items)\n\n${lines.join("\n")}`;
      return { content: [{ type: "text", text: md }] };
    }
  );

  server.tool(
    "0canvas_get_variant",
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
    "0canvas_resolve_feedback",
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
    "0canvas_push_changes",
    "Send modified HTML/CSS back to the ZeroCanvas UI for a specific variant. The browser will update the preview.",
    {
      variantId: z.string().describe("The variant ID to update."),
      html: z.string().describe("The modified HTML content."),
      css: z.string().optional().describe("The modified CSS content."),
    },
    async ({ variantId, html, css }) => {
      pushVariantChanges(variantId, html, css);
      return { content: [{ type: "text", text: `Pushed changes to variant '${variantId}'. The ZeroCanvas UI will update within 2 seconds.` }] };
    }
  );

  server.tool(
    "0canvas_list_variants",
    "List all variants in the current ZeroCanvas project.",
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

      const md = `# ZeroCanvas Variants (${state.variants.length})\n\n${lines.join("\n")}`;
      return { content: [{ type: "text", text: md }] };
    }
  );

  server.tool(
    "0canvas_get_project",
    "Get the current ZeroCanvas project information.",
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
    "0canvas_watch",
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

  // ── .0c Format Tools ──────────────────────────────────────

  server.tool(
    "0canvas_get_variant_tree",
    "Get the .0c JSON tree for a variant — a compact, structured representation of the design. Much cheaper to read/modify than raw HTML/CSS. Returns the full OCDocument JSON.",
    { variantId: z.string().describe("The variant ID to get the .0c tree for.") },
    async ({ variantId }) => {
      const state = getBridgeState();
      const variant = state.variants.find((v) => v.id === variantId);
      if (!variant) {
        return { content: [{ type: "text", text: `Variant '${variantId}' not found.` }] };
      }

      const ocDoc: OCDocument | undefined = (variant as any).ocDocument;
      if (!ocDoc) {
        return { content: [{ type: "text", text: `Variant '${variantId}' does not have a .0c document. It may use legacy HTML/CSS format.` }] };
      }

      return { content: [{ type: "text", text: JSON.stringify(ocDoc, null, 2) }] };
    }
  );

  server.tool(
    "0canvas_update_node",
    "Update a specific node in a variant's .0c tree by its ID. Provide partial updates — only the properties you specify will be changed.",
    {
      variantId: z.string().describe("The variant ID containing the node."),
      nodeId: z.string().describe("The ID of the node to update."),
      updates: z.string().describe("JSON string of partial OCNode properties to merge (e.g. '{\"text\":\"New title\",\"styles\":{\"fontSize\":\"24px\"}}')."),
    },
    async ({ variantId, nodeId, updates }) => {
      const state = getBridgeState();
      const variant = state.variants.find((v) => v.id === variantId);
      if (!variant) {
        return { content: [{ type: "text", text: `Variant '${variantId}' not found.` }] };
      }

      const ocDoc: OCDocument | undefined = (variant as any).ocDocument;
      if (!ocDoc) {
        return { content: [{ type: "text", text: `Variant '${variantId}' has no .0c document.` }] };
      }

      let parsed: Partial<OCNode>;
      try {
        parsed = JSON.parse(updates);
      } catch {
        return { content: [{ type: "text", text: "Invalid JSON in updates parameter." }] };
      }

      const success = updateNodeById(ocDoc.tree, nodeId, parsed);
      if (!success) {
        return { content: [{ type: "text", text: `Node '${nodeId}' not found in variant '${variantId}'.` }] };
      }

      return { content: [{ type: "text", text: `Updated node '${nodeId}' in variant '${variantId}'.` }] };
    }
  );

  server.tool(
    "0canvas_add_node",
    "Insert a new node into a variant's .0c tree as a child of the specified parent.",
    {
      variantId: z.string().describe("The variant ID."),
      parentId: z.string().describe("The parent node ID to insert under."),
      node: z.string().describe("JSON string of the new OCNode to insert."),
      position: z.number().optional().describe("Index to insert at. Omit to append at end."),
    },
    async ({ variantId, parentId, node: nodeJson, position }) => {
      const state = getBridgeState();
      const variant = state.variants.find((v) => v.id === variantId);
      if (!variant) {
        return { content: [{ type: "text", text: `Variant '${variantId}' not found.` }] };
      }

      const ocDoc: OCDocument | undefined = (variant as any).ocDocument;
      if (!ocDoc) {
        return { content: [{ type: "text", text: `Variant '${variantId}' has no .0c document.` }] };
      }

      let newNode: OCNode;
      try {
        newNode = JSON.parse(nodeJson);
      } catch {
        return { content: [{ type: "text", text: "Invalid JSON in node parameter." }] };
      }

      const success = insertNode(ocDoc.tree, parentId, newNode, position);
      if (!success) {
        return { content: [{ type: "text", text: `Parent node '${parentId}' not found.` }] };
      }

      return { content: [{ type: "text", text: `Inserted node '${newNode.id}' under '${parentId}'.` }] };
    }
  );

  server.tool(
    "0canvas_delete_node",
    "Remove a node from a variant's .0c tree by ID.",
    {
      variantId: z.string().describe("The variant ID."),
      nodeId: z.string().describe("The node ID to delete."),
    },
    async ({ variantId, nodeId }) => {
      const state = getBridgeState();
      const variant = state.variants.find((v) => v.id === variantId);
      if (!variant) {
        return { content: [{ type: "text", text: `Variant '${variantId}' not found.` }] };
      }

      const ocDoc: OCDocument | undefined = (variant as any).ocDocument;
      if (!ocDoc) {
        return { content: [{ type: "text", text: `Variant '${variantId}' has no .0c document.` }] };
      }

      const success = deleteNodeById(ocDoc.tree, nodeId);
      if (!success) {
        return { content: [{ type: "text", text: `Node '${nodeId}' not found.` }] };
      }

      return { content: [{ type: "text", text: `Deleted node '${nodeId}' from variant '${variantId}'.` }] };
    }
  );

  server.tool(
    "0canvas_set_variable",
    "Set or update a design variable (token) in a variant's .0c document.",
    {
      variantId: z.string().describe("The variant ID."),
      name: z.string().describe("Variable name (e.g. 'color.primary', 'spacing.lg')."),
      type: z.enum(["color", "number", "string"]).describe("Variable type."),
      value: z.union([z.string(), z.number()]).describe("Variable value."),
    },
    async ({ variantId, name, type, value }) => {
      const state = getBridgeState();
      const variant = state.variants.find((v) => v.id === variantId);
      if (!variant) {
        return { content: [{ type: "text", text: `Variant '${variantId}' not found.` }] };
      }

      const ocDoc: OCDocument | undefined = (variant as any).ocDocument;
      if (!ocDoc) {
        return { content: [{ type: "text", text: `Variant '${variantId}' has no .0c document.` }] };
      }

      if (!ocDoc.variables) ocDoc.variables = {};
      ocDoc.variables[name] = { type, value };

      return { content: [{ type: "text", text: `Set variable '${name}' = ${value} in variant '${variantId}'.` }] };
    }
  );

  server.tool(
    "0canvas_get_variables",
    "List all design variables (tokens) in a variant's .0c document.",
    { variantId: z.string().describe("The variant ID.") },
    async ({ variantId }) => {
      const state = getBridgeState();
      const variant = state.variants.find((v) => v.id === variantId);
      if (!variant) {
        return { content: [{ type: "text", text: `Variant '${variantId}' not found.` }] };
      }

      const ocDoc: OCDocument | undefined = (variant as any).ocDocument;
      if (!ocDoc || !ocDoc.variables || Object.keys(ocDoc.variables).length === 0) {
        return { content: [{ type: "text", text: `No variables defined in variant '${variantId}'.` }] };
      }

      const lines = Object.entries(ocDoc.variables).map(
        ([name, v]) => `- **${name}** (${v.type}): \`${v.value}\``
      );
      return { content: [{ type: "text", text: `# Variables (${lines.length})\n\n${lines.join("\n")}` }] };
    }
  );

  // ── .0c Project File Tools ────────────────────────────────

  server.tool(
    "0canvas_get_project_file",
    "Get the full .0c project file as JSON. This contains the entire project: metadata, workspace config, breakpoints, variables, pages, variants, annotations, feedback, and history.",
    {},
    async () => {
      const file = getProjectFile();
      if (!file) {
        return { content: [{ type: "text", text: "No .0c project file available. The browser may not have synced yet." }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(file, null, 2) }] };
    }
  );

  server.tool(
    "0canvas_save_project_file",
    "Save/update the .0c project file. Provide the full OCProjectFile JSON. The browser will sync the changes. Requires matching or incremented revision number.",
    {
      projectFile: z.string().describe("Full OCProjectFile JSON string."),
      expectedRevision: z.number().int().optional().describe("Expected current revision for conflict detection. If provided and mismatched, save will be rejected."),
    },
    async ({ projectFile, expectedRevision }) => {
      let parsed: any;
      try {
        parsed = JSON.parse(projectFile);
      } catch {
        return { content: [{ type: "text", text: "Invalid JSON in projectFile parameter." }] };
      }

      const result = validateOCProjectFile(parsed);
      if (!result.valid) {
        return { content: [{ type: "text", text: `Validation failed:\n${(result as any).errors.join("\n")}` }] };
      }

      const currentFile = getProjectFile();
      if (expectedRevision !== undefined && currentFile) {
        if (currentFile.project.revision !== expectedRevision) {
          return {
            content: [{
              type: "text",
              text: `REVISION_CONFLICT: expected revision ${expectedRevision} but current is ${currentFile.project.revision}. Re-fetch the project file and retry.`,
            }],
          };
        }
      }

      setProjectFile(result.data);
      return { content: [{ type: "text", text: `Saved .0c project file (revision ${result.data.project.revision}).` }] };
    }
  );

  server.tool(
    "0canvas_get_project_meta",
    "Get summary metadata of the .0c project file without the full content. Returns project name, variant count, revision, and last updated timestamp.",
    {},
    async () => {
      const file = getProjectFile();
      if (!file) {
        return { content: [{ type: "text", text: "No .0c project file available." }] };
      }
      const md = [
        `# .0c Project: ${file.project.name}`,
        `- **ID:** ${file.project.id}`,
        `- **Schema Version:** ${file.schemaVersion}`,
        `- **Revision:** ${file.project.revision}`,
        `- **Framework:** ${file.workspace.framework}`,
        `- **Pages:** ${file.pages.length}`,
        `- **Variants:** ${file.variants.length}`,
        `- **Variables:** ${Object.keys(file.variables).length}`,
        `- **Created:** ${file.project.createdAt}`,
        `- **Updated:** ${file.project.updatedAt}`,
        `- **Integrity:** ${file.integrity.hash || "(not computed)"}`,
      ].join("\n");
      return { content: [{ type: "text", text: md }] };
    }
  );

  server.tool(
    "0canvas_write_project_to_workspace",
    "Write the current .0c project file to a file path in the workspace. The file can then be committed to version control and opened by IDE extensions.",
    {
      filePath: z.string().optional().describe("File path relative to workspace root. Defaults to 'design/project.0c'."),
    },
    async ({ filePath }) => {
      const file = getProjectFile();
      if (!file) {
        return { content: [{ type: "text", text: "No .0c project file available to write." }] };
      }

      const path = filePath || "design/project.0c";
      const json = JSON.stringify(file, null, 2);

      // Use bridge to write file
      const state = getBridgeState();
      (state as any)._pendingFileWrite = { path, content: json };

      return {
        content: [{
          type: "text",
          text: `Queued write of .0c project file to '${path}' (${json.length} bytes, revision ${file.project.revision}). The bridge will write it to the workspace.`,
        }],
      };
    }
  );
}
