// ============================================
// EDGE FUNCTION: internal-directus-proxy
// PURPOSE: Proxy for the internal admin tool to read/write Directus CMS.
//          Keeps DIRECTUS_ADMIN_TOKEN server-side.
// COLLECTION: feeds (unified content collection)
// ============================================

const DIRECTUS_URL = Deno.env.get("DIRECTUS_URL")!;
const DIRECTUS_ADMIN_TOKEN = Deno.env.get("DIRECTUS_ADMIN_TOKEN")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Directus API helpers ───────────────────────────────────────────

async function directusFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus ${res.status}: ${body}`);
  }
  const text = await res.text();
  if (!text) return { data: null };
  return JSON.parse(text);
}

// ── Types ──────────────────────────────────────────────────────────

interface FeedPayload {
  id?: string;
  title: string;
  slug: string;
  description: string;
  media?: string | null;
  media_type?: string;
  status?: string;
  module?: string;
  tags?: string[];
  applications?: { id?: string; name: string; appData?: { name: string; short_description?: string; website_url?: string; company?: string; platform?: string[] } }[];
  psychology?: { id?: string; name: string }[];
  industries?: { id?: string; name: string }[];
  ai_patterns?: { id?: string; name: string }[];
  ui_elements?: { id?: string; name: string }[];
  sections?: SectionPayload[];
}

interface SectionPayload {
  sort: number;
  title?: string;
  blocks?: BlockPayload[];
}

interface BlockPayload {
  collection: string;
  sort: number;
  item: Record<string, unknown>;
}

// ── Favicon auto-fetch ────────────────────────────────────────────

async function fetchAndUploadFavicon(websiteUrl: string): Promise<string | null> {
  try {
    const url = new URL(websiteUrl);
    const domain = url.hostname;

    // Google's favicon service — free, reliable, returns PNG
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const res = await fetch(faviconUrl);
    if (!res.ok) return null;

    const blob = await res.blob();
    // Skip tiny/default icons (Google returns a default globe icon < 1KB)
    if (blob.size < 500) return null;

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([await blob.arrayBuffer()], { type: "image/png" }),
      `${domain}-logo.png`,
    );

    const uploadRes = await fetch(`${DIRECTUS_URL}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}` },
      body: formData,
    });

    if (!uploadRes.ok) return null;
    const uploadResult = await uploadRes.json();
    return uploadResult.data.id;
  } catch {
    console.warn("[favicon] Failed to fetch/upload favicon for", websiteUrl);
    return null;
  }
}

// ── Taxonomy/Application resolution (create-or-reuse) ──────────────

async function resolveApplicationIds(
  items: Array<{
    id?: string;
    name: string;
    appData?: {
      name: string;
      short_description?: string;
      website_url?: string;
      company?: string;
      platform?: string[];
    };
  }>,
): Promise<string[]> {
  const ids: string[] = [];
  for (const item of items) {
    if (item.id) {
      // Existing app — update if appData is provided (user edited it)
      if (item.appData) {
        await directusFetch(`/items/applications/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: item.appData.name,
            short_description: item.appData.short_description || null,
            website_url: item.appData.website_url || null,
            company: item.appData.company || null,
            platform: item.appData.platform || [],
          }),
        });
      }
      ids.push(item.id);
      continue;
    }
    // Search by exact name
    const search = await directusFetch(
      `/items/applications?filter[name][_eq]=${encodeURIComponent(item.name)}&fields=id&limit=1`,
    );
    if (search.data?.length > 0) {
      ids.push(search.data[0].id);
    } else {
      // Create new application with all fields
      const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const createPayload: Record<string, unknown> = {
        name: item.name,
        slug,
        status: "published",
      };
      if (item.appData) {
        createPayload.short_description = item.appData.short_description || null;
        createPayload.website_url = item.appData.website_url || null;
        createPayload.company = item.appData.company || null;
        createPayload.platform = item.appData.platform || [];
      }
      // Auto-fetch favicon as logo for new apps with a website URL
      const logoUrl = item.appData?.website_url;
      if (logoUrl) {
        const logoFileId = await fetchAndUploadFavicon(logoUrl);
        if (logoFileId) createPayload.logo = logoFileId;
      }
      const created = await directusFetch("/items/applications", {
        method: "POST",
        body: JSON.stringify(createPayload),
      });
      ids.push(created.data.id);
    }
  }
  return ids;
}

async function resolveTaxonomyIds(
  items: { id?: string; name: string }[],
  type: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (const item of items) {
    if (item.id) {
      ids.push(item.id);
      continue;
    }
    const search = await directusFetch(
      `/items/Taxonomy?filter[name][_eq]=${encodeURIComponent(item.name)}&filter[type][_eq]=${encodeURIComponent(type)}&fields=id&limit=1`,
    );
    if (search.data?.length > 0) {
      ids.push(search.data[0].id);
    } else {
      const created = await directusFetch("/items/Taxonomy", {
        method: "POST",
        body: JSON.stringify({
          name: item.name,
          slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          type,
          modules: ["shots"],
        }),
      });
      ids.push(created.data.id);
    }
  }
  return ids;
}

// ── Link M2M relations ─────────────────────────────────────────────

async function linkM2M(
  feedId: string,
  field: string,
  junctionTable: string,
  junctionForeignKey: string,
  ids: string[],
) {
  if (ids.length === 0) return;
  await directusFetch(`/items/feeds/${feedId}`, {
    method: "PATCH",
    body: JSON.stringify({
      [field]: ids.map((id) => ({ [junctionForeignKey]: id })),
    }),
  });
}

// ── Create sections + blocks ───────────────────────────────────────

async function createSectionsAndBlocks(feedId: string, sections: SectionPayload[]) {
  for (const section of sections) {
    const sectionResult = await directusFetch("/items/feed_sections", {
      method: "POST",
      body: JSON.stringify({
        feed_id: feedId,
        sort: section.sort,
        title: section.title || null,
      }),
    });
    const sectionId = sectionResult.data.id;

    if (section.blocks) {
      for (const block of section.blocks) {
        const blockResult = await directusFetch(`/items/${block.collection}`, {
          method: "POST",
          body: JSON.stringify(block.item),
        });
        const blockId = blockResult.data.id;

        await directusFetch("/items/feed_sections_blocks", {
          method: "POST",
          body: JSON.stringify({
            feed_sections_id: sectionId,
            collection: block.collection,
            item: blockId,
            sort: block.sort,
          }),
        });
      }
    }
  }
}

// ── Delete existing sections ───────────────────────────────────────

async function deleteSections(feedId: string) {
  const existing = await directusFetch(
    `/items/feed_sections?filter[feed_id][_eq]=${feedId}&fields=id`,
  );
  for (const section of existing.data || []) {
    await directusFetch(`/items/feed_sections/${section.id}`, { method: "DELETE" });
  }
}

// ── Actions ────────────────────────────────────────────────────────

async function listFeeds() {
  const result = await directusFetch(
    "/items/feeds?fields=id,title,slug,status,description,date_created" +
    "&filter[module][_eq]=shots&sort=-date_created&limit=50",
  );
  return result.data;
}

async function createFeed(payload: FeedPayload) {
  // 1. Create feed item
  const feedResult = await directusFetch("/items/feeds", {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      slug: payload.slug,
      description: payload.description,
      media: payload.media || null,
      media_type: payload.media_type || "image",
      status: payload.status || "draft",
      module: payload.module || "shots",
      tags: payload.tags || [],
    }),
  });
  const feedId = feedResult.data.id;

  // 2. Link applications
  if (payload.applications?.length) {
    const appIds = await resolveApplicationIds(payload.applications);
    await linkM2M(feedId, "applications", "feeds_applications", "applications_id", appIds);
  }

  // 3. Link taxonomy M2M relations
  if (payload.psychology?.length) {
    const ids = await resolveTaxonomyIds(payload.psychology, "Psychology");
    await linkM2M(feedId, "psychology", "feeds_psychology", "taxonomy_id", ids);
  }
  if (payload.industries?.length) {
    const ids = await resolveTaxonomyIds(payload.industries, "Industry");
    await linkM2M(feedId, "industries", "feeds_industries", "taxonomy_id", ids);
  }
  if (payload.ai_patterns?.length) {
    const ids = await resolveTaxonomyIds(payload.ai_patterns, "AI_Pattern");
    await linkM2M(feedId, "ai_patterns", "feeds_ai_patterns", "taxonomy_id", ids);
  }
  if (payload.ui_elements?.length) {
    const ids = await resolveTaxonomyIds(payload.ui_elements, "UI_Element");
    await linkM2M(feedId, "ui_elements", "feeds_ui_elements", "taxonomy_id", ids);
  }

  // 4. Create sections + blocks
  if (payload.sections?.length) {
    await createSectionsAndBlocks(feedId, payload.sections);
  }

  return { id: feedId, title: payload.title };
}

async function updateFeed(payload: FeedPayload & { id: string }) {
  const feedId = payload.id;

  // Update top-level fields
  await directusFetch(`/items/feeds/${feedId}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: payload.title,
      slug: payload.slug,
      description: payload.description,
      media: payload.media || null,
      media_type: payload.media_type || "image",
      status: payload.status || "draft",
      module: payload.module || "shots",
      tags: payload.tags || [],
    }),
  });

  // Delete and recreate sections
  await deleteSections(feedId);
  if (payload.sections?.length) {
    await createSectionsAndBlocks(feedId, payload.sections);
  }

  // Re-link M2M relations (replace all)
  if (payload.applications) {
    const appIds = await resolveApplicationIds(payload.applications);
    await linkM2M(feedId, "applications", "feeds_applications", "applications_id", appIds);
  }
  if (payload.psychology) {
    const ids = await resolveTaxonomyIds(payload.psychology, "Psychology");
    await linkM2M(feedId, "psychology", "feeds_psychology", "taxonomy_id", ids);
  }
  if (payload.industries) {
    const ids = await resolveTaxonomyIds(payload.industries, "Industry");
    await linkM2M(feedId, "industries", "feeds_industries", "taxonomy_id", ids);
  }
  if (payload.ai_patterns) {
    const ids = await resolveTaxonomyIds(payload.ai_patterns, "AI_Pattern");
    await linkM2M(feedId, "ai_patterns", "feeds_ai_patterns", "taxonomy_id", ids);
  }
  if (payload.ui_elements) {
    const ids = await resolveTaxonomyIds(payload.ui_elements, "UI_Element");
    await linkM2M(feedId, "ui_elements", "feeds_ui_elements", "taxonomy_id", ids);
  }

  return { id: feedId, title: payload.title };
}

async function searchFeeds(query: string, status?: string, limit = 20) {
  let url = "/items/feeds?filter[module][_eq]=shots";
  if (status && status !== "all") {
    url += `&filter[status][_eq]=${encodeURIComponent(status)}`;
  }
  if (query && query.trim()) {
    url += `&search=${encodeURIComponent(query)}`;
  }
  url += `&fields=id,title,slug,status,description&sort=-date_created&limit=${limit}`;
  const result = await directusFetch(url);
  return result.data || [];
}

async function getFeed(id: string) {
  const result = await directusFetch(
    `/items/feeds/${id}?fields=id,title,slug,status,description,media,media_type,tags,` +
    `applications.applications_id.id,applications.applications_id.name,` +
    `psychology.taxonomy_id.id,psychology.taxonomy_id.name,psychology.taxonomy_id.type,` +
    `industries.taxonomy_id.id,industries.taxonomy_id.name,industries.taxonomy_id.type,` +
    `ai_patterns.taxonomy_id.id,ai_patterns.taxonomy_id.name,ai_patterns.taxonomy_id.type,` +
    `ui_elements.taxonomy_id.id,ui_elements.taxonomy_id.name,ui_elements.taxonomy_id.type,` +
    `sections.id,sections.sort,sections.title,` +
    `sections.blocks.collection,sections.blocks.sort,` +
    `sections.blocks.item:block_heading.*,` +
    `sections.blocks.item:block_text.*,` +
    `sections.blocks.item:block_rich_text.*,` +
    `sections.blocks.item:block_media.*,` +
    `sections.blocks.item:block_code.*,` +
    `sections.blocks.item:block_table.*,` +
    `sections.blocks.item:block_quote.*,` +
    `sections.blocks.item:block_tags.*,` +
    `sections.blocks.item:block_transcript.*` +
    `&deep[sections][_sort]=sort&deep[sections][blocks][_sort]=sort`,
  );

  const feed = result.data;
  const fields: Record<string, unknown> = {};

  // Top-level fields
  if (feed.title) {
    fields.title = { key: "title", label: "Title", kind: "text", content: feed.title };
  }
  if (feed.description) {
    fields.description = { key: "description", label: "Description", kind: "richtext", content: feed.description };
  }
  if (feed.media) {
    const mediaUrl = `${DIRECTUS_URL}/assets/${feed.media}`;
    fields.media = {
      key: "media", label: "Media", kind: "media", content: "",
      mediaId: feed.media, mediaType: feed.media_type || "image", mediaUrl,
    };
  }

  // M2M fields
  const mapM2M = (items: Array<{ [k: string]: { id: string; name: string; type?: string } }>, foreignKey: string) =>
    (items || []).map((i) => i[foreignKey]).filter(Boolean);

  const apps = mapM2M(feed.applications, "applications_id");
  if (apps.length > 0) {
    fields.applications = {
      key: "applications", label: "Applications", kind: "m2m",
      content: apps.map((a: { name: string }) => a.name).join(", "), items: apps,
    };
  }

  const psych = mapM2M(feed.psychology, "taxonomy_id");
  if (psych.length > 0) {
    fields.psychology = {
      key: "psychology", label: "Psychology", kind: "m2m",
      content: psych.map((p: { name: string }) => p.name).join(", "), items: psych,
    };
  }

  const industries = mapM2M(feed.industries, "taxonomy_id");
  if (industries.length > 0) {
    fields.industries = {
      key: "industries", label: "Industries", kind: "m2m",
      content: industries.map((i: { name: string }) => i.name).join(", "), items: industries,
    };
  }

  const aiPatterns = mapM2M(feed.ai_patterns, "taxonomy_id");
  if (aiPatterns.length > 0) {
    fields.ai_patterns = {
      key: "ai_patterns", label: "AI Patterns", kind: "m2m",
      content: aiPatterns.map((p: { name: string }) => p.name).join(", "), items: aiPatterns,
    };
  }

  const uiElements = mapM2M(feed.ui_elements, "taxonomy_id");
  if (uiElements.length > 0) {
    fields.ui_elements = {
      key: "ui_elements", label: "UI Elements", kind: "m2m",
      content: uiElements.map((e: { name: string }) => e.name).join(", "), items: uiElements,
    };
  }

  // Tags
  if (feed.tags && Array.isArray(feed.tags) && feed.tags.length > 0) {
    fields.tags = {
      key: "tags", label: "Tags", kind: "tags",
      content: feed.tags.join(", "), tags: feed.tags,
    };
  }

  // Insights (sections + blocks)
  const blocks: Array<{ id: string; collection: string; sort: number; data: Record<string, unknown> }> = [];
  for (const section of feed.sections || []) {
    for (const block of section.blocks || []) {
      const item = block.item || {};
      blocks.push({
        id: crypto.randomUUID(),
        collection: block.collection,
        sort: blocks.length + 1,
        data: item,
      });
    }
  }
  if (blocks.length > 0) {
    fields.insights = {
      key: "insights", label: "Insights", kind: "blocks",
      content: `${blocks.length} blocks`, blocks,
    };
  }

  return { title: feed.title, fields };
}

async function listPublishedFeeds(module = "shots", limit = 30) {
  const result = await directusFetch(
    `/items/feeds?fields=id,title,description,tags,` +
    `applications.applications_id.name,` +
    `psychology.taxonomy_id.name,` +
    `industries.taxonomy_id.name` +
    `&filter[module][_eq]=${encodeURIComponent(module)}` +
    `&filter[status][_eq]=published` +
    `&sort=-date_created&limit=${limit}`,
  );

  return (result.data || []).map((feed: Record<string, unknown>) => ({
    id: feed.id,
    title: feed.title,
    description: feed.description || "",
    applications: ((feed.applications as Array<{ applications_id?: { name?: string } }>) || [])
      .map((a) => a.applications_id?.name).filter(Boolean),
    psychology: ((feed.psychology as Array<{ taxonomy_id?: { name?: string } }>) || [])
      .map((p) => p.taxonomy_id?.name).filter(Boolean),
    industries: ((feed.industries as Array<{ taxonomy_id?: { name?: string } }>) || [])
      .map((i) => i.taxonomy_id?.name).filter(Boolean),
    tags: Array.isArray(feed.tags) ? feed.tags : [],
  }));
}

async function searchTaxonomyItems(type: string, query: string) {
  const result = await directusFetch(
    `/items/Taxonomy?filter[type][_eq]=${encodeURIComponent(type)}` +
    `&search=${encodeURIComponent(query)}` +
    `&fields=id,name,type&sort=name&limit=20`,
  );
  return (result.data || []).map((t: { id: string; name: string; type: string }) => ({
    id: t.id, name: t.name, type: t.type,
  }));
}

async function searchApplicationItems(query: string) {
  const result = await directusFetch(
    `/items/applications?search=${encodeURIComponent(query)}` +
    `&fields=id,name&sort=name&limit=20`,
  );
  return (result.data || []).map((a: { id: string; name: string }) => ({
    id: a.id, name: a.name,
  }));
}

async function uploadFileFromBase64(base64Data: string, filename: string) {
  // Extract base64 content and mime type
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 data URL");

  const mimeType = match[1];
  const base64Content = match[2];
  const binaryData = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));

  const formData = new FormData();
  formData.append("file", new Blob([binaryData], { type: mimeType }), filename);

  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus file upload ${res.status}: ${body}`);
  }

  const result = await res.json();
  return {
    id: result.data.id,
    url: `${DIRECTUS_URL}/assets/${result.data.id}`,
  };
}

async function updateFeedStatus(id: string, status: string) {
  await directusFetch(`/items/feeds/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return { id, status };
}

// ── Handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { action, payload } = await req.json();

    let result;
    switch (action) {
      case "list_feeds":
        result = await listFeeds();
        break;
      case "create_feed":
        result = await createFeed(payload);
        break;
      case "update_feed":
        result = await updateFeed(payload);
        break;
      case "update_feed_status":
        result = await updateFeedStatus(payload.id, payload.status);
        break;
      case "search_feeds":
        result = await searchFeeds(payload.query, payload.status, payload.limit);
        break;
      case "get_feed":
        result = await getFeed(payload.id);
        break;
      case "list_published_feeds":
        result = await listPublishedFeeds(payload?.module, payload?.limit);
        break;
      case "search_taxonomy":
        result = await searchTaxonomyItems(payload.type, payload.query);
        break;
      case "search_applications":
        result = await searchApplicationItems(payload.query);
        break;
      case "upload_file":
        result = await uploadFileFromBase64(payload.data, payload.filename);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[internal-directus-proxy] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
